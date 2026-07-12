# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Hot Recovery Override

### Current Override - 2026-07-11 Gate 109 Emergency Recovery

Active lane: Gate 109 `revma-emergency-recovery`.

The bounded repair addresses the single-pair post-fill false quarantine and
restores mandatory Common Files evidence independent of optional receipts.
Precompile static checks pass. One canonical terminal compile/sync to terminal
`94497` passes with `0 errors, 0 warnings`; no Strategy Tester, optimization,
benchmark, or backtest was run by Codex.

Gate report:
`docs/research/gates/gate109/GATE109_REVMA_EMERGENCY_RECOVERY_2026-07-11.md`.

Current stop line: commit and push the repair, then stop for Freedom-owned
single-pair mechanics runtime evidence. Do not claim economic validity, FX28 R
parity, promotion, or live readiness. Single-pair remains on the legacy
`EvaluateRevmaSymbol` path until a separately approved active-symbol R
consolidation gate.

### Current Override - 2026-07-09

Active lane: Gate 107 `revma-state-signal-harvest-harness`.

Current repo branch:
`codex/gate88-mt5-lifecycle-protection-controls`.

Gate 106 is closed/deferred:

```text
No promotion. No optimization. Candidate B / HWM / account-level cleanup
research deferred. Revma live/manual observations created a new architecture
question that should not be mixed into Gate 106 evidence.
```

Gate 106 closeout:
`docs/research/gates/gate106/GATE106_CLOSEOUT_DEFER_CANDIDATE_B_HWM_2026-07-09.md`.

Gate 106A diagnostic evidence remains available but is not promotion evidence:
`docs/research/gates/gate106a/GATE106A_CANDIDATE_B_STRESS_OVERLAY_2026-07-09.md`.

Gate 107 architecture contract:
`docs/research/gates/gate107/GATE107_REVMA_STATE_SIGNAL_HARVEST_HARNESS_ARCHITECTURE_2026-07-09.md`.

Gate 107 purpose:

- Revma remains mean-reversion.
- Revma validity comes from the Revma state signal, not q-anchor location.
- q-anchor bucket is metadata only.
- q stochastic is birth/add/close metadata only.
- both adverse and favorable adds are traded and tagged.
- individual grid TP can harvest winners independently.
- account TP/HWM remains a separate portfolio cleanup layer.
- birth metadata persists by `grid_key` for restart safety.
- receipts are enough for offline attribution.
- tester speed must not degrade.

### Gate 107C-R - Revma Research-Integrity Correction

Gate 107C-R is the narrow correction pass before any serious telemetry evidence
is accepted. It hardens output-path truth, final lifecycle accounting,
account-close reconciliation, broker contamination reporting, capped grid-close
latching, strict Limni ownership, and reservation receipts.

Gate 107C does not change Revma signals, q-state formula, q-anchor or
q-stochastic usage, entry logic, adverse/favorable add policy, grid TP/SL
formula, account TP/HWM formula, optimization knobs, Candidate B, Kyma, pair
TP, or HWM experiments. The FX28 fast/smoke preset pins
`BrokerGridTpSyncMode=LiveOnly`, tester watchdog off, and lifecycle
persistence on.

`TelemetryOnly` remains a validation label, not a receipt mode. Controlled
attribution requires `ReceiptMode=CompactLongRun` and `OutputFolder=AUTO`.
`ReceiptMode=Off` / `OutputFolder=OFF` is survival/speed-only and cannot be
accepted for attribution. Runtime proof remains Freedom-owned.

Stop line: no optimization, no promotion, no stochastic filter, no q-anchor
filter, no quarantine, no recovery-only mode, no Candidate B/HWM work, no
pair-level TP, and no Strategy Tester execution by Codex.

Implementation source `c88bb16a682aebd078669a8b820c4b76ab8f0a16` is pinned by
the FX28 preset in `cc93094c5bcffa08f743daffaa30f3656eed2433`. Static review,
repository plus both-terminal compilation, and terminal source/profile sync
proof are complete. The remaining Gate 107C-R evidence is Freedom-owned
controlled telemetry validation; see
`docs/research/gates/gate107/GATE107CR_REVMA_RESEARCH_INTEGRITY_CORRECTION_2026-07-09.md`.

### Gate 108 - RevMA Adaptive Grid Discovery v1 (implementation open)

### Gate 108A canonical terminal consolidation — 2026-07-11

Canonical MT5 target is now exclusively terminal ID `94497` with data root
`C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB`.
The active manifest, synchronization tool, and static audit reject obsolete
terminal targets. The 57-file source closure, controlled preset, and canonical
EX5 were synchronized and proved in
`docs/research/gates/gate108/GATE108A_CANONICAL_TERMINAL_CONSOLIDATION_2026-07-11.md`.
No tester/backtest ran and no old terminal was removed. Freedom owns the
manual removal decision after review.

Freedom accepted Gate 107C-R as diagnostically closed and explicitly opened
Gate 108 implementation on 2026-07-10. Gate 107C-R is not a promoted strategy.
Gate 108 proceeds in small reviewable phases and stops before every
Freedom-owned MT5 runtime test.

Canonical architecture:
`docs/research/gates/gate108/GATE108_REVMA_ADAPTIVE_GRID_DISCOVERY_V1_ARCHITECTURE_2026-07-10.md`.

Next-chat handoff:
`docs/research/gates/gate108/NEXT_CHAT_GATE108_REVMA_ADAPTIVE_GRID_DISCOVERY_HANDOFF_2026-07-10.md`.

Frozen Gate 108 shape:

```text
R = two-atom real execution envelope
U = complete raw count-uncapped shadow portfolio
C = complete signed-center-support shadow portfolio
```

All branches preserve completed-M1 cadence, both adverse/favorable add
semantics, harvest-before-add ordering, q-cash/capital accounting, cleanup,
hard risk, and close-aware re-entry. Shadows use arithmetic state only and may
create at most one atom per grid per completed M1. Path diagnostics may count
all completed cells crossed by a jump, but trade admission may not backfill
multiple atoms.

Gate 108 implementation authority covers source mutation, static review,
repository/terminal compilation, and terminal source/profile sync. Codex never
owns MT5 Strategy Tester execution, smoke/shard runners, benchmarks,
optimization, or any other backtest automation.

Freedom froze the single non-optimized capital mandate on 2026-07-10:
`CapitalBudgetFraction=0.10`. It is formula/profile identity, not an MT5
optimization input, and Gate 108 may not run a budget ladder or enlarge it
after early capacity exhaustion or hard-risk liquidation.

Phase 1 source status:

- immutable discovery/profile/mesh and R/U/C branch IDs added;
- `0.10` capital mandate, `0.10q` mesh, `0.01` atom, R two-atom maximum, and
  one-admission-per-grid-M1 constants included in the formula hash;
- admission identity is branch/grid/source-M1/formula hashed;
- policy-neutral outward tick mesh and aggregate completed-cell path
  primitives added with no per-cell objects, receipts, or broker calls;
- repository compile: `0 errors, 0 warnings`.

Outsider review accepted Phase 1 for Phase 2 only:
`GATE108_PHASE1_ACCEPTED_FOR_PHASE2`. This is not Gate 108A, mechanics,
economics, or runtime-readiness acceptance.

Phase 2 source status:

- fixed `shadow_grid[2][28]` and `shadow_portfolio[2]` aggregate arithmetic
  books added for independent U/C ownership;
- no TradeRouter, order, position, history, receipt, file, symbol-info, or
  account-info dependency exists in the shadow module;
- every branch batch follows build-all, reservation/symbol/identity sort,
  allocate, commit, and reconcile sequencing;
- one candidate per symbol/grid/source-M1 identity is enforced and duplicate
  or lifecycle-inconsistent admission invalidates the branch;
- branch-local integer minor-currency state owns equity reference, budget,
  harvest, non-harvest realization, marked liquidation, cost, reservation,
  and derived equity;
- cleanup and hard-risk close authority, flat completion, cleanup shortfall,
  and close-aware re-entry are branch-local;
- arithmetic overflow, fixed-resource exhaustion, reservation mismatch, close
  mismatch, or batch-state failure invalidates the affected branch;
- repository compile: `0 errors, 0 warnings`, `467050 ms`;
- compile duration increased materially from the Phase 1 `215878 ms` receipt
  and must be visible to outsider review, though it is not Strategy Tester
  throughput evidence.

Phase 2 stop line: no signed-center authority, telemetry, R-envelope mutation,
terminal sync/compile, Strategy Tester, smoke/shard runner, benchmark,
optimization, Gate 108A acceptance, or runtime-readiness claim until the
Phase 2 source packet receives outsider review.

Outsider review accepted Phase 2 as stated evidence for Phase 3:
`GATE108_PHASE2_ACCEPTED_AS_STATED_EVIDENCE_FOR_PHASE3`. This is not repo,
runtime, mechanics, economic, or Gate 108A acceptance.

Phase 3 source status:

- C owns integer-tick signed-center support state per shadow grid;
- aligned applicability is frozen only when `Support0Sign > 0`;
- the first aligned `SupportPreviousSign > 0` to `SupportCurrentSign <= 0`
  transition permanently latches future C adverse adds off;
- favorable adds, misaligned births, U, R, existing C inventory, cleanup, and
  hard risk are outside center authority;
- missing/non-finite center observations record `CENTER_NOT_AVAILABLE` without
  latching or reclassifying applicability;
- U/C matched initialization is explicit, both branch batches must be built
  before allocation, and claimed causal opportunities require matching
  shared-origin, symbol, source-M1, candidate type, and pre-candidate economic
  state hash;
- a center-blocked candidate mutates policy metadata only; inventory, money,
  reservation, capacity, and admission identity remain unchanged;
- repository compile: `0 errors, 0 warnings`, `378418 ms`;
- EX5 size: `614142` bytes, up `138` bytes from Phase 2; compile duration
  improved about 19% from `467050 ms`, so Phase 3 did not repeat the Phase 2
  multiplicative compile-growth warning.

Phase 3 stop line: no buffered telemetry, R-envelope mutation, terminal
sync/compile, Strategy Tester, smoke/shard runner, benchmark, optimization,
Gate 108A acceptance, or runtime-readiness claim until the Phase 3 pushed clean
source packet receives outsider review.

Outsider review accepted Phase 3 as stated evidence for Phase 4:
`GATE108_PHASE3_ACCEPTED_AS_STATED_EVIDENCE_FOR_PHASE4`. This is not repo,
runtime, mechanics, parity, speed, economic, or Gate 108A acceptance.

Phase 4 source status:

- dedicated discovery transition and final-summary CSV artifacts added outside
  the general receipt writer;
- formula-hashed constants freeze transition buffer `256`, transition flush
  `64`, summary buffer `64`, summary flush `16`, line guard `8192` bytes, and
  per-artifact guard `4294967296` bytes;
- every atom admission and only named lifecycle/policy transitions can enter
  the transition stream; there is no per-tick, unchanged-M1, per-cell-object,
  position-history, broker, or general-receipt path;
- transition rows expose frozen/observed center values, support signs and q
  values, latch identity/time, blocked adverse candidates, favorable
  eligibility after latch, atoms/lots before and after, U/C shared origin and
  matched opportunity, path geometry, money ledger, decisions, and hashes;
- final summaries expose center applicable/triggered/not-triggered/
  not-applicable counts, blocked/favorable counts, lifecycle money, first
  infeasibility, flat/unresolved truth, contamination, formula cleanliness,
  reconciliation, row counts, and output bytes;
- open, header, serialization, buffer, line, byte, write, flush, schema, and
  counter failure invalidates telemetry; no evidence is silently dropped or
  capped;
- initial compile exposed two `uint -> int` FileWriteString warnings; return
  variables were corrected to `uint` before acceptance;
- final repository compile: `0 errors, 0 warnings`, `441524 ms`;
- final EX5 size: `616390` bytes, `+2248` bytes from Phase 3; compile duration
  is about 17% slower than Phase 3 but remains below Phase 2 and is not another
  multiplicative increase.

Phase 4 stop line: no R two-atom mutation, Engine scheduling, terminal
sync/compile, Strategy Tester, smoke/shard runner, benchmark, optimization,
Gate 108A acceptance, or runtime-readiness claim until the Phase 4 pushed clean
source packet receives outsider review.

Outsider review accepted Phase 4 as stated evidence and authorized the R
execution-envelope and Engine-scheduling boundary:
`GATE108_PHASE4_ACCEPTED_AS_STATED_EVIDENCE`. This remains telemetry-foundation
acceptance only, not runtime, artifact-volume, reconciliation, economic or
Gate 108A acceptance.

Phase 4R institutional foundation-hardening status:

- three adversarial read-only audits pass the frozen shadow, telemetry and
  source-identity checkpoint; no remaining Phase 4R high-severity static
  finding is open;
- exact `CapitalBudgetFraction = 1/10 = 0.10`, cycle `E_ref/B`, sequential
  branch/account IDs, completed-M1 alignment, frozen A-g and current versus
  prospective per-grid money are fail-closed and formula-identified;
- local harvest is proven before allocation; add type is recomputed from
  decision price versus executed-entry extrema plus the frozen cell; decision,
  stress-reference and fill prices are distinct and snapshot-hashed;
