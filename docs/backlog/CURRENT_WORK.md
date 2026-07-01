# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Active Gate

Latest active gate: Gate 86:
`mt5-tester-speed-preflight`.

Gate 86 is the MT5 speed response after Freedom stopped the first V3 EURUSD
manual test because real-tick mode was only completing about one year per hour.
It keeps the same active EA name, `LimniBasketHedgeEAAlphaV3`, but installs a
faster engine build into the active Five Percent terminal.

Gate 86 source/install changes:

- Added tester cadence inputs:
  `TesterCadence`, `TesterMinSecondsBetweenManage`.
- Added refresh throttles:
  `AdrRefreshSeconds` and `DrawdownRefreshSeconds`.
- Cached symbol volume/point/digit specs at init.
- Folded side counts, oldest anchor recovery, and ADR PnL into one position
  snapshot pass instead of doing a second per-leg position scan.
- Throttled ADR series refresh; default `AdrRefreshSeconds=3600`.
- Throttled account drawdown refresh; default `DrawdownRefreshSeconds=60`.
- Added local VS Code watcher/search exclusions for generated research artifact
  JSON/CSV under `.vscode/settings.json`; that file is ignored by git and is a
  local machine speed aid.

Gate 86 verification:

- Repo compile log:
  `docs/research/gates/gate86/artifacts/limni-basket-hedge-ea-alpha-v3-gate86-repo-compile-log.txt`;
  `0` errors, `0` warnings.
- Active terminal compile log:
  `docs/research/gates/gate86/artifacts/limni-basket-hedge-ea-alpha-v3-gate86-active-terminal-compile-log.txt`;
  `0` errors, `0` warnings.
- Active terminal install root:
  `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB`.
- Installed active terminal files:
  `MQL5/Experts/LimniBasketHedgeEAAlphaV3.mq5`,
  `MQL5/Experts/LimniBasketHedgeEAAlphaV3.ex5`, and
  `MQL5/Experts/Include/Strategy/RawHarvestEngine.mqh`.
- Repo source hashes match active terminal source hashes:
  - `LimniBasketHedgeEAAlphaV3.mq5`:
    `6845AE15B23148B48F347BA86545AE4BD3C7B8580ABFDD0D70B39C1C9156DAF9`
  - `RawHarvestEngine.mqh`:
    `317E35DC3A2FE756161BC61813F1331264D0A9953300657B2398E90C2FBBEC22`
- Active terminal `.ex5` hash:
  `6C4EEC3CFB783233402DA91311F33970705AAC5FBB9F28CC212A29C15275EC22`.

Gate 86 recommended next MT5 rerun:

- EA: `LimniBasketHedgeEAAlphaV3`.
- Symbol/timeframe: `EURUSD,M1`.
- Model for speed iteration: `1 Minute OHLC`.
- Visual mode: off.
- Optimization: off.
- Execution/latency: zero latency for this comparison.
- Inputs:
  `CsvLogEnabled=false`, `DashboardEnabled=false`, `EnableTimer=false`,
  `TesterCadence=RH_CADENCE_EVERY_TICK`,
  `TesterMinSecondsBetweenManage=0`, `AdrRefreshSeconds=3600`,
  `DrawdownRefreshSeconds=60`, `UseCurrentChartSymbolOnly=true`,
  `LotSize=0.01`, `TargetAdrMultiple=1.0`, `SpacingAdrMultiple=0.2`.

If `1 Minute OHLC` is still slow, try a rough sanity pass with
`TesterCadence=RH_CADENCE_NEW_M1_BAR`; do not treat that rough pass as final
parity evidence because it processes only one manage cycle per M1 bar. Final
confirmation can still use `Every tick based on real ticks`, but it should not
be the default design-loop model if it remains near one year per hour.

Gate 86 is not a Strategy Tester result, optimization, risk layer, promotion,
or live-readiness claim.

Recent prior gate: Gate 85A:
`eurusd-tail-trail-lifecycle-smoke`.

Gate 85A ran a one-pair EURUSD warehouse/backtester-only smoke for residual
tail runners with trailing stops. It deliberately did not touch MT5 while
Freedom's manual V3 Strategy Tester run was active.

Gate 85A scope:

- Pair: `EURUSD`.
- Window: `2020-01-06` through `2026-05-31T23:00:00.000Z`.
- Raw grid: `1.0` ADR target, `0.2` ADR spacing, long+short harvest.
- Tail fractions: `0`, `0.025`, `0.05`, `0.10`.
- Tail activation ADR: `1`, `2`.
- Tail trailing stop ADR: `1`, `2`, `3`, `5`.
- Cost ladder:
  `0`, `0.0025`, `0.005`, `0.01`, `0.02`, `0.05`, `0.1`, `0.2`, `0.5`.
- HWM reset stayed `OFF`; synchronized account reset remains a later gate only
  if reopened.

Gate 85A verdict:

- `PASS_TAIL_TRAIL_SMOKE_BUILT_IDEAS_WEAK_NO_PROMOTION`

Gate 85A result read:

- Full run: `335` weeks, `25` tail configs, `225` cost-ladder rows,
  `602s` elapsed.
- Baseline at `0.05` cost: final equity `217.664666` ADR, max drawdown
  `-1306.263752` ADR.
- Best drawdown row at `0.05` cost:
  `TAIL100_A1_TR1`, final equity `212.507634` ADR, max drawdown
  `-1306.027941` ADR, drawdown improvement only `0.235811` ADR, final equity
  `-5.157032` ADR versus baseline.
- Best final-equity row at `0.05` cost:
  `TAIL100_A2_TR3`, final equity `252.538818` ADR, but max drawdown worsened to
  `-1322.034135` ADR, `-15.770383` ADR versus baseline drawdown.

Interpretation: residual tails with trailing stops are not dead, but this
simple form does not solve the negative-tail problem. Tiny drawdown relief costs
final equity, and variants that improve final equity make drawdown worse.

Gate 85A artifacts:

- `docs/research/gates/gate85a/GATE85A_EURUSD_TAIL_TRAIL_LIFECYCLE_SMOKE_2026-07-01.md`
- `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/`

Gate 85A is not MT5, EA code, optimization, risk, HWM reset, full basket,
promotion, or live-readiness work. The manual MT5 V3 Strategy Tester run remains
the active external comparison to collect from Freedom.

Recent prior gate: Gate 84: mt5-raw-harvest-v3-simplification-install.

Gate 84 opened the MT5 implementation/install lane after the Gate 83 full
EURUSD warehouse run showed the raw hedged harvest signal was worth testing in
the terminal. It added `LimniBasketHedgeEAAlphaV3`, a raw no-boundary harvest
EA intended for Freedom's one-pair EURUSD Strategy Tester comparison.

Gate 84 verification:

- Repo compile:
  `docs/research/gates/gate84/artifacts/limni-basket-hedge-ea-alpha-v3-compile-log.txt`;
  `0` errors, `0` warnings.
- Active terminal compile:
  `docs/research/gates/gate84/artifacts/limni-basket-hedge-ea-alpha-v3-active-terminal-compile-log.txt`;
  `0` errors, `0` warnings.
- Active terminal install root:
  `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB`.

Gate 84 is not an MT5 Strategy Tester result, optimization, risk layer,
all-pair runtime, promotion, or live-readiness claim. Freedom's manual EURUSD
Strategy Tester run is in progress from `2020-01-02` through `2026-06-30`.

Recent prior gate: Gate 83: raw-hedged-grid-speed-simplification.

Gate 83 opened the warehouse/backtester-only raw hedged-grid speed lane after
Gate 82F scratch overcomplicated the comparison. It added
`RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY`: fully hedged long+short raw grid,
T100/S020, no direction signal, no Candidate B pair selection, no COT,
Strength, Regime, risk layer, Grid Cap, pair-net flatten, trailing, Pine
price-anchor, or artificial Sunday 20:00 ET to Friday 11:00 ET execution
boundary. Week identity is retained for warehouse grouping/reporting only.

Gate 83 artifacts:

- `docs/research/gates/gate83/GATE83_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_FAST_SMOKE_2026-07-01.md`
- `docs/research/gates/gate83/GATE83_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_FAST_BASKET_SMALL_2026-07-01.md`
- `docs/research/gates/gate83/GATE83_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_FULL_EURUSD_2026-07-01.md`
- `docs/research/gates/gate83/artifacts/fast-smoke/`
- `docs/research/gates/gate83/artifacts/fast-basket-small/`
- `docs/research/gates/gate83/artifacts/full-eurusd/`

Gate 83 verification:

- `FAST_SMOKE`: `AUDCAD`, `1` week, `PASS_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_BUILT_NO_PROMOTION`;
  gross final MTM `7.493187` ADR, 50% target-cost final MTM `-9.256813` ADR.
- `FAST_BASKET` small: `AUDCAD,EURUSD,GBPUSD,USDJPY`, `1` week,
  `PASS_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_BUILT_NO_PROMOTION`;
  gross final MTM `9.561754` ADR, 50% target-cost final MTM `-34.188246` ADR.
- `FULL_PAIR_HISTORY`: `EURUSD`, `373` weeks,
  `PASS_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_BUILT_NO_PROMOTION`;
  gross final MTM `2937.283889` ADR, 20% target-cost final MTM
  `781.783889` ADR, 50% target-cost final MTM `-2451.466111` ADR,
  max equity drawdown `-87.975012` ADR, fills `15,471`, weekly MTM PF
  `6.594031`, weekly win rate `0.836461`.

Gate 83 is not MT5 EA simplification, MT5 compile/tester work, dangerous-fill
guard implementation, full acceptance, optimization, risk, promotion, or live
readiness. Next likely gate is either wider Gate 83 warehouse evidence
(`STRESS_WINDOWS` or full all-pair acceptance) or a separate MT5 raw-only
simplification gate if Freedom explicitly opens it.

Recent prior gates: Gate 82B / Gate 82C / Gate 82D / Gate 82E:
weekly-boundary-anchor-contract, MT5 EA V2 boundary/anchor rework, and
warehouse price-anchor V2 comparison, followed by a single trade-window
boundary correction.

Gate 82B froze the weekly boundary and anchor contract for the fully hedged
MT5 EA lane. Gate 82C applies that contract to
`automation/mt5/Experts/LimniBasketHedgeEAAlphaV2.mq5`: active modes are now
`RAW` and `GRID_CAP`, with Pine-style price-anchor entries, New York
DST-aware weekly boundary helpers, compact week-tagged order comments,
current-week cycle filtering, carried-old-week target-close handling, optional
chart lines for anchor/entry levels, and expanded CSV audit fields.

Gate 82E corrected the active source contract to one canonical trade window:
Sunday 20:00 ET through Friday 11:00 ET. Outside that window there are no
entries, no grid fills, no target closes, and no price-anchor updates. Open
grids simply wait and resume when the next trade window opens.

Gate 82D replayed the price-anchor V2 rows from the Gate 74B warehouse and
kept the old Gate 80 raw fill-anchor rows imported in the same advanced metric
schema. The output includes return/drawdown, weekly MTM PF, Sharpe, Sortino,
weekly/monthly win rates, worst-week and 13-week losses, drawdown, open
inventory, fills/resets, and stressed-cost final equity for all rows.

Gate 82D result:

- Old `HEDGED_GRID_T100_S020_L3_RAW`: final equity `53646.297719` ADR,
  return/DD `76.024249`, final open inventory `-224.656426` ADR.
- Old `HEDGED_GRID_T100_S020_NO_LIMIT_RAW`: final equity `82549.112283` ADR,
  return/DD `70.730541`, final open inventory `-256.322899` ADR.
- V2 `RAW` price-anchor: final equity `31861.651847` ADR, return/DD
  `28.061151`, final open inventory `-78.510557` ADR.
- V2 `GRID_CAP_3` price-anchor: final equity `28128.243783` ADR,
  return/DD `32.882627`, final open inventory `-73.994656` ADR.

Interpretation: price-anchor V2 materially reduced final open inventory, but
Gate 82D is not final replacement evidence because it did not replay both old
raw fill-anchor and new price-anchor variants under the corrected single
trade-window contract. The inherited grid cap of 3 is documented as a starting
point only; it has not been optimized for the new anchor logic.

Gate 82C/82D/82E have not been compiled in MetaEditor, installed into MT5, or
run in MT5 Strategy Tester.

Status: active on `codex/gate82-hedged-grid-preflight`.

Architecture version: `gate66_brain_cells_atoms_v3`.

Current verdict:

- `PASS_GATE82_MT5_HEDGED_GRID_VISUAL_PROTOTYPE_BUILT_NO_PROMOTION`
- `PASS_CONTRACT_READY_FOR_GATE82C_EA_REWORK_NO_BACKTEST_CLAIM`
- `PASS_SOURCE_REWORK_STATIC_ONLY_NO_MT5_COMPILE_NO_TESTER_CLAIM`
- `PASS_GATE82D_PRICE_ANCHOR_V2_WAREHOUSE_COMPARISON_BUILT_NO_PROMOTION`
- `PASS_GATE82E_SINGLE_TRADE_WINDOW_SOURCE_CORRECTED_NO_COMPILE_NO_TESTER_NO_COMPARISON_CLAIM`

Current receipt:

- `docs/research/gates/gate82/GATE82_MT5_HEDGED_GRID_VISUAL_PROTOTYPE_2026-06-30.md`
- `docs/research/gates/gate82b/GATE82B_WEEKLY_BOUNDARY_AND_ANCHOR_CONTRACT_2026-07-01.md`
- `docs/research/gates/gate82c/GATE82C_MT5_EA_V2_BOUNDARY_ANCHOR_REWORK_2026-07-01.md`
- `docs/research/gates/gate82d/GATE82D_HEDGED_GRID_V2_PRICE_ANCHOR_COMPARISON_2026-07-01.md`
- `docs/research/gates/gate82e/GATE82E_SINGLE_TRADE_WINDOW_BOUNDARY_CORRECTION_2026-07-01.md`

Next intended scope: open a boundary-normalized warehouse comparison before any
replacement decision. That comparison must replay old raw fill-anchor and new
price-anchor variants fresh under the same Sunday 20:00 ET to Friday 11:00 ET
trade window; raw versus raw V2 should differ only by weekly anchor logic. If
MT5 is opened instead, treat it as compile-only plus one-pair visual boundary
inspection with `UseCurrentChartSymbolOnly=true`, `Mode=RAW`, then
`Mode=GRID_CAP`. Do not start all-28 validation, risk, live trading,
Candidate B, Brain, COT, Strength, Regime, pair-net flatten, optimization,
promotion, repo backtests beyond explicitly opened boundary-normalized work, or
live-readiness work until Freedom explicitly opens that next gate.

Gate 74 current state:

- Candidate B final ledger remains read-only directional truth.
- Candidate C shadow ledger remains monitoring-only.
- Gate 74A freezes the rule that base warehouse data stores path primitives only
  and replay adapters own policy decisions, open/closed state, events, realized
  PnL, unrealized PnL, and drawdown.
- Gate 74A requires every future replay to report both closed PnL and
  mark-to-market equity PnL. Closed PF alone is not acceptable evidence.
- Gate 74A defines intrabar crossing governance: close-mark replay has no
  intrabar ambiguity; touch-based replay must flag ambiguous same-minute bars,
  run favorable/adverse ordering sensitivity, and cannot promote claims that
  depend on unresolved ambiguity.
- Gate 74A keeps close-profitable / hold-unresolved-until-flip as a replay
  adapter idea only, not a base warehouse design.
- Gate 74B materialized the base trade-leg path warehouse:
  `gate74b_trade_leg_path_ECDE7C4A6553`.
- Gate 74B warehouse hash:
  `36290BFDD28B47AFF31CA798C75ED1E7736A4778EBAA3E5FFAB64ECA07C462CC`.
- Gate 74B stores one compressed columnar payload per Candidate B pair-week, with
  pair-week path hashes, week chunk hashes, and a warehouse hash. The bulky path
  data lives in the database warehouse, not in git.
- Gate 74B materialized `373` weeks, `10,444` pair-week rows, `67,650,431`
  logical path points, and `373` chunks.
- Gate 74B reconstruction audit matched Gate 71B-M basket Friday closes with
  `0` mismatches over `0.0001` ADR.
- Gate 74B had `0` missing price pair-weeks, `10,444` strict partial coverage
  pair-weeks, and `270` default ADR pair-weeks. Strict partial coverage means
  the actual local M1 rows are less than a continuous Sunday-to-Friday minute
  count; it is visible evidence, not a replay policy.
- Gate 74B did not run replay policies, test fixed ADR targets, optimize exits,
  start risk, touch MT5/live/runtime, mutate sources, or mutate Brain truth.
- Gate 74C ran gross-only replay adapters from the Gate 74B warehouse with no
  raw M1 rebuild.
- Gate 74C tested independent pair net-grid cycle exits first. Account-level
  equity exits remained diagnostics-only and were not active policy.
- Gate 74C kept grid spacing fixed at `0.2 ADR` and varied net cycle targets
  across `0.2`, `0.3`, `0.5`, `0.75`, and `1.0 ADR`.
- Gate 74C applied no spread, slippage, swap, commission, risk sizing, pair
  pruning, spacing optimization, account equity exit, or promotion logic.
- Gate 74C best final-equity gross adapter was
  `PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP` with
  `9901.156008` equity ADR, `14381.312614` closed ADR, equity PF `1.254319`,
  equity max drawdown `-5462.545131` ADR, and final open unrealized
  `-4480.156606` ADR.
- Gate 74C finding: pair net-grid lifecycle has gross replay edge under the
  tested close-mark adapter semantics, but open-loss/drawdown scale is large.
  This is discovery evidence only, not promotion.
- Gate 74D replayed `2` controls and `5` lifecycle/robustness rules across
  `373` weeks and `28` pairs from the Gate 74B warehouse, with no raw M1
  rebuild.
- Gate 74D parity guard matched Gate 74C for the focus adapter
  `PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP`.
- Gate 74D focus adapter remained `14381.312614` closed ADR and `9901.156008`
  final equity ADR, with equity PF `1.254319`, equity max drawdown
  `-5462.545131` ADR, and final open unrealized `-4480.156606` ADR.
- Gate 74D finding: the lifecycle harvest engine is real, but survivability is
  dominated by a small unrecovered tail. For the focus adapter, `28456`
  negative cycles produced a `0.967986` target-recovery rate, while `616`
  flip-loss cycles lost `-10815.950986` ADR.
- Gate 74D final open inventory for the focus adapter was highly concentrated:
  `AUDNZD` ended at `-3099.046979` ADR, `AUDJPY` at `-791.32201`, and `GBPAUD`
  at `-289.848397`.
- Gate 74D max drawdown trough was the week opened `2026-05-10T23:00:00.000Z`.
  The largest pair contributors from the peak-to-trough window were `AUDNZD`
  `-3560.00976`, `CHFJPY` `-1194.488678`, and `AUDJPY` `-739.32395` ADR.
- Gate 74D narrow robustness read: `0.75/0.15` harvested more closed ADR but
  worsened open loss and drawdown; `0.75/0.25` reduced fill depth but gave up
  too much equity. Do not promote `0.75/0.2`.
- Gate 74E replayed the exact focus adapter plus `9` universal containment
  adapters across `373` weeks and `28` pairs from the Gate 74B warehouse, with
  no raw M1 rebuild.
- Gate 74E verdict:
  `PASS_GATE74E_PAIR_NET_GRID_TAIL_CONTAINMENT_ADAPTER_PACK__TAIL_MECHANICS_AND_UNIVERSAL_CONTAINMENT_RANKING_VISIBLE_NO_PROMOTION`.
- Gate 74E focus parity matched Gate 74C and Gate 74D exactly:
  `14381.312614` closed ADR, `9901.156008` final equity ADR, equity PF
  `1.254319`, max drawdown `-5462.545131` ADR, and final open unrealized
  `-4480.156606` ADR.
