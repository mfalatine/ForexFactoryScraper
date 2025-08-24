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

// Helper function to prevent caching
function fetchNoCache(url) {
    return fetch(`${url}&_t=${Date.now()}`, { cache: 'no-store' });
}

// Initialize page
async function init() {
    // Set today's date as default for start date using LOCAL date (avoid UTC shift)
    const today = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const todayString = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    document.getElementById('startDate').value = todayString;
    
    // Load the data using week= (same logic as the FF button)
    try {
        const [ty, tm, td] = todayString.split('-').map(Number);
        const tDate = new Date(ty, tm - 1, td);
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const weekParam = `${months[tDate.getMonth()]}${tDate.getDate()}.${tDate.getFullYear()}`;
        
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

async function fetchIntoPage(ev) {
    const startDate = document.getElementById('startDate').value;
    if (!startDate) { alert('Please select a start date'); return; }

    const btn = ev.currentTarget;
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Fetching detailed data...';
    
    // Store the current query
    currentQuery = `start=${startDate}`;
    
    try {
        // Use start= to get exactly selected date + 6 days
        const res = await fetchNoCache(`${jsonUrlBase}?${currentQuery}`);
        if (!res.ok) throw new Error(await res.text());
        calendarData = await res.json();
        
        // Reset pagination
        currentPage = 1;
        
        document.getElementById('eventCount').textContent = `${calendarData.length} events`;
        if (calendarData.length > 0 && calendarData[0].scraped_at) {
            const date = new Date(calendarData[0].scraped_at);
            document.getElementById('lastUpdate').textContent = 
                `Last Updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }
        displayTable(calendarData);
        btn.textContent = '✅ Fetched with Details!';
    } catch (e) {
        console.error(e);
        alert(`Fetch failed. ${e && e.message ? e.message : ''}`);
        btn.textContent = '❌ Failed. Retry';
    } finally {
        setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 3000);
    }
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