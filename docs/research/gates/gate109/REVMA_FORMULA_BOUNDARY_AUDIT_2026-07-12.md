# Revma Formula Boundary Audit — 2026-07-12

## Status and scope

This is a boundary audit for the Gate109 Revma implementation. It does not
change Q, center behavior, birth/add/close classification, local harvest,
account cleanup, risk economics, or lot sizing. It records the current
contract and identifies the normalization work required before those values
can be treated as one reproducible formula.

The current reviewed runtime evidence was produced by EA `1.037`:

```text
source_bundle_id=sha256:03ba4004c81f85198eac178685fac236833d440fdaa2423f0876052fac66852e
underlying_revma_formula_hash=907110450252532080
gate108_profile_hash=5876431486502579717
gate108_discovery_formula_hash=870183506775026606
runtime_config_hash=12525939125638501606
```

The source bundle, profile, and runtime hashes above are historical inputs to
this audit. The repaired source receives a new source-bundle identity during
the canonical compile gate; the final identity is recorded in the repair
receipt, not retroactively substituted into this historical evidence.

## Definition of the Revma formula

For this project, “Revma formula” means a versioned, explicit contract that
maps declared market observations, broker observations, account observations,
controlled research-profile values, and prior Revma state to declared signal,
candidate, portfolio, lifecycle, money, and execution-authority outputs.

The formula is not required to be one source function. It is required to be
reproducible from its declared inputs and state. A value that changes an
economic decision cannot remain an unrecorded default, a broker-side surprise,
or a telemetry-only hardcode.

Account equity is therefore an explicit runtime input. The current `$1,000`
value in the mandatory run manifest is an observation of that run, not a
universal Revma requirement.

## Current contract

### Inputs

- Closed-M1 Revma signal state: reconstructed history boundary, day/Q state,
  event count, reconstruction epoch, direction, anchor, Q, and signal identity.
- Completed-M1 executable observations: bid, ask, spread, decision price,
  stress reference, fill reference, current price, tick size, and timestamp.
- Center/support observations: birth center, current center, support signs,
  center update history, center applicability, and C-branch latch state.
- Account/portfolio observations: equity reference, branch equity, realized
  harvest/non-harvest, current inventory, reservations, Q cash, margin,
  liquidation liability, concentration, and prior lifecycle state.
- Broker/platform observations: symbol mapping, tradability, digits, point,
  tick size/value, contract size, volume min/max/step, filling policy, margin,
  and executable valuation results.
- Controlled profile values: FX28, complete-cohort requirement, Q profile and
  history depth, atom policy, mesh fraction, capital budget policy, slippage,
  intent expiry, calendar/news profile, and telemetry policy.

### Outputs

- Versioned signal/state identity and birth eligibility.
- Directional reversion classification and birth bucket.
- Candidate type: birth, adverse add, or favorable add.
- Candidate decision: admit, reject, close, or invalidate, with reason.
- Desired exact-atom execution plan and branch-specific authorization.
- Reservation, Q-cash, margin, immediate-liability, concentration, and
  account-risk projections.
- Lifecycle state transition, local-harvest realization, cleanup/risk owner,
  terminal projection, and reconciled R/U/C telemetry rows.

### Persistent state between completed-M1 observations

The state carried forward includes the reconstructed signal state; last closed
M1 and initial-history boundary; day/Q statistics; direction and pending
direction state; center/support regression and latch state; grid identity,
generation, birth snapshot, entry extrema, atom count, lots, reservations,
margin, Q cash, liability, age, underwater clock, add counts, harvest and
non-harvest ledgers; branch cycle/account cycle; R/U/C matching state; cohort
hashes; candidate decision clocks; and writer-owned transition/summary hash
chains. State is advanced only after the corresponding invariant-checked event
is accepted.

## Contract classification table

The hash columns describe the current implementation, not the proposed clean
hierarchy. “Yes” means the value is included directly or through a payload
called by that hash. “No” means it is not covered by that identity. Receipt
coverage distinguishes an ordinary run manifest/summary from the dedicated
Gate108 telemetry or snapshot artifacts.

