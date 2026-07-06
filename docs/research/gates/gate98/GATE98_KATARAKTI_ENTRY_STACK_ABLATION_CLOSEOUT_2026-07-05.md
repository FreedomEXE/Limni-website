# Gate 98 - Katarakti Entry Stack Ablation Closeout

Date: 2026-07-05

Status: stopped for current purpose. No promotion claim.

## Verdict

Gate 98 found one six-year raw-stack survivor, but the survivor is not robust
enough to keep tuning as the final system.

The reference survivor is:

- `KTR_LOOSE` Katarakti trigger.
- Stochastic enabled at `K=1000`, `Slowing=100`, `D=100`, `Oversold=10`,
  `Overbought=90`, `UseD=false`.
- LRMG reversal filter enabled.
- David MA direction enabled in `AGAINST` mode with RSI `9/63/37`.
- `ExitScope=ACCOUNT`, `TP=1.00` percent of balance, `SL=0`, account trail
  effectively off, `GridSpacing=0.10`, `GridCap=500`.

That exact stack survived the six-year window on paper. Removing or materially
changing any one major layer in the tested set broke the run. That is useful
research evidence, but it also makes the current stack a fragile time-based
specimen rather than a final institutional engine.

Next phase should rebuild the logic as a non-time-based FormulaShadow / shadow
EA design using pure price action, volatility, ADR, LRMG/event structure, and
portfolio heat. Do not continue parameter optimization on this time-based stack.

## EA State

Current EA under work:

`automation/mt5/Experts/LimniKataraktiEA.mq5`

Do not switch this lane back to `automation/mt5/Experts/LimniHedge_V1.mq5`.

Gate 98 simplified the MT5 inputs so manual piloting is no longer buried under
dead selectors:

- Top-level controls: `Longs`, `Shorts`, `Lots`, `Slippage`, `GridSpacing`.
- Exit controls: `ExitScope`, `TP`, `SL`, `Trail`, `TrailStart`,
  `TrailDistance`, `GridCap`.
- Katarakti: locked internally to Loose (`KTR_LOOSE`); no visible tuning
  knobs.
- Stochastic: `Stochastic`, `K`, `Slowing`, `D`, `Oversold`, `Overbought`,
  `UseD`.
- LRMG: `LRMG` on/off only.
- David MA: `David`, `RSIFilter`, `RSI`, `RSI_OB`, `RSI_OS`.

Hidden/locked plumbing includes Strategy Tester enforcement, MT5 order fills,
the 28-pair Common Files default symbol list, exports, cutoff plumbing, LRMG
formula constants, Katarakti formula details, and David MA indicator metadata.

Receipts continue to log:

- raw Katarakti candidate events before later entry filters;
- derived `entry_stack_preset`;
- active layer booleans and layer pass booleans;
- block reasons and final accepted/blocked decisions;
- modeled, actual, and accounting prices;
- same-bar ambiguity counters;
- aggregate pair contribution summaries;
- account close group context when `ExitScope=ACCOUNT`.

Fresh closeout compile logs:

- Repo source:
  `docs/research/gates/gate98/artifacts/compile-closeout-2026-07-05/limni-katarakti-ea-gate98-closeout-repo-compile-log.txt`
- Active terminal source:
  `docs/research/gates/gate98/artifacts/compile-closeout-2026-07-05/limni-katarakti-ea-gate98-closeout-active-terminal-compile-log.txt`

Both logs report `Result: 0 errors, 0 warnings`.

## Account Exit Correction

The important accounting correction from Gate 98 is that account-level exits
cannot use raw ADR totals as the account trigger.

For `ExitScope=ACCOUNT`, `TP`, `SL`, `TrailStart`, and `TrailDistance` now mean
percent of current account balance. The trigger is computed from magic-filtered
open MT5 positions:

`gross open money = sum(POSITION_PROFIT + POSITION_SWAP)`

`estimated close fee = 7.00 * open lots`

`net open pct = 100 * (gross open money - estimated close fee) / AccountBalance`

The account close path writes `*_account_exits.csv` and now fails closed: if MT5
positions do not actually close, the EA logs `EXIT_BLOCKED`, does not record a
basket close, and does not reset internal basket state.

Pair-level ADR exits are still geometry exits. They can be green in ADR terms
without being equal-money exits across all pairs. Making pair-level exits
money-fair would require pair-specific sizing by pip value, ADR, account risk,
and broker lot granularity. With `0.01` minimum lots, that cannot be made
perfect on a small account.

## Six-Year Ablation Evidence

Receipt source:

`C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/Common/Files/LimniKataraktiEA`

All rows below are 28-pair tests beginning `2020-01-01`. The later ablations
used `ExitScope=ACCOUNT` / `PCT_BALANCE`, `TP=1.00`, `SL=0`, `GridSpacing=0.10`,
and `GridCap=500` unless the receipt predates account-scope fields.

