# Next Chat Handoff: TradingView ADR Grid Parity

Date: 2026-06-04
Repo: `c:\Users\User\Documents\GitHub\limni-website`
Primary next task: stop treating v2.0.3 as nearly releasable; redesign and reconcile the app engine windows and ADR Grid behavior against the updated TradingView verifier contract.

## High-Priority Update - 2026-06-04

The release is no longer a close v2.0.3 patch. The current work exposed structural problems in the app engine and verification model:

- app market/execution windows are wrong or inconsistent for FX, indices/commodities, and strategy close timing;
- app execution close currently inherits canonical market close for non-crypto instead of a shared Friday 4pm New York strategy close;
- the app's visible ADR Grid/Pair Fill Cap rows do not reliably match the canonical compute path or Pine verifier evidence;
- ADR Grid behavior still needs source-of-truth reconciliation before broader performance/release claims are safe;
- more issues should be expected as parity checks continue.

Do not promote, tag, deploy, or present v2.0.3 as release-ready. Treat it as an active redesign/data-correctness branch until the engine contract, app UI rows, stored ledger rows, and Pine verifier are all aligned.

### Current Timing Contract

The Pine verifier was updated first. The app execution window helper has now been patched to the same strategy execution contract. Market-truth canonical window cleanup is still a separate review item because canonical data rows and visual week boxes have a wider blast radius.

Market-truth weekly open, using `America/New_York` local time:

- FX: Sunday 6pm New York.
- Indices/commodities/default non-crypto: Sunday 7pm New York.
- Crypto: Sunday 8pm New York.

Strategy execution window:

- Execution open: Sunday 8pm New York for all assets.
- Non-crypto execution close: Friday 4pm New York.
- Crypto execution close: next Sunday 8pm New York.

Visual/canonical window:

- The weekly visual/canonical box should stay market-truth open through canonical market close.
- Non-crypto canonical visual close is Friday 5pm New York, while active strategy/grid lines stop at Friday 4pm New York.
- Crypto canonical visual close and execution close are both next Sunday 8pm New York.

### Pine Verifier Changes Already Made

File: `scripts/pinescript/limni-adr-verifier.pine`

Implemented in the verifier:

- New York local timestamp calculations through `timestamp("America/New_York", ...)` so DST does not shift the intended session times.
- Sunday date normalization so weekly feeds that key the week differently still build Sunday-based session timestamps.
- Market-truth open is asset-class aware: FX 6pm, indices/commodities/default 7pm, crypto 8pm New York.
- Execution open is Sunday 8pm New York for all assets.
- Execution close is Friday 4pm New York for non-crypto, next Sunday 8pm New York for crypto.
- Weekly state seeding now waits until the explicit market-truth open instead of blindly using TradingView's raw weekly open.
- `canonicalCloseTs` was added so the weekly visual box can remain canonical while execution/grid activity stops earlier.
- START/STOP markers were added inside the weekly price box, clipped to the price area so they do not bleed into the top header or weekday footer.
- ADR Grid level lines were constrained to the execution window: `gridFillOpenTs` to `gridCloseTs`, not the full canonical weekly box.

Last local verification:

```powershell
git diff --check -- scripts/pinescript/limni-adr-verifier.pine
```

This passed, but Pine cannot be compiled locally. TradingView paste/compile feedback is still required.

### App Timing Changes

These were checked locally before and during the app patch:

- `src/lib/canonicalPriceWindows.ts`
  - FX canonical open is already effectively Sunday 6pm New York in EDT, but close is not the desired strategy close.
  - Indices/commodities canonical open is effectively Sunday 7pm New York in EDT, but close is not the desired strategy close.
  - Crypto is closest to the desired Sunday 8pm to Sunday 8pm behavior.
- `src/lib/executionPriceWindows.ts`
  - now derives execution open/close in `America/New_York`;
  - execution open is Sunday 8pm New York for all assets;
  - non-crypto execution close is Friday 4pm New York;
  - crypto execution close is next Sunday 8pm New York;
  - `EXECUTION_ANCHOR_VERSION` is now `execution_ny_session_v2`.
