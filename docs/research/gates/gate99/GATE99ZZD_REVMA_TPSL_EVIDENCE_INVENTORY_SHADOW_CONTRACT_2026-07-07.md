# Gate 99ZZD - Revma TP/SL Evidence Inventory And Shadow Contract

Date: 2026-07-07

Status: REVIEW PACKET - no code, no backtest

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

Related boundary:
`docs/research/gates/gate99/GATE99ZZD_REVMA_TPSL_RESEARCH_BOUNDARY_2026-07-07.md`

## Purpose

This packet starts TP/SL research proper without changing `LimniPortfolioEA`.

It inventories existing exit/lifecycle evidence, extracts only reusable lessons,
and defines the first Revma shadow contract to review before any tester run or
MQL edit.

No evidence below is a Revma profitability claim unless explicitly labelled as
Revma evidence. Most of the useful prior work came from Triangle, Katarakti, or
portfolio-skeleton gates and is used here only as lifecycle-design guidance.

## Evidence Inventory

### Gate 90D Protection Research

Source reports:

- `docs/research/gates/gate90/GATE90D_2019_OPEN_PROTECTION_SWEEP_NO_CANDIDATE_B_2026-07-03.md`
- `docs/research/gates/gate90/GATE90D_2019_OPEN_BAD_CYCLE_ORIGIN_AND_TRAILING_RESEARCH_2026-07-03.md`
- `docs/research/gates/gate90/GATE90D_2019_OPEN_LIVE_STATE_GUARD_REPLAY_2026-07-03.md`
- `docs/research/gates/gate90/GATE90D_2019_OPEN_EOD_HOLD_RED_REPLAY_2026-07-03.md`
- `docs/research/gates/gate90/GATE90D_2019_OPEN_EOD_HOLD_RED_MAX3D_REPLAY_2026-07-03.md`
- `docs/research/gates/gate90/GATE90D_2026_OPEN_PAIN_STOP_STRICT_NO_CANDIDATE_B_2026-07-03.md`

Reusable lessons:

- Global 1Q trailing was not a free win. On the strict 2019 surface,
  `trail_1q_0_5q` created protection net but lowered account return versus
  baseline.
- Protected flatten mostly moved loss timing. It improved some target/flatten
  splits but booked ugly-red losses under `protected_flatten`.
- The useful live-safe rule was pain-first stop-add:
  if a cycle reached `-1Q` adverse excursion before `+0.5Q` favorable
  excursion, stop adding to that cycle.
- On the 2019 strict surface, pain-first stop-add improved account return from
  `+1.17%` to `+2.29%`, reduced max drawdown from `-2.19%` to `-0.67%`,
  improved close PF from `1.230` to `1.712`, and reduced entries from `689` to
  `529`.
- The hard `-2Q` circuit was too blunt. It cut some damage but booked too much
  protection loss.
- Hold-red was rejected. Uncapped hold-red created multi-month inventory, and
  a max-3D hold-red cap still failed against normal daily flatten plus
  pain-first stop-add.
- The 2026 strict no-Candidate-B replay also improved under pain-first
  stop-add, moving from slightly red to green on the tested window, but it was
  weaker than 2019 and still showed pair-specific pressure such as JPY.

Revma applicability:

- Use excursion chronology before designing close rules.
- Do not start with global trailing.
- Do not hold red merely because it is red.
- First Revma research should test whether pain-first stop-add transfers to
  frozen Revma grids before implementing any hard-close manager.

### Gate 98 Account Exit Correction

Source report:

- `docs/research/gates/gate98/GATE98_KATARAKTI_ENTRY_STACK_ABLATION_CLOSEOUT_2026-07-05.md`

Reusable lessons:

- Account-level exits must be account-percent and fee-aware, not raw ADR totals.
- The account trigger used magic-filtered open MT5 positions:
  `gross open money = sum(POSITION_PROFIT + POSITION_SWAP)`.
- Estimated close fee was subtracted before threshold comparison:
  `net open pct = 100 * (gross open money - estimated close fee) / AccountBalance`.
