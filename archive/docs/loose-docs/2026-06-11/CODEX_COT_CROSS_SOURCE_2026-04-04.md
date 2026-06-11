# CODEX: Legacy Non-Commercial Ingestion + Cross-Source Relationship Research

**Date:** 2026-04-04
**Goal:** (1) Ingest legacy non-commercial (large speculator) positions and missing commercial metadata from the legacy CFTC feed. (2) Expand stored history beyond current ~59 dates. (3) Run cross-source relationship research testing how dealer, commercial, and non-commercial interact — the first pass that can realistically improve BOTH dealer and commercial signal quality.

**Three phases:** Ingest → Backfill deeper history → Research. Do NOT change any live canonical direction logic.

---

## Context

Prior enrichment passes found:
- **Dealer non-neutral:** lev money agreement (+6.3pp WR) and delta confirmation (+3.1pp) help. But these are dealer-internal signals.
- **Commercial:** no enrichment filter tested so far beats forced-raw (+23.41%). Every filter degraded it.
- **Cross-source:** untested. We've been enriching each source in isolation. We haven't studied how dealer and commercial *relate to each other* or how the classic commercial-vs-speculator dynamic affects either.

The legacy CFTC feed (`6dca-aqww`) has non-commercial (large speculator) positions that we completely ignore. This is the oldest institutional COT signal: commercial hedgers position against the trend while speculators follow it. When they diverge at extremes, reversals follow. We fetch this feed already for commercial data but throw away the speculator half.

**Why this is the bridge pass:** cross-source signals — dealer vs commercial direction, commercial vs speculator divergence, triple-alignment across participant classes — are the first angle that can improve both dealer and commercial together. Isolated enrichment has hit diminishing returns.

### Quality bar
- Improves neutral handling
- Improves or preserves non-neutral quality
- Does not materially worsen DD or losing weeks
- Works across both dealer and commercial research slices

---

## PHASE 1: Legacy Non-Commercial Ingestion

### Step 1: Expand `src/lib/cotFetch.ts`

**Add fields to the `legacy` dataset's `extraFields`:**

Current legacy `extraFields`:
```
change_in_comm_long_all, change_in_comm_short_all,
open_interest_all, change_in_open_interest_all,
conc_gross_le_4_tdr_long, conc_gross_le_4_tdr_short,
conc_gross_le_8_tdr_long, conc_gross_le_8_tdr_short
```

**Add these fields:**

```typescript
// Non-commercial (large speculators) — positions + spread + delta
"noncomm_positions_long_all",
"noncomm_positions_short_all",
"noncomm_postions_spread_all",        // NOTE: CFTC typo — "postions" not "positions"
"change_in_noncomm_long_all",
"change_in_noncomm_short_all",
"change_in_noncomm_spead_all",        // NOTE: CFTC typo — "spead" not "spread"
"pct_of_oi_noncomm_long_all",
"pct_of_oi_noncomm_short_all",
"traders_noncomm_long_all",
"traders_noncomm_short_all",
"traders_noncomm_spread_all",

// Commercial extra (trader counts + %OI)
"traders_comm_long_all",
"traders_comm_short_all",
"pct_of_oi_comm_long_all",
"pct_of_oi_comm_short_all",
```

**IMPORTANT:** The CFTC legacy API has known typos:
- `noncomm_postions_spread_all` → uses "postions" not "positions"
- `change_in_noncomm_spead_all` → uses "spead" not "spread"

These are the actual field names in the API. Use them exactly as listed above.

**IMPORTANT: Verify these field names.** Before hardcoding, run a test query against `https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=1` with no `$select` to confirm all field names exist. Log the raw response keys that contain "noncomm" and "traders_comm". If a field doesn't exist, omit it — don't break the fetch.

**Expand the `CotRow` type** — add optional strings for all new fields:

