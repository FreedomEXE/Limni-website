# Crypto Matrix Board — Phase 1 Implementation Spec

> Status: IMPLEMENTATION SPEC — Ready for Codex
> Author: Nyx
> Date: 2026-03-20
> Prerequisite: Read `CRYPTO_MATRIX_BOARD_DESIGN.md` for strategic context

---

## 1. Scope

### Phase 1 Includes

- Navigation rename + new route for crypto board
- Crypto board UI component with session tabs, table layout, expandable rows
- BTC/ETH regime header (real, computed from multi-timeframe price data)
- Alt universe table with rank, direction, and context columns (real data)
- Trigger column (scaffolded — displays "TBD" with UI in place)
- Sizing column (scaffolded — displays "TBD" with UI in place)
- New API route: `/api/flagship/crypto-matrix`
- Alt universe definition in code (static Phase 1 list derived from rankings)

### Phase 1 Excludes

- Live trigger scanner / real-time Stoch+RSI computation
- Engulfing candle detection
- 4H swing target computation
- Handshake logic on the board
- Position sizing model
- Automated alt ranking script (universe is manually curated for Phase 1)
- Telegram/desktop notifications
- Bot integration (this board is manual trading only)
- Liquidation cluster display
- Any new database tables (use existing tables + API computation)

---

## 2. Navigation & Page Structure

### 2.1 Left Nav Changes

**Current state** (`DashboardLayout.tsx`):
```
Matrix (top-level, key: "flagship", href: "/flagship")
  └── Board (sub-nav, href: "/flagship")
```

**Target state:**
```
Matrix (top-level, key: "flagship", href: "/flagship")
  ├── CFD Matrix (sub-nav, href: "/flagship")
  └── Crypto Matrix (sub-nav, href: "/flagship/crypto")
```

**Implementation:**
- In `DashboardLayout.tsx`, find the flagship sub-nav array (currently `[{ href: "/flagship", label: "Board" }]`)
- Replace with: `[{ href: "/flagship", label: "CFD Matrix" }, { href: "/flagship/crypto", label: "Crypto Matrix" }]`
- The top-level "Matrix" label and `href: "/flagship"` remain unchanged

### 2.2 Route Structure

| Route | Component | Purpose |
|-------|-----------|---------|
| `/flagship` | `FlagshipBoard` (existing, unchanged) | CFD matrix — no changes |
| `/flagship/crypto` | `CryptoBoard` (new) | Crypto matrix — Phase 1 |

**New file:** `src/app/flagship/crypto/page.tsx`
```
- Wraps CryptoBoard in DashboardLayout (same pattern as flagship/page.tsx)
- dynamic = "force-dynamic"
```

### 2.3 Shared vs Separate Components

| Artifact | Decision | Rationale |
|----------|----------|-----------|
| `DashboardLayout` | SHARED | Same page shell, nav, sidebar |
| `sessionConfig.ts` | SHARED | Same session windows, same utility functions |
| `FlagshipBoard.tsx` | NOT SHARED | CFD board is 724 lines of tightly coupled CFD logic. Do not abstract. |
| `CryptoBoard.tsx` | NEW | Clean component. Can borrow visual patterns (CSS classes, chip styles) from FlagshipBoard but should not import from it. |
| Color/chip utility functions | EXTRACT if needed | `stateClass()`, `biasChipClass()`, `rowHighlightClass()` etc. are generic. If CryptoBoard needs them, extract to a shared `src/lib/flagship/matrixStyles.ts`. Otherwise inline. |
| Types | SEPARATE | `CryptoMatrixRow` is a different shape than `MatrixRow`. Define in CryptoBoard or a co-located types file. |

---

## 3. Crypto Board Layout

### 3.1 Header

Mirrors CFD board header structure:
- Title: "Crypto Matrix" (replaces "Live Session Matrix")
- Subtitle: Strategy label (optional, can be "manual_v1" or similar)
- Data timestamp + active session indicator (same as CFD)
- Refresh button (same pattern)

**BTC/ETH Regime Banner** — NEW, placed between header and session tabs:

```
┌──────────────────────────────────────────────────────┐
│  BTC: LONG (HIGH)  ▲    │    ETH: LONG (MEDIUM)  ▲  │
│  4H: ▲  1H: ▲  15m: ▲  │    4H: ▲  1H: ▲  15m: —  │
└──────────────────────────────────────────────────────┘
```

This is a 2-cell row above the session tabs showing:
- BTC direction + confidence tier + per-timeframe vote breakdown
- ETH direction + confidence tier + per-timeframe vote breakdown

