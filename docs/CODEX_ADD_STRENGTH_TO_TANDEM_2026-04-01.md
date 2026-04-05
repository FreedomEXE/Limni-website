# Codex Prompt: Add Strength Model to Tandem Strategy

## Goal

Add a new **"Tandem 3"** strategy that runs **Dealer + Sentiment + Strength** as 3 independent models (replacing Commercial with Strength). The existing "Tandem" strategy (Dealer + Commercial + Sentiment) must remain unchanged.

This lets us compare Tandem vs Tandem 3 side-by-side in Performance/Matrix to evaluate whether Commercial should be dropped from top-level baskets.

## Architecture Constraint

The UI is built on a **3-slot card system**. `SlottedTrades` is a 3-element tuple, `CARD_SLOTS` is a 3-element array, and all adapter functions iterate over exactly 3 slots. **Do NOT change this to a dynamic N-slot system.** Tandem 3 has exactly 3 models — it fits the existing 3-slot system. The only change is making *which* 3 models fill the slots configurable per strategy.

## Design

Add a `models` field to `StrategyConfig` for tandem-type strategies. This array of 3 `PerformanceModel` values drives:
- Which signals `resolveDirections` combines
- Which sources `groupByModel` filters by
- Which labels the 3 cards display

Strategies without `models` (all non-tandem strategies) continue working exactly as before.

---

## Files to Change (in order)

### 1. `src/lib/performanceLab.ts` — Add "strength" to PerformanceModel

Current (line 30):
```typescript
export type PerformanceModel =
  | "blended"
  | "dealer"
  | "commercial"
  | "sentiment"
  | "antikythera"
  | "antikythera_v2"
  | "antikythera_v3";
```

Add `| "strength"` to the union.

### 2. `src/lib/performance/modelConfig.ts` — Add strength label

Add `"strength"` to the `PERFORMANCE_MODELS` array (line 5).

Add to `PERFORMANCE_MODEL_LABELS` (line 46):
```typescript
strength: "Strength",
```

### 3. `src/lib/performance/strategyConfig.ts` — Add models field + tandem_3

**Add optional `models` field to `StrategyConfig` type (line 25):**
```typescript
export type StrategyConfig = {
  id: string;
  label: string;
  type: StrategyType;
  description: string;
  cardBreakdown: "asset_class" | "tiers" | "per_model";
  /** For tandem-type strategies: which 3 models fill the card slots. Length must be exactly 3. */
  models?: [PerformanceModel, PerformanceModel, PerformanceModel];
};
```

You'll need to import `PerformanceModel` from `@/lib/performanceLab`.

**Update existing tandem entry (line 82) to include explicit models:**
```typescript
{
  id: "tandem",
  label: "Tandem",
  type: "tandem",
  description: "Dealer + Commercial + Sentiment running independently",
  cardBreakdown: "per_model",
  models: ["dealer", "commercial", "sentiment"],
},
```

**Add tandem_3 entry right after tandem (insert after line 87):**
```typescript
{
  id: "tandem_3",
  label: "Tandem 3",
  type: "tandem",
  description: "Dealer + Sentiment + Strength running independently",
  cardBreakdown: "per_model",
  models: ["dealer", "sentiment", "strength"],
},
```

### 4. `src/lib/performance/weeklyHoldEngine.ts` — Generalize tandem resolution

**4a. Generalize the tandem branch in `resolveDirections` (around line 255):**

Current code only handles `biasSource.id === "tandem"`. Replace with a generic check on `biasSource.type === "tandem"` and read `biasSource.models` to determine which signals to include.

