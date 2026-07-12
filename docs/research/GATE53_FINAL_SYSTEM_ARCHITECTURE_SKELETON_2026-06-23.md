# Gate 53 Final System Architecture Skeleton

Date: 2026-06-23

Status: ACCEPTED

## Purpose

Gate 53 pauses optimization and defines the target system skeleton before Limni
selects one system to automate.

This is not a strategy-performance gate. It is an architecture and stage-boundary
gate.

## Stage Boundary

Current project stage:

```txt
VERIFY THE DATA IS CORRECT
```

Limni is not yet ready for:

```txt
SELECTING 1 SYSTEM TO AUTOMATE
```

The reason is not that no paper configuration exists. The reason is that the
inputs that define the final system need cleaner institutional proof before the
repo can freeze one automatable stack.

## Architecture Decision

The trading system has five trading layers plus one source foundation:

```txt
0. Source Governance / Feature Contracts
1. Signal Model
2. Regime Layer
3. Execution Model
4. Portfolio / Risk Overlay
5. Live Parity Layer
```

Source Governance / Feature Contracts is a precondition layer, not a trading
alpha layer. It does not create signals. It certifies whether a feature is
eligible to be consumed by a signal, regime filter, execution rule, or risk
overlay.

## Layer 0: Source Governance / Feature Contracts

This layer answers:

```txt
Can the input be reconstructed, hashed, joined point-in-time, and consumed
without source ambiguity?
```

Required proof shape:

- source endpoint and authority locked
- raw artifact or as-of retrieval path preserved
- parser and normalization versioned
- availability and exception-calendar handling explicit
- weekly freeze semantics defined
- source rows hashed
- weekly snapshots hashed
- rebuild or replay proof scoped honestly
- promotion/consumption status explicit

Current source readiness:

| Source / Family | Current Role | Current Status | Gate 53 Classification |
| --- | --- | --- | --- |
| RRP | Macro context source | Strongest governed macro candidate; Gate 51 rejected broad directional confirmation and retained RRP as context-quality / anti-crowding annotation | Governed diagnostic/context candidate; not a live or production claim |
| BPR | Macro context source | Gate 52/52A proves mechanical path and fail-closed ambiguity control; 2025-10-07 and 2025-11-04 remain source ambiguous and quarantined | Source governance in progress; clean-window candidate only |
| COT | Signal source | Legacy source used in paper configurations | Requires source hardening before final signal freeze |
| COT lifecycle | Signal/context source | Useful but not yet institutionalized as a final source contract | Requires source hardening before final signal freeze |
| Strength / SFA | Signal source | Candidate diagnostic from prior work | Requires source hardening and frozen-output parity before final signal freeze |
| Price / ADR / matrix bars | Execution and baseline support | Existing app/research path needs parity hardening | Requires data/parity hardening before execution freeze |
| ADR Grid | Execution model | Useful paper execution path; app-vs-research trust still must be proven | Execution parity pending |
| Weekly Hold | Execution model | Simple baseline; likely too crude for final execution but useful as benchmark | Redesign/parity later, not now |
| Pair fill cap | Legacy risk overlay | Existing overlay, not assumed durable | Must prove risk-adjusted value or be replaced |
| Currency balance / correlation overlay | Future portfolio overlay | Proposed direction-neutral basket construction layer | Future test after source and signal freeze |
| PPP / NEER / REER / valuation | Future macro regime sources | Frozen out of current gate | Not opened |

## Layer 1: Signal Model

The Signal Model is the base directional engine.

It answers:

```txt
For each of the 28 FX pairs this week, what side does the core model want?
```

Signal Model contract:

- produces broad weekly directional decisions
- stays as close to 28 pair decisions per week as practical
- proves standalone directional value before macro filters, execution tuning, or
  portfolio overlays make it look better
- uses only signal-approved inputs
- does not contain macro regime logic
- does not contain execution logic
- does not contain portfolio/risk selection logic

Likely candidate family:

```txt
COT / COT lifecycle / Strength
```

The exact candidate is not selected in Gate 53.

Before selection, Gate 54 must harden the source and output path for:

- COT
- COT lifecycle
- Strength / SFA
- the frozen 7-year matrix context
- trade-side output hashing or reproducible side manifests

## Layer 2: Regime Layer

The Regime Layer is the macro/context layer after the Signal Model.

It answers:

```txt
Given the base signal, should macro context allow, block, deweight, warn on, or
ignore this trade?
```

Allowed outputs:

- allow
- block
- deweight
- risk warning
- neutral / no opinion
- annotation only

Forbidden assumption:

```txt
Macro agreement automatically confirms direction.
```

Gate 51 proved that RRP should not be treated as broad directional confirmation.
It may be useful as context quality, anti-crowding, or obvious-confirmation risk.

BPR must not be consumed while source-ambiguous rows are treated as available.
Any future BPR regime use must either:

- exclude/quarantine the 2025 lapse rows, or
- prove exact publication timing from authoritative evidence.

## Layer 3: Execution Model

