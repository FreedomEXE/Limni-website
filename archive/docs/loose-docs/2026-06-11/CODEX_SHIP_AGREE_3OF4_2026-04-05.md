# CODEX: Ship agree_3of4 — Replace Both 3-Source Agreement Systems

**Date:** 2026-04-05
**Goal:** Remove both existing 3-source agreement systems (agree_2of3, agree_2of3_nocomm) and replace with one canonical 4-source agreement system: agree_3of4.

**Research results:** `docs/4SOURCE_AGREEMENT_RESEARCH_2026-04-05.md` and `docs/4SOURCE_AGREEMENT_OPTIMIZATION_2026-04-05.md`
**Ship candidate:** agree_3of4 — require 3+ of 4 sources (dealer, commercial, sentiment, strength) to agree. Skip 2v2 ties. 244 trades, +85.36%, 7.61% DD, 60.7% WR, 3 losing weeks.

---

## What Changes

Three files modified, no new files created.

| File | Action |
|------|--------|
| `src/lib/performance/strategyConfig.ts` | Remove agree_2of3 + agree_2of3_nocomm configs, add agree_3of4, update default + backward compat |
| `src/lib/performance/weeklyHoldEngine.ts` | Remove agree_2of3 + agree_2of3_nocomm resolution blocks, add agree_3of4 block using all 4 sources |
| `src/lib/performance/strategyPageData.ts` | Bump engine version v15 → v16 |

---

## File 1: MODIFY `src/lib/performance/strategyConfig.ts`

### 1a. Add backward compatibility mapping

In `normalizeStrategyLookupId()` (line 41-47), add mappings so old URLs/bookmarks redirect to the new system:

```typescript
function normalizeStrategyLookupId(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value === SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID) {
    return SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID;
  }
  // Backward compat: old 3-source agreement IDs → new 4-source
  if (value === "agree_2of3" || value === "agree_2of3_nocomm") {
    return "agree_3of4";
  }
  return value;
}
```

### 1b. Replace strategy entries in STRATEGIES array

Remove BOTH of these entries:

```typescript
// REMOVE this entry:
{
  id: "agree_2of3",
  label: "2-of-3 Agree",
  type: "agreement",
  description: "Agreement filter requiring at least two of three sources, Dealer, Commercial, and Sentiment, to align before taking a position. When fewer than two agree, the pair is excluded from the basket. Trades fewer pairs but aims for higher-conviction exposure.",
  cardBreakdown: "asset_class",
},
// REMOVE this entry:
{
  id: "agree_2of3_nocomm",
  label: "2-of-3 NoComm",
  type: "agreement",
  description: "Agreement filter requiring at least two of Dealer, Sentiment, and Strength to align before taking a position. Commercial is removed from the voting set so the basket reflects faster directional sources only.",
  cardBreakdown: "asset_class",
},
```

Replace with ONE new entry. Place it in the same position (after the tiered entries, before the selector entry):

```typescript
{
  id: "agree_3of4",
  label: "3-of-4 Agree",
  type: "agreement",
  description: "Agreement filter requiring at least three of four sources — Dealer, Commercial, Sentiment, and Strength — to align before taking a position. When sources split 2-2, the pair is excluded from the basket. Trades only high-conviction setups where a clear directional majority exists across all data sources.",
  cardBreakdown: "asset_class",
},
```

### 1c. Update default strategy

In `resolveStrategyId()` (line 240-244), change the default fallback:

```typescript
export function resolveStrategyId(value: string | undefined | null): string {
  const normalized = normalizeStrategyLookupId(value);
  if (normalized && STRATEGIES.some((s) => s.id === normalized)) return normalized;
  return "agree_3of4";  // was "agree_2of3_nocomm"
}
```

---

## File 2: MODIFY `src/lib/performance/weeklyHoldEngine.ts`

### 2a. Update needsStrengthVotes check

The `needsStrengthVotes` condition (around line 213-216) determines whether strength directions are loaded for composite strategies. agree_3of4 uses all 4 sources including strength. Update the condition:

Current:
```typescript
const needsStrengthVotes =
  biasSource.id === "tiered_3_nocomm"
  || biasSource.id === "agree_2of3_nocomm"
  || (biasSource.type === "tandem" && biasSource.models?.includes("strength"));
```

New:
```typescript
const needsStrengthVotes =
  biasSource.id === "tiered_3_nocomm"
  || biasSource.id === "agree_3of4"
  || (biasSource.type === "tandem" && biasSource.models?.includes("strength"));
```

### 2b. Remove agree_2of3 resolution block

Remove the ENTIRE `if (biasSource.id === "agree_2of3")` block (lines ~254-268). This includes all the code from the `if` statement through the closing `return map;` and `}`.

