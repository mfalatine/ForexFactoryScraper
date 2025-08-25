// Forex Factory DETAILED Data Scraper JavaScript
// Configuration - Update these with your GitHub details
const GITHUB_USER = 'mfalatine';
const REPO_NAME = 'ForexFactoryScraper';
const BRANCH = 'main';

// Point to the scraper function
const jsonUrlBase = '/.netlify/functions/scrape';
const csvUrlBase = '/.netlify/functions/scrape?format=csv';
const githubUrl = `https://github.com/${GITHUB_USER}/${REPO_NAME}`;

let calendarData = [];
let currentQuery = ''; // Track the current query parameters
let currentPage = 1;
const ROWS_PER_PAGE = 200;

// Date Range Management System
class DateRangeManager {
  constructor() {
    this.selectedWeeks = new Map(); // key: weekParam, value: {start, end, year, month}
    this.selectedMonths = new Map(); // key: monthParam, value: {month, year}
    this.weekViewDate = new Date();
    this.monthViewYear = new Date().getFullYear();
    this.minYear = 2007;
    this.maxYear = new Date().getFullYear() + 10;
  }

  // Week Navigation
  navigateWeekMonth(direction) {
    this.weekViewDate.setMonth(this.weekViewDate.getMonth() + direction);
    this.renderWeekGrid();
  }

  navigateWeekYear(direction) {
    const newYear = this.weekViewDate.getFullYear() + direction;
    if (newYear >= this.minYear && newYear <= this.maxYear) {
      this.weekViewDate.setFullYear(newYear);
      this.renderWeekGrid();
    }
  }

  // Month Navigation
  navigateMonthYear(direction) {
    const newYear = this.monthViewYear + direction;
    if (newYear >= this.minYear && newYear <= this.maxYear) {
      this.monthViewYear = newYear;
      this.renderMonthGrid();
    }
  }

  // Generate weeks for current view month
  generateWeeksForView() {
    const year = this.weekViewDate.getFullYear();
    const month = this.weekViewDate.getMonth();
    const weeks = [];
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Find Sunday of first week
    const firstSunday = new Date(firstDay);
    firstSunday.setDate(firstDay.getDate() - firstDay.getDay());
    
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    
    // Generate all weeks that touch this month
    let currentSunday = new Date(firstSunday);
    let weekNum = 1;
    
    while (currentSunday <= lastDay || currentSunday.getMonth() === month) {
      const weekEnd = new Date(currentSunday);
      weekEnd.setDate(currentSunday.getDate() + 6);
      
      const weekParam = this.formatWeekParam(currentSunday);
      const isCurrentMonth = currentSunday.getMonth() === month || weekEnd.getMonth() === month;
      
      weeks.push({
        start: new Date(currentSunday),
        end: weekEnd,
        weekParam: weekParam,
        weekNum: weekNum++,
        isCurrentMonth: isCurrentMonth,
        label: this.formatWeekLabel(currentSunday, weekEnd)
      });
      
      currentSunday.setDate(currentSunday.getDate() + 7);
      
      // Stop if we're too far into next month
      if (currentSunday.getMonth() > month && currentSunday.getMonth() !== (month + 1) % 12) {
        break;
      }
    }
    
    return weeks;
  }