- U/C are paired before the narrow authorized divergence and branch-local
  afterward; C adverse authority is recomputed and cannot be caller-forged;
- one terminal candidate decision is permitted per grid/completed M1; rejected
  births, canonical R pre-route rejection and writer-owned first/latest
  infeasibility are linked without fake lifecycle state;
- immutable grid origin reason is separate from active close owner, and
  cycle/reconciliation/run cleanliness and failure fields must agree exactly;
- telemetry schema `gate108-discovery-telemetry-v12` has transition cardinality
  `133/133`, summary `88/88`, completion manifest `35`, and header-seeded hash
  chains;
- canonical local source closure: `54` files plus external compiler-library
  boundary `Trade/Trade.mqh`;
- sealed source bundle:
  `sha256:985e930f89dfce55c88a026db42725210f6b189ef98c2d147bd77975babd2516`,
  verifier `status=MATCH` before and after compilation;
- final repository-only compile attempt 17: `0 errors, 0 warnings`, `198399 ms`;
  EX5 `635728` bytes, SHA-256
  `7eac521d8fcc52d200abd59dc1ae459b7215f2ed1f53a8c0d5f5fb977e306b06`;
- discovery/R/Engine scheduling remains dormant. Shared signal provenance,
  deterministic valuation proxies, R router-stage mechanics, terminal
  row/state equivalence, true concurrent portfolio peaks/concentration and
  final summary scopes are explicit Phase 5 pre-activation blockers;
- no terminal-copy synchronization, Strategy Tester, smoke/shard runner,
  benchmark, optimization, parameter ladder or backtest automation occurred.

Phase 4R stop line: push and clean the independently re-reviewed foundation
checkpoint before R two-atom and synchronized Engine scheduling. Phase 4R does
not reopen any optimization input and makes no runtime, mechanics, speed,
parity, economic, promotion, live-readiness or funding claim.

## Historical overrides below

Everything below this heading is retained as chronological project history and
is superseded by the 2026-07-09 Gate 107C-R hot override plus the 2026-07-10
Gate 108 staged architecture above. Later historical stop boundaries and active
document lists must not override the current Gate 107C-R -> Gate 108 sequence.

### Current Override - 2026-07-07

Active lane: Gate 99ZZE `revma-grid-basket-tp-repair`.

Current repo branch:
`codex/gate88-mt5-lifecycle-protection-controls`.

Current pushed branch head observed during recovery:
`fa44e296 Ingest research paper batch 02 metadata`.

Gate 99ZZE corrects the intended one-pair crude Revma TP/SL behavior after
manual visual testing showed that the earlier Gate 99ZZC broker-side ticket
SL/TP scaffolding did not match the research contract.

Corrected contract:

- `StopTakeProfitMode=SinglePairQAfterFees` means frozen active Revma
  grid/basket TP/SL, not per-ticket broker TP/SL.
- `TakeProfit` and `StopLoss` are q units for the active Revma grid.
- The EA sums active grid open money, subtracts estimated close fees, and emits
  a close-grid intent when the grid threshold is hit.
- MT5 trade table `T/P` and `S/L` fields may remain `0.00000`; proof is through
  `revma_grid_exit`, close request/result receipts, and flat post-close grid
  inventory.
- Tester defaults are set for the first one-pair crude TP smoke:
  `EnableCloseExecution=true`, `EnableAccountCloseExecution=false`,
  `StopTakeProfitMode=SinglePairQAfterFees`, `TakeProfit=0.1`, `StopLoss=0.0`,
  `OutputFolder=LimniPortfolioEA_Gate99ZZE_Smoke`.

Gate 99ZZE report:
`docs/research/gates/gate99/GATE99ZZE_REVMA_GRID_BASKET_TP_REPAIR_2026-07-07.md`.

Gate 99ZZD boundary and shadow packet remain useful research context, but their
old broker-side single-pair scaffolding wording is superseded by Gate 99ZZE.

One-pair hidden TP smoke passed on `AUDCHF.i` for `2026.01.01` through
`2026.01.04` with `TakeProfit=0.1` and `StopLoss=0.0`: `3` births, `36` adds,
`6` grid TP triggers, `39` attempted closes, `39` closes, final grid inventory
flat, and no bad order results.

Freedom's latest correction: Gate 99ZZE's managed close-grid checkpoint is not
accepted as final because MT5 tickets still show `T/P=0.00000`. Intended
behavior is a visible/effective grid-level TP: with one trade it is that
ticket's TP; after adds, the grid TP moves/updates so the whole grid closes at
the configured basket/q target.

External review prompt:
`docs/research/gates/gate99/CHATGPT_REVIEW_GATE99ZZE_REVMA_GRID_TP_ARCHITECTURE_PROMPT_2026-07-07.md`.

Next-chat handoff:
`docs/research/gates/gate99/NEXT_CHAT_GATE99ZZE_REVMA_GRID_TP_REVIEW_WAIT_PROMPT_2026-07-07.md`.

Next valid EA action: wait for ChatGPT Pro code review. Do not patch, run
all-28, or optimize before review is read and Freedom approves the next narrow
repair gate.

Frozen: no new operator inputs, no all-28 Revma backtest, no optimization, no
exposure/grid-cap validation, no performance/profitability/promotion/
live-readiness claim, no Katarakti work, no Q-state/future-system resurrection,
no paper-ingestion work, and no `.husky` hook staging or cleanup.

Paper ingestion remains a separate lane owned by `docs/research/papers/*`,
`docs/literature/papers/*`, and
`docs/literature/papers/limni_remaining_research_paper_links.csv`.

### Current Override - 2026-07-05

Active lane: `LimniKataraktiEA` / Gate 98 closeout to Gate 99
non-time-based FormulaShadow review.

Gate 97 `limni-katarakti-ea-multipair-baseline-manual-smoke` is complete as a
manual MT5 Strategy Tester smoke checkpoint. Report:
`docs/research/gates/gate97/GATE97_LIMNI_KATARAKTI_EA_MULTIPAIRS_BASELINE_MANUAL_SMOKE_2026-07-05.md`.

Current EA under work:
`automation/mt5/Experts/LimniKataraktiEA.mq5`. Do not switch back to
`automation/mt5/Experts/LimniHedge_V1.mq5` unless Freedom explicitly reopens
that lane.

Gate 97 preserved three 2026 YTD 28-pair uncapped tight-TP runs:

- David OFF: `658` closed baskets, `+140.921307` closed-plus-marked ADR,
  `1` unresolved terminal basket, worst DD `-45.098982` ADR, unresolved USDCAD
  short reached `44` fills.
- David AGAINST: `334` closed baskets, `+90.300000` closed-plus-marked ADR,
  `0` unresolved terminal baskets, worst DD `-21.161269` ADR, max fill `21`.
- David WITH: `325` closed baskets, `+50.921307` closed-plus-marked ADR,
  `1` unresolved terminal basket, same unresolved USDCAD short shape as OFF.

All three used `KTR_LOOSE`, TP `0.10 ADR`, SL `0`, grid spacing `0.10 ADR`,
MaxBasketEntries `500`, trailing disabled, David MA `35`, David RSI
`1000/60/40`, and Stoch `1000/100/100` with `10/90`. The `1000/60/40`
settings are trial-and-error prototype settings, not proven optimal.

Freedom's Gate 98 closeout decision: stop the current time-based parameter
tuning path. Ask ChatGPT Pro for review, then open Gate 99 only after that
review is read. The intended next shape is a non-time-based FormulaShadow /
shadow EA rebuild using price action, volatility, ADR, LRMG/event logic, and
portfolio heat.

Gate 98 next-chat prompt:
`docs/research/gates/gate98/NEXT_CHAT_GATE98_KATARAKTI_ENTRY_STACK_ABLATION_PROMPT_2026-07-05.md`.

Gate 98 closeout and review handoff:

- Closeout:
  `docs/research/gates/gate98/GATE98_KATARAKTI_ENTRY_STACK_ABLATION_CLOSEOUT_2026-07-05.md`.
- ChatGPT Pro review prompt:
  `docs/research/gates/gate98/CHATGPT_REVIEW_GATE98_NON_TIME_BASED_FORMULASHADOW_PROMPT_2026-07-05.md`.
- Next Codex chat prompt:
  `docs/research/gates/gate98/NEXT_CHAT_GATE99_NON_TIME_BASED_FORMULASHADOW_PROMPT_2026-07-05.md`.

Gate 98 objective: isolate Katarakti first. The EA has been simplified for
manual MT5 piloting. Katarakti is locked internally to Loose (`KTR_LOOSE`),
Katarakti/LRMG formula parameters, export/multi-symbol/tester plumbing, and
cutoff plumbing are locked to the current 28-pair Common Files canon, and the
old visible `EntryStackPreset` selector is replaced by direct layer controls:
`Stochastic`, `LRMG`, and `David`. Receipts still export a derived
`entry_stack_preset` name plus active layer booleans, raw Katarakti candidates,
block reasons, final accepted/blocked decision, modeled/actual/accounting
prices, same-bar ambiguity counters, and aggregate pair-contribution config.

Visible MT5 inputs after the cleanup: `Longs`, `Shorts`, `Lots`, `Slippage`,
`GridSpacing`, `ExitScope`, `TP`, `SL`, `Trail`, `TrailStart`,
`TrailDistance`, `GridCap`, `Stochastic`, `K`, `Slowing`, `D`, `Oversold`,
`Overbought`, `UseD`, `LRMG`, `David`, `RSIFilter`, `RSI`, `RSI_OB`, and
`RSI_OS`. `GridCap=0` means no grid adds beyond the initial entry.
`ExitScope=EXIT_ACCOUNT` is now wired for manual backtests: pair-level
TP/SL/trail checks are disabled, the control signal is magic-filtered MT5 open
position money after expected close-side commission, and `TP`, `SL`,
`TrailStart`, and `TrailDistance` mean percent of account balance
(`exit_unit=PCT_BALANCE`). The trigger computes gross open money from
`sum(POSITION_PROFIT + POSITION_SWAP)`, subtracts estimated close commission at
`7.00 * lots`, then checks `100 * netOpenMoney / AccountBalance`. When the
account trigger fires, all
currently tracked pair baskets close with `account_tp`, `account_sl`, or
`account_trail`, then normal entry scanning resumes on later symbol bars.
Events and basket receipts include `account_close_group_id`, pre-close
gross money / estimated close fee / net money / net pct / balance / equity /
profit / position-count context. Each account harvest also writes a flushed
`*_account_exits.csv` row with pre/post balance, realized money, positions
closed/failed, estimated close fee, and realized-minus-expected net money.
`EXIT_PAIR` still uses raw ADR geometry (`exit_unit=ADR`).

Compile/install proof exists for the Gate 98 cleanup: the repo copy and active
terminal copy both compiled through MetaEditor with `0 errors, 0 warnings`; the
active terminal source hash matches the repo source hash
`8B20E5BAAE4EEA7B9C55D71867D53EB1D9C63330D973196A42EF5614B25BA6DB`.
Fresh closeout compile logs are under
`docs/research/gates/gate98/artifacts/compile-closeout-2026-07-05/`.

Patched rerun `2026_01_01_00_00_00_TESTER_84` replicated Freedom's strong
random config shape: `K_DAVID_AGAINST`, `ExitScope=ACCOUNT`, `TP=1.00`,
`SL=0`, `Trail=true`, `TrailStart=1.00`, `TrailDistance=2.00`,
`GridSpacing=0.10`, `GridCap=500`, David RSI `9/63/37`, no Stoch, no LRMG.
It stayed strong on headline numbers (`+7125.72` account money, `+1454.268324`
closed-plus-marked ADR, `55` account exit cycles) but is diagnostic only: the
new `*_account_exits.csv` exposed an April close-path failure where MT5
positions remained open after a market-close account exit attempt. The EA now
fails closed in that case: if tester orders do not actually close the expected
positions, it logs `EXIT_BLOCKED`, does not record the basket close, and does
not reset internal basket state.

Clean close-path rerun `2026_01_01_00_00_00_TESTER_181` used the same
`K_DAVID_AGAINST`, `ExitScope=ACCOUNT`, David RSI `9/63/37`, grid `0.10`, cap
`500` shape, but it was not an exact `TESTER_84` duplicate: `TP=1.00`, `SL=0`,
`Trail=true`, `TrailStart=0`, `TrailDistance=0`, so account trailing was
effectively off and every account exit was `account_tp`. It passed the new
account-exit integrity check: `53` account-exit rows, `positions_failed=0`,
`negative_realized=0`, min `pre_net_open_pct_magic=1.000018`, and total
realized account money `+7737.32`. It exported `+1457.699855` closed ADR,
`-32.959256` terminal marked ADR, `+1424.740599` closed-plus-marked ADR,
`74.0000%` win rate, and `28` unresolved open baskets. One Friday
market-close attempt at `2026.04.10 23:58:00` logged `21` `EXIT_BLOCKED` rows
for group `36`; those were not counted as closes, and the next real account TP
on `2026.04.13 00:03:00` closed `129` positions with `positions_failed=0` and
`+179.38` realized money.

