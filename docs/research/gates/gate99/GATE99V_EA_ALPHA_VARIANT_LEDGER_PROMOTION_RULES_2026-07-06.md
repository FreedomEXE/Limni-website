# Gate 99V - EA Alpha Variant Ledger And Promotion Rules

Date: 2026-07-06

## Scope

Gate 99V defines the lifecycle for future `LimniPortfolioEA` alpha variants
before any first strategy lane is implemented.

No MQL strategy code was changed. No q-state-machine strategy was added. No
strategy intent emission was enabled. No live-trading, open-routing,
close-execution, account-close, or promotion claim was added.

The goal is to prevent hundreds of research variants from becoming EA clutter.
Research variants must live in receipts, manifests, ledgers, and gate artifacts
until one is explicitly promoted into the runtime EA contract.

## Current Repo Baseline

Repo evidence before this gate:

```text
LimniPortfolioEA remains a thin shell around LP_Engine.
Engine flow remains LRMG snapshot -> StrategyRegistry -> IntentBus -> RiskArbiter -> TradeRouter.
Strategy lanes still emit zero intents.
LrmgState is still a placeholder and does not provide real q, anchor, stochastic, Katarakti, or MarketMode features.
RiskArbiter can approve valid future intents after validation and exposure checks.
Execution defaults remain disabled.
TradeRouter owns CTrade and remains the execution boundary.
LP_VariantId currently has only NONE / STRICT / LOOSE and is not a research-variant registry.
```

This means the skeleton is ready for controlled strategy work, but the alpha
variant lifecycle was missing before this gate.

## Variant Ledger Contract

Every tested strategy idea must have a ledger row before it can become runtime
code.

Required fields:

```text
variant_id
parent_variant_id
gate_id
status
lane
family
signal_semantics
market_mode_rule
entry_rule
grid_add_rule
exit_rule
harvest_interaction
risk_assumptions
test_window
data_lineage
command
artifact_path
result_hash
verdict
scrap_reason
promotion_eligibility
reviewer
updated_at
notes
```

Template:

- `docs/research/gates/gate99/artifacts/gate99v-ea-alpha-variant-ledger-promotion-rules-2026-07-06/alpha_variant_ledger_template.csv`

`variant_id` should be a stable slug, not a code enum. Example:

```text
g99w-qstate-v001
g99w-qstate-v001-hwm-softlock-a
g99x-katarakti-reclaim-v001
```

## Status Values

Allowed statuses:

```text
idea
defined
smoke_passed
failed
parked
contender
promoted
archived
```

Status meanings:

```text
idea
  Named idea only. It has no complete signal semantics and cannot be tested.

defined
  Exact signal, entry, add, exit, risk, and test-window semantics are written.
  It may be tested, but it is not a contender.

smoke_passed
  The variant passed a bounded mechanical smoke: runner/compile/test harness,
  lineage declaration, result hash, and no obvious receipt defect.

failed
  The variant is rejected for a recorded reason. It must not stay in the EA as
  disabled code or a hidden input.

parked
  The idea may be useful later but is not allowed into the current strategy
  lane. Parked variants need a reopen reason before more testing.

contender
  The variant has enough evidence to justify a promotion-review gate. It is
  still not runtime EA code.

promoted
  The variant passed a named promotion gate and has an approved runtime
  contract. Only this status can justify adding MQL strategy implementation.

archived
  The idea is closed for active work. It remains documented for anti-repetition
  and audit history.
```

## Scrap Reasons

Use a specific `scrap_reason` instead of vague "bad result" notes.

Accepted initial reason codes:

```text
duplicate
undefined_semantics
invalid_lineage
parity_fail
receipt_defect
no_edge
cost_failure
year_failure
leave_one_currency_failure
crisis_dependency
overfit_shape
heat_unbounded
currency_concentration
harvest_toxic
too_slow
runtime_unsafe
execution_contract_violation
too_complex_for_value
superseded
```

## Promotion Rules

A variant cannot be promoted unless all of these are true:

```text
The variant has exact written semantics.
The test window and data lineage are declared.
The result hash or MT5 receipt identity is recorded.
The command or tester setup is reproducible.
The verdict is explicit.
The variant is compared against the correct baseline or null control.
The currency exposure and portfolio heat behavior are visible.
The harvest interaction is visible or explicitly out of scope.
The strategy does not require live-trading switches to be enabled for proof.
The implementation path preserves Strategy -> Intent -> Risk -> Plan -> Router.
```

Promotion blockers:

```text
missing variant_id
missing result_hash or receipt identity
missing price_bundle_id for canonical price-derived research
sub-100% institutional M1 coverage without a named waiver
unreconciled parity failure
unbounded currency-token concentration
hidden terminal inventory or unresolved heat
one-year or one-currency dependency without an approved reason
strategy-specific CTrade usage outside TradeRouter
dead MQL branches, commented strategies, or unused inputs left in the EA
```

For MT5-only mechanical smoke gates where canonical price-bundle lineage does
not apply, the ledger must record the tester setup, Common Files receipt id,
compile proof, source hash, and exact broker/server context instead.

## Runtime EA Boundary

`LP_VariantId` is not the alpha research ledger.

The EA should not add one enum value per backtest variant. Hundreds of
variants belong in the ledger and artifacts. The runtime EA should only carry
small approved contracts, for example:

```text
lane: trend_follow / reversal / continuation / grid
runtime variant: strict / loose / approved named production variant
strategy_version_hash: exact promoted semantics
```

If a future promoted strategy needs richer runtime identity, open a separate
contract gate before expanding MQL types.

## Research-To-EA Flow

Required flow:

```text
1. Ledger row created with status=idea or defined.
2. Exact semantics written before testing.
3. Smoke or backtest result written with artifact path and hash.
4. Failed or parked rows are closed with reason codes.
5. Contender rows get a promotion-review gate.
6. Promoted rows get a runtime implementation gate.
7. Runtime EA receives only the promoted contract, not the whole variant tree.
```

## First System Boundary

The first q-state-machine strategy is not implemented in Gate 99V.

Recommended next gate:

```text
Gate 99W - first-q-state-machine-contract
```

Gate 99W should create the first real variant row, likely:

```text
variant_id = g99w-qstate-v001
status = defined
lane = trend_follow or explicit Freedom-approved lane
family = q_state_machine
```

Before any implementation, Gate 99W must define:

```text
LRMGFeatureSnapshot fields
MarketMode states and router permissions
signal inputs
entry condition
grid add condition
exit / harvest interaction
risk metadata
expected receipts
first smoke / backtest plan
promotion and failure criteria
```

## Deliberately Not Implemented

```text
first q strategy
MarketMode MQL implementation
LRMGFeatureSnapshot MQL implementation
Katarakti-to-EA wiring
strategy intent emission
grid add policy
grid exit policy
live readiness
promotion
```

## Verification

This is a documentation/control gate.

Verification performed:

```text
Gate 99U strategy-ready skeleton receipt reviewed.
Gate 99S non-strategy guard receipt reviewed.
Current Types.mqh reviewed for LP_VariantId limitations.
Current LrmgState.mqh reviewed as placeholder-only.
No MQL files changed.
```

## Next Action

Design Gate 99W only after Freedom approves the exact first system lane and
q-state-machine semantics.
