# Gate 100A - Literature-to-Alpha Formula Distillation

Date: 2026-07-07

Status: `RESEARCH_ONLY_DISTILLATION`

Location: `docs/literature/notes/` because `docs/literature/README.md` routes
summaries, extracted notes, and relevance comments to this lane. Existing
`docs/research/gates/*` files were not changed.

## Stop Line

This note produces formulas and candidate test gates only.

No MT5, EA, strategy code, existing research-gate files, parameter sweeps,
AI training, fine-tuning, live-trading claim, or promotion claim is opened by
this pass.

Papers are treated as hypothesis sources, not truth. A mechanism becomes Limni
evidence only after it is reproduced on Limni data with receipts.

## Corpus Evidence

Input surfaces inspected:

- `docs/literature/manifest.csv`
- `docs/literature/papers/`
- `docs/literature/notes/intake-2026-07-07-batch-01.md`
- `docs/literature/notes/intake-2026-07-07-batch-02.md`
- Current Q-state contract context from Gate 99W and
  `automation/mt5/Indicators/Include/LimniQStateCore.mqh`

Counts:

- Manifest rows: `53`
- Local PDF files in `docs/literature/papers/`: `63`
- Manifest rows with missing local files: `0`
- Unmanifested local PDFs: `10`
- Text-readable PDFs through local `pypdf` extraction: `61`
- Present but text-empty through extraction: `2`

Text-empty inspected files:

- `Markowitz's Portfolio Selection A Fifty Year Retrospective.pdf`
- `Portfolio Selection.pdf`

Unmanifested local PDFs:

- `Backtest Overfitting in the Machine Learning Era.pdf`
- `Data-Snooping, Technical Trading Rule Performance, and the Bootstrap.pdf`
- `Hierarchical Risk Parity (HRP) and Modified HRP Against Traditional Methods.pdf`
- `Markowitz's Portfolio Selection A Fifty Year Retrospective.pdf`
- `Optimal Execution Horizon.pdf`
- `Optimal Liquidation.pdf`
- `Optimal Trade Execution under Stochastic Volatility and Liquidity.pdf`
- `Risk Parity Portfolio Optimization under Heavy-Tailed Returns and Time-Varying Volatility.pdf`
- `Time Series Momentum Implemented.pdf`
- `Time-Series Momentum Is It There.pdf`

The manifest mismatch is an intake hygiene issue, not an alpha conclusion.

## Limni Integration Boundary

Current Q-state flow, from repo evidence:

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

Current Q-state inputs already present:

- closed M1 OHLC-derived price path
- LRMG `q`
- anchor
- trend persistence
- anchor displacement
- event direction persistence
- range position / stochastic position
- sweep resolution
- spread cost in q units
- 28-pair base/quote currency aggregation
- q-state receipts with formula id/hash and component fields

Important missing inputs for several literature ideas:

- clean currency interest-rate or broker swap/carry history
- order-book depth, queue position, and fill intensity
- direct retail-flow or broker-client positioning data
- calibrated slippage and market-impact model by pair/session/volatility
- full rolling covariance/correlation surface for live exposure governance

## Paper Taxonomy

Primary classification below assigns each local PDF to one main bucket. Some
papers are cross-cutting and appear in later mechanism notes.

### Market Microstructure / Execution

Count: `16`

- `A Dynamic Limit Order Market with Fast and Slow Traders.pdf`
- `A Limit Order Book Model for High Frequency Trading with Rough Volatility.pdf`
- `A Pure-Jump Market-Making Model for High-Frequency Trading Under a Limit Order Book.pdf`
- `A Stochastic Model for Order Book Dynamics.pdf`
- `High-frequency trading in a limit order book.pdf`
- `High-frequency market-making with inventory constraints and Directional bets.pdf`
- `Low Latency Trading and the Comovement of Order Flow, Prices, and Market Conditions.pdf`
- `Low-Latency Trading.pdf`
- `Market Efficiency in Real Time Evidence from Low Latency Trading.pdf`
- `Optimal Execution for Portfolio Transactions.pdf`
- `Optimal Execution Horizon.pdf`
- `Optimal Execution of Portfolio Transactions.pdf`
- `Optimal Trade Execution under Stochastic Volatility and Liquidity.pdf`
- `Optimal Trade Execution with Uncertain Volume Target.pdf`
- `Short-Term Market Changes and Market Making With Inventory.pdf`
- `The Impact Of Transactions Costs and Slippage On Algorithmic Trading.pdf`

### Momentum / Trend / Time-Series Momentum

