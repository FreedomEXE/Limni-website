# Gate 99ZZB - Revma Basic Multi-Pair SL/TP Controls

Date: 2026-07-07

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Scope

This gate adds a temporary, default-off SL/TP control layer and confirms the
Portfolio EA still has a Revma all-28 evaluation path.

This is not final TP/SL research. No all-28 backtest, optimization, performance
claim, profitability claim, promotion, or live-readiness claim was made.

## Changes

`LimniPortfolioEA` build metadata is now:

- `LP_EA_VERSION=0.1.12-gate99zzb`
- `LP_BUILD_GATE=Gate99ZZB`
- `LP_BUILD_SCOPE=revma-basic-multipair-sltp-controls`

Revma already had the multi-pair switch:

- `RevmaUniverseMode = LP_UNIVERSE_CURRENT_CHART`
- `RevmaUniverseMode = LP_UNIVERSE_FX28`
- `LP_SYMBOL_COUNT = 28`

When `RevmaUniverseMode=LP_UNIVERSE_FX28`, the engine evaluates active Revma
symbols across the 28-pair universe instead of only the chart symbol.

New temporary inputs:

- `EnableBasicStopTakeProfit=false`
- `BasicTakeProfitQ=2.0`
- `BasicStopLossQ=2.0`
- `BasicTakeProfitPct=1.0`
- `BasicStopLossPct=1.0`

The controls are intentionally default-off.

## Behaviour

Single-pair mode:

- Effective mode is `single_pair_q`.
- Revma open/add intents receive price-distance fields derived from q:
  `q * BasicTakeProfitQ` and `q * BasicStopLossQ`.
- The trade router converts those distances into broker-side order `SL` and
  `TP` prices before sending `Buy()` or `Sell()`.
- `order_request` receipts include `basic_sltp_basis`, distance, entry
  reference, calculated stop loss, calculated take profit, and broker minimum
  stop-distance notes.

All-28 mode:

- Effective mode is `all28_account_pct`.
- The EA checks managed open floating PnL as a percent of account balance.
- If open PnL reaches `BasicTakeProfitPct`, it emits a close-all intent with
  `reason=basic_account_tp_pct`.
- If open PnL reaches `-BasicStopLossPct`, it emits a close-all intent with
  `reason=basic_account_sl_pct`.
- The guard emits `basic_sltp_guard` receipts and blocks new entries for that
  engine step.

Close execution still respects the existing execution barriers:

- `EnableCloseExecution`
- `EnableAccountCloseExecution`
- execution mode / tester / live safety gates
- `MaxClosePositionsPerStep`

## Receipts And Reporting

Run manifest summaries now include:

- `basic_sltp_enabled`
- `basic_sltp_effective_mode`
- `basic_take_profit_q`
- `basic_stop_loss_q`
- `basic_take_profit_pct`
- `basic_stop_loss_pct`

Intent and trade-plan receipts include the temporary SL/TP basis and price
distances when active.

New receipt kind:

- `basic_sltp_guard`

## Evidence

Artifacts:

`docs/research/gates/gate99/artifacts/gate99zzb-revma-basic-multipair-sltp-controls-2026-07-07/`

Key files:

- `compile-summary.txt`
- `repo-LimniPortfolioEA-compile-log.txt`
- `active-terminal-LimniPortfolioEA-compile-log.txt`
- `active-terminal-copied-files.txt`
- `repo-active-source-hashes.txt`
- `source-proof.txt`

Compile proof:

- Repo `LimniPortfolioEA`: `Result: 0 errors, 0 warnings`
- Active-terminal `LimniPortfolioEA`: `Result: 0 errors, 0 warnings`

MetaEditor returned exit code `1` on clean logs, matching the known local
MetaEditor pattern.

Source-hash proof confirms the repo source and active-terminal source match for
the EA and copied include files.

## Caveats

- The temporary single-pair q mode attaches broker-side SL/TP to new open/add
  orders. It does not retroactively modify already-open positions.
- The all-28 percent mode is an account-level close-all guard over managed open
  floating PnL percent. It is not the final multi-level TP/SL algorithm.
- This gate did not test exposure/grid-cap behaviour.
- This gate did not run an all-28 backtest.

## Verdict

PASS for narrow implementation and compile proof of:

- existing Revma all-28 universe capability,
- default-off temporary SL/TP inputs,
- single-pair q-distance broker-side SL/TP routing,
- all-28 account-percent close-all guard,
- manifest/intent/plan/order/guard receipt visibility.

