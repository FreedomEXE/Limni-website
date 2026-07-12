# Gate 90 ADR Event Brick MA Ladder With Terminal Attribution

Generated: `2026-07-02`

Verdict: `PASS_GATE90_ADR_EVENT_BRICK_MA_LADDER_TERMINAL_ATTRIBUTION_RESEARCH_ONLY_NO_PROMOTION`

## Scope

Gate 90 remains warehouse/research only. This pass continued the ADR-clock
execution research by running the fixed execution surface across ADR-event brick
sizes and David MA periods, then adding terminal-inventory attribution to the
Gate 90 runner.

No MT5/live integration, app runtime work, promotion, target/spacing
optimization, pair-specific swap ingestion, margin stopout simulator, broad
Candidate B regime redesign, or live-readiness work was done.

## Runner Change

Updated:

- `engine/scripts/verification/build-gate90-grid-activation-accuracy-one-sided-selection.ts`

Added per-run terminal inventory artifacts:

- `terminal-inventory.rows.csv`
- `terminal-inventory.rows.json`

Each terminal row records one side cycle that survived to end-of-test
liquidation:

- pair and side;
- fill count and add depth;
- max/average fill age;
- terminal mark and David MA;
- side-specific distance back to the MA exit line;
- price PnL, swap, entry commission, and net terminal liquidation PnL.

## Fixed Execution Surface

Window: `2026-05-03..2026-05-31`, all 28 pairs, OHLC high/low replay, generic
Gate 90 cost model.

Execution stayed fixed:

- M1/OHLC execution tape.
- Signal clock: `adr_event`.
- Target mode: `david_ma_reversion`.
- Spacing: `0.20 ADR`.
- Minimum MA expansion before side start: `0.10 ADR`.
- Grid add mode: `adverse_only`.
- David RSI: `50`, OB/OS `60/40`.
- Stoch: `100/3/100`, OB/OS `60/40`, state filter only.

Matrix:

- ADR bricks: `0.025`, `0.05`, `0.075`, `0.10`.
- David MA periods: `25`, `50`, `75`, `100`.
- Rules: `raw_both`, `david_contra`, `candidate_b`, `stoch_contra`,
  `david_stoch_confirm`.

## Best Row By Rule

| Rule | Brick | MA | Net | Entries | Max Open | Terminal | Terminal Price PnL | Read |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `raw_both` | `0.025` | `25` | `+$3,105.52` | `9,420` | `185` | `112` | `-$486.08` | strongest benchmark, still no-direction |
| `david_contra` | `0.05` | `25` | `+$1,664.13` | `4,077` | `102` | `89` | `-$232.99` | best directional net |
| `candidate_b` | `0.025` | `25` | `+$1,532.66` | `4,705` | `87` | `72` | `-$376.64` | cuts open count but not enough terminal damage |
| `stoch_contra` | `0.025` | `100` | `+$1,225.63` | `3,652` | `134` | `95` | `-$384.89` | lower harvest |
| `david_stoch_confirm` | `0.025` | `100` | `+$1,022.69` | `3,067` | `130` | `95` | `-$384.89` | lower harvest |

## David Contra Read

`david_contra` did not beat the M1 signal-clock baseline on net, but the
ADR-event rows are materially cleaner on open inventory.

Reference M1 quick row from the prior handoff:

- `david_contra`: net `+$2,161.21`, entries `5,947`, max open `168`,
  terminal `117`.

Most useful ADR-event rows:

| Brick | MA | Net | Entries | Max Open | Terminal | Terminal Price PnL | Terminal Net | Read |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `0.05` | `25` | `+$1,664.13` | `4,077` | `102` | `89` | `-$232.99` | `-$240.99` | best directional net |
| `0.075` | `25` | `+$1,528.62` | `3,297` | `120` | `82` | `-$101.11` | `-$106.32` | best current balance |
| `0.10` | `50` | `+$1,422.93` | `2,078` | `113` | `77` | `-$107.99` | `-$112.67` | lower frequency, cleaner terminal |
| `0.10` | `25` | `+$1,398.87` | `2,665` | `114` | `74` | `-$105.78` | `-$110.32` | cleanest terminal count among practical rows |
| `0.025` | `25` | `+$1,576.22` | `5,491` | `96` | `55` | `-$280.58` | `-$284.67` | low terminal count but still high churn |

Current read:

- `0.05 / MA25` is the best `david_contra` net row.
- `0.075 / MA25` is the better balance row because it gives up only about
  `$135.51` versus `0.05 / MA25` while cutting terminal price damage from
  `-$232.99` to `-$101.11`.
- `0.10 / MA25` and `0.10 / MA50` are lower-frequency cleanup candidates, but
  they give up more harvest.
- MA25 is not a random faster timeframe. On ADR-event bars it behaves like a
  shorter movement-memory horizon, and it is currently more useful than MA50,
  MA75, or MA100 for this five-week surface.

## Terminal Inventory Attribution

The terminal rows confirm that the unresolved-inventory problem is concentrated,
not evenly distributed.

Worst recurring `david_contra` pair/side contributors across the 16 cells:

| Pair | Side | Appearances | Fill Sum | Aggregate Terminal Net | Worst Cycle |
| --- | --- | ---: | ---: | ---: | ---: |
| `GBPNZD` | `SHORT` | `16` | `129` | `-$1,016.29` | `-$179.10` |
| `EURNZD` | `SHORT` | `16` | `109` | `-$478.41` | `-$57.30` |
| `NZDUSD` | `LONG` | `16` | `121` | `-$439.15` | `-$49.07` |
| `USDJPY` | `SHORT` | `16` | `62` | `-$249.41` | `-$231.62` |
| `GBPCHF` | `SHORT` | `14` | `82` | `-$243.90` | `-$88.09` |

This matters because the next cleanup rule should not be another broad signal
tweak. The failure shape is a small set of stale side cycles with deep fill
stacks and persistent distance from the MA exit line.

## Interpretation

ADR-event signal clocks are still not a promotion result. They are a better
research abstraction than arbitrary chart timeframes.

The result supports this working model:

1. Use M1/OHLC only as the execution tape.
2. Use ADR-event bars to update signal state after real movement, not elapsed
   chart time.
3. Keep `raw_both` as the no-direction harvest benchmark.
4. Treat `david_contra 0.075 / MA25` as the current best balanced directional
   row for cleanup design.
5. Design terminal cleanup against stale pair/side cycles before any long
   history claim.

## Next Research

Do not jump to full history yet.

Recommended next Gate 90 continuation:

1. Add a small cleanup-control family on top of the balanced directional rows:
   `david_contra 0.075 / MA25`, `david_contra 0.05 / MA25`, and
   `david_contra 0.10 / MA50`.
2. Start with cleanup controls that are explainable from terminal attribution:
   max age, max add depth, and/or max side distance from MA.
3. Keep `raw_both 0.025 / MA25` as the benchmark only.
4. Only after cleanup improves terminal shape, run a one-year window.

## Primary Artifacts

- Summary surface:
  `docs/research/gates/gate90/artifacts/adr-event-period-ladder-5w-ohlc-s020-exp010-rsi50-stoch6040-summary.csv`
- Terminal attribution aggregate:
  `docs/research/gates/gate90/artifacts/adr-event-period-ladder-5w-ohlc-s020-exp010-rsi50-stoch6040-terminal-summary.csv`
- Runner:
  `engine/scripts/verification/build-gate90-grid-activation-accuracy-one-sided-selection.ts`