```typescript
// Legacy non-commercial
noncomm_positions_long_all?: string;
noncomm_positions_short_all?: string;
noncomm_postions_spread_all?: string;     // CFTC typo preserved
change_in_noncomm_long_all?: string;
change_in_noncomm_short_all?: string;
change_in_noncomm_spead_all?: string;     // CFTC typo preserved
pct_of_oi_noncomm_long_all?: string;
pct_of_oi_noncomm_short_all?: string;
traders_noncomm_long_all?: string;
traders_noncomm_short_all?: string;
traders_noncomm_spread_all?: string;

// Legacy commercial extra
traders_comm_long_all?: string;
traders_comm_short_all?: string;
pct_of_oi_comm_long_all?: string;
pct_of_oi_comm_short_all?: string;
```

### Step 2: Expand `src/lib/cotTypes.ts`

**Add to `MarketSnapshot`:**

```typescript
// Legacy non-commercial (large speculators)
noncomm_long?: number | null;
noncomm_short?: number | null;
noncomm_spread?: number | null;
noncomm_net?: number | null;              // computed: long - short
noncomm_delta_long?: number | null;
noncomm_delta_short?: number | null;
noncomm_delta_net?: number | null;        // computed: delta_long - delta_short
noncomm_pct_oi_long?: number | null;
noncomm_pct_oi_short?: number | null;
noncomm_traders_long?: number | null;
noncomm_traders_short?: number | null;

// Legacy commercial extra
commercial_traders_long?: number | null;
commercial_traders_short?: number | null;
commercial_pct_oi_long?: number | null;
commercial_pct_oi_short?: number | null;
```

### Step 3: Expand `src/lib/cotCompute.ts`

**Add to `CotEnrichment` type:**

```typescript
// Legacy non-commercial
noncomm_long?: number | null;
noncomm_short?: number | null;
noncomm_spread?: number | null;
noncomm_delta_long?: number | null;
noncomm_delta_short?: number | null;
noncomm_pct_oi_long?: number | null;
noncomm_pct_oi_short?: number | null;
noncomm_traders_long?: number | null;
noncomm_traders_short?: number | null;

// Legacy commercial extra
commercial_traders_long?: number | null;
commercial_traders_short?: number | null;
commercial_pct_oi_long?: number | null;
commercial_pct_oi_short?: number | null;
```

**Expand `buildMarketSnapshot()` computed values:**

```typescript
// Non-commercial net: long - short (speculators are directional)
const noncommNet = typeof enrichment?.noncomm_long === "number" && typeof enrichment?.noncomm_short === "number"
  ? enrichment.noncomm_long - enrichment.noncomm_short : null;
const noncommDeltaNet = typeof enrichment?.noncomm_delta_long === "number" && typeof enrichment?.noncomm_delta_short === "number"
  ? enrichment.noncomm_delta_long - enrichment.noncomm_delta_short : null;
```

**Net convention:** `noncomm_net = long - short` (NOT inverted — speculators are directional like lev_money). Only dealer is inverted (`short - long`).

**Spread all new fields into the return object** using `enrichment?.field ?? null` pattern.

### Step 4: Expand `src/lib/cotStore.ts`

**Add extraction functions:**

```typescript
function extractLegacyNoncommEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    noncomm_long: numberOrNull(row.noncomm_positions_long_all),
    noncomm_short: numberOrNull(row.noncomm_positions_short_all),
    noncomm_spread: numberOrNull(row.noncomm_postions_spread_all),  // CFTC typo
    noncomm_delta_long: numberOrNull(row.change_in_noncomm_long_all),
    noncomm_delta_short: numberOrNull(row.change_in_noncomm_short_all),
    noncomm_pct_oi_long: numberOrNull(row.pct_of_oi_noncomm_long_all),
    noncomm_pct_oi_short: numberOrNull(row.pct_of_oi_noncomm_short_all),
    noncomm_traders_long: numberOrNull(row.traders_noncomm_long_all),
    noncomm_traders_short: numberOrNull(row.traders_noncomm_short_all),
  };
}

function extractLegacyCommercialExtraEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    commercial_traders_long: numberOrNull(row.traders_comm_long_all),
    commercial_traders_short: numberOrNull(row.traders_comm_short_all),
    commercial_pct_oi_long: numberOrNull(row.pct_of_oi_comm_long_all),
    commercial_pct_oi_short: numberOrNull(row.pct_of_oi_comm_short_all),
  };
}
```