Replace the tandem block (lines ~255-261):
```typescript
if (biasSource.type === "tandem" && biasSource.models) {
  const map: DirectionMap = new Map();
  const modelSignalMap: Record<string, Map<string, DirectionMapEntry>> = {
    dealer: dealerMap,
    commercial: commMap,
    sentiment: sentMap,
  };

  // Build strength map on demand (only if models includes "strength")
  if (biasSource.models.includes("strength")) {
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
    const strengthMap: Map<string, DirectionMapEntry> = new Map();
    for (const row of strengthRows) {
      if (row.compositeDirection === "NEUTRAL") continue;
      strengthMap.set(row.pair.toUpperCase(), {
        direction: row.compositeDirection,
        source: "strength",
        tier: null,
        assetClass: row.assetClass,
      });
    }
    modelSignalMap["strength"] = strengthMap;
  }

  for (const modelId of biasSource.models) {
    const sourceMap = modelSignalMap[modelId];
    if (!sourceMap) continue;
    for (const [pair, entry] of sourceMap) {
      map.set(`${pair}:${modelId}`, { ...entry, source: modelId });
    }
  }
  return map;
}
```

**4b. Fix `isTandem` checks throughout the file.**

Currently: `const isTandem = biasSource.id === "tandem";`

Change to: `const isTandem = biasSource.type === "tandem";`

This appears in two places:
- The weekly hold default executor (around line 320)
- The ADR pullback executor (around line 320 in the ADR section)

Search for ALL occurrences of `biasSource.id === "tandem"` in this file and replace with `biasSource.type === "tandem"`.

### 5. `src/lib/performance/engineAdapter.ts` — Dynamic model slots

This is the most delicate change. The 3-slot system stays, but which 3 models fill the slots becomes strategy-dependent.

**5a. Import StrategyConfig's models field. Add a helper to resolve the 3 card slots (near top, after CARD_SLOTS):**

```typescript
import type { BiasSourceConfig } from "@/lib/performance/strategyConfig";

const DEFAULT_CARD_SLOTS: [PerformanceModel, PerformanceModel, PerformanceModel] = [
  "dealer", "commercial", "sentiment",
];

/** Resolve which 3 models fill the card slots for a given strategy. */
function resolveCardSlots(
  biasSource: BiasSourceConfig,
): [PerformanceModel, PerformanceModel, PerformanceModel] {
  if (biasSource.models) return biasSource.models;
  return DEFAULT_CARD_SLOTS;
}
```

