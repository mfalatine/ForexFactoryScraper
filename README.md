# ForexFactory Calendar Scraper 📊

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A powerful serverless web scraper that fetches live economic calendar data from ForexFactory using Netlify Functions. Features an advanced date selection system, comprehensive filtering options, and real-time data export capabilities.

## ⚠️ IMPORTANT LEGAL DISCLAIMER

**This tool is provided for educational and research purposes only.** By using this software, you acknowledge that:

- This project is **NOT affiliated with, endorsed by, or connected to ForexFactory** or Fair Economy, Inc.
- **YOU are solely responsible** for complying with ForexFactory's Terms of Service and all applicable laws
- This software is provided **"AS IS"** without warranty of any kind
- We are **NOT responsible** for any damages resulting from use of this software
- **No financial advice** is provided - trading forex involves substantial risk of loss
- Please use responsibly with appropriate rate limiting (minimum 2-3 seconds between requests)

See full [Legal Disclaimer](#-full-legal-disclaimer) at the bottom of this document.

## 🚀 Quick Start

### Live Web Interface
- **Website**: [forexfactoryscrape.netlify.app](https://forexfactoryscrape.netlify.app)
- **Change History**: [Change History](https://forexfactoryscrape.netlify.app/change-history.html)

## 🌟 Key Features

### Real-Time Event Filtering
- **Smart Search**: Autocomplete event search with instant filtering
- **Live Updates**: Filter events without page refresh or scroll position loss
- **Event Counter**: Shows filtered results count (e.g., "Showing 45 of 200 events")
- **Bulk Actions**: "Check Visible" buttons for quick multi-selection

### Advanced Date Selection System
- **Multi-Week/Month Selection**: Select multiple weeks AND months simultaneously for comprehensive date ranges
- **Date Range**: Supports 2007-2035 with intelligent navigation
- **Batch Loading**: Progress indicators for multiple date selections
- **Auto-Deduplication**: Automatically removes duplicate events when combining date ranges

### Enhanced Data Display
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

### ⚠️ Rate Limiting Required
Please implement a minimum 2-3 second delay between API requests to respect ForexFactory's servers.

### Base Endpoint
```
https://forexfactoryscrape.netlify.app/.netlify/functions/scrape
```

### Required Parameters
All API calls need these parameters to work:

- `month` - Month in ForexFactory format (e.g., jan01.2025, feb01.2025, mar15.2025)
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
- eventId: Unique ForexFactory event identifier
- eventUrl: Direct link to event details
- impactLevel: Numeric impact (1-3)
- eventTypeId: Numeric event type ID
- detailHash: Event detail page identifier
- Additional metadata fields

## 💡 Using the API from JavaScript

```javascript
// IMPORTANT: Add delay between requests
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchForexData() {
  // Wait 3 seconds between requests
  await delay(3000);
  
  const response = await fetch('https://forexfactoryscrape.netlify.app/.netlify/functions/scrape?month=jan01.2025&permalink=true&impacts=3,2,1,0&event_types=1,2,3,4,5,7,8,9,10,11&currencies=1,2,3,4,5,6,7,8,9');
  const data = await response.json();
  console.log(data);
}
```

## 🏗️ Technology Stack

This is a JavaScript/Node.js serverless application:

- **Backend**: Node.js 18+ serverless function (Netlify Functions)
- **Frontend**: Pure vanilla JavaScript, HTML5, CSS3
- **Deployment**: Netlify (automatic scaling, no server management)
- **Dependencies**: None (all parsing done with native JavaScript)
- **No Database**: Direct API calls to ForexFactory, no data storage
- **Performance**: Optimized with minimal dependencies for fast loading

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
- Extracts event_name, ebase_id, event_type from each event
- Outputs comprehensive mapping data to event_mappings.csv
- Takes approximately 4+ minutes to complete (120 API requests with 2-second delays)
- Includes progress tracking, error handling, and retry logic

**Output**: Creates `event_mappings.csv` with definitive ForexFactory event classifications that can be used to add accurate event type columns to the main application.

**Usage**: Run this script periodically to update event type mappings or when you need comprehensive event classification data.

## 🆕 Latest Updates

### Latest Release (X90+)
- **Production Ready**: Removed all debug code and console statements
- **Clean Codebase**: Eliminated dead code and unused dependencies
- **Event Filtering**: Added autocomplete search with smart suggestions
- **UI Polish**: Consistent button sizing and improved navigation flow
- **File Management**: Unique timestamps prevent download overwrites

### Major Features
- **Timezone Perfect**: Times match ForexFactory exactly
- **Combined Selections**: Mix weeks and months for flexible ranges
- **Event Classification**: 10 categories with visual indicators
- **Responsive Design**: Optimized for all screen sizes
- **Bulk Operations**: Quick selection tools for efficiency

See the full [Change History](https://forexfactoryscrape.netlify.app/change-history.html) for complete details.

## 📝 License

This project is open source and available under the **GNU General Public License v3.0**.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. By contributing, you agree that your contributions will be licensed under GPL v3.0.

## ⚖️ Full Legal Disclaimer

### No Affiliation
This project is NOT affiliated with, endorsed by, or connected to ForexFactory, Fair Economy, Inc., or any of their subsidiaries or affiliates. ForexFactory is a registered trademark of Fair Economy, Inc.

### User Responsibility & Compliance
By using this software, you acknowledge and agree that:
- You are solely responsible for ensuring compliance with ForexFactory's Terms of Service
- You are responsible for complying with all applicable laws and regulations in your jurisdiction
- You must respect ForexFactory's robots.txt file and server resources
- You accept all risks associated with web scraping activities
- You will implement appropriate rate limiting (minimum 2-3 seconds between requests)

### No Warranty
This software is provided "AS IS" without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee the accuracy, completeness, reliability, or timeliness of the data scraped.

### Limitation of Liability
In no event shall the authors, contributors, or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

### Financial Disclaimer
This tool does not provide financial, investment, legal, or tax advice. Trading foreign exchange carries a high level of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you. Before deciding to trade foreign exchange, you should carefully consider your investment objectives, level of experience, and risk appetite.

### Acceptable Use
This tool is intended for:
- Personal research and analysis
- Educational purposes
- Academic research with proper attribution
- Building personal (non-commercial) trading tools

This tool must NOT be used for:
- Excessive automated requests that strain ForexFactory's servers
- Commercial purposes or creating paid services
- Reselling or redistributing ForexFactory's data
- Any activity that violates ForexFactory's Terms of Service
- Any illegal activities

### Indemnification
You agree to indemnify, defend, and hold harmless the project contributors from and against any and all claims, liabilities, damages, losses, costs, expenses, fees (including reasonable attorneys' fees) arising from your use of this software or your violation of these terms.

### Changes to Software
The software may stop working at any time if ForexFactory changes their website structure. We are not obligated to maintain, update, or provide support for this software.

### Privacy
This tool does not collect, store, or transmit any personal data. All requests are made directly from your browser/application to ForexFactory.

---

**USE AT YOUR OWN RISK**: Web scraping may violate terms of service and could result in IP bans or legal action. When in doubt, seek official API access or alternative data sources.

*Copyright (C) 2025 - Present. Released under GPL v3.0.*