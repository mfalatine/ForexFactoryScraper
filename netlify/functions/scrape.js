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

// Parse a ForexFactory calendar HTML page and extract rows
function parseCalendarHtml(html, baseline, timezoneOffset = 0) {
  const $ = cheerio.load(html);
  const table = $('table.calendar__table');
  if (!table.length) throw new Error('Calendar table not found');

  // Helper: parse date labels like "Mon Aug 25" or "Aug 25" or "Monday August 25, 2024"
  function parseExplicitDateLabel(label) {
    if (!label) return null;
    
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    
    // Match patterns like "Aug 25" or "Mon Aug 25" or "August 25, 2024"
    const m = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i.exec(label);
    if (!m) return null;
    
    const monthIdx = months.indexOf(m[1].toLowerCase().slice(0,3));
    if (monthIdx < 0) return null;
    
    const dayNum = parseInt(m[2]);
    let year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    
    // If no year specified and we're looking at a month that might be next year
    // (e.g., viewing January data in December), adjust the year
    if (!m[3]) {
      const currentMonth = new Date().getMonth();
      // If current month is Nov/Dec (10,11) and viewing Jan/Feb (0,1), assume next year
      if (currentMonth >= 10 && monthIdx <= 1) {
        year = new Date().getFullYear() + 1;
      }
      // If current month is Jan/Feb (0,1) and viewing Nov/Dec (10,11), assume last year
      else if (currentMonth <= 1 && monthIdx >= 10) {
        year = new Date().getFullYear() - 1;
      }
    }
    
    return new Date(year, monthIdx, dayNum);
  }

  // Helper: adjust time by timezone offset (keep this as is, it works)
  function adjustTimeAndDate(timeStr, dateIso, offsetHours) {
    // Skip if no time or special values
    if (!timeStr || timeStr === '' || /Day\s+All/i.test(timeStr) || /All\s+Day/i.test(timeStr)) {
      return { time: timeStr, date: dateIso };
    }

    // Parse time in format like "5:07am" or "10:30pm"
    const timeMatch = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(timeStr.trim());
    if (!timeMatch) {
      return { time: timeStr, date: dateIso };
    }

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    // Convert to 24-hour format
    if (ampm === 'pm' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }

    // Add offset
    hours += offsetHours;

    // Handle date rollover
    let newDateIso = dateIso;
    if (hours >= 24) {
      hours -= 24;
      // Increment date by 1 day
      if (dateIso) {
        const [year, month, day] = dateIso.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + 1);
        newDateIso = formatDateLocal(date);
      }
    } else if (hours < 0) {
      hours += 24;
      // Decrement date by 1 day
      if (dateIso) {
        const [year, month, day] = dateIso.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - 1);
        newDateIso = formatDateLocal(date);
      }
    }

    // Convert back to 12-hour format
    let newAmPm = 'am';
    if (hours >= 12) {
      newAmPm = 'pm';
      if (hours > 12) hours -= 12;
    }
    if (hours === 0) hours = 12;

    const newTimeStr = `${hours}:${minutes.toString().padStart(2, '0')}${newAmPm}`;
    return { time: newTimeStr, date: newDateIso };
  }

  // Process the table rows
  let currentIso = null;
  const rows = [];

  table.find('tr').each((_, el) => {
    const row = $(el);
    
    // Check if this row has a date header
    const dateCell = row.find('td.calendar__date, td.date');
    if (dateCell.length && dateCell.text().trim()) {
      const label = dateCell.text().trim();
      const parsedDate = parseExplicitDateLabel(label);
      
      if (parsedDate) {
        // Use the exact date from ForexFactory
        currentIso = formatDateLocal(parsedDate);
      }
      // If we can't parse the date, keep using the previous currentIso
    }

    // Check if this row has an event
    const eventCell = row.find('td.calendar__event, td.event');
    if (!eventCell.length) return;
    const eventText = eventCell.text().trim();
    if (!eventText) return;

    // Only process if we have a current date
    if (!currentIso) return;

    // Extract other fields
    const timeCell = row.find('td.calendar__time, td.time');
    const currencyCell = row.find('td.calendar__currency, td.currency');
    const impactCell = row.find('td.calendar__impact, td.impact');
    const actualCell = row.find('td.calendar__actual, td.actual');
    const forecastCell = row.find('td.calendar__forecast, td.forecast');
    const previousCell = row.find('td.calendar__previous, td.previous');

    // Parse impact level
    let impact = '';
    const span = impactCell.find('span');
    if (span.length) {
      const cls = (span.attr('class') || '').toLowerCase();
      if (cls.includes('high') || cls.includes('red')) impact = 'High';
      else if (cls.includes('medium') || cls.includes('ora') || cls.includes('orange')) impact = 'Medium';
      else if (cls.includes('low') || cls.includes('yel') || cls.includes('yellow')) impact = 'Low';
    }

    // Get the time and apply timezone offset
    const rawTime = timeCell.text().trim();
    const { time: adjustedTime, date: adjustedDate } = adjustTimeAndDate(rawTime, currentIso, timezoneOffset);
    
    // Add the event to results
    rows.push({
      date: adjustedDate,
      time: adjustedTime,
      currency: currencyCell.text().trim(),
      impact,
      event: eventText,
      actual: actualCell.text().trim(),
      forecast: forecastCell.text().trim(),
      previous: previousCell.text().trim(),
      scraped_at: new Date().toISOString()
    });
  });

  return fillMissingTimes(rows);
}

