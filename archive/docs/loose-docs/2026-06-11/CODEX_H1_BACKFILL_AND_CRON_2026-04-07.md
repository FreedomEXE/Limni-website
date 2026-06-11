# CODEX: H1 Bar Backfill + Continuous Ingestion

**Date:** 2026-04-07
**Blocked by:** Path engine verification failed — missing H1 bars in `canonical_price_bars` for most OANDA symbols
**Goal:** Fill the H1 gap for the 10-week research window, add H1 to the canonical-refresh cron so it stays current, then re-verify the path engine.

---

## Root Cause

The canonical-refresh cron at `src/app/api/cron/canonical-refresh/route.ts` only writes `1d` bars (line 164). It never fetches or stores H1 bars.

The backfill script at `scripts/backfill-canonical-price-layer.ts` has full H1 ingestion logic for both OANDA and Bitget (lines 519-560 for OANDA, lines 608-652 for Bitget), but it's a manual script. Whatever H1 data exists was from a previous manual run.

Result: 34 out of 360 position legs in the Dealer Raw path verification had **zero** H1 bars. Major FX pairs like EURUSD, GBPUSD, USDJPY are affected. The path engine returns +101.02% vs the weekly-close engine's +96.51% — the drift is caused by missing data, not engine math.

---

## What This Prompt Delivers

1. **Backfill**: Run the existing backfill script with `--hourly` for the 10-week research window
2. **Cron upgrade**: Add H1 ingestion to the canonical-refresh cron
3. **Re-verify**: Run the path engine verification again after H1 data is filled

---

## Step 1: Run the Existing Backfill Script

The backfill script already supports H1 ingestion. Run it with appropriate flags.

**The research window is the last 10 realized weeks.** The earliest week is approximately `2026-01-19` (Sunday open). Add a buffer: start from `2026-01-17` to ensure full coverage.

```bash
npx tsx scripts/backfill-canonical-price-layer.ts --hourly --from=2026-01-17 --to=2026-04-07
```

This will:
- Fetch H1 bars from OANDA for all FX, indices, and commodities instruments
- Fetch H1 bars from Bitget for all crypto instruments
- Upsert into `canonical_price_bars` with `timeframe='1h'`
- Also upsert into `raw_price_bars` (the backfill script writes both)

**Rate limiting:** The script already has `await sleep(100)` between instruments (line 559, 602). OANDA's rate limit is generous for historical data. This should complete without throttling issues.

**Expected output:** ~36 instruments × ~10 weeks × ~120 H1 bars per week ≈ ~43,000 H1 bar upserts.

**After this completes, verify bar counts:**

```sql
SELECT symbol, COUNT(*) as bar_count
FROM canonical_price_bars
WHERE timeframe = '1h'
  AND bar_open_utc >= '2026-01-17T00:00:00Z'
  AND bar_open_utc < '2026-04-07T00:00:00Z'
GROUP BY symbol
ORDER BY bar_count ASC;
```

Every active instrument should have bars. FX pairs should have ~120 bars per trading week × 10 weeks ≈ ~1,200 bars. Crypto should have more (~168 per week including weekends).

---

## Step 2: Add H1 Ingestion to the Canonical-Refresh Cron

### File: `src/app/api/cron/canonical-refresh/route.ts`

**What to add:** After fetching and upserting daily bars for each instrument, also fetch and upsert H1 bars for the same date range.

### Implementation

Add H1 ingestion inside the instrument loop, after the daily bar upsert block (after line 175). The pattern mirrors the backfill script's OANDA H1 logic (backfill lines 519-560) and Bitget H1 logic (backfill lines 608-652).

#### For OANDA instruments (FX, indices, commodities):

```typescript
// Fetch H1 bars from OANDA
const { fetchOandaCandleSeries } = await import("@/lib/oandaPrices");
const hourlyBars = await fetchOandaCandleSeries(
  instrument.oandaInstrument!,
  fromUtc,
  toUtc,
);

for (const bar of hourlyBars) {
  const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
  await query(
    `INSERT INTO canonical_price_bars (symbol, asset_class, timeframe, bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price, source_provider, quality_status)
     VALUES ($1, $2, '1h', $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, 'provider_hourly')
     ON CONFLICT (symbol, timeframe, bar_open_utc)
     DO UPDATE SET close_price = EXCLUDED.close_price, high_price = EXCLUDED.high_price, low_price = EXCLUDED.low_price, updated_at = NOW()`,
    [
      instrument.symbol, instrument.assetClass,
      openDt.toISO(), openDt.plus({ hours: 1 }).toISO(),
      round(bar.open), round(bar.high), round(bar.low), round(bar.close),
      "oanda",
    ],
  );
  hourlyBarsUpserted++;
}
```

#### For Bitget instruments (crypto):

The cron already fetches Bitget H1 bars (line 129) but only aggregates them to daily. Instead of throwing away the hourly bars, also upsert them:

```typescript
// The hourly bars are already fetched at line 129 as `hourlyBars`
// After the daily aggregation block, also upsert the raw H1 bars:
for (const bar of hourlyBars) {
  const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
  await query(
    `INSERT INTO canonical_price_bars (symbol, asset_class, timeframe, bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price, source_provider, quality_status)
     VALUES ($1, $2, '1h', $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, 'provider_hourly_spot')
     ON CONFLICT (symbol, timeframe, bar_open_utc)
     DO UPDATE SET close_price = EXCLUDED.close_price, high_price = EXCLUDED.high_price, low_price = EXCLUDED.low_price, updated_at = NOW()`,
    [
      instrument.symbol, instrument.assetClass,
      openDt.toISO(), openDt.plus({ hours: 1 }).toISO(),
      round(bar.open), round(bar.high), round(bar.low), round(bar.close),
      instrument.assetClass === "crypto" ? "bitget_spot" : "bitget",
    ],
  );
  hourlyBarsUpserted++;
}
```

