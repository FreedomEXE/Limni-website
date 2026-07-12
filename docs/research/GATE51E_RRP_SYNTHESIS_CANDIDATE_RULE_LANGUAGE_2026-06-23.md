# Gate 51E RRP Synthesis Candidate Rule Language

Date: 2026-06-23

## Gate

Gate 51E: synthesis-candidate-rule-language.

Status: synthesis-only.

Purpose: translate the locked Gate 51 RRP diagnostics into candidate rule
language for later review. This gate does not run new tests and does not define
a production rule.

## Evidence Inputs

Gate 51D lock commit:
`5b9657e Gate 51D: preserve RRP decomposition diagnostic lock`

Gate 51D diagnostic lock package:
`docs/research/GATE51D_RRP_DECOMPOSITION_DIAGNOSTIC_LOCK_2026-06-23.md`

Gate 51D package hash:
`FD9A6F2C42AB47DB282C724B9CD35789897F194C79CF527774EC4AFBFBEB741F`

Gate 51D full diagnostic receipt hash:
`ced6c57e87540ae2657006438c3b0f8ad22ab66ca05fc0ccad2451e2dc13c027`

Gate 51D variant/decomposition grid hash:
`b34956db176285ed6ceecf7006f58cc77a3581cc0b5bdb23a077a3a5e2615415`

Gate 51C selector lockdown receipt hash:
`bd438c8d003ca01193943d4c05dc68b1dc8c44c553e96be04e0a9d43d4ec9418`

Gate 50 source-content invariant:
`fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391`

Gate 50 final ACTIVE join hash:
`08723c62e089eddab7cde243a64283c9dd6bc0ebee01a070cfb32e4cb27fdbc7`

This package is authored from existing Gate 51 evidence. It does not invoke any
verification runner.

## Locked Selectors

| Label | Selector ID | Gate 51E role |
|---|---|---|
| CLP | `cot_lifecycle_polarity_v0_noncomm_primary` | Locked COT research candidate, CLP-valid-window only |
| SFA | `strength_friday_snapshot_open_canonical_fade_agree` | Locked Strength diagnostic candidate |
| FSA | `strength_friday_snapshot_selected` | Simple benchmark only |

FSA remains a benchmark. It is not a second optimized Strength selector.

## Frozen Areas

- No Gate 50 source refetch or rebuild.
- No CPI, rate, or RRP materialization changes.
- No lifecycle, activation, or promotion-control changes.
- No COT Faces expansion.
- No Dealer/Commercial expansion.
- No Strength open-only or new Strength composite expansion.
- No BPR, PPP, NEER, REER, valuation, or combined macro-regime work.
- No live, production, or promotion claim.
- No threshold tuning.
- No new decomposition grid.

## Locked Research Read

The broad RRP confirmation thesis is rejected.

RRP should not be described as:

```txt
Higher real-rate pressure confirms the selected trade direction.
```

RRP should be described as:

```txt
A diagnostic for context quality, anti-crowding, and adverse obvious-confirmation
conditions inside the locked selector harness.
```

The repeated pattern across CLP, SFA, and FSA is:

- `neutral` / `weak` outperforms `supportive` / `confirm`.
- `middle_half` or non-extreme rank zones are cleaner than blindly high RRP
  percentile.
- `selected_rank_disadvantage` often outperforms `selected_rank_advantage`.

## Candidate RRP Context Labels

These labels are language for later review. They are not a production enum and
not a tested executable policy.

| Candidate label | Diagnostic meaning | Evidence basis |
|---|---|---|
| `rrp_context_neutral_weak` | RRP is not obviously confirming the selected side and may mark a cleaner context | CLP/FSA best cells; SFA positive cell |
| `rrp_context_middle_rank` | Selected side is in a non-extreme RRP rank zone | SFA and FSA `middle_half` strength |
| `rrp_context_rank_disadvantage` | Selected side lacks obvious RRP rank advantage, which may reduce crowding risk | SFA/FSA rank-disadvantage strength |
| `rrp_context_obvious_confirm_risk` | RRP appears to support the selected side too directly and may mark crowding or fragility | CLP/SFA/FSA supportive-confirm weakness |
| `rrp_context_high_rank_risk` | High percentile RRP is not automatically favorable and is weak or negative in SFA/FSA | SFA/FSA `top_quartile` weakness |
| `rrp_context_unavailable` | Required context is unavailable and must not be neutralized | CLP warmup/unavailable policy |

## Candidate Rule Language

The next reviewed rule should be phrased as annotation language, not execution
logic:

```txt
For locked CLP and SFA selector decisions, use RRP decomposition only as a
context-quality annotation. Do not add directional confidence merely because RRP
supports the selected side.
```

Positive candidate language:

```txt
If RRP context is neutral/weak, middle-rank, or selected-rank-disadvantaged, tag
the decision as a potentially cleaner context for review.
```

Negative candidate language:

```txt
If RRP context is supportive/confirm, selected-rank-advantaged, or blindly
top-quartile, tag the decision as an obvious-confirmation risk. This is a
candidate adverse-context flag, not a reason to increase confidence.
```

Unavailable candidate language:

```txt
If CLP lifecycle state is unavailable, do not compute or impute the CLP/RRP
context. Mark the row unavailable, not neutral.
```

## Selector-Specific Synthesis

### CLP

Use only inside the CLP-valid window. The Gate 51D denominator impact was
`41.7344%`, so CLP is not full-window unconditional evidence.

Candidate language:

```txt
For CLP-valid rows, RRP neutral/weak context is favorable as a diagnostic
quality tag. RRP supportive/confirm context is adverse or cautionary. CLP
top-quartile RRP is secondary only because the cell carried USD concentration.
```

Do not compare CLP directly to SFA or FSA without the valid-window caveat.

### SFA

SFA is the practical Strength diagnostic candidate.

Candidate language:

```txt
For SFA rows, prefer relative RRP context language over raw directional
confirmation. Middle-rank and selected-rank-disadvantaged contexts are cleaner.
Supportive/confirm, selected-rank-advantaged, and top-quartile contexts are
cautionary.
```

### FSA

FSA remains a simple benchmark.

Candidate language:

```txt
Use FSA only to check whether the RRP context-quality pattern also appears
against the simple Friday Strength anchor. Do not optimize or promote FSA from
Gate 51E.
```

## Candidate Review Questions

The next implementation or review gate should answer these before any executable
rule is written:

1. Should `neutral/weak`, `middle_half`, and `selected_rank_disadvantage` be one
   combined context-quality label or separate annotations?
2. Should `supportive/confirm`, `selected_rank_advantage`, and `top_quartile`
   be one adverse obvious-confirmation label or separate warnings?
3. Should CLP and SFA use the same RRP labels, or should CLP-valid-window logic
   remain separately annotated?
4. Should FSA stay only as a benchmark in reports, or become a standing
   validation view for future selector reviews?
5. What minimum year/pair/currency concentration standard is required before any
   context-quality label can become executable?

## Non-Claims

Gate 51E does not prove a strategy rule.

Gate 51E does not prove that RRP improves live performance.

Gate 51E does not authorize production, promotion, or combined macro-regime
logic.

Gate 51E does not authorize more RRP optimization.

Gate 51E does not authorize BPR source work. BPR remains a separate Gate 52
candidate.

## Recommended Next Gate

Gate 51E should be reviewed as a synthesis package. If accepted, the next
decision is one of:

- Gate 51F: write a predeclared no-new-grid candidate annotation spec.
- Gate 52: begin BPR source-governance and standalone attribution.

Do not run either gate until Gate 51E is accepted or revised.
