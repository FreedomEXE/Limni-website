# CODEX: Strategy Lineup Cleanup — Narrow to 9 Systems

**Date:** 2026-04-06
**Goal:** Clean up the strategy lineup. Remove deprecated systems, rename survivors, upgrade the canonical selector to frag3. The research phase is over — this is the ship-ready lineup.

**Context:**
- Research confirmed: commercial is a fragility layer, not a directional voter
- Veto adds no value beyond what agreement already captures at 36/36
- selector_frag3 is strictly better than the old selector baseline (+100.39% vs +91.96%, same DD)
- The old 2-of-3 agreement systems and the unmodified selector are superseded

---

## The Final 9 Systems

| # | ID | New Label | Type | Status |
|---|---|---|---|---|
| 1 | `dealer` | Dealer | single | **Keep as-is** |
| 2 | `commercial` | Commercial | single | **Keep as-is** |
| 3 | `sentiment` | Sentiment | single | **Keep as-is** |
| 4 | `strength` | Strength | single | **Keep as-is** |
| 5 | `tandem` | Tandem | tandem | **Keep as-is** |
| 6 | `tiered_4w` | **Tiered** | tiered | **Rename label** from "Tiered 4W" |
| 7 | `agree_3of4` | **Agreement** | agreement | **Rename label** from "3-of-4 Agree" |
| 8 | `selector_frag3` | **Selector** | single | **Promote to canonical selector** |
| 9 | `selector_selective` | Selector Selective | single | **Keep as-is** |

### Systems Being REMOVED

| ID | Old Label | Reason |
|---|---|---|
| `agree_2of3` | 2-of-3 Agree | Superseded by 3-of-4 Agreement |
| `agree_2of3_nocomm` | 2-of-3 NoComm | Superseded by 3-of-4 Agreement |
| `selector_sentiment_override` | Selector | Superseded by selector_frag3 |

---

## Changes Required

### File 1: `src/lib/performance/strategyConfig.ts`

#### 1A. Remove old strategy definitions

Remove the `agree_2of3` entry (lines 101-106):
```typescript
// DELETE THIS BLOCK
{
  id: "agree_2of3",
  label: "2-of-3 Agree",
  ...
},
```

Remove the `agree_2of3_nocomm` entry (lines 108-113):
```typescript
// DELETE THIS BLOCK
{
  id: "agree_2of3_nocomm",
  label: "2-of-3 NoComm",
  ...
},
```

Remove the `selector_sentiment_override` entry (lines 122-127):
```typescript
// DELETE THIS BLOCK
{
  id: SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID,
  label: "Selector",
  ...
},
```

#### 1B. Rename labels

Change tiered_4w label:
```typescript
// BEFORE
label: "Tiered 4W",
// AFTER
label: "Tiered",
```

Change agree_3of4 label:
```typescript
// BEFORE
label: "3-of-4 Agree",
// AFTER
label: "Agreement",
```

Update the agree_3of4 description — remove the D+C vs Se+St 2v2 tiebreak detail since it's now the only agreement system. Keep it clean:
```typescript
description: "Four-source agreement filter. Trades when 3 or more of Dealer, Commercial, Sentiment, and Strength align on direction. Ties are selectively resolved when the Sentiment+Strength side agrees, otherwise the pair is skipped.",
```

#### 1C. Promote selector_frag3 as canonical Selector

Change the `selector_frag3` entry:
```typescript
// BEFORE
{
  id: SELECTOR_FRAG3_STRATEGY_ID,
  label: "Selector Frag 3",
  type: "single",
  description: "Canonical selector with a surgical commercial fragility veto. Skips only trades where commercial is opposed, highly extreme, and building against the selector direction at the same time.",
  cardBreakdown: "asset_class",
},
// AFTER
{
  id: SELECTOR_FRAG3_STRATEGY_ID,
  label: "Selector",
  type: "single",
  description: "Sentiment-primary weekly selector with strength tiebreak and commercial fragility filter. Follows sentiment as the base signal, allows a dealer override when sentiment is stretched and weakening, uses strength to resolve conflicts, and skips trades where commercial is simultaneously opposed, extreme, and building against.",
  cardBreakdown: "asset_class",
},
```

