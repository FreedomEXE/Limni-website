# Gate 51F RRP Context Annotation Spec

Date: 2026-06-23

## Gate

Gate 51F: no-new-grid-rrp-context-annotation-spec.

Status: predeclared annotation spec only.

Purpose: freeze the language and boundary for RRP context-quality annotations
before any later implementation gate. This spec does not run new tests, add
thresholds, expand selectors, or promote a strategy.

## Evidence Inputs

Gate 51D lock commit:
`5b9657e Gate 51D: preserve RRP decomposition diagnostic lock`

Gate 51E synthesis commit:
`d3e8695 Gate 51: add RRP diagnostic runners and synthesis`

Gate 51D lock package:
`docs/research/GATE51D_RRP_DECOMPOSITION_DIAGNOSTIC_LOCK_2026-06-23.md`

Gate 51E synthesis package:
`docs/research/GATE51E_RRP_SYNTHESIS_CANDIDATE_RULE_LANGUAGE_2026-06-23.md`

Gate 51D package hash:
`FD9A6F2C42AB47DB282C724B9CD35789897F194C79CF527774EC4AFBFBEB741F`

Gate 51E package hash:
`30905C68D739CEA928958639A48F9FF4E11D4604FF1A581BDE5B01FA5C69DDC1`

Gate 51D full diagnostic receipt hash:
`ced6c57e87540ae2657006438c3b0f8ad22ab66ca05fc0ccad2451e2dc13c027`

Gate 51D variant/decomposition grid hash:
`b34956db176285ed6ceecf7006f58cc77a3581cc0b5bdb23a077a3a5e2615415`

Gate 51C selector lockdown receipt hash:
`bd438c8d003ca01193943d4c05dc68b1dc8c44c553e96be04e0a9d43d4ec9418`

This document is derived from locked Gate 51 evidence only.

## Locked Interpretation

The broad RRP confirmation thesis is rejected.

Forbidden interpretation:

```txt
RRP confirms the selected direction, therefore confidence should increase.
```

Allowed interpretation:

```txt
RRP can annotate context quality, crowdedness risk, and obvious-confirmation
risk inside the locked CLP/SFA selector harness and FSA benchmark view.
```

The annotation vocabulary must preserve the Gate 51 lesson:

- `neutral` / `weak` RRP contexts were the cleanest repeated cells.
- `supportive` / `confirm` RRP contexts were weak or adverse.
- `middle_half` or non-extreme rank zones were cleaner than blindly high RRP
  percentile.
- `selected_rank_disadvantage` often beat `selected_rank_advantage`.

## Locked Selectors And Consumers

| Consumer | Selector ID | Allowed use |
|---|---|---|
| CLP | `cot_lifecycle_polarity_v0_noncomm_primary` | May consume RRP annotations only inside CLP-valid rows |
| SFA | `strength_friday_snapshot_open_canonical_fade_agree` | May consume RRP annotations as a diagnostic context layer |
| FSA | `strength_friday_snapshot_selected` | Benchmark/reporting view only |

CLP unavailable rows must remain unavailable. They must not be neutralized or
imputed.

FSA must not become an optimized selector through this spec.

## Annotation Set

These labels are predeclared annotation language. They are not executable
strategy states until a later accepted implementation gate.

| Annotation | Meaning | Primary diagnostic basis | Polarity |
|---|---|---|---|
| `rrp_context_clean_neutral_weak` | Selected side is not obviously RRP-confirmed; context may be cleaner | CLP/FSA neutral-weak best cells; SFA positive neutral cell | favorable diagnostic |
| `rrp_context_clean_middle_rank` | Selected side is in a non-extreme RRP rank zone | SFA/FSA `middle_half` strength | favorable diagnostic |
| `rrp_context_clean_rank_disadvantage` | Selected side lacks obvious RRP rank advantage; may reduce crowdedness | SFA/FSA selected-rank-disadvantage strength | favorable diagnostic |
| `rrp_context_risk_obvious_confirm` | RRP appears to directly support selected side; may mark crowding or fragility | CLP/SFA/FSA supportive-confirm weakness | adverse diagnostic |
| `rrp_context_risk_high_rank` | Selected side has high RRP percentile; not automatically favorable | SFA/FSA top-quartile weakness | adverse diagnostic |
| `rrp_context_risk_rank_advantage` | Selected side has obvious rank advantage; underperformed disadvantage cells | SFA/FSA selected-rank-advantage weakness | adverse diagnostic |
| `rrp_context_unavailable` | Required lifecycle/RRP context is unavailable | CLP warmup/unavailable policy | unavailable |

