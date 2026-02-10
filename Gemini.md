# Project: ForexFactoryScraper

This project is a Python-based utility designed to scrape economic calendar data from ForexFactory.

## Project Context

- **Environment:** Windows 11, Python 3.x, within a `.venv` virtual environment.
- **Primary IDE:** Cursor with Gemini CLI integration.
- **Main Goal:** Robust data extraction from ForexFactory's HTML structure into structured formats (CSV/JSON).

## Technical Requirements & Constraints

- **Parsing:** Always prefer **BeautifulSoup** for HTML parsing.
- **Request Handling:** Use `requests` with realistic user-agent headers to avoid rate limiting.
- **Error Handling:** Implement try-except blocks for network timeouts and missing HTML elements.
- **Data Structure:** Ensure all dates are parsed into ISO 8601 format.

## Coding Style & Standards

- Follow PEP 8 guidelines for Python code.
- Use descriptive variable names (e.g., `event_impact` instead of `ei`).
- Add docstrings to all major functions explaining parameters and return types.
- Maintain a clear separation between the "Fetcher" (network) and "Parser" (HTML) logic.

## Gemini CLI Instructions

- **Plan First:** Before making code changes, always output a brief `/plan` and wait for my approval.
- **Testing:** After modifying the scraper, suggest a specific terminal command to test the changes.
- **Review:** Use the `/ide` link to show me Diffs in Cursor so I can review changes before they are finalized.
