// Netlify Function (CommonJS): Scrape ForexFactory weekly page and return DETAILED JSON
// This version extracts the rich JSON data from window.calendarComponentStates
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
  return `${month}${d.getDate()}.${d.getFullYear()}`;
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

// NEW FUNCTION: Extract the rich JSON data from the page
function extractCalendarStates(html) {
  console.log('extractCalendarStates called with HTML length:', html.length);
  
  // Find the exact boundaries using string search
  const startMarker = 'window.calendarComponentStates[1] = {';
  const startIndex = html.indexOf(startMarker);
  
  if (startIndex === -1) {
    console.log('Start marker not found');
    return null;
  }
  
  // Much simpler approach: find the last occurrence of "};" after the start
  const jsonStart = startIndex + 'window.calendarComponentStates[1] = '.length;
  console.log('JSON starts at position:', jsonStart);
  
  // Look for "};" pattern - find the last one
  const endMarker = '};';
  let lastValidEnd = -1;
  let searchPos = jsonStart;
  
  // Find all occurrences of "};" and take the last one
  while (true) {
    const found = html.indexOf(endMarker, searchPos);
    if (found === -1) break;
    lastValidEnd = found;
    searchPos = found + 1;
  }
  
  console.log('Found end at position:', lastValidEnd);
  
  if (lastValidEnd === -1) {
    console.log('Could not find end pattern };');
    return null;
  }
  
  // Extract the JSON string
  const jsonStr = html.substring(jsonStart, lastValidEnd + 1);
  console.log('Found JSON, length:', jsonStr.length);
  
  const match = [null, jsonStr];
  
  if (match) {
    try {
      let cleanJsonStr = match[1];
      // Remove trailing commas (valid in JS but not JSON)
      cleanJsonStr = cleanJsonStr.replace(/,(\s*[}\]])/g, '$1');
      // Handle escaped forward slashes that are already properly escaped in the source
      // Don't double-escape them
      
      const data = JSON.parse(cleanJsonStr);
      console.log('Successfully extracted calendar states JSON with', data.days ? data.days.length : 0, 'days');
      return data;
    } catch (e) {
      console.error('Failed to parse calendarComponentStates:', e.message);
      console.log('Raw JSON string preview:', match[1].substring(0, 500) + '...');
      console.log('First few characters:', JSON.stringify(match[1].substring(0, 50)));
    }
  } else {
    console.log('No calendar states JSON found in HTML - checking for alternative patterns');
    console.log('HTML contains calendarComponentStates:', html.includes('window.calendarComponentStates'));
    console.log('HTML length:', html.length);
    
    // Check what calendarComponentStates indices exist
    const statesMatches = html.match(/window\.calendarComponentStates\[\d+\]/g);
    console.log('Found calendarComponentStates indices:', statesMatches);
    
    // Try alternative patterns that might exist
    const altPatterns = [
      /window\.calendarComponentStates\[1\]\s*=\s*(\{[\s\S]*?\});\s*$/m,
      /calendarComponentStates\[1\]\s*=\s*(\{[\s\S]*?\});/,
      /window\.calendarComponentStates\[0\]\s*=\s*(\{[\s\S]*?\});/,
      /window\.calendarComponentStates\[2\]\s*=\s*(\{[\s\S]*?\});/
    ];
    
    for (let i = 0; i < altPatterns.length; i++) {
      const altPattern = altPatterns[i];
      const altMatch = altPattern.exec(html);
      if (altMatch) {
        console.log(`Found alternative pattern match ${i}`);
        try {
          let jsonStr = altMatch[1];
          jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
          const data = JSON.parse(jsonStr);
          console.log('Successfully extracted calendar states JSON with alternative pattern');
          return data;
        } catch (e) {
          console.error(`Failed to parse alternative pattern ${i}:`, e.message);
        }
      }
    }
  }
  console.log('No calendar states JSON found in HTML');
  return null;
}

