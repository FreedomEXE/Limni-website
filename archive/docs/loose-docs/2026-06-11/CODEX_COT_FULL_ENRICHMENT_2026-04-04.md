# CODEX: Full COT Enrichment — All Participant Groups + Full-Book Research

**Date:** 2026-04-04
**Goal:** (1) Expand COT ingestion to include all four TFF participant categories plus missing dealer fields. (2) Run comprehensive research testing enrichment as a quality layer on the **full book** — neutral resolution, non-neutral confirmation, non-neutral conflict detection, and cross-category relationships.

**Two phases:** Ingest first, research second. Do NOT change any live canonical direction logic.

---

## Context

The first enrichment pass (completed earlier today) added dealer/commercial delta, OI, and concentration. That pass was too narrow:
- It only tested **neutral pair resolution** for dealer
- It did not test whether enrichment improves or degrades **non-neutral** signals
- It ignored three entire TFF participant categories (asset managers, leveraged funds, other reportables) plus non-reportable/retail
- It treated commercial forced-raw as "solved" — it isn't, it's just a better baseline than the old logic

This pass fixes all of that. We ingest everything the TFF report gives us, then run a full-book research sweep.

### Quality bar for future canonical upgrades
- Improves neutral handling
- Improves or preserves non-neutral quality
- Does not materially worsen DD or losing weeks
- Works across both dealer and commercial research slices

---

## PHASE 1: Full Ingestion Expansion

### Step 1: Expand `src/lib/cotFetch.ts`

**Add all remaining TFF fields to the `tff` dataset's `extraFields`:**

Current `extraFields` for `tff` (8 fields):
```
change_in_dealer_long_all, change_in_dealer_short_all,
open_interest_all, change_in_open_interest_all,
conc_gross_le_4_tdr_long, conc_gross_le_4_tdr_short,
conc_gross_le_8_tdr_long, conc_gross_le_8_tdr_short
```

**Add these fields to the `tff` extraFields array** (verified field names from CFTC API):

```typescript
// Dealer spread + trader counts
"dealer_positions_spread_all",
"change_in_dealer_spread_all",
"pct_of_oi_dealer_long_all",
"pct_of_oi_dealer_short_all",
"pct_of_oi_dealer_spread_all",
"traders_dealer_long_all",
"traders_dealer_short_all",

// Asset Manager (full set)
"asset_mgr_positions_long",
"asset_mgr_positions_short",
"asset_mgr_positions_spread",
"change_in_asset_mgr_long",
"change_in_asset_mgr_short",
"change_in_asset_mgr_spread",
"pct_of_oi_asset_mgr_long",
"pct_of_oi_asset_mgr_short",
"pct_of_oi_asset_mgr_spread",
"traders_asset_mgr_long_all",
"traders_asset_mgr_short_all",
"traders_asset_mgr_spread",

// Leveraged Money / Hedge Funds (full set)
"lev_money_positions_long",
"lev_money_positions_short",
"lev_money_positions_spread",
"change_in_lev_money_long",
"change_in_lev_money_short",
"change_in_lev_money_spread",
"pct_of_oi_lev_money_long",
"pct_of_oi_lev_money_short",
"pct_of_oi_lev_money_spread",
"traders_lev_money_long_all",
"traders_lev_money_short_all",
"traders_lev_money_spread",

// Other Reportables (full set)
"other_rept_positions_long",
"other_rept_positions_short",
"other_rept_positions_spread",
"change_in_other_rept_long",
"change_in_other_rept_short",
"change_in_other_rept_spread",
"pct_of_oi_other_rept_long",
"pct_of_oi_other_rept_short",
"pct_of_oi_other_rept_spread",
"traders_other_rept_long_all",
"traders_other_rept_short",
"traders_other_rept_spread",

// Non-Reportable / Retail
"nonrept_positions_long_all",
"nonrept_positions_short_all",
"change_in_nonrept_long_all",
"change_in_nonrept_short_all",
"pct_of_oi_nonrept_long_all",
"pct_of_oi_nonrept_short_all",

// Net concentration ratios (we only have gross currently)
"conc_net_le_4_tdr_long_all",
"conc_net_le_4_tdr_short_all",
"conc_net_le_8_tdr_long_all",
"conc_net_le_8_tdr_short_all",
```

