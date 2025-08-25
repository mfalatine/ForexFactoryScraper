# ForexFactory Calendar Scraper 📊

A powerful serverless web scraper that fetches live economic calendar data from ForexFactory using Netlify Functions. Features an advanced date selection system, comprehensive filtering options, and real-time data export capabilities.

## 🚀 Quick Start

### Live Web Interface

- **Website**: [mfalatine.github.io/ForexFactoryScraper](https://mfalatine.github.io/ForexFactoryScraper/)
- **Change History**: [Change History](https://mfalatine.github.io/ForexFactoryScraper/change-history.html)

## 🌟 Key Features

### Advanced Date Selection System (X23+)
- **Multi-Week/Month Selection**: Select multiple weeks AND months simultaneously for comprehensive date ranges
- **Date Range**: Supports 2007-2035 with intelligent navigation
- **Batch Loading**: Progress indicators for multiple date selections
- **Auto-Deduplication**: Automatically removes duplicate events when combining date ranges

### Enhanced Data Display (X44-X62)
- **Rich Table View**: 12-column display with day of week, clickable event details, and color-coded impact levels
- **Event Details**: Click event icons to open ForexFactory detail pages in popup windows
- **Pagination**: Handles large datasets with 200-row pages and navigation controls
- **Smart Time Filling**: Events in same time blocks automatically inherit time values

### Powerful Filtering System
- **Impact Levels**: High, Medium, Low with color indicators
- **Event Types**: 10 categories (Growth, Inflation, Employment, Central Bank, etc.)
- **Currencies**: Filter by major currency pairs (USD, EUR, GBP, JPY, etc.)
- **Quick Links**: One-click access to common date ranges

## 📊 Live API Access

### Base Endpoint
`https://forexfactoryscraper.netlify.app/.netlify/functions/scrape`

### Query Parameters

#### Date Ranges
- `weeks[]` - Array of week IDs (e.g., `weeks[]=aug25.2025&weeks[]=sep1.2025`)
- `months[]` - Array of month IDs (e.g., `months[]=aug.2025&months[]=sep.2025`)
- `week=this|last|next` - Quick week selection
- `month=this|last|next` - Quick month selection
- `day=today|yesterday|tomorrow` - Single day selection

#### Filters (Numeric IDs from ForexFactory)
- `impacts[]` - Impact levels (1=Low, 2=Medium, 3=High)
- `eventTypes[]` - Event type IDs (see EventCrawler section)
- `currencies[]` - Currency codes

#### Output
- `format=json|csv` - Output format (default: json)

### Example API Calls

```bash
# Get high-impact USD events for this week
curl "https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?week=this&impacts[]=3&currencies[]=USD"

# Get multiple weeks of data with filtering
curl "https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?weeks[]=aug25.2025&weeks[]=sep1.2025&impacts[]=2&impacts[]=3"

# Get full month of employment data in CSV
curl "https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?month=this&eventTypes[]=3&format=csv"
```

## 📋 Data Fields

### Display Table (12 columns)
- **Day**: Day of week (Monday, Tuesday, etc.)
- **Details**: Clickable icon linking to ForexFactory event page
- **Date**: Event date (YYYY-MM-DD)
- **Time**: Event time (ET timezone)
- **Currency**: Affected currency
- **Impact**: Visual impact level with color coding
- **Event**: Event name/description
- **Event Type**: Category (Growth, Inflation, etc.)
- **Actual**: Released value
- **Forecast**: Expected value
- **Previous**: Prior period value
- **Scraped At**: Data collection timestamp

### CSV Export (24+ fields)
Includes all display fields plus:
- `eventId`: Unique ForexFactory event identifier
- `eventUrl`: Direct link to event details
- `impactLevel`: Numeric impact (1-3)
- `eventTypeId`: Numeric event type ID
- `detailHash`: Event detail page identifier
- Additional metadata fields

## 💡 How to Use the API

### JavaScript Integration Examples

#### Fetch High-Impact Events
```javascript
// Get next week's high-impact events
fetch('https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?week=next&impacts[]=3')
  .then(res => res.json())
  .then(events => {
    // Filter for USD events
    const usdEvents = events.filter(e => e.currency === 'USD');
    console.log(`Found ${usdEvents.length} high-impact USD events`);
    // Display in your application
    displayEvents(usdEvents);
  });
```

#### Real-Time Event Monitoring
```javascript
// Check for today's events and set up alerts
async function monitorTodayEvents() {
  const response = await fetch(
    'https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?day=today'
  );
  const events = await response.json();
  
  // Process high-impact events
  events.filter(e => e.impactLevel === 3).forEach(event => {
    console.log(`High impact event: ${event.event} at ${event.time}`);
    // Set up your alert logic here
  });
}

// Check events periodically
setInterval(monitorTodayEvents, 60 * 60 * 1000); // Every hour
```

### Command Line Usage

#### Using curl
```bash
# Get this week's data in JSON
curl "https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?week=this"

# Download month data as CSV
curl -o "forex_data.csv" \
  "https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?month=this&format=csv"

# Get multiple weeks with filters
curl "https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?weeks[]=aug25.2025&weeks[]=sep1.2025&impacts[]=3"
```

### Consuming the API from Other Languages

#### Python Example
```python
# Example: How to call the ForexFactory API from Python
import requests
import json

# Fetch this month's high-impact events
response = requests.get(
    'https://forexfactoryscraper.netlify.app/.netlify/functions/scrape',
    params={'month': 'this', 'impacts[]': ['2', '3']}
)

if response.status_code == 200:
    events = response.json()
    print(f"Retrieved {len(events)} events")
    # Process your data here
```

## 🏗️ Technology Stack

This is a **JavaScript/Node.js** serverless application:

- **Backend**: Node.js 18+ serverless function (Netlify Functions)
- **Web Scraping**: Cheerio library for HTML parsing and JSON extraction
- **Frontend**: Pure vanilla JavaScript, HTML5, CSS3
- **Deployment**: Netlify (automatic scaling, no server management)
- **Dependencies**: Minimal - only Cheerio for server-side parsing
- **No Database**: Direct API calls to ForexFactory, no data storage


## 🔍 EventCrawler - Event Type Mapping Tool

The EventCrawler is a specialized script that collects comprehensive event type mappings from ForexFactory to enable accurate event classification.

### Running EventCrawler

**Prerequisites**: Node.js installed on your system

**Command**:
```bash
node eventcrawler.js
```

**What it does**:
- Collects event type mappings for a full year (August 2024 - August 2025)
- Processes all 10 event type filters individually (Growth, Inflation, Employment, Central Bank, Bonds, Housing, Consumer, Business, Speeches, Misc)
- Extracts `event_name`, `ebase_id`, `event_type` from each event
- Outputs comprehensive mapping data to `event_mappings.csv`
- Takes approximately 4+ minutes to complete (120 API requests with 2-second delays)
- Includes progress tracking, error handling, and retry logic

**Output**: Creates `event_mappings.csv` with definitive ForexFactory event classifications that can be used to add accurate event type columns to the main application.

**Usage**: Run this script periodically to update event type mappings or when you need comprehensive event classification data.

## 🆕 Latest Updates (X62)

### Major Enhancements
- **X62**: Fixed button height consistency across interface
- **X61**: Critical deduplication fix for duplicate event handling
- **X58**: Combined week+month selections for flexible date ranges
- **X44-52**: Added clickable event details with ForexFactory links
- **X23**: Complete UI redesign with advanced date selection system

### Recent Improvements
- Eliminated all timezone issues - times match ForexFactory exactly
- Added day of week column for better weekly planning
- Integrated event type classification with 10 categories
- Enhanced table with pagination and hover effects
- Optimized for mobile with responsive design

See the full [Change History](https://mfalatine.github.io/ForexFactoryScraper/change-history.html) for complete details.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Disclaimer

This tool is for educational purposes. Please respect ForexFactory's terms of service and use responsibly.