| Item | Current source/file | Current value | Classification | Formula hash | Profile hash | Runtime/config hash | Manifested in receipts | Proposed status | Rationale |
| ---- | ------------------- | ------------: | -------------- | ------------ | ------------ | ------------------- | ---------------------- | --------------- | --------- |
| Revma signal/state interpretation | `RevmaSignalState.mqh`, `RevmaTypes.mqh` | Closed-M1 event/Q state and reversion anchor | Core strategy formula | Yes: underlying Revma hash | No | No | Formula ID/hash and Q fields; state details in snapshots | Keep in formula | Defines the signal transformation and must version with behavior. |
| Pair-direction exhaustion | `LimniPairDirectionCore.mqh` | `g99zv-pair-direction-exhaustion-v001` | Core strategy formula | Yes, but incompletely | No | No | Pair formula ID/hash in run manifest | Normalize | The hash omits some live constants and actual weight details. |
| Birth eligibility | `RevmaSignalState.mqh`, `RevmaGridSleeve.mqh` | Valid direction, anchor/classification, lifecycle gate | Core strategy formula | Indirectly | No | No | Birth/candidate telemetry when reached | Keep in formula | Changes admissions and must be retested. |
| Direction and sleeve classification | `RevmaTypes.mqh`, `RevmaGridSleeve.mqh` | Reversion; long/short relative to anchor | Core strategy formula | Yes through underlying hash, behavior coverage incomplete | No | No | Formula hash; candidate rows | Normalize | The output is economic, while the current payload is descriptive rather than exhaustive. |
| Birth bucket | `RevmaDiscoveryTypes.mqh` | Direction plus tick-normalized `p0` versus `c0` | Core strategy formula | Yes: discovery formula | Yes | No | Transition snapshot/telemetry | Keep in formula | It affects immutable birth identity and lifecycle state. |
| Adverse/favorable add classifier | `RevmaGridSleeve.mqh`, `RevmaRealPortfolio.mqh` | Completed-M1 decision ticks versus executed entry extrema plus frozen cell | Core strategy formula | Yes: discovery formula | No | No | Candidate/transition telemetry | Normalize | It changes candidate type and admission authority. |
| Center-support authority | `RevmaCenterSupportPolicy.mqh`, `RevmaGridSleeve.mqh` | C branch; aligned positive-to-nonpositive support freezes adverse adds | Core strategy formula | Yes: discovery formula | Profile describes center controls | No | Center transition/summary fields | Keep in formula | This is an economic branch rule, not merely a display value. |
| Local harvest rule | `RevmaRealPortfolio.mqh`, `RevmaShadowPortfolio.mqh` | Signed actual-after-cost harvest preserved after estimated trigger | Core strategy formula | Yes: discovery formula | No | No | Grid/cycle summaries | Keep in formula | Close ownership and realized result affect the economic path. |
| Account cleanup/reset rule | `RevmaRealPortfolio.mqh`, `RevmaShadowPortfolio.mqh` | `H > 0`, `L < 0`, `H + L >= 0`; then flat-cycle reset | Core strategy formula | Yes: discovery formula | Profile disables legacy harvest governor | No | Cycle/terminal summaries | Keep in formula | It determines whether the next cycle is authorized. |
| Hard-risk authority | `RevmaRealPortfolio.mqh`, `RevmaShadowPortfolio.mqh` | Capital-budget breach; branch invalid on arithmetic failure | Core strategy formula | Yes: discovery formula | No | No | Risk/cycle summaries | Keep in formula | It changes exposure and fail-closed outcomes. |
| Capital-budget fraction | `RevmaDiscoveryTypes.mqh` | Numerator `1`, denominator `10`, fraction `0.10`; integer minor-unit floor | Core strategy formula | Yes | Yes | No direct config field | Discovery formula identity; budget in rows | Keep, normalize ratio | The transformation `B=floor(E_ref/10)` is an economic risk rule. |
| Account equity reference | `RevmaRealPortfolio.mqh`, `Engine.mqh` | Runtime equity converted to minor units; failed run observed `$1,000` | Explicit runtime formula input | Used as row value, not formula identity | No | Config hash does not include observation | Mandatory manifest and cycle rows | Keep as runtime input | It must vary by run and must never be a fixed formula constant. |
| Current Q | `RevmaSignalState.mqh`, snapshots | Derived from reconstructed completed-M1 state | Explicit runtime formula input | Not value-hashed; Q behavior is indirectly versioned | Q profile controls only | No | Snapshot fields and Q profile | Keep as dataset/runtime input | It is observed state consumed by the formula. |
| Center/anchor and price | `RevmaDiscoveryValuation.mqh`, snapshots | `p0`, `c0`, current price, stress/fill prices | Explicit runtime formula input | Value is in snapshot identity, not formula hash | No | No | Completed-M1 snapshot/transition rows | Keep as runtime input | These are point-in-time observations. |
| Current inventory and prior state | `RevmaRealPortfolio.mqh`, `RevmaShadowPortfolio.mqh` | Atoms, lots, grid state, reservations, liabilities, cycle state | Explicit runtime formula input | State identities and transition hashes | No | No | Transition/summary telemetry | Keep as prior state | The formula is stateful; state must be immutable and receipt-linked. |
| Realized harvest/non-harvest | Portfolio state files | Signed minor-unit ledgers | Explicit runtime formula input | Discovery formula names ledger semantics | No | No | Grid/cycle summaries | Keep as runtime ledger | It is a prior result, not a fixed strategy parameter. |
| Margin requirement | `RevmaDiscoveryValuation.mqh`, `SymbolSpecCache` | `OrderCalcMargin` for exact `0.01` atom, ceil to minor units | Broker/platform constraint | Current discovery hash names valuation method | Profile does not include live broker value | No | Snapshot and broker symbol receipts | Keep environment identity | It is broker-dependent and cannot be alpha. |
| Immediate liquidation liability | `RevmaDiscoveryValuation.mqh` | Directional bid/ask liquidation result, signed minor units | Explicit runtime formula input | Method named in discovery formula | No | No | Completed-M1 snapshots and risk rows | Keep runtime input | It is computed from current executable prices and contract data. |
| Broker symbol contract | `SymbolSpecCache.mqh` | Digits, point, tick size/value, contract size, volume min/max/step, mode | Broker/platform constraint | No live values | No | No | Partly in symbol receipts/snapshots | Correct later | All values affecting quantization/valuation need environment identity and receipt coverage. |
| Account currency | `RevmaDiscoveryValuation.mqh`, mandatory diagnostics | Current implementation accepts `USD` only | Broker/platform constraint | Profile/formula hardcode `USD` | Yes: `USD:digits=2` | No | Mandatory manifest; snapshot currency | Hidden/misclassified now | Currency is a platform input; rejecting non-USD is a profile constraint, not universal alpha. |
| Account currency digits | `RevmaDiscoveryTypes.mqh`, `RevmaDiscoveryValuation.mqh` | Compile-time `2`; money quantum `10^-2` | Broker/platform constraint | Named indirectly | Yes | No | Not explicit in ordinary run manifest; snapshot has digits | Hidden/misclassified now | Runtime account digits must be observed and identity-bound. |
| Money conversion/rounding | `RevmaDiscoveryTypes.mqh`, valuation/portfolio files | Gain/actual floor; liability/budget/reference ceil/floor as named in hash | Core strategy formula plus execution policy | Yes, conflated | Partial | No | Minor-unit rows | Split identities | Economic ledger semantics and representation policy should be separately named. |
| Atom lots | `RevmaDiscoveryTypes.mqh` | Compile-time `0.01` | Broker/platform constraint | Yes | Yes | Config includes `revma_fixed_lots=0.01` | Run summary and snapshots | Split formula from broker min | Desired atom is formula/profile policy; legal minimum/step is broker state. |
| Real maximum atoms per grid | `RevmaDiscoveryTypes.mqh` | `2` | Safety/execution implementation cap | Yes | No | No | Not explicit in ordinary manifest | Promote to formula/profile | It changes R exposure and therefore cannot remain an unreceipted cap. |
| Discovery cell fraction | `RevmaDiscoveryTypes.mqh`, `RevmaPathGeometry.mqh` | `0.10 * q`; ceil outward to broker ticks | Core strategy formula | Yes | Yes | Config mesh value covers only operator parity | Snapshot mesh/tick fields | Keep geometry in formula; broker quantization in environment | Raw mesh is Revma geometry; outward tick rounding is platform execution. |
| Slippage | `RevmaDiscoveryTypes.mqh`, execution paths | `10` points; some intent paths also assign `10.0` | Research controlled-profile setting | Yes in Gate108 discovery profile/formula payload | Yes | Config hash does not include discovery constant | Not consistently in run manifest; intent/plan only | Profile-only | It defines the experiment/execution boundary, not alpha. |
| Filling policy | `RevmaDiscoveryTypes.mqh`, `RevmaExecutionBoundary.mqh` | `BROKER_FOK_EXACT_ATOM_V1` | Broker/platform constraint | Method named in discovery formula | Yes | No | Plan/transition evidence and broker receipts | Keep environment/profile split | FOK availability is broker/platform state; exact-atom policy is controlled contract. |
| Intent expiry | `Config.mqh`, `RevmaDiscoveryTypes.mqh` | `10` minutes | Research controlled-profile setting | No core formula | Yes | Yes: `LP_ConfigHash` | Run manifest/summary | Profile-only | It bounds execution timing and needs profile identity, not alpha identity. |
| FX28 universe | `Config.mqh`, `RevmaDiscoveryTypes.mqh` | `FX28`, all 28 symbols required | Research controlled-profile setting | Yes through discovery formula | Yes | Yes | Mandatory/run manifest; cohort identity | Profile-only | It defines the experiment topology. |
| `require_all_symbols` | `Config.mqh` | `true` for FX28 | Research controlled-profile setting | Yes indirectly | Yes | Yes | Run manifest and cohort evidence | Profile-only | Atomic cohort completeness is a research gate, not signal economics. |
| Q profile | `Config.mqh`, `RevmaSignalState.mqh` | Medium | Research controlled-profile setting | Underlying formula hash includes Q behavior but not all depth choices | Yes | Yes | Run manifest/snapshot | Profile-only | It selects the reproducibility profile. |
| Maximum M1 history | `Config.mqh`, `RevmaDiscoveryTypes.mqh` | `50000` bars | Research controlled-profile setting | Profile/formula payload | Yes | Yes | Run manifest and snapshots | Profile-only | It changes the observed state reconstruction. |
| Week boundary | `Config.mqh`, `SessionCalendar.mqh` | Enabled; EST Sunday 17 / Friday 17; block 60 min; offset 0 | Research controlled-profile setting | Discovery formula/profile names it | Yes | Yes | Run manifest/summary | Profile-only | Calendar treatment controls the research run. |
| News settings | `Config.mqh`, `NewsCalendar.mqh` | Guard disabled; before/after 30; minimum impact 3; file path declared | Research controlled-profile setting | Profile names disabled policy | Yes | Yes | Run manifest/summary; snapshot session/news fields | Profile-only | News policy is an experiment control and runtime data source, not Revma alpha. |
| Concentration logic | `RevmaRealPortfolio.mqh`, `RevmaShadowPortfolio.mqh` | Max gross currency Q-cash at coherent branch snapshot; tie smallest currency | Core strategy formula | Yes | No | No | Risk/summary rows | Keep in formula, receipt values | It changes admission and must remain identity-linked. |
| Reservation rule | Portfolio files | Candidate reservation; R two-atom envelope; U/C prospective reservation | Core strategy formula | Yes | Partial | No | Candidate/risk/transition rows | Keep in formula | Reservations alter exposure authorization. |
| Execution caps | `Config.mqh`, `RiskArbiter.mqh` | Signed 5 lots; gross 10; same direction 4; managed 200; single order 1.0; close step 10 | Safety/execution implementation cap | Not all in core; discovery payload names managed/single/close | Yes: controlled profile | Yes | Run manifest/summary | Split/flag material caps | A cap that changes candidate outcomes is economically material and cannot be safety-only. |
| Legacy TP/SL/HWM | `Config.mqh`, profile validator | Disabled; all thresholds zero; HWM block false | Research controlled-profile setting | Discovery formula names disabled legacy exits | Yes | Yes | Run manifest/summary | Profile-only | It freezes competing authorities out of the Gate108 experiment. |
| Local harvest governor | `Config.mqh`, `AccountHarvestGuard.mqh` | Disabled for Gate108; target/trail zero | Research controlled-profile setting | Discovery formula uses Revma local harvest semantics | Yes | Yes | Run manifest/summary | Profile-only for disabled legacy governor | Must not be confused with Revma grid local-harvest economics. |
| Birth/add/close event taxonomy | `RevmaDiscoveryTelemetry.mqh`, `RevmaGridSleeve.mqh` | Cycle start; birth; atom admission; rejection; close; terminal snapshot | Core strategy formula plus evidence contract | Yes, heavily conflated | Telemetry profile | No | Gate108 transitions/summaries | Split economics from evidence schema | Event meanings are economic where they authorize state changes; schema is not. |
| Telemetry schema and buffers | `RevmaDiscoveryTypes.mqh`, telemetry writer | v16; transition 256/flush64; summary64/flush16; line8192; byte guard 4 GiB | Safety/execution implementation cap | Currently included in discovery formula hash | Yes/partial | No | Gate108 completion manifest | Move to evidence identity | These values govern evidence durability, not strategy economics. |
| Cohort wait | `RevmaDiscoveryTypes.mqh`, engine | `900` seconds | Research controlled-profile setting | Included in discovery formula hash | No explicit profile field | No | Cohort events/telemetry | Profile-only | It controls data readiness/fail-closed timing. |
| Valuation method | `RevmaDiscoveryValuation.mqh` | `OrderCalcProfit` adverse Q/liquidation; `OrderCalcMargin`; close cost and historical swap frozen zero | Core economic valuation contract plus broker input | Yes | Profile shadow-cost proxy | No | Snapshot valuation IDs and values | Split method from observations | Method is formula contract; returned money is runtime/broker input; zero cost is a hidden assumption. |
| Fixed zero close cost | `RevmaDiscoveryValuation.mqh` | `compile_frozen_zero_v1` | Hidden or misclassified input | Yes | Yes: shadow-cost proxy | No | Snapshot method ID only | Correct later | It is economically material and currently not derived from commissions/spread/slippage/swap. |
| Fixed zero historical swap | `RevmaDiscoveryValuation.mqh` | `compile_frozen_zero_v1` | Hidden or misclassified input | Yes | Yes | No | Snapshot method ID only | Correct later | It affects longer holding economics and is not broker/runtime derived. |
| Lot sizing | `RevmaRealPortfolio.mqh`, execution boundary | Current R plan requires exact `0.01` atom; no general equity-scaled lot formula | Hidden or misclassified input | Exact-atom identity is named | Profile exact atom | Config fixed lots | Candidate/plan/fill receipts | Future normalization gate | Audit only; no lot-sizing change is authorized here. |
| Minimum viable equity | No complete current contract | Current behavior fails through budget/margin/liability/candidate invariants; no explicit threshold | Hidden or misclassified input | No standalone identity | No | No | Failure reason may be subsystem-specific | Future normalization gate | Must be derived from broker min/step/contract/margin/liability/cost/reservation/topology. |
| Runtime broker identity | `SymbolSpecCache.mqh`, `TickBarCache.mqh` | Symbol specs, ticks, spread, sessions, account currency | Broker/platform constraint | Not fully covered | Operator suffix only | Not in `LP_ConfigHash` | Partly in symbol/snapshot receipts | Add environment identity | The current formula hash cannot reproduce broker-dependent outcomes alone. |
| Dataset/cohort identity | `RevmaGridSleeve.mqh`, telemetry | Ordered FX28 source-M1 cohort plus snapshot/signal/strategy hashes | Explicit runtime formula input | Identity method named | No | No | Gate108 transition rows and completion | Add dataset identity layer | This is the point-in-time data input to a result. |
| Source bundle/build | `BuildInfo.mqh`, source-bundle tool | Canonical include closure and EA version | Safety/execution implementation cap | Included in discovery formula hash | No | `source_revision` in config hash | Run/mandatory/Gate108 receipts | Separate build identity | Build reproducibility must not imply formula economics. |