- Gate 74E tested a small gross-only pack: max-fill guards `50/75`, max-age
  guards `720h/2160h`, pair stop-loss `10/15/20 ADR`, a `15 ADR`
  loss-visible freeze/lock-until-flip rule, and an adverse `15 ADR` to
  `-2.5 ADR` recovery-close rule.
- Gate 74E main read: simple universal containment can reduce final open loss,
  max drawdown, and flip-loss ADR, but none of the tested containment rules
  improved final equity versus the focus adapter. The best final-equity row was
  still the uncontained focus baseline at `9901.156008` ADR.
- Gate 74E best survivability trade-off among containment rows was not
  promotion-positive. `MAX_FILL_075` held `0.818016` of focus equity and
  improved max drawdown by `3568.857095` ADR, but retained only `0.613687` of
  closed ADR. `MAX_AGE_2160H` held `0.83275` of focus equity and improved max
  drawdown by `2850.241272` ADR, but retained only `0.596128` of closed ADR.
- Gate 74E pair stop-loss rows contained tails but destroyed harvest: `10/15/20`
  ADR stops ended at `-1141.160536`, `-885.125874`, and `-217.27639` final
  equity ADR.
- Gate 74E freeze/lock held floating loss visible and reduced max drawdown, but
  ended at `-383.784205` final equity ADR. It did not delete loss and is not an
  exit candidate.
- Gate 74E recovery-close retained `0.870594` of closed ADR but ended at
  `8412.154864` final equity ADR, still below the focus baseline, and left
  `-4108.123347` final open unrealized.
- Gate 74E did not start exact account-level synchronous stop/recovery/floor
  policies. The Gate 74B reader path is pair-series oriented; exact account
  intraminute lifecycle exits require a synchronized all-pair event replay and
  remain outside this narrow gate.

Gate 75A current state:

- Gate 75A verdict:
  `PASS_GATE75A_BROAD_EXIT_FAMILY_TAXONOMY_PROTOCOL_FREEZE__MATRIX_PLAN_PREDECLARED_NO_EXECUTION`.
- Gate 75A froze `15` exit/lifecycle families and `30` fixed configs for a
  future Gate 75B matrix plan.
- Gate 75A classified `7` family groups as replayable now from the Gate 74B
  pair-series warehouse: controls, pair net-grid cycle reset, pair profit
  floor/trail, universal pair stop/floor diagnostics, max-fill/max-age
  containment, partial-close / let-rest-run, and hedge/freeze-lock
  reference-only diagnostics.
- Gate 75A parked `8` account-level and hybrid families behind a synchronized
  all-pair account replay/materialization boundary: account net ADR reset,
  account profit floor/trail, account stop/recovery close, one-reset-and-stop
  weekly, no-reentry-after-reset, pair-grid plus account override, pair cycle
  plus account floor, and partial pair close plus account runner preservation.
- Gate 75A carried forward the Gate 74E negative result: simple universal
  containment reduced tail pain but did not fix the focus pair net-grid adapter,
  and another local Gate 74E parameter refinement should not run unless later
  review finds a true near-miss.
- Gate 75A froze Gate 75B ranking as a Pareto frontier over final equity,
  equity PF, max drawdown, final open loss, closed ADR, closed ADR retention,
  top-20 winner retention, worst-week and worst-5-week loss, annual stability,
  profitable week rate, recovery behavior, flip loss, stop/reset/freeze/lock
  counts, fill/turnover/hold metadata, and pair/currency tail concentration as
  reporting only.
- Gate 75A explicitly forbids Gate 75B promotion. No Gate 75B row is promotion
  eligible regardless of metrics.

Gate 76 current state:

- Gate 76 verdict:
  `PASS_GATE76_PAIR_DIRECTIONAL_TWO_SIDED_GRID_RESET_LIMIT_DISCOVERY__RECOVERY_EXPANSION_AND_ACCOUNT_RESET_LIFECYCLE_VISIBLE_NO_PROMOTION`.
- Gate 76 preserved Gate 75A as closed prior evidence and did not amend the
  Gate 75A taxonomy packet.
- Gate 76 replayed `20` fixed rules across `373` weeks, `28` pairs, and
  `10,444` Gate 74B pair-week rows with Candidate B directions unchanged.
- Gate 76 included the Gate 74E adverse-only focus baseline and matched it
  exactly: `14381.312614` closed ADR, `9901.156008` final equity ADR,
  `-4480.156606` final open unrealized, `-5462.545131` max drawdown, and
  `-10815.950986` flip-loss ADR.
- Gate 76 built exact synchronized close-mark account replay from the Gate 74B
  path warehouse. Account reset rows are not pair-series summary
  approximations.
- Best first-pass row by final equity was
  `PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP` with
  `18012.423714` closed ADR, `12295.79489` final equity ADR, equity PF
  `1.282295`, max drawdown `-7565.450203`, and final open unrealized
  `-5716.628824`.
- Interpretation: favorable expansion fills increased harvest and final equity,
  but every two-sided target worsened drawdown and final open loss versus the
  Gate 74E focus. This is discovery evidence only, not promotion.
- Best account-reset target row by final equity was
  `ACCOUNT_TWO_SIDED_GRID_RESET_TARGET_300_SPACING_020` with `6262.893813`
  closed ADR, `1819.37303` final equity ADR, equity PF `1.07472`, max drawdown
  `-6577.847171`, and final open unrealized `-4443.520783`.
- Reset limits reduced open loss/drawdown in some rows but also capped right
  tail and harvest. No reset-limit row is promotion eligible.
- Gate 76 applied no costs, spread, slippage, swap, commission, risk layer,
  correlation pruning, pair pruning, fair-value pruning, source mutation, Brain
  mutation, Candidate C promotion, Candidate D retest, Candidate E, Alpha v2,
  MT5/live/app/runtime work, or exit promotion.

Gate 77 current state:

- Gate 77 verdict:
  `PASS_GATE77_PAIR_TWO_SIDED_RESET_LIMIT_CONFIRMATION_FAILURE_ANATOMY__PAIR_LIMIT3_PROMISING_RESEARCH_ONLY_NO_PROMOTION`.
- Gate 77 replayed a small fixed `11`-rule matrix across `373` weeks, `28`
  pairs, and `10,444` Gate 74B pair-week rows.
- Gate 77 reproduced the Gate 74E adverse-only focus baseline exactly and
  reproduced the Gate 76 key rows before comparison:
  `PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP` and
  `PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK`.
- Gate 77 tested no account reset family, no broad Gate 75B matrix, no costs,
  no risk layer, no pair/date exclusions, no AUDNZD exclusion, no source
  mutation, no Brain mutation, no MT5/live/app/runtime work, and no promotion.
- Best fixed-matrix row by final equity was the controlled structure check
  `PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK` with
  `16124.084275` closed ADR, `13772.999764` final equity ADR, equity PF
  `1.561828`, max drawdown `-1989.442654`, final open unrealized
  `-2351.084511`, and flip-loss ADR `-6297.282489`.
