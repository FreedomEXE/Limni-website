# CODEX: COT Data Enrichment — Delta, OI, Concentration

**Date:** 2026-04-04
**Goal:** Expand COT data ingestion to include weekly position delta, open interest, and concentration metrics. Store canonically. Then run a focused research script to test whether enriched data improves dealer neutral-pair resolution.

**Two phases:** Ingest first, research second. Do NOT change any live canonical direction logic.

---

## Context

We currently fetch only **2 data fields per dataset** from the CFTC API (long + short positions). The TFF report alone has 95+ fields. We're leaving massive amounts of signal on the table.

The three enrichment categories with highest signal-to-effort:
1. **Weekly delta** — are positions building or unwinding?
2. **Open interest** — is the market expanding or contracting?
3. **Concentration** — is positioning broad-based or driven by a few large players?

These add real context to the static net positioning we currently use. They come from the same API we already hit — zero new dependencies.

---

## PHASE 1: Ingestion

### Step 1: Expand `src/lib/cotFetch.ts`

#### Current state
The `$select` in `fetchCotRowsForDate()` (line 87-89) only requests:
```
contract_market_name,report_date_as_yyyy_mm_dd,{longField},{shortField},futonly_or_combined
```

#### Changes needed

**Expand the `DATASETS` config** to include additional fields per source:

```typescript
const DATASETS: Record<CotSource, {
  baseUrl: string;
  longField: string;
  shortField: string;
  extraFields: string[];  // NEW
}> = {
  tff: {
    baseUrl: "https://publicreporting.cftc.gov/resource/gpe5-46if.json",
    longField: "dealer_positions_long_all",
    shortField: "dealer_positions_short_all",
    extraFields: [
      "change_in_dealer_long_all",
      "change_in_dealer_short_all",
      "open_interest_all",
      "change_in_open_interest_all",
      "conc_gross_le_4_tdr_long_all",
      "conc_gross_le_4_tdr_short_all",
      "conc_gross_le_8_tdr_long_all",
      "conc_gross_le_8_tdr_short_all",
    ],
  },
  legacy: {
    baseUrl: "https://publicreporting.cftc.gov/resource/6dca-aqww.json",
    longField: "comm_positions_long_all",
    shortField: "comm_positions_short_all",
    extraFields: [
      "change_in_comm_long_all",
      "change_in_comm_short_all",
      "open_interest_all",
      "change_in_open_interest_all",
      "conc_gross_le_4_tdr_long_all",
      "conc_gross_le_4_tdr_short_all",
      "conc_gross_le_8_tdr_long_all",
      "conc_gross_le_8_tdr_short_all",
    ],
  },
  disaggregated: {
    baseUrl: "https://publicreporting.cftc.gov/resource/72hh-3qpy.json",
    longField: "prod_merc_positions_long",
    shortField: "prod_merc_positions_short",
    extraFields: [
      "change_in_prod_merc_long",
      "change_in_prod_merc_short",
      "open_interest_all",
      "change_in_open_interest_all",
      "conc_gross_le_4_tdr_long_all",
      "conc_gross_le_4_tdr_short_all",
      "conc_gross_le_8_tdr_long_all",
      "conc_gross_le_8_tdr_short_all",
    ],
  },
};
```

**IMPORTANT: Field name verification required.** The exact field names for legacy and disaggregated `change_in_*` and concentration fields may differ from TFF. Before hardcoding, run a test query against each API endpoint with NO `$select` parameter (or `$select=*`) and `$limit=1` to verify available field names. Log the full response to confirm. If a field doesn't exist in a dataset, omit it from that dataset's `extraFields` — don't let it break the fetch.

**Update the `$select` in `fetchCotRowsForDate()`:**

```typescript
url.searchParams.set(
  "$select",
  [
    "contract_market_name",
    "report_date_as_yyyy_mm_dd",
    dataset.longField,
    dataset.shortField,
    "futonly_or_combined",
    ...dataset.extraFields,
  ].join(","),
);
```

**Expand the `CotRow` type** to include optional enrichment fields:

