# ForexFactory Calendar Scraper 📊

A serverless web scraper that fetches live economic calendar data from ForexFactory using Netlify Functions. Get real-time forex calendar data via API or through the interactive web interface.

## 🚀 Quick Start

### Live Web Interface

- **Website**: [mfalatine.github.io/ForexFactoryScraper](https://mfalatine.github.io/ForexFactoryScraper/)
- **Change History**: [Change History](https://mfalatine.github.io/ForexFactoryScraper/change-history.html)

### Live API (Netlify Function)

The API fetches fresh data from ForexFactory on each request. No scheduled updates needed - data is always current!

#### Base Endpoint
`/.netlify/functions/scrape`

#### Query Parameters

##### Date Range Selection
- `start=YYYY-MM-DD` - Returns 7 days starting from the specified date
- `week=last|this|next` - Returns data for the specified week (Monday to Sunday)
- `week=aug19.2025` - Returns 7 days starting from the specified date (ForexFactory format)
- `day=yesterday|today|tomorrow` - Returns data for a single day
- `month=last|this|next` - Returns data for the specified month

##### Output Format
- `format=json` (default) - Returns JSON format
- `format=csv` - Returns CSV format

##### Optional Parameters
- `timezoneOffset=0` (default) - Hours to offset from ForexFactory's timezone

#### Examples

```text
# Get 7 days starting from a specific date
/.netlify/functions/scrape?start=2025-08-13

# Get this week's data
/.netlify/functions/scrape?week=this

# Get today's events
/.netlify/functions/scrape?day=today

# Get next month's calendar in CSV
/.netlify/functions/scrape?month=next&format=csv

# Get specific week using ForexFactory format
/.netlify/functions/scrape?week=aug19.2025
```

## 📊 Data Structure

Each event contains:

- `date`: Event date
- `time`: Event time
- `currency`: Currency affected (USD, EUR, GBP, etc.)
- `impact`: Impact level (High, Medium, Low)
- `event`: Event description
- `actual`: Actual value (when released)
- `forecast`: Forecasted value
- `previous`: Previous value
- `scraped_at`: Timestamp of when data was collected

## 🏗️ Technology Stack

- **Runtime**: Node.js 18+ (Netlify Functions)
- **Scraping**: Cheerio for HTML parsing
- **Deployment**: Netlify serverless functions
- **Frontend**: Vanilla JavaScript, HTML, CSS

## 💻 Usage Examples

### JavaScript - Fetch Live Data

```javascript
// Get this week's data
fetch('/.netlify/functions/scrape?week=this')
  .then(response => response.json())
  .then(data => console.log(data));

// Get specific date range
fetch('/.netlify/functions/scrape?start=2025-08-20')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Python - Fetch Live Data

```python
import requests

# Get today's events
response = requests.get('/.netlify/functions/scrape?day=today')
data = response.json()
print(data)
```

## 🛠️ Features

- **Live Data Fetching**: Fetches fresh data from ForexFactory on each API request
- **Multiple Date Ranges**: Support for day, week, month, or custom 7-day windows
- **Quick Links**: Fast access to common date ranges (Yesterday, Today, Tomorrow, Last/This/Next Week/Month)
- **Auto Time-Filling**: Events in the same time block automatically inherit the time value
- **Multiple Output Formats**: JSON and CSV support
- **Interactive Web Interface**: User-friendly UI with data preview and download options
- **Cache Busting**: Prevents stale data issues with automatic cache-busting timestamps
- **No Database Required**: Serverless architecture fetches data on-demand

## 🆕 Recent Changes

- **2025-08-23**: Added post-processing to fill missing times for events in the same time block
- **2025-08-23**: Added cache-busting timestamps to prevent browser caching issues
- **2025-08-23**: Fixed download buttons to use current query parameters
- **2025-08-23**: Migrated to Netlify Functions (removed Python scraper and GitHub Actions)
- **2025-08-23**: Fixed timezone offset issue (changed default from 1 to 0)
- **2025-08-23**: Improved date parsing to use explicit dates from ForexFactory
- **2025-08-23**: Added quick links for common date ranges
- **2025-08-23**: Data preview now shows all events (removed 20-item cap)

See the full [Change History](https://mfalatine.github.io/ForexFactoryScraper/change-history.html) for more details.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Disclaimer

This tool is for educational purposes. Please respect ForexFactory's terms of service and use responsibly.