Count: `8`

- `Factor Momentum Everywhere.pdf`
- `Investing With Style.pdf`
- `New Core Equity Paradigm.pdf`
- `Time Series Momentum Implemented.pdf`
- `Time Series Momentum.pdf`
- `Time-Series Momentum Is It There.pdf`
- `Understand Alternative Risk Premia.pdf`
- `Value and Momentum Everywhere.pdf`

### Mean Reversion / Reversal

Count: `1` primary, with overlap from market-making papers

- `Market Making and Mean Reversion.pdf`

Cross-over contributors:

- `High-frequency market-making with inventory constraints and Directional bets.pdf`
- `High-frequency trading in a limit order book.pdf`

### Carry / Currency Risk Premia

Count: `10`

- `Carry Trade and Currency Crash Risk.pdf`
- `Carry Trade and Momentum in Currency Markets.pdf`
- `Carry Trade and Return Crash Risk.pdf`
- `Carry Trades and Currency Crashes.pdf`
- `Carry Trades and Risk.pdf`
- `Common Risk Factors in Currency Markets.pdf`
- `Correlated Risk Factors in Currency Markets.pdf`
- `Crowds, Crashes, and the Carry Trade.pdf`
- `The Carry Trade and Currency Momentum Strategies.pdf`
- `The Currency Carry Trade.pdf`

### Portfolio Construction / Risk Parity / HRP / Kelly

Count: `13`

- `A Generalization of the Classical Kelly Betting Formula to Continuous Outcomes.pdf`
- `A New Interpretation of Information Rate.pdf`
- `An Introduction to Risk Parity.pdf`
- `Enhancing Risk Parity by Including Views.pdf`
- `Hierarchical Risk Parity (HRP) and Modified HRP Against Traditional Methods.pdf`
- `Markowitz Nobel Lecture.pdf`
- `Markowitz's Portfolio Selection A Fifty Year Retrospective.pdf`
- `Markowitz's Portfolio Variance Describes Only a Limited Case of Constant Trade Volumes.pdf`
- `Portfolio Selection.pdf`
- `Risk Parity Methods and Measures of Success.pdf`
- `Risk Parity Portfolio Optimization under Heavy-Tailed Returns and Time-Varying Volatility.pdf`
- `Risk Parity, Maximum Diversification, and Minimum Variance an Analytic Perspective.pdf`
- `Understanding Risk Parity.pdf`

### Retail Behavior / Behavioral Inefficiency

Count: `1`

- `The performance of retail investors, trading intensity and time in the market.pdf`

Behavioral mechanisms also support momentum/carry crash interpretation, but this
is the only directly retail-behavior paper in the local corpus.

### Overfitting / Backtest Validation

Count: `13`

- `A Reality Check for Data Snooping.pdf`
- `Backtest Overfitting in the Machine Learning Era.pdf`
- `Backtesting in Financial Machine Learning.pdf`
- `Data Snooping Bias in Tests of the Relative Performance of Technical Trading Rules.pdf`
- `Data Snooping and Market-Timing Rule Performance.pdf`
- `Data-Snooping, Technical Trading Rule Performance, and the Bootstrap.pdf`
- `Deep learning for algorithmic trading_ A systematic review of predictive models and optimization strategies.pdf`
- `Pseudo-Mathematics and Financial Charlatanism the Effects of Backtest Overfitting on Out-Of-Sample Performance.pdf`
- `Re-Examining the Profitability of Technical Analysis with White's Reality Check and Hansen's SPA Test.pdf`
- `Statistical Overfitting and Backtest Performance.pdf`
- `The Deflated Sharpe Ratio Correcting for Selection Bias, Backtest Overfitting and Non-Normality.pdf`
- `The Probability of Backtest Overfitting.pdf`
- `The Three Types of Backtests.pdf`

### Liquidity / Liquidation / Transaction Costs

Count: `1` primary, with heavy overlap from execution and carry papers

- `Optimal Liquidation.pdf`

Cross-over contributors:

- `Optimal Execution of Portfolio Transactions.pdf`
- `Optimal Execution for Portfolio Transactions.pdf`
- `Optimal Execution Horizon.pdf`
- `Optimal Trade Execution under Stochastic Volatility and Liquidity.pdf`
- `Optimal Trade Execution with Uncertain Volume Target.pdf`
- `The Impact Of Transactions Costs and Slippage On Algorithmic Trading.pdf`
- `Carry Trades and Currency Crashes.pdf`
- `Crowds, Crashes, and the Carry Trade.pdf`