Color-coded: green border if LONG, red if SHORT, slate if NEUTRAL. Same chip styles as CFD board.

### 3.2 Session Tabs

Same 3-tab layout: ASIA / LONDON / NY. Same `selectedSession` state. Same `sessionWindowLabelEt()` display.

**What changes between tabs on the crypto board:** Nothing about pair eligibility (all crypto pairs are eligible for all sessions per `sessionConfig.ts`). But the board still shows session context because:
1. Freedom operates on a session schedule
2. The trigger scanner (Phase 2) will group signals by session
3. Regime computation can optionally use session-specific timeframes later

For Phase 1: All rows appear in all tabs. The tab controls which session is highlighted in the header.

### 3.3 Table Structure

**Proposed columns (refined from Freedom's instinct):**

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                    │        Direction         │     Context     │  Trig │ Size │
│ Coin               │ Bias │ BTC  │ ETH  │ Alt │ OI  │ Fund │ Str │       │      │
├────────────────────┼──────┼──────┼──────┼─────┼─────┼──────┼─────┼───────┼──────┤
│ #1 SOL    A  0.88  │ LONG │  B   │  B   │  B  │  ↑  │  +   │  B  │  TBD  │ TBD  │
│ #2 XRP    A  0.81  │ LONG │  B   │  B   │  B  │  —  │  +   │  N  │  TBD  │ TBD  │
│ #3 SUI    A  0.87  │ LONG │  B   │  B   │  B  │  ↑  │  −   │  B  │  TBD  │ TBD  │
│ ...                                                                            │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Column Definitions (Final)

Freedom's instinct: `Rank, Coin, Bias, BTC, ETH, Context, Trigger, Sizing`

**Refined to 9 visible columns in 4 groups:**

| Group | Column | Visible Label | Justification |
|-------|--------|---------------|---------------|
| **Coin** | Coin | "Coin" | Row identity. Shows: rank number, symbol, tier letter, correlation to BTC. All in one cell. No separate Rank column — rank IS the row order, and the number is inline. |
| **Direction** (4 cols) | Bias | "Bias" | Derived direction: LONG / SHORT / NEUTRAL. Color-coded chip. |
| | BTC | "BTC" | BTC's multi-TF vote mapped to this alt's direction. B/S/N chip. |
| | ETH | "ETH" | ETH's multi-TF vote mapped to this alt's direction. B/S/N chip. |
| | Alt | "Alt" | Alt's own 4H structure trend. B/S/N chip. |
| **Context** (3 cols) | OI | "OI" | 24h OI delta direction. Glyph: ↑/↓/—. |
| | Funding | "Fund" | Current funding rate. Glyph: +/−/~. |
| | Strength | "Str" | Asset strength (from existing `asset-strength` API). B/S/N chip. Same as CFD board's strength column. |
| **Trigger** (1 col) | Trigger | "Trigger" | Phase 1: "TBD" placeholder. Phase 2: Stoch+RSI state. |
| **Sizing** (1 col) | Sizing | "Sizing" | Phase 1: "TBD" placeholder. Phase 2: ATR-based lot size. |

**Why this refinement works:**

1. **Rank is not a separate column.** It's wasted horizontal space. The rank number + tier + correlation appear inside the Coin cell. Rows are pre-sorted by rank. This matches Freedom's instinct while saving a column.

2. **BTC and ETH are separate columns instead of one merged "BTC/ETH" column.** They can disagree. When BTC says LONG but ETH says NEUTRAL, Freedom needs to see that divergence — it changes conviction. The regime banner shows the raw BTC/ETH bias; these columns show how it maps to THIS alt.

3. **Alt column added.** The alt's own 4H trend is a third directional input. This is the crypto equivalent of "sentiment" on the CFD board — it provides a tie-breaker when BTC and ETH diverge. Without it, the Bias column has only two inputs, which makes majority voting binary (agree/disagree) with no resolution.

4. **Context is 3 sub-columns** (OI, Funding, Strength) rather than one merged "Context" cell. CFD board has `Context | Overlay | Strength` in its context group. Crypto replaces Overlay (Menthorq gamma, not applicable) with OI and Funding. These are compact glyphs, not chips — minimal visual weight.

5. **Trigger and Sizing are scaffolded as single columns.** No point splitting "Trigger" into sub-columns until we know what the trigger logic looks like post-validation.

### 3.5 Two-Row Header

Match the CFD board's two-row header pattern:

```
Row 1: | Coin | ——— Direction ——— | —— Context —— | Trig | Size |
Row 2: |      | Bias | BTC | ETH | Alt | OI | Fund | Str |      |      |
```

Use same `colSpan` / group coloring as CFD board:
- Direction group: slate tint (same as CFD "Core Bias")
- Context group: amber tint (same as CFD "Context")
- Trigger: sky tint
- Sizing: emerald tint

### 3.6 Expandable Detail Row

On row click, expand to show (same pattern as CFD board's `isExpanded` logic):

**Card 1: Direction Stack**
- BTC vote: 4H ▲, 1H ▲, 15m — → LONG (HIGH)
- ETH vote: 4H ▲, 1H —, 15m — → LONG (MEDIUM)
- Alt 4H structure: BULLISH
- Correlation to BTC: 0.881
- Composite rank score: 86.68

**Card 2: Context Detail**
- OI 24h delta: +$12.3M (+4.2%)
- Funding rate: 0.000019 (neutral)
- Asset strength (1h): 62.4 (normalized)
- Asset strength (4h): 58.1
- Asset strength (24h): 55.7

**Card 3: Trigger (Scaffolded)**
- Status: "Awaiting validation"
- Note: "Stoch+RSI not yet validated on crypto timeframes"
- Phase 2: Will show Stoch+RSI values, qualifying timeframe, engulfing state

---

## 4. Column Logic

### 4.1 Coin Cell

| Property | Value |
|----------|-------|
| Source | Static `CRYPTO_UNIVERSE` array (defined in code) |
| Calculation | Display: `#{rank} {symbol}` with tier badge and correlation number |
| Update frequency | Static per deployment. Universe refreshed manually (see §6). |
| Classification | **Core, locked** |

### 4.2 Bias

| Property | Value |
|----------|-------|
| Source | Derived from BTC vote + ETH vote + Alt structure |
| Calculation | Majority vote of 3 directional inputs (same `deriveBias()` pattern as CFD). 2/3 BULLISH → LONG, 2/3 BEARISH → SHORT, else NEUTRAL. |
| Update frequency | On every board refresh (inherits from input frequencies) |
| Classification | **Core, locked** |

**Detailed bias derivation:**

```
btcVote = mapBtcRegimeToAltDirection(btcRegime, alt.correlation)
ethVote = mapEthRegimeToAltDirection(ethRegime, alt.correlation)
altVote = computeAlt4hTrend(alt.symbol)

bias = majorityVote(btcVote, ethVote, altVote)
```

- `mapBtcRegimeToAltDirection`: If correlation ≥ 0.75, alt inherits BTC direction directly. If 0.50–0.75, alt inherits only if BTC tier is HIGH. Below 0.50 → already excluded from universe.
- Same logic for ETH but using ETH correlation (which we don't currently track separately — see §7 data dependencies). Phase 1 simplification: use BTC correlation as proxy for ETH correlation (they're highly correlated themselves).

### 4.3 BTC Column

| Property | Value |
|----------|-------|
| Source | BTC multi-timeframe trend (4H, 1H, 15m close vs open) via Bitget USDT-FUTURES candles |
| Calculation | 3-vote model adapted from `bitgetBotSignals.ts` `classifyWeeklyBias()` but applied to price action instead of COT. For each timeframe: if close > open of last N candles → BULLISH vote, else BEARISH. Majority of 3 TFs → direction + tier. |
| Update frequency | Hourly (on 1H candle close). 4H updates every 4 hours. 15m updates every 15 min. API caches result, board polls. |
| Classification | **Core, provisional** — the multi-TF vote model is reasonable but not backtested for accuracy. |

**Concrete implementation:**

```
For each timeframe (4H, 1H, 15m):
  Fetch last 2 completed candles from Bitget (BTCUSDT USDT-FUTURES)
  Use fetchBitgetCandleSeries() with appropriate granularity:
    4H → "14400", 1H → "3600", 15m → "900"
  If latest candle close > latest candle open → BULLISH
  Else → BEARISH

votes = [vote4H, vote1H, vote15m]
direction = majority(votes)
tier = unanimous ? "HIGH" : "MEDIUM"
If all NEUTRAL or mixed with no majority → NEUTRAL
```

This is deliberately simple. It's a starting point — not a proven model. The board should display this with a "provisional" visual cue until BTC direction accuracy is backtested (P1 backtest blocker in §8).

### 4.4 ETH Column

| Property | Value |
|----------|-------|
| Source | Same model as BTC, applied to ETHUSDT on Bitget |
| Calculation | Identical 3-TF vote |
| Update frequency | Same as BTC |
| Classification | **Core, provisional** |

### 4.5 Alt Column

| Property | Value |
|----------|-------|
| Source | Alt's own 4H candle data from Bitget (e.g. SOLUSDT, XRPUSDT USDT-FUTURES) |
| Calculation | Simple trend: last completed 4H candle close vs open. BULLISH if close > open by more than 0.1% of open, BEARISH if close < open by more than 0.1%, else NEUTRAL. |
| Update frequency | Every 4 hours (on 4H candle close) |
| Classification | **Core, provisional** — single-candle trend is noisy. May evolve to multi-candle EMA or ADX in Phase 2. |

**Why a simple single-candle check:** We need *something* for the third directional vote. A simple check is honest about what we know. A complex model would imply false precision before backtesting. The expanded detail row will show the actual OHLC so Freedom can override mentally.

### 4.6 OI Column

| Property | Value |
|----------|-------|
| Source | `market_oi_snapshots` table (existing, populated by bot infrastructure) |
| Calculation | Latest snapshot vs 24h-ago snapshot. If delta > +5% → ↑, if delta < -5% → ↓, else → —. |
| Update frequency | Matches bot's OI snapshot cadence (currently every 4 hours) |
| Classification | **Contextual, locked** — proven not useful as gate, useful as information |

**Current limitation:** `market_oi_snapshots` only collects BTC and ETH. For alt OI, we need to either:
- Expand the bot's OI collection to include universe alts (Phase 2)
- Show OI only for BTC/ETH rows, "—" for alts (Phase 1)

**Phase 1 decision:** Show BTC/ETH OI from existing data. Show "—" for alts. Do not build new OI collection infrastructure yet.

### 4.7 Funding Column

| Property | Value |
|----------|-------|
| Source | `market_funding_snapshots` table (existing) |
| Calculation | Latest funding rate. If rate > 0.01% → "+" (longs paying), if rate < -0.01% → "−" (shorts paying), else "~" (neutral). |
| Update frequency | Matches bot's funding snapshot cadence (every 8 hours, aligned with funding intervals) |
| Classification | **Contextual, locked** |

**Same limitation as OI:** Only BTC and ETH currently collected. Alts show "—" in Phase 1.

### 4.8 Strength Column

| Property | Value |
|----------|-------|
| Source | `/api/flagship/asset-strength` (existing API, already serves crypto asset strength) |
| Calculation | Normalized score from `asset_strength_snapshots`. Score ≥ 55 → BULLISH, ≤ 45 → BEARISH, else NEUTRAL. Same logic as CFD board lines 503-509 of `FlagshipBoard.tsx`. |
| Update frequency | Hourly (existing cron) |
| Classification | **Contextual, locked** — strength was proven not useful as a gate in FX backtest, but it's already computed and displayed on CFD board. Free data. |

**Coverage:** Asset strength is computed for BTC and ETH already (via OANDA crypto instruments on the CFD side). For alts beyond BTC/ETH, the existing strength pipeline likely doesn't cover them since it's OANDA-sourced. Phase 1: alts show "—" for strength. Phase 2 option: build a Bitget-sourced strength computation using relative performance vs BTC.

### 4.9 Trigger Column

| Property | Value |
|----------|-------|
| Source | None (scaffolded) |
| Calculation | Returns static "TBD" |
| Update frequency | N/A |
| Classification | **Scaffolded** — placeholder until Stoch+RSI is validated on crypto (P0 blocker) |

**Phase 1 display:** Gray chip with "TBD" text. Expanded detail row shows: "Stoch+RSI validation pending. See CRYPTO_MATRIX_BOARD_DESIGN.md §6 for blockers."

### 4.10 Sizing Column

| Property | Value |
|----------|-------|
| Source | None (scaffolded) |
| Calculation | Returns static "TBD" |
| Update frequency | N/A |
| Classification | **Scaffolded** — depends on FX position sizing research completing + crypto adaptation |

---

## 5. Session Handling

### Decision: Keep ASIA / LONDON / NY tabs

**Rationale:**
1. Freedom's workflow is session-based. He checks the board at session boundaries.
2. The CFD board uses the same tabs. Keeping them makes the crypto board feel like a sibling.
3. Phase 2 trigger scanner will group crypto signals by session (Freedom doesn't monitor 24/7).

### What Changes Between Tabs (Phase 1)

**Nothing changes in the row set.** All crypto alts appear in all sessions. This is honest — crypto trades 24/7.

**What DOES change:**
- The header's "Active session" indicator updates
- The session time window label updates (e.g., "8:00 PM – 3:00 AM ET" for ASIA)
- Phase 2: Trigger column will show session-specific trigger states

**Visual treatment:** When a session is off-hours, the tab shows dimmed. When the selected session is the active session, the header shows a green "Active" badge (same as CFD board).

### Why Not Remove Tabs

Removing tabs would make the crypto board feel like a different product. Freedom's workflow is session-oriented even for crypto. The tabs don't lie — they just don't filter rows. The header honestly shows which session is active, and the board shows everything.

If this feels weird in practice (showing all rows in all tabs with nothing changing), we can revisit. But starting with the familiar pattern is safer than inventing a new one.

---

## 6. Universe

### Phase 1 Universe

**BTC + ETH + 13 alts = 15 instruments total.**

Derived from `alt-pair-rankings.md` Tier A + top Tier B, cross-referenced with V3 backtest performance. Cut PENGU (negative PnL in V3 backtest, -$206). Cut PUMP (no V3 data, Tier B borderline). Cut ZEC (Tier B, no V3 data).

| # | Symbol | Tier | Score | Corr7d | Rationale |
|---|--------|------|-------|--------|-----------|
| — | BTC | Anchor | — | 1.000 | Regime anchor |
| — | ETH | Anchor | — | ~0.95 | Regime anchor |
| 1 | SOL | A | 86.68 | 0.881 | Top rank. V3: 100% WR on high-corr segment. |
| 2 | XRP | A | 70.82 | 0.809 | V3: 100% WR. Strong correlation. |
| 3 | SUI | A | 70.45 | 0.873 | V3: 100% WR. High correlation. |
| 4 | LINK | A | 60.90 | 0.863 | High correlation. V3 alt universe included. |
| 5 | DOGE | A | 59.84 | 0.769 | High volume. Mid-high correlation. |
| 6 | ADA | A | 59.38 | 0.798 | Good correlation. V3 alt universe included. |
| 7 | BNB | A | 57.91 | 0.860 | High correlation. Moderate volume. |
| 8 | PEPE | A | 56.24 | 0.713 | High volume. Lower correlation — watch for divergence. |
| 9 | UNI | A | 54.04 | 0.780 | Good correlation. Decent volume. |
| 10 | AVAX | B | 52.33 | 0.813 | High correlation. V3 included. |
| 11 | LTC | B | 48.56 | 0.814 | V3: 100% WR. High correlation. Classic alt. |
| 12 | NEAR | B | 47.35 | 0.714 | Mid correlation. In V3 alt universe. |
| 13 | HBAR | B | 45.61 | 0.817 | High correlation. Solid OI. |

### Universe Definition in Code

Create a static array in a new file `src/lib/flagship/cryptoUniverse.ts`:

```typescript
export type CryptoUniverseEntry = {
  symbol: string;         // e.g. "SOL" — base symbol
  bitgetSymbol: string;   // e.g. "SOLUSDT" — for Bitget USDT-FUTURES API calls
  tier: "ANCHOR" | "A" | "B";
  compositeScore: number;
  btcCorrelation7d: number;
  rank: number;           // 0 for anchors, 1-13 for alts
};

export const CRYPTO_UNIVERSE: CryptoUniverseEntry[] = [
  { symbol: "BTC", bitgetSymbol: "BTCUSDT", tier: "ANCHOR", compositeScore: 0, btcCorrelation7d: 1.0, rank: 0 },
  { symbol: "ETH", bitgetSymbol: "ETHUSDT", tier: "ANCHOR", compositeScore: 0, btcCorrelation7d: 0.95, rank: 0 },
  { symbol: "SOL", bitgetSymbol: "SOLUSDT", tier: "A", compositeScore: 86.68, btcCorrelation7d: 0.881, rank: 1 },
  { symbol: "XRP", bitgetSymbol: "XRPUSDT", tier: "A", compositeScore: 70.82, btcCorrelation7d: 0.809, rank: 2 },
  { symbol: "SUI", bitgetSymbol: "SUIUSDT", tier: "A", compositeScore: 70.45, btcCorrelation7d: 0.873, rank: 3 },
  // ... rest of universe (LINK, DOGE, ADA, BNB, PEPE, UNI, AVAX, LTC, NEAR, HBAR)
];
```

**Note on `bitget.ts` changes required:** The existing helper functions (`fetchBitgetCandleSeries`, `fetchBitgetFuturesSnapshot`, etc.) currently restrict `symbolBase` to `"BTC" | "ETH" | "SOL"`. For the crypto board, widen this parameter to `string` so any universe symbol can be passed. The Bitget API accepts any valid USDT-FUTURES symbol — no other code changes needed.

### Refresh Cadence

**Phase 1:** Static. Universe is hardcoded. To change it, update the array and redeploy. This is acceptable for Phase 1 because:
- The ranking script is manual (`npx tsx scripts/rank-alt-pairs.ts`)
- Universe changes are expected to be rare (weekly at most)
- Automating universe refresh adds complexity with no proven value yet

**Phase 2:** Universe stored in DB, refreshed weekly by cron job running the ranking script. Board reads from DB.

### Entry/Exit Rules

- **Entry:** New symbol enters if it reaches Tier A or top-half of Tier B AND has correlation ≥ 0.70 AND was included in a V3 backtest run with non-negative PnL. Manual review required.
- **Exit:** Symbol exits if it drops below Tier B OR correlation drops below 0.50 OR it was flagged in the V3 cut list (ASTER, PENGU). Manual review required.
- **Hard ceiling:** 15 total instruments (2 anchors + 13 alts). If a new entry pushes beyond 15, drop the lowest-ranked current member.

---

## 7. Data Dependencies

### Already Exists — No Changes Needed

| Data | Source | Used By |
|------|--------|---------|
| Asset strength (BTC, ETH) | `asset_strength_snapshots` table + `/api/flagship/asset-strength` | Strength column |
| OI snapshots (BTC, ETH) | `market_oi_snapshots` table | OI column |
| Funding snapshots (BTC, ETH) | `market_funding_snapshots` table | Funding column |
| Session config | `src/lib/flagship/sessionConfig.ts` | Session tabs |
| Bitget candle/ticker API | `src/lib/bitget.ts` (`fetchBitgetCandleSeries`, `fetchBitgetFuturesSnapshot`) | BTC/ETH/alt candle + market data fetching |

### Needs New API Route

| Route | Purpose | Implementation |
|-------|---------|----------------|
| `GET /api/flagship/crypto-matrix` | Single endpoint returning all crypto board data | New file: `src/app/api/flagship/crypto-matrix/route.ts`. Aggregates: (1) BTC regime, (2) ETH regime, (3) alt 4H trend for each universe symbol, (4) OI deltas, (5) funding rates, (6) asset strength. Returns typed payload for `CryptoBoard.tsx` to consume. |

**Why one aggregated endpoint instead of multiple:** The CFD board fetches 7 separate endpoints in parallel. That works because each endpoint already exists independently. For crypto, most of the data is new computation. One endpoint is simpler, reduces client-side coordination, and is easier to cache.

**Payload shape:**

```typescript
type CryptoMatrixPayload = {
  generatedUtc: string;
  btcRegime: {
    direction: "LONG" | "SHORT" | "NEUTRAL";
    tier: "HIGH" | "MEDIUM" | "NEUTRAL";
    votes: { tf4h: "BULLISH" | "BEARISH" | "NEUTRAL"; tf1h: ...; tf15m: ... };
  };
  ethRegime: { /* same shape */ };
  rows: Array<{
    symbol: string;
    rank: number;
    tier: "ANCHOR" | "A" | "B";
    compositeScore: number;
    btcCorrelation7d: number;
    bias: "LONG" | "SHORT" | "NEUTRAL";
    btcVote: "BULLISH" | "BEARISH" | "NEUTRAL";
    ethVote: "BULLISH" | "BEARISH" | "NEUTRAL";
    altTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
    altTrendDetail: { open4h: number; close4h: number; changePct: number } | null;
    oiDelta24hPct: number | null;   // null = no data
    fundingRate: number | null;      // null = no data
    strengthNormalized: number | null;
    strength1h: "BULLISH" | "BEARISH" | "NEUTRAL";
    trigger: "TBD";   // scaffolded
    sizing: "TBD";    // scaffolded
  }>;
};
```

### Needs New Computation (Inside API Route)

| Computation | Description | Data Source |
|-------------|-------------|-------------|
| BTC/ETH multi-TF regime | Fetch 4H, 1H, 15m candles for BTCUSDT and ETHUSDT from Bitget. Compute close-vs-open vote per TF. Majority vote → direction + tier. | Bitget REST API (`/api/v2/mix/market/candles`). Use existing `fetchBitgetCandleSeries()` from `src/lib/bitget.ts`. Widen the `symbolBase` type from `"BTC" \| "ETH" \| "SOL"` to `string` to support all universe symbols. 2 candles per TF per symbol = 12 candles total. Lightweight. |
| Alt 4H trend | Fetch last 2 completed 4H candles for each alt from Bitget. Compute close-vs-open trend. | Bitget REST API. Same `fetchBitgetCandleSeries()` with granularity param for 4H (`"14400"` in Bitget granularity format). 2 candles × 13 alts = 26 candles. Sequential with 50ms delay to respect rate limits. |
| OI 24h delta | Query `market_oi_snapshots` for latest and 24h-ago for BTC/ETH. Compute % change. | Existing DB table. Simple query. |
| Funding rate | Query `market_funding_snapshots` for latest BTC/ETH. | Existing DB table. Simple query. |
| Asset strength | Query existing asset strength API/function for crypto assets. | Existing `readAllLatestAssetStrengths("crypto")`. |

### Can Be Mocked / Scaffolded

| Data | Phase 1 Treatment |
|------|-------------------|
| Trigger state | Return `"TBD"` in payload. UI shows gray chip. |
| Sizing | Return `"TBD"` in payload. UI shows "—". |
| Alt OI | Return `null`. UI shows "—". |
| Alt funding | Return `null`. UI shows "—". |
| Alt strength for symbols without existing snapshots | Return `null`. UI shows "—". Asset strength is OANDA-sourced for FX — crypto alts may not be covered. Check during implementation. |

### Should Stay TBD Until Backtesting Confirms

| Data | Blocker |
|------|---------|
| Stoch+RSI values | P0: Indicator not validated on crypto |
| 4H swing target | P0: Fractals not validated on crypto |
| Handshake state | P2: Needs backtest proving it improves manual entry WR |
| Position sizing | Depends on FX sizing research completing first |

---

## 8. Backtest Blockers

### P0 — Blocks Column from Going Live

| Blocker | Severity | What It Blocks | Resolution Path |
|---------|----------|----------------|-----------------|
| **Stoch+RSI validation on crypto** | P0 | Trigger column cannot show real data | Write a validation script using Bitget candle data (BTCUSDT, SOLUSDT, XRPUSDT) across 4H/1H/15M. Compare against TradingView. If values match within ±1.0, indicator is valid for crypto. Est: 1-2 days. |
| **4H swing fractal on crypto** | P0 | Swing target display (future), also informs trigger confidence | Run fractal detection on 8 weeks of BTC/SOL/XRP 4H data from Bitget. Measure: (a) average target distance, (b) hit rate within 1 week. If targets are unreasonably far (>5%) or hit rate < 50%, the exit model needs crypto-specific adjustment. Est: 1-2 days. |
| **BTC direction accuracy** | P1 | Bias column accuracy is unproven | Backtest the 3-TF vote model against 6+ months of BTC weekly returns. If accuracy < 55%, the direction model needs rethinking. Est: 3-4 days. This does NOT block Phase 1 UI — column ships as "provisional" with a visual cue. |
| **Regime diversity** | P1 | All crypto backtests were SHORT/HIGH bias weeks | Cannot be backtested retroactively. Requires waiting for LONG/NEUTRAL market conditions. Forward test only. Does not block Phase 1 UI — but must be flagged in documentation. |

### Does NOT Block Phase 1 UI

All four blockers above allow Phase 1 to ship because:
- Trigger column is scaffolded ("TBD"), not showing real indicator data
- Bias column is labeled "provisional" and computes from real price data (just unproven model)
- Swing target is not displayed in Phase 1
- The board is for manual decision-making — Freedom applies judgment on top of the data

**What WOULD block Phase 1:** If Bitget API becomes unavailable or rate-limited during peak usage. The Bitget public REST API has generous rate limits for market data endpoints — this is low risk. All 15 universe symbols are confirmed available on Bitget USDT-FUTURES (sourced from `alt-pair-rankings.md` which ran against Bitget).

---

## 9. Recommended Build Sequence

Step-by-step for Codex. Each step is independently testable.

### Step 1: Navigation + Route Shell
- Rename "Board" → "CFD Matrix" in `DashboardLayout.tsx` sub-nav
- Add "Crypto Matrix" sub-nav item pointing to `/flagship/crypto`
- Create `src/app/flagship/crypto/page.tsx` with DashboardLayout wrapper + empty placeholder
- Verify: both routes load, nav highlights correctly

### Step 2: Universe Definition
- Create `src/lib/flagship/cryptoUniverse.ts` with static `CRYPTO_UNIVERSE` array (15 entries)
- Export types: `CryptoUniverseEntry`
- Verify: file imports cleanly, types compile

### Step 3: Shared Style Utilities (Optional)
- If CryptoBoard will reuse `stateClass()`, `biasChipClass()`, `rowHighlightClass()`, etc.:
  - Extract to `src/lib/flagship/matrixStyles.ts`
  - Update `FlagshipBoard.tsx` to import from shared file
  - Verify: CFD board still renders identically

### Step 4: API Route — `/api/flagship/crypto-matrix`
- Create `src/app/api/flagship/crypto-matrix/route.ts`
- Widen `bitget.ts` helper types: change `symbolBase: "BTC" | "ETH" | "SOL"` to `symbolBase: string` on `fetchBitgetCandleSeries`, `fetchBitgetFuturesSnapshot`, and related functions
- Add 4H and 15m granularity support to `fetchBitgetSeries` (currently only supports `"H1"` and `"M1"` — add `"H4"` mapping to Bitget granularity `"14400"` and `"M15"` mapping to `"900"`)
- Implement in this order:
  1. BTC regime computation (fetch Bitget candles for 4H/1H/15m, 3-TF vote)
  2. ETH regime computation (same logic)
  3. Alt 4H trend for each universe symbol (fetch Bitget 4H candles)
  4. OI delta from existing DB (`market_oi_snapshots`)
  5. Funding rate from existing DB (`market_funding_snapshots`)
  6. Asset strength from existing function (`readAllLatestAssetStrengths`)
  7. Assemble `CryptoMatrixPayload`
- On Bitget API errors for any symbol: return null fields for that row, don't fail the whole endpoint
- Verify: API returns valid JSON with all 15 rows

### Step 5: CryptoBoard Component — Layout + Static Structure
- Create `src/components/flagship/CryptoBoard.tsx`
- Implement:
  1. Header (title, timestamp, refresh button)
  2. BTC/ETH regime banner
  3. Session tabs (same pattern as CFD)
  4. Table with two-row header
  5. Empty rows from universe (no data yet)
- Verify: page renders with correct structure, no data

### Step 6: CryptoBoard — Wire Data
- Fetch from `/api/flagship/crypto-matrix` on mount + refresh
- Map payload to table rows
- Implement all column renderers:
  - Coin cell (rank, symbol, tier, correlation)
  - Direction group (Bias, BTC, ETH, Alt) — colored chips
  - Context group (OI glyph, Funding glyph, Strength chip)
  - Trigger ("TBD" placeholder)
  - Sizing ("TBD" placeholder)
- Implement row sorting (by rank)
- Verify: board shows real data for all real columns, "TBD" / "—" for scaffolded ones

### Step 7: Expandable Detail Rows
- Implement expand/collapse (same toggle pattern as CFD board)
- 3-card detail layout:
  - Direction stack detail
  - Context detail
  - Trigger scaffold note
- Verify: expand/collapse works, detail cards show correct data

### Step 8: Polish + Edge Cases
- Loading state
- Error handling (API failure)
- Empty state (if API returns no rows)
- Responsive behavior (mobile-friendly table scroll)
- Dark mode verification (using existing CSS variables)
- Verify: board handles all states gracefully

---

## 10. Final Recommendation

### Build Immediately (Phase 1)

| Component | Status |
|-----------|--------|
| Navigation rename + crypto route | Ready |
| Universe definition (static 15 symbols) | Ready |
| `/api/flagship/crypto-matrix` endpoint | Ready — uses existing Bitget API + DB infrastructure |
| CryptoBoard component with full layout | Ready |
| BTC/ETH regime (3-TF vote) | Ready — real computation, provisional model |
| Alt 4H trend | Ready — simple computation |
| OI delta (BTC/ETH only) | Ready — existing data |
| Funding rate (BTC/ETH only) | Ready — existing data |
| Asset strength | Ready — existing API |

### Scaffold as TBD

| Component | Why Scaffold |
|-----------|-------------|
| Trigger column | Stoch+RSI not validated on crypto. P0 blocker. Show "TBD" with explanation in detail row. |
| Sizing column | Depends on FX position sizing research + crypto adaptation. Show "TBD". |
| Alt OI / Funding | Bot only collects BTC/ETH. Expanding collection is Phase 2 infra work. Show "—" for alts. |

### Defer to Phase 2

| Component | Dependency |
|-----------|-----------|
| Live trigger scanner | Needs Stoch+RSI validation (P0) + engulfing detection + scanner infrastructure |
| 4H swing target display | Needs fractal validation on crypto (P0) |
| Handshake as trigger enhancement | Needs dedicated backtest |
| Dynamic universe from DB | Needs automated ranking pipeline |
| Alt OI/funding collection | Needs bot infrastructure expansion |
| Position sizing model | Needs FX research to complete first, then crypto adaptation |
| Telegram alerts | Needs live scanner (Phase 2) |

### Estimated Build Time

Phase 1 (Steps 1-8): **3-5 days for Codex**, assuming:
- All 15 symbols available on Bitget USDT-FUTURES (confirmed — all from `alt-pair-rankings.md`)
- No new database tables needed
- Existing `bitget.ts` helpers need minor type widening + granularity additions (small lift)
- Existing asset strength infrastructure covers BTC/ETH (alts may show "—")
