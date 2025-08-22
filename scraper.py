# pyright: reportMissingImports=false
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import csv
import json
from datetime import datetime, timedelta
import time
import os
import argparse
from urllib.parse import urlencode

# Optional dependency to avoid Pylance import errors if not installed
try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception:  # pragma: no cover
    BeautifulSoup = None  # type: ignore

def scrape_forex(start_date=None, end_date=None):
    """
    Scrape ForexFactory calendar data
    
    Args:
        start_date (str): Start date in YYYY-MM-DD format (optional)
        end_date (str): End date in YYYY-MM-DD format (optional)
    """
    # Reduce webdriver_manager and Chrome/Driver noise
    os.environ.setdefault('WDM_LOG_LEVEL', '0')

    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-software-rasterizer")
    chrome_options.add_argument("--disable-background-timer-throttling")
    chrome_options.add_argument("--disable-backgrounding-occluded-windows")
    chrome_options.add_argument("--disable-renderer-backgrounding")
    chrome_options.add_argument("--disable-features=TranslateUI")
    chrome_options.add_argument("--disable-ipc-flooding-protection")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument("--disable-logging")
    chrome_options.add_argument("--log-level=3")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-logging", "enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    chrome_options.page_load_strategy = 'eager'
    chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
    
    # Setup driver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        # Construct URL with date parameters
        base_url = "https://www.forexfactory.com/calendar"
        params = {}
        
        if start_date:
            params['from'] = start_date
        if end_date:
            params['to'] = end_date
            
        if params:
            url = f"{base_url}?{urlencode(params)}"
        else:
            url = base_url
            
        print(f"Navigating to: {url}")
        driver.get(url)
        
        # Wait for calendar table to load
        print("Waiting for calendar to load...")
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CLASS_NAME, "calendar__table"))
        )
        
        # Additional wait for dynamic content
        time.sleep(5)
        
        # Get page source
        if BeautifulSoup is None:
            print("BeautifulSoup (bs4) is required. Install with: pip install beautifulsoup4")
            return []
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        
        # Find calendar table
        table = soup.find('table', class_='calendar__table')
        
        if not table:
            print("Calendar table not found!")
            return []
        
        print("Extracting data...")
        
        # Extract data
        data = []
        rows = table.find_all('tr', class_=['calendar__row', 'calendar_row'])
        
        current_date = None
        for row in rows:
            # Check for date cell
            date_cell = row.find('td', class_=['calendar__date', 'date'])
            if date_cell:
                date_text = date_cell.get_text(strip=True)
                if date_text:
                    current_date = date_text
            
            # Extract event data
            event_cell = row.find('td', class_=['calendar__event', 'event'])
            if event_cell:
                event_text = event_cell.get_text(strip=True)
                if event_text:  # Only process if there's an event
                    time_cell = row.find('td', class_=['calendar__time', 'time'])
                    currency_cell = row.find('td', class_=['calendar__currency', 'currency'])
                    impact_cell = row.find('td', class_=['calendar__impact', 'impact'])
                    actual_cell = row.find('td', class_=['calendar__actual', 'actual'])
                    forecast_cell = row.find('td', class_=['calendar__forecast', 'forecast'])
                    previous_cell = row.find('td', class_=['calendar__previous', 'previous'])
                    
                    # Determine impact level
                    impact = ''
                    if impact_cell:
                        # Look for impact icon/span
                        impact_span = impact_cell.find('span')
                        if impact_span and 'class' in impact_span.attrs:
                            classes = ' '.join(impact_span['class'])
                            if 'high' in classes or 'red' in classes:
                                impact = 'High'
                            elif 'medium' in classes or 'ora' in classes or 'orange' in classes:
                                impact = 'Medium'
                            elif 'low' in classes or 'yel' in classes or 'yellow' in classes:
                                impact = 'Low'
                    
                    data.append({
                        'date': current_date,
                        'time': time_cell.get_text(strip=True) if time_cell else '',
                        'currency': currency_cell.get_text(strip=True) if currency_cell else '',
                        'impact': impact,
                        'event': event_text,
                        'actual': actual_cell.get_text(strip=True) if actual_cell else '',
                        'forecast': forecast_cell.get_text(strip=True) if forecast_cell else '',
                        'previous': previous_cell.get_text(strip=True) if previous_cell else '',
                        'scraped_at': datetime.now().isoformat()
                    })
        
        print(f"Extracted {len(data)} events")
        return data
        
    except Exception as e:
        print(f"Error during scraping: {e}")
        return []
        
    finally:
        driver.quit()

def save_data(data):
    """Save data to JSON and CSV files"""
    
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    if data:
        # Save as JSON
        json_path = 'data/forex_calendar.json'
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"Saved JSON to {json_path}")
        
        # Save as CSV (without pandas)
        csv_path = 'data/forex_calendar.csv'
        if data:
            fieldnames = list(data[0].keys())
            with open(csv_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(data)
        else:
            with open(csv_path, 'w', encoding='utf-8', newline='') as f:
                f.write('')
        print(f"Saved CSV to {csv_path}")
        
        # Also save a backup with timestamp
        timestamp = datetime.now().strftime("%Y%m%d")
        backup_json = f'data/forex_calendar_{timestamp}.json'
        with open(backup_json, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"Saved backup to {backup_json}")
        
        return True
    else:
        print("No data to save")
        return False

if __name__ == "__main__":
    # Setup command line arguments
    parser = argparse.ArgumentParser(description='Scrape ForexFactory Calendar')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD format)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD format)')
    parser.add_argument('--days', type=int, default=7, help='Number of days to scrape from start date (default: 7)')
    
    args = parser.parse_args()
    
    print("=== ForexFactory Calendar Scraper ===")
    print(f"Starting scrape at {datetime.now().isoformat()}")
    
    # Calculate date range
    start_date = args.start_date
    end_date = args.end_date
    
    # If start date provided but no end date, calculate end date using days
    if start_date and not end_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = start_dt + timedelta(days=args.days)
        end_date = end_dt.strftime('%Y-%m-%d')
        print(f"Scraping from {start_date} to {end_date} ({args.days} days)")
    elif start_date and end_date:
        print(f"Scraping from {start_date} to {end_date}")
    else:
        print("Scraping current week")
    
    # Scrape data
    data = scrape_forex(start_date, end_date)
    
    # Save data
    if save_data(data):
        print("✅ Scraping completed successfully!")
    else:
        print("❌ Scraping failed - no data extracted")
        exit(1)