### Not Useful As Direct Limni Alpha

No local paper is total junk. The following are supporting-only for alpha:

- `Deep learning for algorithmic trading_ A systematic review of predictive models and optimization strategies.pdf`
  - useful for model-risk warnings, not a direct formula.
- Low-latency equity HFT papers
  - useful for execution caution, not directly tradable without order-book and
    queue-position data.
- Markowitz historical/text-empty files
  - useful for portfolio framing, not direct alpha formulas in this pass.
- `The performance of retail investors, trading intensity and time in the market.pdf`
  - useful for overtrading/cost discipline; direct retail-flow alpha requires
    data Limni does not currently have.

## Bucket Extraction

| Bucket | Core claim | Formula or mechanism | Required inputs | Limni has inputs? | Possible Q feature | Possible standalone system | Failure mode | Validation test | Reject criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Market microstructure / execution | Inventory, spread, volatility, and order-flow conditions change the right trading price and urgency. | Reservation price shifts away from mid by inventory and volatility; execution cost trades off impact against timing risk. | price, spread, volatility, inventory, time-to-flatten, fill/slippage model, order-book if available | Partial: price, spread, q, inventory receipts; missing depth/fill intensity | `execution_cost_q`, `inventory_pressure`, `liquidity_stress_score` | Inventory-aware add/close gate | HFT models overfit to unavailable order-book data | Shadow receipts on existing fills: cost_q, inventory_pressure, blocked_add_reason | reject if cost gate only reduces trades without improving MAE, max open, PF, or tail loss |
| Momentum / trend / TSM | Past own returns over stable horizons can predict next returns; volatility scaling and costs matter. | Vol-normalized multi-horizon return sign/strength, costed by spread and turnover. | closed prices, returns, realized vol, spread/cost, horizons | Yes for price/q/spread; direct vol can be derived | `tsm_score`, added to `pair_q_score` or `pair_direction_score` | Q-state trend-follow lane | Works only in recent window or one currency family | OOS4, 2026, 2019 windows with no horizon sweep | reject if year/currency dependence or cost-adjusted degradation versus current Q baseline |
| Mean reversion / reversal | Liquidity provision and grids work only when local fluctuation beats net drift, costs, and inventory risk. | OU-style displacement from anchor, reversion half-life, inventory penalty, spread gate. | price, anchor, q, range position, realized drift, inventory, costs | Mostly yes | `mean_reversion_quality`, `anchor_reversion_score`, `no_profit_pain_first` | Standalone mean-reversion grid or Revma add filter | A trend regime converts reversion into uncontrolled inventory | Shadow add-block replay and MFE/MAE by displacement bucket | reject if blocked winners dominate or red-cycle age/MAE grows |
| Carry / currency risk premia | High-rate currencies can earn carry but are exposed to crash, crowding, and funding-liquidity unwind. | Carry score minus crash/liquidity/crowding penalty. | policy rates, swap/forward points, currency returns, vol, crash proxy, crowding proxy | Price yes; carry/crowding mostly missing | `carry_risk_score` on currency_q_score | Currency carry overlay with crash-off state | Missing/dirty carry data or crash filter kills edge too late | Data-source preflight, then carry-only and carry+crash backtests | reject if data cannot be sourced legally/reproducibly or crash penalty only curve-fits |
| Portfolio / risk parity / HRP | Allocation should target risk contributions, not equal nominal exposure; clusters/correlation matter. | Risk contribution `RC_i = w_i * (Sigma w)_i / portfolio_vol`; cap cluster/currency concentration. | returns, covariance, open exposure, pair/currency mapping, volatility | Mostly yes from price path and inventory | `portfolio_risk_budget_multiplier` | Account exposure governor | Correlation estimates unstable or over-throttle good exposure | Rolling covariance risk-contribution shadow receipts | reject if lower return with no DD/tail/open-risk improvement |
| Retail behavior | High trading intensity and costs can destroy edge; behavioral flow can create inefficiency if measured. | Turnover penalty and churn gate; optional contrarian retail sentiment if real data exists. | trade count, turnover, costs, retail sentiment/order flow | Has own turnover/cost; lacks broad retail flow | `turnover_drag_score`, `overtrade_guard` | Trade-frequency governor | Equities/emerging-market result does not transfer to FX | Compare net edge by turnover decile and cost stress | reject if guard blocks recovery trades or adds no tail benefit |
| Overfitting / validation | Backtest selection can create false positives; multiple testing must be charged to the candidate. | PBO/CSCV, Deflated Sharpe, White Reality Check/SPA, family-wise trial count. | full candidate ledger, all tried variants, OOS splits, skew/kurtosis, trial count | Partly: variant ledger exists; needs strict trial accounting | `validation_confidence`, not alpha input | Research acceptance gate | Hidden trials and selective reporting | Apply to every candidate before promotion | reject if PBO high, DSR not significant, or best result dies under purged OOS |
| Liquidity / liquidation / transaction costs | Closing and sizing should account for volatility, liquidity, and urgency, not just signal strength. | Execution horizon minimizes expected cost plus risk; liquidation speed rises with risk/urgency. | spread, vol, position size, time left, slippage/impact model | Partial: spread/vol/position; missing calibrated impact | `liquidation_urgency`, `slippage_buffer_q` | Close-all/liquidation router policy | Overcomplicated model without broker evidence | Shadow close-intent urgency receipts against realized close cost | reject if model cannot be calibrated from local/broker receipts |