  formatWeekParam(date) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    return `${months[date.getMonth()]}${date.getDate()}.${date.getFullYear()}`;
  }

  formatWeekLabel(start, end) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const startStr = `${months[start.getMonth()]} ${start.getDate()}`;
    const endStr = `${months[end.getMonth()]} ${end.getDate()}`;
    return `${startStr} - ${endStr}`;
  }

  formatMonthParam(month, year) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    return `${months[month]}01.${year}`;
  }

  // Render Week Grid
  renderWeekGrid() {
    const weeks = this.generateWeeksForView();
    const container = document.getElementById('weekGrid');
    const monthYear = document.getElementById('weekMonthYear');
    
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthYear.textContent = `${months[this.weekViewDate.getMonth()]} ${this.weekViewDate.getFullYear()}`;
    
    container.innerHTML = weeks.map(week => {
      const isSelected = this.selectedWeeks.has(week.weekParam);
      const extraClass = week.isCurrentMonth ? '' : 'other-month';
      
      return `
        <div class="week-item ${extraClass}">
          <input type="checkbox" 
                 id="week-${week.weekParam}" 
                 value="${week.weekParam}"
                 ${isSelected ? 'checked' : ''}
                 onchange="dateManager.toggleWeek('${week.weekParam}', '${week.label}', ${week.start.getFullYear()}, ${week.start.getMonth()})">
          <label for="week-${week.weekParam}">
            <span class="week-dates">${week.label}</span>
            <span class="week-number">Week ${week.weekNum}</span>
          </label>
        </div>
      `;
    }).join('');
  }

  // Render Month Grid
  renderMonthGrid() {
    const container = document.getElementById('monthGrid');
    const yearDisplay = document.getElementById('monthYear');
    
    yearDisplay.textContent = this.monthViewYear;
    
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    container.innerHTML = months.map((month, index) => {
      const monthParam = this.formatMonthParam(index, this.monthViewYear);
      const isSelected = this.selectedMonths.has(monthParam);
      
      return `
        <div class="month-item">
          <input type="checkbox" 
                 id="month-${monthParam}" 
                 value="${monthParam}"
                 ${isSelected ? 'checked' : ''}
                 onchange="dateManager.toggleMonth(${index}, ${this.monthViewYear})">
          <label for="month-${monthParam}">${month}</label>
        </div>
      `;
    }).join('');
  }

  // Toggle week selection
  toggleWeek(weekParam, label, year, month) {
    // Clear month selections when switching to week mode
    if (this.selectedMonths.size > 0) {
      this.selectedMonths.clear();
      document.querySelectorAll('#monthGrid input[type="checkbox"]').forEach(cb => cb.checked = false);
      this.updateMonthDisplay();
    }
    
    if (this.selectedWeeks.has(weekParam)) {
      this.selectedWeeks.delete(weekParam);
    } else {
      this.selectedWeeks.set(weekParam, { label, year, month });
    }
    this.updateWeekDisplay();
  }

  // Toggle month selection
  toggleMonth(monthIndex, year) {
    // Clear week selections when switching to month mode
    if (this.selectedWeeks.size > 0) {
      this.selectedWeeks.clear();
      document.querySelectorAll('#weekGrid input[type="checkbox"]').forEach(cb => cb.checked = false);
      this.updateWeekDisplay();
    }
    
    const monthParam = this.formatMonthParam(monthIndex, year);
    console.log('Month selection - monthIndex:', monthIndex, 'year:', year, 'monthParam:', monthParam);
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    if (this.selectedMonths.has(monthParam)) {
      this.selectedMonths.delete(monthParam);
      console.log('Removed month:', monthParam);
    } else {
      this.selectedMonths.set(monthParam, { 
        month: months[monthIndex], 
        year: year,
        monthIndex: monthIndex
      });
      console.log('Added month:', monthParam, this.selectedMonths.get(monthParam));
    }
    this.updateMonthDisplay();
  }

  // Update week selection display
  updateWeekDisplay() {
    const container = document.getElementById('selectedWeeksDisplay');
    const count = document.getElementById('weekCount');
    
    count.textContent = this.selectedWeeks.size;
    
    if (this.selectedWeeks.size === 0) {
      container.innerHTML = '<span style="color: #999; font-size: 0.9em;">No weeks selected</span>';
      return;
    }
    
    const badges = Array.from(this.selectedWeeks.entries()).map(([param, data]) => {
      return `
        <span class="selected-badge">
          ${data.label}
          <span class="remove" onclick="dateManager.removeWeek('${param}')">×</span>
        </span>
      `;
    }).join('');
    
    container.innerHTML = badges;
  }

  // Update month selection display
  updateMonthDisplay() {
    const container = document.getElementById('selectedMonthsDisplay');
    const count = document.getElementById('monthCount');
    
    count.textContent = this.selectedMonths.size;
    
    if (this.selectedMonths.size === 0) {
      container.innerHTML = '<span style="color: #999; font-size: 0.9em;">No months selected</span>';
      return;
    }
    
    const badges = Array.from(this.selectedMonths.entries()).map(([param, data]) => {
      return `
        <span class="selected-badge">
          ${data.month} ${data.year}
          <span class="remove" onclick="dateManager.removeMonth('${param}')">×</span>
        </span>
      `;
    }).join('');
    
    container.innerHTML = badges;
  }

  // Remove week
  removeWeek(weekParam) {
    this.selectedWeeks.delete(weekParam);
    const checkbox = document.getElementById(`week-${weekParam}`);
    if (checkbox) checkbox.checked = false;
    this.updateWeekDisplay();
  }

  // Remove month
  removeMonth(monthParam) {
    this.selectedMonths.delete(monthParam);
    const checkbox = document.getElementById(`month-${monthParam}`);
    if (checkbox) checkbox.checked = false;
    this.updateMonthDisplay();
  }

  // Clear all weeks
  clearAllWeeks() {
    this.selectedWeeks.clear();
    document.querySelectorAll('#weekGrid input[type="checkbox"]').forEach(cb => cb.checked = false);
    this.updateWeekDisplay();
  }

  // Clear all months
  clearAllMonths() {
    this.selectedMonths.clear();
    document.querySelectorAll('#monthGrid input[type="checkbox"]').forEach(cb => cb.checked = false);
    this.updateMonthDisplay();
  }

  // Get selection mode
  getSelectionMode() {
    if (this.selectedWeeks.size > 0 && this.selectedMonths.size > 0) {
      return 'conflict';
    } else if (this.selectedWeeks.size > 0) {
      return 'weeks';
    } else if (this.selectedMonths.size > 0) {
      return 'months';
    }
    return 'none';
  }

  // Build URLs for fetching
  buildFetchUrls() {
    const mode = this.getSelectionMode();
    const filters = getActiveFilters();
    const filterParams = buildFilterParams(filters);
    
    if (mode === 'weeks') {
      return Array.from(this.selectedWeeks.keys()).map(weekParam => 
        `week=${weekParam}&${filterParams}`
      );
    } else if (mode === 'months') {
      const urls = Array.from(this.selectedMonths.keys()).map(monthParam => 
        `month=${monthParam}&${filterParams}`
      );
      console.log('Month URLs being fetched:', urls);
      return urls;
    }
    return [];
  }
}

