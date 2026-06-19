# Gate 41 Backward Regime Validation Handoff

Date: 2026-06-16

Status: kickstarted. Clean 2025 Slice 1 has a source-gate coverage blocker.
Gate 41 is not a live-strategy promotion gate.

## Kickstart Result

Gate 40 review passed as a research base:

- rows under test remain
  `cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree`
  and `dealer_commercial_agreement_open_friday_strength_agree`;
- fixed hardening remains COT `15` ADR basket SL and Dealer/Commercial
  `0.70` ADR pair inventory SL;
- only pure BE runners at `20%` and `25%` remain on the Gate 41 shortlist;
- basket TP, reset-point trailing, BE-then-reset trailing, broad trailing
  matrices, and ADR Grid spacing/base TP tuning remain frozen.

Clean 2025 hedged-grid receipts were generated for displayed weeks
`2025-01-06` through `2025-09-29`. One latest receipt per `scope.weekLabel` was
selected for scoring: `39` unique weeks, `28` pair summaries per week,
`22,246` total mechanical grid trades, `112` path points per week, and no
missing symbols or default ADR symbols. Four duplicate generated weeks exist
for `2025-07-14`, `2025-07-21`, `2025-07-28`, and `2025-08-04`; they were left
untouched and the latest generated receipt was selected for each week.

The six-row clean 2025 Gate 41 candidate runs were executed with explicit
receipt lists:

- COT receipt:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-39w-20260616-190246.md`
- COT stop-event ledger:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-39w-20260616-190246-stop-events.csv`
- Dealer/Commercial receipt:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-39w-20260616-191152.md`
- Dealer/Commercial stop-event ledger:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-39w-20260616-191152-stop-events.csv`

Both COT and Dealer/Commercial candidate runs returned `0` selected pair sides
and `+0.00` ADR across all rows. Treat this as a data-coverage diagnosis, not a
strategy validation result. The candidate rows require Friday frozen Strength,
but local DB coverage starts too late for clean 2025:

```txt
currency_strength_snapshots: min 2026-01-19 00:00:00, max 2026-06-16 19:00:00
asset_strength_snapshots:    min 2026-01-19 00:00:00, max 2026-06-16 19:00:00
strength_weekly_snapshots:   min 2026-01-19 00:00:00, max 2026-05-24 23:00:00
source_freeze_ledger_weeks:  min 2026-02-23 00:00:00, max 2026-06-14 23:00:00
cot_snapshots fx FutOnly:    min 2019-01-08, max 2026-06-09
```

A one-week diagnostic without `--skip-pair-qualifications` confirmed the
failure mode on `2025-01-06`: COT base row excluded all `28` pairs for
`missing_friday_strength`; Dealer/Commercial excluded `17` pairs for
`missing_friday_strength` and `11` for `dealer_commercial_disagree`.

Current Gate 41 decision: clean 2025 cannot score the Gate 40 candidate rows
until historical Friday Strength/frozen-source coverage is reconstructed or the
test definition is changed. Do not treat the all-zero 2025 result as a pass or
fail of the strategy.

Next handoff after this blocker:

- `docs/research/GATE42_RESEARCH_STATE_CLEANUP_AND_BACKTEST_ENGINE_REARCHITECTURE_2026-06-16.md`

Reason: before more broad sweeps, the dirty research state needs cleanup and
the local backtest pipeline needs speed work. Freedom explicitly flagged
`30`-to-`60` minute test cycles as unacceptable. Gate 42 should improve the
local research kernel first; it should not build the app Research UI yet.

## Purpose

Gate 40 found credible exit-system candidates on the current 2026 closed-week
window. Gate 41 must decide whether those candidates survive other regimes.

The failure mode to guard against is familiar: a strategy looks strong in the
current window, then falls apart when run backward. The next agent should review
Gate 40 first, then design and run the smallest backward test that can falsify
the current candidates.

## Required Recovery Reads

Read these before any Gate 41 test:

1. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
2. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
3. `AGENTS.md`
4. `docs/backlog/CURRENT_WORK.md`
5. `docs/BACKTEST_CANONICAL_PROTOCOL.md`
6. `docs/research/GATE38_DEALER_COMMERCIAL_GRID_AGREEMENT_2026-06-16.md`
7. `docs/research/GATE39_ADR_BASKET_STOP_LOSS_HARDENING_2026-06-16.md`
8. `docs/research/GATE40_TAKE_PROFIT_RUNNER_REVIEW_HANDOFF_2026-06-16.md`
9. This handoff.

Also inspect the implementation surface directly:

- `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`
- `app/scripts/verification/export-fx-hedged-adr-grid-week.ts`

## Gate 40 Review Requirement

Before designing Gate 41, review Gate 40 with skepticism:

- Confirm the two graduated source rows are still the only rows under test:
  - `cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree`
  - `dealer_commercial_agreement_open_friday_strength_agree`
- Confirm fixed hardening candidates:
  - COT: `15` ADR basket SL.
  - Dealer/Commercial: `0.70` ADR pair inventory SL.
- Confirm the current candidate exit system:
  - pure break-even runners only.
  - `20%` and `25%` are the current shortlist.
- Confirm rejected/frozen Gate 40 branches:
  - basket TP,
  - pure reset-point trailing,
  - BE-then-reset trailing,
  - broad trailing-stop matrix,
  - ADR Grid spacing/base TP tuning.
- Confirm reporting separates normal grid TP ADR, runner ADR, stop ADR,
  week-close ADR, runner BE exits, runner week-close exits, and stop-event
  ledgers.

If the implementation or receipts do not support those claims, stop and repair
Gate 40 evidence before opening Gate 41.

## Gate 40 Candidate Summary

Current-2026 window:

- displayed weeks: `2026-01-05` through `2026-06-08`
- excluded partial/current week: `2026-06-15`
- no costs, margin, spread, slippage, or swap
- ADR Grid terms unchanged: `0.20` ADR spacing/TP, `1.0` ADR reset,
  `0.20` ADR reset-entry buffer

Leaders after Gate 40:

```txt
COT + 15 ADR basket SL + 25% runner BE
Total ADR:       +118.27
Worst path DD:   -17.21
Return/DD:         6.87
Week-close ADR:  +17.41
```

```txt
Dealer/Commercial + 0.70 ADR pair SL + 25% runner BE
Total ADR:       +71.28
Worst path DD:    -6.96
Return/DD:        10.24
Week-close ADR:  +35.24
```

Keep `20%` BE as the conservative comparator because it was only slightly
behind `25%` and carries less runner exposure.

## Gate 41 Test Design

Gate 41 should be staged, not one broad 2019-current blast.

### Slice 1: Clean 2025

Recommended first backward slice:

- displayed weeks: `2025-01-06` through `2025-09-29`
- exclude shutdown-affected source report dates `2025-09-30` through
  `2025-12-23` inclusive
- do not score displayed weeks `2025-10-06` through `2025-12-30` as clean live
  source truth

Reason: prior Gate 34 work restored clean pre-shutdown 2025 FX coverage and
identified Sep-Dec 2025 as source-contaminated by the CFTC/COT shutdown and
catch-up schedule. Use clean 2025 first because it is the closest larger
out-of-sample window without intentionally mixing source-quality problems into
the score.

### Slice 2: 2024

Recommended second slice:

- full source/path-covered 2024 displayed weeks, if receipt coverage is intact
- treat 2024 as an adversarial validation year, not an optimization target

Reason: prior Dealer research found 2024 was a true source failure window, not
just a missing-data artifact. If the Gate 40 source/stop/runner stack cannot
survive 2024, do not hide that with 2025+2026 stitched averages. Run the
failure autopsy before tuning.

### Slice 3: Stitched Windows

Only after clean 2025 and 2024 are separately scored:

- clean 2025 + current 2026
- 2024 + clean 2025 + current 2026

Do not stitch first. Separate years should reveal whether the system is robust
or simply averaging one good regime against one bad regime.

### Older Years

Continue backward only after source/path coverage is receipt-backed. Do not run
or trust older windows just because a date range can be typed into a command.

Potential later slices:

- 2023 if COT/source and FX path coverage are clean.
- 2020 as a high-volatility stress year if coverage is clean.
- 2019 only after handling early-2019 source/report caveats.