## Top 10 Research-Backed Alpha Mechanisms

Ranked by Limni usefulness, codeability, and evidence quality. These are
hypotheses, not performance claims.

1. Costed time-series momentum Q overlay
   - Sources: `Time Series Momentum.pdf`, `Time Series Momentum Implemented.pdf`,
     `Factor Momentum Everywhere.pdf`, `Value and Momentum Everywhere.pdf`.
   - Mechanism: own-return momentum, volatility scaled, spread/turnover charged.
   - Limni fit: immediate. It maps to `pair_q_score`, `currency_q_score`, and
     `pair_direction_score`.

2. Carry plus crash-risk currency score
   - Sources: `Carry Trades and Currency Crashes.pdf`,
     `Common Risk Factors in Currency Markets.pdf`, `Carry Trades and Risk.pdf`,
     `Crowds, Crashes, and the Carry Trade.pdf`.
   - Mechanism: high-minus-low currency carry with crash/crowding/liquidity
     penalty.
   - Limni fit: high potential but blocked by carry/swap/funding data source.

3. Inventory-aware reservation price / add skew
   - Sources: `High-frequency trading in a limit order book.pdf`,
     `High-frequency market-making with inventory constraints and Directional bets.pdf`.
   - Mechanism: shift desired buy/sell/add behavior by inventory, volatility,
     time left, and directional belief.
   - Limni fit: strong for Revma/Q grids because inventory and q already exist.

4. Mean-reversion liquidity-provision score
   - Sources: `Market Making and Mean Reversion.pdf`, Fodra/Labadie,
     Avellaneda/Stoikov.
   - Mechanism: local fluctuation and anchor reversion must beat net drift,
     spread, and inventory penalty.
   - Limni fit: strong for `pair_q_score`, reversion strategy intent, or add
     throttling.

5. Execution/liquidity cost gate
   - Sources: Almgren/Chriss execution papers, optimal liquidation papers,
     Loras cost/slippage paper.
   - Mechanism: do not open/add/close unless expected edge exceeds spread,
     slippage, impact, and urgency-adjusted risk.
   - Limni fit: strong as an execution/liquidity gate and receipt field set.

6. Risk-parity / HRP portfolio exposure governor
   - Sources: `Understanding Risk Parity.pdf`, Clarke/de Silva/Thorley,
     HRP paper, heavy-tailed risk parity paper.
   - Mechanism: constrain risk contribution and cluster/currency concentration,
     not just nominal pair count.
   - Limni fit: strong for portfolio exposure governor.

7. Fractional Kelly confidence throttle
   - Sources: Kelly 1956 and continuous/correlated Kelly paper.
   - Mechanism: size by expected log-growth edge, but use fractional Kelly and
     validation confidence to avoid ruin.
   - Limni fit: useful only after edge distribution is measured.

8. Factor-momentum-of-signals
   - Sources: `Factor Momentum Everywhere.pdf`, `Investing With Style.pdf`,
     `Value and Momentum Everywhere.pdf`.
   - Mechanism: momentum can exist in factors/signals, not only raw price.
   - Limni fit: possible meta-feature over `q_state`, carry, COT, Strength,
     and future source-family scores.

9. Turnover/overtrading drag guard
   - Sources: retail trading-intensity paper, transaction-cost papers, TSM
     implementation paper.
   - Mechanism: reduce trading when marginal signal does not clear churn and
     cost drag.
   - Limni fit: useful as `risk_decision`/`trade_plan` guard.