### 2c. Remove agree_2of3_nocomm resolution block

Remove the ENTIRE `if (biasSource.id === "agree_2of3_nocomm")` block (lines ~291-305). Same scope — from the `if` through `return map;` and `}`.

### 2d. Add agree_3of4 resolution block

Add the new block in place of the removed ones. It should go AFTER the tiered blocks and BEFORE the tandem block:

```typescript
if (biasSource.id === "agree_3of4") {
  const map: DirectionMap = new Map();
  for (const pair of allPairs) {
    const de = dealerMap.get(pair);
    const ce = commMap.get(pair);
    const se = sentMap.get(pair);
    const st = strengthMap.get(pair);
    const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? st?.assetClass ?? inferAssetClass(pair);
    const votes = [de?.direction, ce?.direction, se?.direction, st?.direction].filter(Boolean) as ("LONG" | "SHORT")[];
    const longs = votes.filter((v) => v === "LONG").length;
    const shorts = votes.filter((v) => v === "SHORT").length;
    if (longs >= 3) map.set(pair, { direction: "LONG", source: "agree_3of4", tier: null, assetClass: ac });
    else if (shorts >= 3) map.set(pair, { direction: "SHORT", source: "agree_3of4", tier: null, assetClass: ac });
    // 2-2 ties are skipped — no entry in map
  }
  return map;
}
```

### 2e. Update comment

The comment at line 150 references `agree_2of3`. Update it:

```typescript
// Layer B: this function composes derived strategies (tiered_v3, agree_3of4, tandem)
```

---

## File 3: MODIFY `src/lib/performance/strategyPageData.ts`

Bump the engine version to force full recomputation:

```typescript
// Change from:
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v15";

// To:
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v16";
```

---

## What NOT to Change

- **basketSource.ts** — Only has a comment reference to agree_2of3. Update the comment text if you want, but the functional code is unchanged. The basket provides base signals; the engine composes them.
- **selectorEngine.ts** — Unchanged. Selector is a separate system.
- **performanceLab.ts** — Unchanged. It reads from basket signals, not agreement logic.
- **Dashboard, Data section** — Unchanged. They consume basket signals.
- **No new files needed.** This is a pure replacement within existing files.

---

## Verification

### 1. Type check
```bash
npx tsc --noEmit
```

### 2. Build check
```bash
npm run build
```

### 3. Functional verification

After build passes, verify that the app correctly resolves the new strategy:

- Navigate to Performance page — should default to "3-of-4 Agree" (not the old systems)
- Old URLs with `?strategy=agree_2of3` or `?strategy=agree_2of3_nocomm` should redirect to agree_3of4 via the backward compat mapping
- Performance numbers for agree_3of4 should show ~244 trades over 10 weeks (67.8% coverage)
- The old strategy names should NOT appear in the strategy dropdown

### 4. Refresh performance data

```bash
npx tsx scripts/refresh-performance-latest.ts
```

This forces recomputation with the new engine version. Verify the output mentions the new engine version (v16).

---

## Important Warnings

1. **The agree_3of4 block MUST use all 4 source maps** (dealerMap, commMap, sentMap, strengthMap). The old agree_2of3 only used 3. Make sure the strengthMap is loaded by including `agree_3of4` in the `needsStrengthVotes` condition.

2. **2v2 ties produce NO entry in the direction map.** This means the engine skips that pair for the week. This is correct behavior — it's what makes agree_3of4 selective (244/360 coverage, not 360/360).

3. **Backward compatibility is important.** Users may have bookmarked `?strategy=agree_2of3_nocomm`. The `normalizeStrategyLookupId` mapping ensures they land on agree_3of4 instead of getting an error or falling to a different default.

4. **The default strategy changes.** `resolveStrategyId()` fallback changes from `"agree_2of3_nocomm"` to `"agree_3of4"`. This affects any page that doesn't specify a strategy explicitly.

5. **Engine version bump is mandatory.** Without v15 → v16, the Performance and Matrix pages will show cached results from the old agreement systems.

6. **Do NOT modify any research scripts or docs.** This is a ship prompt only.

7. **File header standard applies.** No new files, but ensure any modified header comments stay accurate.

---

## Expected Production Behavior After Ship

- **Strategy dropdown:** Shows "3-of-4 Agree" where "2-of-3 Agree" and "2-of-3 NoComm" used to be
- **Default strategy:** agree_3of4 (the new default)
- **Trade count:** ~24 trades/week (vs ~36 for the old always-trade agreement systems)
- **Pairs with 2v2 ties:** Excluded from the basket — no position taken
- **Performance:** +85.36%, 7.61% DD, 60.7% WR, 3 losing weeks (over current 10-week backtest window)
- **Old URLs:** Automatically redirect to agree_3of4
