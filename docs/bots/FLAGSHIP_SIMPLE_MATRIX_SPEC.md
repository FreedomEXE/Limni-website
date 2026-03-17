# Flagship Simple Matrix Spec (Session-Gated, 36 Pairs)

## 1. Objective
Replace the current Flagship board UI with one simple at-a-glance matrix:
- Rows: fixed 36-pair universe
- Columns: `Dealer`, `Commercial`, `Sentiment (Daily)`, `Overlay`, `Strength (1h)`
- Color-only signal cells:
  - Green = Bullish
  - Red = Bearish
  - Gray = Neutral / No Data

No expandable sections. No long explanation text. No research panels in the default board view.

---

## 2. Scope

### In scope
- New single-table board layout for `/flagship`
- Session gating (ASIA / LONDON / NY): show only eligible pairs for selected session
- 5 data columns rendered as directional states
- Keep existing backend sources; only normalize presentation
- Primary source for weekly signal fields is `/api/performance/gated-setups`

### Out of scope
- New strategy logic/backtest logic changes
- New data providers
- Any deployment/auth changes

---

## 3. Pair Universe (Fixed 36)

Use `PAIRS_BY_ASSET_CLASS` from [cotPairs.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/cotPairs.ts).

### FX (28)
`EURUSD, GBPUSD, AUDUSD, NZDUSD, USDJPY, USDCHF, USDCAD, EURGBP, EURJPY, EURCHF, EURAUD, EURNZD, EURCAD, GBPJPY, GBPCHF, GBPAUD, GBPNZD, GBPCAD, AUDJPY, AUDCHF, AUDCAD, AUDNZD, NZDJPY, NZDCHF, NZDCAD, CADJPY, CADCHF, CHFJPY`

### Indices (3)
`SPXUSD, NDXUSD, NIKKEIUSD`

### Crypto (2)
`BTCUSD, ETHUSD`

### Commodities (3)
`XAUUSD, XAGUSD, WTIUSD`

### 3.1 Session eligibility source of truth
Create one shared constant for session eligibility and consume it from Flagship UI:
- Suggested file: `src/lib/flagship/sessionConfig.ts`
- Do not hardcode session eligibility in `FlagshipBoard.tsx`

```ts
export type SessionName = "ASIA" | "LONDON" | "NY";

export const SESSION_ELIGIBILITY: Record<string, SessionName[]> = {
  // FX (all sessions)
  EURUSD: ["ASIA", "LONDON", "NY"],
  // ... all FX

  // Crypto (all sessions)
  BTCUSD: ["ASIA", "LONDON", "NY"],
  ETHUSD: ["ASIA", "LONDON", "NY"],

  // Commodities
  XAUUSD: ["LONDON", "NY"],
  XAGUSD: ["LONDON", "NY"],
  WTIUSD: ["LONDON", "NY"],

  // Indices
  NIKKEIUSD: ["ASIA", "LONDON"],
  SPXUSD: ["NY"],
  NDXUSD: ["NY"],
};
```

---

## 4. Session Gating

### Sessions (UTC)
- `ASIA`: `00:00-08:00`
- `LONDON`: `08:00-13:00`
- `NY`: `13:00-21:00`

### Behavior
- Default selected session = current session by UTC clock
- Session tabs at top: `ASIA | LONDON | NY`
- Table only shows session-eligible pairs

### Eligibility rules (reuse existing logic)
- FX: all sessions
- Crypto: all sessions
- Commodities: LONDON + NY
- `NIKKEIUSD`: ASIA + LONDON
- `SPXUSD`, `NDXUSD`: NY only

---

## 5. Table Layout

## Columns
1. `Pair`
2. `Dealer`
3. `Commercial`
4. `Sentiment D`
5. `Overlay`
6. `Strength 1h`
7. `Gate` (`PASS` / `SKIP` / `NO_DATA`) as chip

No extra columns by default.

---

## 6. Cell Mapping Rules

All signal columns map to one of:
- `BULLISH`
- `BEARISH`
- `NEUTRAL`

### 6.1 Dealer
From `/api/performance/gated-setups` row:
- `LONG` => `BULLISH`
- `SHORT` => `BEARISH`
- else => `NEUTRAL`

### 6.2 Commercial
From `/api/performance/gated-setups` row:
- `LONG` => `BULLISH`
- `SHORT` => `BEARISH`
- else => `NEUTRAL`

### 6.3 Sentiment D (daily)
From daily lock (`sentiment_daily_snapshots` via `/api/flagship/sentiment-daily`):
- `LONG` => `BULLISH`
- `SHORT` => `BEARISH`
- `NEUTRAL` or missing row => `NEUTRAL`

### 6.4 Overlay
V1 rule: derive from `/api/performance/gated-setups` (already computed), not direct overlay API calls.

