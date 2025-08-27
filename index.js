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
let filteredData = []; // Store filtered results
let eventFilter = ''; // Current event filter text
let currentQuery = ''; // Track the current query parameters
let currentPage = 1;
const ROWS_PER_PAGE = 200;
let eventTypeLookup = new Map(); // Event type lookup table
let uniqueEventNames = new Set(); // Store unique event names for autocomplete

// Function to open ForexFactory event detail in popup window
function openEventDetail(url) {
    if (!url) {
        alert('Event detail URL not available');
        return;
    }
    
    // Open in popup window with specific dimensions
    const popup = window.open(url, 'eventDetail', 'width=1440,height=900,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no');
    
    if (popup) {
        popup.focus();
    } else {
        // If popup blocked, open in new tab
        window.open(url, '_blank');
    }
}

// Helper function to get day of week from date string
function getDayOfWeek(dateString) {
    if (!dateString) return '';
    try {
        // Parse date components directly to avoid timezone issues
        const parts = dateString.split('-');
        if (parts.length !== 3) return '';
        
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JS months are 0-based
        const day = parseInt(parts[2]);
        
        // Use Zeller's congruence or simple Date with explicit components
        const date = new Date(year, month, day);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    } catch (error) {
        return '';
    }
}

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
    // Allow week selections alongside month selections
    if (this.selectedWeeks.has(weekParam)) {
      this.selectedWeeks.delete(weekParam);
    } else {
      this.selectedWeeks.set(weekParam, { label, year, month });
    }
    this.updateWeekDisplay();
  }

  // Toggle month selection
  toggleMonth(monthIndex, year) {
    // Allow month selections alongside week selections
    const monthParam = this.formatMonthParam(monthIndex, year);
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    if (this.selectedMonths.has(monthParam)) {
      this.selectedMonths.delete(monthParam);
    } else {
      this.selectedMonths.set(monthParam, { 
        month: months[monthIndex], 
        year: year,
        monthIndex: monthIndex
      });
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
      return 'combined';
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
    const urls = [];
    
    if (mode === 'weeks') {
      return Array.from(this.selectedWeeks.keys()).map(weekParam => 
        `week=${weekParam}&${filterParams}`
      );
    } else if (mode === 'months') {
      return Array.from(this.selectedMonths.keys()).map(monthParam => 
        `month=${monthParam}&${filterParams}`
      );
    } else if (mode === 'combined') {
      // Combine both week and month URLs
      const weekUrls = Array.from(this.selectedWeeks.keys()).map(weekParam => 
        `week=${weekParam}&${filterParams}`
      );
      const monthUrls = Array.from(this.selectedMonths.keys()).map(monthParam => 
        `month=${monthParam}&${filterParams}`
      );
      return [...weekUrls, ...monthUrls];
    }
    return [];
  }
}

// Initialize date manager
const dateManager = new DateRangeManager();

// Load event type lookup table
async function loadEventTypeLookup() {
  try {
    const response = await fetch('EventTypes.csv');
    const csvText = await response.text();
    const lines = csvText.split('\n').slice(1); // Skip header
    
    lines.forEach(line => {
      const match = line.match(/^"?([^,"]+)"?,(.+)$/);
      if (match) {
        const eventName = match[1].trim();
        const eventType = match[2].trim().replace(/"/g, '');
        eventTypeLookup.set(eventName, eventType);
      }
    });
    
    console.log(`Loaded ${eventTypeLookup.size} event type mappings`);
  } catch (error) {
    console.error('Failed to load event type lookup:', error);
  }
}

// Get event type for an event
function getEventType(eventName) {
  return eventTypeLookup.get(eventName) || 'Unknown';
}

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

function clearAllSelections() {
  dateManager.clearAllWeeks();
  dateManager.clearAllMonths();
}

// Helper function to prevent caching
function fetchNoCache(url) {
    return fetch(`${url}&_t=${Date.now()}`, { cache: 'no-store' });
}

