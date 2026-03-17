# Codex Prompt — Wire OANDA Candles into Session-PnL Mode

## Objective
Replace the `WEEKLY_ESTIMATE` fallback (weekly return / 5) for non-crypto pairs in `session-pnl` mode with real intraday returns from OANDA H1 candles. After this change, `--mode=session-pnl` produces actual session-window P&L for ALL asset classes, not just crypto.

## Context
- The project is a Next.js app at `C:/Users/User/Documents/GitHub/limni-website`
- The backtest script is at `scripts/backtest-session-top-pick.ts`
- OANDA candle fetching already exists at `src/lib/oandaPrices.ts`:
  - `fetchOandaCandleSeries(symbol, fromUtc, toUtc)` — returns `OandaHourlyCandle[]` (H1 candles with `{ts, open, close}`)
  - `getOandaInstrument(symbol)` — maps pair names to OANDA instrument IDs (e.g. `EURUSD` → `EUR_USD`, `XAUUSD` → `XAU_USD`, `SPXUSD` → `SPX500_USD`, `NIKKEIUSD` → `JP225_USD`)
  - Has retry logic (3 attempts, 400ms backoff), pagination (4000 bars/request)
  - Requires `OANDA_API_KEY` and `OANDA_ACCOUNT_ID` env vars (already loaded via `loadEnvConfig`)
- Crypto pairs (BTCUSD, ETHUSD) already use Bitget API candles via `fetchCryptoSessionPnlPct()` — do NOT change this
- Session windows: Asia 0-8 UTC (8h), London 8-13 UTC (5h), NY 13-21 UTC (8h)
- The `daily-7pm` variant enters at 23:00 UTC. For session-pnl, use exit at next day 21:00 UTC (end of NY) = ~22h hold capturing a full trading day

## File to modify: `scripts/backtest-session-top-pick.ts`

### Change 1: Add OANDA imports

Add at the top with other imports:
```typescript
import { fetchOandaCandleSeries, type OandaHourlyCandle } from "../src/lib/oandaPrices";
```

### Change 2: Add `OANDA_SESSION` to PnlSource type

Update the type (line ~42):
```typescript
type PnlSource = "WEEKLY_ATTR" | "BITGET_SESSION" | "OANDA_SESSION" | "WEEKLY_ESTIMATE";
```

### Change 3: Create `fetchOandaSessionPnlPct()` function

Add a new function near `fetchCryptoSessionPnlPct()` (around line 648):

```typescript
async function fetchOandaSessionPnlPct(
  pair: string,
  direction: TradeDirection,
  sessionStart: DateTime,
  sessionEnd: DateTime,
): Promise<number | null> {
  try {
    const candles = await fetchOandaCandleSeries(pair, sessionStart, sessionEnd);
    if (candles.length < 1) return null;
    const sorted = [...candles].sort((a, b) => a.ts - b.ts);
    const openPrice = sorted[0].open;
    const closePrice = sorted[sorted.length - 1].close;
    if (!(openPrice > 0)) return null;
    const basePct = ((closePrice - openPrice) / openPrice) * 100;
    return direction === "LONG" ? basePct : -basePct;
  } catch {
    return null;
  }
}
```

### Change 4: Update `computePickPnl()` to use OANDA for non-crypto

Replace the non-crypto fallback block in `computePickPnl()`. Current code (around line 693):
```typescript
const fallback = { pnlPct: signal.tradePnlPct === null ? null : signal.tradePnlPct / 5, pnlSource: "WEEKLY_ESTIMATE" as PnlSource };
sessionPnlCache.set(cacheKey, fallback);
return fallback;
```

Replace with:
```typescript
const oandaPnl = await fetchOandaSessionPnlPct(signal.pair, signal.direction as TradeDirection, sessionStart, sessionEnd);
if (oandaPnl !== null) {
  const result = { pnlPct: oandaPnl, pnlSource: "OANDA_SESSION" as PnlSource };
  sessionPnlCache.set(cacheKey, result);
  return result;
}
const fallback = { pnlPct: signal.tradePnlPct === null ? null : signal.tradePnlPct / 5, pnlSource: "WEEKLY_ESTIMATE" as PnlSource };
sessionPnlCache.set(cacheKey, fallback);
return fallback;
```

Also update the crypto fallback path (when `fetchCryptoSessionPnlPct` returns null) to try OANDA before `WEEKLY_ESTIMATE`:
```typescript
if (signal.assetClass === "crypto") {
  const sessionPnl = await fetchCryptoSessionPnlPct(signal.pair, signal.direction as TradeDirection, sessionStart, sessionEnd);
  if (sessionPnl !== null) {
    const result = { pnlPct: sessionPnl, pnlSource: "BITGET_SESSION" as PnlSource };
    sessionPnlCache.set(cacheKey, result);
    return result;
  }
  // Bitget failed — try OANDA as secondary source for crypto
  const oandaFallback = await fetchOandaSessionPnlPct(signal.pair, signal.direction as TradeDirection, sessionStart, sessionEnd);
  if (oandaFallback !== null) {
    const result = { pnlPct: oandaFallback, pnlSource: "OANDA_SESSION" as PnlSource };
    sessionPnlCache.set(cacheKey, result);
    return result;
  }
  const fallback = { pnlPct: signal.tradePnlPct === null ? null : signal.tradePnlPct / 5, pnlSource: "WEEKLY_ESTIMATE" as PnlSource };
  sessionPnlCache.set(cacheKey, fallback);
  return fallback;
}
```

