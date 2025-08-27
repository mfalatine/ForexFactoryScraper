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
  
  // Find the start of the JSON
  const startMarker = 'window.calendarComponentStates[1] = ';
  const startIndex = html.indexOf(startMarker);
  
  if (startIndex === -1) {
    return null;
  }
  
  
  // Start from the opening brace
  const jsonStart = startIndex + startMarker.length;
  
  // Find the matching closing brace by counting braces
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let endIndex = -1;
  
  for (let i = jsonStart; i < html.length; i++) {
    const char = html[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !inString) {
      inString = true;
    } else if (char === '"' && inString) {
      inString = false;
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i; // Don't include the closing brace yet
          break;
        }
      }
    }
  }
  
  if (endIndex === -1) {
    return null;
  }
  
  const jsonStr = html.substring(jsonStart, endIndex + 1); // Include the closing brace
  
  try {
    // Try JSON.parse first
    const data = JSON.parse(jsonStr);
    
    if (data.days) {
      if (data.days[0] && data.days[0].events) {
        if (data.days[0].events[0]) {
        }
      }
    }
    
    return data;
  } catch (e) {
    
    // Try with eval as fallback (safe since we control the source)
    try {
      const evalResult = eval('(' + jsonStr + ')');
      return evalResult;
    } catch (evalError) {
    }
    
    return null;
  }
}

// MODIFIED: Parse function that uses JSON data when available
function parseCalendarHtml(html, baseline) {
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
          
          // Keep ForexFactory times exactly as provided - no timezone adjustment
          
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
  
  // Enhanced debugging - let's see what's actually around the calendarComponentStates
  // If we reach here, JSON extraction failed - throw error to warn user
  throw new Error('Unable to extract calendar data from ForexFactory. The website structure may have changed. Please try again later or contact support.');
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
    
    // Timezone offset removed - keep ForexFactory times exactly as provided
    
    // Parse filter parameters
    const filters = {
      currencies: qs.currencies || null,
      impacts: qs.impacts || null,
      eventTypes: qs.event_types || null
    };

    // Build filter string for URL
    let filterParams = 'permalink=true';

    // Add impact filters
    if (filters.impacts) {
      filterParams += `&impacts=${filters.impacts}`;
    } else {
      filterParams += '&impacts=3,2,1,0';
    }

    // Add event type filters
    if (filters.eventTypes) {
      filterParams += `&event_types=${filters.eventTypes}`;
    } else {
      filterParams += '&event_types=1,2,3,4,5,7,8,9,10,11';
    }

    // Add currency filters
    if (filters.currencies) {
      filterParams += `&currencies=${filters.currencies}`;
    } else {
      filterParams += '&currencies=1,2,3,4,5,6,7,8,9';
    }
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
      else if (monthParamRaw === 'this') { /* use current month/year */ }
      else {
        // Handle explicit month format like "sep01.2025"
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const match = /^([a-z]{3})\d{2}\.(\d{4})$/.exec(monthParamRaw);
        if (match) {
          const monthStr = match[1];
          const year = parseInt(match[2]);
          const monthIndex = months.indexOf(monthStr);
          if (monthIndex >= 0) {
            y = year;
            m = monthIndex;
          }
        }
      }
      baseline = new Date(y, m, 1);
    }

    if (dayParamRaw) {
      url = `https://www.forexfactory.com/calendar?day=${encodeURIComponent(dayParamRaw)}&${filterParams}`;
      html = await fetchText(url);
      rows = parseCalendarHtml(html, baseline);
    } else if (weekParamRaw) {
      if (weekParamRaw === 'last' || weekParamRaw === 'this' || weekParamRaw === 'next') {
        url = `https://www.forexfactory.com/calendar?week=${encodeURIComponent(weekParamRaw)}&${filterParams}`;
        html = await fetchText(url);
        rows = parseCalendarHtml(html, baseline);
      } else {
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const dayUrls = [];
        for (let i = 0; i < 7; i += 1) {
          const d = new Date(baseline);
          d.setDate(baseline.getDate() + i);
          const dayParam = `${months[d.getMonth()]}${d.getDate()}.${d.getFullYear()}`;
          dayUrls.push(`https://www.forexfactory.com/calendar?day=${dayParam}&${filterParams}`);
        }
        const htmls = await Promise.all(dayUrls.map((u) => fetchText(u)));
        const all = [];
        for (const page of htmls) all.push(...parseCalendarHtml(page, baseline));
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
        dayUrls.push(`https://www.forexfactory.com/calendar?day=${dayParam}&${filterParams}`);
      }
      const htmls = await Promise.all(dayUrls.map((u) => fetchText(u)));
      const all = [];
      for (const page of htmls) all.push(...parseCalendarHtml(page, new Date(start)));
      rows = all;
    } else if (monthParamRaw) {
      url = `https://www.forexfactory.com/calendar/?month=${encodeURIComponent(monthParamRaw)}&${filterParams}`;
      html = await fetchText(url);
      rows = parseCalendarHtml(html, baseline);
      if (rows.length > 0) {
      }
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
      // Filter to only include dates within the selected month boundaries
      const monthStart = `${baseline.getFullYear()}-${String(baseline.getMonth()+1).padStart(2,'0')}-01`;
      const lastDay = new Date(baseline.getFullYear(), baseline.getMonth() + 1, 0).getDate();
      const monthEnd = `${baseline.getFullYear()}-${String(baseline.getMonth()+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      filtered = rows.filter((r) => r.date && r.date >= monthStart && r.date <= monthEnd);
    }

    
    if (format === 'csv') {
      return { statusCode: 200, headers: { ...headers, 'Content-Type': 'text/csv' }, body: toCsv(filtered) };
    }
    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(filtered) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e) }) };
  }
};