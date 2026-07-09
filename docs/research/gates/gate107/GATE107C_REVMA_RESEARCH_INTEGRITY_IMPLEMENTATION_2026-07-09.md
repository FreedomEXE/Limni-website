# Gate 107C - Revma Research Integrity and Executor Boundary

Status: implemented; compile/sync PASS. Runtime attribution remains unproven
until Freedom's controlled TelemetryOnly run.

## Objective

Make Revma research evidence execution-truthful and keep the portfolio
executor modular without changing strategy behaviour. This gate does not alter
the Revma state signal, q formula, q-anchor or stochastic interpretation, entry
logic, adverse/favourable add rules, grid TP/SL formulas, account TP/HWM
formulas, or optimization inputs.

## Changes

- The sleeve now emits `intent_created`, then moves birth/add state only after
  a router-confirmed `executed_fill` or `partial_fill`. Risk rejects and router
  or broker rejects remain receipts only; they cannot create a birth, increment
  an add count, or enter stale-inventory telemetry.
- Router results carry deal/position tickets, actual lots, actual price,
  retcode, and realised cost components. These are written into lifecycle
  receipts and the final Revma outcome rows only after a confirmed fill.
- Close intents use a terminal taxonomy: `grid_tp`, `grid_sl`,
  `pair_tp_reserved_for_future`, `account_tp`, `account_hwm`,
  `manual_or_external`, `test_end_open`, and `unknown_error`. When an account
  liquidation is active, it exclusively owns the cycle: grid-close evaluation
  and broker TP synchronization do not queue competing closes, and the normal
  close cap remains the single limiter.
- The currency exposure guard reserves approved open/add exposure within an
  intent batch. Later FX28 intents see reserved managed-position, signed/gross
  currency, and same-direction-grid usage rather than the stale refresh
  snapshot. Risk decisions include the reservation outcome.
- Managed ownership now requires a valid Limni magic namespace and successful
  magic decode. Broad-range or malformed magics are external: they are absent
  from position index, PnL, grids, risk counts, account cleanup, and
  `CLOSE_ALL_EA`.
- Live-capable execution requires the timer watchdog; it is enabled by default.
  The FX28 tester preset explicitly keeps the watchdog off for deterministic
  tester cadence and pins `TimerWatchdogSeconds=5`.
- Lifecycle state persists only after executed births, adds, and removals.
  It compacts to active births before a bounded rewrite and records open/header/
  row write failures as `revma_lifecycle_persistence_failed` receipts.
- `BrokerGridTpSyncMode=LiveOnly` is explicit in the FX28 fast/smoke preset.
  EA-level grid exit remains independent of broker-side TP synchronization.

## Research output

The run manifest includes EA/version, source-revision input, config hash,
symbol universe hash, execution and receipt modes, broker-TP mode, watchdog,
guard caps, and Revma formula identifiers.

The receipt stream carries intent/risk/router/fill truth. At deinit, with
output enabled, the EA writes one each of:

- `*_revma_grid_outcomes.csv`: executed birth ticket/lots/price, birth and
  current q metadata, add type/counts, MFE/MAE-style floating extremes, age,
  close owner/reason, costs, final unresolved inventory, and last executed add
  details.
- `*_revma_bucket_summary.csv`: symbol/direction/birth anchor/stochastic/
  terminal-status aggregates.
- `*_revma_add_type_summary.csv`: adverse versus favourable counts, affected
  symbols and grids, open/win/loss counts, and average grid outcome.

Summary-only timings cover closed-M1 scans, Revma evaluation, inventory
refresh, risk reservation, lifecycle persistence, grid-close evaluation,
account-close evaluation, broker TP sync, and receipt flush. There are no
per-tick timing rows or lifecycle CSV writes.

`SourceRevision` is an explicit run-identity input. The fast/smoke preset is
pinned to Gate 107C implementation commit
`7b5b407c02ec4f20c075d659f13a32bc1cc317c8`, so the compiled EA source and
research evidence can be joined without relying on a machine-local Git checkout.

## Module ownership

- `Strategies/RevmaGridSleeve.mqh` and `Strategies/Revma/RevmaResearchTelemetry.mqh` own Revma intentions, executed lifecycle state, and research attribution.
- `Portfolio/RiskArbiter.mqh` and `Portfolio/CurrencyExposureGuard.mqh` own approve/reserve decisions.
- `Execution/TradeRouter.mqh` is the sole trade API owner and execution-truth source.
- `Portfolio/PortfolioStopTakeProfitGuard.mqh` owns account cleanup intent;
  `Core/Engine.mqh` arbitrates exclusive close cycles only.
- `Execution/MagicCodec.mqh` owns identity validation and `Portfolio/PositionIndex.mqh` consumes it for discovery.
- `Receipts/RuntimeTelemetry.mqh` owns compact timing aggregation.

No broad Engine rearchitecture was performed.

## Evidence

Final compile/sync artifact:
`docs/research/gates/gate107/artifacts/gate107c-compile-sync-final-20260709/`.

- Repository source: `0 errors, 0 warnings`.
- Active terminal `14275`: `0 errors, 0 warnings`.
- Active terminal `94497`: `0 errors, 0 warnings`.
- Source-hash mismatches: `0`; tester-profile mismatches: `0`; stale active
  input matches: `0`; stale tester-profile matches: `0`.

MetaEditor returned local process exit code `1` with clean log results; this is
the established local MetaEditor convention. No Strategy Tester, smoke runner,
benchmark, optimization, or long test was run by Codex.

## Next evidence gate

TelemetryOnly full attribution is **not yet accepted**. Gate 107C implements
the data contract; the next valid action is Freedom's controlled TelemetryOnly
run to validate a small set of executed birth/add/reject/close rows, the
deinit summaries, and runtime cost before any pair-TP or account-cleanup
research is reopened.