**Do NOT change `legacy` or `disaggregated` extraFields** — those datasets don't have TFF participant breakdowns. Legacy only has commercial/non-commercial. Keep existing legacy/disaggregated extraFields unchanged.

**Expand the `CotRow` type** to include all new optional fields. Every new field is `?: string` (same pattern as existing fields — CFTC returns stringified numbers):

```typescript
// Add to CotRow type — all optional strings
// Dealer extra
dealer_positions_spread_all?: string;
change_in_dealer_spread_all?: string;
pct_of_oi_dealer_long_all?: string;
pct_of_oi_dealer_short_all?: string;
pct_of_oi_dealer_spread_all?: string;
traders_dealer_long_all?: string;
traders_dealer_short_all?: string;
// Asset Manager
asset_mgr_positions_long?: string;
asset_mgr_positions_short?: string;
asset_mgr_positions_spread?: string;
change_in_asset_mgr_long?: string;
change_in_asset_mgr_short?: string;
change_in_asset_mgr_spread?: string;
pct_of_oi_asset_mgr_long?: string;
pct_of_oi_asset_mgr_short?: string;
pct_of_oi_asset_mgr_spread?: string;
traders_asset_mgr_long_all?: string;
traders_asset_mgr_short_all?: string;
traders_asset_mgr_spread?: string;
// Leveraged Money
lev_money_positions_long?: string;
lev_money_positions_short?: string;
lev_money_positions_spread?: string;
change_in_lev_money_long?: string;
change_in_lev_money_short?: string;
change_in_lev_money_spread?: string;
pct_of_oi_lev_money_long?: string;
pct_of_oi_lev_money_short?: string;
pct_of_oi_lev_money_spread?: string;
traders_lev_money_long_all?: string;
traders_lev_money_short_all?: string;
traders_lev_money_spread?: string;
// Other Reportables
other_rept_positions_long?: string;
other_rept_positions_short?: string;
other_rept_positions_spread?: string;
change_in_other_rept_long?: string;
change_in_other_rept_short?: string;
change_in_other_rept_spread?: string;
pct_of_oi_other_rept_long?: string;
pct_of_oi_other_rept_short?: string;
pct_of_oi_other_rept_spread?: string;
traders_other_rept_long_all?: string;
traders_other_rept_short?: string;
traders_other_rept_spread?: string;
// Non-Reportable
nonrept_positions_long_all?: string;
nonrept_positions_short_all?: string;
change_in_nonrept_long_all?: string;
change_in_nonrept_short_all?: string;
pct_of_oi_nonrept_long_all?: string;
pct_of_oi_nonrept_short_all?: string;
// Net concentration
conc_net_le_4_tdr_long_all?: string;
conc_net_le_4_tdr_short_all?: string;
conc_net_le_8_tdr_long_all?: string;
conc_net_le_8_tdr_short_all?: string;
```

### Step 2: Expand `src/lib/cotTypes.ts`

**Add participant group fields and missing dealer fields to `MarketSnapshot`:**

