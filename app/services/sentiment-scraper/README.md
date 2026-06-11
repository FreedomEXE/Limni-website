# Sentiment Scraper Service

Puppeteer-based web scraper that extracts real sentiment data from OANDA and Myfxbook.

## Setup

1. Install dependencies:
```bash
cd scraper
npm install
```

2. Start the scraper service:
```bash
npm start
```

The service will run on `http://localhost:3002`

## Endpoints

- `GET /scrape/oanda` - Scrape OANDA forex order book data
- `GET /scrape/myfxbook` - Scrape Myfxbook community outlook
- `GET /health` - Health check

## How It Works

Uses headless Chrome (Puppeteer) to:
1. Navigate to OANDA/Myfxbook pages
2. Wait for sentiment tables to load
3. Extract data from DOM
4. Return clean JSON

## Usage with Main App

1. Start the scraper: `cd scraper && npm start`
2. Update `.env` in main app: `SCRAPER_URL=http://localhost:3002`
3. Start main app: `npm run dev`
4. Trigger sentiment refresh from `/sentiment` page

## Production Deployment

For production, run the scraper as a separate service:
- Docker container
- Separate server/VM
- Serverless function with Puppeteer layer

Keep it isolated from your Next.js app for stability.
