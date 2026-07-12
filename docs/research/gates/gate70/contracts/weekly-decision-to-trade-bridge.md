# Gate 70 Weekly Decision-To-Trade Bridge

Date: `2026-06-28`

## Purpose

This bridge defines how the locked Candidate B weekly forced-28 Brain ledger becomes tradable candidates without mutating signal truth.

Candidate B signal identity:

- Candidate B ledger hash: `5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390`
- Signal source gate: `Gate 69 locked Candidate B forced-28 ledger`
- Gate 68 frozen capsule ID: `gate68c_frozen_reference_capsule_C8DC7E99DE640C2D`
- Gate 68 frozen capsule SHA: `C8DC7E99DE640C2DEA0817C0F48F604575D4FB5CCBC9A9C787261FB4E63073A3`

## Row Types

### 1. Signal Row

The signal row is the immutable Candidate B Brain output row.

Required properties:

- week identifier
- pair
- Candidate B direction
- signal ledger hash
- signal source gate
- forced-28 row identity if available
- deterministic decision hash if available

Rules:

- Preserve all 28 rows per week.
- Do not drop, relabel, reweight, recompute, or exclude signal rows.
- A signal row is never deleted because later exit/risk work chooses not to trade it.

### 2. Tradable Candidate Row

The tradable candidate row is derived from a signal row when later research needs a trade-lifecycle object.

Required properties:

- signal row reference
- week identifier
- pair
- Candidate B direction
- proposed entry timestamp candidate
- entry price source
- allowed price/path data identity
- spread/slippage assumptions if present
- exit rule version if attached
- risk prefilter state if present

Rules:

- This row can add lifecycle metadata.
- This row cannot change Candidate B direction.
- This row cannot hide the source signal row.

### 3. Expressed Trade Row

The expressed trade row is a later risk-approved expression of a tradable candidate.

Required properties:

- signal row reference
- tradable candidate row reference
- expression decision
- size multiplier or risk allocation if applicable
- portfolio/basket state
- correlation/exposure state if applicable
- reset state if applicable
- deterministic run ID
- config hash

Rules:

- Risk can express, skip, delay, reduce, or basket-limit.
- Risk cannot rewrite the Brain direction.
- Risk skip/delay/reduce outcomes must still produce auditable rows.

### 4. Skipped / Delayed / Reduced Risk Row

A skipped, delayed, or reduced risk row is not a deletion. It is a risk expression outcome.

Required properties:

- signal row reference
- tradable candidate row reference if available
- Candidate B direction
- expression decision
- reason code
- portfolio/basket state if applicable
- input ledger hash
- output ledger hash

Rules:

- Every skipped/delayed/reduced row must preserve the source Candidate B row.
- No hidden pair/date exclusion is allowed.
- A risk row cannot become a second directional model.

### 5. Closed Trade Outcome Row

The closed trade outcome row records lifecycle results after an entry/exit path exists.

Required properties:

- signal row reference
- tradable candidate row reference
- risk expression row reference if applicable
- entry timestamp
- entry price
- exit timestamp
- exit price
- exit rule used
- stop rule used
- take-profit rule used
- trailing rule used if any
- account reset behavior if any
- re-entry behavior if any
- result/PnL
- drawdown/adverse excursion if available
- favorable excursion if available
- deterministic run ID
- config hash
- input ledger hash
- output ledger hash

Rules:

- Closed outcomes are outcome evidence only.
- Closed outcomes cannot retroactively change entry eligibility, direction, or signal truth.
- Exit/risk outcomes must remain linked to the exact Candidate B signal row.
