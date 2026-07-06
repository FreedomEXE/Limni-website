# Gate 99K - LimniBeta Fast Internal Signals

Date: 2026-07-06

## Trigger

Freedom started a six-year `LimniBeta` tester run and MT5 estimated roughly
`179 days`. That made the Gate 99J build unusable for diagnostics.

## Cause

`LimniBeta` was using two separate `iCustom` indicator handles for
`Limni\TrendState` and `Limni\Stochastic`. In the tester, those indicators can
rebuild growing M1 LRMG stack history repeatedly. Over a six-year M1 run this is
the wrong architecture.

## Change

`LimniBeta` now uses a fast internal signal path by default:

- fixed M1 closed-bar input
- completed-day LRMG q
- David-state direction from LRMG event prices
- LRMG event-range stochastic
- previous/current stochastic closed-bar comparison
- same `Strict` and `Loose` entry semantics as Gate 99I/99J

The visual indicators remain in the repo for chart inspection, but the EA no
longer depends on them during the current tester path.

## Changed File

- `automation/mt5/Experts/LimniBeta.mq5`

## New Summary Receipts

- `signal_source=FAST_INTERNAL`
- `fast_internal_signals=true`
- `fast_q_ready_bars`
- `fast_q_missing_bars`
- `fast_completed_q_days`
- `fast_q_day_failures`
- `fast_event_count`

## Frozen Areas

- No entry variant changes.
- No TP/account/grid behavior changes.
- No visual-indicator formula changes.
- No `LimniKataraktiEA.mq5`, `LimniTrendFollow.mq5`, or `LimniHedge_V1.mq5`
  changes.
- No promotion claim from MT5 terminal-history output.

## Compile Proof

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99k-limnibeta-fast-internal-signals-2026-07-06/`

Both repo and active-terminal `LimniBeta` compile logs report:

```text
Result: 0 errors, 0 warnings
```

Source hash parity after active-terminal install:

```text
A42CB6529AB39713E37E142BE3846FD21F8C4C7DD409719A55B7F24C8AD857EB
```

## Rerun Instruction

Stop any old `179 days` tester run. Restart the same six-year diagnostic with
the active-terminal `LimniBeta` build from this gate.

Suggested first run:

- model: `Open prices only`
- `EntryMode=Strict`
- `ExitScope=EXIT_ACCOUNT`
- `TP=1.0` or the intended account-percent target
- `ScaleLookbackDays=0`
- `BrokerToEstOffsetHours=-7`
- `UseWeekBoundaryGuard=true`
- same symbol/window/deposit/leverage/spread settings as the failed slow run

If MT5 still estimates an absurd runtime after this patch, the next stop is the
remaining daily q / event-state loop, not the visual indicators.
