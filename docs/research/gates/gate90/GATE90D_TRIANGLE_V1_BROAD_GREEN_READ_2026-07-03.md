# Gate 90D Triangle v1 Broad Green Read

Date: 2026-07-03

Verdict: `PASS_GATE90D_TRIANGLE_V1_BROAD_GREEN_READ_RESEARCH_ONLY_NO_PROMOTION`

## Scope

This is a bounded Triangle v1 design-replay read, not a promotion packet.

No MT5/live/app work, red-news implementation, 2020/year-by-year expansion,
full matrix restart, full seven-pair handshake gate, or deployment claim was
started.

Triangle v1 here means:

- keep the Triangle harvestable geometry regime;
- keep adaptive per-cycle spacing from the completed session range divided by
  `3`, clamped to `0.20..0.30 ADR`;
- do not require strict Katarakti sweep/rejection/displacement as the only
  start trigger;
- test geometry-extension starts gated by Candidate B side, David-contra side,
  or Candidate B OR David-contra side.

Katarakti remains important, but as a special confluence / larger-target class:
Katarakti trades can be Triangle v1 trades, but not all Triangle v1 trades
should be forced to be Katarakti trades.

## Command Notes

The Gate 90 runner uses `--max-weeks` for bounded week count. Boolean flags are
bare flags: `--summary-only` and `--log-progress`.

An early speed-check attempt accidentally used ignored forms
`--week-limit=1 --summary-only=1`. That artifact is not used for the evidence
below.

## Evidence Receipts

Artifacts:

- OOS4 5-week broad:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-oos4-5w-broad/`
- 2026 old-window comparison:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-compare-2026-26w-adr0025-ma25-s010/`
- 2019 old-window comparison:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-compare-2019-close-adr0075-ma50-s020/`

### OOS4 5-Week Broad

Window: `2022-01-10T00:00:00.000Z`, `--max-weeks=5`, all 28 pairs,
OHLC high/low, ADR-event brick `0.10`, David MA `50`, static baseline spacing
`0.20`, NY daily window.

| Rule | Net | Close PF | Entries | Max Open | Max Depth | Session Flatten Net |
|---|---:|---:|---:|---:|---:|---:|
| `triangle_v1_candidate_b_extension` | `+$425.92` | `1.741262` | `2,978` | `48` | `8` | `-$436.41` |
| `triangle_v1_david_contra_extension` | `+$259.77` | `1.337591` | `3,295` | `51` | `15` | `-$665.07` |
| `triangle_v1_candidate_or_david_extension` | `+$433.57` | `1.397492` | `4,467` | `62` | `15` | `-$920.79` |
| `triangle_v0` | `+$63.50` | `2.491475` | `102` | `13` | `3` | `-$15.70` |
| `candidate_b` | `+$521.48` | `1.351239` | `2,922` | `84` | `10` | `-$1,387.22` |
| `david_contra` | `+$329.72` | `1.198388` | `2,926` | `83` | `17` | `-$1,565.99` |

Read: v1 is green and much less exposed than standalone Candidate B / David in
max-open and flatten damage, while recovering far more harvest than strict v0.
Candidate B standalone still wins net in this small OOS4 slice.

### 2026 Old Window

Window: `2025-12-08T00:00:00.000Z..2026-05-31T00:00:00.000Z`, all 28 pairs,
OHLC high/low, ADR-event brick `0.025`, David MA `25`, static baseline spacing
`0.10`, NY daily window.

| Rule | Net | Close PF | Entries | Max Open | Max Depth | Session Flatten Net |
|---|---:|---:|---:|---:|---:|---:|
| `triangle_v1_candidate_b_extension` | `+$6,514.20` | `3.230020` | `120,375` | `33` | `29` | `-$1,381.19` |
| `triangle_v1_david_contra_extension` | `+$10,030.83` | `2.731379` | `202,685` | `45` | `29` | `-$2,808.81` |
| `triangle_v1_candidate_or_david_extension` | `+$10,680.79` | `2.797742` | `209,711` | `45` | `29` | `-$2,864.73` |
| `triangle_v0` | `+$216.19` | `5.510540` | `371` | `10` | `9` | `-$46.66` |
| `candidate_b` | `+$7,615.03` | `2.292434` | `41,897` | `99` | `25` | `-$5,334.65` |
| `david_contra` | `+$9,556.15` | `2.545217` | `46,995` | `95` | `25` | `-$5,448.40` |

Read: this is the strongest green receipt. v1 Candidate-or-David and
David-contra geometry starts beat the old standalone rules on net while using
less max-open exposure. The caveat is severe churn: `120k..210k` entries is not
a deployable final cadence.

### 2019 Old Window

Window: `2019-04-14T00:00:00.000Z..2019-12-30T00:00:00.000Z`, all 28 pairs,
close path, ADR-event brick `0.075`, David MA `50`, static baseline spacing
`0.20`, NY daily window.

| Rule | Net | Close PF | Entries | Max Open | Max Depth | Session Flatten Net |
|---|---:|---:|---:|---:|---:|---:|
| `triangle_v1_candidate_b_extension` | `+$548.44` | `1.181285` | `10,914` | `53` | `12` | `-$2,643.07` |
| `triangle_v1_david_contra_extension` | `+$70.79` | `1.015018` | `15,470` | `107` | `13` | `-$4,220.60` |
| `triangle_v1_candidate_or_david_extension` | `+$242.77` | `1.040025` | `19,783` | `115` | `13` | `-$5,421.26` |
| `triangle_v0` | `-$61.31` | `0.904990` | `816` | `16` | `12` | `-$582.08` |
| `candidate_b` | `+$1,700.99` | `1.158297` | `21,960` | `90` | `14` | `-$10,070.23` |
| `david_contra` | `+$881.21` | `1.070614` | `23,415` | `142` | `21` | `-$11,781.80` |

Read: v1 clears the 2019 red block that killed strict v0, but it does not yet
beat standalone Candidate B on that surface. The best v1 risk-shape in 2019 is
Candidate-B geometry extension: lower net than Candidate B, but lower max-open
and far less session-flatten damage.

## Design Read

Green, with caveats.

The key conclusion is not "v1 is ready." The key conclusion is that the Triangle
shape is alive once direction, geometry, and trigger are separated.

- Strict v0 is too narrow: high PF where it trades, but it under-harvests and
  fails 2019.
- Geometry-extension v1 recovers harvest and turns all three test windows green
  for the Candidate-B extension rule.
- Candidate-B and David sides remain useful direction evidence, not a rotating
  final menu.
- Session-flatten losses are still the main pressure surface.
- The 2026 v1 rows show too much entry churn, so the next improvement should be
  throttle/target/lock quality, not broader starts.

## Next Shape

Do not promote, do not start MT5, and do not restart the full matrix from here.

Next bounded Gate 90D work should test a tighter v1 design surface:

1. Keep valid harvestable geometry as the parent regime.
2. Keep Katarakti starts as confluence and larger-target evidence, not as the
   universal start requirement.
3. Add churn controls before replay freeze: minimum extension distance,
   neutral-alignment extra distance, heat guard using `max(pair_heat,
   account_heat)`, and 1Q/2Q lockout receipts.
4. Segment target size using MFE/MAE receipts: same-day target, next-day what-if,
   and larger-target Katarakti class.
5. Only after that run another bounded replay comparison.