```typescript
// Add after existing enrichment fields in MarketSnapshot type.
// ALL new fields are optional and nullable.

// Dealer extra
dealer_spread?: number | null;         // spread/hedged book
dealer_spread_delta?: number | null;   // change in spread
dealer_pct_oi_long?: number | null;    // CFTC pre-computed % of OI
dealer_pct_oi_short?: number | null;
dealer_traders_long?: number | null;   // count of traders
dealer_traders_short?: number | null;

// Asset Manager
asset_mgr_long?: number | null;
asset_mgr_short?: number | null;
asset_mgr_spread?: number | null;
asset_mgr_net?: number | null;          // computed: long - short (NOT inverted, asset mgrs are directional like commercial)
asset_mgr_delta_long?: number | null;
asset_mgr_delta_short?: number | null;
asset_mgr_delta_net?: number | null;    // computed: delta_long - delta_short
asset_mgr_pct_oi_long?: number | null;
asset_mgr_pct_oi_short?: number | null;
asset_mgr_traders_long?: number | null;
asset_mgr_traders_short?: number | null;

// Leveraged Money (Hedge Funds)
lev_money_long?: number | null;
lev_money_short?: number | null;
lev_money_spread?: number | null;
lev_money_net?: number | null;          // computed: long - short
lev_money_delta_long?: number | null;
lev_money_delta_short?: number | null;
lev_money_delta_net?: number | null;    // computed: delta_long - delta_short
lev_money_pct_oi_long?: number | null;
lev_money_pct_oi_short?: number | null;
lev_money_traders_long?: number | null;
lev_money_traders_short?: number | null;

// Other Reportables
other_rept_long?: number | null;
other_rept_short?: number | null;
other_rept_spread?: number | null;
other_rept_net?: number | null;         // computed: long - short
other_rept_delta_long?: number | null;
other_rept_delta_short?: number | null;
other_rept_delta_net?: number | null;   // computed: delta_long - delta_short

// Non-Reportable (Retail)
nonrept_long?: number | null;
nonrept_short?: number | null;
nonrept_net?: number | null;            // computed: long - short (contrarian: when retail is max long, be cautious)
nonrept_delta_long?: number | null;
nonrept_delta_short?: number | null;
nonrept_delta_net?: number | null;      // computed: delta_long - delta_short

// Net Concentration (we currently only have gross)
conc_net_4_long?: number | null;
conc_net_4_short?: number | null;
conc_net_8_long?: number | null;
conc_net_8_short?: number | null;
```

### Step 3: Expand `src/lib/cotCompute.ts`

**Expand the `CotEnrichment` type** to accept all the new raw fields from `CotRow`:

```typescript
export type CotEnrichment = {
  // Existing (keep as-is)
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

  // NEW: Dealer extra
  dealer_spread?: number | null;
  dealer_spread_delta?: number | null;
  dealer_pct_oi_long?: number | null;
  dealer_pct_oi_short?: number | null;
  dealer_traders_long?: number | null;
  dealer_traders_short?: number | null;

  // NEW: Asset Manager
  asset_mgr_long?: number | null;
  asset_mgr_short?: number | null;
  asset_mgr_spread?: number | null;
  asset_mgr_delta_long?: number | null;
  asset_mgr_delta_short?: number | null;
  asset_mgr_pct_oi_long?: number | null;
  asset_mgr_pct_oi_short?: number | null;
  asset_mgr_traders_long?: number | null;
  asset_mgr_traders_short?: number | null;

  // NEW: Leveraged Money
  lev_money_long?: number | null;
  lev_money_short?: number | null;
  lev_money_spread?: number | null;
  lev_money_delta_long?: number | null;
  lev_money_delta_short?: number | null;
  lev_money_pct_oi_long?: number | null;
  lev_money_pct_oi_short?: number | null;
  lev_money_traders_long?: number | null;
  lev_money_traders_short?: number | null;

  // NEW: Other Reportables
  other_rept_long?: number | null;
  other_rept_short?: number | null;
  other_rept_spread?: number | null;
  other_rept_delta_long?: number | null;
  other_rept_delta_short?: number | null;

  // NEW: Non-Reportable (Retail)
  nonrept_long?: number | null;
  nonrept_short?: number | null;
  nonrept_delta_long?: number | null;
  nonrept_delta_short?: number | null;

  // NEW: Net concentration
  conc_net_4_long?: number | null;
  conc_net_4_short?: number | null;
  conc_net_8_long?: number | null;
  conc_net_8_short?: number | null;
};
```