- The Gate 76 promising row
  `PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK` reproduced at
  `14021.947533` closed ADR, `11713.727501` final equity ADR, equity PF
  `1.51746`, max drawdown `-1811.737115`, final open unrealized
  `-2308.220032`, and flip-loss ADR `-5132.272395`.
- Interpretation: reset-limit-3 remains promising research evidence only. It
  materially improves survivability versus no-limit two-sided expansion but
  also gives up right-tail participation. Tail concentration remains
  reporting-only and is not a pair-exclusion signal.

Gate 78 current state:

- Gate 78 verdict:
  `PASS_GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX__RUNNER_AND_REFERENCE_SL_VISIBLE_NO_PROMOTION`.
- Gate 78 replayed a fixed `17`-rule matrix across `373` weeks, `28` pairs,
  and `10,444` Gate 74B pair-week rows.
- Gate 78 reproduced Gate 74E focus parity, Gate 76 no-limit `T150`, and Gate
  77 `T075/L3`, `T100/L3`, and `T125/L3` before comparison.
- Gate 78 tested six final-reset runner rows only: targets `0.75`, `1.0`, and
  `1.25` ADR at spacing `0.2`, pair reset limit `3`, and runner fractions
  `25%` / `50%`.
- Gate 78 also ran four synchronized account emergency SL reference rows only:
  `T100/L3` and the selected best runner row at `-3 ADR` and `-5 ADR`.
- Best non-reference final-equity row remained the Gate 77 baseline
  `PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK` with
  `16124.084275` closed ADR, `13772.999764` final equity ADR, equity PF
  `1.561828`, max drawdown `-1989.442654`, final open unrealized
  `-2351.084511`, and flip-loss ADR `-6297.282489`.
- Best runner by the Gate 78 research ranking was
  `PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050`, but it reached only
  `3129.629042` closed ADR and `2923.668101` final equity ADR despite improved
  drawdown/open loss. It did not improve the `T100/L3` balance.
- Gate 78 interpretation: final-reset runner preservation clipped harvest and
  right-tail retention too hard. Account emergency SL diagnostics improved
  drawdown/open-loss visibility only by clipping harvest and are
  reference-only. No row is promotion eligible.
- Gate 78 applied no costs, spread, slippage, swap, commission, risk layer,
  correlation pruning, pair pruning, fair-value pruning, source mutation, Brain
  mutation, Candidate C promotion, Candidate D retest, Candidate E, Alpha v2,
  MT5/live/app/runtime work, or exit promotion.

Gate 78A current state:

- Gate 78A verdict:
  `PASS_SCORECARD_T100_L3_REMAINS_PRIMARY_CANDIDATE_NO_PROMOTION`.
- Gate 78A was a derived scorecard supplement over the existing Gate 78
  artifacts only. It did not rerun, add, optimize, freeze, promote, or mutate
  strategy logic.
- Gate 78A included all `17` existing Gate 78 rows in the raw scorecard and
  ranked non-reference candidate rows with mark-to-market equity as primary.
- Gate 78A kept
  `PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK` as the primary
  non-reference research candidate: `13772.999764` equity ADR, `16124.084275`
  closed ADR, `-1989.442654` max drawdown ADR, weekly MTM PF `1.561828`,
  ADR-Calmar `0.965143`, ADR-normalized Sortino `1.362816`, `-8525.307355`
  worst 13-week aggregate MTM loss ADR, and `-2351.084511` final open
  unrealized ADR.
- Gate 78A classified `T075/L3` as an alternate candidate, `T125/L3` as too
  much tail, runner rows as too much harvest loss or reject, and emergency-SL
  rows as reference-only diagnostics.
- Gate 78A explicitly labels Sharpe/Sortino as ADR-normalized diagnostics, not
  true investment Sharpe/Sortino, because sizing, margin, costs, swap, and
  capital base are not defined yet.
- Gate 78A explicitly labels unavailable intraperiod metrics rather than
  fabricating them: pair-week lifecycle PF, account-week MFE/MAE, pair-week
  lifecycle MFE/MAE, open inventory counts, max holding time, and runner MFE/MAE
  require replay instrumentation beyond the Gate 78 artifact surface.
- Gate 78A applied no Candidate B mutation/recompute/relabel/reweight/filter,
  no pair exclusion, no AUDNZD exclusion, no fair-value pruning, no
  risk/correlation pruning, no cost/slippage/swap assumptions, no MT5/live/app
  runtime work, and no promotion.

Gate 79 current state:

- Gate 79 verdict:
  `FAIL_LIMITED_REENTRY_FAMILY_TOO_WEAK_FOR_TARGET_NO_PROMOTION`.
- Gate 79 found the directional limited-reentry family too weak for target
  smoothness and return/drawdown expectations. The key weak spots were open
  inventory, flip-loss damage, and long adverse inventory.
- Gate 79 introduced the fully hedged weekly long+short all-28 diagnostic as a
  gross reference only: `53646.297719` final equity ADR and `-705.647194` max
  drawdown ADR versus directional `T100/L3` at `13772.999764` final equity ADR
  and `-1989.442654` max drawdown ADR.
- Gate 79 applied no costs, risk/correlation pruning, pair/date exclusions,
  AUDNZD exclusion, source mutation, Brain mutation, MT5/live/app/runtime,
  freeze, or promotion.

Gate 80 current state:

- Gate 80 verdict:
  `PASS_HEDGED_BASELINE_PROMISING_BUT_COST_MARGIN_VALIDATION_REQUIRED_NO_PROMOTION`.
- Gate 80 validated the fully hedged baseline as mechanically real under gross
  no-cost replay semantics, not as broker-real or promotion-ready.
- Gate 80 found fully hedged `T100/S020/L3` at `53646.297719` final equity ADR,
  `-705.647194` max drawdown ADR, and `204752` fills. Directional Candidate B
  `T100/L3` remained at `13772.999764` final equity ADR, `-1989.442654` max
  drawdown ADR, `-2351.084511` final open unrealized ADR, and `-6297.282489`
  flip-loss ADR.
- Long-only, short-only, and deterministic random-side all beat Candidate B
  directional, so the current edge appears to come from the all-pairs
  grid/harvest engine more than Candidate B directional intelligence.
- Gate 80 applied no Candidate B mutation, pair exclusion, AUDNZD exclusion,
  fair-value pruning, risk layer, MT5/live/app/runtime, broker-cost claim, or
  promotion.

Gate 81 current state:

- Gate 81 verdict:
  `PASS_HEDGED_FEASIBILITY_PREFLIGHT__ONE_PAIR_MT5_PROTOTYPE_NEXT_NO_PROMOTION`.
- Gate 81 was artifact-derived from Gate 80 only and ran in under a second. It
  did not rerun the expensive 373-week warehouse replay.