## Current hash coverage assessment

The existing identities are useful but not cleanly separated:

1. `LP_RevmaFormulaHash()` identifies the underlying Revma signal contract and
   pair-direction payload, but the pair-direction payload omits some constants
   used by the evaluator, including the reset/age controls and parts of the
   exhaustion weighting calculation.
2. `LP_RevmaDiscoveryProfileHash()` correctly covers many Gate108 choices,
   including FX28, complete symbols, Q/depth, atom, mesh, slippage, filling,
   calendar/news, caps, account currency/digits, and telemetry location. It
   does not cover every implementation cap or every broker observation.
3. `LP_RevmaDiscoveryFormulaHash()` currently absorbs the profile hash, source
   bundle, telemetry schema/buffers, execution containment, valuation method,
   and many evidence rules. It is therefore a broad Gate108 contract hash, not
   a pure economic formula hash.
4. `LP_ConfigHash()` covers operator/runtime configuration, but not actual
   account equity, account digits, broker volume/tick/margin contract, current
   prices, cost results, news-file contents, or the full symbol-spec set.
5. Snapshot and transition identities cover many point-in-time values after
   observation, but the ordinary run manifest does not provide a complete
   broker/environment identity.

The current hash design therefore proves build/profile continuity better than
it proves that the economic formula is independent of broker and telemetry
implementation details.