**Update `buildMarketEnrichment()`** — these come from the legacy/commercial row, not the TFF/dealer row:

```typescript
function buildMarketEnrichment(
  dealerRow: CotRow | null,
  commercialRow: CotRow | null,
  commercialSource: CotSource,
): CotEnrichment {
  return {
    ...extractDealerEnrichment(dealerRow),
    ...extractDealerExtraEnrichment(dealerRow),
    ...extractCommercialEnrichment(commercialRow, commercialSource),
    ...extractLegacyNoncommEnrichment(commercialRow),               // NEW — from legacy row
    ...extractLegacyCommercialExtraEnrichment(commercialRow),       // NEW — from legacy row
    ...extractAssetMgrEnrichment(dealerRow),
    ...extractLevMoneyEnrichment(dealerRow),
    ...extractOtherReptEnrichment(dealerRow),
    ...extractNonreptEnrichment(dealerRow),
    ...extractNetConcentrationEnrichment(dealerRow),
    ...extractMarketLevelEnrichment(commercialRow),
    ...extractMarketLevelEnrichment(dealerRow),
  };
}
```

**CRITICAL:** `extractLegacyNoncommEnrichment` and `extractLegacyCommercialExtraEnrichment` must use the **commercial row** (legacy feed), NOT the dealer row (TFF feed). The TFF feed does not have `noncomm_*` or `traders_comm_*` fields. Only the legacy feed has these.

**NOTE for disaggregated:** The disaggregated feed (`72hh-3qpy`) used for commodities does NOT have `noncomm_*` fields (it uses `prod_merc`, `swap`, `m_money`, `other_rept` categories). The `extractLegacyNoncommEnrichment` function should gracefully return `{}` when the fields are missing from the row — this is already handled since `numberOrNull` returns null for missing fields and the function checks `if (!row) return {}`.

---

## PHASE 2: Deeper Historical Backfill

### Goal

Expand stored snapshot history from current ~59 dates to as many weeks as the CFTC API provides. The TFF and legacy feeds contain data going back several years. More weeks = more robust sample for all research findings.

### Script: `scripts/backfill-cot-deep-history.ts`

This script should:

1. **Discover all available report dates** from the CFTC API — query the TFF endpoint for all distinct `report_date_as_yyyy_mm_dd` values, sorted ascending:
```
https://publicreporting.cftc.gov/resource/gpe5-46if.json?$select=report_date_as_yyyy_mm_dd&$group=report_date_as_yyyy_mm_dd&$order=report_date_as_yyyy_mm_dd ASC&$limit=5000
```

2. **Compare against stored dates** — call `listSnapshotDates("fx")` to see what we have.

3. **Fetch missing dates** — for each date not in our database, call `refreshSnapshotForClass(assetClass, date)` for all 4 asset classes.

4. **Also re-fetch existing dates** — so existing snapshots get the new legacy non-commercial fields.

5. **Rate limit** — CFTC API can be slow. Use 300-500ms delay between fetches. Log progress: `[fx] 47/312 2024-03-15`.

6. **Stop at a sane limit** — the CFTC data goes back very far, but our pair returns and ADR data only cover the weeks we have in `listDataSectionWeeks()`. For research purposes, the COT snapshots don't need price data — they just need to exist in the DB for the enrichment summary tables. But for actual backtesting (sections that compute returns), only weeks with price data are usable. So:
   - Fetch ALL available COT dates (gives us the full enrichment landscape)
   - The research script will naturally filter to weeks that have both COT and price data
   - If the deep backfill would exceed 500 dates, limit to the most recent 260 (~5 years)

7. **Output summary** — at the end, print: total dates before, total after, date range.

### Verification

