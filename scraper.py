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
        # Use ForexFactory's weekly view: ?week=aug22.2025
        base_url = "https://www.forexfactory.com/calendar"

        # Pick date for the week anchor
        if start_date:
            dt = datetime.strptime(start_date, '%Y-%m-%d')
        else:
            dt = datetime.now()

        week_str = f"{dt.strftime('%b').lower()}{dt.day}.{dt.year}"
        url = f"{base_url}?week={week_str}"
        print(f"Navigating to: {url}")
        driver.get(url)

        # Wait for calendar table to load
        print("Waiting for calendar to load...")
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CLASS_NAME, "calendar__table"))
        )

        # Nudge dynamic content to fully render
        time.sleep(2)
        try:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1)
            driver.execute_script("window.scrollTo(0, 0);")
        except Exception:
            pass

        if BeautifulSoup is None:
            print("BeautifulSoup (bs4) is required. Install with: pip install beautifulsoup4")
            return []
        soup = BeautifulSoup(driver.page_source, 'html.parser')

        table = soup.find('table', class_='calendar__table')
        if not table:
            print("Calendar table not found!")
            return []

        print("Extracting data...")
        rows = table.find_all('tr')

        data = []
        # Determine Monday of that week for stable ISO dates
        monday = dt - timedelta(days=dt.weekday())
        current_iso_date = None
        day_index = -1
        for row in rows:
            date_cell = row.find('td', class_=['calendar__date', 'date'])
            if date_cell and date_cell.get_text(strip=True):
                day_index += 1
                current_iso_date = (monday + timedelta(days=day_index)).strftime('%Y-%m-%d')

            event_cell = row.find('td', class_=['calendar__event', 'event'])
            if not event_cell:
                continue
            event_text = event_cell.get_text(strip=True)
            if not event_text:
                continue

            time_cell = row.find('td', class_=['calendar__time', 'time'])
            currency_cell = row.find('td', class_=['calendar__currency', 'currency'])
            impact_cell = row.find('td', class_=['calendar__impact', 'impact'])
            actual_cell = row.find('td', class_=['calendar__actual', 'actual'])
            forecast_cell = row.find('td', class_=['calendar__forecast', 'forecast'])
            previous_cell = row.find('td', class_=['calendar__previous', 'previous'])

            impact = ''
            if impact_cell:
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
                'date': current_iso_date,
                'time': time_cell.get_text(strip=True) if time_cell else '',
                'currency': currency_cell.get_text(strip=True) if currency_cell else '',
                'impact': impact,
                'event': event_text,
                'actual': actual_cell.get_text(strip=True) if actual_cell else '',
                'forecast': forecast_cell.get_text(strip=True) if forecast_cell else '',
                'previous': previous_cell.get_text(strip=True) if previous_cell else '',
                'scraped_at': datetime.now().isoformat()
            })

        # Validate and keep only events within the requested week
        week_start = (dt - timedelta(days=dt.weekday())).strftime('%Y-%m-%d')
        week_end = (dt - timedelta(days=dt.weekday()) + timedelta(days=6)).strftime('%Y-%m-%d')

        def in_week(d: str) -> bool:
            try:
                return week_start <= d <= week_end
            except Exception:
                return True

        before = len(data)
        data = [e for e in data if e.get('date') and in_week(e['date'])]
        after = len(data)
        print(f"Extracted {before} events; {after} within {week_start}..{week_end}")

        if after == 0:
            raise Exception("No events within requested week were found; site markup/filters may have changed")

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
    print("This script is deprecated. Use the Netlify Function at /.netlify/functions/scrape")