## Proposed identity hierarchy

```text
Revma formula ID/hash
  -> controlled research profile ID/hash
      -> broker/environment identity
          -> runtime input/config identity
              -> dataset/cohort identity
                  -> result/run identity
```

- Formula identity: signal, direction, geometry, candidate classification,
  admission, close authority, risk-budget transformation, and formulaic lot
  sizing.
- Profile identity: FX28, Q/depth, complete-cohort policy, test execution
  mode, calendar/news policy, telemetry/evidence policy, and bounded caps.
- Environment identity: broker, account currency/digits, symbol contract,
  volume/tick/margin/filling/session constraints, and valuation API behavior.
- Runtime identity: actual equity, prices/ticks, current Q/center/inventory,
  configuration, news/calendar observations, and prior state hashes.
- Dataset identity: ordered completed-M1 cohort and all snapshot/state hashes.
- Result identity: run ID, EA/build identity, outputs, receipts, and terminal
  reconciliation hashes.

## Future lot-sizing contract

No lot-sizing rule is selected or changed in this gate. The future contract
should explicitly map:

```text
(equity_reference,
 formula_budget,
 q_cash_or_adverse_distance,
 immediate_liquidation_liability,
 margin_per_volume,
 expected_costs,
 concentration_state,
 existing_reservations,
 broker_volume_min/max/step,
 required_topology)
    -> desired_volume -> broker-step quantized volume -> admission decision
```