- The close path must fail closed: if MT5 positions do not actually close, log
  the block, do not record a basket close, and do not reset internal state.
- The six-year survivor was useful as a reference specimen, but it was fragile
  and depended on multiple time-based layers. Account TP alone did not solve
  the 2020 inventory failure.

Revma applicability:

- Revma account-level TP/SL must use net money after fees and must prove close
  integrity.
- Raw q or ADR geometry is not enough for account-level truth.
- Account TP/SL is not a substitute for inventory-shape controls.

### Gate 99R Harvest Governor Foundation

Source report:

- `docs/research/gates/gate99/GATE99R_PORTFOLIO_HARVEST_GOVERNOR_2026-07-06.md`

Reusable contracts already in `LimniPortfolioEA`:

- Managed positions are classified as entry, grid, external/manual, or unknown
  managed inventory.
- Managed EA floating PnL is refreshed every engine step.
- `AccountHarvestGuard` owns a non-executing HWM state machine:
  disabled, config invalid, armed initial target, HWM active, soft lock active,
  grid winddown active, and emergency liquidation armed.
- The governor can block new entries on breach states, but it does not close
  positions.
- Open decisions remain unresolved: managed-floating-PnL versus equity/balance
  HWM basis, emergency liquidation semantics, grid grouping identity, and reset
  or unlock rules.

Revma applicability:

- The EA already has the right non-executing place for account HWM/trail state.
- TP/SL research should decide the basis and unlock rules before turning this
  into execution behavior.

### Gate 99U Close Execution Skeleton

Source report:

- `docs/research/gates/gate99/GATE99U_STRATEGY_READY_SKELETON_2026-07-06.md`

Reusable contracts already in `LimniPortfolioEA`:

- Close execution has its own kill switch:
  `EnableCloseExecution=false`.
- Account close-all has an additional independent switch:
  `EnableAccountCloseExecution=false`.
- `MaxClosePositionsPerStep` caps close attempts per engine step.
- The router matches only managed Limni positions and receipts disabled,
  blocked, scan, request, and result paths.
- Portfolio recovery lock blocks new opens but does not block risk-approved
  exits.

Revma applicability:

- Any future account-level TP/SL close-all must stay behind the existing close
  and account-close barriers.
- The first research packet can be shadow-only; execution is already separated
  enough to wait.

### Gate 99ZZB And Gate 99ZZC SL/TP Scaffolding

Source reports:

- `docs/research/gates/gate99/GATE99ZZB_REVMA_BASIC_MULTIPAIRS_SLTP_CONTROLS_2026-07-07.md`
- `docs/research/gates/gate99/GATE99ZZC_REVMA_OPERATOR_SURFACE_SLTP_AFTER_FEES_2026-07-07.md`

Current implemented scaffolding:

- Correction after Gate 99ZZE: single-pair mode no longer attaches broker-side
  ticket SL/TP to new Revma orders. It treats `TakeProfit` and `StopLoss` as q
  units for the frozen active Revma grid, sums active grid open money, subtracts
  estimated close fees, and emits a managed close-grid intent when the grid
  threshold is hit.
- Multi-currency mode uses managed open floating PnL after estimated close fees
  and emits a managed close-all intent when account-percent thresholds trigger.
- Receipts expose grid-exit basis, estimated fees, net open money after fees,
  close-grid intent fields, and account-level `stop_take_profit_guard` fields
  where account mode is enabled.

Revma applicability:

- The scaffolding is useful for operator control and receipt visibility.
- It is not the final TP/SL manager because it does not answer excursion
  chronology, grid winddown, HWM unlock, or all-28 risk-shape questions.

## First Shadow Contract

Candidate id:
`gate99zzd_revma_excursion_tpsl_shadow_v0`

Status:
definition only, not implemented

Research objective:
determine whether Revma TP/SL should begin as a managed lifecycle/excursion
controller rather than as global broker-side hard SL/TP or global trailing.

### Managed Objects

The first shadow pass must classify three layers:

- frozen Revma grid;
- symbol-level managed Revma inventory;
- account-level managed Revma inventory.