- Non-crypto:
  - `gateReasons` contains `MENTHORQ_GAMMA_PASS_ALIGNED` => `Overlay = direction` (`LONG` bullish / `SHORT` bearish)
  - `gateReasons` contains `MENTHORQ_GAMMA_SKIP_CONFLICT` => `Overlay = opposite(direction)`
  - `gateReasons` contains `MENTHORQ_GAMMA_NEUTRAL` or MenthorQ context missing => `Overlay = NEUTRAL`
- Crypto:
  - If `gateDecisionSource = CRYPTO_LIQUIDATION_LIVE` and directional liquidation reasons are available, map to bullish/bearish
  - Else fallback to `NEUTRAL` in v1

Notes:
- This keeps matrix v1 simple and consistent with current computed gate output.
- Direct overlay endpoint parsing can be added in v2 once MenthorQ coverage and crypto directional overlays are fully populated.

### 6.5 Strength 1h
Use 1h strength only (default, no window selector in v1).

For pair `BASEQUOTE`:
- Get base strength score and quote strength score
- `delta = base - quote`
- Threshold:
  - `delta >= +5` => `BULLISH`
  - `delta <= -5` => `BEARISH`
  - otherwise => `NEUTRAL`

For indices/commodities/crypto (vs USD):
- Use asset-vs-USD 1h strength
- positive => `BULLISH`, negative => `BEARISH`, near-zero/missing => `NEUTRAL`

Data source split:
- FX pairs: `/api/flagship/currency-strength` (8-major 1h scores; compute pair delta client-side)
- Indices/Crypto/Commodities: `/api/flagship/asset-strength` (1h class-specific scores)

---

## 7. Color/Visual System

### Cell styling
- Bullish: green background + green text
- Bearish: red background + red text
- Neutral: gray background + muted text

### Minimal text in cells
- Show short label only: `B`, `S`, `N` (or dot icon)
- Tooltip on hover can show raw source value/state

### Gate chip
- `PASS`: green chip
- `SKIP`: red chip
- `NO_DATA`: gray chip

---

## 8. Sorting

Default sort for visible session rows:
1. `Gate = PASS` first
2. Higher directional agreement count first (how many columns align same direction)
3. Tier (`HIGH` > `MEDIUM` > `NEUTRAL`)
4. Pair alpha

---

## 9. Data Freshness Rules (for display only)

- Dealer/Commercial: weekly
- Sentiment: daily
- Overlay: daily/intraday depending source
- Strength: 1h snapshot

If source row missing/stale, show `NEUTRAL` cell (gray). Do not hide row.

If a pair is missing from `/api/performance/gated-setups` for the current week:
- `Dealer = NEUTRAL`
- `Commercial = NEUTRAL`
- `Gate = NO_DATA`
- `Overlay = NEUTRAL`
- Keep row visible in matrix (session permitting)

---

## 10. API Contract (UI Normalization Layer)

Add/derive a flat row shape for the matrix:

```ts
type MatrixRow = {
  pair: string;
  assetClass: "fx" | "indices" | "crypto" | "commodities";
  sessionEligible: ("ASIA" | "LONDON" | "NY")[];
  dealer: "BULLISH" | "BEARISH" | "NEUTRAL";
  commercial: "BULLISH" | "BEARISH" | "NEUTRAL";
  sentimentDaily: "BULLISH" | "BEARISH" | "NEUTRAL";
  overlay: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength1h: "BULLISH" | "BEARISH" | "NEUTRAL";
  gate: "PASS" | "SKIP" | "NO_DATA";
  tier: "HIGH" | "MEDIUM" | "NEUTRAL";
};
```

UI should consume this normalized shape only.

## 10.1 Data Source Mapping (explicit)

Primary:
- `/api/performance/gated-setups`
  - `pair`, `assetClass`, `dealer`, `commercial`, `direction`, `tier`, `gateDecision`, `gateReasons`, `gateDecisionSource`

Supplements:
- `/api/flagship/sentiment-daily`
  - `symbol -> sentimentDirection`
- `/api/flagship/currency-strength`
  - `currency -> normalized (window=1h)`
- `/api/flagship/asset-strength`
  - `asset -> normalized (window=1h)` for crypto/commodities (+ indices if supported)
- `/api/flagship/menthorq-overlay`
  - Optional diagnostics only in v1 (not required for rendering Overlay column)

---

## 11. Acceptance Criteria

1. `/flagship` default view is one table only (no accordion/expand sections).
2. Exactly 36-pair universe is represented.
3. Session tabs filter visible rows to session-eligible pairs only.
4. Each row shows 5 directional data columns with green/red/gray mapping.
5. Minimal wording; at-a-glance readability on desktop and mobile.
6. No regression to existing gated decision source logic.
7. Missing pair rows from gated-setups are rendered with `NEUTRAL/NO_DATA` defaults, not dropped.

---

## 12. Claude Review Questions

1. Is the 5-column directional model sufficient for decision speed with no Bias column?
2. Are strength thresholds (`+/-5`) reasonable for v1, or should thresholds be asset-class-specific?
3. Should crypto overlay in this matrix be pure liquidation direction or agreement-vs-weekly-bias direction?
4. Do we keep indices in matrix even though execution venue currently excludes indices?
