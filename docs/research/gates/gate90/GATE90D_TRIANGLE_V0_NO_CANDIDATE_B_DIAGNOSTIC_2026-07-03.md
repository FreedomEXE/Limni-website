# Gate 90D Triangle v0 No-Candidate-B Diagnostic

Generated: 2026-07-03

## Verdict

`FAIL_GATE90D_CANDIDATE_B_REMOVAL_DOES_NOT_FIX_TRIANGLE_V0_RESEARCH_ONLY`

Removing Candidate B from Triangle v0 does not solve the failure.

The no-Candidate-B variant keeps the same completed session range,
sweep/rejection/displacement trigger, point-in-time harvestable geometry, and
adaptive spacing. It removes Candidate B from the direction formula and requires
David-only side agreement.

## Scope

Same old-window comparisons as the Gate 90D Triangle v0 2026 / 2019 comparison:

- 2026 window: `2025-12-08..2026-05-31`, all 28 pairs, OHLC high/low,
  ADR-event `0.025`, David MA `25`, baseline spacing `0.10`, NY daily window,
  MA-reversion target, adverse-only adds.
- 2019 window: `2019-04-14..2019-12-30`, all 28 pairs, close-mode,
  ADR-event `0.075`, David MA `50`, baseline spacing `0.20`, NY daily window,
  MA-reversion target, adverse-only adds.

Rules:

- `triangle_v0`
- `triangle_v0_no_candidate_b`
- `candidate_b`
- `david_contra`

Percent metrics use starting balance as denominator. Close cycles are the
primary trade-stat unit; fills are individual grid entries.

## Results

### 2026 Fast-Decision Window

| Rule | Return % | Max DD % | Return/DD | Fills | Close cycles | Wins | Losses | Win % | PF | Expectancy / cycle % | Expectancy / fill % | Avg win % | Avg loss % | Flatten drag % | Max open | Max depth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `triangle_v0` | `2.16` | `-0.29` | `7.414` | `371` | `283` | `262` | `21` | `92.58` | `5.511` | `0.0076` | `0.0058` | `0.0101` | `-0.0228` | `-0.47` | `10` | `9` |
| `triangle_v0_no_candidate_b` | `2.19` | `-0.28` | `7.709` | `437` | `341` | `305` | `36` | `89.44` | `4.866` | `0.0064` | `0.0050` | `0.0090` | `-0.0157` | `-0.52` | `10` | `9` |
| `candidate_b` | `76.15` | `-0.88` | `86.939` | `41,897` | `25,084` | `22,210` | `2,874` | `88.54` | `2.292` | `0.0030` | `0.0018` | `0.0061` | `-0.0205` | `-53.35` | `99` | `25` |
| `david_contra` | `95.56` | `-0.62` | `154.906` | `46,995` | `27,539` | `24,458` | `3,081` | `88.81` | `2.545` | `0.0035` | `0.0020` | `0.0064` | `-0.0201` | `-54.48` | `95` | `25` |

### 2019 Close-Mode Window

| Rule | Return % | Max DD % | Return/DD | Fills | Close cycles | Wins | Losses | Win % | PF | Expectancy / cycle % | Expectancy / fill % | Avg win % | Avg loss % | Flatten drag % | Max open | Max depth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `triangle_v0` | `-0.61` | `-2.81` | `-0.218` | `816` | `474` | `354` | `120` | `74.68` | `0.905` | `-0.0013` | `-0.0008` | `0.0165` | `-0.0538` | `-5.82` | `16` | `12` |
| `triangle_v0_no_candidate_b` | `-0.74` | `-2.26` | `-0.330` | `667` | `396` | `299` | `97` | `75.51` | `0.865` | `-0.0019` | `-0.0011` | `0.0159` | `-0.0568` | `-5.03` | `14` | `10` |
| `candidate_b` | `17.01` | `-7.70` | `2.210` | `21,960` | `12,783` | `10,759` | `2,024` | `84.17` | `1.158` | `0.0013` | `0.0008` | `0.0116` | `-0.0531` | `-100.70` | `90` | `14` |
| `david_contra` | `8.81` | `-11.47` | `0.768` | `23,415` | `13,316` | `11,137` | `2,179` | `83.64` | `1.071` | `0.0007` | `0.0004` | `0.0120` | `-0.0573` | `-117.82` | `142` | `21` |

## Read

Candidate B is not the reason Triangle v0 failed.

Removing Candidate B:

- barely changed the 2026 return: `2.16%` to `2.19%`;
- increased 2026 activity: `371` fills to `437` fills;
- lowered 2026 PF: `5.511` to `4.866`;
- worsened the 2019 return: `-0.61%` to `-0.74%`;
- worsened 2019 PF: `0.905` to `0.865`.

The bottleneck is not Candidate B contamination. The bottleneck is that strict
Triangle v0 is too narrow as an entry trigger and is not capturing enough of the
old harvestable edge.

## Proposal Summary

Current Triangle v0 should be treated as a precision/lockout component, not the
final entry formula.

The next design should split the system into three explicit parts:

1. Directional Algo: Candidate B, David/inverted-David, and any future direction
   evidence should become transparent formula terms, not a menu of static
   variants.
2. Grid Geometry: decide whether the session/pair is harvestable using ADR,
   range condition, path efficiency, MA distance, fill pressure, and
   session-flatten drag.
3. Handshake/Trigger: decide when to start after the geometry says the market is
   harvestable. Strict Katarakti sweep/rejection/displacement should be only one
   trigger candidate.

For v1, compare these start modes inside valid geometry:

- strict Katarakti sweep/rejection/displacement;
- relaxed sweep/rejection without displacement;
- first mean-extension touch after a valid harvestable session box;
- Candidate B / David direction starts gated by valid session geometry.

## Artifacts

- 2026 no-Candidate-B comparison:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v0-no-candidate-compare-2026-26w-adr0025-ma25-s1/GATE90D_TRIANGLE_V0_NO_CANDIDATE_COMPARE_2026_26W_ADR0025_MA25_S1.md`
- 2019 no-Candidate-B comparison:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v0-no-candidate-compare-2019-close-adr0075-ma50-s2/GATE90D_TRIANGLE_V0_NO_CANDIDATE_COMPARE_2019_CLOSE_ADR0075_MA50_S2.md`

## Stop Line

Research-only. No MT5/live/app work, promotion, red-news implementation,
2020/year-by-year expansion, full matrix restart, or full seven-pair handshake
gate is opened by this diagnostic.