#### 1D. Update default fallback

Change `resolveStrategyId()` default from the removed `agree_2of3_nocomm` to the new canonical selector:
```typescript
// BEFORE (line 264)
return "agree_2of3_nocomm";
// AFTER
return SELECTOR_FRAG3_STRATEGY_ID;
```

#### 1E. Update backward-compatibility mapping

The `normalizeStrategyLookupId()` function currently maps:
- `selector_sentiment_context_override` → `selector_sentiment_override`
- `tiered_v3` / `tiered_3_nocomm` → `tiered_4w`

Update it to also map the old selector ID to the new canonical:
```typescript
function normalizeStrategyLookupId(value: string | undefined | null): string | null {
  if (!value) return null;
  // Old selector IDs → new canonical selector (frag3)
  if (value === SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID
      || value === SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID) {
    return SELECTOR_FRAG3_STRATEGY_ID;
  }
  // Old tiered IDs → current tiered
  if (value === "tiered_v3" || value === "tiered_3_nocomm") {
    return TIERED_4W_STRATEGY_ID;
  }
  // Old agreement IDs → current agreement (3-of-4)
  if (value === "agree_2of3" || value === "agree_2of3_nocomm") {
    return AGREE_3OF4_STRATEGY_ID;
  }
  return value;
}
```

This ensures old bookmarks/URLs still work.

#### 1F. Clean up exports

The `SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID` and `SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID` constants are still needed by the normalizer. Keep them but they no longer appear in the STRATEGIES array.

---

### File 2: `src/lib/performance/weeklyHoldEngine.ts`

#### 2A. Remove old selector dispatch

Remove the `selector_sentiment_override` dispatch block (around line 285-287):
```typescript
// DELETE THIS BLOCK
if (biasSource.id === SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID) {
  return resolveSelectorDirections(weekOpenUtc);
}
```

The `resolveSelectorDirections` import can also be removed since nothing else calls it from this file.

Also remove `SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID` from the imports.

#### 2B. Remove agree_2of3 engine logic

Remove the `agree_2of3` block (around lines 369-383):
```typescript
// DELETE THIS BLOCK
if (biasSource.id === "agree_2of3") {
  const map: DirectionMap = new Map();
  for (const pair of allPairs) {
    ...
  }
  return map;
}
```

#### 2C. Remove agree_2of3_nocomm engine logic

Remove the `agree_2of3_nocomm` block (around lines 385-399):
```typescript
// DELETE THIS BLOCK
if (biasSource.id === "agree_2of3_nocomm") {
  const map: DirectionMap = new Map();
  for (const pair of allPairs) {
    ...
  }
  return map;
}
```

#### 2D. Clean up needsStrengthVotes

Remove `"agree_2of3_nocomm"` from the condition:
```typescript
// BEFORE
const needsStrengthVotes =
  biasSource.id === "tiered_4w"
  || biasSource.id === "agree_2of3_nocomm"
  || biasSource.id === "agree_3of4"
  || (biasSource.type === "tandem" && biasSource.models?.includes("strength"));

// AFTER
const needsStrengthVotes =
  biasSource.id === "tiered_4w"
  || biasSource.id === "agree_3of4"
  || (biasSource.type === "tandem" && biasSource.models?.includes("strength"));
```

---

### File 3: `src/lib/performance/strategyPageData.ts`

Bump the artifact engine version to force cache bust:
```typescript
// BEFORE
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v18";
// AFTER
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v19";
```

---

### File 4: `src/lib/performance/basketSource.ts`

Update the comment at line 17 to reflect current strategies:
```typescript
// BEFORE
 * (tiered_v3, agree_2of3, tandem). It must NOT independently rebuild
// AFTER
 * (tiered_4w, agree_3of4, tandem). It must NOT independently rebuild
```

---

### File 5: `src/lib/__tests__/strategyConfig.test.ts`