**Expand `buildMarketSnapshot()`** to compute derived values and spread all new fields into the return object.

Computed fields:
```typescript
// Asset manager net: long - short (NOT inverted — same convention as commercial)
const assetMgrNet = typeof enrichment?.asset_mgr_long === "number" && typeof enrichment?.asset_mgr_short === "number"
  ? enrichment.asset_mgr_long - enrichment.asset_mgr_short : null;
const assetMgrDeltaNet = typeof enrichment?.asset_mgr_delta_long === "number" && typeof enrichment?.asset_mgr_delta_short === "number"
  ? enrichment.asset_mgr_delta_long - enrichment.asset_mgr_delta_short : null;

// Leveraged money net: long - short
const levMoneyNet = typeof enrichment?.lev_money_long === "number" && typeof enrichment?.lev_money_short === "number"
  ? enrichment.lev_money_long - enrichment.lev_money_short : null;
const levMoneyDeltaNet = typeof enrichment?.lev_money_delta_long === "number" && typeof enrichment?.lev_money_delta_short === "number"
  ? enrichment.lev_money_delta_long - enrichment.lev_money_delta_short : null;

// Other reportables net: long - short
const otherReptNet = typeof enrichment?.other_rept_long === "number" && typeof enrichment?.other_rept_short === "number"
  ? enrichment.other_rept_long - enrichment.other_rept_short : null;
const otherReptDeltaNet = typeof enrichment?.other_rept_delta_long === "number" && typeof enrichment?.other_rept_delta_short === "number"
  ? enrichment.other_rept_delta_long - enrichment.other_rept_delta_short : null;

// Non-reportable net: long - short
const nonreptNet = typeof enrichment?.nonrept_long === "number" && typeof enrichment?.nonrept_short === "number"
  ? enrichment.nonrept_long - enrichment.nonrept_short : null;
const nonreptDeltaNet = typeof enrichment?.nonrept_delta_long === "number" && typeof enrichment?.nonrept_delta_short === "number"
  ? enrichment.nonrept_delta_long - enrichment.nonrept_delta_short : null;
```

**CRITICAL NET DIRECTION CONVENTIONS:**
- `dealer_net` = `short - long` (INVERTED — this is existing, do not change)
- `dealer_delta_net` = `delta_short - delta_long` (same inversion as dealer_net — existing, do not change)
- `asset_mgr_net` = `long - short` (NOT inverted — institutional real money, directional like commercial)
- `lev_money_net` = `long - short` (NOT inverted — speculative directional)
- `other_rept_net` = `long - short`
- `nonrept_net` = `long - short`
- `commercial_net` = `long - short` (existing, do not change)
- `commercial_delta_net` = `delta_long - delta_short` (existing, do not change)

**Spread all new fields into the return object** using `enrichment?.field ?? null` for raw fields and the computed variables for derived fields. Follow the exact same pattern as the existing enrichment fields in the return object.

### Step 4: Expand `src/lib/cotStore.ts`

**Add new extraction functions** following the same pattern as existing `extractDealerEnrichment()`, `extractCommercialEnrichment()`, `extractMarketLevelEnrichment()`.

