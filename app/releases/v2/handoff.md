# v2.0.3 Historical Handoff

Date: 2026-06-03

This preserves the pre-promotion release handoff. Current runtime version truth
now lives in `release-manifest.json` and `app/releases/v2/manifest.json`.

## Current State

The pre-promotion workspace had v2.0.3 work focused on:

- ADR Grid weekly anchor reconciliation.
- ADR Grid P/L unit correction.
- ADR Grid drawdown/MAE contract unification, phase 1 implemented for basket MAE rows.
- TradingView verifier parity workflow.
- ADR Grid no-cap restoration in the strategy selector.
- App preloader/kernel hardening so page and strategy switches stay responsive after first release.
- Release documentation and app-visible screenshots.

The app has not been pushed, tagged, or deployed.

## Versioning Call

Keep using `v2.0.3` as the local working ledger until the data-correctness work is complete. If the final approved release ships the ADR Grid P/L unit correction, the persisted drawdown/MAE contract, artifact/cache invalidation, and replacement performance screenshots, promote the ship version to `v3.0.0`.

Reason: this is no longer only a patch-level verifier/preloader correction. It changes the product's performance-data model and materially changes user-facing ADR Grid return/DD numbers. That matches the major-release rule in `releases/VERSIONING_DISCIPLINE.md` better than a patch once the contract is implemented.

## What Changed From v2.0.2

Strategy and data:

- ADR Grid historical execution moved to canonical display-week anchor alignment for this verification pass.
- Pair Fill Cap remains default for ADR Grid, but `None` remains selectable for no-cap comparisons.
- Strategy config normalization explicitly supports ADR Grid `None` and `Pair Fill Cap`.
- Engine adapter/resolved metrics preserve ADR Grid raw vs ADR-normalized semantics.
- Week anchor helper and tests document display-week/current-week boundary behavior.

TradingView verifier:

- Added `scripts/pinescript/limni-adr-verifier.pine`.
- Verifier supports Weekly Hold and ADR Grid modes.
- Verifier supports Market Truth vs Execution anchor checks.
- Verifier supports Raw vs ADR Normalized checks.
- Verifier supports Grid Cap Off vs Pair Fill Cap.
- Verifier visual layer follows the app close-and-rearm ADR Grid model, not rejected runner/refill assumptions.

Kernel and loading:

- `AppPreloadGate` now releases once per browser session and does not re-cover the app after active kernel readiness.
- Active strategy payloads can warm in the background after the app is usable.
- Server canon helpers memoize release artifact reads, delta inventory, and inventory manifests.
- Inventory skips dynamic delta building when release canon already covers the latest closed week.

Documentation:

- v2 release docs now mirror v1's institutional structure.
- v2.0.3 Playwright screenshots were promoted into `releases/v2/screenshots/...`, but are now earlier local evidence from before the ADR Grid P/L unit fix.
- `handoff.md` is now allowed in Documents page release rendering.
- Drawdown/P&L scope expansion is documented in `docs/data-verification/ADR_GRID_DRAWDOWN_UNIFICATION_SPEC_2026-06-03.md`.

## Key Files Staged For Release

High-signal files:

- `release-manifest.json`
- `releases/v2/changes.md`
- `releases/v2/patches/v2.0.3.md`
- `releases/v2/architecture.md`
- `releases/v2/active-systems.md`
- `releases/v2/data-contracts.md`
- `releases/v2/api-surface.md`
- `releases/v2/ui-surfaces.md`
- `releases/v2/verification.md`
- `releases/v2/handoff.md`
- `src/components/AppPreloadGate.tsx`
- `src/components/shared/StrategySelector.tsx`
- `src/lib/canon/canonWeekShard.server.ts`
- `src/lib/performance/weeklyHoldEngine.ts`
- `src/lib/performance/engineAdapter.ts`
- `src/lib/performance/strategyConfig.ts`
- `src/lib/weekAnchor.ts`
- `scripts/pinescript/limni-adr-verifier.pine`
- `scripts/adr-grid-weekly-anchor-ab.ts`

Do not assume unrelated dirty files are part of this release.

## Verification Already Run

Automated:

- Focused Vitest suite: passed, 20 tests.
- `npm run build`: passed.

Browser:

- Playwright on `localhost:3111`: passed.
- Performance to Data to Accounts to Performance flow stayed usable after first release.
- Strategy switch Tandem cap -> Tiered no-cap -> Tandem cap worked.
- No global preloader appeared during page/strategy switches after release.

Screenshots:

- `releases/v2/screenshots/performance/v2.0.2-live-tandem-adr-grid-pair-fill-cap-summary.png`
- `releases/v2/screenshots/performance/v2.0.3-local-tandem-adr-grid-pair-fill-cap-summary.png`
- `releases/v2/screenshots/performance/v2.0.2-live-tandem-adr-grid-pair-fill-cap-simulation.png`
- `releases/v2/screenshots/performance/v2.0.3-local-tandem-adr-grid-pair-fill-cap-simulation.png`

Screenshot status:

- Current v2.0.3 local screenshots are not final go-live evidence.
- They document the earlier weekly-anchor/preloader candidate.
- Replace them after the ADR Grid P/L unit fix and drawdown/MAE contract are carried through the app and rebuilt artifacts.
- Add final replacement screenshots to the selected release manifest so the app Documents page shows them under `v2.0.3` or `v3.0.0`.