- Metadata/preload invalidation:
  - `src/lib/executionWeeklyReturns.ts` derivation version is now `v2_execution_ny_session`.
  - `src/lib/performance/strategyArtifactVersions.ts` is now `strategy-artifact-v30`.
  - `src/lib/preload/preloadContract.ts` global preload version was bumped for the ordered-rearm grid contract.

Local test added:

```powershell
npx vitest run src/lib/__tests__/executionPriceWindows.test.ts
```

This passes and covers EDT, EST, and crypto execution close behavior.

### ADR Grid Blockers

The next chat must assume ADR Grid is not finished:

- Pair Fill Cap May 18 remains failed/open.
- Visible app UI, stored ledger rows, and `computeWeeklyHold()`/canonical output still need a fresh reconciliation after the engine version bump.
- ADR Grid was patched to process active fill exits before opening new entries and to require a fresh level retouch after TP before re-entry.
- The old inflated Pair Fill Cap evidence is stale. Runtime samples after the patch dropped EURUSD capped grid counts materially:
  - May 18 week (`2026-05-17T23:00:00.000Z`): EURUSD `7` fills, raw `+0.694024%`, ADR-normalized `+1.4%`; all-system runtime `132` fills, raw `-0.642149%`.
  - May 25 week (`2026-05-24T23:00:00.000Z`): EURUSD `7` fills, raw `+0.633092%`, ADR-normalized `+1.4%`; all-system runtime `118` fills, raw `+16.312718%`.
- Repeated levels can still re-enter on later bars after TP and fresh retouch; same-bar entry/TP churn was the immediate inflation bug that was removed.
- MAE/DD hierarchy is inconsistent: some weeks show useful child/grid DD behavior, other weeks show missing or `0.00%` values that need distinction.
- Do not resume screenshot collection as if parity is done.

### Tool-Call Pitfalls For The Next Chat

Avoid wasting time/tokens:

- Start from repo root `c:\Users\User\Documents\GitHub\limni-website`; the outer workspace is one directory higher.
- Do not dump whole large files unless necessary. Use targeted reads:
  - `rg -n "pattern" path`
  - `Get-Content path | Select-Object -Skip N -First M`
  - `git diff -- path | Select-String -Pattern "..." -Context 2,2`
- Do not run broad `git diff` or `git status` unless needed; this repo is very dirty. Scope commands to the relevant files.
- Do not revert unrelated dirty files. Many modified/untracked files pre-exist.
- Use `apply_patch` for file edits. Do not write files with `cat`, shell redirects, or Python.
- Parallelize independent reads with `multi_tool_use.parallel`, but do not parallelize write operations.
- Do not use web search for local app behavior. Use `rg` and source files first.
- Do not make unrelated app changes. Freedom has now asked for the app timing/grid fixes, but preserve preloading/kernel invalidation discipline and document every contract bump.
- Pine cannot be compiled locally; local checks only catch diff/format issues. TradingView compile feedback from Freedom is required.
- Be careful with "EST" language: the intended rule is New York local time, so use `America/New_York` and let DST resolve UTC offsets.

## Start Here

Use these files as the working map:

- Pine verifier: `scripts/pinescript/limni-adr-verifier.pine`
- Pine levels helper/reference: `scripts/pinescript/limni-adr-levels.pine`
- App-vs-TradingView workflow: `docs/data-verification/APP_TRADINGVIEW_VERIFICATION_WORKFLOW.md`
- Execution matrix: `docs/data-verification/APP_TRADINGVIEW_EXECUTION_MATRIX.md`
- Canonical ADR Grid rule note: `docs/trading/ADR_GRID_CANONICAL_WEEKLY_ANCHOR.md`
- v2 release handoff: `releases/v2/handoff.md`
- v2.0.3 patch notes: `releases/v2/patches/v2.0.3.md`

