# ChatGPT Pro Review Prompt - Gate 99ZZE Revma Grid TP Architecture

Mode: OUTSIDER CODE REVIEW

Repo:
`C:/Users/User/Documents/GitHub/limni-website`

Branch:
`codex/gate88-mt5-lifecycle-protection-controls`

Primary EA:
`automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`

Primary include tree:
`automation/mt5/Experts/Include/**`

Related Revma signal includes:

- `automation/mt5/Experts/Include/Strategies/RevmaGridSleeve.mqh`
- `automation/mt5/Experts/Include/Strategies/RevmaTypes.mqh`
- `automation/mt5/Experts/Include/Signals/RevmaSignalState.mqh`
- `automation/mt5/Indicators/Include/LimniPairDirectionCore.mqh`
- `automation/mt5/Indicators/Include/LimniQStateCore.mqh`
- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`

Gate reports and artifacts to read:

- `docs/research/gates/gate99/GATE99ZZA_REVMA_FROZEN_ADD_LOOKUP_VISUAL_REPORTING_2026-07-07.md`
- `docs/research/gates/gate99/GATE99ZZC_REVMA_OPERATOR_SURFACE_SLTP_AFTER_FEES_2026-07-07.md`
- `docs/research/gates/gate99/GATE99ZZD_REVMA_TPSL_RESEARCH_BOUNDARY_2026-07-07.md`
- `docs/research/gates/gate99/GATE99ZZD_REVMA_TPSL_EVIDENCE_INVENTORY_SHADOW_CONTRACT_2026-07-07.md`
- `docs/research/gates/gate99/GATE99ZZE_REVMA_GRID_BASKET_TP_REPAIR_2026-07-07.md`
- `docs/research/gates/gate99/artifacts/gate99zze-revma-grid-basket-tp-repair-2026-07-07/gate99zze-proof-summary.txt`
- `docs/research/gates/gate99/artifacts/gate99zze-revma-grid-basket-tp-repair-2026-07-07/gate99zze-audchf-tp01-smoke-analysis.txt`
- `docs/research/gates/gate99/artifacts/gate99zze-revma-grid-basket-tp-repair-2026-07-07/gate99zze-audchf-tp01-smoke-details.txt`
- `docs/research/gates/gate99/artifacts/gate99zze-revma-grid-basket-tp-repair-2026-07-07/gate99zze-audchf-tp01-smoke-chronology.csv`

## Current Situation

Revma v001 is the current Pair Direction / Grid Sleeve strategy inside
`LimniPortfolioEA`. It is not the old hedge EA, not Alpha V3, not Katarakti,
and not legacy Q-state.

Gate 99ZZE changed the single-pair q TP behavior from per-ticket broker TP/SL
to a managed close-grid lifecycle:

```text
active grid floating PnL - estimated close fee >= q-derived target money
=> emit revma_grid_exit
=> emit close-grid intent
=> RiskArbiter builds exact grid magic
=> TradeRouter closes matching symbol/magic positions
```

The hidden AUDCHF smoke passed that managed close-grid path:

- `births=3`
- `adds=36`
- `revma_basket_tp_reached=6`
- `close_scan_attempted_total=39`
- `close_scan_closed_total=39`
- final `open_grids=0`
- final `grid_positions=0`
- `bad_order_result_count=0`

However, Freedom's intended operator/visual expectation is sharper:

```text
The EA should set a grid-level TP.
With one trade, that is just the one trade's TP.
As more trades are added, the grid-level TP should move/change so the whole
grid closes at the configured basket/q target.
```

In MT5 terms, that likely means all open tickets in the grid should have their
broker-side `T/P` modified to the same current basket target price, or an
equivalent institutional implementation must clearly justify why broker-side
TP is not used and still provide reliable visible/operator proof.

The current Gate 99ZZE implementation does **not** set broker-side `T/P`.
It uses managed close-grid execution. Freedom still sees `T/P=0.00000` and
considers that incorrect for the intended grid TP behavior.

## Review Objectives

Review the entire EA code path, not just the latest patch. Prioritize defects,
architecture mismatches, lifecycle risks, and missing tests. Do not optimize
parameters. Do not claim edge. Do not recommend all-28 testing until one-pair
grid TP mechanics are correct.

Answer these questions:

1. Is the intended contract best implemented as broker-side grid TP price
   modification, managed close-grid execution, or a hybrid?
2. If broker-side grid TP is appropriate, where should it live architecturally?
   Strategy lane, risk layer, execution layer, or a dedicated lifecycle manager?
3. How should the basket target price be calculated for BUY and SELL grids?
4. When a new add fills, how should all existing grid tickets be updated?
5. How should the code avoid slow per-tick position modification churn?
6. How should partial close failures, stale tickets, requotes, market-closed
   conditions, and repeated modification failures be receipted and handled?
7. Does the current `GridBook` have enough information for correct grid-level
   TP, or does it need weighted average, side-specific, fee/swap, and ticket
   detail changes?
8. Does the current startup/reentry gate remain correct when a broker-side grid
   TP closes exposure asynchronously?
9. Is the current `StopTakeProfitMode` naming/operator surface still right, or
   should it be renamed to make grid TP behavior obvious?
10. What code logic from Gate 99ZZC/99ZZE should be purged as wrong or
    temporary scaffolding?

## Required Output

Please return a concise code-review report with:

- Findings first, ordered by severity, with file/line references where
  possible.
- A recommended target architecture for Revma grid TP.
- A minimal patch plan, but do **not** write code.
- Required receipts for proof.
- The next smallest MT5 one-pair test.
- Explicitly list what is proven, implemented but unproven, and missing.

## Hard Boundaries

Do not recommend:

- all-28 testing;
- optimization;
- profitability or edge claims;
- live-readiness;
- Katarakti work;
- legacy Q-state/future-system resurrection;
- institutional q-native exits beyond what is needed to fix crude Revma grid TP.

Treat Gate 99ZZE as a checkpoint for review, not as accepted final architecture.
