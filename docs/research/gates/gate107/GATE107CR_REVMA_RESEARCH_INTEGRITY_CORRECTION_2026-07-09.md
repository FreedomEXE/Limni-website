# Gate 107C-R - Revma Research-Integrity Correction

Status: implementation, static review, compile, and terminal-sync proof
complete. Freedom-owned controlled telemetry validation remains open.

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

## Source identity and proof

The old preset value `7b5b407c02ec4f20c075d659f13a32bc1cc317c8` is not a Git
object and must not identify a controlled run. The implementation source commit
is `c88bb16a682aebd078669a8b820c4b76ab8f0a16`; metadata/preset commit
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