// Initialize date manager
const dateManager = new DateRangeManager();

// Filter Management Functions
function getActiveFilters() {
  const filters = {
    impacts: [],
    eventTypes: [],
    currencies: []
  };
  
  // Get impact filters
  if (document.getElementById('impact-high').checked) filters.impacts.push('3');
  if (document.getElementById('impact-medium').checked) filters.impacts.push('2');
  if (document.getElementById('impact-low').checked) filters.impacts.push('1');
  if (document.getElementById('impact-none').checked) filters.impacts.push('0');
  
  // Get event type filters
  const eventTypeMap = {
    'type-growth': '1',
    'type-inflation': '2',
    'type-employment': '3',
    'type-central-bank': '4',
    'type-bonds': '5',
    'type-housing': '7',
    'type-consumer': '8',
    'type-business': '9',
    'type-speeches': '10',
    'type-misc': '11'
  };
  
  Object.keys(eventTypeMap).forEach(id => {
    if (document.getElementById(id).checked) {
      filters.eventTypes.push(eventTypeMap[id]);
    }
  });
  
  // Get currency filters
  const currencyMap = {
    'curr-aud': '1',
    'curr-cad': '2',
    'curr-chf': '3',
    'curr-cny': '4',
    'curr-eur': '5',
    'curr-gbp': '6',
    'curr-jpy': '7',
    'curr-nzd': '8',
    'curr-usd': '9'
  };
  
  Object.keys(currencyMap).forEach(id => {
    if (document.getElementById(id).checked) {
      filters.currencies.push(currencyMap[id]);
    }
  });
  
  return filters;
}

