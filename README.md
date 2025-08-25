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
`https://forexfactoryscrape.netlify.app/.netlify/functions/scrape`

### Required Parameters

All API calls need these parameters to work:
- `month` - Month in ForexFactory format (e.g., `jan01.2025`, `feb01.2025`, `mar15.2025`)
- `permalink=true` - Required for the API to work
- `impacts=3,2,1,0` - Impact levels (3=High, 2=Medium, 1=Low, 0=Holiday)
- `event_types=1,2,3,4,5,7,8,9,10,11` - Event type IDs
- `currencies=1,2,3,4,5,6,7,8,9` - Currency IDs
- `format=json|csv` - Optional output format (default: json)

### Working API Examples

```bash
# January 2025 - Complete working URL (all events, all currencies, all impacts)
https://forexfactoryscrape.netlify.app/.netlify/functions/scrape?month=jan01.2025&permalink=true&impacts=3,2,1,0&event_types=1,2,3,4,5,7,8,9,10,11&currencies=1,2,3,4,5,6,7,8,9

# February 2025 - Get as JSON
https://forexfactoryscrape.netlify.app/.netlify/functions/scrape?month=feb01.2025&permalink=true&impacts=3,2,1,0&event_types=1,2,3,4,5,7,8,9,10,11&currencies=1,2,3,4,5,6,7,8,9

# March 2025 - Get as CSV  
https://forexfactoryscrape.netlify.app/.netlify/functions/scrape?month=mar01.2025&format=csv&permalink=true&impacts=3,2,1,0&event_types=1,2,3,4,5,7,8,9,10,11&currencies=1,2,3,4,5,6,7,8,9

# Download with curl
curl -o "jan_2025.json" "https://forexfactoryscrape.netlify.app/.netlify/functions/scrape?month=jan01.2025&permalink=true&impacts=3,2,1,0&event_types=1,2,3,4,5,7,8,9,10,11&currencies=1,2,3,4,5,6,7,8,9"

curl -o "feb_2025.csv" "https://forexfactoryscrape.netlify.app/.netlify/functions/scrape?month=feb01.2025&format=csv&permalink=true&impacts=3,2,1,0&event_types=1,2,3,4,5,7,8,9,10,11&currencies=1,2,3,4,5,6,7,8,9"
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

## 💡 Using the API from JavaScript

```javascript
// Fetch data from your web application
fetch('https://forexfactoryscrape.netlify.app/.netlify/functions/scrape?month=jan01.2025&permalink=true&impacts=3,2,1,0&event_types=1,2,3,4,5,7,8,9,10,11&currencies=1,2,3,4,5,6,7,8,9')
  .then(response => response.json())
  .then(data => console.log(data));
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
