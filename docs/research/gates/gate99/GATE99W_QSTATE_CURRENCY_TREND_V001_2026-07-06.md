# Gate 99W - Q-State Currency Trend v001

Date: 2026-07-06

## Scope

Gate 99W implements the first isolated strategy lane for `LimniPortfolioEA`:

```text
variant_id = g99w-qstate-v001
lane = trend_follow
family = q_state_machine
runtime variant = LP_VARIANT_STRICT
```

This is a first MT5-testable alpha lane, not a live-readiness gate. Live
trading remains disabled by default, strategy evaluation remains disabled by
default, and open/close routing remains behind explicit switches.

The strategy is not indicator voting. LRMG-derived features are collapsed into
one pair q-state, the pair states are converted into currency q-states across
the 28-pair universe, and the final pair direction comes from base-currency
score minus quote-currency score.

## Implemented Contract

Runtime path:

```text
closed M1 bars
-> LRMGFeatureSnapshot
-> pair_q_score
-> 28-pair currency_q_score
-> pair_direction_score
-> PairDirectionState
-> Strategy intent
-> Risk decision
-> Trade plan
-> TradeRouter
```

The product EA remains:

```text
automation/mt5/Experts/Limni/LimniPortfolioEA.mq5
```

`LimniBeta` was not changed.

## Signal Inputs

`LP_LrmgState` now builds internal closed-M1 feature snapshots without
`iCustom` strategy calls.

Feature fields:

```text
q
anchor
trend_persistence
anchor_displacement
event_direction_persistence
range_position
sweep_resolution
spread_cost_q
pair_q_score
base_currency_score
quote_currency_score
pair_direction_score
market_mode
pair_state
katarakti_signal
event_count
feature_hash
```

The q value is the median completed-day LRMG radius. `QStateScaleLookbackDays=0`
uses all stored completed q-days.

## Formula

Local pair score:

```text
raw_pair_q_score =
  trend_persistence
  + anchor_displacement
  + event_direction_persistence
  + range_position
  + sweep_resolution
```

Costed pair score:

```text
pair_q_score = raw_pair_q_score - spread_cost_q for positive scores
pair_q_score = raw_pair_q_score + spread_cost_q for negative scores
```

Currency score aggregation:

```text
EURUSD pair_q_score = +0.70
EUR += +0.70
USD += -0.70
```

Each currency score is averaged over its available pair contributions. Final
trade direction:

```text
pair_direction_score = currency_score(base) - currency_score(quote)
```

Default state thresholds:

```text
QStateWeakThreshold = 0.25
QStateStrongThreshold = 1.00
QStateMaxSpreadCostQ = 0.25
```

State mapping:

```text
>= +1.00  STRONG_LONG
>= +0.25  WEAK_LONG
near 0    NEUTRAL
<= -0.25  WEAK_SHORT
<= -1.00  STRONG_SHORT
spread cost above max  STRESS / NO_NEW_RISK
```

Market mode is derived from the state:

```text
long states  -> trend_up
short states -> trend_down
neutral low local score -> range
neutral with local pressure -> transition
stress -> stress
```

## Entry Rule

`TrendFollowLane` emits an open-grid intent only when:

```text
EnableStrategyEvaluation = true
EnableQStateTrendVariant = true
session_allowed = true
news_allowed = true
pair_state = STRONG_LONG or STRONG_SHORT
market_mode != STRESS
q > 0
QStateFixedLots > 0
QStateGridSpacingQ > 0
no existing same symbol/lane/variant grid is open
```

Default lot size:

```text
QStateFixedLots = 0.01
```

`WEAK_LONG`, `WEAK_SHORT`, `NEUTRAL`, and `STRESS` do not open new exposure.

## Grid Add Rule

The first grid rule is adverse-only:

```text
QStateGridSpacingQ = 1.0
```

For an existing same-direction grid:

```text
long add  when price <= min_entry_price - (q * QStateGridSpacingQ)
short add when price >= max_entry_price + (q * QStateGridSpacingQ)
```

Default cap:

```text
QStateGridCap = 50
```

Adds use the original grid key so `RiskArbiter` builds the same Limni magic
family for the added leg.

## Exit And Harvest Interaction

The strategy does not close on opposite signals in Gate 99W.

The account-level harvest governor can request an account managed-position
close-all when a configured high-watermark trail is breached. That request goes
through the normal chain:

```text
LP_INTENT_CLOSE_ALL_EA
-> RiskArbiter
-> TradePlan
-> TradeRouter
```

Close-all execution is still guarded by both:

```text
EnableCloseExecution = true
EnableAccountCloseExecution = true
```

After HWM breach and managed positions are flat, the governor enters cooldown.
With the default:

```text
QStateReentryNextDayAfterHarvest = true
```