```typescript
export type CotRow = {
  contract_market_name: string;
  report_date_as_yyyy_mm_dd: string;
  // Existing position fields
  dealer_positions_long_all?: string;
  dealer_positions_short_all?: string;
  comm_positions_long_all?: string;
  comm_positions_short_all?: string;
  prod_merc_positions_long?: string;
  prod_merc_positions_short?: string;
  futonly_or_combined: string;
  // NEW: Delta fields
  change_in_dealer_long_all?: string;
  change_in_dealer_short_all?: string;
  change_in_comm_long_all?: string;
  change_in_comm_short_all?: string;
  change_in_prod_merc_long?: string;
  change_in_prod_merc_short?: string;
  // NEW: Open interest fields
  open_interest_all?: string;
  change_in_open_interest_all?: string;
  // NEW: Concentration fields
  conc_gross_le_4_tdr_long_all?: string;
  conc_gross_le_4_tdr_short_all?: string;
  conc_gross_le_8_tdr_long_all?: string;
  conc_gross_le_8_tdr_short_all?: string;
};
```

All enrichment fields are **optional strings** (same pattern as existing fields — CFTC returns stringified numbers).

### Step 2: Expand `src/lib/cotTypes.ts`

**Add enrichment fields to `MarketSnapshot`:**

```typescript
export type MarketSnapshot = {
  // Existing fields (DO NOT CHANGE)
  dealer_long: number;
  dealer_short: number;
  dealer_net: number;
  dealer_bias: Bias;
  commercial_long: number | null;
  commercial_short: number | null;
  commercial_net: number | null;
  commercial_bias: Bias | null;
  blended_long: number;
  blended_short: number;
  blended_net: number;
  blended_bias: Bias;

  // NEW: Enrichment fields (all nullable — may not exist for all asset classes)
  dealer_delta_long?: number | null;
  dealer_delta_short?: number | null;
  dealer_delta_net?: number | null;        // computed: delta_long - delta_short (or short - long for dealer)
  commercial_delta_long?: number | null;
  commercial_delta_short?: number | null;
  commercial_delta_net?: number | null;    // computed: delta_long - delta_short
  open_interest?: number | null;
  oi_delta?: number | null;
  dealer_pct_of_oi?: number | null;        // computed: dealer_net / open_interest
  commercial_pct_of_oi?: number | null;    // computed: commercial_net / open_interest
  conc_gross_4_long?: number | null;       // % of OI held by top 4 long traders
  conc_gross_4_short?: number | null;
  conc_gross_8_long?: number | null;       // % of OI held by top 8 long traders
  conc_gross_8_short?: number | null;
};
```

**These are all optional fields.** Existing code that reads `MarketSnapshot` will not break because every new field is optional. The JSONB column in `cot_snapshots` automatically stores whatever `MarketSnapshot` contains — no schema migration needed.

### Step 3: Expand `src/lib/cotCompute.ts`

**Update `buildMarketSnapshot()` signature and body:**

Current signature (line 21):
```typescript
export function buildMarketSnapshot(
  dealerLong: number,
  dealerShort: number,
  commercialLong: number | null,
  commercialShort: number | null,
): MarketSnapshot
```

New signature — add an optional enrichment bag:
```typescript
export type CotEnrichment = {
  dealer_delta_long?: number | null;
  dealer_delta_short?: number | null;
  commercial_delta_long?: number | null;
  commercial_delta_short?: number | null;
  open_interest?: number | null;
  oi_delta?: number | null;
  conc_gross_4_long?: number | null;
  conc_gross_4_short?: number | null;
  conc_gross_8_long?: number | null;
  conc_gross_8_short?: number | null;
};

export function buildMarketSnapshot(
  dealerLong: number,
  dealerShort: number,
  commercialLong: number | null,
  commercialShort: number | null,
  enrichment?: CotEnrichment,
): MarketSnapshot
```

**Inside the function, compute derived enrichment values and spread them into the return:**

