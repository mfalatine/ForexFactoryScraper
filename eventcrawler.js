#!/usr/bin/env node

/**
 * EventCrawler - ForexFactory Event Type Mapping Tool
 * 
 * This script collects event type mappings by running through each
 * event type filter individually over a full year period.
 * 
 * Output: event_mappings.csv with event_name, ebase_id, event_type
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE = 'https://forexfactoryscrape.netlify.app/.netlify/functions/scrape';
const OUTPUT_FILE = 'event_mappings.csv';
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds to be respectful

// Event type filters mapping (from your existing code)
const EVENT_TYPE_FILTERS = {
  'Growth': '1',
  'Inflation': '2', 
  'Employment': '3',
  'Central Bank': '4',
  'Bonds': '5',
  'Housing': '7',
  'Consumer': '8',
  'Business': '9',
  'Speeches': '10',
  'Misc': '11'
};

// Generate date range - August 2024 to August 2025
function generateDateRange() {
  const months = [];
  const startYear = 2024;
  const startMonth = 7; // August (0-based)
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(startYear, startMonth + i, 1);
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monthParam = `${monthNames[date.getMonth()]}01.${date.getFullYear()}`;
    months.push({
      param: monthParam,
      display: `${monthNames[date.getMonth()].toUpperCase()} ${date.getFullYear()}`
    });
  }
  
  return months;
}

// Build API URL for specific event type and month
function buildApiUrl(monthParam, eventTypeCode) {
  const params = new URLSearchParams({
    month: monthParam,
    permalink: 'true',
    impacts: '3,2,1,0', // All impact levels
    event_types: eventTypeCode, // Only the specific event type
    currencies: '1,2,3,4,5,6,7,8,9' // All currencies
  });
  
  return `${API_BASE}?${params.toString()}`;
}

// Fetch data from API with retry logic
async function fetchData(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.log(`  Attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt === retries) {
        throw error;
      }
      await sleep(DELAY_BETWEEN_REQUESTS * attempt); // Exponential backoff
    }
  }
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Append events to CSV
function appendToCSV(events, eventTypeName, csvPath) {
  const rows = events.map(event => {
    const eventName = (event.event || '').replace(/"/g, '""'); // Escape quotes
    const ebaseId = event.ebaseId || '';
    const eventType = eventTypeName;
    
    return `"${eventName}",${ebaseId},"${eventType}"`;
  });
  
  if (rows.length > 0) {
    fs.appendFileSync(csvPath, rows.join('\n') + '\n', 'utf8');
    return rows.length;
  }
  
  return 0;
}

// Initialize CSV file with headers
function initializeCSV(csvPath) {
  const headers = 'event_name,ebase_id,event_type\n';
  fs.writeFileSync(csvPath, headers, 'utf8');
  console.log(`✅ Initialized ${csvPath}`);
}

// Main crawler function
async function crawlEvents() {
  console.log('🕷️  EventCrawler Starting...');
  console.log(`📅 Date Range: August 2024 - August 2025`);
  console.log(`📊 Event Types: ${Object.keys(EVENT_TYPE_FILTERS).join(', ')}`);
  console.log(`📁 Output File: ${OUTPUT_FILE}`);
  console.log('');
  
  const csvPath = path.join(__dirname, OUTPUT_FILE);
  const dateRange = generateDateRange();
  let totalEvents = 0;
  let totalRequests = 0;
  
  // Initialize CSV
  initializeCSV(csvPath);
  
  // Process each event type
  for (const [eventTypeName, eventTypeCode] of Object.entries(EVENT_TYPE_FILTERS)) {
    console.log(`\n🎯 Processing Event Type: ${eventTypeName} (code: ${eventTypeCode})`);
    let eventTypeTotal = 0;
    
    // Process each month for this event type
    for (const month of dateRange) {
      try {
        console.log(`  📅 Fetching ${month.display}...`);
        
        const url = buildApiUrl(month.param, eventTypeCode);
        const events = await fetchData(url);
        totalRequests++;
        
        // Filter out events that don't have ebaseId (optional safety check)
        const validEvents = events.filter(event => event.ebaseId);
        
        if (validEvents.length > 0) {
          const eventsAdded = appendToCSV(validEvents, eventTypeName, csvPath);
          eventTypeTotal += eventsAdded;
          totalEvents += eventsAdded;
          console.log(`    ✅ Added ${eventsAdded} events`);
        } else {
          console.log(`    ℹ️  No events found`);
        }
        
        // Be respectful - wait between requests
        await sleep(DELAY_BETWEEN_REQUESTS);
        
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
        // Continue with next month despite error
      }
    }
    
    console.log(`  📊 ${eventTypeName} Total: ${eventTypeTotal} events`);
  }
  
  // Final summary
  console.log('\n🎉 EventCrawler Complete!');
  console.log(`📊 Total Events Collected: ${totalEvents}`);
  console.log(`📡 Total API Requests: ${totalRequests}`);
  console.log(`📁 Output File: ${csvPath}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Review event_mappings.csv for completeness');
  console.log('2. Use this data to add event type columns to your main application');
  console.log('3. Handle duplicate ebaseIds that appear in multiple categories');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  EventCrawler interrupted by user');
  console.log(`📁 Partial results saved in: ${OUTPUT_FILE}`);
  process.exit(0);
});

// Run the crawler
if (require.main === module) {
  crawlEvents().catch(error => {
    console.error('\n❌ EventCrawler failed:', error);
    process.exit(1);
  });
}

module.exports = { crawlEvents };