Six-year check `2020_01_01_00_00_00_TESTER_260` used the clean account-TP-only
shape (`K_DAVID_AGAINST`, `ExitScope=ACCOUNT`, `TP=1.00`, `SL=0`, effective
trail off, David RSI `9/63/37`, grid `0.10`, cap `500`) and failed in the
March 2020 shock. Receipt integrity was clean: `16` account exits, all
`account_tp`, `positions_failed=0`, `negative_realized=0`, and `+1989.77`
realized account money through the last successful TP on `2020.03.04 23:46`.
Failure came from unresolved terminal exposure, not close execution: by
`2020.03.09 05:15` there were `25` open-end baskets, `507` open fills,
`-965.343315` terminal marked ADR, `-573.835125` closed-plus-marked ADR, and
`account_open_pct_min=-80.835579`. Worst terminal contributors were `CADJPY`
long `-133.297272` ADR, `EURAUD` short `-106.425382`, `USDCHF` long
`-99.888810`, `AUDJPY` long `-98.190968`, `NZDJPY` long `-90.418381`, and
`EURCAD` short `-85.090909`.

First Gate 98 six-year `K_ONLY` read:

- `2020_01_01_00_00_00_TESTER_878`: `entry_stack_preset=K_ONLY`,
  `configured_david_mode=AGAINST`, `effective_david_mode=OFF`,
  `david_filter_enabled=false`, `stoch_filter_enabled=false`,
  `lrmg_reversal_filter_enabled=false`, `katarakti_mode=0` (`KTR_LOOSE`).
  This is true `K_ONLY / KTR_LOOSE`, not active David AGAINST.
- Result: `1772` closed baskets, `+564.900000` closed ADR, `-1470.525835`
  terminal marked ADR, `-905.625835` closed-plus-marked ADR, `11` unresolved
  terminal baskets, worst open drawdown `-190.398731` ADR, worst MAE
  `193.162664`, max fill count `62`.
- Terminal failures were concentrated in March 2020 open-end baskets, led by
  `AUDCHF.i` long `-481.607506` ADR at `88` fills and `EURNZD.i` short
  `-476.566180` ADR at `88` fills. Interpretation: Loose Katarakti alone
  produces many tight-TP winners, but it does not control terminal inventory.
- Older manual KTR_EXTREME context existed during the workstream, but the
  `TESTER_30` receipt ID was later overwritten by the current David WITH
  ablation. Do not cite `TESTER_30` as KTR_EXTREME. Use the Gate 98 closeout
  table as the current receipt truth.

First Gate 98 2026 YTD / six-month `K_ONLY` receipt:

- `2026_01_01_00_00_00_TESTER_168`: 28 symbols, `entry_stack_preset=K_ONLY`,
  `effective_david_mode=OFF`, `configured_david_mode=OFF`,
  `david_filter_enabled=false`, `stoch_filter_enabled=false`,
  `lrmg_reversal_filter_enabled=false`, `katarakti_mode=0` (`KTR_LOOSE`).
  Per-symbol summaries were consistent: TP `0.10 ADR`, SL `0`, grid spacing
  `0.10 ADR`, MaxBasketEntries `500`, trailing disabled,
  `execution_price_mode=MT5_ORDER_FILL`. `UseDForFilter=true` was present but
  irrelevant because the Stoch layer was disabled by `K_ONLY`.
- Event receipt: `4566` accepted BUY/SELL signal rows, all with
  `raw_katarakti_candidate=true`; blocked signals were only
  `blocked_existing_basket`. Basket close reasons: `4555` TP, `11` open_end.
- Result: `+1567.000000` closed ADR, `-227.824957` terminal marked ADR,
  `+1339.175043` closed-plus-marked ADR, `11` unresolved terminal baskets,
  worst open drawdown `-1130.093967` ADR, worst MAE `1130.798722`, max fill
  count `150`. Interpretation: configuration is correct for clean
  `K_ONLY / KTR_LOOSE`, but fixed `0.10 ADR` TP still leaves large tail risk.

Freedom-run cheap six-year context reviewed from MT5 Common Files on
2026-07-05:

- `2020_01_01_00_00_00_TESTER_210`: old-stack David OFF with `KTR_LOOSE`,
  TP `0.10 ADR`, SL `0`, grid spacing `0.10 ADR`, MaxBasketEntries `500`.
  It did not survive March 2020: `253` closed baskets, `+81.700000` closed
  ADR, `-907.650920` terminal marked ADR, `-825.950920` closed-plus-marked
  ADR, `2` unresolved terminal baskets (`GBPCHF.i` long at `114` fills and
  `GBPUSD.i` long at `61` fills).
- `2020_01_01_00_00_00_TESTER_15`: old-stack David OFF with `KTR_EXTREME`
  and the same TP/grid/risk settings. It did survive the six-year window:
  `1267` closed baskets, `+420.400000` closed ADR, `-59.378693` terminal
  marked ADR, `+361.021307` closed-plus-marked ADR, `1` unresolved terminal
  basket (`USDCAD.i` short at `44` fills). Hidden inventory risk remained
  severe: worst open drawdown `-329.637149` ADR, worst MAE `330.858378`, max
  fill count `81`.
- Interpretation: stricter Katarakti has real filtering value even with David
  direction disabled, but this is not true Gate 98 `K_ONLY`. These runs
  predate the `EntryStackPreset` switch and still include the existing LRMG and
  Stoch entry filters with David set OFF. Treat them as manual context only,
  not as a promotion or a reason to resume David tuning.

Saved MT5 report context from
`C:/Users/User/Desktop/LIMNI/Baktests/LimniKatarakti_v1/ALL 28 6 YEARS OHLC.html`:

- This historical six-year OHLC winner used `DavidMode=2` (AGAINST),
  `KataraktiMode=0` (`KTR_LOOSE`), `TpAdrUnits=0`, `SlAdrUnits=0`,
  `EnableTrailingStop=true`, `TrailStartAdrUnits=0.2`,
  `TrailDistanceAdrUnits=0.1`, `GridSpacingAdrUnits=0.1`, and
  `MaxBasketEntries=5000`.
- Report headline: initial deposit `$10,000`, total net profit `$19,105.34`,
  profit factor `1.85`, total trades `16,971`, but equity drawdown maximal was
  `$7,735.60` / `74.81%`.
- End-of-test liquidations were negative, not a hidden benefit: `70` EURUSD
  close deals, about `-$939.86` net. Interpretation: the trail materially
  changed the exit model and let winners run beyond the fixed `0.10 ADR` TP,
  but this remains high-drawdown historical context, not promotion evidence.

Portfolio-harvest hypothesis parked for a later exit/lifecycle gate:

- Freedom observed in TradingView that LRMG + Katarakti + Stoch, no David MA,
  with positions allowed to run from the available March 30 history, showed
  roughly `+385 ADR` open across 28 FX pairs and roughly `+300 ADR` even after
  adding BTC, SP500, and gold with large SP500 short exposure.
- Interpretation to test later: fixed tiny per-basket TP may be clipping
  winners while leaving tail baskets to dominate. A future account-level
  equity harvest / account trail could close the portfolio when aggregate open
  ADR reaches a threshold and trail from the aggregate high-water mark. This is
  not Gate 98 scope and is not proof yet because the TradingView snapshot does
  not establish path drawdown, margin survivability, or closed-trade drag.

Gate 98 closeout read: stop the current parameter-tuning path. The only
six-year raw-stack survivor was `KTR_LOOSE` + Stoch `1000/100/100` with
`10/90` + LRMG reversal + David AGAINST RSI `9/63/37` + `ExitScope=ACCOUNT`
+ `TP=1.00` percent of balance + `GridSpacing=0.10` + `GridCap=500`. It
survived on paper but carried severe heat and concentration risk. K-only,
K+Stoch, K+LRMG+Stoch without David, K+Stoch+David without LRMG,
K+LRMG+David without Stoch, David WITH, faster Stoch, and looser Stoch all
failed in the six-year checks. Treat this as evidence that the time-based stack
is a useful reference specimen but too fragile to optimize into the final
product.

Next action: wait for ChatGPT Pro review, then open Gate 99 for a
non-time-based FormulaShadow rebuild. Target pure price action / volatility /
ADR / LRMG-event logic with no time-based final events if possible and no
parameter optimization as the main research method. Preserve the current EA as
a reference specimen until Gate 99 is explicitly opened.

Stop lines: no LimniHedge_V1 changes, no Gate 95/Type3 runner work, no live/app
integration, no more David tuning, no more current-stack Stoch sweeps, no
Candidate B or regime overlay implementation yet, and no promotion claims.

### Historical Override

Current state: Gate 91 `formulaic-triangle-grid-geometry` Gate 91F marginal
add value audit is complete as research-only evidence. The runner now
supports v1 formulaic directionless geometry, v2 cost-bend center-band geometry,
v2.1 floor-pin/surplus/convex variants, v2.2 terminal-horizon / basket-solvency
add gates, and v2.3 local add-throttle rows with unique
`add-throttle-events.rows.*` receipts. It also emits Gate 91F
`marginal-add-audit.rows.*` direct-fill contribution receipts for the v2.1
floor-pin baseline. Verdict:
`PASS_GATE91F_MARGINAL_ADD_VALUE_AUDIT_COMPLETE_NO_PROMOTION`.

LRMG visual recovery checkpoint: the later MT5 visual-study work is not a
keeper yet. Freedom rejected the current generated chart because bars are not
equal-size bricks and the moving average / `0` line no longer behaves like the
earlier equal-brick offline chart. Do not continue from the bottom-pane
oscillator or the latest transformed-candle generated chart as if they are
acceptable. Recovery pass restored `LimniLRMGCreateChart.mq5` to a full
generated/offline LRMG custom chart using canonical M1 source, one equal-size
custom OHLC bar per closed LRMG brick, and a moving closed-brick median line.
MT5 custom-symbol rates are M1 bars, so multiple LRMG bricks from the same
source M1 event are assigned to the next available generated M1 slots rather
than duplicate timestamps; this preserves event order and equal-block grammar
at the cost of exact duplicate-time rendering. Repo and active-terminal compiles
passed with `0 errors, 0 warnings`. Status is pending Freedom visual review.
Direction, Katarakti, David, cost guard, live MT5 trading, and backtest matrix
expansion remain frozen.

Active Gate 92: `limnihedge-legacy-parity`. Freedom wants the old fund-era
`LimniHedge_V1` behavior replicated in the repo engine before further EA
mutation or strategy re-engineering. Treat the current EA as the MT5 reference
surface. Gate 92 intake created a parser/contract command,
`npm run engine:gate92:limnihedge-legacy-parity`, and report:
`docs/research/gates/gate92/GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_2026-07-04.md`.
The two missing AUDCAD primary filenames were rebuilt from the MT5 tester cache
and bound into `C:/Users/User/Desktop/LIMNI/Baktests/LimniHedge_v1/`: Type 3
MA-changed (`$5140.60`, `260` trades) and the Type1+Type3 Trail20 primary
(`$5039.46`, `1432` trades; Trail10 was rejected at `$2722.72`). The DB-backed
canonical coverage probe hung, so the default replay source is
`--price-source=mt5-export`. `automation/mt5/Scripts/LimniHedgeV1ExportParityH1.mq5`
is installed/compiled with `0 errors, 0 warnings` and now exports both default
David `70/30` and AUDCAD primary `60/40` profile CSVs under the active terminal
`MQL5/Files/LimniHedge_V1_Parity*` folders. Current rerun passes Gate 92
parity intake with validation failures `0`: entry shape `5/5`, lifecycle count
`5/5`, accounting shape `5/5`, and yearly split rows have no failing rows.
Entry parity is AUDCAD Type1+Type3 `1432/1432`, AUDCAD Type3 MA `260/260`,
AUDJPY `1518/1518`, AUDCHF `386/386`, and discovered AUDCAD `260/260`.
Lifecycle replay matches MT5 exit counts, SL-vs-terminal classification, and
terminal liquidation counts for all parsed reports. Accounting replay uses
exported MT5 H1 conversion bars, exact commission at `-7.00 * lots`, and MT5
saved-report swap as observed broker accounting passthrough; this is
behavioral/report-shape parity, not penny-perfect independent swap modelling.
Stop here before any LRMG bricks, LRMG `0`/median direction, Katarakti-lite,
new lifecycle rules, EA mutation, or optimization unless Freedom explicitly
opens the next reconstruction/testing gate.

Active Gate 93: `limnihedge-triangle-overlay-diagnostic`. First bounded
triangle reconstruction after Gate 92 parity is complete:
`npm run engine:gate93:limnihedge-triangle-overlay`, report
`docs/research/gates/gate93/GATE93_LIMNIHEDGE_TRIANGLE_OVERLAY_DIAGNOSTIC_2026-07-04.md`.
It is repo-side only and reads Gate 92 artifacts; the MT5 EA remains untouched.
Verdict:
`PASS_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_NO_KEEPER_NO_PROMOTION` with
validation failures `0`. The hard H1 Triangle start gates are too restrictive
on the LimniHedge parity surface: v2/v2.1 keeps about `6.3%` to `6.6%` of
entries and removes all `76` terminal liquidations, but cuts aggregate saved
report net from `$26,739.30` to about `$2,001.75` to `$2,078.46`. The simpler
center-reversion-side bucket keeps `606/3856` entries, removes `70/76` terminal
liquidations, and has PF `33.74`, but still sacrifices `$21,876.79` of baseline
net. Read: Triangle is not ready as a hard entry filter for LimniHedge; the
useful signal is terminal-risk clustering, so the next safe gate should be a
risk-overlay/protection diagnostic, not threshold tuning or EA mutation.

