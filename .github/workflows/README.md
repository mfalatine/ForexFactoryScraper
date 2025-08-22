# ForexFactory Calendar Scraper 📊

Automated weekly scraping of ForexFactory economic calendar data. Free to use, updated every Monday.

## 🌐 Access the Data

### Live Website
Visit: https://mfalatine.github.io/ForexFactoryScraper/

### Direct Data Access
- **JSON**: https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.json
- **CSV**: https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.csv

## 📅 Update Schedule

The data is automatically updated every Monday at 6:00 AM UTC via GitHub Actions.

You can also trigger a manual update by:
1. Going to the [Actions tab](https://github.com/mfalatine/ForexFactoryScraper/actions)
2. Selecting "Scrape ForexFactory Calendar"
3. Clicking "Run workflow"

## 🚀 Usage Examples

### JavaScript/Node.js
```javascript
fetch('https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.json')
  .then(response => response.json())
  .then(data => {
    console.log('Forex events:', data);
    // Use the data in your application
  });
```

### Python
```python
import requests
import pandas as pd

# Get JSON data
response = requests.get('https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.json')
data = response.json()

# Or get CSV directly into pandas
df = pd.read_csv('https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.csv')
```

### Excel/Google Sheets
You can import the CSV directly:
- Excel: Data → From Web → Enter the CSV URL
- Google Sheets: `=IMPORTDATA("https://raw.githubusercontent.com/mfalatine/ForexFactoryScraper/main/data/forex_calendar.csv")`

## 📦 Data Structure

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

## 🛠️ Technical Details

- **Scraping**: Python with Selenium and BeautifulSoup
- **Automation**: GitHub Actions (weekly schedule)
- **Hosting**: GitHub Pages (free)
- **Data Format**: JSON and CSV

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This tool is for educational purposes. Please respect ForexFactory's terms of service and use the data responsibly. The scraper runs once per week to minimize server load.

## 🤝 Contributing

Feel free to:
- Report issues
- Suggest improvements
- Fork and customize for your needs
- Star ⭐ if you find it useful!

## 📊 Status

![Scraping Status](https://github.com/mfalatine/ForexFactoryScraper/actions/workflows/scrape.yml/badge.svg)

Last update: Check the [data folder](https://github.com/mfalatine/ForexFactoryScraper/tree/main/data) for the latest timestamp.