## Candidate Rows To Score

For each year/slice, score exactly these rows first:

### COT

1. COT fixed hardening, no runner:
   - source row:
     `cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree`
   - stop: `15` ADR basket SL
2. Same row + `20%` BE runner.
3. Same row + `25%` BE runner.

### Dealer/Commercial

1. Dealer/Commercial fixed hardening, no runner:
   - source row:
     `dealer_commercial_agreement_open_friday_strength_agree`
   - stop: `0.70` ADR pair inventory SL
2. Same row + `20%` BE runner.
3. Same row + `25%` BE runner.

Optional controls if the first slice is confusing:

- no-stop/no-runner source row,
- stop-only row,
- no-stop + BE runner.

Do not reintroduce basket TP or trailing runners in the first Gate 41 slice.

## Scorecard

Use risk-adjusted and component-aware scoring, not raw return alone:

- total ADR
- average ADR/week
- worst path DD
- return/DD
- weekly W/L
- weekly profit factor if available
- Sharpe-style weekly score if available
- week-close ADR
- grid TP ADR
- runner ADR
- runner giveback ADR
- runner BE exits
- runner week-close exits
- stop ADR
- stop-event ledgers
- max active fills
- active age at max active
- worst pair and worst currency concentration
- source/path coverage counts

If the script lacks weekly profit factor or Sharpe-style scoring, do not block
the first Gate 41 run. Record the gap and add it only if the first backward
slice is close enough that richer scoring would change the decision.

## Decision Rules

Treat Gate 41 as falsification first:

- A candidate is not robust if it only wins on total ADR while materially
  worsening drawdown, week-close exposure, or concentration.
- If `25%` BE wins return but expands drawdown or exposure meaningfully versus
  `20%`, carry `20%` as the conservative candidate.
- If a year is negative, do not tune immediately. First inspect whether the
  damage is source selection, stop mechanics, runner week-close exposure, pair
  concentration, or currency concentration.
- If clean 2025 passes but 2024 fails, do not average them and call the system
  ready. Open a failure/concentration autopsy.
- No live promotion unless the candidate survives separated years and stitched
  windows with receipt-backed source/path coverage.

## Command Shape

Use explicit receipt lists. Do not rely on a broad date range until the receipt
coverage is inspected.

COT example shape:

```powershell
$receipts = "<comma-separated-clean-year-hedged-grid-json-receipts>"
& npx tsx app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts `
  "--receipts=$receipts" `
  "--variants=cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree" `
  "--basket-sl-adr-thresholds=15" `
  "--runner-configs=0.2:be,0.25:be" `
  --skip-pair-qualifications
```

Dealer/Commercial example shape:

```powershell
$receipts = "<comma-separated-clean-year-hedged-grid-json-receipts>"
& npx tsx app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts `
  "--receipts=$receipts" `
  "--variants=dealer_commercial_agreement_open_friday_strength_agree" `
  "--pair-inventory-sl-adr-thresholds=0.7" `
  "--runner-configs=0.2:be,0.25:be" `
  --skip-pair-qualifications
```

If yearly hedged ADR Grid receipts do not exist, generate them first with the
research-only hedged-grid exporter. Keep receipt generation and strategy scoring
separate in the handoff notes.

## Frozen Areas

Do not do any of the following in Gate 41 unless Freedom explicitly reopens
scope:

- promote live strategy logic
- tune ADR Grid spacing or base `0.20` TP
- add costs, margin, spread, slippage, or swap
- add pair clustering
- use sentiment
- tune source rules from the first backward failure
- add martingale, scaling, or lot sizing logic
- modify release canon
- delete duplicate or stale receipts without approval

## First Task For Next Agent

1. Recover context.
2. Review Gate 40 implementation and receipts.
3. Inventory available hedged ADR Grid receipts for clean 2025.
4. If coverage is clean, run the six-row clean 2025 Gate 41 slice.
5. If clean 2025 fails, stop and diagnose before 2024.
6. If clean 2025 passes, run 2024 separately.

The next agent should not call the system robust until it survives separated
regime slices, not just current 2026.