```typescript
function extractDealerExtraEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    dealer_spread: numberOrNull(row.dealer_positions_spread_all),
    dealer_spread_delta: numberOrNull(row.change_in_dealer_spread_all),
    dealer_pct_oi_long: numberOrNull(row.pct_of_oi_dealer_long_all),
    dealer_pct_oi_short: numberOrNull(row.pct_of_oi_dealer_short_all),
    dealer_traders_long: numberOrNull(row.traders_dealer_long_all),
    dealer_traders_short: numberOrNull(row.traders_dealer_short_all),
  };
}

function extractAssetMgrEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    asset_mgr_long: numberOrNull(row.asset_mgr_positions_long),
    asset_mgr_short: numberOrNull(row.asset_mgr_positions_short),
    asset_mgr_spread: numberOrNull(row.asset_mgr_positions_spread),
    asset_mgr_delta_long: numberOrNull(row.change_in_asset_mgr_long),
    asset_mgr_delta_short: numberOrNull(row.change_in_asset_mgr_short),
    asset_mgr_pct_oi_long: numberOrNull(row.pct_of_oi_asset_mgr_long),
    asset_mgr_pct_oi_short: numberOrNull(row.pct_of_oi_asset_mgr_short),
    asset_mgr_traders_long: numberOrNull(row.traders_asset_mgr_long_all),
    asset_mgr_traders_short: numberOrNull(row.traders_asset_mgr_short_all),
  };
}

function extractLevMoneyEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    lev_money_long: numberOrNull(row.lev_money_positions_long),
    lev_money_short: numberOrNull(row.lev_money_positions_short),
    lev_money_spread: numberOrNull(row.lev_money_positions_spread),
    lev_money_delta_long: numberOrNull(row.change_in_lev_money_long),
    lev_money_delta_short: numberOrNull(row.change_in_lev_money_short),
    lev_money_pct_oi_long: numberOrNull(row.pct_of_oi_lev_money_long),
    lev_money_pct_oi_short: numberOrNull(row.pct_of_oi_lev_money_short),
    lev_money_traders_long: numberOrNull(row.traders_lev_money_long_all),
    lev_money_traders_short: numberOrNull(row.traders_lev_money_short_all),
  };
}

function extractOtherReptEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    other_rept_long: numberOrNull(row.other_rept_positions_long),
    other_rept_short: numberOrNull(row.other_rept_positions_short),
    other_rept_spread: numberOrNull(row.other_rept_positions_spread),
    other_rept_delta_long: numberOrNull(row.change_in_other_rept_long),
    other_rept_delta_short: numberOrNull(row.change_in_other_rept_short),
  };
}

function extractNonreptEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    nonrept_long: numberOrNull(row.nonrept_positions_long_all),
    nonrept_short: numberOrNull(row.nonrept_positions_short_all),
    nonrept_delta_long: numberOrNull(row.change_in_nonrept_long_all),
    nonrept_delta_short: numberOrNull(row.change_in_nonrept_short_all),
  };
}

function extractNetConcentrationEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) return {};
  return {
    conc_net_4_long: numberOrNull(row.conc_net_le_4_tdr_long_all),
    conc_net_4_short: numberOrNull(row.conc_net_le_4_tdr_short_all),
    conc_net_8_long: numberOrNull(row.conc_net_le_8_tdr_long_all),
    conc_net_8_short: numberOrNull(row.conc_net_le_8_tdr_short_all),
  };
}
```

**Update `buildMarketEnrichment()`** to include all new extractors. All new extractors use the `dealerRow` (TFF source) since these participant categories only exist in TFF:

```typescript
function buildMarketEnrichment(
  dealerRow: CotRow | null,
  commercialRow: CotRow | null,
  commercialSource: CotSource,
): CotEnrichment {
  return {
    ...extractDealerEnrichment(dealerRow),
    ...extractDealerExtraEnrichment(dealerRow),        // NEW
    ...extractCommercialEnrichment(commercialRow, commercialSource),
    ...extractAssetMgrEnrichment(dealerRow),            // NEW — from TFF row
    ...extractLevMoneyEnrichment(dealerRow),            // NEW — from TFF row
    ...extractOtherReptEnrichment(dealerRow),           // NEW — from TFF row
    ...extractNonreptEnrichment(dealerRow),             // NEW — from TFF row
    ...extractNetConcentrationEnrichment(dealerRow),    // NEW — from TFF row
    ...extractMarketLevelEnrichment(commercialRow),
    ...extractMarketLevelEnrichment(dealerRow),
  };
}
```

### Step 5: Backfill Historical Snapshots

