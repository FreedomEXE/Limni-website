# Next Chat Handoff - Gate 108 RevMA Adaptive Grid Discovery v1

Date: 2026-07-10

Status: **IMPLEMENTATION OPENED 2026-07-10. PHASE 1 IN PROGRESS. CODEX STOPS
BEFORE ALL FREEDOM-OWNED MT5 RUNTIME TESTS.**

## Copy-paste prompt

```text
You are Codex operating as Poseidon in:
C:/Users/User/Documents/GitHub/limni-website

This is a Gate 107C-R closure -> Gate 108 RevMA Adaptive Grid Discovery v1
handoff. Start read-only. Do not change code on your first pass.

Recover in this exact order:

1. C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md
2. C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md
3. AGENTS.md
4. docs/backlog/CURRENT_WORK.md
5. docs/research/gates/gate107/GATE107CR_REVMA_RESEARCH_INTEGRITY_CORRECTION_2026-07-09.md
6. docs/research/gates/gate108/GATE108_REVMA_ADAPTIVE_GRID_DISCOVERY_V1_ARCHITECTURE_2026-07-10.md
7. this handoff

Verify live git branch, HEAD, upstream, and dirty-tree truth before making any
repo-state claim. At handoff creation the observed branch/head were:

codex/gate88-mt5-lifecycle-protection-controls
36af5cd0be75

Treat those values as historical until reverified.

Current gate:

Gate 107C-R remains open only for Freedom-owned controlled runtime telemetry
validation using:

ReceiptMode=CompactLongRun
OutputFolder=AUTO

Gate 107C-R static review, compile, and terminal sync are complete. Codex must
not run Strategy Tester or any MT5 runtime automation. If Freedom has not
provided the controlled output, report that exact blocker and stop. Do not
start Gate 108 source work.

If Freedom provides Gate 107C-R output, review only the named evidence:

- expected artifacts exist;
- source revision is exact;
- executed birth/add/close identities reconcile;
- grid and account close latches reach flat;
- PnL difference is within one declared account-currency `MoneyQuantum`;
- no broker contamination or unexplained external ownership exists;
- runtime timing and output-size summaries exist.

There is no profitability interpretation in Gate 107C-R.

After Gate 107C-R is explicitly accepted, wait for Freedom to open Gate 108
implementation. Architecture approval does not itself authorize EA mutation.

The implementation-blocking human mandate is resolved:

CapitalBudgetFraction = 0.10

Freedom froze this exact value on 2026-07-10. It must be pinned in the
controlled profile and formula hash, may not be exposed as an optimization
input, and may not be changed because a branch reaches capacity or hard risk.
There is no Gate 108 budget ladder.

Gate 108 frozen architecture:

R = REAL_EXECUTION_ENVELOPE_V1
  - real MT5 positions only;
  - one 0.01 birth plus one optional 0.01 add;
  - maximum two atoms / 0.02 lots per grid;
  - execution envelope only, not market logic.

U = SHADOW_RAW_COUNT_UNCAPPED_V1
  - complete independent deterministic model-feasible, broker-free portfolio;
  - no atom-count cap, but frozen proxy capital/margin/hard-risk feasibility;
  - both adverse and favorable adds;
  - independent births, capacity, grids, cleanup, hard risk, and re-entry.

C = SHADOW_SIGNED_CENTER_SUPPORT_V1
  - identical to U;
  - for center-aligned births only, first signed support transition from
    positive to non-positive permanently freezes future adverse adds;
  - existing inventory stays alive;
  - favorable adds, cleanup, and hard risk remain separate;
  - misaligned births remain observational.

Shared:

- 0.01 indivisible atoms;
- completed-M1 decision cadence;
- DISCOVERY_MESH_V1 = 0.10 * frozen birth q, quantized outward to broker ticks;
- q-cash admission reservation and one declared frozen cycle mandate;
- RevMA-only account scope; every other strategy/external trade is absent;
- harvest before add;
- first-after-cost-positive local harvest after completed excursion;
- harvest-funded cleanup H > 0, L < 0, H + L >= 0;
- hard risk H + L <= -B;
- immutable grid terminal reason separated from escalating portfolio close
  authority (cleanup may escalate to risk without rewriting attribution);
- one shared integer minor-currency ledger for harvest, L, cleanup, risk, and
  final equity proof;
- close-owner-aware re-entry;
- centerline and path variables remain shadow/diagnostic only;
- no fitted NextAtomValue in Gate 108.

Critical add-parity rule:

The current EA can create at most one add intent per grid per completed M1.
Every branch must preserve this. If one M1 close crosses several discovery
cells, path geometry may count every completed cell, but R/U/C may admit at
most one atom at the executable price proxy. Do not backfill multiple virtual
trades across the jump.

Use `branch_id + branch_grid_id + source_m1_time` as the idempotent atom
identity. Catch-up bars may not create shadow decisions that `R` does not
receive.

Critical speed rule:

- fixed shadow_grid[2][28] plus shadow_portfolio[2];
- no virtual MT5 positions, orders, tickets, TP sync, or broker scans;
- build q/signal/center snapshot once and share it;
- incremental aggregate accounting;
- aggregate multi-cell deltas arithmetically; never create per-cell objects;
- fixed-size batch buffer streams atom/lifecycle transitions to a dedicated
  artifact; never retain the full path in memory;
- no per-tick or unchanged-per-M1 receipt rows;
- no historical-atom scan on every M1;
- resource-guard exhaustion invalidates the run; it never silently caps U/C.

Each branch uses a true two-pass completed-M1 batch:

`BeginBatch -> build all symbol candidates -> sort/allocate -> commit -> EndBatch`

`U/C` must be scheduled from the shared signal snapshot even when `R` is
blocked, closing, capacity-rejected, or disabled. They may not silently follow
`R` after divergence.

Architecture/module expectation:

- keep RevmaGridSleeve thin;
- use small Revma-owned modules for discovery types, path geometry,
  signed-center policy, shadow portfolio, and buffered telemetry;
- do not put strategy formulas in Engine;
- do not put virtual shadow APIs in TradeRouter;
- do not duplicate q/state construction;
- inspect live source and choose the smallest clean boundary before editing.

Once Gate 108 code is explicitly opened, proceed in small reviewable phases:

1. Produce a code-impact map and invariant table before mutation.
2. Add formula IDs/types and policy-neutral path primitives.
3. Add aggregate U/C shadow books with no receipts and no broker calls.
4. Add signed-center C authority and aligned/misaligned proofs.
5. Add buffered transition/final telemetry.
6. Integrate R's two-atom invariant and common lifecycle ordering.
7. Static-review shadow independence, one-add cadence, close ownership,
   reservation, q-cash fill reconciliation, cleanup, hard risk, money
   quantization, infeasibility, and re-entry.
8. Compile repo and configured terminal copies; produce source/profile hashes.
9. Stop. Freedom owns every runtime test.

Required Freedom-owned runtime sequence after implementation:

- tiny mechanics/pre-divergence parity audit;
- short shadow-enabled versus disabled performance projection;
- only after both pass, one contiguous six-year FX28 run;
- no optimization ladder.

Frozen exclusions:

No stochastic filter, anchor-side exclusion, centerline real authority, forced
center liquidation, multiple center thresholds, multiple meshes, new hard-stop
family, re-entry matrix, q redesign, pair/year exclusion, Candidate B/HWM,
Kyma/Katarakti, broad Engine rewrite, parameter optimization, promotion, or
live-readiness claim.

First response must state:

- current objective;
- active gate and prerequisite status;
- frozen areas;
- live git truth;
- whether Gate 107C-R evidence is present;
- whether `CapitalBudgetFraction` has been explicitly frozen;
- the next permitted action.
```

## Handoff intent

This handoff deliberately separates architecture approval from implementation
authority.

The architecture was reconciled across:

- current EA centerline/q-event implementation;
- Gate 107 adverse/favorable add semantics;
- Gate 107C-R execution-truth corrections;
- saved mean-reversion, inventory, and liquidation literature;
- USD 1,000 / `0.01`-lot atomic constraints;
- tester-speed and receipt-volume failures observed in earlier work;
- Freedom's requirement for an adaptive formula rather than a permanent depth
  number.

The next chat should not reopen the architecture unless live source evidence
shows a direct contradiction. Any contradiction must be reported before code.

## Proof hierarchy

```text
Gate 107C-R controlled telemetry truth
-> Gate 108 static/compile truth
-> Gate 108 tiny mechanics and parity truth
-> Gate 108 short performance projection
-> one Gate 108 six-year discovery run
-> later adaptive-equation compression gate
```

No later proof may be claimed when an earlier boundary is open.

## Permanent MT5 boundary

Codex may inspect, edit, compile, and sync MT5 code after explicit source
authorization. Codex must not run Strategy Tester, smoke runners, shard
runners, benchmarks, optimization, or other automation that executes an MT5
backtest. Freedom owns all MT5 runtime evidence.
