# ForexFactory Calendar Scraper 📊

A web scraper that automatically fetches economic calendar data from ForexFactory. Run it manually whenever you need fresh data, or set it to run automatically.

## 🚀 Quick Start

### Get the Data

- **JSON**: [forex_calendar.json](https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.json)
- **CSV**: [forex_calendar.csv](https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.csv)
- **Website**: [mfalatine.github.io/ForexFactoryScraper](https://mfalatine.github.io/ForexFactoryScraper/)
 - **Version History**: [Version History](https://mfalatine.github.io/ForexFactoryScraper/version-history.html)

### Live API (Netlify Function)

- Base: `/.netlify/functions/scrape`
- Query params:
  - `start` (required): `YYYY-MM-DD`
  - `format` (optional): `csv` or `json` (default `json`)
- Date range: Results cover the selected start date plus 6 days (7 days total)

Examples:

```text
/.netlify/functions/scrape?start=2025-08-13
/.netlify/functions/scrape?start=2025-08-13&format=csv
```

### Run the Scraper Manually

1. Go to the [Actions tab](https://github.com/mfalatine/ForexFactoryScraper/actions)
2. Click "Scrape ForexFactory Calendar"
3. Click "Run workflow"
4. Wait 2-3 minutes for completion

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

## 💻 Usage Examples

### JavaScript

```javascript
fetch('https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.json')
  .then(response => response.json())
  .then(data => console.log(data));
```

## 🆕 Recent Changes

- 2025-08-23: Data preview shows all events (removed 20-item cap)
- 2025-08-23: Backend returns a rolling 7-day window from the selected date
- 2025-08-23: Removed "Generate Scraping Command" feature
- 2025-08-23: Moved sections: Data Preview under buttons; API Usage to bottom
- 2025-08-23: Removed "Format" and "Cost" info cards
- 2025-08-23: Added Version History page (`version-history.html`)