The frozen Revma grid is the primary object for excursion chronology. Account
state is secondary and must be computed after estimated close fees.

### Units

Grid-level units:

- q distance from frozen grid birth/add basis;
- first favorable excursion timestamps at `+0.5Q` and `+1Q`;
- first adverse excursion timestamps at `-1Q` and `-2Q`.

Account-level units:

- managed floating money;
- estimated close fee;
- net open money after fees;
- net open percent after fees versus balance;
- optional HWM/trail fields only after basis is reviewed.

Swap handling:

- Include swap when MT5 position data provides it.
- If swap is unavailable in a replay source, label that run diagnostic-only.

### Required Receipt Inputs

Minimum required receipts or equivalent fields:

- `revma_grid_birth`
- `revma_grid_add`
- `revma_grid_add_skip`
- `grid_inventory`
- `position_attribution`
- `stop_take_profit_guard`
- `harvest_state`
- `risk_decision`
- `trade_plan`
- `order_request`
- `order_result`
- close request/result receipts when close execution is tested later

Minimum required identifiers:

- run id;
- server time;
- symbol;
- frozen grid id;
- frozen direction;
- frozen sleeve/setup type;
- frozen add policy;
- q profile id;
- q value at birth/add;
- entry/add price basis;
- current price;
- managed position ticket/magic/lots;
- estimated close fee basis;
- account balance/equity.

### Derived Classifications

Each frozen grid must be classified into one of these first-hit states:

- `profit_1q_before_pain_1q`
- `profit_0_5q_before_pain_1q`
- `pain_1q_before_profit_0_5q`
- `pain_2q_before_profit_0_5q`
- `inside_1q`
- `unclassified_missing_data`

The first shadow action set is:

- `shadow_none`
- `shadow_stop_adds_after_pain_first`
- `shadow_profit_first_no_extra_risk`
- `shadow_account_tp_hit_after_fees`
- `shadow_account_sl_hit_after_fees`
- `shadow_hwm_trail_breach_after_fees`

No shadow hard close is approved in v0. The v0 goal is to prove whether the
chronology and accounting can be reconstructed.

### First Candidate Rule

The first candidate rule to review is:

```text
If a frozen Revma grid reaches -1Q adverse excursion before it reaches +0.5Q
favorable excursion, mark that grid as pain-first and shadow-block future adds
to that frozen grid. Do not hard-close from this rule in v0.
```

Rationale:

- It is the least invasive reusable lesson from Gate 90D.
- It attacks inventory feeding before hard liquidation.
- It can be studied against Revma birth/add receipts without changing the EA
  execution path first.

### Explicit Non-Candidates For v0

Do not start with:

- global 1Q trailing;
- global protected flatten;
- hold-red carry;
- hard `-2Q` circuit close;
- pair-specific parameter sweeps;
- all-28 optimization;
- broker-side SL/TP as the final manager.

These may remain later comparisons, but they are not first-class v0 candidates.

## Pass/Fail For The Next Research Step

The next step passes only if it produces a reviewable shadow packet with:

- complete frozen-grid reconstruction for the selected proof run;
- first-hit q chronology for every reconstructed grid;
- account net-open-after-fees fields where account-level state is evaluated;
- explicit missing-data rows rather than silent omission;
- no MQL behavior change;
- no profitability or promotion claim.

It fails if:

- frozen grid identity cannot be reconstructed;
- q basis is missing or mixed across current and birth state;
- account fee/swap basis is unclear;
- close integrity cannot be proven for any close-tested path;
- the result requires new operator features before the research question is
  answered.

## Recommended Next Action

Stop here for review of `gate99zzd_revma_excursion_tpsl_shadow_v0`.

If approved, the next no-code work should be an artifact availability audit:
confirm whether existing Gate 99ZZA/ZZB/ZZC Revma receipts contain enough data
for the shadow classifier, or whether a later telemetry-only gate is needed
before any all-28 TP/SL research run.

## Stop Line

No EA source mutation, no tester run, no all-28 backtest, no optimization, no
exposure/grid-cap validation, and no live-readiness claim was opened by this
packet.