Update the test. The old selector research ID now maps to `SELECTOR_FRAG3_STRATEGY_ID`:
```typescript
import { describe, expect, it } from "vitest";
import {
  getStrategy,
  resolveStrategyId,
  SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID,
  SELECTOR_FRAG3_STRATEGY_ID,
} from "@/lib/performance/strategyConfig";

describe("performance/strategyConfig", () => {
  it("maps the research selector id to the canonical selector", () => {
    expect(resolveStrategyId(SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID))
      .toBe(SELECTOR_FRAG3_STRATEGY_ID);

    expect(getStrategy(SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID)?.id)
      .toBe(SELECTOR_FRAG3_STRATEGY_ID);
  });

  it("maps removed strategy ids to their replacements", () => {
    expect(resolveStrategyId("agree_2of3")).toBe("agree_3of4");
    expect(resolveStrategyId("agree_2of3_nocomm")).toBe("agree_3of4");
    expect(resolveStrategyId("selector_sentiment_override")).toBe(SELECTOR_FRAG3_STRATEGY_ID);
  });

  it("defaults to selector_frag3 for unknown ids", () => {
    expect(resolveStrategyId("nonexistent")).toBe(SELECTOR_FRAG3_STRATEGY_ID);
    expect(resolveStrategyId(null)).toBe(SELECTOR_FRAG3_STRATEGY_ID);
    expect(resolveStrategyId(undefined)).toBe(SELECTOR_FRAG3_STRATEGY_ID);
  });
});
```

---

## DO NOT TOUCH

- `src/lib/performance/selectorEngine.ts` — No changes. The old `resolveSelectorDirections()` function stays (other code or research scripts may reference it). The frag3 engine path is already implemented and working.
- `src/lib/flagship/canonicalWeeklyBasket.ts` — Uses `tiered_v3` references for the canonical basket generation. This is a separate system with its own lifecycle. Do not change.
- `src/lib/performance/canonicalFlagships.ts` — References `tiered_v3_gated` for the initial weekly flagship. Separate system. Do not change.
- `src/lib/performance/strategyRegistry.ts` — Historical performance registry. Contains frozen data. Do not change.
- `src/lib/performance/gateOverlayDefault.ts` — Historical gate overlay data. Do not change.
- Any research scripts in `scripts/` — These are reference artifacts. Do not modify.

---

## Order of STRATEGIES Array After Changes

The final `STRATEGIES` array should contain exactly these 9 entries in this order:

1. `dealer` — "Dealer"
2. `commercial` — "Commercial"
3. `sentiment` — "Sentiment"
4. `strength` — "Strength"
5. `tandem` — "Tandem"
6. `tiered_4w` — "Tiered"
7. `agree_3of4` — "Agreement"
8. `selector_frag3` — "Selector"
9. `selector_selective` — "Selector Selective"

---

## Validation

Run:
```bash
npm test
npm run build
```

Verify:
1. **STRATEGIES array has exactly 9 entries** — count them
2. **No references to removed IDs remain in dispatched code paths** — `agree_2of3` and `agree_2of3_nocomm` should only exist in the backward-compat normalizer
3. **`resolveStrategyId(null)` returns `"selector_frag3"`** — new default
4. **Old URLs still resolve**: `?strategy=agree_2of3_nocomm` → shows Agreement, `?strategy=selector_sentiment_override` → shows Selector
5. **Tests pass** — updated test file covers all mappings
6. **Build succeeds** — no dead imports, no type errors

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/performance/strategyConfig.ts` | MODIFY — remove 3 strategies, rename 2 labels, update normalizer + default |
| `src/lib/performance/weeklyHoldEngine.ts` | MODIFY — remove 3 dispatch blocks, clean imports + conditions |
| `src/lib/performance/strategyPageData.ts` | MODIFY — bump engine version v18 → v19 |
| `src/lib/performance/basketSource.ts` | MODIFY — update comment |
| `src/lib/__tests__/strategyConfig.test.ts` | MODIFY — update tests for new mappings |

**5 files modified. 0 files created. 0 files deleted.**
