/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Codex Brief: Pair Universe Reconstruction & Sum Fix
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

## Context — What Happened

The reconstruction script `scripts/reconstruct-weekly-systems.ts` was built and runs correctly, but it has a **critical math error**: it **averages** per-pair returns to compute the weekly system return. The old system **summed** every position's PnL into a running total (`realizedPct += pnlPct`). This is why the old Universal V1 showed +333% over 6 weeks while the reconstruction shows +10% over 9 weeks — the averaging divides by ~45 trades per week, destroying the signal.

Additionally, each individual pair's result must be fully recorded as a first-class trade entity. We need a **pair universe** — every pair, every week, every system — with enough metadata to power a future bubble-map research visualization.

## Two Jobs

### Job 1: Fix the Return Calculation (SUM, not AVERAGE)

In `scripts/reconstruct-weekly-systems.ts`:

**Universal (`reconstructUniversalWeek`):**

Line 493 currently reads:
```typescript
const weekReturn = totalUnits > 0 ? weightedReturnSum / totalUnits : 0;
```

Change to:
```typescript
const weekReturn = weightedReturnSum;
```

`weightedReturnSum` accumulates `returnPct * units` for each netted pair. Each net unit is an independent position. The weekly system return is the **sum** of all position PnLs — exactly how the old system computed `realizedPct`.

**Tiered (`reconstructTieredWeek`):**

Line 617 currently reads:
```typescript
const weekReturn = totalWeight > 0 ? weightedReturnSum / totalWeight : 0;
```

Change to:
```typescript
const weekReturn = weightedReturnSum;
```

Same logic. Each tiered pair contributes `returnPct * tierWeight` to the basket. The weekly return is the total weighted PnL across all pairs.

**Also fix `grossProfitPct` and `grossLossPct`** in both functions — they currently divide by `totalUnits` / `totalWeight`. Remove the division. They should be raw sums:
```typescript
grossProfitPct: round(grossProfitWeighted, 6),
grossLossPct: round(grossLossWeighted, 6),
```

**Also fix `perAsset` breakdowns** in both functions — they currently divide `weightedReturn / units` (or `/weight`). Remove the division. Report the summed return contribution per asset class:
```typescript
fx: {
  returnPct: round(perAssetTotals.fx.weightedReturn, 6),
  tradeCount: perAssetTotals.fx.tradeCount,
},
```

Do this for all 4 asset classes (fx, indices, crypto, commodities) in both `reconstructUniversalWeek` and `reconstructTieredWeek`.

### Job 2: Enrich Per-Pair Trade Recording

The `buildTradeRows()` function already records one row per netted pair. This is good but needs enrichment. Each trade row must become a complete record of that pair's life for that week in that system.

**Current trade metadata:**
```typescript
metadata: {
  family, version, assetClass, unitsOrWeight,
  support, oppose, tier, weeklySystemReturnPct
}
```

**Required trade metadata** (add these fields):
```typescript
metadata: {
  // Existing
  family: string,           // "universal" | "tiered"
  version: string,          // "v1" | "v2" | "v3"
  assetClass: string,       // "fx" | "crypto" | "indices" | "commodities"

  // Net position info
  netUnits: number,         // For Universal: |net| (how many net units). For Tiered: 1 always
  tierWeight: number | null, // For Tiered: 3 (T1), 1.5 (T2), 1 (T3). For Universal: null
  tier: number | null,      // 1, 2, 3, or null for Universal

  // Pre-netting model breakdown
  modelSignals: {
    [modelName: string]: {
      direction: "LONG" | "SHORT",
      returnPct: number       // That model's pair_details.percent for this pair
    }
  },

  // Contribution to strategy
  pairReturnPct: number,       // The pair's individual open-to-close return (avg of supporting entries)
  positionContributionPct: number, // pairReturnPct * netUnits (or * tierWeight) — what this pair contributed to the weekly sum

  // For skipped pairs (netted to zero) — see below
  skippedByNetting: false
}
```

**Additionally, record SKIPPED pairs** — pairs that were netted to zero. These are essential for the bubble map (you need to see which pairs had conflicting signals). Add them as trade rows with:
```typescript
{
  weekOpenUtc,
  symbol,
  direction: "NEUTRAL",   // Netted out
  pnlPct: 0,              // No position taken
  metadata: {
    family, version, assetClass,
    netUnits: 0,
    tierWeight: null,
    tier: null,
    modelSignals: {
      // STILL record what each model said, even though we didn't trade
      dealer: { direction: "LONG", returnPct: 0.45 },
      sentiment: { direction: "SHORT", returnPct: -0.45 },
      // ... etc
    },
    pairReturnPct: null,
    positionContributionPct: 0,
    skippedByNetting: true
  }
}
```

This means the `buildTradeRows()` function needs access to the raw signal data (what each model said for each pair), not just the post-netting summary.

**Implementation approach:**