**Update and re-run `scripts/backfill-cot-enrichment.ts`** — no changes needed to the script itself, since `refreshSnapshotForClass()` now automatically pulls all new fields through the updated extraction pipeline. Just run it again.

After backfill, verify the latest FX snapshot has the new fields populated. Print a verification table like:

```
CCY   | AM_Net    | LM_Net    | NonR_Net  | D_Spread  | D_Traders_L | D_Traders_S
──────┼───────────┼───────────┼───────────┼───────────┼─────────────┼────────────
AUD   | 12345     | -5678     | 8901      | 2345      | 15          | 22
...
```

### Step 6: Verification

1. Run `npx vitest run src/lib/__tests__/cotCompute.test.ts` — must pass (enrichment param is optional, existing callers don't break)
2. Run the backfill
3. Read the latest FX snapshot and confirm all new fields are populated
4. Run `npx tsc --noEmit` on the touched files (cotFetch, cotTypes, cotCompute, cotStore) to confirm type safety
5. Run eslint on touched files

---

## PHASE 2: Full-Book Research

**Script:** `scripts/research-cot-full-book.ts`
**Output:** `docs/COT_FULL_BOOK_RESEARCH_RESULTS_2026-04-04.md`

This script tests enrichment across the **entire book** — not just neutral pairs. It should load all completed weeks, fetch snapshots, returns, and ADR data exactly like the previous research script does (`research-cot-enrichment-quality.ts`). Use that script as the pattern for data loading, week iteration, ADR normalization, and return calculation.

### Section A: Participant Group Summary Table

For each FX currency across all weeks, show each participant group's net positioning and delta:

```
Week   | CCY | Dealer_Net | AM_Net   | LM_Net   | NonR_Net | Comm_Net | D_Δ_Net | AM_Δ_Net | LM_Δ_Net
───────┼─────┼────────────┼──────────┼──────────┼──────────┼──────────┼─────────┼──────────┼─────────
Jan 19 | AUD | 27063      | ???      | ???      | ???      | ???      | -7307   | ???      | ???
```

This is a data dump for eyeballing. Keep it in the output file.

### Section B: Dealer Non-Neutral Signal Quality

For all FX pair-weeks where dealer currently assigns a **non-neutral direction** (LONG or SHORT), test whether enrichment data predicts which signals are stronger or weaker.

**For each non-neutral dealer pair-week, compute:**
- The actual return (ADR-normalized, same as existing engine)
- Whether delta **confirms** the direction (delta_net same sign as dealer_net for that currency pair)
- Whether OI is **expanding** (oi_delta > 0)
- Whether asset managers **agree** (asset_mgr_net same direction as dealer for the pair)
- Whether leveraged funds **agree** (lev_money_net same direction)
- Whether non-reportable/retail is **contrarian** (nonrept_net opposite direction — retail wrong = good)
- Dealer trader count imbalance (significantly more traders on one side)

**Output a comparison table:**

```
Filter                              | Pairs | Total%  | Win% | Avg%  | vs Unfiltered
────────────────────────────────────┼───────┼─────────┼──────┼───────┼──────────────
All non-neutral (baseline)          | ???   | ???     | ???  | ???   | —
+ Delta confirms                    | ???   | ???     | ???  | ???   | +/-X%
+ Delta contradicts                 | ???   | ???     | ???  | ???   | +/-X%
+ OI expanding                      | ???   | ???     | ???  | ???   | +/-X%
+ OI contracting                    | ???   | ???     | ???  | ???   | +/-X%
+ Asset mgr agrees                  | ???   | ???     | ???  | ???   | +/-X%
+ Asset mgr disagrees               | ???   | ???     | ???  | ???   | +/-X%
+ Lev money agrees                  | ???   | ???     | ???  | ???   | +/-X%
+ Lev money disagrees               | ???   | ???     | ???  | ???   | +/-X%
+ Retail contrarian (retail opposes) | ???   | ???     | ???  | ???   | +/-X%
+ Delta confirms + OI expanding     | ???   | ???     | ???  | ???   | +/-X%
+ Delta confirms + AM agrees        | ???   | ???     | ???  | ???   | +/-X%
+ Delta contradicts + LM agrees     | ???   | ???     | ???  | ???   | +/-X% (danger signal?)
```

**How to determine agreement for a pair:**
A pair has base and quote currencies. To check if, say, asset managers "agree" with the dealer direction on pair EURUSD:
1. Get dealer direction for the pair (from existing `derivePairDirectionsWithNeutral` with mode "dealer")
2. For asset managers: compute `base_asset_mgr_net - quote_asset_mgr_net`. If this is positive, asset mgr direction is LONG; negative = SHORT.
3. If asset mgr direction matches dealer direction → agrees. If opposite → disagrees.

Same logic for leveraged money and nonrept (but nonrept agreement is the bad signal — we want nonrept DISAGREEMENT as the quality signal, since retail is usually wrong at extremes).

### Section C: Dealer Neutral Resolution (Expanded)

Repeat the neutral-pair analysis from the first research pass, but now add:

```
Method                              | Forced Pairs | Total% | Win% | vs Lean Baseline
────────────────────────────────────┼──────────────┼────────┼──────┼──────────────────
Current lean (baseline)             | 130          | -58.66 | 34.6 | —
Delta-based                         | 130          | +1.68  | 50.8 | (from prior pass)
OI-confirmed delta                  | 90           | +4.85  | 54.4 | (from prior pass)
Asset mgr direction                 | ???          | ???    | ???  | NEW
Lev money contrarian                | ???          | ???    | ???  | NEW (invert lev_money direction)
AM + Dealer delta agreement         | ???          | ???    | ???  | NEW
OI-confirmed delta + AM agrees      | ???          | ???    | ???  | NEW
Inverted lean                       | 130          | ???    | ???  | NEW (test if lean is reliably wrong)
```

**How to compute "Asset mgr direction" for a neutral dealer pair:**
For the pair EURUSD (base=EUR, quote=USD):
- `am_pair_score = EUR.asset_mgr_net - USD.asset_mgr_net`
- If positive → LONG, if negative → SHORT

**How to compute "Lev money contrarian":**
- `lm_pair_score = EUR.lev_money_net - USD.lev_money_net`
- **INVERT** the direction: if lev money says LONG → go SHORT (contrarian)
- Rationale: hedge funds at extremes are often wrong. This tests whether fading them works on dealer-neutral pairs.

**How to compute "Inverted lean":**
- Take the existing lean score from the first research pass
- Flip the sign: if lean says LONG → go SHORT
- This tests Nyx's hypothesis that the lean tiebreaker is reliably anti-predictive

### Section D: Commercial Enrichment (Full Book)

For all FX pair-weeks, test enrichment on commercial directions (both forced-raw and standard):

```
Method                              | Pairs | Total%  | Win% | vs Forced Raw
────────────────────────────────────┼───────┼─────────┼──────┼──────────────
Forced raw (current baseline)       | 280   | +23.41  | 52.9 | —
+ Delta confirms                    | ???   | ???     | ???  | +/-X%
+ Delta contradicts                 | ???   | ???     | ???  | +/-X%
+ OI expanding                      | ???   | ???     | ???  | +/-X%
+ AM agrees with forced-raw dir     | ???   | ???     | ???  | +/-X%
+ LM disagrees (contrarian)         | ???   | ???     | ???  | +/-X%
+ Delta confirms + OI expanding     | ???   | ???     | ???  | +/-X%
```

This uses commercial delta (`commercial_delta_net`) and OI data to filter forced-raw trades. Same "agreement" logic as Section B but against the commercial forced-raw direction.

### Section E: Cross-Category Signals

Test whether multi-category agreement is a useful quality signal across all FX pair-weeks (dealer non-neutral + commercial + new categories):

```
Agreement Level                     | Pairs | Total% | Win%  | Avg%
────────────────────────────────────┼───────┼────────┼───────┼──────
Dealer only                         | ???   | ???    | ???   | ???
Dealer + AM agree                   | ???   | ???    | ???   | ???
Dealer + AM + Comm agree            | ???   | ???    | ???   | ???
Dealer + AM agree + LM disagree     | ???   | ???    | ???   | ???
Dealer + AM agree + retail opposes  | ???   | ???    | ???   | ???
All smart money agree (D+AM+Comm)   | ???   | ???    | ???   | ???
Smart money agree + dumb opposes    | ???   | ???    | ???   | ???
```

For "agreement": same base_net - quote_net direction comparison. For cross-category, compare direction of each category on the same pair.

---

## Output Format

Save everything to `docs/COT_FULL_BOOK_RESEARCH_RESULTS_2026-04-04.md`.

Include all five sections (A through E) with markdown tables. At the bottom, add a **Summary** section with:
1. Which enrichment signals most improve non-neutral dealer quality?
2. Which enrichment signals most improve neutral resolution?
3. Does commercial benefit from enrichment beyond forced-raw?
4. Which cross-category combinations show the strongest edge?
5. What's the single most promising canonical upgrade candidate from this pass?

---

## Files Changed Summary

| File | Phase | Change |
|------|-------|--------|
| `src/lib/cotFetch.ts` | 1 | Expand TFF `extraFields` with ~60 new fields, expand `CotRow` type |
| `src/lib/cotTypes.ts` | 1 | Expand `MarketSnapshot` with participant groups + dealer extra fields |
| `src/lib/cotCompute.ts` | 1 | Expand `CotEnrichment` type, expand `buildMarketSnapshot()` with new computed nets |
| `src/lib/cotStore.ts` | 1 | Add 6 new extraction functions, update `buildMarketEnrichment()` |
| `scripts/backfill-cot-enrichment.ts` | 1 | Re-run (no code changes needed) |
| `scripts/research-cot-full-book.ts` | 2 | New research script — 5 sections, full-book analysis |

---

## Important Warnings

1. **All new fields MUST be optional/nullable.** The code must never crash on missing data. Not all asset classes will have all participant groups.
2. **Only TFF has the 4 participant categories.** Legacy has commercial/non-commercial. Disaggregated has different categories. The new participant fields come from the dealer row (TFF source) only.
3. **Net direction conventions matter.** Dealer is INVERTED (`short - long`). All other categories use `long - short`. Do NOT invert asset manager, leveraged money, other reportable, or non-reportable nets. This is documented above — follow it exactly.
4. **Do not change any direction logic.** Phase 1 is ingestion only. Phase 2 is research only. No changes to `derivePairDirections*`, `biasFromNet`, or `resolveMarketBias`.
5. **Existing tests must still pass.** The `buildMarketSnapshot()` signature is unchanged (optional `enrichment` param). All existing callers pass 4-5 args and continue working.
6. **JSONB auto-stores new fields.** No database migration needed.
7. **Backfill re-fetches from CFTC API.** ~80 API calls with rate limiting. The backfill script already handles this.
8. **Field names were verified against actual CFTC API.** Note quirks: `traders_other_rept_short` has no `_all` suffix (unlike `traders_other_rept_long_all`). Use the exact names listed above.
9. **Research script should use the same data loading pattern** as `scripts/research-cot-enrichment-quality.ts`: iterate weeks via `listDataSectionWeeks()`, load snapshot via `readSnapshot()`, get returns via `getWeeklyPairReturns()`, get ADR via `loadWeeklyAdrMap()`. All ADR-normalized.
10. **Section B "agreement" comparison must handle missing data gracefully.** If a currency doesn't have `asset_mgr_net` (null), skip that pair-week for the AM agreement filter. Don't crash or count it as disagreement.