- Under the fixed stress proxy of `0.05` ADR/fill and `0.01` ADR per active
  side-week swap drag, hedged `T100/S020/L3` retained `42637.417719` ADR versus
  directional `T100/L3` at `9334.109764` ADR.
- Gate 81 order-count read: hedged all-28 averaged `548.932976` fills/week,
  p95 `696`, max `852`, and remains too large for immediate all-28 runtime.
  The only approved next build is a one-pair MT5 visual mechanics prototype.
- Gate 81 applied no Candidate B mutation, no signal research, no pair pruning,
  no AUDNZD exclusion, no risk layer, no Regime/fair-value layer, no MT5/live
  portfolio runtime, no live readiness, and no promotion.

Gate 82 current state:

- Gate 82 preflight verdict:
  `PASS_FOUR_VARIANT_HEDGED_GRID_DIAGNOSTIC_BUILT_NO_PROMOTION`.
- Gate 82 preflight used the same Gate 74B/Gate 80 warehouse lineage:
  `gate74b_trade_leg_path_ECDE7C4A6553`, `373` weeks, `28` pairs, and
  `10,444` pair-week rows.
- Raw L3 and raw no-limit hedged rows were imported from Gate 80 artifacts,
  not rerun:
  `HEDGED_GRID_T100_S020_L3_RAW` at `53646.297719` final equity ADR and
  `HEDGED_GRID_T100_S020_NO_LIMIT_RAW` at `82549.112283` final equity ADR.
- Pair-net `+1 ADR` flatten/reset reduced final and worst open inventory, but
  also destroyed too much harvest versus raw anchors. L3 pair-net ended at
  `18485.96236` final equity ADR versus raw L3 `53646.297719`; no-limit
  pair-net ended at `49969.699611` versus raw no-limit `82549.112283`.
- Gate 82 preflight applied no Candidate B mutation, no COT, no Strength, no
  Regime, no risk layer, no MT5 code, no all-28 runtime/deployment work, no
  parameter sweep, no threshold optimization, no promotion, and no live-capital
  claim.

Next intended scope: one-pair MT5 fully hedged visual mechanics prototype under
`automation/`, using this preflight as evidence. Do not start all-28 runtime,
risk layer, app/runtime integration, Candidate B/macro research, pair pruning,
promotion, or live readiness in this gate.

Gate 73 reference:

- Candidate B final ledger remains read-only directional truth.
- Candidate C shadow ledger remains monitoring-only.
- Gate 73C used locked Candidate B directions and existing pair-week
  weekly-hold outcomes only; it did not run dynamic intrawEEK exits, rebuild raw
  M1, mutate Candidate B, start risk, or promote a lifecycle.
- Gate 73C produced `930` pair-direction streaks across `10,444` pair-week rows.
- Gate 73C key limitation: gross carry-until-flip equals weekly forced close
  under the existing weekly outcome warehouse by construction. Current evidence
  proves lifecycle persistence and cost sensitivity, not continuous raw-price
  carry behavior.
- Gate 73C cost finding: standard-cost carry-until-flip saves `190.28` ADR
  through `0.910954` modeled turnover reduction; standard PF improves from
  `1.261308` weekly forced close to `1.400007` carry-until-flip.
- Gate 73C persistence finding: 5+ week direction streaks contain `9,454`
  pair-weeks, total `610.982752` ADR, and PF `1.950676`; 1-week streaks are
  negative at `-31.565262` ADR.
- Gate 73C recommendation was superseded by Gate 74A protocol freeze after
  Freedom chose the warehouse-first fork. Do not promote carry-until-flip from
  Gate 73C.
- Gate 73B used existing materialized warehouses only: Gate 57 pair-week
  outcomes, Gate 71B-M basket path warehouse, Gate 71B diagnostics, Gate 72
  matrix rows, and Gate 73A path classes.
- Gate 73B produced a `10,444` row week x pair final-composition ledger with
  no raw M1 source rebuild, no new exit rules scored, no exit promotion, no
  risk layer, and no Brain mutation.
- Gate 73B key finding: top 20 weekly-hold winners average `21.4` positive
  trades and `0.537663` of week ADR from the top 5 final trade legs.
- Gate 73B green-giveback end-state: `222` weeks; `163` mixed end-state,
  `55` broad laggard-drag, and `4` few-surviving-leader weeks.
- Gate 73B explicitly binds the path timing gap: existing warehouses do not
  provide trade-level MFE/MAE timestamps, trade contribution at basket MFE, live
  checkpoint runner identification, or trade-level recovery after adverse
  threshold. Dynamic trade exits need a dedicated trade-leg path warehouse, or
  Gate 73C must stay limited to hypotheses answerable by current warehouses.
- Gate 73A used the Gate 71B diagnostics and Gate 71C/72C exit ledgers only;
  no raw M1 rebuild, new exit rule, exit promotion, or risk layer was started.
- Gate 73A classified all 373 weekly basket paths and produced MFE/MAE,
  giveback, time-to-extreme, threshold-hit, right-tail dependency, and shortlist
  attribution artifacts.
- Top 20 weekly-hold winners contributed `1.077375x` total net ADR. The system
  has clear right-tail dependency.
- Green-then-giveback weeks occurred at `0.595174`; there is real profit
  protection opportunity, but it cannot be solved by clipping runners.
- Gate 72 shortlist rules all clipped the top 20 weekly-hold winners heavily:
  `TRAIL_TP_A100_F050_T200` lost `664.612016` ADR versus weekly hold on top 20
  weeks; `GLOBAL_TP_125_STOP_WEEK` lost `658.692234`; `TRAIL_A075_F025` lost
  `489.683465`; `GLOBAL_TP_050_STOP_200` lost `684.113588`.
- Gate 73A recommendation: next design should be runner-preserving profit
  protection, not another broad fixed-target matrix.

Gate 73-82 commands:

- `npm run engine:gate73a:weekly-basket-path-anatomy`
- `npm run engine:gate73b:trade-leg-anatomy-preflight`
- `npm run engine:gate73c:direction-continuation-lifecycle`
- `npm run engine:gate74a:trade-leg-path-warehouse-protocol-freeze`
- `npm run engine:gate74b:trade-leg-path-materialization`
- `npm run engine:gate74c:gross-replay-adapter-sanity-pack`
- `npm run engine:gate74d:pair-net-grid-open-loss-forensics`
- `npm run engine:gate74e:pair-net-grid-tail-containment-adapter-pack`
- `npm run engine:gate75a:broad-exit-family-taxonomy-protocol-freeze`
- `npm run engine:gate76:pair-directional-two-sided-grid-reset-limit-lifecycle-discovery`
- `npm run engine:gate77:pair-two-sided-reset-limit-confirmation-failure-anatomy`
- `npm run engine:gate78:pair-two-sided-limited-reentry-enhancement-matrix`
- `npm run engine:gate78a:limited-reentry-institutional-scorecard`
- `npm run engine:gate79:flip-loss-adverse-inventory-root-cause-audit`
- `npm run engine:gate80:fully-hedged-baseline-validity-normalization-edge-attribution`
- `npm run engine:gate81:hedged-broker-real-feasibility-preflight`
- `npm run engine:gate82:hedged-grid-four-variant-preflight`
- `npm run engine:gate82d:hedged-grid-v2-price-anchor-comparison`

