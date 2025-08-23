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
    const start = (event.queryStringParameters?.start || '').trim();
    if (!start) return { statusCode: 400, headers, body: 'Missing start query param (YYYY-MM-DD)' };
    const format = (event.queryStringParameters?.format || 'json').toLowerCase();

    const week = toWeekParam(start);
    const url = `https://www.forexfactory.com/calendar?week=${week}`;
    const html = await fetchText(url);

    const $ = cheerio.load(html);
    const table = $('table.calendar__table');
    if (!table.length) throw new Error('Calendar table not found');

    // Map day sections to ISO dates based on Monday anchor
    const d = new Date(start);
    const monday = new Date(d);
    const wd = monday.getDay();
    monday.setDate(monday.getDate() - ((wd + 6) % 7)); // Monday

    let dayIndex = -1;
    let currentIso = null;
    const rows = [];

    table.find('tr').each((_, el) => {
      const row = $(el);
      const dateCell = row.find('td.calendar__date, td.date');
      if (dateCell.length && dateCell.text().trim()) {
        dayIndex += 1;
        const cur = new Date(monday);
        cur.setDate(monday.getDate() + dayIndex);
        currentIso = cur.toISOString().slice(0, 10);
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

    // If the rolling 7-day window crosses into next week, fetch the next page too
    const windowEnd = new Date(d); windowEnd.setDate(d.getDate() + 6);
    const weekSunday = new Date(monday); weekSunday.setDate(monday.getDate() + 6);
    if (windowEnd > weekSunday) {
      const nextWeekParam = toWeekParam(windowEnd.toISOString().slice(0, 10));
      const url2 = `https://www.forexfactory.com/calendar?week=${nextWeekParam}`;
      const html2 = await fetchText(url2);
      const $2 = cheerio.load(html2);
      const table2 = $2('table.calendar__table');
      if (table2.length) {
        const monday2 = new Date(windowEnd);
        const wd2 = monday2.getDay();
        monday2.setDate(monday2.getDate() - ((wd2 + 6) % 7));
        let dayIndex2 = -1; let currentIso2 = null;
        table2.find('tr').each((_, el) => {
          const row2 = $2(el);
          const dateCell2 = row2.find('td.calendar__date, td.date');
          if (dateCell2.length && dateCell2.text().trim()) {
            dayIndex2 += 1;
            const cur2 = new Date(monday2);
            cur2.setDate(monday2.getDate() + dayIndex2);
            currentIso2 = cur2.toISOString().slice(0, 10);
          }

          const eventCell2 = row2.find('td.calendar__event, td.event');
          if (!eventCell2.length) return;
          const eventText2 = eventCell2.text().trim();
          if (!eventText2) return;

          const timeCell2 = row2.find('td.calendar__time, td.time');
          const currencyCell2 = row2.find('td.calendar__currency, td.currency');
          const impactCell2 = row2.find('td.calendar__impact, td.impact');
          const actualCell2 = row2.find('td.calendar__actual, td.actual');
          const forecastCell2 = row2.find('td.calendar__forecast, td.forecast');
          const previousCell2 = row2.find('td.calendar__previous, td.previous');

          let impact2 = '';
          const span2 = impactCell2.find('span');
          if (span2.length) {
            const cls2 = (span2.attr('class') || '').toLowerCase();
            if (cls2.includes('high') || cls2.includes('red')) impact2 = 'High';
            else if (cls2.includes('medium') || cls2.includes('ora') || cls2.includes('orange')) impact2 = 'Medium';
            else if (cls2.includes('low') || cls2.includes('yel') || cls2.includes('yellow')) impact2 = 'Low';
          }

          rows.push({
            date: currentIso2,
            time: timeCell2.text().trim(),
            currency: currencyCell2.text().trim(),
            impact: impact2,
            event: eventText2,
            actual: actualCell2.text().trim(),
            forecast: forecastCell2.text().trim(),
            previous: previousCell2.text().trim(),
            scraped_at: new Date().toISOString()
          });
        });
      }
    }

    // Filter to a rolling 7-day window from the selected start date (inclusive)
    const startIso = d.toISOString().slice(0, 10);
    const endDate = new Date(d); endDate.setDate(d.getDate() + 6);
    const endIso = endDate.toISOString().slice(0, 10);
    const filtered = rows.filter((r) => r.date && r.date >= startIso && r.date <= endIso);

    if (format === 'csv') {
      return { statusCode: 200, headers: { ...headers, 'Content-Type': 'text/csv' }, body: toCsv(filtered) };
    }
    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(filtered) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e) }) };
  }
};


