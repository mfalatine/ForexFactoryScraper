# ForexFactory Calendar Scraper 📊

A web scraper that automatically fetches economic calendar data from ForexFactory. Run it manually whenever you need fresh data, or set it to run automatically.

## 🚀 Quick Start

### Get the Data
- **JSON**: https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.json
- **CSV**: https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.csv
- **Website**: https://mfalatine.github.io/ForexFactoryScraper/

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