Current verdicts:

- Gate 73A:
  `PASS_GATE73A_WEEKLY_BASKET_PATH_ANATOMY__RIGHT_TAIL_AND_GIVEBACK_PROFILE_VISIBLE`
- Gate 73B:
  `PASS_GATE73B_TRADE_LEG_COMPOSITION_PREFLIGHT__FINAL_COMPOSITION_VISIBLE_PATH_TIMING_GAP_BOUND`
- Gate 73C:
  `PASS_GATE73C_DIRECTION_CONTINUATION_LIFECYCLE__PERSISTENCE_AND_COST_SENSITIVITY_VISIBLE`
- Gate 74A:
  `PASS_GATE74A_TRADE_LEG_PATH_WAREHOUSE_PROTOCOL_FREEZE__POLICY_NEUTRAL_PRIMITIVES_ONLY`
- Gate 74B:
  `PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY`
- Gate 74C:
  `PASS_GATE74C_GROSS_REPLAY_ADAPTER_SANITY_PACK__PAIR_GRID_LIFECYCLE_VISIBLE_NO_PROMOTION`
- Gate 74D:
  `PASS_GATE74D_PAIR_NET_GRID_OPEN_LOSS_FORENSICS__UNRESOLVED_INVENTORY_AND_DRAWDOWN_ANATOMY_VISIBLE`
- Gate 74E:
  `PASS_GATE74E_PAIR_NET_GRID_TAIL_CONTAINMENT_ADAPTER_PACK__TAIL_MECHANICS_AND_UNIVERSAL_CONTAINMENT_RANKING_VISIBLE_NO_PROMOTION`
- Gate 75A:
  `PASS_GATE75A_BROAD_EXIT_FAMILY_TAXONOMY_PROTOCOL_FREEZE__MATRIX_PLAN_PREDECLARED_NO_EXECUTION`
- Gate 76:
  `PASS_GATE76_PAIR_DIRECTIONAL_TWO_SIDED_GRID_RESET_LIMIT_DISCOVERY__RECOVERY_EXPANSION_AND_ACCOUNT_RESET_LIFECYCLE_VISIBLE_NO_PROMOTION`
- Gate 77:
  `PASS_GATE77_PAIR_TWO_SIDED_RESET_LIMIT_CONFIRMATION_FAILURE_ANATOMY__PAIR_LIMIT3_PROMISING_RESEARCH_ONLY_NO_PROMOTION`
- Gate 78:
  `PASS_GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX__RUNNER_AND_REFERENCE_SL_VISIBLE_NO_PROMOTION`
- Gate 78A:
  `PASS_SCORECARD_T100_L3_REMAINS_PRIMARY_CANDIDATE_NO_PROMOTION`
- Gate 79:
  `FAIL_LIMITED_REENTRY_FAMILY_TOO_WEAK_FOR_TARGET_NO_PROMOTION`
- Gate 80:
  `PASS_HEDGED_BASELINE_PROMISING_BUT_COST_MARGIN_VALIDATION_REQUIRED_NO_PROMOTION`
- Gate 81:
  `PASS_HEDGED_FEASIBILITY_PREFLIGHT__ONE_PAIR_MT5_PROTOTYPE_NEXT_NO_PROMOTION`
- Gate 82:
  `PASS_FOUR_VARIANT_HEDGED_GRID_DIAGNOSTIC_BUILT_NO_PROMOTION`

Gate 72 reference:

- Gate 72A audited the Gate 71B-M basket path warehouse manifest:
  `gate71bm_basket_path_1A8231225169`.
- Gate 72A confirmed direct bindings for Candidate B ledger file hash, price
  bundle, 1m path resolution, clean exposure model, ADR target, warehouse hash,
  and coverage.
- Gate 72A caveat: Gate 68 capsule identity is bound transitively through Gate
  69B and Gate 71A/71B-M, not as a direct warehouse manifest field.
- Gate 72B confirmed the Gate 71C matrix ledger shape:
  `373` weeks x `34` rules = `12,682` weekly rows, with no duplicate rule-week
  rows and no raw M1 rebuild during replay.
- Gate 72C produced a research-only family shortlist. No clean exit rule passed
  all promotion constraints because clean rules improved win rate by clipping
  weeks but collapsed total ADR versus weekly hold and usually worsened year
  stability.
- Gate 72D review/no-promotion packet passed.
- No exit rule has been promoted.

Gate 71 reference:

- Gate 71B-M materialized the full reusable Candidate B basket path warehouse:
  `gate71bm_basket_path_1A8231225169`.
- Gate 71B full 373-week diagnostics passed from the basket path warehouse with
  no raw M1 rebuild during diagnostics.
- Gate 71C full matrix passed from the same basket path warehouse with no raw
  M1 rebuild during policy replay.
- Legacy ADR Grid is a coupled entry+exit control only.

## Gate 70 Reference

Gate 70D is complete and remains the exit/risk interface lock:

- Gate 70A:
  `PASS_LOCKED_BRAIN_INPUT_PREFLIGHT__B_READONLY_C_MONITORING_ONLY`
- Gate 70B:
  `PASS_EXIT_EXPRESSION_INTERFACE_PREFLIGHT__MANAGEMENT_ONLY_NO_DIRECTION_MUTATION`
- Gate 70C:
  `PASS_RISK_PORTFOLIO_EXPRESSION_PREFLIGHT__MAY_REDUCE_EXPRESSION_NOT_BRAIN_TRUTH`
- Gate 70D:
  `PASS_GATE70_REVIEW_PACKET_COMPLETENESS__INTERFACE_PREFLIGHT_ARTIFACTS_VISIBLE`

## Gate 69 Reference

Gate 69D is complete and remains the lock reference:

- Gate 69A:
  `PASS_FINAL_FORCED28_LOCK_CONTRACT__CANDIDATE_B_DEFAULT_CANDIDATE_C_SHADOW_NO_SELECTOR`
- Gate 69B:
  `PASS_FINAL_FORCED28_LEDGER_REPLAY__B_DEFAULT_C_SHADOW_BOUND_TO_GATE68_CAPSULE`
- Gate 69C:
  `PASS_EXIT_RISK_INTERFACE_AND_NO_DRIFT__BRAIN_FORCED28_OUTPUT_ONLY_RISK_MUTATION_FORBIDDEN`
