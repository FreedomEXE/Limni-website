# Canonical Backtest Protocol

Date: 2026-03-29
Status: ACTIVE
Owner: Codex + Freedom

## Purpose

This protocol exists to stop strategy research from drifting away from the app's real source of truth.

Any weekly-bias or intraday backtest is only valid if it can be reconciled to the same canonical inputs the app uses.

If a new script cannot match canonical app baselines, stop research immediately and fix parity first.

## Source Of Truth

### Canonical price bundle

All institutional price-derived research must use one shared canonical price
bundle identity.

Required rule:

- `canonical_price_bars` is the shared bar source.
- Canonical `1m` bars are the forward price truth for new institutional
  systems.
- `pair_period_returns`, ADR maps, ADR Grid/path bars, Weekly Hold outcomes,
  Strength snapshots, regime-layer joins, execution logs, risk overlays, and
  future MT5 parity receipts must trace to the same `price_bundle_id`.
- Local SQLite M1 stores are staging/import repair tools only. They are not
  final institutional evidence unless their rows have been promoted into the
  canonical price bundle and included in the bundle hash.
- Institutional M1 coverage defaults to `100%` of expected tradable session
  bars. Anything below `100%` is diagnostic-only unless Freedom explicitly
  approves a named waiver in the active gate receipt.
- A result that cannot declare its `price_bundle_id` is not promotion-eligible
  and must be labelled diagnostic-only.

Current frozen FX M1 bundle:

- `price_bundle_id`:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Gate receipt:
  `docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md`
- Final audit receipt:
  `app/reports/data-verification/gate55/gate55e-canonical-fx-m1-bundle-20260624T232148Z.json`
- Final audit result: `391` weeks, `10,948/10,948` complete pair-weeks,
  `0` partial pair-weeks, `0` source-gap weeks, and `100.000000%` lowest
  coverage.

Do not build a second backtest engine to solve price lineage. Keep the existing
fast derived artifacts, but bind them to the frozen canonical price bundle.

### Research decision manifest workflow

Gate 55H defines the candidate forward workflow for future institutional
research:

```text
ResearchDecisionManifest
-> shared decision manifest evaluator
-> result/receipt/hash writer
-> append-only research run registry
```

After Gate 55G equivalent-manifest parity is proven, use this path for COT
restatement, Strength selected/fade, Strength buckets, regime-filtered
manifests, and future combined manifests:

```powershell
npm run verification:research-manifest:evaluate -- --manifest=<manifest.json>
```

Until that parity receipt exists, evaluator outputs are diagnostic-only and the
evaluator is not accepted as final shared architecture. The evaluator consumes
already-derived weekly decision rows. Signal derivation belongs upstream in a
manifest builder; ADR Grid and weekly-hold scoring belong in the shared
evaluator. Do not add new Gate-specific scorer functions when a frozen decision
manifest can be routed through:

- `app/src/lib/research/decisionManifest.ts`
- `app/src/lib/research/decisionManifestEvaluator.ts`
- `app/src/lib/research/researchRunRegistry.ts`
- `app/scripts/verification/evaluate-research-decision-manifest.ts`

The command must write a normalized manifest copy, result JSON, Markdown
receipt, hash JSON, and a registry row. Before scoring, it must check the
registry for a materially equivalent run and refuse to rerun unless an explicit
rerun reason is supplied.

### Weekly dealer / commercial / sentiment bias

The canonical weekly base-model source is:

- [basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts)

This module is the approved source for:

- `dealer`
- `commercial`
- `sentiment`

It sits below the strategy engine and above raw data stores.

If interpretation changes, fix it there.

### What the app sections mean

- Data section sentiment shows raw sentiment context from aggregates
- Sentiment trading direction is contrarian to crowding
- Performance weekly-hold uses the canonical strategy engine
- Matrix is a display layer and must not be treated as the canonical research source

Do not infer research truth from UI wording alone.

## Canonical Strategy Engine Path

Approved engine path:

- [weeklyHoldEngine.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/weeklyHoldEngine.ts)
- [strategyPageData.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/strategyPageData.ts)

Approved weekly-bias strategy config:

- [strategyConfig.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/strategyConfig.ts)