function buildFilterParams(filters) {
  const params = [];
  
  params.push('permalink=true');
  
  // Add impact filters (default to all if none selected)
  if (filters.impacts.length > 0) {
    params.push(`impacts=${filters.impacts.join(',')}`);
  } else {
    params.push('impacts=3,2,1,0');
  }
  
  // Add event type filters (default to all if none selected)
  if (filters.eventTypes.length > 0) {
    params.push(`event_types=${filters.eventTypes.join(',')}`);
  } else {
    params.push('event_types=1,2,3,4,5,7,8,9,10,11');
  }
  
  // Add currency filters (default to all if none selected)
  if (filters.currencies.length > 0) {
    params.push(`currencies=${filters.currencies.join(',')}`);
  } else {
    params.push('currencies=1,2,3,4,5,6,7,8,9');
  }
  
  return params.join('&');
}


// Navigation Functions
function navigateWeekMonth(direction) {
  dateManager.navigateWeekMonth(direction);
}

function navigateWeekYear(direction) {
  dateManager.navigateWeekYear(direction);
}

function navigateMonthYear(direction) {
  dateManager.navigateMonthYear(direction);
}

// Clear Functions
function clearWeekSelection() {
  dateManager.clearAllWeeks();
}

function clearMonthSelection() {
  dateManager.clearAllMonths();
}

// Helper function to prevent caching
function fetchNoCache(url) {
    return fetch(`${url}&_t=${Date.now()}`, { cache: 'no-store' });
}

