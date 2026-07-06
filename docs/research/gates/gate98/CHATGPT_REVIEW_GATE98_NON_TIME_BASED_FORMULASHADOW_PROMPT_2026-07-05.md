# ChatGPT Pro Review Prompt - Gate 98 To Non-Time-Based FormulaShadow

Mode: outsider review. Keep it simple but scientific.

You are reviewing the Limni research repo after Gate 98. The goal is not to
promote a strategy. The goal is to decide whether our evidence supports
stopping the current time-based EA tuning and rebuilding the entry engine as a
non-time-based, price-action / volatility / ADR shadow system.

Repo:

`C:/Users/User/Documents/GitHub/limni-website`

Please read these first:

1. `AGENTS.md`
2. `docs/BACKTEST_CANONICAL_PROTOCOL.md`
3. `docs/research/gates/gate98/GATE98_KATARAKTI_ENTRY_STACK_ABLATION_CLOSEOUT_2026-07-05.md`
4. `automation/mt5/Experts/LimniKataraktiEA.mq5`
5. `docs/backlog/CURRENT_WORK.md`

Optional context if needed:

1. `docs/research/gates/gate97/GATE97_LIMNI_KATARAKTI_EA_MULTIPAIRS_BASELINE_MANUAL_SMOKE_2026-07-05.md`
2. `docs/research/gates/gate98/NEXT_CHAT_GATE98_KATARAKTI_ENTRY_STACK_ABLATION_PROMPT_2026-07-05.md`

Current conclusion from Codex/Poseidon:

- Gate 98 found exactly one six-year raw-stack survivor:
  `KTR_LOOSE` + Stoch `1000/100/100` with `10/90` + LRMG reversal + David
  AGAINST RSI `9/63/37` + `ExitScope=ACCOUNT` + `TP=1.00` percent of balance
  + `GridSpacing=0.10` + `GridCap=500`.
- The survivor is not a promotion candidate. It survived on paper but carried
  severe heat, including a July/August 2024 carry-unwind-style concentration.
- Removing David AGAINST, Stoch, or LRMG broke the six-year run.
- David WITH failed.
- K-only failed.
- Faster Stoch (`100/10/10`) failed.
- Looser Stoch thresholds (`20/80`) failed.
- This points to a fragile time-based stack, not a clean institutional engine.
- The next phase should stop parameter optimization and rebuild the useful
  behavior as non-time-based FormulaShadow logic using price action, volatility,
  ADR, LRMG/event state, and portfolio heat.

Important accounting lesson:

- Account-level exits must trigger on account-percent money after expected
  fees, not raw ADR.
- Pair-level ADR exits are geometry tests, not equal-money risk across pairs.
- Equal-money pair-level exits would require pair-specific sizing by ADR, pip
  value, account risk, and broker lot granularity.

Please deliver:

1. Evidence audit:
   - Does the closeout evidence support stopping current-stack parameter tuning?
   - Are there any unsupported leaps or contaminated comparisons?
   - Which receipt checks would you require before trusting the conclusion?

2. Architecture critique:
   - Is the non-time-based FormulaShadow rebuild the right next move?
   - What should the smallest field set be?
   - Which fields should replace time-based Stoch and David MA?
   - How would you define a non-session Katarakti-like trigger?

3. Test design:
   - Propose a no-optimization test plan.
   - Define train/validation/OOS boundaries or walk-forward logic.
   - Define pass/fail gates that avoid curve fitting.
   - Include what to measure per grid/basket/account.

4. Risk critique:
   - Explain the 2020 and July/August 2024 concentration failures in simple
     terms.
   - Tell us whether portfolio heat/currency crowding should be part of the raw
     engine or a later regime overlay.
   - Identify the biggest engineering/statistical traps before we rebuild.

5. Final recommendation:
   - Should we rebuild now, or do one more receipt/audit step first?
   - Keep the answer practical and ranked.

Constraints:

- No coding.
- No live trading advice.
- No promotion claim.
- Do not suggest another open-ended parameter sweep.
- Do not move back to `LimniHedge_V1`.
- Treat the current EA as a reference specimen unless you find a concrete
  reason it should be patched before the new design gate.

Institutional metrics we eventually care about:

- Profit factor `1.5+`.
- Sharpe `1.5+`.
- Sortino `2+`.
- Calmar `2+`.
- MFE vs MAE ratio `2+`, calculated per grid / average netted basket price, not
  per individual fill.
- Positive expectancy.
- Drawdown duration and return-to-drawdown.
- Profitable weeks.
- Losing-day and losing-week streaks.
