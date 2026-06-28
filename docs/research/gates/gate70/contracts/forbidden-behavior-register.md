# Gate 70 Forbidden Behavior Register

Date: `2026-06-28`

This register applies to later exit research, risk research, portfolio expression research, and any future execution bridge consuming the locked Candidate B Brain ledger.

## Immutable Signal Truth

- Candidate B forced-28 ledger hash: `5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390`
- Candidate C shadow/canary ledger hash: `DF4170736BC34CF95F616F8888849F018BB33A78EAEACC910E1E4C56B1408720`
- Gate 68 frozen capsule ID: `gate68c_frozen_reference_capsule_C8DC7E99DE640C2D`
- Gate 68 frozen capsule SHA: `C8DC7E99DE640C2DEA0817C0F48F604575D4FB5CCBC9A9C787261FB4E63073A3`

## Forbidden For Exits

Exit research must not:

- change Candidate B direction
- exclude pair-weeks from signal truth
- silently drop bad weeks
- use future price movement to decide entry eligibility
- use future weekly outcome to choose an exit rule
- become a hidden second signal model
- modify source atoms or Brain rules
- retune Candidate B
- promote Candidate C
- introduce Candidate E
- retest rejected Candidate D
- start live/MT5/app/runtime work in Gate 70

## Forbidden For Risk

Risk research must not:

- change Candidate B direction
- exclude pair-weeks from signal truth
- silently drop bad weeks
- become a hidden second direction model
- use future price movement to decide entry eligibility
- use future weekly outcome to choose expression or basket inclusion
- apply pair-specific curve fitting without a formal versioned gate
- apply regime-specific curve fitting without a formal versioned gate
- use data-mined stop/take-profit values without out-of-sample discipline
- modify source atoms or Brain rules
- retune Candidate B
- promote Candidate C
- introduce Candidate E
- retest rejected Candidate D
- start live/MT5/app/runtime work in Gate 70

## Forbidden For Both Exits And Risk

- No source mutation.
- No COT, Strength, Regime, BPR, valuation_gap, or atom-policy change.
- No hidden pair/date exclusions.
- No outcome leakage.
- No Alpha v2 promotion.
- No final algorithm candidate.
- No direction research reopened.
- No exit matrix in Gate 70.
- No risk matrix in Gate 70.
- No portfolio pruning in Gate 70.
- No P&L attribution in Gate 70.

## Allowed Later With Explicit Gate

Only a later explicit gate may test:

- global exit baselines
- predeclared small stop/take-profit sets
- account reset behavior
- no-re-entry behavior
- deterministic re-entry behavior
- risk expression pruning
- basket/correlation exposure limits
- fair-value/price-location expression screens

Any such gate must preserve Candidate B directional truth.
