## Revised Requirements Specification for ForexFactory Scraper

### 1. **Date Selection System**

#### 1.1 Week Selector
- **Year Navigation**: User can navigate from 2007 to current year + 10 (e.g., 2007-2035 in 2025)
- **Month Navigation**: Within selected year, user can navigate month by month
- **Week Display**: Show all weeks that touch the current month view
  - Include last week(s) of previous month if they overlap
  - Include first week(s) of next month if they overlap
  - Each week shows: Sunday-Saturday date range
  - Week number (Week 1, Week 2, etc.)
- **Multi-Selection**: User can select multiple weeks across different months/years
  - Selections persist when navigating to different months
  - Visual indicator for already-selected weeks when revisiting a month
- **Selection Display**: Show all selected weeks as badges/chips below selector
  - Format: "Jan 5-11, 2025" with X to remove
  - Group by year if multiple years selected

#### 1.2 Month Selector
- **Year Navigation**: Independent year selector (2007 to current year + 10)
- **Multi-Year Selection**: Can select months from different years
- **Checkbox Grid**: 12 months displayed as checkboxes
- **Selection Display**: Show selected months as badges
  - Format: "January 2025" with X to remove
- **Clear Distinction**: Visual separation from week selector

### 2. **Filter System**

#### 2.1 Impact Filters
- High (red flag) - maps to `3`
- Medium (orange flag) - maps to `2`
- Low (yellow flag) - maps to `1`
- Non-Economic/Holiday (gray flag) - maps to `0`
- "All/None" quick toggles

#### 2.2 Event Type Filters
- Growth - maps to `1`
- Inflation - maps to `2`
- Employment - maps to `3`
- Central Bank - maps to `4`
- Bonds - maps to `5`
- Housing - maps to `7`
- Consumer Surveys - maps to `8`
- Business Surveys - maps to `9`
- Speeches - maps to `10`
- Misc - maps to `11`
- "All/None" quick toggles

#### 2.3 Currency Filters
- 9 major currencies (AUD, CAD, CHF, CNY, EUR, GBP, JPY, NZD, USD)
- Maps to numbers 1-9 respectively
- "All/None" quick toggles

### 3. **Data Loading Logic**

#### 3.1 Selection Priority
- **Mutual Exclusivity**: Week and Month selections are mutually exclusive
  - If weeks are selected, ignore month selections
  - If months are selected, ignore week selections
  - Visual indicator showing which mode is active
  - Warning if user has selections in both

#### 3.2 URL Building
- **Week URLs**: One request per selected week
  ```
  /calendar?week=jan5.2025&permalink=true&impacts=3,2,1&event_types=1,2,3&currencies=1,2,3,4,5,6,7,8,9
  ```
- **Month URLs**: One request per selected month
  ```
  /calendar?month=jan01.2025&permalink=true&impacts=3,2,1&event_types=1,2,3&currencies=1,2,3,4,5,6,7,8,9
  ```

#### 3.3 Data Fetching
- Parallel fetch for all selected periods
- Progress indicator showing "Fetching 3 of 5 weeks..."
- Combine all results, remove duplicates (by eventId)
- Sort by date/time after combining

### 4. **ForexFactory Link Button**

#### 4.1 Location
- Move from left panel to data table header
- Position: Top-right of table header area
- Always visible when data is displayed

#### 4.2 Functionality
- **Dynamic URL Generation**: Based on current table data
  - If showing single week: Link to that week
  - If showing single month: Link to that month
  - If showing multiple periods: Link to first period with filters
  - Include current filter parameters in URL
- **Visual Design**: Clear FF logo/branding
- **Tooltip**: "Open this view in ForexFactory"

### 5. **UI/UX Requirements**

#### 5.1 Visual Hierarchy
- Clear separation between Week and Month selectors
- Active selection mode highlighted
- Disabled state for inactive selector

#### 5.2 Selection Management
- **Badges/Chips**: 
  - Show all active selections
  - Click to remove individual selection
  - "Clear All" button for bulk removal
- **Selection Count**: 
  - "3 weeks selected" or "2 months selected"
  - **Event Count Estimate**: "Approximately X events" (using ~75-100 events per week average)

#### 5.3 Loading States
- Disable selectors during fetch
- Show progress: "Loading Week 2 of 5..."
- Spinner on Load button
- Table shows loading overlay

#### 5.4 Error Handling
- Failed fetches: Show which week/month failed
- Retry option for failed periods
- Partial data display (show what loaded successfully)

### 6. **Data Management**

#### 6.1 Deduplication
- Events may appear in multiple weeks/months
- Use eventId as unique identifier
- Keep first occurrence, discard duplicates

#### 6.2 Sorting
- Primary: Date (ascending)
- Secondary: Time (ascending)
- Tertiary: Impact (High → Medium → Low)

#### 6.3 Caching
- Cache fetched periods for session
- Visual indicator for cached vs fresh data
- Manual refresh option

### 7. **State Management**

#### 7.1 URL Parameters
- Persist selections in URL for sharing
- Format: `?weeks=jan5.2025,jan12.2025&impacts=3,2&currencies=1,5,9`
- Load from URL on page load

#### 7.2 Local Storage
- Save user's filter preferences
- Remember last selected view (week vs month)
- Restore on return visit

### 8. **Mobile Responsiveness**

#### 8.1 Selector Behavior
- Full-screen modal on mobile
- Touch-friendly checkboxes
- Swipe navigation for months

#### 8.2 Table Display
- Horizontal scroll for table
- Option to switch to card view
- Sticky date column
- **Existing Pagination**: Keep current 200 rows per page system

### 9. **Validation Rules**

#### 9.1 Selection Limits
- Maximum 52 weeks (1 year of weeks)
- Maximum 12 months (1 year of months)
- Warning before large fetches (>10 periods)

#### 9.2 Date Range Validation
- **Historical Limit**: Cannot select dates before January 2007
- **Future Limit**: Cannot select dates beyond current year + 10
- Disable unavailable dates in selectors

### 10. **Performance Optimization**

#### 10.1 Batch Processing
- Limit parallel requests to 5
- Queue remaining requests
- Throttle to avoid rate limiting

#### 10.2 Data Size Management
- **Use Existing Pagination**: Current 200 rows/page system handles large datasets
- Virtual scrolling optional for future enhancement
- Download options for full dataset (CSV/JSON already implemented)

### 11. **Expected Data Volumes**

#### 11.1 Event Estimates
- **Per Week**: ~75-100 events (varies by week)
- **Per Month**: ~300-400 events
- **Per Year**: ~4,000-5,000 events
- Display accurate count after fetch, not estimate

#### 11.2 Performance Targets
- Single week fetch: <2 seconds
- Full month fetch: <3 seconds
- 12 months fetch: <15 seconds (with parallel processing)

This revised specification accounts for the ForexFactory historical data range (2007-present+10), realistic event volumes, and leverages the existing pagination system.