// MODIFIED: Parse function that uses JSON data when available
function parseCalendarHtml(html, baseline, timezoneOffset = 0) {
  // Helper: adjust time by timezone offset (define it here so it's available for both paths)
  function adjustTimeAndDate(timeStr, dateIso, offsetHours) {
    if (!timeStr || timeStr === '' || /Day\s+All/i.test(timeStr) || /All\s+Day/i.test(timeStr)) {
      return { time: timeStr, date: dateIso };
    }
    const timeMatch = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(timeStr.trim());
    if (!timeMatch) {
      return { time: timeStr, date: dateIso };
    }
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
    if (ampm === 'pm' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    hours += offsetHours;
    let newDateIso = dateIso;
    if (hours >= 24) {
      hours -= 24;
      if (dateIso) {
        const [year, month, day] = dateIso.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + 1);
        newDateIso = formatDateLocal(date);
      }
    } else if (hours < 0) {
      hours += 24;
      if (dateIso) {
        const [year, month, day] = dateIso.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - 1);
        newDateIso = formatDateLocal(date);
      }
    }
    let newAmPm = 'am';
    if (hours >= 12) {
      newAmPm = 'pm';
      if (hours > 12) hours -= 12;
    }
    if (hours === 0) hours = 12;
    const newTimeStr = `${hours}:${minutes.toString().padStart(2, '0')}${newAmPm}`;
    return { time: newTimeStr, date: newDateIso };
  }

  // Try to extract the rich JSON data first
  const calendarStates = extractCalendarStates(html);
  
  if (calendarStates && calendarStates.days) {
    console.log(`Processing JSON data with ${calendarStates.days.length} days`);
    const rows = [];
    
    // Process each day from the JSON
    for (const day of calendarStates.days) {
      let currentDate = null;
      if (day.dateline) {
        currentDate = new Date(day.dateline * 1000);
      }
      
      if (day.events && Array.isArray(day.events)) {
        for (const event of day.events) {
          let eventDate = currentDate;
          if (event.dateline) {
            eventDate = new Date(event.dateline * 1000);
          }
          
          let dateIso = eventDate ? formatDateLocal(eventDate) : '';
          let eventTime = event.timeLabel || '';
          
          if (eventTime && !event.timeMasked && timezoneOffset !== 0) {
            const adjusted = adjustTimeAndDate(eventTime, dateIso, timezoneOffset);
            eventTime = adjusted.time;
            dateIso = adjusted.date;
          }
          
          let impact = '';
          if (event.impactName === 'high' || (event.impactClass && event.impactClass.includes('red'))) {
            impact = 'High';
          } else if (event.impactName === 'medium' || (event.impactClass && event.impactClass.includes('orange'))) {
            impact = 'Medium';
          } else if (event.impactName === 'low' || (event.impactClass && event.impactClass.includes('yellow'))) {
            impact = 'Low';
          }
          
          let actualIndicator = 'neutral';
          if (event.actualBetterWorse === 1) actualIndicator = 'better';
          else if (event.actualBetterWorse === -1) actualIndicator = 'worse';
          
          // Ensure URL includes detail anchor if eventId is available
          let fullUrl = '';
          if (event.url) {
            fullUrl = `https://www.forexfactory.com${event.url}`;
            if (event.id && !fullUrl.includes('#detail=')) {
              fullUrl += `#detail=${event.id}`;
            }
          } else if (event.id) {
            // Construct URL from eventId if no URL provided
            fullUrl = `https://www.forexfactory.com/calendar?day=${dateIso.replace(/-/g, '')}#detail=${event.id}`;
          }
          
          rows.push({
            date: dateIso,
            time: eventTime,
            currency: event.currency || '',
            impact: impact,
            event: event.name || '',
            actual: event.actual || '',
            forecast: event.forecast || '',
            previous: event.previous || '',
            eventId: event.id || null,
            ebaseId: event.ebaseId || null,
            country: event.country || '',
            revision: event.revision || '',
            leaked: event.leaked || false,
            actualBetterWorse: actualIndicator,
            prefixedName: event.prefixedName || '',
            soloTitle: event.soloTitle || '',
            impactName: event.impactName || '',
            impactClass: event.impactClass || '',
            impactTitle: event.impactTitle || '',
            hasGraph: event.hasGraph || false,
            hasDataValues: event.hasDataValues || false,
            url: fullUrl,
            soloUrl: event.soloUrl ? `https://www.forexfactory.com${event.soloUrl}` : '',
            dateline: event.dateline || null,
            scraped_at: new Date().toISOString()
          });
        }
      }
    }
    
    return fillMissingTimes(rows);
  }
  
  // COMMENTED OUT: Fall back to HTML parsing to see JSON extraction errors
  // console.log('Falling back to HTML table parsing');
  
  // Enhanced debugging - let's see what's actually around the calendarComponentStates
  const hasCalendarStates = html.includes('window.calendarComponentStates');
  const hasCalendarStates1 = html.includes('window.calendarComponentStates[1]');
  const htmlLength = html.length;
  
  // Find the exact position and show context
  const debugStartIndex = html.indexOf('window.calendarComponentStates[1]');
  let contextStr = '';
  if (debugStartIndex !== -1) {
    const contextStart = Math.max(0, debugStartIndex - 50);
    const contextEnd = Math.min(html.length, debugStartIndex + 500);
    contextStr = html.substring(contextStart, contextEnd);
  }
  
  // Add debug info about why bracket parser failed
  const startMarker = 'window.calendarComponentStates[1] = ';
  const hasStartMarker = html.includes(startMarker);
  
  // Let's get a much larger context to understand the JSON structure
  const largeStartIndex = html.indexOf('window.calendarComponentStates[1]');
  let largeContext = '';
  if (largeStartIndex !== -1) {
    const contextStart = Math.max(0, largeStartIndex);
    const contextEnd = Math.min(html.length, largeStartIndex + 2000); // Much larger sample
    largeContext = html.substring(contextStart, contextEnd);
  }
  
  // Temporarily disable error to test extraction
  console.log('JSON extraction failed but continuing to test the new parser');
  return [];
  
  /* COMMENTED OUT HTML PARSING FALLBACK
  const $ = cheerio.load(html);
  const table = $('table.calendar__table');
  if (!table.length) throw new Error('Calendar table not found');

  // Helper: parse date labels
  function parseExplicitDateLabel(label) {
    if (!label) return null;
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const m = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i.exec(label);
    if (!m) return null;
    const monthIdx = months.indexOf(m[1].toLowerCase().slice(0,3));
    if (monthIdx < 0) return null;
    const dayNum = parseInt(m[2]);
    let year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    if (!m[3]) {
      const currentMonth = new Date().getMonth();
      if (currentMonth >= 10 && monthIdx <= 1) {
        year = new Date().getFullYear() + 1;
      }
      else if (currentMonth <= 1 && monthIdx >= 10) {
        year = new Date().getFullYear() - 1;
      }
    }
    return new Date(year, monthIdx, dayNum);
  }

  let currentIso = null;
  const rows = [];

  table.find('tr').each((_, el) => {
    const row = $(el);
    const dateCell = row.find('td.calendar__date, td.date');
    if (dateCell.length && dateCell.text().trim()) {
      const label = dateCell.text().trim();
      const parsedDate = parseExplicitDateLabel(label);
      if (parsedDate) {
        currentIso = formatDateLocal(parsedDate);
      }
    }

    const eventCell = row.find('td.calendar__event, td.event');
    if (!eventCell.length) return;
    const eventText = eventCell.text().trim();
    if (!eventText) return;
    if (!currentIso) return;

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

    const rawTime = timeCell.text().trim();
    const { time: adjustedTime, date: adjustedDate } = adjustTimeAndDate(rawTime, currentIso, timezoneOffset);
    
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
  */ // END COMMENTED OUT HTML PARSING FALLBACK
}