Rename the existing `CARD_SLOTS` constant to `DEFAULT_CARD_SLOTS` (it's used as a fallback).

**5b. Update `groupByModel` to accept the model list:**

```typescript
function groupByModel(
  trades: WeeklyHoldTrade[],
  models: [PerformanceModel, PerformanceModel, PerformanceModel],
): SlottedTrades {
  return [
    trades.filter((t) => t.source === models[0]),
    trades.filter((t) => t.source === models[1]),
    trades.filter((t) => t.source === models[2]),
  ];
}
```

**5c. Update `slotTrades` to pass the models through:**

```typescript
function slotTrades(
  trades: WeeklyHoldTrade[],
  breakdown: BiasSourceConfig["cardBreakdown"],
  models: [PerformanceModel, PerformanceModel, PerformanceModel],
): SlottedTrades {
  switch (breakdown) {
    case "asset_class":
      return groupByAssetClass(trades);
    case "tiers":
      return groupByTier(trades);
    case "per_model":
      return groupByModel(trades, models);
  }
}
```

**5d. Update `getLabels` to handle strength:**

Add a strength entry to `PER_MODEL_LABELS`:
```typescript
const PER_MODEL_LABELS: Record<PerformanceModel, string> = {
  ...PERFORMANCE_MODEL_LABELS,
  dealer: "Dealer Portfolio",
  commercial: "Commercial Portfolio",
  sentiment: "Sentiment Portfolio",
  strength: "Strength Portfolio",
};
```

Also add to `ASSET_CLASS_LABELS` and `TIER_LABELS` (even though strength won't appear in those modes, TypeScript requires complete records):
```typescript
// In ASSET_CLASS_LABELS:
strength: "Strength",
// In TIER_LABELS:
strength: "Strength",
```

**5e. Update ALL functions that use CARD_SLOTS to use `resolveCardSlots(biasSource)` instead.**

This affects:
- `weeklyHoldToGridProps` — pass `biasSource` through, use `resolveCardSlots(biasSource)` instead of `CARD_SLOTS`
- `multiWeekToGridProps` — same
- `singleWeekToSimulation` — same
- `multiWeekToSimulation` — same

In each function, at the top:
```typescript
const cardSlots = resolveCardSlots(biasSource);
```

Then replace all references to `CARD_SLOTS` with `cardSlots`. The iteration pattern stays the same (`.map((slot, i) => ...)`).

Also update `slotTrades(...)` calls to pass `cardSlots`:
```typescript
const slotted = slotTrades(trades, biasSource.cardBreakdown, cardSlots);
```

### 6. `src/lib/performance/strategyPageData.ts` — Bump engine version

Change:
```typescript
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v9";
```

To:
```typescript
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v10";
```

This invalidates all cached artifacts so tandem_3 data computes fresh.

---

## What NOT to Change

- **Existing "tandem" behavior** — must produce identical results. Same 3 models, same signals, same cards.
- **All non-tandem strategies** — completely untouched. The `models` field is optional and only used when present.
- **SlottedTrades tuple type** — stays as `[T[], T[], T[]]`. No dynamic arrays.
- **No new UI components** — tandem_3 appears automatically in the strategy dropdown because `STRATEGIES` array drives the `<select>`.
- **No new files** — all changes are edits to existing files.
- **Bootstrap batching in `strategySelection.ts`** — the batch-of-4 pattern handles the additional combos (now 40 instead of 36). No change needed.

---

## Acceptance Criteria

1. **Tandem 3 appears in strategy dropdown** as "Tandem 3" with description "Dealer + Sentiment + Strength running independently"
2. **Tandem 3 shows 3 cards**: "Dealer Portfolio", "Sentiment Portfolio", "Strength Portfolio"
3. **Existing Tandem unchanged**: still shows Dealer/Commercial/Sentiment cards with identical numbers
4. **All non-tandem strategies unchanged**: identical results, no regressions
5. **ADR Pullback + Tandem 3 works**: isTandem check uses `biasSource.type === "tandem"` so both variants work with ADR entry
6. **ADR Normalized overlay + Tandem 3 works**: overlay is applied after trade computation, no tandem-specific code
7. **All existing tests pass** (`npm test` — 142+ tests)
8. **Build passes** (`npm run build` — 0 errors)
9. **Lint passes** (`npm run lint` — 0 errors)

## Verification

After implementation, run:
```bash
npm test
npm run build
npm run lint
```

Then manually verify in browser:
- Select "Tandem" → should show Dealer/Commercial/Sentiment cards (unchanged)
- Select "Tandem 3" → should show Dealer/Sentiment/Strength cards
- Select "Dealer" → should be completely unchanged
- Try both with Weekly Hold and ADR Pullback
- Try both with None and ADR Normalized overlay

## Bootstrap Impact

Adding 1 strategy adds 4 new bootstrap combos (1 strategy × 2 f1 × 2 f2 = 4). Total goes from 36 to 40. The batch-of-4 loader handles this automatically. No change needed.

---

## File Summary

| File | Change |
|------|--------|
| `src/lib/performanceLab.ts` | Add `"strength"` to `PerformanceModel` union |
| `src/lib/performance/modelConfig.ts` | Add `"strength"` to arrays + labels |
| `src/lib/performance/strategyConfig.ts` | Add `models` field to type, add `tandem_3` entry, add explicit `models` to existing tandem |
| `src/lib/performance/weeklyHoldEngine.ts` | Generalize tandem resolution to read `biasSource.models`, change `isTandem` to check `.type` |
| `src/lib/performance/engineAdapter.ts` | Dynamic card slots via `resolveCardSlots()`, pass models through slot/label functions |
| `src/lib/performance/strategyPageData.ts` | Bump engine version to v10 |