Active Gate 94: `limnihedge-type3-movement-candle-diagnostic`. Freedom asked
whether the saved LimniHedge Type 3 entries were tested on the custom
ADR/ATR-style movement candles instead of time candles. Gate 94 is complete:
`npm run engine:gate94:limnihedge-type3-movement-candles`, report
`docs/research/gates/gate94/GATE94_LIMNIHEDGE_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_2026-07-04.md`.
It is repo-side only, reads Gate 92 saved Type 3 outcomes, and builds fixed ADR
movement candles from the canonical Gate 74B M1-derived directed-ADR warehouse;
H1 bars used for movement candles: `0`. Verdict:
`PASS_GATE94_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_NO_PROMOTION` with validation
failures `0`. This is a projection/classification diagnostic, not a full
movement-candle Type 3 replay. Covered Type 3 baseline net is `$25,613.45`
with PF `18.23` and `51` terminal liquidations. Exact movement-candle Type 3
hard matches are too sparse: ADR `0.025` keeps `93` rows (`2.64%`) for
`$774.67` net and `2` terminals; ADR `0.05` keeps `98` rows (`2.78%`) for
`$746.14` net and `0` terminals; ADR `0.075` keeps `103` rows (`2.93%`) for
`$804.57` net and `1` terminal; ADR `0.10` keeps `157` rows (`4.46%`) for
`$898.35` net and `0` terminals. Read: custom movement candles do remove
terminal-risk clusters when used as a hard exact Type 3 filter, but they destroy
too much harvest. Do not promote into MT5 or rewrite Type 3 from this. If this
lane continues, the next bounded step is a full non-time-based movement-candle
Type 3 replay with explicit MT5 M1 export parity, or a risk-overlay diagnostic
using the movement buckets rather than hard entry replacement.

Outside review packet is now prepared for the next phase:
`docs/research/gates/gate95/LIMNIHEDGE_REPO_TYPE3_OUTSIDE_REVIEW_PACKET_2026-07-04.md`.
New-chat recovery prompt:
`docs/research/gates/gate95/NEXT_CHAT_LIMNIHEDGE_TYPE3_REPO_DISCOVERY_PROMPT_2026-07-04.md`.
Current stop line: do not run more variants until Freedom returns the outside
review. The next intended gate is repo-only Type 3 discovery across all 28
pairs, with movement-candle surfaces, Candidate B directional bias, and
no-direction/both-side controls. The goal is not to preserve the legacy EA; it
is to find a consistently profitable repo-verifiable Type 3-derived system.

Latest Gate 91 report:
`docs/research/gates/gate91/GATE91F_MARGINAL_ADD_VALUE_AUDIT_2026-07-03.md`.

Prior Gate 91 v2.3 report:
`docs/research/gates/gate91/GATE91_FORMULAIC_V23_ADD_FEED_THROTTLE_DIAGNOSTIC_2026-07-03.md`.

Supporting Gate 91 reports:

- First directionless scaffold:
  `docs/research/gates/gate91/GATE91_FORMULAIC_DIRECTIONLESS_GEOMETRY_AB_DIAGNOSTIC_2026-07-03.md`.
- Outside-review synthesis:
  `docs/research/gates/gate91/GATE91_OUTSIDE_REVIEW_GRID_GEOMETRY_SYNTHESIS_2026-07-03.md`.
- V2 cost-bend center-band diagnostic:
  `docs/research/gates/gate91/GATE91_FORMULAIC_V2_COST_BEND_CENTER_BAND_DIAGNOSTIC_2026-07-03.md`.
- V2.1 outside-review synthesis:
  `docs/research/gates/gate91/GATE91_V2_1_OUTSIDE_REVIEW_SYNTHESIS_2026-07-03.md`.
- V2.1 floor-pin/surplus/convex diagnostic:
  `docs/research/gates/gate91/GATE91_FORMULAIC_V21_FLOORPIN_SURPLUS_CONVEX_DIAGNOSTIC_2026-07-03.md`.
- V2.2 outside-review synthesis:
  `docs/research/gates/gate91/GATE91_V2_2_OUTSIDE_REVIEW_SYNTHESIS_2026-07-03.md`.
- V2.3 outside-review synthesis:
  `docs/research/gates/gate91/GATE91_V2_3_OUTSIDE_REVIEW_SYNTHESIS_2026-07-03.md`.
- V2.3 next-chat fourth-reviewer prompt:
  `docs/research/gates/gate91/NEXT_CHAT_GATE91_V23_REVIEW_PROMPT_2026-07-03.md`.

Gate 91 v2.1 read: floor-pin/surplus is the current best geometry filter, but
it is not a finished standalone algo. In 2026, old v2 baseline returned
`+900.59` ADR units, `+10.89%` fixed-lot account, PF `1.026`, max open `377`,
max depth `127`, max DD `-39.82%`. V2.1 surplus returned `+497.26` ADR units,
`+10.77%` account, PF `1.070`, max open `187`, max depth `83`, max DD
`-10.08%`, and Calmar `2.252`. That is a real shape improvement, but PF,
Sharpe, Sortino, MFE/MAE, and expectancy are still below fund-manager targets.
In 2019, floor-pin/surplus cut exposure but gave up too much return/DD versus
old v2. The convex add-spacing row cut 2026 max open to `75` and max depth to
`9`, but account return fell to `+2.64%` and PF stayed only `1.030`; treat it
as too blunt in this first form.

Gate 91 v2.2 read: terminal-horizon and basket-solvency add gates did not beat
v2.1 floor-pin. Basket solvency was non-binding in both bounded windows
(`0` solvency blocks). Terminal horizon blocked about `84%` of add-feasibility
checks and cut max depth, but lowered performance: 2019 account return fell
from `23.55%` to `19.25%`, PF from `1.098` to `1.083`, and Return/DD from
`0.951` to `0.781`; 2026 account return fell from `10.76%` to `5.27%`, PF
from `1.070` to `1.034`, Calmar from `2.245` to `0.805`, and Return/DD from
`1.065` to `0.392`. Treat the exact terminal-horizon veto as rejected, not as
the next base.

Gate 91 v2.3 read: the first adverse add bypasses the throttle. Three rows were
tested against the v2.1 floor-pin base: all-session local reversion evidence,
late-session local reversion evidence, and late-session last-3 center progress.
Smoke, 2019, and 2026 validations each had `59` rows and `0` failed. The
late-session reversion row improved 2019 (`+26.59%` account, PF `1.116`, max
depth `32`, Return/DD `1.380`) versus v2.1 floor-pin (`+23.55%`, PF `1.098`,
max depth `46`, Return/DD `0.951`), but failed to travel to 2026 (`+6.82%`,
PF `1.044`, Return/DD `0.586`) versus v2.1 floor-pin (`+10.76%`, PF `1.070`,
Return/DD `1.065`). All-session reversion and progress-last3 were too blunt.
Current pure-grid keeper remains `triangle_formulaic_directionless_geometry_v2_floorpin`.

Gate 91F read: marginal direct-fill audit over the v2.1 floor-pin baseline
explains the v2.3 failure. Continued adds were not globally bad by direct value:
2019 continued adds averaged `+0.140727` USD / `+0.033337` ADR, and 2026
continued adds averaged `+0.096745` USD / `+0.032316` ADR. The decisive split
was late reversion fail: in 2019 it was nearly flat (`+0.014055` USD,
`-0.003701` ADR), but in 2026 it was strongly positive (`+0.475899` USD,
`+0.083850` ADR). This explains why the late throttle improved 2019 but damaged
2026. Candidate fills rarely changed target eligibility at the actual close
mark (`0.78%` in 2019, `1.17%` in 2026), so the remaining problem is unresolved
flatten-cycle exposure, not a stable local no-bend add population.

Next Gate 91 decision: do not promote v2.3, do not implement the proposed
tiered late-session reversion throttle as the next keeper, and do not keep
tuning this add-throttle family by default. The bounded evidence says pure
directionless add throttling is near its standalone ceiling under the
daily-flatten surface. Direction and Katarakti are still frozen until Freedom
explicitly opens them; no Candidate B, David direction, red-news, MT5/live/app
work, broad matrix work, or year-by-year expansion is open.

Gate 89 outputs:

- Simulator command:
  `npm run engine:gate89:continuous-raw-truth-simulator`.
- Script:
  `engine/scripts/verification/build-gate89-continuous-raw-truth-simulator.ts`.
- EURUSD calibrated report:
  `docs/research/gates/gate89/GATE89_CONTINUOUS_RAW_TRUTH_SIMULATOR_EURUSD_CONVERTED_OHLC_HIGH_LOW_2026-07-01.md`.
- Corrected all-pair report:
  `docs/research/gates/gate89/GATE89_CONTINUOUS_RAW_TRUTH_SIMULATOR_ALL_PAIRS_CONVERTED_OHLC_HIGH_LOW_2026-07-01.md`.

Gate 89 read:

- EURUSD warehouse truth is close enough to the MT5 reference to trust the
  simulator shape for research: warehouse net `$232.18` vs MT5 `$174.51`,
  commission `-$400.20` vs `-$400.80`, swap `-$3,837.17` vs `-$4,144.01`,
  max open `184` vs `170`, terminal positions `161` vs `149`.
- Corrected all-pair run: final balance `$41,659.80`, net `+$31,659.80`,
  but max equity drawdown `-$99,000.32`, max open positions `2,856`, and
  terminal positions `2,421`.
- The first all-pair run was invalid because cross-pair quote PnL was treated
  as USD. The corrected simulator converts quote-currency PnL to USD using
  same-week USD conversion legs.
- Raw multi-pair harvest has real gross edge, but always-on double-sided grids
  are not deployable because stale inventory, swap/carry drag, terminal
  liquidation, and drawdown are too large.

Latest research gate: Gate 90 `grid-activation-accuracy-one-sided-selection`.

Gate 90 outputs:

- Command:
  `npm run engine:gate90:grid-activation-accuracy-one-sided-selection`.
- Script:
  `engine/scripts/verification/build-gate90-grid-activation-accuracy-one-sided-selection.ts`.
- Week-batch warehouse reader:
  `readTradeLegPathWarehouseWeekRows()` in
  `engine/src/research/tradeLegPathWarehouse.ts`.
- Main first-pass report:
  `docs/research/gates/gate90/GATE90_GRID_ACTIVATION_ACCURACY_ONE_SIDED_SELECTION_FIRST_PASS_2026-07-02.md`.
- Corrected David/Stoch full-history selection report:
  `docs/research/gates/gate90/GATE90_DAVID_RSI1006040_STOCH100_3_100_FULL_HISTORY_SELECTION_2026-07-02.md`.
- Fast Candidate B generic-cost reports:
  `docs/research/gates/gate90/GATE90_QUICK_CANDIDATE_B_COSTED_26W_RECENT_CLOSE_DAVID1006040_STOCH100_3_100_2026-07-02.md`
  and
  `docs/research/gates/gate90/GATE90_QUICK_CANDIDATE_B_COSTED_5W_RECENT_OHLC_DAVID1006040_STOCH100_3_100_2026-07-02.md`.
- ADR-clock handoff report:
  `docs/research/gates/gate90/GATE90_ADR_CLOCK_EXECUTION_RESEARCH_HANDOFF_2026-07-02.md`.
- ADR-event brick/MA ladder with terminal attribution:
  `docs/research/gates/gate90/GATE90_ADR_EVENT_BRICK_MA_LADDER_TERMINAL_ATTRIBUTION_2026-07-02.md`.
- Session-window daily flatten comparison:
  `docs/research/gates/gate90/GATE90_SESSION_WINDOW_DAILY_FLATTEN_COMPARISON_2026-07-02.md`.
- Session-window full scorecard:
  `docs/research/gates/gate90/GATE90_SESSION_WINDOW_FULL_SCORECARD_2026-07-02.md`.
- Random OOS session-window scorecard:
  `docs/research/gates/gate90/GATE90_OOS_SESSION_WINDOW_RANDOM_5W_SCORECARD_2026-07-02.md`.
- Random OOS aggregate artifacts:
  `docs/research/gates/gate90/artifacts/oos-session-window-random-5w-scorecard.csv`
  and
  `docs/research/gates/gate90/artifacts/oos-session-window-random-5w-aggregate-scorecard.csv`.
- Gate 90C full-window matrix design:
  `docs/research/gates/gate90/GATE90C_FULL_WINDOW_MATRIX_DESIGN_2026-07-02.md`.
- Gate 90C combined-variant smoke report:
  `docs/research/gates/gate90/GATE90C_COMBINED_VARIANT_SMOKE_ALLPAIRS_1W_2026-07-02.md`.
