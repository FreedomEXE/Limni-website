# Gate 90 ADR Clock Execution Research Handoff

Generated: `2026-07-02`

Verdict: `PASS_GATE90_ADR_CLOCK_SIGNAL_ENGINE_BUILT_RESEARCH_ONLY_NO_PROMOTION`

## Scope

Gate 90 remains warehouse/research only. This pass explored whether the emerging
MA-reversion grid execution engine should keep calculating signals from M1 bars
or move toward an ADR movement/event clock.

No MT5/live integration, app runtime work, promotion, margin stopout simulator,
pair-specific swap ingestion, or live-readiness work was done.

## Runner Changes

Updated:

- `engine/scripts/verification/build-gate90-grid-activation-accuracy-one-sided-selection.ts`

Added reusable CLI controls:

- `--target-mode=fixed_adr|david_ma_reversion`
- `--target-adr=<number>`
- `--spacing-adr=<number>`
- `--min-ma-expansion-adr=<number>`
- `--grid-add-mode=adverse_and_favorable|adverse_only`
- `--signal-clock=m1|adr_event`
- `--signal-adr-brick=<number>`

Execution still replays the Gate 74B M1/OHLC warehouse path. `signal-clock`
only changes how David MA / RSI / Stoch signal state is built.

## Current Execution Model

The useful current surface is:

- M1/OHLC execution tape.
- MA reversion target: close only profitable returns to the current David MA.
- ADR controls grid spacing and expansion threshold.
- `adverse_only` grid adds:
  - shorts add only above the cycle anchor;
  - longs add only below the cycle anchor;
  - favorable expansion adds are disabled.
- Minimum MA expansion before starting a side: `0.10 ADR`.
- Current best quick spacing: `0.20 ADR`.
- David settings used most recently: `LWMA100`, close price, RSI `50`, OB/OS `60/40`.
- Stoch state-filter ladder used `100/3/100` with levels `80/20`, `70/30`, `60/40`.

`david_stoch_release` is rejected for the primary matrix. It is too timing-fragile
and deleted most opportunity.

## Required Baselines

Every future matrix should include:

- `raw_both`: no directional opinion, same MA-expansion harvest logic.
- `david_contra`: local David color/exhaustion filter; current best balance.
- `candidate_b`: macro/directional filter candidate; keep as later regime/bias layer.
- `stoch_contra`: Stoch OB/OS state filter.
- `david_stoch_confirm`: David contra plus Stoch OB/OS state filter.

Do not include `david_stoch_release` unless explicitly reopening rejected logic.

## Key Five-Week OHLC Results

Window: `2026-05-03..2026-05-31`, all 28 pairs, generic Gate 90 cost model.

Execution surface: MA reversion TP, spacing `0.20 ADR`, min MA expansion
`0.10 ADR`, adverse-only adds.

### M1 Signal Clock Baseline

| Rule | Net | Entries | Max Open | Terminal | Read |
| --- | ---: | ---: | ---: | ---: | --- |
| `raw_both` | `+$2,728.09` | `8,043` | `176` | `139` | strongest gross, scary benchmark |
| `david_contra` | `+$2,161.21` | `5,947` | `168` | `117` | best current balance |
| `candidate_b` | `+$1,191.12` | `3,863` | `106` | `90` | cuts trades, cuts too much profit |
| `stoch_contra` 60/40 | `+$1,019.60` | `4,492` | `135` | `95` | interesting but weaker |
| `david_stoch_confirm` 60/40 | `+$887.02` | `4,039` | `149` | `96` | still weaker than David alone |

The positive `david_contra` row had `4,175` side starts and `4,156` target
resets, leaving about `19` unresolved cycles at the end. Those unresolved cycles
contained `117` fills, so the problem is concentrated in the few fat cycles that
do not return to MA quickly.

### ADR Event Signal Clock

ADR-event bars are timestamped synthetic close-driven movement bars. A signal
bar completes only after price moves the configured ADR brick from the current
event open. M1/OHLC still handles execution.

| Signal Clock | Rule | Net | Entries | Max Open | Terminal | Read |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| ADR `0.05`, MA50 | `raw_both` | `+$2,260.66` | `6,137` | `215` | `173` | lower net, still inventory-heavy |
| ADR `0.05`, MA50 | `david_contra` | `+$1,546.45` | `3,400` | `109` | `99` | cleaner than M1, lower net |
| ADR `0.10`, MA50 | `raw_both` | `+$1,934.17` | `4,002` | `221` | `207` | fewer entries, worse terminal ratio |
| ADR `0.10`, MA50 | `david_contra` | `+$1,422.93` | `2,078` | `113` | `77` | best ADR-clock directional balance so far |
| ADR `0.10`, MA100 | `david_contra` | `+$1,305.02` | `1,616` | `139` | `77` | slower signal, lower entries |

M1 still wins on net under the tested settings. ADR-event bars reduce trade
count and offer a better institutional signal-clock abstraction, but they do not
solve terminal inventory by themselves. The ADR-event signal parameters need
their own tuning; reusing MA100/Stoch100 from M1 is not equivalent.

## Interpretation

The emerging edge is not "M1 chart trading." The useful structure is:

1. Price is expanded away from a moving mean by a measurable ADR amount.
2. A one-sided or two-sided activation rule starts the grid.
3. Adds happen only when price moves further against that side.
4. Exit is a profitable return to the MA.

The open problem is survivability: unresolved cycles can still accumulate
inventory. The next work should focus on ADR-clock tuning plus terminal
inventory attribution/cleanup, not promotion.

## Next Research

Recommended next Gate 90 continuation:

1. Keep execution fixed first:
   - MA reversion TP;
   - spacing `0.20 ADR`;
   - min MA expansion `0.10 ADR`;
   - adverse-only adds;
   - generic cost model.
2. Tune ADR event signal clock:
   - bricks `0.025`, `0.05`, `0.075`, `0.10`;
   - David MA periods `25`, `50`, `75`, `100`;
   - include raw/David/Candidate/Stoch state baselines.
3. Add terminal inventory attribution:
   - pair;
   - side;
   - cycle count;
   - fill count;
   - age;
   - distance from MA;
   - liquidation PnL.
4. Only after the above, run a longer window:
   - first one year;
   - then full available Gate 74B history if the one-year shape survives.

Do not jump straight to seven-year M1-style runs. M1 is useful as execution tape,
but signal calculation should keep moving toward ADR movement clocks.

## Primary Artifact Index

Latest ADR-clock summaries:

- `docs/research/gates/gate90/artifacts/signal-clock-comparison-5w-ohlc-ma100-s020-exp010-rsi50-stoch6040-summary.csv`
- `docs/research/gates/gate90/artifacts/adr-event-period-ladder-5w-ohlc-s020-exp010-rsi50-stoch6040-summary.csv`

Latest reports:

- `docs/research/gates/gate90/GATE90_SIGNAL_CLOCK_COMPARISON_5W_OHLC_M1_MA100_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`
- `docs/research/gates/gate90/GATE90_SIGNAL_CLOCK_COMPARISON_5W_OHLC_ADR005_MA100_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`
- `docs/research/gates/gate90/GATE90_SIGNAL_CLOCK_COMPARISON_5W_OHLC_ADR010_MA100_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`
- `docs/research/gates/gate90/GATE90_ADR_EVENT_PERIOD_LADDER_5W_OHLC_ADR005_MA50_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`
- `docs/research/gates/gate90/GATE90_ADR_EVENT_PERIOD_LADDER_5W_OHLC_ADR010_MA50_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`
