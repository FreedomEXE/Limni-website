# Gate 107C-R - Revma Research-Integrity Correction

Status: runtime repair, independent review, exact-source compile, canonical
tester-profile pin, and two-terminal sync proof complete. One Freedom-owned
controlled telemetry rerun remains open.

## Boundary

This is an execution-truth correction, not a strategy change. It does **not**
change Revma q/state logic, q-anchor or q-stochastic interpretation, birth/add
logic, grid spacing, lot sizing, grid TP/SL formula, account TP/HWM formula,
Candidate B, Kyma, or portfolio formula design.

Codex did not run Strategy Tester, smoke runners, benchmarks, optimization, or
long tests. The remaining runtime evidence is Freedom-owned.

## Corrected evidence contract

- `OutputFolder=AUTO` now uses a short Common Files folder name; the complete
  configuration identity remains in the manifest and summary. Final artifacts
  use a short run-derived stem while retaining these required names:
  `*_revma_grid_outcomes.csv`, `*_revma_bucket_summary.csv`, and
  `*_revma_add_type_summary.csv`.
- Every final artifact is opened independently. Open/header/row failures write
  `revma_telemetry_output_failed` with artifact, full resolved path, file
  scope, MQL error, and attempted row count. Header-only files are written for
  zero-row outcomes.
- Executed births/adds retain `DEAL_POSITION_ID` identity. At deinit, the EA
  reconciles all monetary position deals (entry costs and exit PnL) back to grid
  rows, writes a reconciliation summary plus explicit unmatched-deal rows, and
  marks PnL reconciliation clean only when the difference is within `0.01` and
  no identity is unmatched.
- Router final summaries report successful/failed results, broker rejections,
  no-money/market-closed counts, first/last timestamps, and `formula_clean`.
  Any no-money or broker rejection contamination makes the run formula-unclean.
- Final telemetry includes capacity extrema, terminal reason counts, and a
  compact top-offender artifact for position count, adverse/favourable add
  depth, worst floating PnL, and age.

## Lifecycle and executor corrections

- A `grid_tp` or `grid_sl` now enters a persisted grid-keyed close latch before
  the first close intent. The latch blocks adds, retains the original terminal
  reason, records original/attempted/closed/remaining counts and close cap,
  requeues close work until flat, and clears only after inventory confirms the
  grid is gone.
- Account cleanup records a separate execution owner and cannot overwrite an
  existing `grid_tp` or `grid_sl` terminal reason.
- Managed magic ownership is an allow-list of actually emitted identities:
  Revma/Reversion and TrendFollow/Strict, with a valid long/short direction and
  positive grid family. Other namespace-shaped values are external and cannot
  enter managed PnL, grids, currency counts, account cleanup, or `CLOSE_ALL_EA`.
- Approved FX28 reservations are visible in compact order request/result
  receipts. A proven failure retains its reservation for the remainder of the
  batch by design; this is conservative and may false-block a later intent, but
  it never over-approves against a stale snapshot.

## Telemetry validation terminology

`TelemetryOnly` is a validation label, not a receipt enum. The controlled mode
is:

```text
ReceiptMode=CompactLongRun
OutputFolder=AUTO
```

`ReceiptMode=Off` / `OutputFolder=OFF` is speed/survival-only and cannot be
accepted as attribution or formula-clean evidence.

## Initial Gate 107C-R source identity and proof

The old preset value `7b5b407c02ec4f20c075d659f13a32bc1cc317c8` is not a Git
object and must not identify a controlled run. The initial correction source
commit was `c88bb16a682aebd078669a8b820c4b76ab8f0a16`; metadata/preset commit
`cc93094c5bcffa08f743daffaa30f3656eed2433` pins that exact source tree in the
FX28 preset.

Preflight repository compile artifact:
`docs/research/gates/gate107/artifacts/gate107cr-repo-compile-preflight-20260709/`.

Result: `0 errors, 0 warnings` after the correction source compiled.

Final compile receipts:

- repository: `0 errors, 0 warnings` in `212231 ms`;
- terminal `14275`: `0 errors, 0 warnings` in `273066 ms`;
- terminal `94497`: `0 errors, 0 warnings` in `235036 ms`.

Those logs are retained in
`docs/research/gates/gate107/artifacts/gate107cr-final-terminal-sync-20260709/`.
The first post-sync audit found one stale tester-profile copy on terminal
`94497` while all source hashes already matched. It is retained as a negative
receipt in
`docs/research/gates/gate107/artifacts/gate107cr-postsync-verification-20260709/`.
The controlled re-sync audit then passed with `0` source hash mismatches, `0`
tester-profile mismatches, `0` active-expert stale-input matches, `0`
tester-profile stale-input matches, and `0` unknown running terminals:
`docs/research/gates/gate107/artifacts/gate107cr-profile-resync-verification-20260709/`.

This proof is compile/sync-only. No Strategy Tester, smoke runner, benchmark,
optimization, or long test was run by Codex. The next gate is Freedom-owned
controlled telemetry validation using `CompactLongRun + AUTO`.

## `R90662359` negative runtime evidence