After deep backfill:
1. Read the earliest and latest FX snapshots
2. Confirm `noncomm_long`, `noncomm_net`, `commercial_traders_long` etc. are populated
3. Print a summary table for the latest FX snapshot showing all new fields per currency

---

## PHASE 3: Cross-Source Relationship Research

**Script:** `scripts/research-cot-cross-source.ts`
**Output:** `docs/COT_CROSS_SOURCE_RESEARCH_RESULTS_2026-04-04.md`

Use the same data loading pattern as the existing research scripts (`research-cot-full-book.ts`): iterate weeks via `listDataSectionWeeks()`, load snapshots via `readSnapshot()`, get returns via `getWeeklyPairReturns()`, ADR via `loadWeeklyAdrMap()`. All ADR-normalized.

**FX only for this pass.**

The output must split ALL results into three book segments:
1. **Neutral** — pairs where dealer assigns NEUTRAL direction
2. **Non-neutral** — pairs where dealer assigns LONG or SHORT
3. **Full book** — all pairs combined

And within each segment, separate:
- **Source-internal signals** — enrichment within one source (dealer or commercial)
- **Cross-source signals** — relationships between sources

---

### Section A: Participant Summary (Extended)

For each FX currency across all weeks, show positioning for ALL participant classes in a single table:

```
Week   | CCY | Dealer_Net | Comm_Net | NonComm_Net | AM_Net  | LM_Net  | NonR_Net | D_Δ   | C_Δ    | NC_Δ
───────┼─────┼────────────┼──────────┼─────────────┼─────────┼─────────┼──────────┼───────┼────────┼──────
Jan 19 | AUD | 27063      | -3610    | ???         | -33486  | 30217   | 22456    | -7307 | ???    | ???
```

This is a data dump. Include dealer, commercial, non-commercial, asset manager, lev money, and non-reportable nets + deltas.

### Section B: Dealer vs Commercial Agreement

**For each FX pair-week, compute:**
- Dealer direction (from `derivePairDirectionsWithNeutral` with mode "dealer")
- Commercial forced-raw direction (`base_commercial_net - quote_commercial_net`)
- Whether they agree, disagree, or one is neutral

**Output tables for each book segment (neutral / non-neutral / full book):**

```
Dealer vs Commercial         | Pairs | Total% | Win% | Avg%
─────────────────────────────┼───────┼────────┼──────┼──────
Both agree (same direction)  | ???   | ???    | ???  | ???
Dealer non-neutral, comm opposite | ??? | ??? | ???  | ???
Dealer neutral, comm has dir | ???   | ???    | ???  | ???
Both neutral                 | ???   | ???    | ???  | ???
```