The immediate resume point is ADR Grid + Pair Fill Cap:

- Completed first-pass blocks: Weekly Hold EURUSD 3-week matrix and ADR Grid no-cap EURUSD 3-week matrix.
- Failed/open block: `ADR Grid`, `Grid Cap Pair Fill Cap`, `Synthetic App Window 21:00 UTC`, `Confirmed 1H`, `Weeks Back = 0/1/2`.
- ADR-normalized Pine screenshots were captured for Weeks Back `0/1/2`, but all old capped-grid screenshots/checkpoints are stale after the ordered-rearm app patch. May 18 and May 25 both now return EURUSD `7` fills / `+1.4%` from `inspect-adr-grid-week`.
- Treat this as a visible app artifact/rollup mismatch, not an accepted TradingView/feed caveat. Raw Pair Fill Cap is paused until visible UI, stored ledger rows, and canonical app output are reconciled.
- App MAE/DD issue is now in scope for the next pass: May 25 shows desired header/grid/fill MAE behavior, but other inspected weeks do not, and some fill rows show `0.00%` MAE that must be distinguished from missing/unknown MAE.

## What Was Done Today

### v2.0.3 Documentation And Evidence

Captured clean app screenshots comparing live v2.0.2 against local v2.0.3 for Tandem / ADR Grid / Pair Fill Cap:

- `releases/v2/screenshots/performance/v2.0.2-live-tandem-adr-grid-pair-fill-cap-summary.png`
- `releases/v2/screenshots/performance/v2.0.2-live-tandem-adr-grid-pair-fill-cap-simulation.png`
- `releases/v2/screenshots/performance/v2.0.3-local-tandem-adr-grid-pair-fill-cap-summary.png`
- `releases/v2/screenshots/performance/v2.0.3-local-tandem-adr-grid-pair-fill-cap-simulation.png`

Key screenshot-backed app result:

| Version | Anchor Model | Return | Max DD | Trades |
| --- | --- | ---: | ---: | ---: |
| v2.0.2 live | legacy execution anchor | +632.67% | 6.26% | 27,529 |
| v2.0.3 local | weekly market anchor | +866.33% | 5.82% | 32,270 |
| Delta | | +233.66% | -0.44 pts | +4,741 |

Also documented plain-number weekly-anchor ADR Grid evidence from `docs/research/ADR_GRID_WEEKLY_ANCHOR_AB_2026-06-02.md`. These rows are research evidence, not screenshot evidence:

| System / Cap | Legacy Return | Weekly Return | Delta Return | Delta DD | Delta Trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tandem / cap on | +632.67% | +877.42% | +244.75% | -0.44 | +5,181 |
| Tandem / no cap | +694.73% | +942.20% | +247.47% | -0.44 | +5,370 |
| Tiered / cap on | +104.77% | +154.68% | +49.90% | -0.16 | +1,071 |
| Tiered / no cap | +128.42% | +172.63% | +44.21% | -0.23 | +1,052 |

Updated the release docs/manifest/docs page around this evidence:

- `releases/v2/verification.md`
- `releases/v2/patches/v2.0.3.md`
- `releases/v2/handoff.md`
- `releases/v2/changes.md`
- `releases/v2/manifest.json`
- `src/app/documents/page.tsx`

Verification completed:

- `npm run lint -- src/app/documents/page.tsx`
- `npm run build`

Build passed. It still emits unrelated Turbopack broad dynamic path warnings.

### Release Version Status

Do not assume v2.0.3 is promoted.

Current release handling:

- `release-manifest.json` still presents app version `v2.0.2` with pending v2.0.3 semantics.
- `releases/v2/manifest.json` contains v2.0.3 evidence/history content.
- Do not tag, push, deploy, update root release manifest to `v2.0.3`, or rematerialize `releases/v2/canon/` unless Freedom explicitly approves.

If v2.0.3 is later promoted, the release step should update root `release-manifest.json`:

- `appVersion: v2.0.3`
- `semanticVersion: 2.0.3`
- likely `cacheNamespace: v2.0.3`
- `previousVersion: v2.0.2`
- remove/clear pending release
- copy/align v2.0.3 changes/history
- keep `canonVersion: v2` unless frozen historical canon artifacts are intentionally rebuilt

### Weekly Hold Exit Research

Extended `scripts/backtest-weekly-hold-adr-exits.ts` to cover all four Weekly Hold systems:

- Tandem
- Tiered
- Agreement
- Selector

Updated `docs/research/WEEKLY_HOLD_ADR_EXIT_RESEARCH_2026-06-02.md` with Agreement/Selector results, weekly win rates, production gate, and next research suggestions.

Current best tested Weekly Hold exit candidate is still only a research benchmark:

- arm trail after pair reaches `+1x ADR`
- trail by `0.40 ADR`

It improves return, DD, Sharpe, and return/DD, but weekly win rate is not production-ready:

| System | Baseline Weekly Win | +1x / 0.40 ADR Trail Weekly Win |
| --- | ---: | ---: |
| Tandem | 63.2% | 57.9% |
| Tiered | 73.7% | 84.2% |
| Agreement | 57.9% | 63.2% |
| Selector | 52.6% | 57.9% |

Freedom's current gate: do not backfill or implement this in the app/Pine until a candidate reaches at least `70%` weekly win rate across all four Weekly Hold systems.

Next research suggestions are already documented in the research file:

- activation sweep: `0.50`, `0.75`, `1.00`, optionally `1.25 ADR`
- trail sweep: `0.20`, `0.30`, `0.40`, `0.60 ADR`
- partial exits: `50%` close / `50%` trail and `33%` close / `67%` trail
- break-even guard after activation
- Friday/time exits
- signal-strength gate
- asset-class split
- rank by weekly win first, then Sharpe, return/DD, total return, DD

Verification completed:

- `npx eslint scripts/backtest-weekly-hold-adr-exits.ts`
- `npx tsx scripts/backtest-weekly-hold-adr-exits.ts`

## Important Source-Of-Truth Decisions

### ADR Grid Model

The source of truth for any reopened TradingView parity pass is the app's current close-and-rearm ADR Grid model.

Do not pivot the Pine verifier toward a partial-runner or seeded-position model right now.

Current app ADR Grid behavior:

- weekly market anchor for grid levels
- execution fill window for non-crypto instruments
- `0.20 ADR` grid steps by default
- independent grid levels from the weekly anchor open
- a fill opens only when a level is touched
- each fill closes fully at the next grid step
- after TP, that level rearms on a later bar
- Pair Fill Cap limits active fills per pair, using active-fill count
- reset close closes remaining active fills and stops that pair/grid for the week

Rejected/deferred model ideas from the research pass:

- market-open seeded position as the production grid model
- partial close and runner-preserving grid behavior
- half-runner trailing / whole-fill trailing variants as a replacement for the current capped Tandem app baseline

### Pine Indicator Status

`scripts/pinescript/limni-adr-verifier.pine` has already been moved toward app-style ADR Grid verification:

- `Mode`: `Weekly Hold` or `ADR Grid`
- `Weekly Hold Anchor`: `Market Truth` or `Execution`
- `Return Basis`: `Raw` or `ADR Normalized`
- `Live Bar`: `Confirmed` or `Realtime`
- `Grid Cap`: `Off` or `Pair Fill Cap`
- `ADR Grid Price Bars`: `Chart / 1m` or `Confirmed 1H`
- Synthetic App Window ADR support
- App-style grid levels, active fills, TP handling, level rearm, reset close
- Visuals for activation-count grid lines, active labels, aggregate DD/favorable/TP boxes

Pine cannot be locally compiled. The next agent needs TradingView paste/compile feedback from Freedom.

## Current Verification State

Weekly Hold EURUSD parity is already accepted across the four anchor/basis combinations:

- Market Truth / Raw: passed
- Market Truth / ADR Normalized: passed
- Execution / Raw: passed
- Execution / ADR Normalized: passed

Known caveat: ADR-normalized cases can show minor denominator/source drift, but trade path and rule parity were accepted.

ADR Grid no-cap parity is accepted for first pass. Use `docs/data-verification/APP_TRADINGVIEW_EXECUTION_MATRIX.md` as the evidence ledger for the remaining Pair Fill Cap block.

ADR Grid no-cap EURUSD accepted checkpoint:

| Week label | TradingView Pine result | App canonical result | Classification |
| --- | ---: | ---: | --- |
| May 31 2026 | `4 fills / 4 TP`, P/L `+0.8%`, Max DD `-0.41%`, ADR `50.5p / 0.44%` | `4 fills / 4 TP`, P/L `+0.8%`, Max DD `-0.4102%`, ADR `0.4396%` | Exact after rounding. |
| May 24 2026 | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-1.63%`, ADR `54.1p / 0.47%` | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-1.6813%`, ADR `0.4522%` | Exact fills/P&L; DD delta about `0.05`. |
| May 17 2026 | `11 fills / 11 TP`, P/L `+2.2%`, Max DD `-0.94%`, ADR `59.1p / 0.51%` | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-0.9963%`, ADR `0.4957%` | One-fill drift; accepted as broker/feed/canonical-store variance. |

Decision: the logic is more important than exact TradingView/app numeric parity. No-cap is accepted; Pair Fill Cap remains failed/open until May 18 visible app output is reconciled.

## Suggested Next Chat Plan

1. Reconcile May 18 visible Basket row against `inspect-adr-grid-week` / `computeWeeklyHold()`.
2. Export/query stored ledger rows when DB access is available.
3. Document whether the visible row is stale, filtered, grouped differently, or generated by a different artifact/path.
4. Add a May 18 Pair Fill Cap regression once the source path is identified.
5. Fix or document modular DD/MAE hierarchy behavior.
6. Only then resume Pair Fill Cap ADR-normalized/Raw screenshots and broader data-correctness checks.

## Commands And Tools

Useful commands from repo root:

```powershell
npm run verification:export-app -- --system all --anchor execution --template
npm run verification:diff -- --app reports/data-verification/app/tiered-tandem-execution-app-trades.json --indicator reports/data-verification/indicator/tiered-tandem-execution-indicator.csv
npm run lint -- src/app/documents/page.tsx
npm run build
npx eslint scripts/backtest-weekly-hold-adr-exits.ts
npx tsx scripts/backtest-weekly-hold-adr-exits.ts
```

Only use the export/diff path if Pine parity is reopened. Manual screenshot/table comparison is no longer the immediate gate for this pass.

## Dirty Worktree Warning

The worktree is intentionally noisy. There are many staged/modified files from the current v2.0.3 verification and release-doc work, plus possible older user/generated changes.

Do not revert unrelated files.

Current relevant files touched today include:

- `docs/research/WEEKLY_HOLD_ADR_EXIT_RESEARCH_2026-06-02.md`
- `docs/TODO.md`
- `scripts/backtest-weekly-hold-adr-exits.ts`
- `releases/v2/verification.md`
- `releases/v2/patches/v2.0.3.md`
- `releases/v2/handoff.md`
- `releases/v2/changes.md`
- `releases/v2/manifest.json`
- `src/app/documents/page.tsx`
- `releases/v2/screenshots/performance/*.png`
- this handoff file

If the next task touches a dirty file, inspect it first and preserve unrelated changes.

## Do Not Do Yet

- Do not push/deploy v2.0.3.
- Do not promote Weekly Hold trailing-stop research into app/Pine production logic.
- Do not start automation until app data-correctness and cost/friction checks pass. ADR Grid TradingView mismatches are now classified as canonical price-store/broker-feed variance for this pass.
- Do not change the ADR Grid source-of-truth model away from current app close-and-rearm behavior without a new explicit decision.
