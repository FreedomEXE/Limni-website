# Gate 90D Triangle v0 2026 / 2019 Comparison

Generated: 2026-07-03

## Verdict

`FAIL_GATE90D_TRIANGLE_V0_UNDER_HARVESTS_AND_FAILS_2019_RESEARCH_ONLY`

Triangle v0 is not enough as the final algorithm in its current form.

It is highly selective and risk-light in the 2026 fast-decision window, but it
misses too much harvest. More importantly, it fails the 2019 close-mode
comparison that the older Gate 90C run handled well with static Candidate B /
David variants.

## Scope

Two prior Gate 90C comparison surfaces were replayed with `triangle_v0` added
beside the old baseline rules.

- 2026 window: `2025-12-08..2026-05-31`, all 28 pairs, OHLC high/low,
  ADR-event `0.025`, David MA `25`, spacing `0.10`, NY daily window,
  MA-reversion target, adverse-only adds.
- 2019 window: `2019-04-14..2019-12-30`, all 28 pairs, close-mode,
  ADR-event `0.075`, David MA `50`, spacing `0.20`, NY daily window,
  MA-reversion target, adverse-only adds.

Rules:

- `triangle_v0`
- `raw_both`
- `david_contra`
- `candidate_b`
- `candidate_b_david_contra_conflict_candidate`

Percent metrics use starting balance as denominator. Close cycles are the
primary trade-stat unit; fills are individual grid entries.

## Results

### 2026 Fast-Decision Window

| Rule | Return % | Max DD % | Return/DD | Fills | Close cycles | Wins | Losses | Win % | PF | Expectancy / cycle % | Expectancy / fill % | Avg win % | Avg loss % | Flatten drag % | Max open | Max depth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `triangle_v0` | `2.16` | `-0.29` | `7.414` | `371` | `283` | `262` | `21` | `92.58` | `5.511` | `0.0076` | `0.0058` | `0.0101` | `-0.0228` | `-0.47` | `10` | `9` |
| `candidate_b` | `76.15` | `-0.88` | `86.939` | `41,897` | `25,084` | `22,210` | `2,874` | `88.54` | `2.292` | `0.0030` | `0.0018` | `0.0061` | `-0.0205` | `-53.35` | `99` | `25` |
| `david_contra` | `95.56` | `-0.62` | `154.906` | `46,995` | `27,539` | `24,458` | `3,081` | `88.81` | `2.545` | `0.0035` | `0.0020` | `0.0064` | `-0.0201` | `-54.48` | `95` | `25` |
| `candidate_b_david_contra_conflict_candidate` | `39.84` | `-0.78` | `51.066` | `22,036` | `13,160` | `11,681` | `1,479` | `88.76` | `2.242` | `0.0030` | `0.0018` | `0.0062` | `-0.0217` | `-29.19` | `61` | `25` |
| `raw_both` | `175.86` | `0.00` |  | `83,772` | `50,104` | `44,586` | `5,518` | `88.99` | `2.644` | `0.0035` | `0.0021` | `0.0063` | `-0.0194` | `-93.10` | `137` | `25` |

### 2019 Close-Mode Window

| Rule | Return % | Max DD % | Return/DD | Fills | Close cycles | Wins | Losses | Win % | PF | Expectancy / cycle % | Expectancy / fill % | Avg win % | Avg loss % | Flatten drag % | Max open | Max depth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `triangle_v0` | `-0.61` | `-2.81` | `-0.218` | `816` | `474` | `354` | `120` | `74.68` | `0.905` | `-0.0013` | `-0.0008` | `0.0165` | `-0.0538` | `-5.82` | `16` | `12` |
| `candidate_b` | `17.01` | `-7.70` | `2.210` | `21,960` | `12,783` | `10,759` | `2,024` | `84.17` | `1.158` | `0.0013` | `0.0008` | `0.0116` | `-0.0531` | `-100.70` | `90` | `14` |
| `david_contra` | `8.81` | `-11.47` | `0.768` | `23,415` | `13,316` | `11,137` | `2,179` | `83.64` | `1.071` | `0.0007` | `0.0004` | `0.0120` | `-0.0573` | `-117.82` | `142` | `21` |
| `candidate_b_david_contra_conflict_candidate` | `10.56` | `-4.36` | `2.423` | `11,530` | `6,674` | `5,608` | `1,066` | `84.03` | `1.191` | `0.0016` | `0.0009` | `0.0118` | `-0.0519` | `-51.69` | `65` | `14` |
| `raw_both` | `6.69` | `-22.72` | `0.294` | `44,017` | `25,353` | `21,386` | `3,967` | `84.35` | `1.028` | `0.0003` | `0.0002` | `0.0114` | `-0.0598` | `-224.52` | `168` | `21` |

## Read

Triangle v0 currently solves only one side of the problem.

It cuts exposure dramatically:

- 2026: `371` fills versus `46,995` for `david_contra` and `41,897` for
  `candidate_b`.
- 2019: `816` fills versus `21,960` for `candidate_b` and `23,415` for
  `david_contra`.
- Max open is materially lower in both windows.

But the trigger is too strict or incomplete:

- 2026 Triangle v0 returned only `2.16%` while `david_contra` returned
  `95.56%` and `candidate_b` returned `76.15%` on the old aggressive cell.
- 2019 Triangle v0 returned `-0.61%`, with PF `0.905`, while the old
  `candidate_b` top-return row returned `17.01%`.
- 2019 is the main failure because Triangle v0 did not just underperform; it
  had negative expectancy.

The current Triangle trigger is therefore not the missing final formula. It is
a useful precision/lockout component, but it cannot replace the broader
direction/grid architecture yet.

## Technical Opinion

Keep the Triangle architecture, but do not treat this v0 as the final entry
algorithm.

The next design move should be to separate two questions that v0 currently
bundles together:

1. Is the market in a harvestable grid regime?
2. Is the exact sweep/rejection/displacement trigger the only acceptable start?

The evidence says the strict trigger is filtering out too much of the old edge.
For v1, test Triangle geometry as a regime gate first, then compare multiple
start modes inside that regime:

- strict Katarakti sweep/rejection/displacement;
- relaxed sweep/rejection without displacement;
- first mean-extension touch after a valid harvestable session box;
- Candidate B / David direction starts only when the session geometry is valid.

## Artifacts

- 2026 report:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v0-compare-2026-26w-adr0025-ma25-s1/GATE90D_TRIANGLE_V0_COMPARE_2026_26W_ADR0025_MA25_S1.md`
- 2019 report:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v0-compare-2019-close-adr0075-ma50-s2/GATE90D_TRIANGLE_V0_COMPARE_2019_CLOSE_ADR0075_MA50_S2.md`

## Stop Line

Research-only. No MT5/live/app work, promotion, red-news implementation,
2020/year-by-year expansion, full matrix restart, or full seven-pair handshake
gate is opened by this comparison.