- Gate 90C command-plan CSV:
  `docs/research/gates/gate90/artifacts/gate90c-full-window-matrix-command-plan.csv`.
- Gate 90C runtime-blocker report:
  `docs/research/gates/gate90/GATE90C_FULL_WINDOW_MATRIX_RUNTIME_BLOCKER_2026-07-02.md`.
- Gate 90C fast decision 26-week scorecard:
  `docs/research/gates/gate90/GATE90C_FAST_DECISION_26W_SCORECARD_2026-07-02.md`.
- Gate 90C fast decision aggregate artifacts:
  `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-scorecard.csv`
  and
  `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-scorecard.json`.
- Gate 90C 2019 close-mode non-stoch band scorecard:
  `docs/research/gates/gate90/GATE90C_CLOSE_BAND_2019_NONSTOCH_SCORECARD_2026-07-02.md`.
- Gate 90C 2019 close-mode non-stoch aggregate artifacts:
  `docs/research/gates/gate90/artifacts/gate90c-close-band-2019-nonstoch-scorecard.csv`
  and
  `docs/research/gates/gate90/artifacts/gate90c-close-band-2019-nonstoch-scorecard.json`.
- Gate 90D Triangle Reversion Grid proposal:
  `docs/research/gates/gate90/GATE90D_PATH_EFFICIENCY_GRID_GEOMETRY_PROPOSAL_2026-07-02.md`.
- Gate 90D first feature/shadow audit:
  `docs/research/gates/gate90/GATE90D_TRIANGLE_FEATURE_SHADOW_AUDIT_2026-07-02.md`.