10. Research acceptance filter with PBO/DSR/Reality Check
    - Sources: Bailey/Lopez de Prado PBO and DSR papers, White Reality Check,
      Hansen SPA technical-analysis papers.
    - Mechanism: charge candidates for selection bias, non-normality, and trial
      count before promotion.
    - Limni fit: mandatory governance, not an entry signal.

## Top 5 Abstract Formulas Worth Testing

All scores are normalized to `[-1, +1]` unless stated otherwise. Names are
formula candidates, not code symbols.

### 1. Costed Multi-Horizon Time-Series Momentum Score

Sources:

- `Time Series Momentum.pdf`
- `Time Series Momentum Implemented.pdf`
- `Factor Momentum Everywhere.pdf`
- `Value and Momentum Everywhere.pdf`

Inputs:

- `P_t`: close price at closed bar `t`
- `q_t`: Limni q at `t`
- `spread_cost_q_t`
- `sigma_h`: realized volatility over horizon `h`
- horizons: fixed predeclared set, for example `[1D, 5D, 20D, 60D]`
- weights: fixed predeclared set, for example `[0.15, 0.25, 0.35, 0.25]`

Formula:

```text
r_h = ln(P_t / P_{t-h})
z_h = clamp(r_h / max(sigma_h, eps), -3, +3) / 3
raw_tsm_score = clamp(sum_h(weight_h * z_h), -1, +1)
costed_tsm_score =
  raw_tsm_score - sign(raw_tsm_score) * min(abs(raw_tsm_score), spread_cost_q_t)
tsm_confidence = min(1, abs(costed_tsm_score) / 0.75)
```

Integration:

- `pair_q_score`: add as a component or candidate replacement.
- `currency_q_score`: aggregate base/quote contributions across all 28 pairs.
- `pair_direction_score`: use base currency score minus quote currency score.

Expected receipt fields:

```text
formula_id
formula_hash
source_m1_time
tsm_horizons
tsm_weights
raw_tsm_score
spread_cost_q
costed_tsm_score
tsm_confidence
reject_reason
```

Failure mode:

- Becomes a recent-window trend follower that dies in 2019 or one currency
  family.

Reject criteria:

- Underperforms current q-state baseline after spread/cost.
- Fails either OOS4, 2026, or 2019 window.
- Leave-one-currency-family removes most of the edge.

### 2. Carry Crash-Adjusted Currency Score

Sources:

- `Carry Trades and Currency Crashes.pdf`
- `Common Risk Factors in Currency Markets.pdf`
- `Carry Trades and Risk.pdf`
- `Crowds, Crashes, and the Carry Trade.pdf`
- `The Currency Carry Trade.pdf`

Inputs:

- `carry_ccy`: rate/swap/forward-implied carry for each currency
- `carry_z_ccy`: rolling z-score of carry
- `vol_stress_ccy`: realized volatility stress
- `drawdown_stress_ccy`: recent adverse move against carry side
- `liquidity_stress_ccy`: spread/rollover/funding stress proxy
- `crowding_stress_ccy`: optional, only if real source exists

Formula:

```text
crash_stress_ccy =
  clamp(max(vol_stress_ccy, drawdown_stress_ccy, liquidity_stress_ccy,
            crowding_stress_ccy), 0, 1)

raw_carry_score_ccy = clamp(carry_z_ccy / 3, -1, +1)

carry_crash_score_ccy =
  raw_carry_score_ccy * (1 - crash_stress_ccy)
```

Pair direction:

```text
pair_carry_score = carry_crash_score_base - carry_crash_score_quote
```

Integration:

- `currency_q_score` as an additional currency term.
- `pair_direction_score` as a slow regime overlay.
- `risk_decision` can use `crash_stress_ccy` as no-new-risk or de-risk state.

Expected receipt fields:

```text
carry_source_id
carry_source_hash
carry_z_base
carry_z_quote
crash_stress_base
crash_stress_quote
pair_carry_score
carry_data_status
reject_reason
```

Failure mode:

- Uses unclean carry data or reacts after the crash has already happened.

Reject criteria:

- No reproducible legal data source for carry/swap/forward points.
- Crash stress only works after parameter tuning.
- Adds tail loss in JPY/CHF stress windows.

### 3. Inventory-Aware Mean-Reversion Add Gate

Sources:

- `Market Making and Mean Reversion.pdf`
- `High-frequency trading in a limit order book.pdf`
- `High-frequency market-making with inventory constraints and Directional bets.pdf`

Inputs:

- `price_t`
- `anchor_t`
- `q_t`
- `spread_cost_q_t`
- `inventory_q`: signed open exposure in q units
- `trend_pressure`: current trend/momentum pressure in trade direction
- `range_position`: normalized stoch/range position
- `time_to_flatten`: session or lifecycle deadline

Formula:

```text
displacement_q = clamp((price_t - anchor_t) / max(q_t, eps), -3, +3)

reversion_side_score = -sign(displacement_q)
reversion_quality =
  abs(displacement_q) / 3
  * (1 - abs(trend_pressure))
  * (1 - spread_cost_q_t)

inventory_penalty =
  clamp(abs(inventory_q) / inventory_q_cap, 0, 1)

mr_add_score =
  clamp(reversion_side_score * reversion_quality
        - sign(inventory_q) * inventory_penalty,
        -1, +1)
```

Gate:

```text
allow_new_reversion_risk if
  abs(mr_add_score) >= 0.50
  and spread_cost_q_t <= max_spread_cost_q
  and inventory_penalty < 1
  and no pain-first stop-add lock is active
```

Integration:

- `pair_q_score` reversion component.
- `strategy_intent` for reversion lane.
- `risk_decision` add/no-add reason.

Expected receipt fields:

```text
displacement_q
reversion_side_score
reversion_quality
inventory_q
inventory_penalty
trend_pressure
mr_add_score
allow_new_reversion_risk
reject_reason
```

Failure mode:

- Adds into real trends and increases red inventory.

Reject criteria:

- Max open, max age, MAE, or tail loss worsens versus baseline.
- Blocks more target winners than ugly/no-profit losers.

### 4. Execution/Liquidity Cost Gate

Sources:

- `Optimal Execution of Portfolio Transactions.pdf`
- `Optimal Execution for Portfolio Transactions.pdf`
- `Optimal Liquidation.pdf`
- `Optimal Trade Execution under Stochastic Volatility and Liquidity.pdf`
- `The Impact Of Transactions Costs and Slippage On Algorithmic Trading.pdf`

Inputs:

- `edge_score`: signal strength in q units or expected ADR
- `spread_cost_q`
- `slippage_est_q`
- `impact_est_q`
- `vol_q`
- `position_heat`
- `time_to_deadline`

Formula:

```text
cost_q = spread_cost_q + slippage_est_q + impact_est_q

urgency =
  clamp(position_heat + vol_q * sqrt(max(time_to_deadline, eps)), 0, 1)

required_edge_q = cost_q + cost_safety_margin_q

execution_liquidity_score =
  clamp((abs(edge_score) - required_edge_q) / max(abs(edge_score), eps), -1, +1)
```

Gate:

```text
no_new_risk if execution_liquidity_score <= 0
reduce_or_flatten_allowed if urgency >= urgency_threshold
```

Integration:

- `execution/liquidity gate`
- `risk_decision`
- `trade_plan`
- future close/liquidation router

Expected receipt fields:

```text
edge_score
spread_cost_q
slippage_est_q
impact_est_q
cost_q
urgency
required_edge_q
execution_liquidity_score
route_permission
reject_reason
```

Failure mode:

- Slippage/impact estimates become invented precision.

Reject criteria:

- Cannot calibrate `slippage_est_q` or `impact_est_q` from broker/tester
  receipts.
- Cost gate improves paper metrics only by avoiding all hard trades.

### 5. Risk-Contribution Portfolio Governor

Sources:

- `Understanding Risk Parity.pdf`
- `Risk Parity, Maximum Diversification, and Minimum Variance an Analytic Perspective.pdf`
- `Hierarchical Risk Parity (HRP) and Modified HRP Against Traditional Methods.pdf`
- `Risk Parity Portfolio Optimization under Heavy-Tailed Returns and Time-Varying Volatility.pdf`
- Kelly sizing papers

Inputs:

- pair/currency open exposure vector `w`
- rolling return covariance `Sigma`
- cluster or currency-family map
- candidate intent side/size
- validation confidence `c_valid`

Formula:

```text
portfolio_vol = sqrt(w' Sigma w)
RC_i = w_i * (Sigma w)_i / max(portfolio_vol, eps)
target_RC_i = risk_budget_i * portfolio_vol

risk_budget_multiplier_i =
  clamp(target_RC_i / max(RC_i, eps), 0, 1)

kelly_fraction_i =
  clamp(edge_i / max(var_i, eps), 0, max_fraction)

approved_size_multiplier_i =
  min(risk_budget_multiplier_i, fractional_kelly * kelly_fraction_i) * c_valid
```

Integration:

- `portfolio exposure governor`
- `risk_decision`
- `trade_plan`