function fillMissingTimes(rows) {
  if (!rows || rows.length === 0) return rows;
  let currentTime = null;
  let currentDate = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.date !== currentDate) {
      currentDate = row.date;
      currentTime = null;
    }
    if (row.time && row.time.trim() !== '') {
      currentTime = row.time;
    } 
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
    const weekParamRaw = (qs.week || '').trim();
    const dayParamRaw = (qs.day || '').trim();
    const monthParamRaw = (qs.month || '').trim();
    const start = (qs.start || '').trim();
    
    const timezoneOffset = parseInt(qs.timezoneOffset || '0');
    if (!weekParamRaw && !dayParamRaw && !monthParamRaw && !start) {
      return { statusCode: 400, headers, body: 'Missing query: provide day=, week=, month=, or start=YYYY-MM-DD' };
    }
    const format = (event.queryStringParameters?.format || 'json').toLowerCase();

    let url = '';
    let html = '';
    let rows = [];

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
        const baseMonth = baselineDate.getMonth();
        if (baseMonth === 11 && monthIdx === 0) year = year + 1;
        else if (baseMonth === 0 && monthIdx === 11) year = year - 1;
      }
      return new Date(year, monthIdx, dayNum);
    }

    function parseWeekParamToDate(weekParam) {
      const m = /([a-z]{3})(\d{1,2})\.(\d{4})/i.exec(weekParam);
      if (!m) return null;
      const monthStr = m[1].toLowerCase();
      const monthIdx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthStr);
      if (monthIdx < 0) return null;
      return new Date(Number(m[3]), monthIdx, Number(m[2]));
    }

    let mode = 'week';
    let baseline = null;
    if (dayParamRaw) {
      mode = 'day';
      const now = new Date();
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dayParamRaw === 'yesterday') base.setDate(base.getDate() - 1);
      else if (dayParamRaw === 'tomorrow') base.setDate(base.getDate() + 1);
      baseline = base;
    } else if (weekParamRaw) {
      mode = 'week';
      if (weekParamRaw === 'last' || weekParamRaw === 'this' || weekParamRaw === 'next') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayDow = today.getDay();
        const monday = new Date(today);
        const daysBack = todayDow === 0 ? 6 : todayDow - 1;
        monday.setDate(today.getDate() - daysBack);
        
        if (weekParamRaw === 'last') monday.setDate(monday.getDate() - 7);
        else if (weekParamRaw === 'next') monday.setDate(monday.getDate() + 7);
        
        baseline = monday;
      } else {
        const d = parseWeekParamToDate(weekParamRaw);
        if (!d || isNaN(d)) throw new Error('Invalid week');
        baseline = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    } else if (start) {
      mode = 'range';
      const d = new Date(start);
      if (!d || isNaN(d)) throw new Error('Invalid start');
      baseline = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else if (monthParamRaw) {
      mode = 'month';
      const now = new Date();
      let y = now.getFullYear(); let m = now.getMonth();
      if (monthParamRaw === 'last') { m -= 1; if (m < 0) { m = 11; y -= 1; } }
      else if (monthParamRaw === 'next') { m += 1; if (m > 11) { m = 0; y += 1; } }
      baseline = new Date(y, m, 1);
    }

    // Full parameter string for rich JSON data
    const fullParams = 'permalink=true&impacts=3,2,1,0&event_types=1,2,3,4,5,7,8,9,10,11&currencies=1,2,3,4,5,6,7,8,9';

    if (dayParamRaw) {
      url = `https://www.forexfactory.com/calendar?day=${encodeURIComponent(dayParamRaw)}&${fullParams}`;
      html = await fetchText(url);
      rows = parseCalendarHtml(html, baseline, timezoneOffset);
    } else if (weekParamRaw) {
      if (weekParamRaw === 'last' || weekParamRaw === 'this' || weekParamRaw === 'next') {
        url = `https://www.forexfactory.com/calendar?week=${encodeURIComponent(weekParamRaw)}&${fullParams}`;
        html = await fetchText(url);
        rows = parseCalendarHtml(html, baseline, timezoneOffset);
      } else {
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const dayUrls = [];
        for (let i = 0; i < 7; i += 1) {
          const d = new Date(baseline);
          d.setDate(baseline.getDate() + i);
          const dayParam = `${months[d.getMonth()]}${d.getDate()}.${d.getFullYear()}`;
          dayUrls.push(`https://www.forexfactory.com/calendar?day=${dayParam}&${fullParams}`);
        }
        const htmls = await Promise.all(dayUrls.map((u) => fetchText(u)));
        const all = [];
        for (const page of htmls) all.push(...parseCalendarHtml(page, baseline, timezoneOffset));
        rows = all;
      }
    } else if (start) {
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const startDateObj = new Date(start);
      const dayUrls = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(startDateObj);
        d.setDate(startDateObj.getDate() + i);
        const dayParam = `${months[d.getMonth()]}${d.getDate()}.${d.getFullYear()}`;
        dayUrls.push(`https://www.forexfactory.com/calendar?day=${dayParam}&${fullParams}`);
      }
      const htmls = await Promise.all(dayUrls.map((u) => fetchText(u)));
      const all = [];
      for (const page of htmls) all.push(...parseCalendarHtml(page, new Date(start), timezoneOffset));
      rows = all;
    } else if (monthParamRaw) {
      url = `https://www.forexfactory.com/calendar?month=${encodeURIComponent(monthParamRaw)}&${fullParams}`;
      html = await fetchText(url);
      rows = parseCalendarHtml(html, baseline, timezoneOffset);
    }

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