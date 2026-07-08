# Gate 99ZZD - Revma TP/SL Research Boundary

Date: 2026-07-07

Status: OPEN - boundary only

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

Recovered EA commit:
`bd286299bbaf9cb4a5edcb30a29b15c9a755697d`
(`Simplify Revma EA inputs and SLTP modes`)

Current branch head at boundary open:
`fa44e296bc717fe2a6e0169f55a8553d8fb804d8`
(`Ingest research paper batch 02 metadata`)

## Purpose

Gate 99ZZD opens TP/SL research for the active Revma EA lane without adding
more EA features first.

Gate 99ZZC passed for a narrow operator-surface cleanup and temporary after-fee
SL/TP scaffolding. That scaffolding is intentionally not the final algorithm.
This gate exists to define the research contract before any further
`LimniPortfolioEA` mutation.

First shadow-contract packet:
`docs/research/gates/gate99/GATE99ZZD_REVMA_TPSL_EVIDENCE_INVENTORY_SHADOW_CONTRACT_2026-07-07.md`

## Current Revma Surface

Active EA system:

- Revma is the only operator-facing active EA system.
- Revma all-28 evaluation remains available through
  `RevmaUniverseMode=LP_UNIVERSE_FX28`.
- `RevmaSleeveMode` controls continuation and mean-reversion sleeve selection.

Temporary SL/TP controls from Gate 99ZZC:

- `StopTakeProfitMode=LP_SLTP_DISABLED`
- `StopTakeProfitMode=LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES`
- `StopTakeProfitMode=LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES`
- `TakeProfit`
- `StopLoss`
- `StopTakeProfitCloseCommissionPerLot`

Current semantics:

- Correction after Gate 99ZZE: single-pair mode treats `TakeProfit` and
  `StopLoss` as q units for the frozen active Revma grid, not individual
  tickets. Summed active grid money after estimated close fees triggers a
  managed close-grid intent. Broker-side ticket `TP`/`SL` fields are not the
  proof surface for this mode and may remain `0.00000`.
- Multi-currency mode treats `TakeProfit` and `StopLoss` as account-balance
  percent and emits a managed close-all intent when managed open floating PnL
  after estimated close fees crosses the configured threshold.
- Close execution remains behind the existing close/account-close/execution
  safety barriers.

## Scope

Allowed in this gate:

- Define the TP/SL research questions and pass/fail boundary.
- Inventory relevant prior exit, trailing, pain-stop, account-harvest, and
  lifecycle evidence without converting old results into Revma claims.
- Design the first shadow-evaluation packet for Revma TP/SL behavior.
- Decide what telemetry or receipts are missing before a defensible research
  replay can run.
- Produce reviewable research artifacts under `docs/research/gates/gate99/`.

Frozen in this gate:

- No EA source mutation.
- No new operator inputs.
- No final TP/SL manager implementation.
- No all-28 Revma backtest.
- No optimization.
- No profitability, performance, promotion, or live-readiness claim.
- No exposure/grid-cap validation.
- No Katarakti work.
- No Q-state or future-system resurrection.
- No paper-ingestion work. `docs/research/papers/*`,
  `docs/literature/papers/*`, and
  `docs/literature/papers/limni_remaining_research_paper_links.csv` remain in
  the separate research-paper lane.
- No `.husky` hook staging or cleanup.

## Research Questions

The TP/SL research must answer these before implementation:

1. What is the managed object?
   - individual order
   - frozen Revma grid
   - symbol-level managed inventory
   - account-level all-28 managed inventory
   - staged hybrid of the above

2. What is the correct unit?
   - q distance
   - account-balance percent
   - equity percent
   - ADR-normalized movement
   - money after fees and swap

3. What is the close trigger?
   - hard take profit
   - hard stop loss
   - high-water activation plus trail
   - pain-first stop-add before profit
   - winddown after breach
   - time/session/news guard interaction

4. What gets blocked after a trigger?
   - only new entries
   - grid adds
   - both entries and adds
   - close execution only
   - account-level recovery lock until flat

5. What is the execution path?
   - broker-side SL/TP attached at open/add
   - managed close-grid intent
   - managed close-symbol intent
   - managed close-all account intent
   - staged reduce/winddown plan

6. What receipts prove correctness?
   - trigger basis
   - pre-close gross money
   - estimated fees
   - swap inclusion or exclusion
   - net money after fees
   - open positions targeted
   - positions closed or failed
   - post-close state
   - blocked-entry/add state
   - frozen grid identity

## Candidate Families To Evaluate

These are research candidates, not implementation promises:

- Current scaffolding baseline:
  disabled, single-pair q after fees, and multi-currency percent after fees.
- Grid-level q hard TP/SL:
  close or protect each frozen Revma grid using q movement from birth/add basis.
- Symbol-level managed TP/SL:
  close all managed Revma inventory for one symbol after net open money or q
  threshold.
- Account-level percent TP/SL:
  current Gate 99ZZC concept, but tested against all-28 path behavior and close
  integrity.
- Account-level HWM/trailing:
  activate after net managed open profit, trail from high-water mark, and define
  reset/unlock semantics.
- Pain-first stop-add:
  stop feeding a grid when adverse excursion arrives before meaningful profit.
- Winddown mode:
  block new entries/adds after breach and close only under a defined recovery
  condition.
- Hybrid staged manager:
  combine grid-level protection, account-level harvest, and recovery locks only
  if simpler candidates fail to explain the risk shape.

## Required Evidence Before EA Mutation

Before changing MQL again, this lane needs a research packet that includes:

- exact candidate definition;
- exact managed object;
- exact units;
- fee/swap/accounting basis;
- required receipts;
- test window and symbol universe;
- source lineage and price/tick limitations;
- expected failure modes;
- pass/fail thresholds;
- artifact paths;
- reviewer decision.

If a replay or tester run is used, the result must be labelled as one of:

- mechanics proof;
- diagnostic-only research;
- promotion-eligible research.

Promotion-eligible research requires a defensible source lineage. MT5 terminal
history without canonical lineage is diagnostic unless the gate explicitly
states a waiver and why.

## First Recommended Work Packet

Gate 99ZZD should start with a no-code TP/SL evidence inventory and shadow
contract:

1. Inventory prior lifecycle evidence from Gate 90D, Gate 98, Gate 99R,
   Gate 99U, Gate 99ZZB, and Gate 99ZZC.
2. Extract only reusable lessons, not stale strategy claims.
3. Define the first Revma TP/SL shadow candidate in plain terms.
4. Define the receipt fields needed to evaluate it.
5. Stop for review before running a backtest or editing EA source.

## Stop Line

Stop after the TP/SL research boundary and first shadow-contract plan are
reviewable.

Do not add more EA features until Freedom approves the first TP/SL research
candidate and its evidence path.

## Boundary Verdict

Gate 99ZZD is open as a research-boundary gate only.

Gate 99ZZC remains a PASS for narrow implementation and compile/static proof,
but its SL/TP controls are temporary scaffolding. The next valid action is a
research packet, not another MQL feature pass.