// Initialize page
async function init() {
    // Load event type lookup table
    await loadEventTypeLookup();
    
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
        
        // Update last update time
        if (calendarData.length > 0 && calendarData[0].scraped_at) {
            const date = new Date(calendarData[0].scraped_at);
            document.getElementById('lastUpdate').textContent = 
                `Last Run: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
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

// Filter functions
function applyEventFilter() {
    const filterText = eventFilter.toLowerCase().trim();
    
    if (!filterText) {
        filteredData = [...calendarData];
    } else {
        filteredData = calendarData.filter(item => {
            const eventName = (item.event || '').toLowerCase();
            return eventName.includes(filterText);
        });
    }
    
    // Reset to first page when filter changes
    currentPage = 1;
    renderTable(filteredData);
}

function updateEventSuggestions() {
    // Build unique event names from current data
    uniqueEventNames.clear();
    calendarData.forEach(item => {
        if (item.event) {
            uniqueEventNames.add(item.event);
        }
    });
}

function showEventSuggestions(searchText) {
    const suggestionsDiv = document.getElementById('eventSuggestions');
    if (!suggestionsDiv) return;
    
    if (!searchText || searchText.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    const searchLower = searchText.toLowerCase();
    const matches = Array.from(uniqueEventNames)
        .filter(event => event.toLowerCase().includes(searchLower))
        .sort()
        .slice(0, 10); // Limit to 10 suggestions
    
    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    // Build suggestions HTML
    suggestionsDiv.innerHTML = matches.map(event => {
        // Highlight matching text
        const regex = new RegExp(`(${searchText})`, 'gi');
        const highlighted = event.replace(regex, '<strong>$1</strong>');
        return `<div class="suggestion-item" data-event="${event}">${highlighted}</div>`;
    }).join('');
    
    suggestionsDiv.style.display = 'block';
}

function hideEventSuggestions() {
    const suggestionsDiv = document.getElementById('eventSuggestions');
    if (suggestionsDiv) {
        suggestionsDiv.style.display = 'none';
    }
}

function displayTable(data) {
    if (!data || data.length === 0) {
        document.getElementById('tableContainer').innerHTML = 
            '<p>No data available</p>';
        document.getElementById('paginationControls').style.display = 'none';
        document.getElementById('eventCount').textContent = '0 events';
        return;
    }
    
    // Update event count
    document.getElementById('eventCount').textContent = `${data.length} events`;
    
    // Initialize filtered data with all data
    filteredData = [...data];
    
    // Reset filter
    eventFilter = '';
    
    // Update autocomplete suggestions
    updateEventSuggestions();
    
    // Reset to first page
    currentPage = 1;
    
    // Render the table
    renderTable(filteredData);
}

function renderTable(data) {
    if (!data || data.length === 0) {
        document.getElementById('tableContainer').innerHTML = 
            '<p>No events match your filter criteria</p>';
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
                <tr class="filter-row">
                    <th colspan="7"></th>
                    <th class="event-filter-cell">
                        <div class="event-filter-container">
                            <input type="text" 
                                   id="eventFilter" 
                                   class="event-filter-input" 
                                   placeholder="Filter events..." 
                                   autocomplete="off">
                            <button id="searchEventFilter" class="search-filter-btn" title="Search">🔍</button>
                            <button id="clearEventFilter" class="clear-filter-btn" title="Clear filter">✕</button>
                            <div id="eventSuggestions" class="event-suggestions-dropdown"></div>
                        </div>
                    </th>
                    <th colspan="6"></th>
                </tr>
                <tr>
                    <th class="link-column"><img src="details_icon_small.png" alt="Link" width="20" height="25"></th>
                    <th>Day</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Currency</th>
                    <th>Country</th>
                    <th>Impact</th>
                    <th>Event</th>
                    <th>Event Type</th>
                    <th>Actual</th>
                    <th>Forecast</th>
                    <th>Previous</th>
                    <th>Revision</th>
                    <th>Better/Worse</th>
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
        
        const eventType = getEventType(item.event || '');
        
        // Create clickable link for ForexFactory event detail
        const eventUrl = item.url || '';
        const escapedUrl = eventUrl.replace(/'/g, "\\'");
        const linkCell = eventUrl ? 
            `<td class="link-column"><a href="#" onclick="openEventDetail('${escapedUrl}'); return false;" title="Open in ForexFactory"><img src="details_icon_small.png" alt="Open" width="20" height="25"></a></td>` :
            `<td class="link-column">—</td>`;
            
        html += `
            <tr>
                ${linkCell}
                <td>${getDayOfWeek(item.date)}</td>
                <td>${item.date || ''}</td>
                <td>${item.time || ''}</td>
                <td><strong>${item.currency || ''}</strong></td>
                <td>${item.country || ''}</td>
                <td>${item.impact ? `<span class="${impactClass}">${item.impact}</span>` : ''}</td>
                <td>${item.event || ''}${leakedBadge}</td>
                <td><span class="event-type">${eventType}</span></td>
                <td>${item.actual || ''}</td>
                <td>${item.forecast || ''}</td>
                <td>${item.previous || ''}</td>
                <td>${item.revision || ''}</td>
                <td>${indicator}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    document.getElementById('tableContainer').innerHTML = html;
    
    // Add event listeners for filter after rendering
    setupEventFilterListeners();
}

function setupEventFilterListeners() {
    const filterInput = document.getElementById('eventFilter');
    const searchButton = document.getElementById('searchEventFilter');
    const clearButton = document.getElementById('clearEventFilter');
    const suggestionsDiv = document.getElementById('eventSuggestions');
    
    if (filterInput) {
        // Restore filter value if it exists
        filterInput.value = eventFilter;
        
        // Remove existing listeners to prevent duplicates
        const newFilterInput = filterInput.cloneNode(true);
        filterInput.parentNode.replaceChild(newFilterInput, filterInput);
        
        // Show suggestions as user types
        newFilterInput.addEventListener('input', (e) => {
            showEventSuggestions(e.target.value);
        });
        
        // Handle Enter key - this triggers the filter
        newFilterInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                eventFilter = e.target.value;
                hideEventSuggestions();
                applyEventFilter();
            }
        });
        
        // Hide suggestions when clicking outside
        newFilterInput.addEventListener('blur', () => {
            // Delay to allow clicking on suggestions
            setTimeout(hideEventSuggestions, 200);
        });
        
        // Focus shows suggestions if there's text
        newFilterInput.addEventListener('focus', (e) => {
            if (e.target.value.length >= 2) {
                showEventSuggestions(e.target.value);
            }
        });
    }
    
    // Handle clicking on suggestions
    if (suggestionsDiv) {
        suggestionsDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                const eventName = e.target.getAttribute('data-event');
                const input = document.getElementById('eventFilter');
                if (input) {
                    input.value = eventName;
                    eventFilter = eventName;
                    hideEventSuggestions();
                    // Optionally auto-apply the filter
                    applyEventFilter();
                }
            }
        });
    }
    
    if (searchButton) {
        // Remove existing listeners to prevent duplicates
        const newSearchButton = searchButton.cloneNode(true);
        searchButton.parentNode.replaceChild(newSearchButton, searchButton);
        
        newSearchButton.addEventListener('click', () => {
            const input = document.getElementById('eventFilter');
            if (input) {
                eventFilter = input.value;
                hideEventSuggestions();
                applyEventFilter();
            }
        });
    }
    
    if (clearButton) {
        // Remove existing listeners to prevent duplicates
        const newClearButton = clearButton.cloneNode(true);
        clearButton.parentNode.replaceChild(newClearButton, clearButton);
        
        newClearButton.addEventListener('click', () => {
            eventFilter = '';
            const input = document.getElementById('eventFilter');
            if (input) input.value = '';
            hideEventSuggestions();
            applyEventFilter();
        });
    }
}