### Change 5: Add rate limiting delay for OANDA calls

OANDA live allows 100 req/s, but we're making many calls across 8 weeks × 5 days × 3 sessions × multiple pairs. Add a small delay between OANDA calls to avoid hitting rate limits.

In `fetchOandaSessionPnlPct()`, add a 100ms delay before the API call:
```typescript
async function fetchOandaSessionPnlPct(
  pair: string,
  direction: TradeDirection,
  sessionStart: DateTime,
  sessionEnd: DateTime,
): Promise<number | null> {
  try {
    // Rate limit: 100ms between OANDA candle requests
    await new Promise((resolve) => setTimeout(resolve, 100));
    const candles = await fetchOandaCandleSeries(pair, sessionStart, sessionEnd);
    // ... rest unchanged
```

### Change 6: Update daily-7pm session window for session-pnl

In the `daily-7pm` variant block (around line 777-778), the session window is currently `23:00 → 00:00` (1 hour). For `session-pnl` mode, this needs to extend to capture a full trading day:

```typescript
const sessionStart = day.set({ hour: 23, minute: 0, second: 0, millisecond: 0 });
const sessionEnd = config.mode === "session-pnl"
  ? day.plus({ days: 1 }).set({ hour: 21, minute: 0, second: 0, millisecond: 0 })
  : day.plus({ days: 1 }).startOf("day");
```

This means daily-7pm in session-pnl mode measures: entry at 23:00 UTC (7pm ET), exit at next day 21:00 UTC (end of NY session) = ~22h hold.

### Change 7: Update console output and notes

Add a PnL source breakdown to the console output, after the "By Asset Class" table:

```typescript
if (config.mode === "session-pnl") {
  const sourceCounts = new Map<string, number>();
  for (const row of sessionRows) {
    for (const pick of row.selected) {
      const count = sourceCounts.get(pick.pnlSource) ?? 0;
      sourceCounts.set(pick.pnlSource, count + 1);
    }
  }
  console.log("\n--- PnL Source Breakdown ---");
  console.table(Array.from(sourceCounts.entries()).map(([source, count]) => ({ source, count })));
}
```

Update the notes array to reflect the new capability:
```typescript
notes: [
  "Mode weekly-attr attributes full-week pair return to first selected session trade in the week.",
  "Mode session-pnl computes session return from Bitget (crypto) or OANDA (FX/metals/indices) H1 candles.",
  "OANDA candles require OANDA_API_KEY and OANDA_ACCOUNT_ID env vars.",
  "If OANDA fetch fails, falls back to WEEKLY_ESTIMATE (weekly return / 5).",
  "daily-7pm in session-pnl mode: entry 23:00 UTC, exit next day 21:00 UTC (~22h hold).",
  "Pair lockout: once a pair is selected in any session, it is excluded from all subsequent sessions that week.",
  "daily-7pm variant: single pick per day at 23:00 UTC (7pm ET), no session eligibility filter.",
]
```

### Change 8: Update diagnostics for WEEKLY_ESTIMATE tracking

The existing diagnostics already track `WEEKLY_ESTIMATE` usage (lines 892-894, 1016-1018). No change needed — this will now only fire for pairs where BOTH the primary source (Bitget/OANDA) AND the fallback fail, which should be rare.

## Testing

After implementing, run:
```bash
npx tsx scripts/backtest-session-top-pick.ts --weeks=2 --mode=session-pnl --variant=daily-7pm
```

Verify:
1. Script completes without errors
2. PnL source breakdown shows `OANDA_SESSION` and/or `BITGET_SESSION` (not all `WEEKLY_ESTIMATE`)
3. Session PnL values differ from weekly-attr values (confirming real intraday data is being used)
4. No OANDA rate limit errors (429 responses)

Then run the full comparison:
```bash
npx tsx scripts/backtest-session-top-pick.ts --weeks=8 --mode=session-pnl --variant=session
npx tsx scripts/backtest-session-top-pick.ts --weeks=8 --mode=session-pnl --variant=daily-7pm
```

## Do NOT
- Do not modify `src/lib/oandaPrices.ts` — use it as-is
- Do not modify any other files except `scripts/backtest-session-top-pick.ts`
- Do not add npm dependencies
- Do not create README or documentation files
- Do not change the COT gate logic, scoring formula, or overlay evaluation
- Do not change session eligibility rules or pair lockout logic
- Do not change `weekly-attr` mode behavior — all changes are gated behind `mode === "session-pnl"`
- Do not remove or modify `fetchCryptoSessionPnlPct()` — OANDA is a fallback for crypto, Bitget remains primary