// Initialize page
async function init() {
    // Initialize date selectors
    dateManager.updateWeekDisplay();
    dateManager.updateMonthDisplay();
    dateManager.renderWeekGrid();
    dateManager.renderMonthGrid();
    
    // Load the data using week= (same logic as the FF button) for initial display
    try {
        const today = new Date();
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const weekParam = `${months[today.getMonth()]}${today.getDate()}.${today.getFullYear()}`;
        
        // Store the current query
        currentQuery = `week=${weekParam}`;
        
        const response = await fetchNoCache(`${jsonUrlBase}?${currentQuery}`);
        if (!response.ok) throw new Error('Failed to load data');
        
        calendarData = await response.json();
        
        // Reset pagination
        currentPage = 1;
        
        // Update stats
        document.getElementById('eventCount').textContent = `${calendarData.length} events`;
        
        // Update last update time
        if (calendarData.length > 0 && calendarData[0].scraped_at) {
            const date = new Date(calendarData[0].scraped_at);
            document.getElementById('lastUpdate').textContent = 
                `Last Updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }
        
        // Display preview table with enhanced fields
        displayTable(calendarData);
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('tableContainer').innerHTML = 
            '<div class="error">Error loading data. Please try again later.</div>';
        document.getElementById('lastUpdate').textContent = 'Error loading data';
        document.getElementById('eventCount').textContent = 'N/A';
    }
}

function displayTable(data) {
    if (!data || data.length === 0) {
        document.getElementById('tableContainer').innerHTML = 
            '<p>No data available</p>';
        document.getElementById('paginationControls').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalRows = data.length;
    const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = Math.min(startIndex + ROWS_PER_PAGE, totalRows);
    const pageData = data.slice(startIndex, endIndex);
    
    // Update pagination controls
    updatePaginationControls(totalRows, totalPages, pageData.length);
    
    // Enhanced table with additional fields
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Currency</th>
                    <th>Country</th>
                    <th>Impact</th>
                    <th>Event</th>
                    <th>Actual</th>
                    <th>Forecast</th>
                    <th>Previous</th>
                    <th>Revision</th>
                    <th>Better/Worse</th>
                    <th>ID</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    pageData.forEach(item => {
        let impactClass = '';
        if (item.impact === 'High') impactClass = 'impact-high';
        else if (item.impact === 'Medium') impactClass = 'impact-medium';
        else if (item.impact === 'Low') impactClass = 'impact-low';
        
        // Show better/worse indicator
        let indicator = '';
        if (item.actualBetterWorse === 'better') indicator = '✅';
        else if (item.actualBetterWorse === 'worse') indicator = '❌';
        
        // Show leaked indicator
        let leakedBadge = item.leaked ? ' 🔓' : '';
        
        html += `
            <tr>
                <td>${item.date || ''}</td>
                <td>${item.time || ''}</td>
                <td><strong>${item.currency || ''}</strong></td>
                <td>${item.country || ''}</td>
                <td>${item.impact ? `<span class="${impactClass}">${item.impact}</span>` : ''}</td>
                <td>${item.event || ''}${leakedBadge}</td>
                <td>${item.actual || ''}</td>
                <td>${item.forecast || ''}</td>
                <td>${item.previous || ''}</td>
                <td>${item.revision || ''}</td>
                <td>${indicator}</td>
                <td>${item.eventId || ''}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    document.getElementById('tableContainer').innerHTML = html;
}

function downloadJSON() {
    window.open(`${jsonUrlBase}?${currentQuery}&_t=${Date.now()}`, '_blank');
}

function downloadCSV() {
    window.open(`${jsonUrlBase}?${currentQuery}&format=csv&_t=${Date.now()}`, '_blank');
}

function viewRawJSON() {
    window.open(`${jsonUrlBase}?${currentQuery}&_t=${Date.now()}`, '_blank');
}

function viewGitHub() {
    window.open(githubUrl, '_blank');
}

function viewChangeHistory() {
    window.open('change-history.html', '_blank');
}


async function runNow(ev) {
    const startDate = document.getElementById('startDate').value;
    if (!startDate) { alert('Please select a start date'); return; }
    // Build ForexFactory week URL like aug19.2025 (parse date as LOCAL to avoid UTC shift)
    const [yy, mm, dd] = startDate.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd); // local midnight
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const month = months[d.getMonth()];
    const weekParam = `${month}${d.getDate()}.${d.getFullYear()}`;
    const url = `https://www.forexfactory.com/calendar?week=${weekParam}`;
    window.open(url, '_blank', 'noopener');
}

async function loadSelectedPeriods() {
  const mode = dateManager.getSelectionMode();
  
  if (mode === 'none') {
    alert('Please select at least one week or month to load');
    return;
  }
  
  if (mode === 'conflict') {
    if (!confirm('You have both weeks and months selected. Only weeks will be loaded. Continue?')) {
      return;
    }
  }
  
  // Show loading overlay
  showLoadingOverlay();
  
  try {
    const urls = dateManager.buildFetchUrls();
    const totalRequests = urls.length;
    let completedRequests = 0;
    
    // Update loading message
    updateLoadingMessage(`Loading ${totalRequests} ${mode === 'weeks' ? 'week(s)' : 'month(s)'}...`);
    
    // Batch fetch with progress updates
    const batchSize = 5;
    const allData = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(params => 
        fetchNoCache(`${jsonUrlBase}?${params}`)
          .then(res => {
            console.log('Fetch response for params:', params, 'status:', res.status);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
          })
          .then(data => {
            completedRequests++;
            updateLoadingMessage(`Loading ${completedRequests} of ${totalRequests}...`);
            console.log('Data received for params:', params, 'count:', data.length);
            return data;
          })
          .catch(error => {
            console.error('Error fetching params:', params, 'error:', error);
            completedRequests++;
            updateLoadingMessage(`Loading ${completedRequests} of ${totalRequests}... (error)`);
            return []; // Return empty array on error
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      allData.push(...batchResults.flat());
    }
    
    // Deduplicate by eventId
    const uniqueEvents = new Map();
    allData.forEach(event => {
      if (event.eventId && !uniqueEvents.has(event.eventId)) {
        uniqueEvents.set(event.eventId, event);
      } else if (!event.eventId) {
        // If no eventId, use combination of date, time, and event name as key
        const key = `${event.date}-${event.time}-${event.event}`;
        if (!uniqueEvents.has(key)) {
          uniqueEvents.set(key, event);
        }
      }
    });
    
    // Convert back to array and sort
    calendarData = Array.from(uniqueEvents.values()).sort((a, b) => {
      // Sort by date first
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      // Then by time
      const timeA = parseTime(a.time);
      const timeB = parseTime(b.time);
      return timeA - timeB;
    });
    
    // Reset pagination
    currentPage = 1;
    
    // Update display
    document.getElementById('eventCount').textContent = `${calendarData.length} events`;
    displayTable(calendarData);
    
    hideLoadingOverlay();
    
  } catch (error) {
    console.error('Error loading data:', error);
    hideLoadingOverlay();
    alert('Error loading data. Please try again.');
  }
}

// Helper function to parse time for sorting
function parseTime(timeStr) {
  if (!timeStr || timeStr === 'All Day') return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toLowerCase();
  
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
}

function showLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <div id="loadingMessage">Loading...</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function updateLoadingMessage(message) {
  const messageEl = document.getElementById('loadingMessage');
  if (messageEl) {
    messageEl.textContent = message;
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.remove();
  }
}

function openInForexFactory() {
  if (!calendarData || calendarData.length === 0) {
    alert('No data to display in ForexFactory');
    return;
  }
  
  // Get first and last dates from current data
  const firstDate = new Date(calendarData[0].date);
  const lastDate = new Date(calendarData[calendarData.length - 1].date);
  
  // Get active filters
  const filters = getActiveFilters();
  const filterParams = buildFilterParams(filters);
  
  // Determine the best URL based on data range
  let url = 'https://www.forexfactory.com/calendar?';
  
  // If data spans exactly one week
  const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
  if (daysDiff <= 7) {
    const weekParam = dateManager.formatWeekParam(firstDate);
    url += `week=${weekParam}&${filterParams}`;
  } else {
    // Use month view for longer ranges
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monthParam = `${months[firstDate.getMonth()]}01.${firstDate.getFullYear()}`;
    url += `month=${monthParam}&${filterParams}`;
  }
  
  window.open(url, '_blank');
}

async function fetchQuick(mode, value) {
    try {
        // Build and store the current query
        if (mode === 'day') currentQuery = `day=${encodeURIComponent(value)}`;
        else if (mode === 'week') currentQuery = `week=${encodeURIComponent(value)}`;
        else if (mode === 'month') currentQuery = `month=${encodeURIComponent(value)}`;
        else return;
        
        const res = await fetchNoCache(`${jsonUrlBase}?${currentQuery}`);
        if (!res.ok) throw new Error(await res.text());
        calendarData = await res.json();
        
        // Reset pagination
        currentPage = 1;
        
        document.getElementById('eventCount').textContent = `${calendarData.length} events`;
        
        // Update last update time
        if (calendarData.length > 0 && calendarData[0].scraped_at) {
            const date = new Date(calendarData[0].scraped_at);
            document.getElementById('lastUpdate').textContent = 
                `Last Updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }
        
        displayTable(calendarData);
    } catch (e) {
        console.error(e);
        alert('Fetch failed. See console for details.');
    }
}


// Pagination functionality
function updatePaginationControls(totalRows, totalPages, rowsShown) {
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('rowsShown').textContent = rowsShown;
    document.getElementById('totalRows').textContent = totalRows;
    
    // Show/hide pagination controls
    const paginationControls = document.getElementById('paginationControls');
    if (totalPages > 1) {
        paginationControls.style.display = 'flex';
    } else {
        paginationControls.style.display = 'none';
    }
    
    // Update button states
    const prevButton = paginationControls.querySelector('button:first-child');
    const nextButton = paginationControls.querySelector('button:last-child');
    
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
}

function changePage(direction) {
    const totalPages = Math.ceil(calendarData.length / ROWS_PER_PAGE);
    const newPage = currentPage + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayTable(calendarData);
    }
}

// Filter toggle functionality
function toggleAllFilters(category, checked) {
    // Find all checkboxes that start with the category prefix
    const checkboxes = document.querySelectorAll(`input[type="checkbox"][id^="${category}-"]`);
    checkboxes.forEach(checkbox => {
        checkbox.checked = checked;
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);