- Gate 69D:
  `PASS_GATE69_REVIEW_PACKET_COMPLETENESS__LOCK_LEDGER_INTERFACE_ARTIFACTS_VISIBLE`

Gate 69 locked state:

- Locked algorithm id: `gate69_locked_unnamed_forced28_candidate_b_default`.
- Final algorithm name: `null`.
- Default candidate: `candidate_b_macro_anchor_with_cot_warning`.
- Shadow/canary candidate: `candidate_c_scenario_memory_guarded`.
- Rejected lock target: `candidate_d_brain_mode_selector`.
- No Candidate E or additional router was added.
- Final Candidate B ledger hash:
  `5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390`.
- Candidate C shadow ledger hash:
  `DF4170736BC34CF95F616F8888849F018BB33A78EAEACC910E1E4C56B1408720`.

Gate 68 capsule reference:

- Capsule ID: `gate68c_frozen_reference_capsule_C8DC7E99DE640C2D`.
- Capsule SHA:
  `C8DC7E99DE640C2DEA0817C0F48F604575D4FB5CCBC9A9C787261FB4E63073A3`.

## Stop Boundary

Stop after Gate 81 unless Freedom explicitly opens the next gate.

Do not proceed to Gate 75B broad matrix execution, additional account-level
synchronized exit materialization, broad fixed ADR spacing matrix,
risk/portfolio expression matrix, final exit promotion, final algorithm
naming/branding, Alpha v2 promotion, risk overlays, pair-specific pruning,
regime-specific exits, fair-value pruning, all-28 execution, MT5/live portfolio
runtime, app/runtime work, source mutation, COT retuning, Strength retuning,
Regime retuning, broad source consolidation, optimized threshold search, learned
weights, pair/date exclusions, P&L attribution, or live trading unless Freedom
explicitly opens that scope.

Permanent rule: Alpha and Regime layers must force 28. Only risk/portfolio
layers may later reduce actual trade expression, while the shadow ledger retains
all 28 signal outcomes.

## Current Ownership Model

- `app/` keeps only app runtime, public assets, release evidence, and app config.
- `engine/` owns reusable local institutional research/backtest source code,
  commands, cached data, and generated engine reports.
- `database/` owns neutral DB access used by app server code and engine code.
- `automation/` owns MT5 assets, bots, sentiment scraper, voice helpers, and
  Playwright automation.
- `archive/` owns stale historical reports, research workspaces, and one-off
  scripts mirrored by original path.

## Active Gate Docs

`docs/research/gates/gate82_preflight/GATE82_HEDGED_GRID_FOUR_VARIANT_PREFLIGHT_2026-06-30.md`

`docs/research/gates/gate81/GATE81_HEDGED_BROKER_REAL_FEASIBILITY_PREFLIGHT_2026-06-30.md`

`docs/research/gates/gate80/GATE80_FULLY_HEDGED_BASELINE_VALIDITY_NORMALIZATION_EDGE_ATTRIBUTION_2026-06-30.md`

`docs/research/gates/gate79/GATE79_FLIP_LOSS_ADVERSE_INVENTORY_ROOT_CAUSE_AUDIT_2026-06-30.md`

`docs/research/gates/gate78a/GATE78A_LIMITED_REENTRY_INSTITUTIONAL_NUMERIC_SCORECARD_SUPPLEMENT_2026-06-30.md`

`docs/research/gates/gate78/GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX_2026-06-29.md`

`docs/research/gates/gate77/GATE77_PAIR_TWO_SIDED_RESET_LIMIT_CONFIRMATION_FAILURE_ANATOMY_2026-06-29.md`

`docs/research/gates/gate76/GATE76_PAIR_DIRECTIONAL_TWO_SIDED_GRID_AND_RESET_LIMIT_LIFECYCLE_DISCOVERY_2026-06-29.md`

`docs/research/gates/gate75a/GATE75A_BROAD_EXIT_FAMILY_TAXONOMY_PROTOCOL_FREEZE_2026-06-29.md`

`docs/research/gates/gate74e/GATE74E_PAIR_NET_GRID_TAIL_CONTAINMENT_ADAPTER_PACK_2026-06-29.md`

`docs/research/gates/gate74d/GATE74D_PAIR_NET_GRID_OPEN_LOSS_FORENSICS_2026-06-29.md`

`docs/research/gates/gate74c/GATE74C_GROSS_REPLAY_ADAPTER_SANITY_PACK_2026-06-29.md`

`docs/research/gates/gate74b/GATE74B_TRADE_LEG_PATH_MATERIALIZATION_2026-06-29.md`

`docs/research/gates/gate74a/GATE74A_TRADE_LEG_PATH_WAREHOUSE_PROTOCOL_FREEZE_2026-06-29.md`

`docs/research/gates/gate73c/GATE73C_DIRECTION_CONTINUATION_LIFECYCLE_2026-06-29.md`

`docs/research/gates/gate73b/GATE73B_TRADE_LEG_ANATOMY_PREFLIGHT_2026-06-29.md`

`docs/research/gates/gate73a/GATE73A_WEEKLY_BASKET_PATH_ANATOMY_2026-06-29.md`

`docs/research/gates/gate72a/GATE72A_WAREHOUSE_MANIFEST_BINDING_AUDIT_2026-06-28.md`

`docs/research/gates/gate72b/GATE72B_MATRIX_LEDGER_SANITY_REVIEW_2026-06-28.md`

`docs/research/gates/gate72c/GATE72C_EXIT_FAMILY_RANKING_SHORTLIST_2026-06-28.md`

`docs/research/gates/gate72d/GATE72D_REVIEW_PACKET_NO_PROMOTION_2026-06-28.md`

`docs/research/gates/gate71a/GATE71A_EXIT_TESTING_PROTOCOL_FREEZE_2026-06-28.md`

`docs/research/gates/gate71b/GATE71B_M_EXIT_PATH_MATERIALIZATION_WAREHOUSE_2026-06-28.md`

`docs/research/gates/gate71b/GATE71B_BASKET_ADR_PATH_DIAGNOSTICS_2026-06-28.md`

`docs/research/gates/gate71c/GATE71C_EXIT_BASELINE_MATRIX_2026-06-28.md`

`docs/research/gates/gate71d/GATE71D_REVIEW_PACKET_NO_DRIFT_2026-06-28.md`

## Forward Research Command

After Gate 56E parity, the shared engine evaluator entry point is:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --artifact-gate=gate55 --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic
```

For fast manifest aggregation over the durable Gate 57A0B path-outcome
warehouse, add the explicit warehouse ID. This mode validates the warehouse and
fails closed if rows are missing or hash-invalid; it does not silently rerun M1
path simulation:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --artifact-gate=gate57 --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```