## Mapping Rules

The mapping is intentionally descriptive, not optimized.

| Source condition | Annotation |
|---|---|
| `confirm_fade_weak = weak` or RRP mask is `neutral` | `rrp_context_clean_neutral_weak` |
| RRP rank bucket is `middle_half` | `rrp_context_clean_middle_rank` |
| Spread/rank bucket is `selected_rank_disadvantage` | `rrp_context_clean_rank_disadvantage` |
| `confirm_fade_weak = confirm` or RRP mask is `supportive` | `rrp_context_risk_obvious_confirm` |
| RRP rank bucket is `top_quartile` | `rrp_context_risk_high_rank` |
| Spread/rank bucket is `selected_rank_advantage` | `rrp_context_risk_rank_advantage` |
| Required CLP lifecycle state is warmup, missing, or unavailable | `rrp_context_unavailable` |

Multiple annotations may apply to a row. Gate 51F does not collapse them into a
single score.

## Consumption Rules

### CLP

CLP may consume annotations only after lifecycle availability is valid.

Allowed CLP statement:

```txt
Within the CLP-valid window, RRP context annotations may identify cleaner or
more fragile contexts for later review.
```

Forbidden CLP statement:

```txt
CLP plus RRP confirmation is a promoted COT/RRP rule.
```

### SFA

SFA may consume annotations as a diagnostic context layer.

Allowed SFA statement:

```txt
For SFA decisions, RRP middle-rank, neutral/weak, and rank-disadvantaged
annotations may be cleaner contexts, while obvious-confirmation annotations are
cautionary.
```

Forbidden SFA statement:

```txt
RRP confirmation improves SFA directional confidence.
```

### FSA

FSA may only display benchmark alignment against the same annotation set.

Allowed FSA statement:

```txt
FSA benchmark behavior supports or challenges whether the annotation pattern is
visible in a simple Friday Strength anchor.
```

Forbidden FSA statement:

```txt
FSA is promoted or selected because it agrees with the RRP annotation pattern.
```

## Report Requirements For Any Later Implementation

Any later annotation implementation must report:

- Selector role: CLP, SFA, or FSA benchmark.
- Whether the row is CLP-valid-window or unavailable.
- All matching annotations, not only the favorable one.
- Zero-fill flag if the row depends on zero-filled pair contribution data.
- Year, pair, and currency concentration summaries before any interpretation.
- A clear `diagnosticOnly` flag unless a later promotion gate explicitly changes
  status.

## Forbidden Gate 51F Outputs

Gate 51F does not authorize:

- New thresholds.
- New decomposition axes.
- New performance runs.
- New outcome grids.
- Selector expansion.
- COT Faces expansion.
- Dealer/Commercial expansion.
- Strength open-only or new Strength composites.
- BPR, PPP, NEER, REER, valuation, or combined macro-regime work.
- Live, production, or promotion claims.
- Any rule that increases trade confidence because RRP confirms the selected
  side.

## Closeout Position

Gate 51F closes the RRP interpretation arc as annotation language only.

Locked Gate 51 interpretation:

```txt
RRP is useful as a decomposition and diagnostic signal.
RRP is not useful as a simple confirmation signal in this harness.
RRP likely marks context quality and obvious-confirmation risk, not trade
direction.
```

After Gate 51F review, the next source-family gate can begin:

```txt
Gate 52: BPR source-governance and standalone attribution.
```