1. In both `reconstructUniversalWeek` and `reconstructTieredWeek`, build a `Map<string, TradeSignal[]>` that captures ALL signals per pair (this already exists as the `signals` variable)
2. Pass this signal map through to the `WeekBreakdown` so `buildTradeRows` can access it
3. Add a new field to `WeekBreakdown`:
```typescript
type WeekBreakdown = {
  // existing fields...
  rawSignalsByPair: Map<string, Array<{
    model: string;
    direction: "LONG" | "SHORT";
    returnPct: number;
  }>>;
};
```
4. In `buildTradeRows`, use `rawSignalsByPair` to populate `modelSignals` in the metadata for both traded and skipped pairs

### Job 3: Pair Universe Audit Report

After reconstruction, write an additional report: `reports/pair-universe-audit.json`

Structure:
```json
{
  "generated_utc": "...",
  "systems": ["universal_v1", "universal_v2", "..."],
  "weeks": ["2026-01-19T00:00:00.000Z", "..."],
  "pairs": {
    "EURUSD": {
      "assetClass": "fx",
      "systems": {
        "universal_v1": {
          "appearances": 9,
          "traded": 7,
          "skipped": 2,
          "totalContributionPct": 4.56,
          "avgReturnWhenTraded": 0.65,
          "wins": 5,
          "losses": 2,
          "winRate": 71.43,
          "bestWeek": { "week": "2026-02-09T00:00:00.000Z", "returnPct": 2.1 },
          "worstWeek": { "week": "2026-01-26T00:00:00.000Z", "returnPct": -0.8 },
          "directionBias": { "longWeeks": 5, "shortWeeks": 2, "skippedWeeks": 2 }
        },
        "universal_v2": { "..." },
        "tiered_v1": { "..." }
      }
    },
    "GBPUSD": { "..." }
  }
}
```

This report is the raw material for the bubble map. Each pair is a bubble. The data tells you its size (contribution), color (win rate), and cross-system comparison.

## Execution Order

1. Fix the sum/average bug in `reconstructUniversalWeek` and `reconstructTieredWeek` (both return calc and per-asset breakdowns)
2. Enrich `WeekBreakdown` to carry raw signal data per pair
3. Enrich `buildTradeRows` to emit full metadata including `modelSignals`, skipped pairs, and contribution
4. Add pair universe audit report generation
5. Rerun: `npx tsx scripts/reconstruct-weekly-systems.ts`
6. Rerun: `npx tsx scripts/verify-reconstruction.ts` — must PASS
7. Run: `npx tsc --noEmit --pretty false -p tsconfig.json` — must pass
8. Run: `npm run build` — must pass
9. Update `docs/bots/WEEKLY_RECONSTRUCTION_RESULTS_2026-03-22.md` with corrected numbers

## Verification Expectations

After the sum fix, weekly returns should be dramatically higher than the averaged versions. Rough expected ranges:

- Universal V1 (5 models, ~45 net units/week): weekly returns in the 10-50% range per week. 9-week compounded total should be in the hundreds of percent.
- Universal V2/V3 (3-4 models, fewer net units): somewhat lower but still multi-hundred percent.
- Tiered (tier-weighted, 1 trade per pair but 3x/1.5x/1x weight): lower than Universal but still meaningfully higher than the 6-10% that averaged versions showed.

If the corrected numbers look unreasonably high, **do not panic**. The old Universal V1 non-net carry model showed +333% over just 6 weeks. The net-hold model over 9 weeks should be in a similar ballpark because each pair's ~1% return is multiplied by the number of net units traded simultaneously.

If any system shows >1000% compounded, flag it but do not suppress it. Report the raw numbers and include a sanity-check note.

## DO NOT

- **DO NOT** average weekly returns. The weekly system return is the **SUM** of all `pairReturnPct * netUnits` (Universal) or `pairReturnPct * tierWeight` (Tiered).
- **DO NOT** drop skipped pairs from the trade table. Record them with `direction: "NEUTRAL"`, `pnlPct: 0`, `skippedByNetting: true`.
- **DO NOT** modify the DB schema (`migrations/016_strategy_backtest_store.sql`). The existing `strategy_backtest_trades.metadata JSONB` column handles all the new fields.
- **DO NOT** modify `strategyBacktestIngestion.ts` or `strategyBacktestStore.ts`.
- **DO NOT** touch any UI files, pages, or components.
- **DO NOT** touch existing backtest scripts other than `reconstruct-weekly-systems.ts` and `verify-reconstruction.ts`.
- **DO NOT** sum weekly returns for multi-week totals. Always **compound**: `product(1 + r/100) - 1`.

## Files to Modify

| File | Changes |
|------|---------|
| `scripts/reconstruct-weekly-systems.ts` | Sum fix, signal map passthrough, enriched trade rows, skipped pair rows, pair universe report |
| `scripts/verify-reconstruction.ts` | Update to verify against summed returns |
| `docs/bots/WEEKLY_RECONSTRUCTION_RESULTS_2026-03-22.md` | Update with corrected numbers |

## Files to Create

| File | Purpose |
|------|---------|
| `reports/pair-universe-audit.json` | Per-pair universe data for bubble map research |

## File Header

Every new or modified file must include:
```
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
```
