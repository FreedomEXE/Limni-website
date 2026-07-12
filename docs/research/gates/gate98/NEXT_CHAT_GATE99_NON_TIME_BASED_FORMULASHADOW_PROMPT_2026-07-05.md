# Next Chat Prompt - Gate 99 Non-Time-Based FormulaShadow

Continue as Codex/Poseidon in:

`C:/Users/User/Documents/GitHub/limni-website`

Recover state first:

1. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
2. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
3. Read `AGENTS.md`
4. Read `docs/BACKTEST_CANONICAL_PROTOCOL.md`
5. Read `docs/research/gates/gate98/GATE98_KATARAKTI_ENTRY_STACK_ABLATION_CLOSEOUT_2026-07-05.md`
6. Read the ChatGPT Pro review response that Freedom will paste into the new
   chat.

Current objective:

Do not code immediately. First read ChatGPT Pro's review and compare it against
the Gate 98 closeout evidence. Then propose the smallest Gate 99 plan for a
non-time-based FormulaShadow rebuild.

Gate 98 summary:

- We are working with `automation/mt5/Experts/LimniKataraktiEA.mq5`, not
  `LimniHedge_V1`.
- Gate 97 was pushed at commit `4feac821` and preserved the first 2026 YTD
  28-pair Katarakti smoke runs.
- Gate 98 simplified `LimniKataraktiEA.mq5`, locked Katarakti to Loose, exposed
  direct layer toggles, added account-level percent-of-balance exits, and added
  stronger close-path/account-exit receipts.
- The current EA is a reference specimen. Do not treat it as final architecture.

Core Gate 98 finding:

- The only six-year raw-stack survivor was:
  `KTR_LOOSE` + Stoch `1000/100/100` with `10/90` + LRMG reversal + David
  AGAINST RSI `9/63/37` + `ExitScope=ACCOUNT` + `TP=1.00` percent of balance
  + `GridSpacing=0.10` + `GridCap=500`.
- It survived on paper but carried large heat and concentration risk.
- K-only died.
- K + Stoch died.
- K + LRMG + Stoch with David OFF died.
- K + Stoch + David AGAINST with LRMG OFF died.
- K + LRMG + David AGAINST with Stoch OFF died.
- David WITH died.
- Faster Stoch `100/10/10` died.
- Stoch thresholds `20/80` died.

Interpretation to preserve:

- Loose Katarakti is useful as a trigger reference, but the session-based
  Katarakti implementation is not the desired final shape.
- LRMG is important because it is already event/price based.
- Stoch and David MA helped the survivor, but both are time-based and fragile.
- Account exits must be percent-of-balance and fee-aware.
- Pair-level ADR exits are geometry tests, not equal-money risk.
- Correlation risk is real because Katarakti triggers cluster on the same macro
  side; scanning 28 pairs does not guarantee diversified exposure.
- Do not continue parameter tuning. We need a stronger abstraction.

Gate 99 target:

Design the smallest clean non-time-based FormulaShadow rebuild:

- Pure price action / volatility / ADR / LRMG/event logic.
- No time-based events in the final target if possible.
- No parameter optimization as the core research method.
- Current EA results are a reference specimen only.

Candidate shadow fields to review:

- LRMG distance from median / zero structure.
- ADR-normalized displacement.
- Sweep depth beyond an event-defined range.
- Reclaim / rejection strength.
- Reversion room to event median or LRMG center.
- Movement-distribution percentile as a custom exhaustion layer instead of
  time-based Stoch.
- Event-based trend/direction state instead of time-based David MA.
- Currency-side crowding and portfolio heat.
- Basket MFE/MAE from average netted basket price, not per fill.

Possible non-time-based Katarakti-like trigger:

1. Build a range from X ADR movement, LRMG bricks, or volatility events.
2. Wait for a sweep beyond that event range.
3. Require reclaim / rejection / displacement.
4. Trigger only when there is enough reversion room and portfolio heat allows it.

Stop lines:

- No `LimniHedge_V1` changes.
- No Gate 95 / Type3 runner work.
- No live/app integration.
- No more David tuning.
- No more current-stack Stoch parameter sweep.
- No Candidate B implementation yet.
- No regime overlay implementation yet.
- No promotion claims.
- Do not mutate the EA until ChatGPT Pro's review is read and the Gate 99 plan
  is approved.