```typescript
// After existing blended calculations...

// Enrichment: deltas
const dealerDeltaNet =
  typeof enrichment?.dealer_delta_long === "number" && typeof enrichment?.dealer_delta_short === "number"
    ? enrichment.dealer_delta_short - enrichment.dealer_delta_long  // same inversion as dealer_net
    : null;
const commercialDeltaNet =
  typeof enrichment?.commercial_delta_long === "number" && typeof enrichment?.commercial_delta_short === "number"
    ? enrichment.commercial_delta_long - enrichment.commercial_delta_short
    : null;

// Enrichment: % of OI
const oi = enrichment?.open_interest ?? null;
const dealerPctOfOi =
  typeof oi === "number" && oi > 0 ? dealerNet / oi : null;
const commercialPctOfOi =
  typeof oi === "number" && oi > 0 && typeof commercialNet === "number" ? commercialNet / oi : null;

return {
  // ...existing fields unchanged...

  // Enrichment
  dealer_delta_long: enrichment?.dealer_delta_long ?? null,
  dealer_delta_short: enrichment?.dealer_delta_short ?? null,
  dealer_delta_net: dealerDeltaNet,
  commercial_delta_long: enrichment?.commercial_delta_long ?? null,
  commercial_delta_short: enrichment?.commercial_delta_short ?? null,
  commercial_delta_net: commercialDeltaNet,
  open_interest: oi,
  oi_delta: enrichment?.oi_delta ?? null,
  dealer_pct_of_oi: dealerPctOfOi,
  commercial_pct_of_oi: commercialPctOfOi,
  conc_gross_4_long: enrichment?.conc_gross_4_long ?? null,
  conc_gross_4_short: enrichment?.conc_gross_4_short ?? null,
  conc_gross_8_long: enrichment?.conc_gross_8_long ?? null,
  conc_gross_8_short: enrichment?.conc_gross_8_short ?? null,
};
```

**CRITICAL: `dealerDeltaNet` uses the same inversion as `dealerNet` (`short - long`).** The dealer convention in our codebase is inverted from commercial. Check `buildMarketSnapshot()` line 27: `const dealerNet = dealerShort - dealerLong;`. Apply the same to delta.

### Step 4: Expand `src/lib/cotStore.ts`

**Update `refreshSnapshotForClass()`** to extract enrichment fields from `CotRow` and pass to `buildMarketSnapshot()`.

After the existing position extraction (around line 286-308), add enrichment extraction:

```typescript
// Extract enrichment from dealer row (TFF)
function extractDealerEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    dealer_delta_long: row.change_in_dealer_long_all != null ? Number(row.change_in_dealer_long_all) : null,
    dealer_delta_short: row.change_in_dealer_short_all != null ? Number(row.change_in_dealer_short_all) : null,
    open_interest: row.open_interest_all != null ? Number(row.open_interest_all) : null,
    oi_delta: row.change_in_open_interest_all != null ? Number(row.change_in_open_interest_all) : null,
    conc_gross_4_long: row.conc_gross_le_4_tdr_long_all != null ? Number(row.conc_gross_le_4_tdr_long_all) : null,
    conc_gross_4_short: row.conc_gross_le_4_tdr_short_all != null ? Number(row.conc_gross_le_4_tdr_short_all) : null,
    conc_gross_8_long: row.conc_gross_le_8_tdr_long_all != null ? Number(row.conc_gross_le_8_tdr_long_all) : null,
    conc_gross_8_short: row.conc_gross_le_8_tdr_short_all != null ? Number(row.conc_gross_le_8_tdr_short_all) : null,
  };
}

// Extract enrichment from commercial row (legacy/disaggregated)
function extractCommercialEnrichment(row: CotRow | null, source: CotSource): Partial<CotEnrichment> {
  if (!row) return {};
  const deltaLongField = source === "disaggregated" ? "change_in_prod_merc_long" : "change_in_comm_long_all";
  const deltaShortField = source === "disaggregated" ? "change_in_prod_merc_short" : "change_in_comm_short_all";
  return {
    commercial_delta_long: (row as Record<string, string | undefined>)[deltaLongField] != null
      ? Number((row as Record<string, string | undefined>)[deltaLongField])
      : null,
    commercial_delta_short: (row as Record<string, string | undefined>)[deltaShortField] != null
      ? Number((row as Record<string, string | undefined>)[deltaShortField])
      : null,
    // OI and concentration come from dealer row (TFF) since they're market-level, not trader-category-level.
    // Only set here if dealer row is missing.
  };
}
```