// Post-process to fill in missing times for events in the same time block
function fillMissingTimes(rows) {
  if (!rows || rows.length === 0) return rows;
  
  let currentTime = null;
  let currentDate = null;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // If we encounter a new date, reset the current time
    if (row.date !== currentDate) {
      currentDate = row.date;
      currentTime = null;
    }
    
    // If this row has a time, update our current time
    if (row.time && row.time.trim() !== '') {
      currentTime = row.time;
    } 
    // If this row has no time but we have a current time from a previous row on the same date
    else if ((!row.time || row.time.trim() === '') && currentTime && row.date === currentDate) {
      row.time = currentTime;
    }
  }
  
  return rows;
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
    const weekParamRaw = (qs.week || '').trim(); // last|this|next OR aug19.2025
    const dayParamRaw = (qs.day || '').trim(); // yesterday|today|tomorrow
    const monthParamRaw = (qs.month || '').trim(); // last|this|next
    const start = (qs.start || '').trim();
    
    // Timezone offset parameter (default to 1 hour to match ForexFactory display)
    const timezoneOffset = parseInt(qs.timezoneOffset || '0');
    if (!weekParamRaw && !dayParamRaw && !monthParamRaw && !start) {
      return { statusCode: 400, headers, body: 'Missing query: provide day=, week=, month=, or start=YYYY-MM-DD' };
    }
    const format = (event.queryStringParameters?.format || 'json').toLowerCase();

    // Build FF URL(s) exactly like the site
    let url = '';
    let html = '';
    let rows = [];

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
    } else if (weekParamRaw) {
      mode = 'week';
      // Handle relative week params (last, this, next)
      if (weekParamRaw === 'last' || weekParamRaw === 'this' || weekParamRaw === 'next') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayDow = today.getDay();
        const monday = new Date(today);
        // Fix: Sunday is 0, we want to go back 6 days to get Monday
        // For Mon(1) through Sat(6), we go back (dow-1) days
        // For Sun(0), we go back 6 days to get the previous Monday
        const daysBack = todayDow === 0 ? 6 : todayDow - 1;
        monday.setDate(today.getDate() - daysBack);
        
        if (weekParamRaw === 'last') monday.setDate(monday.getDate() - 7);
        else if (weekParamRaw === 'next') monday.setDate(monday.getDate() + 7);
        
        baseline = monday;
      } else {
        // Handle explicit week format (e.g., aug19.2025)
        // For explicit dates, use the exact date selected, not the Monday of that week
        const d = parseWeekParamToDate(weekParamRaw);
        if (!d || isNaN(d)) throw new Error('Invalid week');
        baseline = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    } else if (start) {
      mode = 'range';
      const d = new Date(start);
      if (!d || isNaN(d)) throw new Error('Invalid start');
      // For range mode, baseline as the exact selected start date
      baseline = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else if (monthParamRaw) {
      mode = 'month';
      const now = new Date();
      let y = now.getFullYear(); let m = now.getMonth();
      if (monthParamRaw === 'last') { m -= 1; if (m < 0) { m = 11; y -= 1; } }
      else if (monthParamRaw === 'next') { m += 1; if (m > 11) { m = 0; y += 1; } }
      baseline = new Date(y, m, 1);
    }

    if (dayParamRaw) {
      url = `https://www.forexfactory.com/calendar?day=${encodeURIComponent(dayParamRaw)}`;
      html = await fetchText(url);
      rows = parseCalendarHtml(html, baseline, timezoneOffset);
    } else if (weekParamRaw) {
      // For relative weeks, use FF's week parameter directly
      if (weekParamRaw === 'last' || weekParamRaw === 'this' || weekParamRaw === 'next') {
        url = `https://www.forexfactory.com/calendar?week=${encodeURIComponent(weekParamRaw)}`;
        html = await fetchText(url);
        rows = parseCalendarHtml(html, baseline, timezoneOffset);
      } else {
        // For explicit week format, fetch each day to ensure complete data
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const dayUrls = [];
        for (let i = 0; i < 7; i += 1) {
          const d = new Date(baseline);
          d.setDate(baseline.getDate() + i);
          const dayParam = `${months[d.getMonth()]}${d.getDate()}.${d.getFullYear()}`;
          dayUrls.push(`https://www.forexfactory.com/calendar?day=${dayParam}`);
        }
        const htmls = await Promise.all(dayUrls.map((u) => fetchText(u)));
        const all = [];
        for (const page of htmls) all.push(...parseCalendarHtml(page, baseline, timezoneOffset));
        rows = all;
      }
    } else if (start) {
      // Fetch exactly 7 consecutive days starting from the provided start date
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const startDateObj = new Date(start);
      const dayUrls = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(startDateObj);
        d.setDate(startDateObj.getDate() + i);
        const dayParam = `${months[d.getMonth()]}${d.getDate()}.${d.getFullYear()}`;
        dayUrls.push(`https://www.forexfactory.com/calendar?day=${dayParam}`);
      }
      const htmls = await Promise.all(dayUrls.map((u) => fetchText(u)));
      const all = [];
      // Use the actual start date as parsing baseline to derive year correctly
      for (const page of htmls) all.push(...parseCalendarHtml(page, new Date(start), timezoneOffset));
      rows = all;
    } else if (monthParamRaw) {
      url = `https://www.forexfactory.com/calendar?month=${encodeURIComponent(monthParamRaw)}`;
      html = await fetchText(url);
      rows = parseCalendarHtml(html, baseline, timezoneOffset);
    }

    // Filter according to mode
    // For week mode: return exactly what is on the weekly page without extra filtering.
    let filtered = rows;
    if (mode === 'day') {
      const iso = formatDateLocal(baseline);
      filtered = rows.filter((r) => r.date === iso);
    } else if (mode === 'range') {
      const startDate = new Date(start);
      const startIso = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`;
      const end = new Date(startDate);
      end.setDate(startDate.getDate() + 6);
      const endIso = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
      filtered = rows.filter((r) => r.date && r.date >= startIso && r.date <= endIso);
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