Expected receipt fields:

```text
covariance_window
portfolio_vol
risk_cluster_id
RC_i
target_RC_i
risk_budget_multiplier
kelly_fraction
validation_confidence
approved_size_multiplier
reject_reason
```

Failure mode:

- Rolling covariance is unstable and blocks good diversification.

Reject criteria:

- No tail-risk or drawdown improvement versus existing currency exposure guard.
- Materially worse return with unchanged heat/tail metrics.

## Top 3 Candidates For The Next Coding Gate

These are the best next gates if Freedom approves implementation later. The
first gate should still be coded as a research runner or shadow receipt before
EA mutation.

### Candidate 1 - Costed TSM Q-State Overlay

Source papers:

- `Time Series Momentum.pdf`
- `Time Series Momentum Implemented.pdf`
- `Factor Momentum Everywhere.pdf`
- `Value and Momentum Everywhere.pdf`
- `Investing With Style.pdf`

Formula:

```text
costed_tsm_score =
  clamp(sum_h(weight_h * clamp(ln(P_t/P_{t-h}) / sigma_h, -3, +3) / 3), -1, +1)
  - sign(raw_tsm_score) * min(abs(raw_tsm_score), spread_cost_q)
```

Data needed:

- existing closed M1 price history
- q and spread cost
- predeclared horizons
- realized volatility by horizon

Integration point:

- `pair_q_score`
- `currency_q_score`
- `pair_direction_score`

Expected edge hypothesis:

- Existing Q-state has short-horizon LRMG state. A costed multi-horizon TSM
  component may reduce false neutral/transition states and improve direction
  stability when trend persistence is real across currencies.

Exact first 3 backtests:

1. `gate100b_tsm_q_overlay_oos4_5w_shadow`
   - Window: `2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: shadow direction only, no execution mutation
   - Compare: current Q-state direction versus Q-state plus TSM overlay.
2. `gate100b_tsm_q_overlay_recent_26w_shadow`
   - Window: `2025-12-08T00:00:00.000Z..2026-05-31T23:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: same fixed formula, same spread/cost model.
3. `gate100b_tsm_q_overlay_2019_old_window_shadow`
   - Window: `2019-04-14T23:00:00.000Z..2019-12-30T00:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: open-only conservative path plus direction accuracy/MFE/MAE
     receipts.

Failure/reject criteria:

- Any one of the three windows is materially worse than current Q-state.
- Direction benefit disappears after spread/cost.
- Edge depends on one currency family or one horizon.
- PBO/DSR validation flags the result as selection-biased after trial count.

### Candidate 2 - Inventory-Aware Mean-Reversion / Add Gate

Source papers:

- `Market Making and Mean Reversion.pdf`
- `High-frequency trading in a limit order book.pdf`
- `High-frequency market-making with inventory constraints and Directional bets.pdf`
- `Short-Term Market Changes and Market Making With Inventory.pdf`

Formula:

```text
mr_add_score =
  clamp(-sign((price-anchor)/q) * abs((price-anchor)/q)/3
        * (1 - abs(trend_pressure))
        * (1 - spread_cost_q)
        - sign(inventory_q) * clamp(abs(inventory_q)/inventory_q_cap, 0, 1),
        -1, +1)
```

Data needed:

- existing price, anchor, q, spread
- open grid inventory and direction
- current trend pressure
- add/skip and close-event receipts

Integration point:

- `strategy intent`
- `risk decision`
- `trade plan`
- execution/liquidity gate

Expected edge hypothesis:

- A reversion grid should add when displacement offers enough reversion
  quality, not merely because price moved adversely. Inventory penalty should
  reduce ugly no-profit cycles without blocking high-quality mean-reversion
  starts.

Exact first 3 backtests:

1. `gate100b_mr_inventory_add_oos4_5w_shadow`
   - Window: `2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: shadow add allow/block receipts only.
2. `gate100b_mr_inventory_add_2019_open_shadow`
   - Window: `2019-04-14T23:00:00.000Z..2019-12-30T00:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: open-only conservative MFE/MAE and inventory metrics.
3. `gate100b_mr_inventory_add_recent_26w_shadow`
   - Window: `2025-12-08T00:00:00.000Z..2026-05-31T23:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: same fixed formula.

Failure/reject criteria:

- Max open, red-cycle age, MAE, or tail loss worsens.
- It blocks target winners more often than ugly/no-profit losers.
- It requires pair-specific thresholds.
- It overlaps completely with existing pain-first stop-add logic and adds no
  distinct value.