| Run | Stack | Key Change | Combined ADR | Terminal ADR | Account Cycles | Min Open Pct | Read |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `TESTER_16` | `K_FULL_AGAINST` | K + Stoch + LRMG + David AGAINST | `+7244.179606` | `-378.660250` | `160` | `-67.344981` | only six-year raw-stack survivor |
| `TESTER_119` | `K_LRMG_REVERSAL_STOCH` | David OFF | `-1044.433369` | `-1236.078284` | `7` | `-72.381958` | David AGAINST matters |
| `TESTER_215` | `K_LRMG_REVERSAL_DAVID_AGAINST` | Stoch OFF | `-879.302494` | `-1224.408143` | `17` | `-62.457240` | Stoch matters |
| `TESTER_33` | `K_STOCH_DAVID_AGAINST` | LRMG OFF | `-1081.741291` | `-1244.486081` | `6` | `-47.966120` | LRMG matters |
| `TESTER_260` | `K_DAVID_AGAINST` | Stoch OFF, LRMG OFF | `-573.835125` | `-965.343315` | `16` | `-80.835579` | account TP alone did not solve 2020 |
| `TESTER_19` | `K_STOCH` | David OFF, LRMG OFF | `-1046.034019` | `-1262.756803` | `9` | `-72.555631` | K + Stoch alone died |
| `TESTER_30` | `K_FULL_WITH` | David WITH | `-1460.719643` | `-1667.440695` | `9` | `-90.331627` | David WITH failed |
| `TESTER_191` | `K_FULL_AGAINST` | Stoch `100/10/10`, `10/90` | `-1656.516018` | `-1793.565985` | `7` | `-94.710482` | faster Stoch died |
| `TESTER_209` | `K_FULL_AGAINST` | Stoch `1000/100/100`, `20/80` | `-890.597255` | `-1102.139275` | `7` | `-68.168885` | looser Stoch died |
| `TESTER_878` | `K_ONLY` | Loose Katarakti only, older pair-level receipt | `-905.625835` | `-1470.525835` | n/a | n/a | true K-only died |

## Important Failure Read

The survivor still carried major heat.

The worst visible later event was around July/August 2024. The account survived,
but the exposure shape was a classic crowded carry-unwind profile: long GBP,
AUD, EUR, and NZD exposure against short JPY/CHF exposure. That points to a
portfolio concentration problem, not just a bad take-profit setting.

The 2020 failures showed the same family of problem: Katarakti triggers can
cluster on correlated assets, so the portfolio is not automatically diversified
just because the EA scans 28 pairs. It often does not hold all 28 pairs; it
holds the pairs that triggered, and those triggers can share the same macro
side.

## Interpretation

What we learned:

- Loose Katarakti is the only useful Katarakti mode for this phase. Extreme is
  too sparse and still failed when isolated.
- Katarakti alone produces many wins but does not control terminal inventory.
- David WITH is not worth more time in this lane except as a control.
- David AGAINST is the only David mode that helped the six-year full-stack
  survivor, but this does not prove the David MA formula is final.
- Stochastic helped the full stack survive, likely because it kept entries in
  persistent exhaustion zones. But the exact time-based settings were fragile.
- LRMG mattered. It is the closest piece to the future direction because it is
  already event/price based rather than clock based.
- Account-level exits must be account-percent and fee-aware. Raw ADR account
  harvests can close net negative in money terms.
- Pair-level ADR exits are acceptable as geometry tests but are not equal-money
  risk across pairs.
- The current stack has too much dependence on time-based indicators and
  specific settings. More parameter tuning is not the right next move.

## Parked Ideas

These are saved but out of scope for immediate implementation:

- Candidate B / antithesis system running alongside this engine.
- COT, regime, dealer, RRP, strength, gamma proxy, or no-trade overlays.
- Comparing 2020 and July/August 2024 drawdowns against regime-layer evidence.
- No-Katarakti / Stochastic-as-trigger architecture.
- Pair-specific sizing and pair-specific grid geometry.

## Next Gate Shape

Open the next gate only after external review is read.

Target direction:

- Rebuild as a shadow-first, non-time-based engine.
- No parameter optimization as the core method.
- Convert the useful behavior into normalized price/event fields.
- Treat current EA results as a reference specimen, not the final architecture.

Candidate FormulaShadow field set to review:

- LRMG distance from median / zero structure.
- ADR-normalized displacement.
- Sweep depth beyond an event-defined range.
- Reclaim / rejection strength.
- Reversion room to event median or LRMG center.
- Movement-distribution percentile as a custom exhaustion layer instead of
  time-based Stoch.
- Event-based trend/direction state instead of time-based David MA.
- Currency-side crowding and portfolio heat.
- Basket MFE/MAE from netted average price, not per individual fill.

The future non-time-based Katarakti-like trigger should not depend on fixed
sessions. A possible shape is:

1. Build a range from X ADR movement, LRMG bricks, or volatility events.
2. Wait for a sweep beyond that event range.
3. Require reclaim / rejection / displacement.
4. Trigger only when there is enough reversion room and portfolio heat allows it.

## Stop Lines

- No `LimniHedge_V1` changes.
- No Gate 95 / Type3 runner work.
- No live/app integration.
- No more David parameter tuning.
- No more current-stack Stoch parameter sweep.
- No Candidate B implementation yet.
- No regime overlay implementation yet.
- No promotion claims.
- Do not mutate the EA again until the ChatGPT Pro review is read and the next
  gate is explicitly opened.