The contract must distinguish the formula’s desired exposure from broker
quantization and must emit both the unquantized request and the accepted,
rejected, or insufficient-volume result. The current exact `0.01` atom policy
remains frozen for Gate108 evidence and is not a selected general lot-sizing
formula.

## Future minimum-equity contract

No final threshold is implemented here. The future contract should derive the
minimum equity for the smallest valid allocation from the broker minimum/step,
contract size, tick and margin requirements, immediate liquidation liability,
expected costs, formula budget fraction, reservation envelope, concentration,
and the required R/U/C topology at the point in time being evaluated.

Conceptually:

```text
E_min = minimum E_ref for which the smallest broker-valid formula allocation
        satisfies budget, reservation, margin, liability, cost, concentration,
        and required-topology invariants
```

The eventual explicit failure should be
`insufficient_equity_for_minimum_revma_allocation`. Until that contract is
frozen, the current implementation may fail through existing budget, margin,
liability, or branch-invariant reasons; those reasons must not be reclassified
as a successful no-candidate outcome.

## Version-bump triggers

### Formula version bump

- Signal/state interpretation, direction, birth eligibility, mesh meaning,
  adverse/favorable classification, center authority, local harvest, cleanup,
  hard-risk authority, budget transformation, or lot-sizing behavior changes.
- Any change to an economic invariant or the meaning of a persisted prior-state
  field changes the formula contract.

### Profile version bump

- FX28 topology, complete-cohort policy, Q profile/depth, calendar/news policy,
  test execution mode, slippage/filling policy, exact-atom experiment, or a
  bounded cap/evidence policy changes.

### Environment identity change

- Broker/account, account currency/digits, symbol suffix/specification, tick,
  volume, margin, leverage, filling availability, session, or valuation result
  changes.

### Ordinary new run only

- A new run ID, point-in-time cohort, current equity, current price/tick, or
  prior-state identity changes while the formula, profile, and environment
  contracts remain unchanged.

## Next normalization gate

Open a separate formula-normalization gate after Gate109 runtime diagnosis. That
gate should first split the current discovery formula hash into economic
formula, controlled profile, evidence/safety, and environment identities; then
complete broker/account-digits receipts and the derived minimum-equity/lot-size
contract. It must be reviewed before any tuning or promotion work.