Freedom's controlled run `R90662359`, on source
`c88bb16a682aebd078669a8b820c4b76ab8f0a16`, proved that the broader
lifecycle packet worked but failed the acceptance boundary in two exact ways:

- all `1365` grids ended flat, all `19096` monetary deals matched recorded
  position identifiers, and unmatched counts were zero;
- managed-account PnL was `6712.06`, grid-outcome PnL was `7968.25`, and the
  `-1256.19` difference exactly equalled the complete `account_tp` net
  component omitted by magic-`0` account close deals;
- `173` submissions reached the broker while its symbol session was closed:
  `128` opens/adds and `45` closes, all between `23:58:00` and `00:03:30`
  server time.

The run is rejected as controlled evidence and cannot support profitability or
Gate 108 interpretation. Its immutable packet audit is retained at
`docs/research/gates/gate107/artifacts/GATE107CR_R90662359_NEGATIVE_EVIDENCE_AUDIT_2026-07-10.md`.

## Narrow runtime repair

Source commit `42d2b15b5e1255657328e5bf844c65b107ebf9f9` repairs the
two runtime-integrity defects without changing Revma economics:

- account/grid close requests inherit the selected position's exact managed
  magic immediately before submission;
- reconciliation independently checks position identity and exact expected
  grid magic, so another valid Revma magic cannot mask an attribution defect;
- exact broker-symbol trade sessions are enumerated and checked before opens,
  closes, and broker TP modifications;
- closed-session work is deferred locally, retains its close latch, and remains
  retryable without consuming a close-attempt slot or a broker rejection;
- genuine admitted broker failures, including modification failures, still
  contaminate `formula_clean`;
- final summaries expose session block/defer/metadata-failure counts and first
  and last timestamps.

The repaired build identity is `0.1.26-gate107cr-runtime-integrity`, gate
`Gate107C-R`, scope `revma-account-close-ownership-session-admission`.

Exact committed-source repository compile receipt:
`docs/research/gates/gate107/artifacts/gate107cr-runtime-repair-committed-preflight-20260710/`.

Result: `0 errors, 0 warnings` in `183924 ms`. The generated repository EX5
SHA-256 is
`CE50BF001B178307BAE9BC5F37A2B909F851B9313C06F7F1245D11F8FC51D947`.

Canonical repaired compile/sync receipts:
`docs/research/gates/gate107/artifacts/gate107cr-runtime-repair-compile-sync-20260710/`.

The canonical gate passed:

- repository compile: `0 errors, 0 warnings` in `34826 ms`;
- terminal `14275`: `0 errors, 0 warnings` in `36778 ms`;
- terminal `94497`: `0 errors, 0 warnings` in `35432 ms`;
- source hash mismatches: `0`;
- tester-profile hash mismatches: `0`;
- active-Experts stale-input matches: `0`;
- tester-profile stale-input matches: `0`;
- unknown running terminals: `0`.

The synced tester-profile SHA-256 is
`31F06F23A18CE150C87AD1087175374B703D750BC506EFEF7830DD5EE6BF8A61`
on both terminals and pins source commit
`42d2b15b5e1255657328e5bf844c65b107ebf9f9`. The final repository EX5
from this sync compile has SHA-256
`59490830E02F8F66268E6FD6516421D44F8170CEF0B5BA2E352BB6ED67ED586F`.

The earlier runtime-repair preflight folders are retained as intermediate
compiler receipts; only the exact committed-source preflight and canonical
compile/sync directory above are acceptance proof.

Codex did not run Strategy Tester. Freedom must now run one controlled
validation packet before Gate 107C-R can close.

## Freedom validation profile

The generic FX28 fast-smoke preset remains a base profile and is not the exact
`R90662359` configuration. The stopped-run MT5 agent log preserved the full
input list. Its controlled inputs were recovered into:

`automation/mt5/tester-presets/limni-portfolio-revma-gate107cr-validation.set`.

The dedicated profile changes only the source pin from the rejected run. It
retains the same material validation settings:

- FX28, `MEDIUM_50000`, `0.01` fixed lots, and `0.10 q` grid spacing;
- `GridTakeProfitQ=1.0`;
- `AccountTakeProfitPct=0.01` and account stop loss off;
- currency exposure guard on and `MaxClosePositionsPerStep=300`;
- broker grid-TP sync off in the tester;
- `CompactLongRun`, `AUTO`, and source revision
  `42d2b15b5e1255657328e5bf844c65b107ebf9f9`.

Freedom should load the terminal profile
`LimniPortfolioEA-Gate107CR-Validation.set` and rerun the same tester envelope:
EURUSD.i/M1, Open prices, `2025.01.01` through `2026.01.01`, USD `10000`,
leverage `1:100`. This is a formula-integrity validation only, not a
profitability rerun.

The dedicated profile was synced to terminals `14275` and `94497` with SHA-256
`D5F1B06BFC69A96C7F5AA3D6259B76BE0A23BF8E2B4DA161B8291F21F615C8B2`.
The profile-sync receipt reports `0` source mismatches, `0` profile mismatches,
`0` stale-input matches, and `0` unknown running terminals:

`docs/research/gates/gate107/artifacts/gate107cr-validation-profile-sync-20260710/`.
