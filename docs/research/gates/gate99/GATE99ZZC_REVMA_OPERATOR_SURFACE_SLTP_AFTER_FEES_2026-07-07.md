# Gate 99ZZC - Revma Operator Surface And SL/TP After Fees

Date: 2026-07-07

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Scope

This gate removes user-facing future-system controls from `LimniPortfolioEA`
and keeps the EA operator surface focused on one active system: Revma.

It also replaces the temporary basic SL/TP controls with a narrower
operator-facing stop/take-profit mode:

- single-pair mode: values are q units;
- multi-currency mode: values are account percent;
- both modes use an estimated close-fee adjustment.

This is still temporary TP/SL scaffolding. It is not the final TP/SL research
algorithm.

## Build Metadata

- `LP_EA_VERSION=0.1.13-gate99zzc`
- `LP_BUILD_GATE=Gate99ZZC`
- `LP_BUILD_SCOPE=revma-only-operator-surface-sltp-after-fees`

## Operator Inputs

Removed from the visible EA input surface:

- `EnableRevmaSystem`
- `RevmaEnableContinuationSleeve`
- `RevmaEnableReversionSleeve`
- `EnableBasicStopTakeProfit`
- `BasicTakeProfitQ`
- `BasicStopLossQ`
- `BasicTakeProfitPct`
- `BasicStopLossPct`
- the full `Future System: Q-State Legacy Disabled` block

Added or simplified:

- `RevmaSleeveMode`
  - `LP_REVMA_SLEEVES_BOTH`
  - `LP_REVMA_SLEEVES_TREND_ONLY`
  - `LP_REVMA_SLEEVES_MEAN_REVERSION_ONLY`
- `StopTakeProfitMode`
  - `LP_SLTP_DISABLED`
  - `LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES`
  - `LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES`
- `TakeProfit`
- `StopLoss`
- `StopTakeProfitCloseCommissionPerLot`

Revma is now the active EA system by construction. The old Q-state path remains
compiled for legacy module compatibility, but it is no longer reachable from
operator inputs or the engine runtime branch.

## Behaviour

Revma universe:

- `RevmaUniverseMode=LP_UNIVERSE_CURRENT_CHART` evaluates only the chart pair.
- `RevmaUniverseMode=LP_UNIVERSE_FX28` evaluates the existing 28-pair FX
  universe.

Single-pair SL/TP mode:

- `StopTakeProfitMode=LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES`.
- `TakeProfit=0.1` means 0.1q.
- `StopLoss=0.1` means 0.1q.
- New Revma birth/add orders receive broker-side `TP`/`SL` price distances.
- TP distance is increased by estimated close-fee price distance.
- SL distance is reduced by estimated close-fee price distance.
- Receipts include raw q distance, fee price adjustment, estimated close fee,
  final price distances, and broker min-stop-distance notes.

Multi-currency SL/TP mode:

- `StopTakeProfitMode=LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES`.
- `TakeProfit=0.1` means 0.1% of account balance.
- `StopLoss=0.1` means 0.1% of account balance.
- The guard evaluates managed open floating PnL after estimated close fees:
  `net_open_money_after_fees = managed_floating_pnl - estimated_close_fee`.
- The percent test is `100 * net_open_money_after_fees / balance`.
- If triggered, the EA emits a close-all managed-position intent.
- Close execution still obeys the existing close/account-close/execution-mode
  safety barriers.

Readable trade comments:

- Revma continuation orders use `RevmaTrend BUY/SELL <symbol> ...`.
- Revma reversion orders use `RevmaMeanRev BUY/SELL <symbol> ...`.
- Account close plans now use readable `Limni Close All ...` text instead of a
  pipe-delimited machine-only comment.

## Receipts

New/updated receipt fields:

- `active_system=revma-v001`
- `revma_sleeve_mode`
- `stop_take_profit_mode`
- `take_profit_value`
- `stop_loss_value`
- `stop_take_profit_close_commission_per_lot`
- `sltp_basis`
- `take_profit_distance_price`
- `stop_loss_distance_price`
- `net_open_pct_after_fees`
- `estimated_close_fee`

New/renamed receipt kind:

- `stop_take_profit_guard`

## Evidence

Artifacts:

`docs/research/gates/gate99/artifacts/gate99zzc-revma-operator-surface-sltp-after-fees-2026-07-07/`

Key files:

- `compile-summary.txt`
- `repo-LimniPortfolioEA-compile-log.txt`
- `active-terminal-LimniPortfolioEA-compile-log.txt`
- `active-terminal-copied-files.txt`
- `repo-active-source-hashes.txt`
- `source-proof.txt`
- `metaeditor-exit-codes.txt`
- `static-old-input-check.txt`

Compile proof:

- Repo `LimniPortfolioEA`: `Result: 0 errors, 0 warnings`
- Active-terminal `LimniPortfolioEA`: `Result: 0 errors, 0 warnings`

MetaEditor returned exit code `1` on both clean compiles, matching the known
local MetaEditor pattern. The compile verdict is based on the result lines.

Source proof:

- `repo-active-source-hashes.txt` shows `source_hash_mismatches=0` for the EA
  and copied include files.

Static source check:

- Current EA source no longer contains `EnableRevmaSystem`,
  `EnableQStateTrendVariant`, `Future System`, `EnableBasicStopTakeProfit`,
  `BasicTakeProfit`, `BasicStopLoss`, or `basic_sltp`.

## Caveats

- No all-28 backtest was run.
- No optimization was run.
- No performance, profitability, promotion, or live-readiness claim is made.
- The close-fee model is a simple per-lot estimate borrowed from the previous
  EA pattern. It is deliberately replaceable by the later TP/SL research algo.
- Single-pair broker-side SL/TP applies to new orders only. It does not
  retroactively modify already-open positions.
- Multi-currency percent mode is an account-level close-all guard for managed
  positions, not the final multi-level TP/SL manager.

## Verdict

PASS for narrow implementation and compile proof of:

- Revma-only operator-facing system surface;
- all-28 capability still available through `RevmaUniverseMode`;
- simplified Revma sleeve dropdown;
- SL/TP dropdown with single-pair q and multi-currency percent modes;
- after-fee receipt fields for both modes;
- readable Revma order comments.
