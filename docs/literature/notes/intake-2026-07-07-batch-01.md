# Literature Intake - 2026-07-07 Batch 01

## Scope

This is a quick intake pass only. It verifies that the current files are PDFs,
records stable metadata and local SHA256 hashes in `docs/literature/manifest.csv`,
and checks whether the papers are broadly relevant to Limni research.

No deep reading, categorization, strategy conclusion, or implementation claim is
made in this pass.

## Current Batch

- `Carry Trades and Currency Crashes.pdf` - relevant for FX carry, funding
  liquidity stress, crash risk, and currency co-movement.
- `Common Risk Factors in Currency Markets.pdf` - relevant for currency risk
  premia, carry factor structure, and portfolio-level FX exposure.
- `Deep learning for algorithmic trading_ A systematic review of predictive models and optimization strategies.pdf` - relevant as a broad model-risk and predictive-model survey.
- `High-frequency market-making with inventory constraints and Directional bets.pdf` - relevant for inventory-aware market making and directional quote skew.
- `High-frequency trading in a limit order book.pdf` - foundational market-making
  model for inventory risk, reservation prices, and quote placement.
- `Investing With Style.pdf` - relevant for cross-asset style premia,
  diversification, and separating robust return sources from local strategy
  signals.
- `Market Making and Mean Reversion.pdf` - directly relevant to mean-reversion
  market making and liquidity provision.
- `Optimal Execution of Portfolio Transactions.pdf` - relevant for market impact,
  transaction-cost modelling, and execution-risk trade-offs.
- `Portfolio Selection.pdf` - foundational portfolio/risk allocation reference.
- `Short-Term Market Changes and Market Making With Inventory.pdf` - relevant for
  market making under short-term volatility and trading-intensity shifts.
- `The performance of retail investors, trading intensity and time in the market.pdf` - relevant as behavior and overtrading-cost context.
- `The Impact Of Transactions Costs and Slippage On Algorithmic Trading.pdf` - relevant background for cost/slippage-aware backtesting, but lower confidence than peer-reviewed or institutional sources.
- `The Probability of Backtest Overfitting.pdf` - highly relevant to research
  discipline, parameter-selection risk, and backtest acceptance standards.
- `The Deflated Sharpe Ratio Correcting for Selection Bias, Backtest Overfitting and Non-Normality.pdf` - highly relevant to selection-bias and multiple-testing controls for reported performance.
- `Understand Alternative Risk Premia.pdf` - relevant for style/factor-premia
  taxonomy across value, momentum, carry, trend, defensive, and volatility.
- `Value and Momentum Everywhere.pdf` - relevant for cross-asset value/momentum
  premia, common factor structure, and liquidity-risk discussion.

## Quick Verdict

The batch is relevant. The strongest direct fit for current Limni research is the
market-making, inventory, mean-reversion, execution-cost, and FX carry-risk set.
The backtest-overfitting paper is also directly relevant to gate discipline. The
portfolio/factor/retail/DL papers are supporting context rather than direct EA
design proof.
