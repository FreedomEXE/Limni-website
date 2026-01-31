# Limni COT Bias Dashboard

MVP dashboard and API to compute weekly COT dealer bias and expose a stable JSON snapshot for the MT5 EA.

## Setup

1) Install dependencies:

```bash
npm install
```

2) Create `.env` from `.env.example`:

```bash
copy .env.example .env
```

3) Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Refresh the data

Refresh is protected by `ADMIN_TOKEN`.

```bash
curl -X POST http://localhost:3000/api/cot/refresh ^
  -H "x-admin-token: YOUR_TOKEN"
```

The dashboard also has a manual refresh panel (requires the same token).

## API

### `GET /api/cot/latest`

Returns the latest stored snapshot plus `trading_allowed` and `reason`.

Example:

```json
{
  "report_date": "2026-01-06",
  "last_refresh_utc": "2026-01-07T01:22:33.000Z",
  "trading_allowed": true,
  "reason": "fresh",
  "currencies": {
    "AUD": {
      "dealer_long": 41249,
      "dealer_short": 75619,
      "net": 34370,
      "bias": "BULLISH"
    }
  },
  "pairs": {
    "AUDUSD": {
      "direction": "LONG",
      "base_bias": "BULLISH",
      "quote_bias": "BEARISH"
    }
  }
}
```

### `POST /api/cot/refresh`

Fetches the latest CFTC TFF data, recomputes bias, and persists the snapshot.

## Data source

Uses the official CFTC public reporting dataset: `udgc-27he` (TFF_All).

The `COT_VARIANT` env var controls which rows are used:

- `FutOnly` (default)
- `Combined`

## Price performance (optional)

Pair performance uses Twelve Data hourly candles for the 7 FX majors, then
derives all crosses to measure change from the most recent Sunday 7:00 PM ET
open. Set `OANDA_API_KEY` and `OANDA_ACCOUNT_ID` to enable it.

Majors fetched:
- EURUSD, GBPUSD, AUDUSD, NZDUSD, USDJPY, USDCHF, USDCAD

Optional tuning:

- `PRICE_CACHE_SECONDS` (default: 300) to reduce API calls.

Refresh prices manually (this does not run automatically):

```bash
curl -X POST http://localhost:3000/api/prices/refresh ^
  -H "x-admin-token: YOUR_TOKEN"
```

## Storage

Snapshots are stored in `data/cot_snapshot.json`. For serverless deployments, use a persistent disk or swap this for a hosted database.

## Sentiment Module

The sentiment aggregator collects retail positioning data from **IG**, **OANDA**, and **Myfxbook** to identify crowding and path risk across FX pairs.

### Environment Variables

Optional sentiment provider credentials (IG requires API credentials, others scrape public pages):

```bash
IG_API_KEY=your_ig_api_key
IG_USERNAME=your_ig_username
IG_PASSWORD=your_ig_password

SENTIMENT_POLL_INTERVAL_SEC=300  # 5 minutes (default)
SENTIMENT_API_URL=http://localhost:3000
```

### Running the Sentiment Poller

The sentiment poller fetches data from providers every 5 minutes (configurable).

Start the poller in a separate terminal:

```bash
npm run sentiment:poll
```

Or manually trigger a refresh:

```bash
curl -X POST http://localhost:3000/api/sentiment/refresh ^
  -H "x-admin-token: YOUR_TOKEN"
```

### Sentiment API Endpoints

**`GET /api/sentiment/latest?symbols=EURUSD,GBPJPY`**

Returns the latest aggregated sentiment data for specified symbols (or all if omitted).

**`GET /api/sentiment/history?symbol=EURUSD&range=24h`**

Returns historical sentiment snapshots for a symbol. Range can be `24h`, `7d`, `1w`, etc.

**`GET /api/sentiment/health`**

Returns source health status, coverage stats, and recent data counts.

### UI

- **`/sentiment`** - Full sentiment dashboard with heatmap, crowding indicators, and source health
- Heatmap shows crowding state (red = crowded long, green = crowded short, gray = neutral)
- Flip indicators show recent sentiment reversals

### Storage

Sentiment data is stored in:
- `data/sentiment_snapshots.json` (raw provider data, 24h retention)
- `data/sentiment_aggregates.json` (aggregated scores, 7d retention)
- `data/sentiment_sources.json` (provider health status)

## Tests

```bash
npm test
```
