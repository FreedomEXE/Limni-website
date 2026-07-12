# Gate 108A Remaining Integration - Code Impact and Invariants

Date: 2026-07-11  
Baseline: `f929440669dc53bbefc9aad952ae15ca1362227d`  
Mode: pre-edit institutional implementation map  
Runtime authority: none; Freedom retains all MT5 runtime tests

## Decision boundary

This map is the required pre-edit checkpoint for completing Gate 108A. It does
not claim mechanics, parity, speed, economics, live readiness, promotion, or
funding readiness. Source changes may begin only after this impact and
invariant boundary is explicit. The implementation stops after repository and
configured-terminal compilation, identity proof, documentation, push, and a
clean working tree. Strategy Tester and every runner that executes a backtest
remain forbidden to Codex.

## Live pre-edit findings

- Gate 108 discovery initialization and finalization exist but have no Engine
  activation call sites.
- The accepted U/C books already provide fixed `2 x 28` topology,
  deterministic build/sort/allocate/commit APIs, branch-local lifecycle state,
  the narrow C signed-center authority, and checked minor-unit reconciliation.
- The accepted dedicated telemetry writer already provides fixed buffers,
  batched writes, transition and summary validation, hash chains, terminal
  evidence latches, and fail-closed resource handling; event production is not
  yet integrated.
- R still follows the legacy per-symbol RevMA intent path. Its one-birth,
  one-add, `0.02`-lot maximum and deterministic Gate 108 candidate identity are
  not yet bound to routing outcomes.
- The current exposed inputs are legacy-wide and the stock defaults fail the
  Gate 108 controlled-profile validator. Gate 108 strategy authority is not yet
  compile-frozen at the operator surface.
- The terminal synchronization tool defaults to an earlier profile and does
  not yet prove the complete canonical source closure, controlled profile, or
  repository-to-terminal EX5 equality.

## Code-impact map

| Area | Planned owner | Required effect |
| --- | --- | --- |
| Immutable observation | `Strategies/Revma/RevmaDiscoveryTypes.mqh` | Define one complete shared completed-M1 snapshot and its canonical hash; include signal, direction/sleeve/variant, decision/stress/fill/mark prices, bid/ask/spread, q/center/update provenance, formula/profile/source-M1 identity, and valuation provenance |
| Deterministic valuation | `Strategies/Revma/RevmaDiscoveryValuation.mqh` (new, if the smaller boundary remains clean) | Build the shared executable-price, q-cash, immediate-liquidation, close-cost, and margin contract once from the broker/account contract; shadows consume values and never call broker APIs |
| Real R book/envelope | `Strategies/RevmaGridSleeve.mqh` | Own R cycle/grid/candidate state, enforce one `0.01` birth plus one `0.01` add, preserve adverse and favorable adds, stage pre-route state, and commit only after a confirmed fill |
| U/C orchestration | `Strategies/RevmaGridSleeve.mqh`, `Strategies/Revma/RevmaShadowPortfolio.mqh` | Pass the same immutable snapshot into both shadows; schedule matched mutation before divergence and branch-local mutation afterward; expose exact state needed for telemetry without broker coupling |
| Concurrent portfolio risk | `Strategies/Revma/RevmaShadowPortfolio.mqh` and the equivalent R aggregate state | Track simultaneous reservation, modeled margin, q-cash, atoms, grids, currency concentration, liquidation liability, and drawdown at every committed transition/mark; bind peaks into terminal identity |
| Lifecycle evidence | `Strategies/Revma/RevmaDiscoveryTelemetry.mqh` | Add canonical row/state equivalence for concurrent peaks, terminal inventory, branch counters, and final in-memory state; preserve fixed buffered transition-only output |
| Thin registry API | `Strategies/StrategyRegistry.mqh` | Forward immutable snapshot, completed-M1 batch, routing result, close continuation, terminal reconciliation, and discovery timing calls without formulas |
| Engine scheduling | `Core/Engine.mqh` | Build each symbol snapshot once, update all branch books, continue owners, evaluate hard risk then cleanup then local harvest, build all candidates, allocate, commit shadows, route R only, and emit bounded telemetry in the frozen order |
| Routing boundary | Existing `Execution/TradeRouter.mqh` through Engine only | Keep TradeRouter free of shadow APIs; retain deterministic R identity through risk and routing; distinguish pre-route rejection, router rejection, broker rejection, partial fill, and confirmed fill |
| Controlled profile | `Core/Config.mqh`, controlled Gate 108 `.set` artifact | Remove operator strategy authority; expose only broker/account compatibility and non-alpha operational controls; compile-freeze every formula, lifecycle, reservation, allocation, and capital constant |
| Build identity | `Core/BuildInfo.mqh`, `Limni/LimniPortfolioEA.mq5` | Advance the Gate 108A build identity and bind the final canonical source-bundle hash |
| Terminal synchronization | `automation/mt5/tools/Sync-LimniPortfolioEA-Terminals.ps1` and terminal-root configuration | Copy and verify the complete canonical closure plus controlled profile, compile with the active terminal MetaEditor, and prove source/profile/EX5 identities without launching a tester |
| Static verification | `automation/mt5/tools/Test-Gate108SourceBundle.ps1` plus bounded scans | Recompute canonical closure, reject source drift, scan shadow isolation and forbidden runtime dependencies, check schema/header parity, and record compile receipts |
| Review evidence | Consolidated Gate 108A packet and artifact directory | Record architecture-to-code proof, invariant results, input classification, hashes, compile durations, known limitations, and Freedom's exact tiny-run settings |