### Candidate 3 - Risk-Contribution Portfolio Governor

Source papers:

- `Understanding Risk Parity.pdf`
- `Risk Parity, Maximum Diversification, and Minimum Variance an Analytic Perspective.pdf`
- `Hierarchical Risk Parity (HRP) and Modified HRP Against Traditional Methods.pdf`
- `Risk Parity Portfolio Optimization under Heavy-Tailed Returns and Time-Varying Volatility.pdf`
- Kelly papers

Formula:

```text
RC_i = w_i * (Sigma w)_i / max(sqrt(w' Sigma w), eps)
risk_budget_multiplier_i = clamp(target_RC_i / max(RC_i, eps), 0, 1)
approved_size_multiplier_i =
  min(risk_budget_multiplier_i, fractional_kelly * edge_i / max(var_i, eps))
  * validation_confidence
```

Data needed:

- rolling pair returns
- rolling covariance/correlation
- open exposure by pair and currency
- q-state intent score
- candidate validation confidence

Integration point:

- portfolio exposure governor
- `risk_decision`
- `trade_plan`

Expected edge hypothesis:

- The all-28 portfolio should avoid hidden concentration in correlated pairs,
  JPY/GBP clusters, and single-currency exposure. Risk-contribution throttling
  may lower tail risk and max open inventory without requiring strategy-specific
  tuning.

Exact first 3 backtests:

1. `gate100b_risk_contribution_oos4_5w_shadow`
   - Window: `2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: shadow sizing/approval receipts only.
2. `gate100b_risk_contribution_recent_26w_shadow`
   - Window: `2025-12-08T00:00:00.000Z..2026-05-31T23:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: rolling covariance, fixed risk budgets, no optimization.
3. `gate100b_risk_contribution_full_supported_summary`
   - Window: `2019-04-14T23:00:00.000Z..2026-05-31T23:00:00.000Z`
   - Universe: all 28 pairs
   - Mode: summary-only shadow governor on historical candidate intents.

Failure/reject criteria:

- No improvement in drawdown, tail loss, max open, or currency concentration.
- Return loss is large while tail metrics remain unchanged.
- Rolling covariance is too unstable for repeatable receipts.
- It bypasses or duplicates existing currency exposure guard without a clearer
  contract.

## Candidates Not Ready For Coding Yet

### Carry Crash-Adjusted Score

This is likely a high-value research lane, but it is not first to code because
Limni needs a reproducible legal carry/swap/rate source. The right next action
is data-source preflight, not strategy code.

### Retail Contrarian Flow

The behavioral paper is useful as a warning about overtrading. Direct retail
contrarian alpha requires broker/client positioning or sentiment data. Without
that, use only the turnover/cost guard.

### Low-Latency Order-Book Alpha

The order-book papers are useful for execution design and risk caution. They do
not justify direct HFT alpha in Limni without queue/depth/fill data.

## Validation Design From The Literature

Every candidate should carry validation fields before promotion:

```text
variant_id
formula_id
formula_hash
source_papers
data_lineage
price_bundle_id
test_windows
trial_family
trial_count
oos_split_id
leave_one_currency_results
cost_stress_results
PBO_estimate
DSR_estimate
white_reality_check_status
reject_reason
promotion_eligibility
```

Minimum acceptance pattern:

- passes OOS4 5-week shadow
- passes recent 26-week window
- does not fail the 2019 old window
- survives spread/cost stress
- survives leave-one-currency-family check
- has no hidden trial count
- improves at least one risk-adjusted metric without worsening tail risk

## RAG vs Trained Poseidon AI Recommendation

Keep this as RAG/research-assistant work for now.

Reason:

- The corpus is useful but not truth.
- The high-value output is structured formulas, source linkage, reject criteria,
  and test receipts.
- Training a model before Limni has labeled outcomes would amplify academic
  claims and stale context.

Later, a trained Poseidon-style AI becomes reasonable only after Limni has a
curated dataset like:

```text
paper mechanism
-> abstract formula
-> exact test window
-> receipt identity
-> result metrics
-> failure/reject reason
-> final status
```

Until then, use RAG plus a strict formula ledger and validation receipts.

## Gate 100A Verdict

`PASS_RESEARCH_ONLY_DISTILLATION_NO_CODE_NO_SWEEP_NO_LIVE_CLAIM`

Best immediate next gate if approved:

```text
Gate 100B - Costed TSM Q-State Overlay Shadow Test
```

Do not implement until Freedom explicitly opens the next gate.