- Gate 90D first audit artifacts:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/`.
- Gate 90D refreshed OOS4 close-event trace source:
  `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh/`.
- Gate 90D refreshed OOS4 start-trace audit:
  `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/GATE90D_START_TRACE_OOS4_REFRESH_AUDIT.md`.
- Gate 90D Triangle v0 one-pair smoke:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v0-smoke-audchf-1w/GATE90D_TRIANGLE_V0_SMOKE_AUDCHF_1W.md`.
- Gate 90D Triangle v0 one-week all-pair smoke:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v0-smoke-allpairs-1w/GATE90D_TRIANGLE_V0_SMOKE_ALLPAIRS_1W.md`.
- Gate 90D Triangle v0 2026 / 2019 comparison:
  `docs/research/gates/gate90/GATE90D_TRIANGLE_V0_2026_2019_COMPARISON_2026-07-03.md`.
- Gate 90D Triangle v0 no-Candidate-B diagnostic:
  `docs/research/gates/gate90/GATE90D_TRIANGLE_V0_NO_CANDIDATE_B_DIAGNOSTIC_2026-07-03.md`.
- Gate 90D feature-ledger design-question diagnostic:
  `docs/research/gates/gate90/GATE90D_FEATURE_LEDGER_DESIGN_QUESTION_DIAGNOSTIC_2026-07-03.md`.
- Gate 90D Triangle v1 broad green-read diagnostic:
  `docs/research/gates/gate90/GATE90D_TRIANGLE_V1_BROAD_GREEN_READ_2026-07-03.md`.
- Gate 90D Triangle v1 open-price MFE / 2019 red-flag diagnostic:
  `docs/research/gates/gate90/GATE90D_TRIANGLE_V1_OPEN_MFE_2019_RED_FLAG_DIAGNOSTIC_2026-07-03.md`.
- Gate 90D 2019 open ADR-normalized breakdown:
  `docs/research/gates/gate90/GATE90D_2019_OPEN_ADR_NORMALIZED_BREAKDOWN_2026-07-03.md`.
- Gate 90D 2019 open protection sweep, no Candidate B:
  `docs/research/gates/gate90/GATE90D_2019_OPEN_PROTECTION_SWEEP_NO_CANDIDATE_B_2026-07-03.md`.
- Gate 90D 2019 open bad-cycle origin / trailing research:
  `docs/research/gates/gate90/GATE90D_2019_OPEN_BAD_CYCLE_ORIGIN_AND_TRAILING_RESEARCH_2026-07-03.md`.
- Gate 90D 2019 open live-state guard replay:
  `docs/research/gates/gate90/GATE90D_2019_OPEN_LIVE_STATE_GUARD_REPLAY_2026-07-03.md`.
- Gate 90D 2019 open EOD hold-red replay:
  `docs/research/gates/gate90/GATE90D_2019_OPEN_EOD_HOLD_RED_REPLAY_2026-07-03.md`.
- Gate 90D 2019 open EOD hold-red max-3D replay:
  `docs/research/gates/gate90/GATE90D_2019_OPEN_EOD_HOLD_RED_MAX3D_REPLAY_2026-07-03.md`.
- Gate 90D 2026 open pain-stop strict no-Candidate-B replay:
  `docs/research/gates/gate90/GATE90D_2026_OPEN_PAIN_STOP_STRICT_NO_CANDIDATE_B_2026-07-03.md`.
- Gate 91 Formulaic Triangle Grid Geometry handoff:
  `docs/research/gates/gate91/GATE91_FORMULAIC_TRIANGLE_GRID_GEOMETRY_HANDOFF_2026-07-03.md`.
- Gate 91 next-chat prompt:
  `docs/research/gates/gate91/NEXT_CHAT_GATE91_FORMULAIC_TRIANGLE_GRID_GEOMETRY_PROMPT_2026-07-03.md`.

Gate 90 read:

- Figure out when a grid should activate at all.
- Prefer one-sided activation first: long-only or short-only.
- Do not assume double-sided is default.
- Treat double-sided only as a later candidate for in-between/ambiguous states
  after one-sided selection has measurable evidence.
- David MA source was found in the active MT5 terminal at
  `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/David_MA_Color_V1f_Updated.mq5`.
- David settings corrected by Freedom: template `LWMA35`, close price, RSI
  period `100`, overbought `60`, oversold `40`. This is not an MA-period `100`
  test.
- Stochastic settings corrected by Freedom: `K=100`, `D=3`, slowing `100`,
  Low/High, Simple, main line only, OB/OS `80/20`.
- Gate 90 runner now supports CLI signal settings, comma-separated
  `--activation-rules`, `--summary-only`, shared signal replay, MA-reversion
  target mode, ADR spacing controls, MA-expansion start gating, adverse-only
  grid adds, and `--signal-clock=m1|adr_event`.
- M1/OHLC remains the execution tape. `--signal-clock=adr_event` builds David
  MA / RSI / Stoch state from timestamped ADR movement bars, controlled by
  `--signal-adr-brick`.
- Added `candidate_b` as a Gate 90 one-sided activation rule using locked Gate
  74B `candidate_b_side`; it only controls missing side-cycle starts and does
  not force weekly flip closes.
- Full close-only optimizer screen over all available Gate 74B history:
  `373` weeks, `28` pairs, `2019-04-14T23:00:00.000Z..2026-05-31T23:00:00.000Z`.
  Ranking by net: `david_stoch_release` `+$64,354.26`, max equity DD
  `-$61,940.24`, max open `1,450`, terminal `1,179`; `david_contra`
  `+$42,745.14`, DD `-$74,632.66`, max open `2,037`, terminal `1,799`;
  `david_stoch_confirm` `+$17,111.74`; `stoch_contra` `+$6,243.95`;
  `raw_both` `-$82,982.99`; `david_with` `-$94,624.65`.
- Exact OHLC finalist run on the same `373` week / `28` pair span:
  `raw_both` net `+$48,141.70`, max equity DD `-$119,605.92`,
  max open `2,856`, terminal `2,558`; `david_contra` net `+$123,539.90`,
  DD `-$65,451.04`, max open `1,884`, terminal `1,689`;
  `david_stoch_release` net `+$80,156.40`, DD `-$54,509.25`,
  max open `1,286`, terminal `968`; `david_stoch_confirm` net `+$56,335.77`,
  DD `-$70,035.51`, max open `1,554`, terminal `1,533`.
- Current read: `david_contra` is the highest-harvest exact OHLC rule;
  `david_stoch_release` is the leading protection/deployment-shape candidate.
  `david_with` is rejected for this setting family.
- Parking read: the David/Stoch activation family is useful evidence, but its
  profit-factor shape is not strong enough to keep optimizing before testing
  Candidate B on the same costed continuous simulator.
- No broad David/Stoch parameter optimization matrix was run. The completed
  matrix was a rule matrix around Freedom's corrected handpicked settings.
- Fast Candidate B generic-cost recheck was weak. 26-week recent close-only
  screen (`2025-12-08..2026-05-31`, all 28 pairs) had `candidate_b`
  net `-$2,194.71`, PF `0.871184`, max equity DD `-$5,014.25`; by comparison
  `david_stoch_release` was `+$9,050.03`, PF `2.52717`, max DD `-$1,996.77`.
  A 5-week recent OHLC screen had `candidate_b` positive at `+$384.94`, but it
  still trailed the stronger candidates. Current parking read from Freedom:
  treat these activation families as weak/diagnostic for now.
- Later Gate 90 execution-engine research found a stronger structure:
  MA-reversion TP, spacing `0.20 ADR`, min MA expansion `0.10 ADR`,
  `adverse_only` grid adds, David `LWMA100` with RSI `50/60/40`, and Stoch
  used only as OB/OS state filter.
- `david_stoch_release` is rejected from primary matrices. It is too
  timing-fragile and deletes most opportunity.
- Required primary comparisons for future matrices:
  `raw_both`, `david_contra`, `candidate_b`, `stoch_contra`, and
  `david_stoch_confirm`.
- Current 5-week OHLC M1 signal-clock baseline on the above execution surface:
  `raw_both` net `+$2,728.09`, entries `8,043`, max open `176`, terminal `139`;
  `david_contra` net `+$2,161.21`, entries `5,947`, max open `168`, terminal
  `117`; `candidate_b` net `+$1,191.12`, entries `3,863`, max open `106`,
  terminal `90`.
- Current 5-week OHLC ADR-event signal-clock checks:
  ADR `0.10` / MA50 / `david_contra` net `+$1,422.93`, entries `2,078`,
  max open `113`, terminal `77`; ADR `0.05` / MA50 / `david_contra`
  net `+$1,546.45`, entries `3,400`, max open `109`, terminal `99`.
- Gate 90 ADR-event brick/MA ladder completed the fixed 5-week OHLC surface
  across bricks `0.025`, `0.05`, `0.075`, `0.10` and MA periods `25`, `50`,
  `75`, `100`, with `terminal-inventory.rows.*` added to the runner.
- Best `raw_both` benchmark row: ADR `0.025` / MA25 net `+$3,105.52`,
  entries `9,420`, max open `185`, terminal `112`, terminal price PnL
  `-$486.08`. Benchmark only; still no-direction.
- Best `david_contra` net row: ADR `0.05` / MA25 net `+$1,664.13`,
  entries `4,077`, max open `102`, terminal `89`, terminal price PnL
  `-$232.99`.
- Best current `david_contra` balance row: ADR `0.075` / MA25 net
  `+$1,528.62`, entries `3,297`, max open `120`, terminal `82`, terminal
  price PnL `-$101.11`.
- Terminal attribution shows concentrated recurring `david_contra` damage,
  led by `GBPNZD SHORT` aggregate terminal net `-$1,016.29`, then
  `EURNZD SHORT` `-$478.41`, `NZDUSD LONG` `-$439.15`, `USDJPY SHORT`
  `-$249.41`, and `GBPCHF SHORT` `-$243.90` across the 16-cell ladder.
- Runner now supports session controls:
  `--session-mode=continuous|ny_daily_window`, `--session-time-zone`,
  `--session-trade-start-et`, `--session-trade-end-et`,
  `--session-flatten-et`, `--session-sunday-start-et`, and manual
  `--session-flatten-overrides-et=YYYY-MM-DD=HH:mm,...`.
- In `ny_daily_window`, starts/adds are allowed only inside the clean New York
  window, targets can still close whenever ticks exist, no new Sunday activity
  starts before `20:00 ET`, Friday evening reopen is blocked, and unresolved
  cycles are closed as `session_flatten`.
- Session-window focused 5-week comparison completed with daily flatten at
  `16:00 ET`, clean activity cutoff at `15:45 ET`, reopen at `18:05 ET`, and
  Sunday start at `20:00 ET`.
- Session-window key rows: `raw_both` ADR `0.025` / MA25 net `+$1,234.83`,
  entries `9,283`, max open `80`, terminal `0`; `david_contra` ADR `0.025` /
  MA25 net `+$667.18`, entries `5,314`, max open `56`, terminal `0`;
  `david_contra` ADR `0.05` / MA25 net `+$552.10`, entries `4,025`, max open
  `73`, terminal `0`; `david_contra` ADR `0.10` / MA50 net `+$540.88`,
  entries `2,317`, max open `93`, terminal `0`.
- Interpretation: the daily window removes terminal inventory and mostly
  eliminates swap exposure, but it converts unresolved grid inventory into
  realized session-flatten losses. This is a healthier live-shaped execution
  boundary, but it lowers net materially versus continuous carry. Explicit
  spread and slippage are still not modeled.
- Candidate B did not beat `david_contra` in the focused session-window cells.
  Keep it as a later regime/bias candidate, not the primary rescue mechanism.
- Full-stat session-window reruns were completed without `--summary-only`, so
  `close-events.rows.*` are available for event-level PF, win rate, payoff, and
  flatten attribution. Full scorecard key rows:
  `raw_both ADR0.025/MA25` net `+$1,234.83`, event PF `1.7838`, weekly PF
  `31.7642`, max equity DD `-$40.14`, net/equity-DD `30.7631`;
  best `david_contra` is `ADR0.025/MA25` net `+$667.18`, event PF `1.7505`,
  weekly PF `125.7262`, max equity DD `-$5.35`, net/equity-DD `124.7065`;
  best event PF row is `ADR0.025/MA25 stoch_contra` with event PF `1.882`,
  net `+$497.80`, max open `42`.
- Current read after Freedom's spread/slippage comment: inside the clean
  session window, ordinary spread/slippage is not the primary blocker. The next
  external risk to model is scheduled high-impact red-news blackout behavior.
- Freedom's latest direction: the numbers remain promising. Keep ADR `0.025`
  in the research set because it is attractive, but expect a final live shape
  may prefer ADR `0.10` bricks for sturdier execution. Before optimizing more,
  save and push the current state, then run random out-of-sample windows instead
  of immediately running the full seven-year history. Only after that decide
  whether to refactor the current EA or build a new MT5 EA from scratch.
- Gate 90B random OOS session-window validation completed across four
  deterministic 5-week windows: OOS1 `2025-12-29..2026-01-26`, OOS2
  `2023-11-13..2023-12-11`, OOS3 `2024-06-30T23:00..2024-07-28T23:00`, and
  OOS4 `2022-01-10..2022-02-07`. Receipt check: 16 run summaries, all exactly
  5 selected weeks.
- OOS `david_contra` stayed profitable in every tested cell/window:
  ADR `0.025` / MA25 net `+$6,502.27`, event PF `2.308`, weekly PF `79.617`,
  max open `80`; ADR `0.05` / MA25 net `+$4,655.75`, event PF `1.730`,
  weekly PF `8.939`, max open `84`; ADR `0.075` / MA25 net `+$3,038.49`,
  event PF `1.376`, weekly PF `3.885`, max open `93`; ADR `0.10` / MA50 net
  `+$1,702.32`, event PF `1.187`, weekly PF `2.317`, max open `113`.
- OOS `raw_both` remains the highest-net no-direction benchmark, led by
  ADR `0.025` / MA25 net `+$12,187.28`, event PF `2.475`, max open `105`;
  benchmark only, not a promotion candidate.
- OOS `candidate_b` did better than expected and beat `david_contra` on net
  from ADR `0.05` upward, while using fewer entries and lower max-open than
  raw both. This upgrades Candidate B from low-faith idea to controlled overlay
  follow-up, but not to primary trigger or broad COT redesign.
- OOS session controls removed terminal inventory (`0` terminal positions in
  aggregate rows), but did not fully eliminate swap or multi-day max fill age:
  `david_contra` aggregate swap ranged from `-$101.61` to `-$173.69`, and max
  fill age stayed near `3.08` days. Audit the session-flatten lifecycle
  semantics before assuming daily flatten fully bounds overnight/swap exposure.
- Gate 90C prep added two activation rules:
  `candidate_b_david_contra_confirm` requires Candidate B and David contra to
  agree on side; `candidate_b_david_contra_conflict_candidate` trades Candidate
  B's side only when it conflicts with David contra.
- Gate 90C prep added summary-only close-cycle aggregates to the runner:
  `close_event_profit_factor`, `close_event_win_pct`, close event counts,
  close-event gross profit/loss, `target_close_net_usd`, and
  `session_flatten_close_net_usd`. This allows the full-window matrix to run
  without retaining massive close-event files for every cell.
- Gate 90C all-pair one-week smoke passed on
  `2026-05-03T23:00:00.000Z..2026-05-03T23:00:00.000Z`: `candidate_b`
  net `+$131.24`, event PF `2.666859`, max open `23`; `david_contra`
  net `+$164.36`, event PF `1.948972`, max open `55`;
  `candidate_b_david_contra_confirm` net `+$116.35`, event PF `8.455620`,
  max open `8`; `candidate_b_david_contra_conflict_candidate` net `+$72.11`,
  event PF `2.142201`, max open `19`.
- Gate 90C full-window design covers full Gate 74B history
  `2019-04-14..2026-05-31`, all 28 pairs, summary-only, with `6` signal ADR
  bricks x `5` MA periods x `5` grid spacings = `150` runner commands. Each
  command batches `7` activation rules, for `1,050` expected summary rows.
- Gate 90C matrix attempt from the command-plan CSV was blocked by runtime:
  row `1/150` (`0.025` ADR brick / MA25 / spacing `0.10`) remained active for
  about `30` minutes without producing `activation-summary.rows.*`,
  `weekly-activation-truth.rows.*`, or `gate90-run-summary.json`. The run was
  stopped and recorded as a runtime blocker, not a completed matrix or
  correctness failure.
- Gate 90C runner speed repair is complete for the research path:
  per-tick open-position stats now use incremental counters instead of scanning
  all books on every tick, and USD conversion marks are computed lazily from
  source legs instead of prebuilding every USD-pair tick conversion bucket.
- Targeted speed-patch verification preserved results on a one-week OHLC
  parity check for ADR `0.025` / MA25 / spacing `0.10`: `7` activation rows,
  `21` compared fields, `PARITY_OK`.
- Because the full 150-command / 1,050-row foreground run remained too large
  for immediate decision-making, Gate 90C produced a bounded fast decision
  surface over `2025-12-08..2026-05-31` with all 28 pairs, OHLC high/low,
  ADR-event clock, NY daily window, David MA reversion target, adverse-only
  adds, min MA expansion `0.10 ADR`, and all `7` activation rules.
- Gate 90C fast decision scorecard covers `7` predeclared cells x `7`
  activation rules = `49` summary rows. Cells: ADR `0.025` / MA25 with
  spacing `0.10`, `0.15`, `0.20`; ADR `0.05` / MA25 with spacing `0.10`,
  `0.20`; ADR `0.10` / MA50 with spacing `0.10`, `0.20`.
- Fast decision read: `david_contra` is the first build-shape candidate in
  this surface. `raw_both` remains the highest-net no-direction benchmark only.
  `candidate_b` is competitive but remains a controlled overlay/comparison,
  not a broad COT redesign or primary trigger.
- Primary build-shape read: ADR `0.025` / MA25 / spacing `0.15` /
  `david_contra` is the current balanced MT5-build candidate from Gate 90C:
  net `+$7,997.71`, close-event PF `2.652541`, close-event win `85.53%`,
  weekly equity PF `288.177297`, max equity DD `-$27.85`, entries `37,919`,
  max open `72`, max add depth `18`, session-flatten close net `-$4,180.86`,
  swap `-$120.52`.
- Aggressive benchmark read: ADR `0.025` / MA25 / spacing `0.10` /
  `david_contra` has higher net `+$9,556.15` and close-event PF `2.545217`,
  but higher exposure with entries `46,995`, max open `95`, max add depth
  `25`, and session-flatten close net `-$5,448.40`.
- Conservative reference read: ADR `0.10` / MA50 / spacing `0.20` /
  `david_contra` is lower-cadence but not leading: net `+$4,186.53`,
  close-event PF `1.529563`, max open `96`, max add depth `29`. ADR `0.10` /
  MA50 / spacing `0.10` has worse pressure with max open `179` and max add
  depth `58`.
- After Freedom flagged ADR `0.025` / MA25 / spacing `0.10` as too aggressive
  for live, Gate 90C stopped the full-year run at the 2019 checkpoint and
  tested a larger close-mode non-stoch band: ADR bricks `0.05`, `0.075`,
  `0.10`; MA periods `50`, `75`; spacing `0.20`, `0.30`; and activation rules
  `raw_both`, `david_contra`, `candidate_b`,
  `candidate_b_david_contra_confirm`, and
  `candidate_b_david_contra_conflict_candidate`. Total: `60` summary rows.
- 2019 non-stoch band read: `candidate_b` owns the highest static return rows,
  led by ADR `0.075` / MA50 / spacing `0.20` at `+17.01%` return, `-7.70%`
  max DD, `21,960` fills, max open `90`, max depth `14`. The best risk-shaped
  family is `candidate_b_david_contra_conflict_candidate`, led by ADR `0.05` /
  MA75 / spacing `0.20` at `+11.16%` return, `-2.10%` max DD, `12,256` fills,
  max open `58`, max depth `15`.
- Current decision read: do not start an MT5 build from one static ADR / MA /
  spacing tuple. The next evidence gate should build Gate 90D Triangle
  Reversion Grid v0: formulaic direction, ADR/path-efficiency grid geometry,
  and a Katarakti session sweep/rejection/displacement trigger with grid-unit
  lockout/protection. Full seven-pair currency-family handshake is deferred and
  log-only for now.
- Gate 90D proposal was amended after outsider review: lock behavior is split
  into default entry/add lockout versus optional explicit profit-stop; Candidate
  B is required for v0 replay starts; centerline-only reversion is diagnostic
  only; David evidence must come from independent David MA state; grid quantum
  includes a structural cost floor; low path efficiency must be paired with an
  ADR-normalized range condition; and replay requires a frozen, hashed
  formula/config receipt.
- Gate 90D first audit built the bounded feature/shadow receipt without runner
  mutation or trading replay over OOS4 `2022-01-10..2022-02-07`, all 28 pairs:
  `140` pair-week feature rows, `597` Katarakti trigger candidates across
  `122` pair-weeks, `289` long and `308` short triggers. Trigger context split
  was nearly even between Candidate B aligned (`291`) and Candidate B contra
  aligned (`306`); `149` triggers had BB context and `101` had positive
  log-only family context.
- Gate 90D lock shadow read from existing full-stat OOS4 close events:
  `8,738` close-event rows, `322` lock-preserve candidates, and `400.406879`
  ADR of potential preserved MFE. The signal is concentrated in session-flatten
  giveback: raw both `171.522992` ADR, David contra `88.800436` ADR, Candidate
  B `64.613434` ADR. Target-close lock preservation was small by comparison.
  Post-review caveat: these are protection receipts only, not proof of
  forced-close replay behavior or in-time lockout action before session flatten.
- Gate 90D coding pass added start-level traceability support before replay:
  Gate 90 close-event rows now emit `activation_rule_id`, `cycle_id`, and
  `start_timestamp_utc`; Gate 90D audit now emits `gate90d-formula-config`,
  session-level geometry rows/summaries, and start-traceability rows/summaries.
  The OOS4 feature audit still has `597` triggers and `8,738` lock rows, plus
  session geometry split: `734` harvestable-chop sessions and `526` dead-chop /
  cost-churn sessions. Formula contract hash:
  `EA06CF43315D2A1F72BA928006046339DEF3311FAAC1C6C6E606B3C8374FA065`.
- Gate 90D traceability smokes passed without long matrix work:
  one-pair/one-week Gate 90 smoke produced `5` close events with the new start
  fields; a Gate 90D trace smoke against those rows produced `4` trigger
  candidates and classified all `5` raw starts as `no_in_session_trigger` under
  the tightened same-entry-session matcher.
- Gate 90D refreshed the bounded OOS4 5-week close-event source with start
  fields across all 28 pairs and the five baseline rules only; no long matrix,
  2020 year run, Triangle replay, MT5/live/app work, or full handshake gate was
  started. The refreshed trace audit kept `597` trigger candidates and `8,738`
  lock rows, with `551` close events matched to prior same-entry-session
  Katarakti trigger candidates and `8,187` rows left as `no_in_session_trigger`.
  Matched rows split `92` session-flatten and `459` target closes; average
  trigger-to-start delay was `151.422868` minutes. Start-shadow scoring says
  matched starts are higher quality than unmatched on average (`$0.457270` avg
  net, PF `2.016007` versus `$0.251400`, PF `1.263598`), but the real split is
  geometry: matched `harvestable_chop_candidate` starts produced `289` rows,
  `$220.933711` net, `$0.764477` avg net, and PF `5.403558`; matched
  `dead_chop_cost_churn` starts produced `262` rows, `$31.021942` net,
  `$0.118404` avg net, and PF `1.156823`. Refreshed formula contract hash:
  `15F212768865DA2076CA330C74D540B7FDD27E9F7AA3EA2F647AF62CE6569DF2`.
- Gate 90D manual-rule and adaptive-spacing build pass added a plain-English
  human playbook to the proposal and added adaptive spacing receipts to the
  feature audit. The first v0 spacing receipt is
  `gate90d_range_box_slots_cost_clamped_v0`: completed session range divided
  into `3` target slots, clamped to `0.20..0.30 ADR`, with signal brick derived
  as spacing `/ 4`. The refreshed audit now reports harvestable sessions with
  average adaptive spacing `0.262674 ADR` and `734/734` adaptive range pass;
  dead-chop sessions sit at the `0.20 ADR` floor and `0/526` adaptive range
  pass. Updated formula contract hash:
  `EDAC42D2519046BCC4CBA2ECB42E1524A0AC4D9670517240C19C371E3DAA227B`.
- Gate 90D Triangle v0 replay scaffold is now callable in the Gate 90 runner as
  `--activation-rules=triangle_v0,...`. It starts only after a completed
  session range, sweep/rejection/displacement trigger, point-in-time
  harvestable path geometry, and Candidate/David alignment; per-cycle spacing
  is completed session range / `3`, clamped to `0.20..0.30 ADR`. Close-event
  and terminal-inventory rows now carry `cycle_spacing_adr` and
  `triangle_trigger_key`.
- Triangle v0 smokes passed without 2020/year-by-year testing or the full
  matrix. AUDCHF one-week smoke (`2022-01-10`) produced `3` starts, `4`
  entries, `3` winning close events, net `+$2.15`, max open `2`, max depth `1`.
  One-week all-pair smoke on the same week produced `19` close events, `23`
  entries, net `+$11.77`, PF `5.427295`, max open `5`, max depth `1`, and
  `0` missing trigger/spacing trace fields. Trace rows spanned `9` pairs with
  spacing `0.212007..0.273538 ADR`.
- Gate 90D Triangle v0 failed the old-window comparison as a complete entry
  algorithm. On the 2026 fast-decision window (`2025-12-08..2026-05-31`,
  OHLC, ADR `0.025` / MA25 / static baseline spacing `0.10`), Triangle v0
  returned `+2.16%`, PF `5.511`, `371` fills, `283` close cycles, max open
  `10`, max depth `9`; `david_contra` on the same surface returned `+95.56%`
  and `candidate_b` returned `+76.15%`. On the 2019 close-mode top-return
  surface (`2019-04-14..2019-12-30`, ADR `0.075` / MA50 / static baseline
  spacing `0.20`), Triangle v0 returned `-0.61%`, PF `0.905`, `816` fills,
  `474` close cycles, max open `16`, max depth `12`; `candidate_b` returned
  `+17.01%`. Read: Triangle v0 is useful as a precision/lockout component, but
  the strict sweep/rejection/displacement start is filtering out too much edge
  and cannot be the final formula by itself.
- Gate 90D no-Candidate-B diagnostic added `triangle_v0_no_candidate_b`, which
  keeps the same Triangle trigger/geometry but removes Candidate B from the
  direction formula and requires David-only side agreement. Result: Candidate B
  is not the cause of Triangle v0 failure. On 2026, no-Candidate-B returned
  `+2.19%` versus current Triangle `+2.16%`, but with more fills (`437` vs
  `371`) and lower PF (`4.866` vs `5.511`). On 2019, no-Candidate-B worsened
  return to `-0.74%` versus current Triangle `-0.61%`, with PF `0.865` versus
  `0.905`. Read: the strict trigger/geometry gate is too narrow; do not scale
  current v0.
- Gate 90D feature-ledger design-question/start-mode diagnostic now answers the
  old open design-question gap before any replay freeze. It added
  `design-question-diagnostic.rows.*`, `start-mode-diagnostic.rows.*`, and
  `start-mode-summary.rows.*`, and defaulted the Gate 90D shadow-audit command
  to the refreshed start-trace close-event source. The design-question ledger
  logged `2,520` rows across archived UTC and NY-clean ET boxes; archived UTC
  had `734` M1 harvestable rows and `561` blocked centerline-only diagnostic
  rows, while NY-clean ET had `737` M1 harvestable rows and `737` blocked
  centerline-only diagnostic rows. Average PE was close between box models, but
  ADR-event PE was materially higher than M1 PE (`0.106344` vs `0.040320`
  archived UTC; `0.105597` vs `0.040214` NY-clean ET). Start-mode diagnostics
  then used the ADR-event harvestable denominator: archived UTC `632` sessions,
  NY-clean ET `633` sessions. Strict sweep/rejection/displacement starts were
  only `15` per box model; relaxed sweep/rejection rose only to `46` archived
  UTC and `45` NY-clean ET; first session-mid extension found `623` starts in
  both box models; Candidate B geometry starts found `367` archived UTC and
  `363` NY-clean ET; David contra geometry starts found `368` in both box
  models. Start-mode rows now include MFE/MAE excursion receipts using the
  standard Maximum Favorable Excursion / Maximum Adverse Excursion framing:
  next NY 16:00 flatten, one additional NY 16:00 flatten, full available
  pair-week path, and `1Q`/`2Q`/`3Q` target-hit flags/timestamps. First read:
  strict Katarakti is too sparse for v1 but not useless as a future larger-
  target/confluence class; its `15` starts averaged `0.327999 ADR` same-day
  MFE with `9` 1Q hits by EOD, `0.477411 ADR` next-day MFE with `11` 1Q hits,
  and `0.617085 ADR` full-path MFE with `5` 2Q and `3` 3Q hits. Candidate B
  and David geometry starts averaged about `0.37 ADR` same-day MFE, about
  `0.60 ADR` next-day MFE, and about `0.78..0.79 ADR` full-path MFE. Lock
  receipts expose `1Q` add-block rows (`2,505`), `2Q` add-block rows (`1,231`),
  and profit-stop as receipt-only with `322` preserve candidates. Verdict:
  `PASS_GATE90D_FEATURE_LEDGER_START_MODES_LOGGED_NO_REPLAY_NO_FULL_HANDSHAKE`.
- Gate 90D Triangle v1 broad green-read added geometry-extension activation
  rules to the Gate 90 runner: `triangle_v1_candidate_b_extension`,
  `triangle_v1_david_contra_extension`, and
  `triangle_v1_candidate_or_david_extension`. These rules keep valid Triangle
  harvestable geometry and adaptive range/3 spacing clamped to `0.20..0.30 ADR`,
  but they do not require strict Katarakti as the universal start trigger. Broad
  bounded evidence is green with caveats. OOS4 5-week broad:
  `triangle_v1_candidate_b_extension` net `+$425.92`, PF `1.741262`,
  `2,978` entries, max open `48`; `triangle_v1_candidate_or_david_extension`
  net `+$433.57`, PF `1.397492`, max open `62`; strict `triangle_v0` net
  `+$63.50`; standalone `candidate_b` net `+$521.48`. 2026 old-window surface:
  v1 Candidate-B extension net `+$6,514.20`, PF `3.230020`; v1 David extension
  net `+$10,030.83`, PF `2.731379`; v1 Candidate-or-David extension net
  `+$10,680.79`, PF `2.797742`; strict v0 net `+$216.19`; standalone
  Candidate B net `+$7,615.03`; standalone David contra net `+$9,556.15`.
  2019 old-window surface: v1 Candidate-B extension net `+$548.44`, PF
  `1.181285`; v1 David extension net `+$70.79`, PF `1.015018`; v1
  Candidate-or-David extension net `+$242.77`, PF `1.040025`; strict v0 stayed
  red at `-$61.31`; standalone Candidate B remained stronger net at
  `+$1,700.99`. Read: Triangle v1 is alive once direction, geometry, and start
  trigger are separated, but current v1 over-harvests and over-churns,
  especially in 2026 (`120k..210k` entries). Next work is target/churn/lock
  quality, not promotion or broader starts. Katarakti remains a special
  confluence/larger-target class: Katarakti trades can be v1 trades, but not all
  v1 trades are Katarakti trades. Verdict:
  `PASS_GATE90D_TRIANGLE_V1_BROAD_GREEN_READ_RESEARCH_ONLY_NO_PROMOTION`.
- Gate 90D open-price MFE / 2019 red-flag diagnostic added `--bar-path-mode=open`
  and close-cycle MFE/MAE summary receipts to the Gate 90 runner. Open mode is a
  fast conservative proxy, not final fill truth; it misses intrabar target
  touches that OHLC/MT5 can catch. The no-Candidate-B open diagnostics changed
  the read materially. OOS4 open 5-week: broad v1 David-only
  `triangle_v1_david_contra_extension` returned `-0.82%`, PF `0.896162`,
  average MFE `0.151512 ADR`, average MAE `0.354344 ADR`, and only `19.82%`
  `1Q` MFE hits; strict `triangle_v0_no_candidate_b` returned `+0.51%`, PF
  `2.536091`, average MFE `0.303757 ADR`, and `51.85%` `1Q` MFE hits. 2026
  open 26-week: broad v1 David-only returned `-11.08%`, PF `0.740719`, average
  MFE only `0.024778 ADR`, and `0.34%` `1Q` MFE hits; standalone David contra
  was roughly flat at `+0.46%`; strict no-Candidate-B v0 returned `-2.95%` with
  average MAE `1.821073 ADR`. 2019 open 38-week: broad v1 David-only returned
  `-0.74%`, PF `0.984393`, DD `-9.92%`, average MFE `0.084869 ADR`, and only
  `9.12%` `1Q` MFE hits; standalone David contra returned `+9.30%` with DD
  `-11.32%`; strict no-Candidate-B v0 returned `+1.17%`, PF `1.229681`, DD
  `-2.19%`, average MFE `0.277514 ADR`, and `46.92%` `1Q` MFE hits. 2019 full
  close-event attribution shows target closes were strongly positive
  (`+41.51%`, PF `34.769`) but session flatten erased them (`-42.24%`, PF
  `0.081`); worst cells concentrated in GBP/JPY and JPY pairs, led by
  `GBPJPY SHORT` flatten `-3.76%`, `GBPUSD SHORT` `-2.27%`, and `USDJPY LONG`
  `-1.80%`. Read: do not freeze broad v1 David-only extension as the bot; for
  no-Candidate-B work, use David-only direction plus stricter Triangle/Katarakti
  start quality, with bigger targets reserved for premium/Katarakti class only.
  Verdict:
  `PASS_GATE90D_OPEN_MFE_MAE_RECEIPTS_2019_RED_FLAG_VISIBLE_NO_PROMOTION`.
- Gate 90D 2019 open ADR-normalized breakdown set the reporting convention for
  this lane: headline return is ADR-normalized percent where `1 ADR = 1%`;
  account return is secondary costed USD/equity truth. The 2019 no-Candidate-B
  run showed broad v1 David geometry at `+177.43%` ADR but `-0.74%` account
  return, standalone David contra at `+392.37%` ADR and `+9.30%` account
  return, and strict Katarakti/no-Candidate-B at `+25.29%` ADR and `+1.17%`
  account return. Strict Katarakti had the best per-cycle quality but not enough
  total harvest. Weekly/monthly/pair breakdowns show the core 2019 problem is
  unresolved session-flatten damage, especially around JPY-heavy pain clusters
  such as `AUDJPY` and `GBPJPY`.
- Gate 90D 2019 open protection sweep added protection-mode replay controls to
  the Gate 90 runner and tested `baseline`, `lock_1q_stop_adds`,
  `trail_1q_1q`, `trail_1q_0_5q`, `protected_flatten_1q`, and
  `protected_flatten_1q_trail_1q` over the same no-Candidate-B 2019 surface.
  Result: naive protection is not a free win. Strict `triangle_v0_no_candidate_b`
  baseline remained the best strict quality row at `+25.29%` ADR, `+1.17%`
  account, `-2.19%` DD, `689` entries, max open `13`, and PF `1.230`. Strict
  protected flatten lowered account return to `+1.03%` and moved loss from
  session flatten into `-$520.68` protected-flatten closes. Strict
  `trail_1q_0_5q` returned `+0.98%` account. Standalone David baseline stayed
  the highest 2019 harvester at `+392.37%` ADR and `+9.30%` account; its
  `lock_1q_stop_adds` variant reduced max open `131 -> 101` but lowered account
  return to `+7.43%`. Read: keep strict Katarakti baseline as quality anchor;
  next classify bad-cycle origin before EOD instead of trying more blind
  trailing variations.
- Gate 90D bad-cycle origin / trailing research added an artifact-derived
  MFE/MAE excursion-capture classifier over the existing 2019 open protection
  close-event ledger. Result: trailing is a segment tool, not the main fix.
  Strict `triangle_v0_no_candidate_b` baseline had `12` green-to-red giveback
  losses (`-7.13%` ADR) but `78` losing cycles that never reached `1Q` MFE.
  The ugly no-profit bucket was the real damage: `33` cycles, `-70.04%` ADR,
  `-4.38%` account, with `0` trail-addressable losses. Worst start-date
  clusters were `2019-10-10` (`4` ugly cycles, `-26.51%` ADR) and
  `2019-08-01` (`4` ugly cycles, `-20.96%` ADR). Read: do not hunt for one
  magic trailing stop; next add timestamped excursion receipts and log-only
  heat/cluster guards before replay-freezing protection.
- Gate 90D live-state guard replay added first MFE/MAE quantum timestamps to
  close-event rows and replayed strict no-Candidate-B 2019 open with live-safe
  protection modes. Result: `pain_1q_stop_adds_before_profit_0_5q` is the
  first useful protection rule. It improved strict baseline from `+25.29%` ADR,
  `+1.17%` account, `-2.19%` DD, PF `1.230`, `689` entries to `+32.98%` ADR,
  `+2.29%` account, `-0.67%` DD, PF `1.712`, `529` entries. Hard
  `pain_2q_circuit_before_profit_0_5q` was not good by itself: account return
  fell near flat because it booked `-$369.37` in pain-circuit losses. Read:
  if pain comes first, stop feeding the grid; do not hard-kill every ugly cycle
  until a second condition such as heat/cluster/time/red-news is tested.
- Gate 90D EOD hold-red replay tested closing green cycles at daily flatten
  while carrying red cycles forward, including pain-stop and reset variants.
  Result: hold-red is rejected for the current freeze. Uncapped hold-red fell to
  `-5.53%` account return with `-78.74%` max DD, max open `206`, max depth `78`,
  and max age `85.07` days. Hold-red plus pain stop lifted ADR return to about
  `+48%`, but account return was only `+0.23..+0.25%`, max DD stayed `-4.89%`,
  and max age reached `254.15` days. The reset-after-`+0.5Q` variant was nearly
  identical. Read: do not carry red just because it is red; normal daily flatten
  plus `-1Q` pain-first stop-add remains the best 2019 protection shape.
- Gate 90D EOD hold-red max-3D replay then capped red holds at three days.
  Result: the cap fixed the multi-month zombie problem but still did not beat
  daily flatten. Capped hold-red without pain stop was `-38.60%` ADR,
  `-7.65%` account, `-14.28%` DD. Capped hold-red plus pain stop was positive
  but weak at `+20.60..20.88%` ADR, `+0.37..0.39%` account, `-1.85%` DD,
  below daily-flatten pain stop at `+32.98%` ADR, `+2.29%` account,
  `-0.67%` DD. Read: do not freeze hold-red, capped or uncapped.
- Gate 90D 2026 open pain-stop replay used the 2019-winning strict
  no-Candidate-B settings (`open`, ADR-event `0.075`, David MA `50`, daily
  flatten, pain-first stop-add). Result: baseline was slightly red at `-5.58`
  ADR units and `-0.12%` fixed-lot account return; pain-stop improved it to
  `+11.06` ADR units, `+0.55%` fixed-lot account return, `-1.34%` DD, PF
  `1.196`, entries `353`, max open `23`. Read: pain-stop travels to 2026 but
  is weaker than 2019. Reporting convention corrected: ADR units measure
  movement quality; fixed-lot account return is secondary cash sanity. Add raw
  unnormalized market-return columns before final replay freeze.
- Gate 91 is now the intended next gate: formulaic Triangle grid geometry.
  Freedom explicitly rejected clamp-ladder optimization as the next step. Gate
  91 should derive grid quantum, signal event clock, and reversion horizon from
  market structure. First pass should ignore direction entirely so the geometry
  can be tested without Candidate B, David, or fixed MA bias.

Next action:

- Superseded by the Hot Recovery Override above. Gate 91 formulaic geometry
  v2/v2.1/v2.2/v2.3 diagnostics have now run. Current recommendation is no
  v2.3 promotion and no further pure-grid throttle rows without a new review.
- If Freedom explicitly opens the next design step, keep it bounded and decide
  whether to leave pure directionless geometry or reopen Direction/Katarakti as
  separate evidence layers. Do not implicitly reopen them from this backlog
  note.
- Do not continue with 2020/year-by-year tests or restart the full matrix as the
  next action.
- Do not rerun the same 150-command foreground matrix as-is.
- Interpret Gate 90C with the known caveat that session-flatten lifecycle
  semantics still need explanation because OOS had nonzero swap and max fill
  age under `ny_daily_window`.
- Keep Candidate B/COT as controlled direction-overlay evidence only; do not
  open broad COT/Candidate B redesign yet.
- Do not refactor the current EA or start a new EA until Gate 90C execution
  evidence is produced and reviewed.

Frozen until explicitly reopened: MT5 lifecycle optimization, target
optimization outside the Gate 90 ADR-clock execution surface, spacing searches
outside the Gate 90C matrix, pair-specific swap ingestion, margin stopout
simulator, app/live integration, promotion, live-readiness, broad COT/Candidate
B regime redesign, double-sided in-between policy, and full seven-pair
currency-family handshake implementation or entry gating.

## Historical Active Gate

Latest active gate: Gate 88:
`mt5-lifecycle-protection-controls`.

Gate 88 is the MT5 lifecycle-controls response after EURUSD HWM target
shrinking did not solve the known stale-inventory choke. It keeps the active EA
name `LimniBasketHedgeEAAlphaV3` and adds optional protection controls without
changing the raw harvest defaults.

Gate 88 source/install changes:

- Added optional LWM reset inputs:
  `EquityLwmResetEnabled`, `EquityLwmLossLimitMoney`, and
  `EquityLwmResetCooldownSeconds`.
- Added optional max-age reset inputs:
  `MaxAgeResetEnabled` and `MaxAgeDays`.
- Added optional equity trail-lock inputs:
  `EquityTrailLockEnabled`, `EquityTrailActivationMoney`, and
  `EquityTrailGivebackMoney`.
- Added `EquityTrailUnlockWhenFlat=true` after trail-lock-only testing showed
  the first lock could otherwise stop new trading permanently.
- All Gate 88 controls are OFF by default.
- Main EA stayed thin: only inputs were added in
  `LimniBasketHedgeEAAlphaV3.mq5`; behavior lives in
  `RawHarvestEngine.mqh`.
- HWM and LWM flatten all managed positions and restart the account-equity
  cycle when their thresholds are hit.
- Max-age flatten/restart closes all managed positions when the oldest managed
  position reaches `MaxAgeDays`.
- Equity trail lock does not flatten. It arms after cycle equity reaches the
  activation threshold, then blocks new initials and grid adds after giveback
  from cycle high while allowing normal target resets to close existing legs.
- If trail lock is active and the managed book becomes flat,
  `EquityTrailUnlockWhenFlat=true` resets the cycle and allows trading to start
  again.
- Reset controls write `limni_basket_hedge_alpha_v3_lifecycle_resets.csv`;
  HWM also keeps the Gate 87 HWM reset CSV; trail lock writes
  `limni_basket_hedge_alpha_v3_trailing_locks.csv`.

Gate 88 verification:

- Report:
  `docs/research/gates/gate88/GATE88_MT5_LIFECYCLE_PROTECTION_CONTROLS_2026-07-01.md`.
- Repo compile log:
  `docs/research/gates/gate88/artifacts/limni-basket-hedge-ea-alpha-v3-gate88-repo-compile-log.txt`;
  `0` errors, `0` warnings.
- Active terminal compile log:
  `docs/research/gates/gate88/artifacts/limni-basket-hedge-ea-alpha-v3-gate88-active-terminal-compile-log.txt`;
  `0` errors, `0` warnings.
- Trail-unlock patch repo compile log:
  `docs/research/gates/gate88/artifacts/limni-basket-hedge-ea-alpha-v3-gate88-trail-unlock-repo-compile-log.txt`;
  `0` errors, `0` warnings.
- Trail-unlock patch active terminal compile log:
  `docs/research/gates/gate88/artifacts/limni-basket-hedge-ea-alpha-v3-gate88-trail-unlock-active-terminal-compile-log.txt`;
  `0` errors, `0` warnings.
- Active terminal install root:
  `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB`.
- Installed active terminal files:
  `MQL5/Experts/LimniBasketHedgeEAAlphaV3.mq5`,
  `MQL5/Experts/LimniBasketHedgeEAAlphaV3.ex5`, and
  `MQL5/Experts/Include/Strategy/RawHarvestEngine.mqh`.
- Repo source hashes match active terminal source hashes:
  - `LimniBasketHedgeEAAlphaV3.mq5`:
    `4E264DE33A47E43CC96614044D6C993C490BB75C20625A7246626A0DE188A386`
  - `RawHarvestEngine.mqh`:
    `E2AB2C32024123D052F31847EEA432ED1E2A564E3A4401607C87607362CA481D`.
- Active terminal `.ex5` hash:
  `CFB4F70143BCE6FCCEDE1C33546007D04FE604C7FD62ADF4B0AF9E04AD975073`.

Gate 88 recommended EURUSD isolation ladder:

- EA: `LimniBasketHedgeEAAlphaV3`.
- Chart symbol/timeframe: `EURUSD,M1`.
- Model: `1 Minute OHLC`.
- Common inputs:
  `UseCurrentChartSymbolOnly=true`, `CsvLogEnabled=false`,
  `EquityHwmCsvLogEnabled=true`, `DashboardEnabled=false`,
  `EnableTimer=false`, `TesterCadence=RH_CADENCE_NEW_M1_BAR`,
  `TesterMinSecondsBetweenManage=0`, `AdrRefreshSeconds=3600`,
  `DrawdownRefreshSeconds=60`, `LotSize=0.01`,
  `TargetAdrMultiple=1.0`, `SpacingAdrMultiple=0.2`.
- Test LWM by itself first:
  `EquityLwmResetEnabled=true`; keep HWM, max-age, and trail lock OFF.
- Then test max-age by itself:
  `MaxAgeResetEnabled=true`; keep HWM, LWM, and trail lock OFF.
- Then test trail lock by itself:
  `EquityTrailLockEnabled=true`, `EquityTrailUnlockWhenFlat=true`; keep HWM,
  LWM, and max-age OFF.
- Only combine controls after isolated behavior is understood.

Manual findings feeding Gate 88: `$500`, `$100`, `$10`, and likely `$1` fixed
HWM targets did not solve the EURUSD lifecycle. `$10` almost survived but failed
in 2025 with equity falling from roughly `$15,000` back toward `$10,000`.
Treat fixed-dollar thresholds and fixed `LotSize=0.01` as temporary smoke-test
scaffolding; later research should consider percent-equity or ADR-normalized
targets and equity-scaled sizing only after a lifecycle control shows merit.

Gate 88 is not a Strategy Tester result, optimized target, adaptive basket
selector, Candidate B/COT/Strength/Regime layer, risk layer, lot-sizing change,
promotion, or live-readiness claim.

## Next Gate

Next planned gate: Gate 89:
`mt5-warehouse-raw-parity-bridge`.

Freedom will produce one raw MT5 reference test to compare against the
warehouse before any further optimization. The point is to prove that the
warehouse can reproduce MT5 closely enough to trust wide matrix research.

Gate 89 raw MT5 reference target:

- EA: `LimniBasketHedgeEAAlphaV3`.
- Symbol/timeframe: `EURUSD,M1`.
- Model: expected `1 Minute OHLC` unless Freedom intentionally chooses another
  model and records it.
- Visual mode OFF, optimization OFF, zero latency.
- Raw lifecycle OFF:
  `EquityHwmResetEnabled=false`, `EquityLwmResetEnabled=false`,
  `MaxAgeResetEnabled=false`, `EquityTrailLockEnabled=false`.
- Baseline harvest settings:
  `UseCurrentChartSymbolOnly=true`, `LotSize=0.01`,
  `TargetAdrMultiple=1.0`, `SpacingAdrMultiple=0.2`,
  `EnableTimer=false`, `DashboardEnabled=false`,
  `TesterCadence=RH_CADENCE_NEW_M1_BAR`,
  `TesterMinSecondsBetweenManage=0`, `AdrRefreshSeconds=3600`,
  `DrawdownRefreshSeconds=60`.
- Save the MT5 HTML report and exact input settings. If feasible, also save
  deals/orders and EA CSV logs; if CSV makes the run too slow, prioritize the
  HTML report plus exact settings first.

Gate 89 acceptance target is not tick-perfect matching. The warehouse needs to
match the MT5 failure shape closely enough: final equity direction, drawdown
scale, trade/fill count magnitude, reset count magnitude, failure timing,
stale inventory buildup, cost/swap drag direction, and end-of-test open
liquidation behavior.

If parity holds, move optimization back to the warehouse and run matrices to
decide whether raw no-direction grid harvest is feasible, whether it only works
as multi-pair/basket behavior, or whether multi-pair also fails and the design
must go back to the drawing board. If parity fails, fix the warehouse model
before trusting warehouse optimization.

Recent prior gate: Gate 87:
`mt5-static-basket-hwm-reset-smoke`.

Gate 87 added optional account-equity HWM reset mechanics. The HWM reset is OFF
by default and closes all managed positions once account equity reaches cycle
start plus target money, then resets anchors and starts a new cycle from
post-close equity. Gate 87 compiled and installed with `0` errors and `0`
warnings, but Freedom's EURUSD HWM ladder showed HWM alone was insufficient.

Parked later gate: add Candidate B directional harvest logic to the MT5 EA/MQH
path and test whether choosing one side from weekly direction has merit on the
same MT5 execution surface. Keep this closed for now; continue raw both-side HWM
first because it is simpler. If opened later, do not start with forced
loss-making weekly flips. Prefer cycle-boundary direction refresh after HWM
reset, or profit-only / stop-adding-new-exposure handling for stale direction.

Recent prior gate: Gate 86:
`mt5-tester-speed-preflight`.

Gate 86 compiled and installed the faster V3 speed build. The following manual
MT5 EURUSD run then failed as a deployable lifecycle result: `$174.51` net
profit, `1.01` profit factor, `78.61%` equity drawdown, `149` end-of-test open
positions liquidated, and heavy swap/carry drag. That result motivates Gate 87
HWM lifecycle testing; it does not prove the EA stopped harvesting.

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
