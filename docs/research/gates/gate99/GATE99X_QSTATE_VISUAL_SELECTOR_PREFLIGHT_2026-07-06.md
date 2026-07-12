# Gate 99X - Q-State Visual And Selector Preflight

Date: 2026-07-06

## Scope

Gate 99X closes the pre-backtest gaps identified after Gate 99W:

```text
1. Katarakti needs visual long/short clarity above and below the centerline.
2. The q-state formula needs a simple chart overlay before tester runs.
3. The EA must not emit first eligible intents in symbol-loop order.
```

No live trading was enabled. No live-readiness claim, promotion claim, or MT5
performance claim was made. `LimniBeta` was not changed.

## Katarakti Visual Status

`automation/mt5/Indicators/Limni/Katarakti.mq5` was initially changed in Gate
99X to split long/short signals above and below the LRMG centerline. Chart
review on `AUDCAD` showed that change disturbed the old marker placement and
made the visual read unreliable.

Hotfix decision:

```text
restore the Gate 99Q / pre-99X Katarakti visual surface
park the above/below-centerline split until it can be redesigned without moving arrows
```

Active Katarakti visual contract after hotfix:

```text
Katarakti Reversal Buy
Katarakti Reversal Sell
Katarakti Continuation Buy
Katarakti Continuation Sell
```

The marker placement is restored to the old close-offset geometry:

```text
buy markers below close
sell markers above close
continuation markers use the larger old offset
```

The above/below-centerline visual requirement remains open for a later, safer
visual-design gate.

## Q-State Direction Indicator

New indicator:

```text
automation/mt5/Indicators/Limni/QStateDirection.mq5
```

Purpose:

```text
Place on a chart and show one large top-right decision:
LONG
SHORT
NO TRADE
```

The indicator resolves the same 28-pair universe and applies the Gate 99W
currency-state direction concept:

```text
pair q-state score
-> currency score aggregation
-> base score minus quote score
-> strong threshold decision
```

Default thresholds:

```text
WeakThreshold = 0.25
StrongThreshold = 1.00
MaxSpreadCostQ = 0.25
```

The overlay is visual-only. EA `q_state`, `portfolio_selector`, `intent`,
`risk_decision`, and `trade_plan` receipts remain the canonical tester proof.

## Portfolio Intent Selector

New strategy-layer selector:

```text
automation/mt5/Experts/Include/Strategies/PortfolioIntentSelector.mqh
```

Gate 99W emitted strategy intents by iterating symbols after q-state scoring.
That could bias the basket toward fixed pair order when too many candidates
were eligible.

Gate 99X changes the strategy-evaluation flow to:

```text
scan all available 28-pair q-state snapshots
filter strong long / strong short candidates
rank by pair-direction strength, pair q-state strength, spread cost, and existing-grid priority
apply pending currency-direction cap using MaxSameDirectionGridsPerCurrency
emit only the selected ranked subset to StrategyRegistry
then RiskArbiter and CurrencyExposureGuard still approve or reject
```

This does not replace the `CurrencyExposureGuard`; it prevents obvious
pair-order bias before intents reach that guard.

New receipt:

```text
portfolio_selector
```

It records candidate count, selected count, pending currency cap, selected
symbols, direction, rank score, and whether the selected item already has an
existing grid.

## Changed Files

```text
automation/mt5/Experts/Include/Core/BuildInfo.mqh
automation/mt5/Experts/Include/Core/Engine.mqh
automation/mt5/Experts/Include/Core/Types.mqh
automation/mt5/Experts/Include/Receipts/ReceiptTypes.mqh
automation/mt5/Experts/Include/Receipts/RunManifest.mqh
automation/mt5/Experts/Include/Strategies/PortfolioIntentSelector.mqh
automation/mt5/Indicators/Limni/Katarakti.mq5
automation/mt5/Indicators/Limni/QStateDirection.mq5
automation/mt5/Experts/Limni/LimniPortfolioEA.ex5
automation/mt5/Indicators/Limni/Katarakti.ex5
automation/mt5/Indicators/Limni/QStateDirection.ex5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99x-qstate-visual-selector-preflight-2026-07-06/
```

Compile logs:

```text
repo-LimniPortfolioEA-compile-log.txt
repo-Katarakti-compile-log.txt
repo-QStateDirection-compile-log.txt
active-LimniPortfolioEA-compile-log.txt
active-Katarakti-compile-log.txt
active-QStateDirection-compile-log.txt
repo-Katarakti-hotfix-restore-placement-compile-log.txt
active-Katarakti-hotfix-restore-placement-compile-log.txt
```

All repo and active-terminal compiles report:

```text
Result: 0 errors, 0 warnings
```

Source parity:

```text
source-hashes.txt
```

All installed repo and active-terminal source hashes match.

Compile summary:

```text
compile-results.txt
```

## Verdict

```text
PASS_GATE99X_QSTATE_VISUAL_SELECTOR_PREFLIGHT_COMPILES_NO_LIVE_CLAIM_NO_BACKTEST_CLAIM
```

## Next Action

Use visual review before MT5 backtests:

```text
1. Add Katarakti to charts and confirm the old reversal/continuation marker placement is restored.
2. Do not rely on above/below-centerline Katarakti visuals yet; that redesign is parked.
3. Add QStateDirection to the target chart and review the known M1/timeframe-pinning issue before tester use.
4. Then run the first tester smoke only after the visual issues are accepted or explicitly waived.
```

The first tester review gate should inspect:

```text
q_state receipts
portfolio_selector receipts
intent receipts
risk_decision receipts
trade_plan receipts
trade_request / trade_result receipts if routing is enabled
grid_inventory receipts
harvest_state receipts if HWM testing is enabled
```