The Execution Model is entry, management, and exit quality.

It answers:

```txt
How do we enter, manage, and exit the approved directional basket?
```

Execution owns:

- ADR Grid
- Weekly Hold benchmark
- entry timing
- exit timing
- stops
- take profit
- runners
- re-entry
- holding windows
- costs, spread, swap, and slippage assumptions

Execution must not decide direction. It can improve trade quality only after the
Signal Model has produced an approved directional basket.

Gate 53 does not optimize execution.

## Layer 4: Portfolio / Risk Overlay

The Portfolio / Risk Overlay shapes the approved basket without inventing alpha.

It answers:

```txt
Given approved trades, how do we size/select them so the basket is not
accidentally overexposed?
```

Portfolio / risk candidates:

- currency net exposure balance
- long/short currency neutrality
- pair concentration caps
- currency concentration caps
- correlation caps
- volatility scaling
- max weekly basket risk
- drawdown throttle
- legacy pair fill cap

The goal is smoother equity, lower drawdown, and cleaner exposure. It is not a
directional filter.

## Layer 5: Live Parity Layer

The Live Parity Layer proves the automated bot trades what the research says.

It answers:

```txt
Does research output equal MT5 backtest, forward shadow, and live execution?
```

Required proof:

- same weekly basket
- same pair side
- same entry timestamp contract
- same exit timestamp contract
- same broker symbol mapping
- same spread, swap, cost, and slippage assumptions
- same position sizing
- same fill rules
- same PnL accounting
- same closed-trade ledger
- same weekly decision hash

The MT5 bot is not merely an implementation task. It is a verification boundary.

## Profit-Factor Policy

Profit factor `2-3` is an ambition, not a sufficient proof.

Any final system review must evaluate profit factor with:

- trade count
- active weeks
- return / drawdown
- max drawdown
- worst year
- year stability
- pair and currency concentration
- cost, spread, swap, and slippage assumptions
- out-of-sample or forward shadow parity
- live parity with the MT5 bot

A high profit factor from a tiny filtered sample is not institutional proof.

## One-System Policy

The project does not need many final configurations.

The project needs one configuration that:

- is source-governed
- is reproducible
- is broad enough not to be over-filtered
- has one selected Signal Model
- has one explicitly versioned Regime Layer policy
- has one execution contract
- has one portfolio/risk contract
- can be reproduced in MT5
- can be shadowed before live funds

## Recommended Gate Sequence

```txt
Gate 52: BPR source governance only - completed as fail-closed/quarantined
Gate 53: Final System Architecture Skeleton - current
Gate 54: Legacy Baseline Source Hardening
Gate 55: Select One Base Signal Model Candidate
Gate 56: Regime Layer Integration With Governed Sources Only
Gate 57: Execution Model Selection And Parity
Gate 58: Portfolio / Risk Overlay Tests
Gate 59: Single Final System Freeze
Gate 60: MT5 Bot Parity / Backtest
```

## Gate 54 Handoff

Gate 54 should not start by optimizing strategies.

Gate 54 first question:

```txt
Can we trust the legacy COT + Strength + ADR matrix enough to select one Signal
Model candidate for automation?
```

Gate 54 initial scope:

- COT source path
- COT source lineage and point-in-time availability
- COT lifecycle source path
- COT lifecycle / CLP contract and rebuild parity
- Strength / SFA source path
- Friday strength / open strength contract definitions
- Strength source snapshots and timing
- ADR / price / bar inputs used by the matrix
- frozen 7-year matrix week set
- Gate 44 seven-year matrix reconstruction identity
- pair-week contribution / trade-event attribution integrity
- side-output hash or reproducible side manifest
- selector output hashes for candidate baseline models
- baseline parity against canonical app paths

Gate 54 required receipts should be shaped around:

- `gate54-legacy-source-inventory`
- `gate54-cot-source-contract-proof`
- `gate54-strength-source-contract-proof`
- `gate54-adr-price-matrix-proof`
- `gate54-selector-output-rebuild-proof`
- `gate54-legacy-baseline-evidence-boundary`
- `gate54-system-selection-readiness-summary`

Gate 54 must not answer:

```txt
Which system is best?
```

It should answer whether the legacy baseline data and selector outputs are
reliable enough to support a later system-selection gate.

## Frozen Areas

Still unauthorized:

- strategy optimization
- outcome grids
- BPR attribution
- persisted BPR dataset
- BPR alpha claim
- combined macro regime
- PPP / NEER / REER / valuation work
- live, production, or promotion claims
- MT5 bot build
- source refetch/rebuild outside the next explicitly scoped source-hardening gate
- RRP retesting
- BPR optimization
- new strategy combinations
- new execution rules
- risk overlay optimization

## Gate 53 Decision

```txt
Architecture skeleton accepted.
Project stage remains VERIFY THE DATA IS CORRECT.
Next implementation gate should be Gate 54: Legacy Baseline Source Hardening.
System selection is not yet authorized.
Optimization is paused except for source/contract validation.
```