`TradeRouter.mqh` is not expected to change. If the existing routing result
contract is sufficient, the institutional boundary is proved by Engine/sleeve
staging and static dependency scans rather than by adding strategy knowledge to
the router.

### Post-map institutional review deviation

The pre-edit assumption above did not survive adversarial routing review. The
existing result contract could not prove a complete routed deal-ticket set,
could close both hedged R atoms in one mixed-result batch, and had no bounded
managed-order cancellation surface for post-send quarantine. The implemented
router change is therefore narrow and execution-generic:

- preserve the canonical deal tickets already discovered for each order;
- close at most one broker position per routing step for a Gate 108 R grid;
- allow Engine-owned invalid-run quarantine to cancel only managed RevMA
  pending orders;
- retain no U/C type, formula, shadow-book, center-policy, or telemetry
  authority in the router.

This deviation tightens routing-stage mutation safety without moving strategy
selection into execution infrastructure.

## Frozen invariant table

| Invariant | Enforcement target | Failure boundary |
| --- | --- | --- |
| One immutable completed-M1 observation | Engine constructs one snapshot per eligible symbol/source M1; canonical identity is recomputed before every branch use | Snapshot/identity mismatch invalidates Gate 108 evidence before exposure |
| Shared signal and valuation provenance | R/U/C receive the same signal, q, center, bid/ask, decision, stress, fill proxy, formula/profile, and valuation-method fields | Branch reconstruction or field drift is fatal |
| Completed-M1 strategy cadence | Birth, add, mark, risk, cleanup, harvest, and candidate decisions require a strictly newer 60-second-aligned source M1 | Duplicate/stale/non-aligned identity invalidates |
| R is the only trading branch | Only R creates real intents that can reach risk and `TradeRouter`; U/C types contain no router/order/position/ticket/history/account dependency | Any shadow broker authority fails static review and invalidates runtime evidence |
| R two-atom envelope | Exactly one `0.01` birth and at most one `0.01` add; position count `<= 2`, lots `<= 0.02`; both adverse and favorable adds remain eligible | Proposed or observed excess is a formula-invariant failure |
| No pre-fill R mutation | Candidate state is staged with immutable intent/candidate/grid identity; inventory, reservation, lifecycle, and atom counters commit only after confirmed execution | Risk/router/broker rejection leaves no partial exposure mutation; link failure is fatal |
| Explicit routing attribution | Pre-route formula rejection, risk rejection, router rejection, broker rejection, partial fill, and executed fill are distinct terminal candidate outcomes | Broker/no-money rejection cannot be relabelled as capacity evidence |
| Deterministic closed-session handling | Calendar/session state is part of the shared snapshot and produces the same canonical rejection without entering branch allocation or routing | Session-dependent mutation or inconsistent branch observation invalidates |
| Lifecycle order | Continue owner -> mark/path -> hard risk -> cleanup -> local harvest -> candidates -> build all -> sort/allocate -> commit -> telemetry | Any add before same-M1 harvest proof or while an owner exists invalidates |
| One atom per grid per M1 | Admission identity is branch + branch-grid + source M1 and seals one terminal candidate decision | Duplicate identity or multi-atom jump admission invalidates |
| Jump arithmetic only | Multi-cell jumps update aggregate path counters; no per-cell object, candidate, or row is created | Per-cell expansion invalidates and violates speed boundary |
| Deterministic portfolio allocation | Build all eligible candidates, sort incremental reservation ascending, tie-break canonical symbol then candidate identity, allocate, then commit | Symbol-loop-order dependence or rejected-state mutation invalidates |
| Branch independence | After authorized divergence each branch owns grids, PnL, costs, equity/reference, budget/reservation, lifecycle owners, flat/re-entry, capacity, and allocation | Cross-branch following or borrowed state invalidates affected evidence |
| Frozen money quantization | Positive gain, negative liability, budget and actual-equity proof use mathematical floor; frozen reference equity alone uses ceil | Any raw-double boundary, shared ceil path or one-minor-unit optimistic proof invalidates |
| Exact local harvest | `excursion_completed && EstimatedGridLiquidationPnL >= 1 minor unit`; evaluated before adds and latched until confirmed flat; final `H` preserves the signed actual/model after-cost result | Raw-double trigger, discarded adverse realization or later add under latch invalidates |
| Exact cleanup | Conservative minor units prove `H > 0`, `L < 0`, `H + L >= 0`; authority latches until flat and preserves grid-origin reasons | Missing funding/shortfall attribution or lowered `E_ref` invalidates |
| Exact hard risk | Before liquidation `H + L <= -B`; during liquidation `H + R_nonharvest + L <= -B`; `B = ceil(E_ref) / 10` under the frozen integer rule | Missed escalation, de-escalation, or altered budget invalidates |
| Exact re-entry | Local-harvest rebirth requires a later M1 than trigger and confirmed flat; cleanup/risk rebirth also requires a fresh direction/sleeve/variant identity | Early or borrowed re-entry invalidates |
| C authority remains narrow | C only, aligned births only, positive-to-non-positive support transition, future adverse adds only, permanent grid latch; favorable adds and existing inventory remain untouched | Any R/U effect, misaligned authority, liquidation, or favorable block invalidates |
| Reservation never shrinks early | Birth reserves two atoms; shadow peak depth above two adds one frozen `A_g` each; reservation remains through partial closes and releases only at confirmed flat | Early shrink or silent cap invalidates |
| Exact R atom-close attribution | Each active R atom retains its exact position identity and opening deal money; a closed atom carries opening and closing deal money into the surviving grid mark | Missing/duplicate position identity, non-`0.01` close volume or incomplete money carry invalidates and enters quarantine |
| Partial-close valuation cannot masquerade as terminal truth | A two-to-one R reconciliation latches valuation stale until a fresh shared completed-M1 mark or confirmed flat | Risk publication or terminal sealing while stale fails closed |
| Origin attribution is immutable | `grid_harvest`, `account_cleanup` or `account_risk` partitions historical PnL/counts; active cleanup/risk ownership may escalate close work without rewriting origin | Owner/reason mismatch, double attribution or escalation rewrite invalidates |
| R close staging follows current authority | On completed-M1 steps Engine marks and evaluates escalation before staging one close batch; any active grid close work blocks exposure construction | Stale-owner intent, duplicate staging or exposure behind a pending close invalidates |
| True simultaneous peaks | Aggregate peaks update from one actual branch state after each mark/commit/close, never by summing independent per-grid maxima | Synthetic/non-concurrent peak evidence invalidates |
| Currency concentration is actual state | Base/quote directional q-cash contributions are aggregated from all simultaneous active branch grids using canonical currency IDs | Zero placeholder, unavailable mapping, or overflow invalidates |
| Terminal row/state equivalence | Canonical terminal payload and internal state serialize the same fields and bind the same grid-set/book hashes, counts, money, owners, inventory, and concurrent peaks | Row/hash/ledger/flush mismatch invalidates completion |
| Bounded telemetry | Transition-only fixed buffers, batched flushes, no per-tick/unchanged-M1 rows, no lifecycle rewrites | Buffer/file/schema/sequence/hash/flush failure invalidates; no silent drop |
| Compile-frozen strategy authority | Atom size/cap, mesh, q profile, center policy, harvest, cleanup, hard risk, reservation, allocation, re-entry, and `0.10` budget are constants included in formula/profile hash | Operator-selectable alpha or lifecycle authority blocks Gate 108A |
| RevMA-only account ownership | Controlled profile disables other lanes and legacy close authorities; malformed, external, manual, deposit, or withdrawal contamination is fail-closed evidence | Ambiguous/magic-zero/non-RevMA ownership invalidates the cycle/run |
| Source and executable identity | Canonical repository closure, both configured terminal closures, controlled profile, formula/profile hashes, and repo/terminal EX5 hashes must reconcile | Any identity mismatch blocks handoff |

## Implementation order

1. Seal the shared snapshot, valuation, and controlled-profile contracts.
2. Add R aggregate state and route-outcome staging without changing the router.
3. Integrate U/C snapshot consumption, lifecycle scheduling, and candidate
   production.
4. Add true concurrent peak/concentration state and terminal row/state binding.
5. Wire bounded transition/summary production and finalization.
6. Perform adversarial static review, repository compile, source-bundle seal,
   configured-terminal sync/compile, and identity proof.
7. Commit, push, verify local/upstream/remote equality and a clean tree, then
   stop before all runtime tests.
