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

## 💡 Real-World Use Cases

### 1. Trading Dashboard Integration
```javascript
// Fetch high-impact events for next week
fetch('https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?week=next&impacts[]=3')
  .then(res => res.json())
  .then(events => {
    // Filter for USD events
    const usdEvents = events.filter(e => e.currency === 'USD');
    // Display in your trading dashboard
    displayUpcomingEvents(usdEvents);
  });
```

### 2. Python Data Analysis
```python
import pandas as pd
import requests
from io import StringIO

# Get this month's employment data
response = requests.get(
    'https://forexfactoryscraper.netlify.app/.netlify/functions/scrape',
    params={'month': 'this', 'eventTypes[]': '3', 'format': 'csv'}
)

# Load into DataFrame
df = pd.read_csv(StringIO(response.text))

# Analyze employment indicators
employment_events = df[df['Event Type'] == 'Employment']
print(f"Found {len(employment_events)} employment events")
print(employment_events[['Date', 'Event', 'Actual', 'Forecast']].head())
```

### 3. Automated Alert System
```javascript
// Check for today's high-impact events
async function checkTodayEvents() {
  const response = await fetch(
    'https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?day=today&impacts[]=3'
  );
  const events = await response.json();
  
  // Send alerts for specific events
  events.forEach(event => {
    if (event.event.includes('NFP') || event.event.includes('Interest Rate')) {
      sendTradingAlert({
        time: event.time,
        event: event.event,
        forecast: event.forecast,
        currency: event.currency
      });
    }
  });
}

// Run every morning
setInterval(checkTodayEvents, 24 * 60 * 60 * 1000);
```

### 4. Multi-Month Historical Analysis
```bash
# Download 3 months of data for backtesting
curl -o "forex_data_aug_oct.csv" \
  "https://forexfactoryscraper.netlify.app/.netlify/functions/scrape?months[]=aug.2025&months[]=sep.2025&months[]=oct.2025&format=csv"
```

## 🏗️ Technology Stack

- **Runtime**: Node.js 18+ (Netlify Functions)
- **Scraping**: Cheerio for HTML parsing with JSON data extraction
- **Deployment**: Netlify serverless functions (auto-scaling)
- **Frontend**: Vanilla JavaScript with DateRangeManager class, HTML5, CSS3
- **Data Processing**: Real-time deduplication and filtering


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
