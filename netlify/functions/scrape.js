// Netlify Function (CommonJS): Scrape ForexFactory weekly page and return JSON or CSV
// Avoid bringing in undici/fetch polyfills by requiring only Node core modules
const cheerio = require('cheerio');
const https = require('node:https');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'user-agent': 'Mozilla/5.0 ForexFactoryScraperBot' }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toWeekParam(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) throw new Error('Invalid start date');
  const month = d.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  return `${month}${d.getDate()}.${d.getFullYear()}`; // e.g., aug22.2025
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return lines.join('\n');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const qs = event.queryStringParameters || {};
    const weekParamRaw = (qs.week || '').trim();
    const dayParamRaw = (qs.day || '').trim(); // yesterday|today|tomorrow
    const monthParamRaw = (qs.month || '').trim(); // last|this|next
    const start = (qs.start || '').trim();
    if (!weekParamRaw && !dayParamRaw && !monthParamRaw && !start) {
      return { statusCode: 400, headers, body: 'Missing query: provide day=, week=, month=, or start=YYYY-MM-DD' };
    }
    const format = (event.queryStringParameters?.format || 'json').toLowerCase();

    // Build FF URL exactly like the site
    let url = '';
    if (dayParamRaw) {
      url = `https://www.forexfactory.com/calendar?day=${encodeURIComponent(dayParamRaw)}`;
    } else if (weekParamRaw || start) {
      const week = weekParamRaw || toWeekParam(start);
      url = `https://www.forexfactory.com/calendar?week=${week}`;
    } else if (monthParamRaw) {
      url = `https://www.forexfactory.com/calendar?month=${encodeURIComponent(monthParamRaw)}`;
    }
    const html = await fetchText(url);

    const $ = cheerio.load(html);
    const table = $('table.calendar__table');
    if (!table.length) throw new Error('Calendar table not found');

    // Establish baseline date for date headers depending on mode
    // Helper: parse an explicit date label from the table (e.g., "Sat Aug 23")
    function parseExplicitDateLabel(label, baselineDate) {
      if (!label) return null;
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const m = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{1,2})(?:\s*,?\s*(\d{4}))?/i.exec(label);
      if (!m) return null;
      const monthIdx = months.indexOf(m[1].toLowerCase());
      const dayNum = Number(m[2]);
      let year = baselineDate.getFullYear();
      if (m[3]) {
        year = Number(m[3]);
      } else {
        // Adjust year for Dec→Jan or Jan→Dec edges when week crosses year boundary
        const baseMonth = baselineDate.getMonth();
        if (baseMonth === 11 && monthIdx === 0) year = year + 1; // Dec baseline, Jan label
        else if (baseMonth === 0 && monthIdx === 11) year = year - 1; // Jan baseline, Dec label
      }
      return new Date(year, monthIdx, dayNum);
    }

    function parseWeekParamToDate(weekParam) {
      // e.g., aug19.2025
      const m = /([a-z]{3})(\d{1,2})\.(\d{4})/i.exec(weekParam);
      if (!m) return null;
      const monthStr = m[1].toLowerCase();
      const monthIdx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthStr);
      if (monthIdx < 0) return null;
      return new Date(Number(m[3]), monthIdx, Number(m[2]));
    }

    let mode = 'week';
    let baseline = null; // Date used when encountering a new date header
    if (dayParamRaw) {
      mode = 'day';
      const now = new Date();
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dayParamRaw === 'yesterday') base.setDate(base.getDate() - 1);
      else if (dayParamRaw === 'tomorrow') base.setDate(base.getDate() + 1);
      baseline = base; // single day
    } else if (weekParamRaw || start) {
      mode = 'week';
      const d = weekParamRaw ? parseWeekParamToDate(weekParamRaw) : new Date(start);
      if (!d || isNaN(d)) throw new Error('Invalid week/start');
      const monday = new Date(d);
      const wd = monday.getDay();
      monday.setDate(monday.getDate() - ((wd + 6) % 7));
      baseline = monday;
    } else if (monthParamRaw) {
      mode = 'month';
      const now = new Date();
      let y = now.getFullYear(); let m = now.getMonth();
      if (monthParamRaw === 'last') { m -= 1; if (m < 0) { m = 11; y -= 1; } }
      else if (monthParamRaw === 'next') { m += 1; if (m > 11) { m = 0; y += 1; } }
      baseline = new Date(y, m, 1);
    }

    let dayIndex = -1; // relative to baseline Monday for week mode
    let currentIso = null;
    const rows = [];

    const dowToIndex = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    table.find('tr').each((_, el) => {
      const row = $(el);
      const dateCell = row.find('td.calendar__date, td.date');
      if (dateCell.length && dateCell.text().trim()) {
        const label = dateCell.text().trim();
        // Prefer explicit month/day parsing to guarantee exact match with site
        const explicit = parseExplicitDateLabel(label, baseline);
        if (explicit) {
          currentIso = formatDateLocal(explicit);
          // align dayIndex to explicit date within the same week window if possible
          const diffMs = explicit - new Date(formatDateLocal(baseline));
          const diffDays = Math.round(diffMs / (24*60*60*1000));
          if (!isNaN(diffDays)) dayIndex = diffDays;
        } else {
          // Try to parse explicit day-of-week to compute correct offset
          let matchedOffset = null;
          const m = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.exec(label);
          if (m) {
            const idx = dowToIndex[m[1].toLowerCase().slice(0,3)];
            if (typeof idx === 'number') matchedOffset = idx;
          }
          if (matchedOffset != null) {
            const cur = new Date(baseline);
            cur.setDate(baseline.getDate() + matchedOffset);
            currentIso = formatDateLocal(cur);
            dayIndex = matchedOffset;
          } else {
            // As a last resort, progress sequentially within the week
            dayIndex += 1;
            const cur = new Date(baseline);
            cur.setDate(baseline.getDate() + Math.max(0, dayIndex));
            currentIso = formatDateLocal(cur);
          }
        }
      }

      const eventCell = row.find('td.calendar__event, td.event');
      if (!eventCell.length) return;
      const eventText = eventCell.text().trim();
      if (!eventText) return;

      const timeCell = row.find('td.calendar__time, td.time');
      const currencyCell = row.find('td.calendar__currency, td.currency');
      const impactCell = row.find('td.calendar__impact, td.impact');
      const actualCell = row.find('td.calendar__actual, td.actual');
      const forecastCell = row.find('td.calendar__forecast, td.forecast');
      const previousCell = row.find('td.calendar__previous, td.previous');

      let impact = '';
      const span = impactCell.find('span');
      if (span.length) {
        const cls = (span.attr('class') || '').toLowerCase();
        if (cls.includes('high') || cls.includes('red')) impact = 'High';
        else if (cls.includes('medium') || cls.includes('ora') || cls.includes('orange')) impact = 'Medium';
        else if (cls.includes('low') || cls.includes('yel') || cls.includes('yellow')) impact = 'Low';
      }

      rows.push({
        date: currentIso,
        time: timeCell.text().trim(),
        currency: currencyCell.text().trim(),
        impact,
        event: eventText,
        actual: actualCell.text().trim(),
        forecast: forecastCell.text().trim(),
        previous: previousCell.text().trim(),
        scraped_at: new Date().toISOString()
      });
    });

    // Filter according to mode for stable output window
    let filtered = rows;
    if (mode === 'week') {
      const weekStart = formatDateLocal(baseline);
      const weekEnd = new Date(baseline); weekEnd.setDate(baseline.getDate() + 6);
      const endIso = formatDateLocal(weekEnd);
      filtered = rows.filter((r) => r.date && r.date >= weekStart && r.date <= endIso);
    } else if (mode === 'day') {
      const iso = formatDateLocal(baseline);
      filtered = rows.filter((r) => r.date === iso);
    } else if (mode === 'month') {
      const startIso = formatDateLocal(new Date(baseline.getFullYear(), baseline.getMonth(), 1));
      const end = new Date(baseline.getFullYear(), baseline.getMonth() + 1, 0);
      const endIso = formatDateLocal(end);
      filtered = rows.filter((r) => r.date && r.date >= startIso && r.date <= endIso);
    }

    if (format === 'csv') {
      return { statusCode: 200, headers: { ...headers, 'Content-Type': 'text/csv' }, body: toCsv(filtered) };
    }
    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(filtered) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e) }) };
  }
};