new entries are blocked until the next server-day start.

## Risk Metadata

Strategy intents include:

```text
variant_id=g99w-qstate-v001
lane_id=LP_LANE_TREND_FOLLOW
variant_id_enum=LP_VARIANT_STRICT
strategy_version_hash=g99w-qstate-v001|q_currency_state_trend|grid_spacing_1q|fixed_lot_0_01
score=pair_direction_score
reason=qstate_strong_direction_open or qstate_adverse_add_1q
```

Currency exposure guard, recovery lock, lot normalization, max single order
lots, open routing, close routing, and account-close routing remain centralized
outside the strategy lane.

## Expected Receipts

Gate 99W adds or uses these receipt paths:

```text
q_state
signal
intent
risk_decision
trade_plan
trade_request
trade_result
grid_inventory
harvest_state
currency_exposure
news_guard
run_manifest
summary
```

The `q_state` receipt contains:

```text
variant_id
market_mode
direction
price
q
anchor
trend_persistence
anchor_displacement
event_direction_persistence
range_position
sweep_resolution
spread_cost_q
pair_q_score
base_currency_score
quote_currency_score
pair_direction_score
katarakti_signal
event_count
feature_hash
session_allowed
news_allowed
```

## Default Safety State

Compile-safe defaults still do not trade:

```text
ExecutionMode = LP_EXECUTION_DISABLED
EnableTrading = false
AllowLiveTrading = false
EnableOpenOrderRouting = false
EnableCloseExecution = false
EnableAccountCloseExecution = false
EnableStrategyEvaluation = false
```

`EnableQStateTrendVariant=true` by default is harmless while strategy
evaluation is disabled.

## First MT5 Backtest Setup

For a tester-only trade smoke, use the active terminal EA path:

```text
C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Experts/Limni/LimniPortfolioEA.mq5
```

Minimum tester switches to allow opens:

```text
ExecutionMode = LP_EXECUTION_TESTER_ONLY
EnableTrading = true
AllowLiveTrading = false
EnableStrategyEvaluation = true
EnableOpenOrderRouting = true
EnableQStateTrendVariant = true
QStateFixedLots = 0.01
QStateGridSpacingQ = 1.0
QStateGridCap = 50
EnableCurrencyExposureGuard = true
```

To test HWM close-all and next-day re-entry in the MT5 tester, also set:

```text
EnablePortfolioHarvestGovernor = true
HarvestInitialTargetMoney > 0
HarvestTrailMoney > 0
HarvestSoftLockOnBreach = true
HarvestGridWinddownOnBreach = true
EnableCloseExecution = true
EnableAccountCloseExecution = true
QStateReentryNextDayAfterHarvest = true
```

Do not enable live trading for this gate.

## Changed Files

```text
automation/mt5/Experts/Include/Core/BuildInfo.mqh
automation/mt5/Experts/Include/Core/Config.mqh
automation/mt5/Experts/Include/Core/Engine.mqh
automation/mt5/Experts/Include/Core/Types.mqh
automation/mt5/Experts/Include/Portfolio/AccountHarvestGuard.mqh
automation/mt5/Experts/Include/Portfolio/GridBook.mqh
automation/mt5/Experts/Include/Portfolio/RiskArbiter.mqh
automation/mt5/Experts/Include/Receipts/DecisionLog.mqh
automation/mt5/Experts/Include/Receipts/ReceiptTypes.mqh
automation/mt5/Experts/Include/Receipts/RunManifest.mqh
automation/mt5/Experts/Include/Signals/LrmgState.mqh
automation/mt5/Experts/Include/Signals/SignalSnapshot.mqh
automation/mt5/Experts/Include/Strategies/StrategyRegistry.mqh
automation/mt5/Experts/Include/Strategies/TrendFollowLane.mqh
automation/mt5/Experts/Limni/LimniPortfolioEA.ex5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99w-qstate-currency-trend-v001-2026-07-06/
```

Compile logs:

```text
repo-LimniPortfolioEA-compile-log.txt
active-LimniPortfolioEA-compile-log.txt
```

Both repo and active-terminal compiles report:

```text
Result: 0 errors, 0 warnings
```

MetaEditor returned process exit code `1` while writing clean logs, matching
the known local MT5 compile pattern in this repo.

Source hash parity:

```text
source-hashes.txt
```

All installed repo and active-terminal source hashes match for the changed
`.mq5/.mqh` files.

## Verdict

```text
PASS_GATE99W_QSTATE_CURRENCY_TREND_V001_COMPILES_NO_LIVE_CLAIM_NO_BACKTEST_CLAIM
```

The variant status is `smoke_passed` for mechanical compile/install proof only.
It is not a contender and not promoted until Freedom supplies MT5 backtest
receipts and the result is reviewed under a follow-up gate.