Approved current app comparison surface:

- [compare-weekly-bias-selector-vs-app-baselines.ts](C:/Users/User/Documents/GitHub/limni-website/scripts/compare-weekly-bias-selector-vs-app-baselines.ts)
- [rank-current-intraday-strategies.ts](C:/Users/User/Documents/GitHub/limni-website/scripts/rank-current-intraday-strategies.ts)

## Validation Gate

Before trusting any new backtest result, first reproduce the canonical app baselines on the same closed-week window.

### Weekly hold baselines

On the exact closed-week comparison window:

- `dealer`: `+116.64%`, max DD `-40.71%`
- `commercial`: `+28.92%`, max DD `-69.34%`
- `sentiment`: `+129.13%`, max DD `-21.66%`
- `tiered_v3`: `+137.21%`, max DD `-22.89%`
- `agree_2of3`: `+114.98%`, max DD `-21.30%`

### Intraday ADR baselines

On the same canonical closed-week window:

- `sentiment + ADR`: `+49.47%`, max DD `-8.78%`
- `tiered_v3 + ADR`: `+49.16%`, max DD `-9.57%`

If a new research script cannot match these numbers closely enough, do not use its outputs.

## Required Workflow

Every new weekly-bias or intraday backtest must follow this order:

1. Identify the exact strategy family and comparison window.
2. Confirm the script is reading canonical weekly directions from [basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts) or from an engine path that already depends on it.
3. Reproduce the relevant canonical baseline first.
4. Only after parity is confirmed, run the new variant.
5. Compare the variant against the canonical baseline on the same week set.
6. Clearly label whether the result is:
   - canonical app baseline
   - canonical engine variant
   - forced full-basket experiment
   - filtered experiment

## Banned Mistakes

These mistakes invalidate results:

- publishing institutional price-derived results without a `price_bundle_id`
- using local SQLite M1 as final evidence instead of staging/import repair
- accepting sub-100% M1 coverage as complete without a named waiver
- adding a new regime, execution, risk, or signal system that reads a separate
  price path
- comparing a forced full-basket experiment to an app weekly-hold baseline without saying they are different experiments
- using Matrix display output as the research source of truth
- using UI wording alone to infer sentiment direction
- mixing current or future weeks into a closed-week benchmark without explicitly stating it
- treating a display mismatch as proof of a strategy mismatch before checking the underlying canonical source
- building dealer, commercial, or sentiment directions independently from raw snapshots when [basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts) already defines them

## Practical Notes

### Sentiment interpretation

Current app logic is contrarian:

- `CROWDED_LONG` => trade `SHORT`
- `CROWDED_SHORT` => trade `LONG`
- `NEUTRAL` => no trade

That mapping lives in:

- [daily.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/sentiment/daily.ts)

### March 22 / March 23 lesson

One important lesson from the March 22 investigation:

- Data, Performance, and Matrix can look inconsistent because they may be showing different semantics
- the first step is always to compare:
  - raw crowding
  - derived trade direction
  - strategy engine trades
  - displayed board rows

Do not invalidate research from screenshots alone.

## Hand-off Rule

When handing off to Nyx or starting a fresh Codex session, include this exact instruction:

`Before any new backtest, verify parity against canonical app baselines using basketSource.ts and the approved closed-week window. If parity fails, stop research and fix parity first.`

## Related Docs

- [WEEKLY_BIAS_CONTEXT_ENGINE_SPEC_2026-03-29.md](C:/Users/User/Documents/GitHub/limni-website/docs/bots/WEEKLY_BIAS_CONTEXT_ENGINE_SPEC_2026-03-29.md)
- [WEEKLY_BIAS_SELECTOR_SENTIMENT_OVERRIDE_HANDOFF_2026-03-29.md](C:/Users/User/Documents/GitHub/limni-website/docs/bots/WEEKLY_BIAS_SELECTOR_SENTIMENT_OVERRIDE_HANDOFF_2026-03-29.md)
- [CODEX_WEEKLY_RECONSTRUCTION_PROMPT.md](C:/Users/User/Documents/GitHub/limni-website/docs/CODEX_WEEKLY_RECONSTRUCTION_PROMPT.md)