Weekly-anchor screenshot evidence:

- v2.0.2 live, legacy execution-anchor behavior: `+632.67%` return, `6.26%` DD, `27,529` trades.
- v2.0.3 local, weekly market-anchor behavior: `+866.33%` return, `5.82%` DD, `32,270` trades.
- Captured delta: `+233.66%` return, `-0.44` DD points, `+4,741` trades.
- Research replay detail remains in `docs/research/ADR_GRID_WEEKLY_ANCHOR_AB_2026-06-02.md`.

## Manual Parity Checkpoint

Completed:

- Weekly Hold EURUSD 3-week test, including current week:
  - Market Truth / Raw: passed, 100% parity.
  - Market Truth / ADR Normalized: passed, 100% parity.
  - Execution / Raw: passed, 100% parity.
  - Execution / ADR Normalized: passed, 100% parity.
- ADR Grid EURUSD 3-week no-cap test:
  - ADR Normalized / Synthetic App Window 21:00 UTC / Confirmed 1H: passed at 90%+ first-pass parity.
  - Raw: accepted as covered by the same close-and-rearm fill path and return math.
  - May 31 2026: Pine and app both `4 fills / +0.8% / -0.41% DD`.
  - May 24 2026: Pine and app both `12 fills / +2.4%`; DD delta about `0.05`.
  - May 17 2026: Pine `11 fills / +2.2%`, app `12 fills / +2.4%`; DD delta about `0.06`.
  - Classification: good enough with TradingView broker/feed vs canonical price-store variance.
  - 2026-06-03 app screenshot captured for current week: Tiered / ADR Grid / None, ADR-normalized, FX, EURUSD SHORT, `4 fills / +0.80%`.

Next:

- ADR Grid + Pair Fill Cap EURUSD parity is failed/open on May 18. Pine ADR-normalized screenshots are captured for Weeks Back `0/1/2`; current week and May 25 match app fills/P&L, but the May 18 visible Basket row shows `2/3 max active`, `5W / 1L`, `+0.19%`, while `computeWeeklyHold()` returns `12` fills and `+2.4%`. Raw remains paused until visible UI, stored ledger rows, and canonical app output are reconciled.
- Treat `reports/data-verification/app/visible-engine-stats-2026-06-04.json` as the active app-visible baseline. Older corrected-path reports are historical/different-basis until reconciled.
- Keep v2.0.3 in data-verification mode. Do not start optimization, trailing stops, grid trailing/escape rules, cap tuning, or automation notes until the parity gate answers whether these numbers are real enough to freeze.
- After the EURUSD Pair Fill Cap blocker is reconciled, verify candidates in this order: Agreement / ADR Grid, Tiered / ADR Grid, Tandem / ADR Grid / Pair Fill Cap, then Tandem / ADR Grid as a high-DD stress reference.
- Initial weeks remain the EURUSD three-week lane: `2026-05-31T23:00:00.000Z`, `2026-05-24T23:00:00.000Z`, and `2026-05-17T23:00:00.000Z`.
- Cross-asset expansion after EURUSD: one FX JPY pair, `XAUUSD`, `WTIUSD`, `JPN225` or `NDX100`, and `BTCUSD` or `ETHUSD`.
- Rebuild versioned ADR Grid artifacts and replace the v2.0.3 screenshots after final app P/L/DD screens are accepted.
- ADR Grid + Pair Fill Cap TradingView ADR-normalized evidence is now captured for the EURUSD first-pass block; reconcile the visible app row before moving on.

## Start The Next Chat Here

1. Review this handoff plus `docs/data-verification/ADR_GRID_DRAWDOWN_UNIFICATION_SPEC_2026-06-03.md`.
2. Confirm the staged diff still contains only intended release files.
3. Continue from the implemented balance/equity/adverse-equity path contract.
4. Treat the project as being in the "found a configuration that works on paper" stage.
5. Verify the data is correct before selecting one system to automate; target `90%+` parity, preferably near `100%`.
6. Reconcile the visible app UI row with `inspect-adr-grid-week` / `computeWeeklyHold()`, then export/query stored ledger rows when DB access is available.
7. If stored ledger rows disagree with `computeWeeklyHold()`, research Pair Fill Cap active-fill accounting on EURUSD May 18: cap scope, same-bar open/close, TP/rearm order, and reset order.
8. After the cap blocker is explained, run Agreement / ADR Grid and Tiered / ADR Grid on the EURUSD three-week lane.
9. Fix MAE/DD hierarchy display and true-zero versus missing MAE semantics.
10. Re-run ADR-normalized then Raw Pair Fill Cap only after the app capped path is trusted.
11. Run the data correctness checklist in `releases/v2/verification.md`, including cross-asset expansion.
12. If app checks pass, explicitly answer whether v2.0.3 numbers are real enough to freeze as the optimization baseline.
13. Only after that answer is yes, select one automation candidate and prepare bot build notes.
14. Prepare release approval notes only after replacement screenshots are captured.

Do not push/deploy/tag until Freedom explicitly approves.
