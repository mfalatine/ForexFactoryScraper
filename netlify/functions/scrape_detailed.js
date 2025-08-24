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

// NEW FUNCTION: Extract the rich JSON data from the page
function extractCalendarStates(html) {
  const pattern = /window\.calendarComponentStates\[1\]\s*=\s*(\{[\s\S]*?\});(?:\s*window\.calendarComponentStates|\s*<\/script>)/;
  const match = pattern.exec(html);
  
  if (match) {
    try {
      let jsonStr = match[1];
      // Remove trailing commas (valid in JS but not JSON)
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      // Handle escaped forward slashes
      jsonStr = jsonStr.replace(/\\\//g, '/');
      
      const data = JSON.parse(jsonStr);
      console.log('Successfully extracted calendar states JSON with', data.days ? data.days.length : 0, 'days');
      return data;
    } catch (e) {
      console.error('Failed to parse calendarComponentStates:', e.message);
    }
  }
  console.log('No calendar states JSON found in HTML');
  return null;
}

// MODIFIED: Parse function that uses JSON data when available
function parseCalendarHtml(html, baseline, timezoneOffset = 0) {
  // Try to extract the rich JSON data first
  const calendarStates = extractCalendarStates(html);
  
  if (calendarStates && calendarStates.days) {
    console.log(`Processing JSON data with ${calendarStates.days.length} days`);
    const rows = [];
    
    // Process each day from the JSON
    for (const day of calendarStates.days) {
      // Get the date from the dateline (Unix timestamp)
      let currentDate = null;
      if (day.dateline) {
        currentDate = new Date(day.dateline * 1000);
      }
      
      // Process each event in the day
      if (day.events && Array.isArray(day.events)) {
        for (const event of day.events) {
          // Use event's own dateline if available
          let eventDate = currentDate;
          if (event.dateline) {
            eventDate = new Date(event.dateline * 1000);
          }
          
          // Format the date
          let dateIso = eventDate ? formatDateLocal(eventDate) : '';
          
          // Handle time and timezone offset
          let eventTime = event.timeLabel || '';
          if (eventTime && !event.timeMasked && timezoneOffset !== 0) {
            const adjusted = adjustTimeAndDate(eventTime, dateIso, timezoneOffset);
            eventTime = adjusted.time;
            dateIso = adjusted.date;
          }
          
          // Normalize impact
          let impact = '';
          if (event.impactName === 'high' || (event.impactClass && event.impactClass.includes('red'))) {
            impact = 'High';
          } else if (event.impactName === 'medium' || (event.impactClass && event.impactClass.includes('orange'))) {
            impact = 'Medium';
          } else if (event.impactName === 'low' || (event.impactClass && event.impactClass.includes('yellow'))) {
            impact = 'Low';
          }
          
          // Determine better/worse indicators
          let actualIndicator = '';
          if (event.actualBetterWorse === 1) actualIndicator = 'better';
          else if (event.actualBetterWorse === -1) actualIndicator = 'worse';
          
          // Build the detailed event object
          rows.push({
            // Core fields (matching original structure)
            date: dateIso,
            time: eventTime,
            currency: event.currency || '',
            impact: impact,
            event: event.name || '',
            actual: event.actual || '',
            forecast: event.forecast || '',
            previous: event.previous || '',
            
            // Additional rich data from JSON
            eventId: event.id,
            ebaseId: event.ebaseId,
            country: event.country || '',
            revision: event.revision || '',
            leaked: event.leaked || false,
            actualBetterWorse: actualIndicator,
            
            // Various title formats
            prefixedName: event.prefixedName || '',
            soloTitle: event.soloTitle || '',
            
            // Impact details
            impactName: event.impactName || '',
            impactClass: event.impactClass || '',
            impactTitle: event.impactTitle || '',
            
            // Feature flags
            hasGraph: event.hasGraph || false,
            hasDataValues: event.hasDataValues || false,
            
            // URLs
            url: event.url ? `https://www.forexfactory.com${event.url}` : '',
            soloUrl: event.soloUrl ? `https://www.forexfactory.com${event.soloUrl}` : '',
            
            // Meta
            dateline: event.dateline || null,
            scraped_at: new Date().toISOString()
          });
        }
      }
    }
    
    return fillMissingTimes(rows);
  }
  
  // Fall back to HTML parsing if JSON extraction fails
  console.log('Falling back to HTML table parsing');
  const $ = cheerio.load(html);
  const table = $('table.calendar__table');
  if (!table.length) throw new Error('Calendar table not found');

  // ... rest of your existing HTML parsing code here ...
  // (Keep all the existing parseExplicitDateLabel and table parsing logic as fallback)
  
  // Helper: adjust time by timezone offset
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

  // Fallback HTML parsing (keep your existing code)
  let currentIso = null;
  const rows = [];
  // ... rest of your existing HTML parsing ...
  
  return fillMissingTimes(rows);
}

// Keep fillMissingTimes exactly as is
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

// Keep the handler exactly the same
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

    // ... rest of your existing handler code stays exactly the same ...
    // (all the URL building and fetching logic remains unchanged)
    
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e) }) };
  }
};