function downloadJSON() {
    if (!calendarData || calendarData.length === 0) {
        alert('No data to download. Please load some data first.');
        return;
    }
    
    const jsonStr = JSON.stringify(calendarData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forex-factory-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadCSV() {
    if (!calendarData || calendarData.length === 0) {
        alert('No data to download. Please load some data first.');
        return;
    }
    
    // Convert to CSV with all available fields
    const headers = [
        'Day', 'Date', 'Time', 'Currency', 'Impact', 'Event', 'Event Type', 'Actual', 'Forecast', 'Previous', 'Country',
        'EventId', 'EbaseId', 'Revision', 'Leaked', 'ActualBetterWorse',
        'PrefixedName', 'SoloTitle', 'ImpactName', 'ImpactClass', 'ImpactTitle',
        'HasGraph', 'HasDataValues', 'URL', 'SoloURL', 'Dateline', 'ScrapedAt'
    ];
    const csvContent = [
        headers.join(','),
        ...calendarData.map(row => [
            getDayOfWeek(row.date),
            row.date || '',
            row.time || '',
            row.currency || '',
            row.impact || '',
            `"${(row.event || '').replace(/"/g, '""')}"`,
            getEventType(row.event || ''),
            row.actual || '',
            row.forecast || '',
            row.previous || '',
            row.country || '',
            row.eventId || '',
            row.ebaseId || '',
            row.revision || '',
            row.leaked || '',
            row.actualBetterWorse || '',
            `"${(row.prefixedName || '').replace(/"/g, '""')}"`,
            `"${(row.soloTitle || '').replace(/"/g, '""')}"`,
            row.impactName || '',
            row.impactClass || '',
            row.impactTitle || '',
            row.hasGraph || '',
            row.hasDataValues || '',
            `"${(row.url || '').replace(/"/g, '""')}"`,
            `"${(row.soloUrl || '').replace(/"/g, '""')}"`,
            row.dateline || '',
            row.scraped_at || ''
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forex-factory-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function viewRawJSON() {
    if (!calendarData || calendarData.length === 0) {
        alert('No data to view. Please load some data first.');
        return;
    }
    
    const jsonStr = JSON.stringify(calendarData, null, 2);
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
        <html>
        <head><title>Raw JSON Data</title></head>
        <body>
            <h1>Forex Factory Raw JSON Data (${calendarData.length} events)</h1>
            <pre style="white-space: pre-wrap; word-wrap: break-word;">${jsonStr}</pre>
        </body>
        </html>
    `);
    newWindow.document.close();
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
  
  // Combined mode is now supported - no conflict warning needed
  
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
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
          })
          .then(data => {
            completedRequests++;
            updateLoadingMessage(`Loading ${completedRequests} of ${totalRequests}...`);
            return data;
          })
          .catch(error => {
            console.error('Error fetching data:', error);
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
      if (event && typeof event === 'object') {
        if (event.eventId) {
          // Handle events WITH eventId - proper deduplication
          if (!uniqueEvents.has(event.eventId)) {
            uniqueEvents.set(event.eventId, event);
          }
          // If eventId already exists, skip (deduplication working correctly)
        } else {
          // Handle events WITHOUT eventId - use fallback deduplication
          const key = `${event.date}-${event.time}-${event.event}`;
          if (!uniqueEvents.has(key)) {
            uniqueEvents.set(key, event);
          }
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
  
  // Get first and last dates from current data - parse directly to avoid timezone issues
  const firstDateStr = calendarData[0].date;
  const lastDateStr = calendarData[calendarData.length - 1].date;
  
  // Parse first date components directly
  const firstParts = firstDateStr.split('-');
  const firstDate = new Date(parseInt(firstParts[0]), parseInt(firstParts[1]) - 1, parseInt(firstParts[2]));
  
  // Parse last date components directly  
  const lastParts = lastDateStr.split('-');
  const lastDate = new Date(parseInt(lastParts[0]), parseInt(lastParts[1]) - 1, parseInt(lastParts[2]));
  
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
        // Get active filters from UI
        const filters = getActiveFilters();
        const filterParams = buildFilterParams(filters);
        
        // Build and store the current query with filters
        let baseQuery = '';
        if (mode === 'day') baseQuery = `day=${encodeURIComponent(value)}`;
        else if (mode === 'week') baseQuery = `week=${encodeURIComponent(value)}`;
        else if (mode === 'month') baseQuery = `month=${encodeURIComponent(value)}`;
        else return;
        
        currentQuery = `${baseQuery}&${filterParams}`;
        
        const res = await fetchNoCache(`${jsonUrlBase}?${currentQuery}`);
        if (!res.ok) throw new Error(await res.text());
        calendarData = await res.json();
        
        // Reset pagination
        currentPage = 1;
        
        // Update last update time
        if (calendarData.length > 0 && calendarData[0].scraped_at) {
            const date = new Date(calendarData[0].scraped_at);
            document.getElementById('lastUpdate').textContent = 
                `Last Run: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
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
    
    // Update event count to show filtered vs total
    const eventCountEl = document.getElementById('eventCount');
    if (eventCountEl) {
        if (eventFilter && filteredData.length < calendarData.length) {
            eventCountEl.textContent = `${filteredData.length} of ${calendarData.length} events`;
        } else {
            eventCountEl.textContent = `${calendarData.length} events`;
        }
    }
    
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
    const dataToUse = filteredData.length > 0 ? filteredData : calendarData;
    const totalPages = Math.ceil(dataToUse.length / ROWS_PER_PAGE);
    const newPage = currentPage + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable(dataToUse);
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