### Important details

1. **`fetchOandaCandleSeries` is not currently imported in the cron file.** Add the import at the top:
   ```typescript
   import { fetchOandaDailySeries, fetchOandaCandleSeries } from "@/lib/oandaPrices";
   ```
   (The cron already imports `fetchOandaDailySeries` from line 29 — just add `fetchOandaCandleSeries` to the same import.)

2. **Add `hourlyBarsUpserted` counter** alongside the existing `barsUpserted` counter. Include it in the response JSON.

3. **ON CONFLICT clause must use `(symbol, timeframe, bar_open_utc)`** — this matches the actual UNIQUE constraint on the `canonical_price_bars` table (migration 022, line 62). The existing daily bar upsert in the cron currently uses `ON CONFLICT (symbol, asset_class, timeframe, bar_open_utc)` which includes `asset_class` — that column is NOT part of the unique constraint. Fix the daily upsert ON CONFLICT clause at the same time:

   ```sql
   -- BEFORE (line 165, incorrect):
   ON CONFLICT (symbol, asset_class, timeframe, bar_open_utc)

   -- AFTER (correct, matches UNIQUE constraint):
   ON CONFLICT (symbol, timeframe, bar_open_utc)
   ```

   Apply this fix to the daily upsert AND use the correct clause for the new H1 upsert. Both must match `(symbol, timeframe, bar_open_utc)`.

4. **Performance consideration:** The cron currently processes current + previous week. H1 bars for 2 weeks × 36 instruments × ~120 bars = ~8,640 upserts. At 100ms per instrument rate limit, this adds ~3.6 seconds. The cron has `maxDuration = 120`. If concerned about timeout, batch the H1 upserts using a multi-row INSERT (same pattern as the backfill script's `upsertCanonicalBars` at line 294-337). However, individual inserts with 100ms rate-limit per instrument should fit within 120 seconds.

5. **Bitget H1 variable scoping:** The cron currently declares `hourlyBars` inside the Bitget `else if` block (line 129). The variable is already in scope — just add the H1 upsert loop after the daily aggregation loop that starts at line 143.

6. **Do NOT skip H1 for any asset class.** All instruments (FX, indices, commodities, crypto) get H1 bars.

---

## Step 3: Re-run Path Engine Verification

After the backfill completes:

```bash
npx tsx scripts/verify-path-engine.ts
```

Check the output at `docs/PATH_ENGINE_VERIFICATION_2026-04-07.md`.

### Expected outcomes after backfill

1. **Data Coverage:** All strategies should show 0 missing bar symbols. Every leg should have H1 bars.
2. **Return parity:** Dealer, Selector Frag3, and Agreement should all be within ≤0.5 percentage points of their weekly-close baselines. If still outside 0.5%, investigate per-pair — it's likely a bar alignment issue at week boundaries (first H1 bar open vs `pair_period_returns` open price).
3. **Path DD:** Will still be higher than weekly-close DD — that's correct and expected. The path engine reveals intraweek drawdowns that weekly-close DD hides. This is the whole point.
4. **H1 bar counts per week:** Should be ~4,300-4,400 for all 10 weeks (not 238 for the last week like before).

### If parity still fails after full H1 coverage

The remaining drift would be from **price source mismatch**: the weekly-close engine reads `pair_period_returns.open_price` / `close_price` (derived from daily bars), while the path engine uses the first/last H1 bar close for entry/exit pricing. These may differ slightly due to:
- Daily bar open is at a specific alignment hour (17 ET for FX, 18 ET for commodities)
- H1 bars align on UTC hours

If the drift is small (<0.5%) after full coverage, it's acceptable rounding noise from alignment differences. If it's larger, we need a per-symbol audit — but let's cross that bridge after the backfill.

---

## Validation Checklist

1. **Backfill ran without errors** — check the script output for any failed instruments
2. **Bar count SQL shows all 36 active instruments** with ≥1,000 H1 bars each in the research window
3. **Cron builds and lints** — `npm run build` and `npm run lint` pass
4. **Cron ON CONFLICT clause is corrected** for both daily and H1 upserts
5. **Path verification report shows ≤0.5% drift** for all 3 test strategies
6. **Path verification report shows 0 missing bar symbols**

---

## Files Changed

| File | Action |
|------|--------|
| `src/app/api/cron/canonical-refresh/route.ts` | **MODIFY** — add H1 ingestion, fix ON CONFLICT clause |
| `docs/PATH_ENGINE_VERIFICATION_2026-04-07.md` | **REGENERATE** — re-run verification after backfill |

**1 file modified. 0 files created.**

The backfill step uses the existing `scripts/backfill-canonical-price-layer.ts` as-is — no modifications needed.

---

## Important Warnings

1. **Run the backfill BEFORE modifying the cron.** The backfill fills historical gaps. The cron keeps it current going forward. Order matters.

2. **Do NOT modify the path engine files.** `basketPathEngine.ts`, `pathBarLoader.ts`, `positionLedger.ts` stay untouched. The problem is data, not engine.

3. **Do NOT modify the backfill script.** It already works for H1. Just run it.

4. **The cron's `maxDuration` is 120 seconds.** If H1 ingestion pushes it over, batch the inserts. But try individual inserts first — it should fit.

5. **File header standard applies** to any new code added to the cron file.

6. **The `fetchOandaCandleSeries` import already exists in the codebase** — it's exported from `src/lib/oandaPrices.ts` (line 139). Just add it to the cron's import line.