**Then update the `buildMarketSnapshot()` call** (around line 314):

```typescript
const dealerEnrichment = extractDealerEnrichment(dealerRow);
const commercialEnrichment = extractCommercialEnrichment(commercialRow, commercialSource);

currencies[market.id] = buildMarketSnapshot(
  dealerLong,
  dealerShort,
  commercialLong,
  commercialShort,
  { ...dealerEnrichment, ...commercialEnrichment },  // merge enrichments
);
```

**NOTE on OI and concentration:** These are market-level fields, not trader-category-specific. They come from whichever row we have (preferring dealer/TFF since that's the primary source for FX). The `open_interest_all` field should be the same in both the dealer and commercial rows for the same market — use the dealer row's value if available, fall back to commercial row.

### Step 5: Backfill Existing Snapshots

After the ingestion code is updated, we need to re-fetch and re-store all existing weeks so the enrichment fields are populated for historical data.

**Create a one-time backfill script** (`scripts/backfill-cot-enrichment.ts`):

```typescript
// For each report date in the database:
//   1. Re-fetch from CFTC API with expanded $select
//   2. Re-build MarketSnapshot with enrichment
//   3. Overwrite the snapshot in the database (writeSnapshot handles ON CONFLICT)

// Use listSnapshotDates() to get all dates
// Use refreshSnapshotForClass() for each date (it already does the full fetch+store)
// Pass the specific reportDate to force re-fetch
```

The existing `refreshSnapshotForClass(assetClass, reportDate)` already accepts an optional `reportDate` parameter and will re-fetch and overwrite. So the backfill script just needs to:
1. List all snapshot dates
2. Call `refreshSnapshotForClass(ac, date)` for each date × asset class

### Step 6: Verification

After backfill:
1. Read the latest FX snapshot from the database
2. Check that `currencies.USD` now has `dealer_delta_long`, `dealer_delta_net`, `open_interest`, `conc_gross_4_long` etc.
3. Print a summary table showing enrichment fields for all 8 FX currencies
4. Verify dealer baselines are UNCHANGED (the enrichment is additive — existing direction logic doesn't touch these new fields)

---

## PHASE 2: Research Script

**Script:** `scripts/research-cot-enrichment-quality.ts`

This script analyzes the enriched data to answer: **can enriched COT fields produce better directions for dealer neutral pairs?**

### What to analyze

#### 1. Enrichment Field Summary
For each FX currency across all weeks, show:
```
Currency | Week | DealerNet | DeltaNet | PctOI | OI_Delta | Conc4_L | Conc4_S
─────────┼──────┼───────────┼──────────┼───────┼──────────┼─────────┼────────
USD      | Jan19| -12,345   | +2,100   | -8.2% | +5,000   | 32.1%   | 28.4%
...
```

#### 2. Neutral Pair Analysis
For pairs that are currently NEUTRAL under dealer's standard bias-label logic:
- What does `dealer_delta_net` say? (building long vs unwinding)
- What does `dealer_pct_of_oi` say? (how significant is the position?)
- What does `oi_delta` say? (expanding = conviction, contracting = covering)
- What does concentration say? (broad-based = meaningful, concentrated = few players)

Show a table of all neutral dealer pair-weeks with their enrichment values.

#### 3. Enriched Tiebreaker Candidates
For each neutral pair, test these candidate direction methods:
- **Delta-based:** `base_delta_net - quote_delta_net` → direction (same structure as forced-raw for commercial)
- **PctOI-based:** `base_pct_of_oi - quote_pct_of_oi` → direction
- **OI-confirmed delta:** Delta direction, but only if OI is expanding (delta + oi_delta same sign = conviction)
- **Concentration-weighted delta:** Delta direction, weighted by inverse concentration (broad positioning = higher confidence)

For each candidate, compute the return on neutral-only pairs using ADR normalization. Show:
```
Method          | Forced Pairs | Total%  | Win%  | vs Lean Tiebreaker
────────────────┼──────────────┼─────────┼───────┼───────────────────
Current lean    | 130          | -32.51% | 50.8% | baseline
Delta-based     | ???          | ???     | ???   | better/worse
PctOI-based     | ???          | ???     | ???   | better/worse
OI-confirmed    | ???          | ???     | ???   | better/worse (fewer forced)
Conc-weighted   | ???          | ???     | ???   | better/worse
```

**IMPORTANT:** The "vs Lean Tiebreaker" comparison is against the dealer [B] tiebreaker from the source canonicalization sweep. That was 130 forced pairs, +40.66% total standalone (the forced pairs themselves were the drag). Isolate just the neutral-pair performance to compare apples-to-apples.

#### 4. Commercial Enrichment Check
Same analysis but for commercial — does delta/OI/concentration add useful signal on top of forced-raw? This is secondary to dealer but worth checking since we're already fetching the data.

### Data Loading Pattern
```typescript
import { readSnapshot } from "../src/lib/cotStore";
// After backfill, readSnapshot returns MarketSnapshot with enrichment fields
// Access via: snapshot.currencies["USD"].dealer_delta_net, etc.
```

### Output
Save to `docs/COT_ENRICHMENT_RESEARCH_RESULTS_2026-04-04.md` with:
- Enrichment field summary per currency
- Neutral pair analysis table
- Enriched tiebreaker candidate comparison
- Recommendation: which enriched method (if any) beats the crude lean tiebreaker

---

## Files Changed Summary

| File | Phase | Change |
|------|-------|--------|
| `src/lib/cotFetch.ts` | 1 | Add `extraFields` to DATASETS, expand `$select`, expand `CotRow` type |
| `src/lib/cotTypes.ts` | 1 | Add enrichment fields to `MarketSnapshot` (all optional/nullable) |
| `src/lib/cotCompute.ts` | 1 | Add `CotEnrichment` type, expand `buildMarketSnapshot()` signature and body |
| `src/lib/cotStore.ts` | 1 | Add enrichment extraction helpers, pass enrichment to `buildMarketSnapshot()` |
| `scripts/backfill-cot-enrichment.ts` | 1 | One-time backfill script to re-fetch all historical snapshots with enrichment |
| `scripts/research-cot-enrichment-quality.ts` | 2 | Research script analyzing enrichment data quality and neutral-pair resolution |

---

## Important Warnings

1. **Verify CFTC field names before hardcoding.** The exact field names for legacy/disaggregated `change_in_*` and concentration fields may differ from TFF. Make a test query with `$limit=1` and no `$select` restriction to see all available fields in each dataset. Log the field names. If a field doesn't exist, omit it rather than breaking the fetch.
2. **Dealer net is inverted:** `dealer_net = dealer_short - dealer_long` (line 27 of cotCompute.ts). Apply the same inversion to `dealer_delta_net`.
3. **All enrichment fields MUST be optional/nullable.** Not every asset class or report date will have every field. The code must never crash on missing enrichment data.
4. **Don't touch direction logic.** Phase 1 is ingestion only. No changes to `derivePairDirections*`, `biasFromNet`, or `resolveMarketBias`.
5. **Existing tests must still pass.** The `buildMarketSnapshot()` signature change adds an optional parameter — all existing callers pass 4 args and should continue working. Verify: `npx vitest run src/lib/__tests__/cotCompute.test.ts`.
6. **The JSONB `currencies` column auto-stores new fields.** No database migration needed. The expanded `MarketSnapshot` just gets serialized into the existing JSONB column.
7. **Backfill re-fetches from CFTC API.** This means it needs network access and may take a few minutes (10+ weeks × 4 asset classes × 2 sources = ~80 API calls). Add rate limiting if needed (CFTC API can be slow). The existing `refreshSnapshotForClass()` function handles everything — just call it with each historical `reportDate`.
8. **OI and concentration are market-level, not trader-category-level.** The same `open_interest_all` value appears in both TFF and legacy rows for the same contract. Use dealer (TFF) row as primary source since it's our primary dataset.