For "Both agree": both have a direction and it's the same. The return is computed using dealer's direction (since that's the primary signal).

For "Dealer neutral, comm has dir": return computed using commercial's direction — this tests whether commercial fills dealer's gaps correctly.

### Section C: Commercial vs Non-Commercial Divergence

**For each FX pair-week, compute:**
- Commercial forced-raw direction (`base_comm_net - quote_comm_net`)
- Non-commercial direction (`base_noncomm_net - quote_noncomm_net`)
- Whether they agree, diverge, or are aligned with delta

The classic COT signal is: when commercials and speculators are on opposite sides, the commercial side is more likely to be right (commercials are hedging against the real economy; speculators are chasing trend and get caught).

**Output table (per book segment):**

```
Commercial vs NonComm        | Pairs | Total% | Win% | Avg% | Notes
─────────────────────────────┼───────┼────────┼──────┼──────┼──────
Comm + NonComm agree         | ???   | ???    | ???  | ???  | both same direction
Comm + NonComm diverge       | ???   | ???    | ???  | ???  | opposite directions
Diverge, use comm dir        | ???   | ???    | ???  | ???  | classic COT: follow hedgers
Diverge, use noncomm dir     | ???   | ???    | ???  | ???  | follow specs (momentum)
```

### Section D: Dealer vs Non-Commercial Cross-Check

**For each FX pair-week, compute:**
- Dealer direction (from `derivePairDirectionsWithNeutral`)
- Non-commercial direction (`base_noncomm_net - quote_noncomm_net`)

```
Dealer vs NonComm            | Pairs | Total% | Win% | Avg%
─────────────────────────────┼───────┼────────┼──────┼──────
Dealer + NonComm agree       | ???   | ???    | ???  | ???
Dealer + NonComm diverge     | ???   | ???    | ???  | ???
NonComm direction on dealer neutrals | ??? | ??? | ??? | ???
NonComm contrarian on dealer neutrals | ??? | ??? | ??? | ???
```

### Section E: Smart Money Alignment Structures

Test multi-source alignment combinations across all pair-weeks:

```
Structure                            | Pairs | Total% | Win% | Avg%
─────────────────────────────────────┼───────┼────────┼──────┼──────
Dealer + Comm agree                  | ???   | ???    | ???  | ???
Dealer + Comm + LM agree             | ???   | ???    | ???  | ???
Dealer + Comm agree + NC diverges    | ???   | ???    | ???  | ???
Dealer + Comm + NC all agree         | ???   | ???    | ???  | ???
D + C agree + LM confirms + NC opposes | ??? | ???   | ???  | ???
```

**How to compute each participant's direction for a pair:**
- **Dealer:** `derivePairDirectionsWithNeutral` with mode "dealer" (uses bias labels)
- **Commercial:** `base_commercial_net - quote_commercial_net` (forced-raw logic, positive = LONG, negative = SHORT)
- **Non-commercial:** `base_noncomm_net - quote_noncomm_net` (same as forced-raw)
- **Lev money:** `base_lev_money_net - quote_lev_money_net`

For all "net - net" calculations: if either base or quote net is null, skip that pair-week for that participant.

**Output these tables for each book segment** (neutral / non-neutral / full book).

### Section F: Enriched Commercial Quality

Test whether non-commercial data improves commercial forced-raw:

```
Filter on forced-raw trades          | Pairs | Total% | Win% | Avg% | vs Baseline
─────────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
Forced raw (baseline)                | ???   | ???    | ???  | ???  | —
+ NonComm diverges (classic COT)     | ???   | ???    | ???  | ???  | +/-X%
+ NonComm agrees                     | ???   | ???    | ???  | ???  | +/-X%
+ NonComm delta confirms comm dir    | ???   | ???    | ???  | ???  | +/-X%
+ Comm traders imbalance (>2:1)      | ???   | ???    | ???  | ???  | +/-X%
+ Dealer agrees with comm dir        | ???   | ???    | ???  | ???  | +/-X%
+ Dealer + NC diverge + comm dir     | ???   | ???    | ???  | ???  | +/-X%
```

"NonComm diverges" = non-commercial direction is opposite to commercial forced-raw direction on that pair. This is the classic COT signal: hedgers and speculators on opposite sides.

"Comm traders imbalance" = `commercial_traders_long / commercial_traders_short > 2` or `< 0.5` — significant skew in how many commercial traders are on each side.

### Section G: Enriched Dealer Quality (Cross-Source)

Test whether cross-source signals improve dealer signals:

```
Filter on dealer non-neutral         | Pairs | Total% | Win% | Avg% | vs Baseline
─────────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
All non-neutral (baseline)           | ???   | ???    | ???  | ???  | —
+ Comm agrees with dealer dir        | ???   | ???    | ???  | ???  | +/-X%
+ Comm disagrees                     | ???   | ???    | ???  | ???  | +/-X%
+ LM agrees (from prior pass)        | ???   | ???    | ???  | ???  | +/-X% (reproduce)
+ LM agrees + Comm agrees            | ???   | ???    | ???  | ???  | +/-X%
+ LM agrees + NC opposes             | ???   | ???    | ???  | ???  | +/-X%
+ Delta confirms + Comm agrees       | ???   | ???    | ???  | ???  | +/-X%
```

And for dealer neutrals:

```
Method for neutral resolution        | Forced | Total% | Win% | vs Lean
─────────────────────────────────────┼────────┼────────┼──────┼────────
Current lean (baseline)              | ???    | ???    | ???  | —
OI-confirmed delta (from prior pass) | ???    | ???    | ???  | (reproduce)
Commercial forced-raw direction      | ???    | ???    | ???  | NEW
NonComm direction                    | ???    | ???    | ???  | NEW
NonComm contrarian                   | ???    | ???    | ???  | NEW
Comm + NC diverge → use comm dir     | ???    | ???    | ???  | NEW
Comm direction + OI confirms         | ???    | ???    | ???  | NEW
```

---

### Output Format

Save to `docs/COT_CROSS_SOURCE_RESEARCH_RESULTS_2026-04-04.md`.

At the bottom, add a **Summary** section answering:
1. Does dealer + commercial agreement improve non-neutral dealer quality?
2. Does commercial vs non-commercial divergence improve commercial forced-raw quality?
3. Can cross-source signals resolve dealer neutrals better than OI-confirmed delta?
4. Which multi-source alignment structure produces the highest quality signal?
5. What is the single most promising canonical upgrade candidate from this pass?
6. Did any finding improve BOTH dealer and commercial signal quality?

---

## Files Changed Summary

| File | Phase | Change |
|------|-------|--------|
| `src/lib/cotFetch.ts` | 1 | Expand legacy `extraFields` with non-commercial + commercial extra fields, expand `CotRow` |
| `src/lib/cotTypes.ts` | 1 | Expand `MarketSnapshot` with non-commercial + commercial metadata |
| `src/lib/cotCompute.ts` | 1 | Expand `CotEnrichment`, expand `buildMarketSnapshot()` with noncomm computed nets |
| `src/lib/cotStore.ts` | 1 | Add `extractLegacyNoncommEnrichment`, `extractLegacyCommercialExtraEnrichment`, update `buildMarketEnrichment` |
| `scripts/backfill-cot-deep-history.ts` | 2 | New script — discover all CFTC dates, fetch missing, re-fetch existing |
| `scripts/research-cot-cross-source.ts` | 3 | New research script — 7 sections, cross-source analysis |

---

## Important Warnings

1. **CFTC legacy API has typos in field names.** `noncomm_postions_spread_all` (not "positions") and `change_in_noncomm_spead_all` (not "spread"). Use the exact misspelled names. Verify against a real API response before hardcoding.
2. **Non-commercial enrichment comes from the legacy/commercial row, NOT the TFF/dealer row.** The TFF feed does not have `noncomm_*` fields. This is different from asset_mgr/lev_money which come from the TFF row.
3. **For disaggregated feed (commodities):** there are no `noncomm_*` fields. The extraction function should return `{}` gracefully — existing pattern handles this since `numberOrNull` returns null for undefined fields.
4. **`noncomm_net = long - short`** (NOT inverted). Only dealer uses inverted convention.
5. **All new fields MUST be optional/nullable.** Existing code must not break.
6. **No direction logic changes.** Phase 1 is ingestion. Phase 3 is research. Nothing canonical changes.
7. **Deep backfill may take 15-30 minutes** depending on how many dates exist. Rate limit at 300-500ms per API call. Log progress clearly.
8. **Research must split ALL result tables into neutral / non-neutral / full book segments.** This is a hard requirement — do not combine them into a single table.
9. **Commercial forced-raw direction for a pair** is computed as: `base_market.commercial_net - quote_market.commercial_net`. If positive → LONG, negative → SHORT. This matches the existing `derivePairDirections` commercial branch.
10. **The research script should reproduce key baselines from prior passes** (dealer non-neutral: 150 pairs / +38.03% / 55.3% WR, dealer neutral lean: 130 pairs / -58.66% / 34.6% WR, commercial forced-raw: 280 pairs / +23.41% / 52.9% WR) to confirm data consistency. If baselines don't match, something is wrong — log the discrepancy and stop.
