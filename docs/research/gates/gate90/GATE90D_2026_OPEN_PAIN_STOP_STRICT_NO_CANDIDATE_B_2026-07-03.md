# Gate 90D 2026 Open Pain-Stop Strict No-Candidate-B Replay

Generated: 2026-07-03

## Verdict

`PASS_WITH_CAVEATS_GATE90D_2026_PAIN_STOP_RESCUES_STRICT_NO_CANDIDATE_B_NO_PROMOTION`

The 2019-winning protection rule also improves the 2026 window.

Baseline strict no-Candidate-B is slightly red on this 2026 open-price run. The
pain-first stop-add rule turns it green and reduces drawdown:

`pain_1q_stop_adds_before_profit_0_5q`

Plain English: the rule travels. It is not as strong in 2026 as it was in 2019,
but it improves the same failure mode: it cuts damage from ugly starts without
changing the start trigger.

## Scope

- Window: `2025-12-08T00:00:00.000Z..2026-05-31T23:00:00.000Z`.
- Universe: all 28 Gate 74B pairs.
- Activation rule: `triangle_v0_no_candidate_b`.
- Candidate B: omitted.
- Bar path: `open` prices only for fast diagnostics.
- Signal clock: ADR-event `0.075`.
- David: LWMA `50`, RSI `50`, OB/OS `60/40`.
- Session: New York clean daily window, trade start `18:05`, trade cutoff
  `15:45`, flatten `16:00`, Sunday start `20:00`.
- Target: profitable David MA reversion.
- Grid adds: adverse-only.
- Spacing: Triangle adaptive range/3, clamped `0.20..0.30 ADR`.

Reported movement return is **ADR units**, not account percent. Fixed-lot
account return is shown separately as a cash sanity check for the current
`0.01` lot replay.

## Summary

| Mode | ADR units | Fixed-lot account % | Max DD % | Return/DD | Close PF | Win % | Avg trade ADR | Avg MFE ADR | Avg MAE ADR | Entries | Max open | Max depth | Max age days |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `baseline` | `-5.58` | `-0.12` | `-2.39` | `-0.048` | `0.974` | `78.25` | `-0.0196` | `0.3050` | `0.8074` | `455` | `29` | `28` | `2.71` |
| `pain_1q_stop_adds_before_profit_0_5q` | `11.06` | `0.55` | `-1.34` | `0.412` | `1.196` | `75.79` | `0.0388` | `0.2493` | `0.4424` | `353` | `23` | `21` | `2.71` |

Compared to baseline, the pain-stop rule:

- improved movement harvest from `-5.58` ADR units to `+11.06`;
- improved fixed-lot account return from `-0.12%` to `+0.55%`;
- reduced max drawdown from `-2.39%` to `-1.34%`;
- reduced entries from `455` to `353`;
- reduced max open from `29` to `23`;
- reduced max depth from `28` to `21`;
- reduced average adverse excursion from `0.8074 ADR` to `0.4424 ADR`.

## Close Reason Split

| Mode | Close reason | Cycles | Wins | Losses | ADR units | Fixed-lot account % | Net USD | PF | Avg MFE ADR | Avg MAE ADR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `baseline` | `target` | `185` | `183` | `2` | `52.04` | `2.78` | `277.77` | `2979.529` | `0.296` | `0.199` |
| `baseline` | `session_flatten` | `100` | `40` | `60` | `-57.62` | `-2.89` | `-289.39` | `0.347` | `0.321` | `1.933` |
| `pain_1q_stop_adds_before_profit_0_5q` | `target` | `182` | `179` | `3` | `46.78` | `2.51` | `250.95` | `1667.914` | `0.270` | `0.157` |
| `pain_1q_stop_adds_before_profit_0_5q` | `session_flatten` | `103` | `37` | `66` | `-35.72` | `-1.96` | `-195.64` | `0.305` | `0.213` | `0.946` |

The rule works by reducing flatten damage. It gives up some target profit, but
it cuts the bad flatten bucket more.

## Week And Month Shape

| Mode | Win weeks | Loss weeks | Worst week | Worst week % | Best week | Best week % | Win months | Loss months | Worst month | Worst month % |
|---|---:|---:|---|---:|---|---:|---:|---:|---|---:|
| `baseline` | `19` | `7` | `2026-04-26` | `-2.39` | `2026-01-26` | `0.83` | `3` | `3` | `2026-04` | `-1.89` |
| `pain_1q_stop_adds_before_profit_0_5q` | `19` | `7` | `2026-04-26` | `-1.34` | `2026-01-26` | `0.53` | `5` | `1` | `2026-04` | `-0.97` |

Week count did not improve, but month shape did: the pain-stop mode had `5`
winning months and `1` losing month versus baseline `3` and `3`.

## Pair Read

Worst fixed-lot account pairs:

| Mode | Worst pairs |
|---|---|
| `baseline` | `EURJPY -1.17%`, `USDJPY -1.08%`, `GBPCHF -0.26%`, `USDCAD -0.17%`, `GBPAUD -0.02%` |
| `pain_1q_stop_adds_before_profit_0_5q` | `USDJPY -1.22%`, `USDCAD -0.15%`, `EURJPY -0.12%`, `GBPNZD -0.02%`, `EURGBP -0.00%` |

Best fixed-lot account pairs:

| Mode | Best pairs |
|---|---|
| `baseline` | `AUDJPY +0.49%`, `GBPJPY +0.26%`, `AUDUSD +0.23%`, `USDCHF +0.17%`, `GBPUSD +0.17%` |
| `pain_1q_stop_adds_before_profit_0_5q` | `AUDUSD +0.23%`, `AUDJPY +0.21%`, `USDCHF +0.17%`, `CADCHF +0.16%`, `EURAUD +0.15%` |

2026 still has a JPY problem, especially `USDJPY`. The pain-stop rule helped
`EURJPY` materially but did not fix `USDJPY`.

## Read

This is green enough to justify a full seven-year diagnostic, but not strong
enough to promote anything.

The core signal:

- 2019: pain-stop improved strict no-Candidate-B from `+25.29` ADR units /
  `+1.17%` fixed-lot account to `+32.98` ADR units / `+2.29%` fixed-lot
  account.
- 2026: pain-stop improved strict no-Candidate-B from `-5.58` ADR units /
  `-0.12%` fixed-lot account to `+11.06` ADR units / `+0.55%` fixed-lot
  account.

The shared improvement is lower bad-flatten damage and lower adverse excursion.

Next evidence should run the same two-mode comparison over the full available
Gate 74B history before adding any new rule complexity.

## Artifacts

- Runner report:
  `docs/research/gates/gate90/artifacts/gate90d-2026-open-pain-stop-strict-no-candidate-b/GATE90D_2026_OPEN_PAIN_STOP_STRICT_NO_CANDIDATE_B.md`
- Summary rows:
  `docs/research/gates/gate90/artifacts/gate90d-2026-open-pain-stop-strict-no-candidate-b/activation-summary.rows.json`
- Weekly rows:
  `docs/research/gates/gate90/artifacts/gate90d-2026-open-pain-stop-strict-no-candidate-b/weekly-activation-truth.rows.json`
- Close-event rows:
  `docs/research/gates/gate90/artifacts/gate90d-2026-open-pain-stop-strict-no-candidate-b/close-events.rows.json`
- Close-event breakdown:
  `docs/research/gates/gate90/artifacts/gate90d-2026-open-pain-stop-strict-no-candidate-b/close-event-breakdown.rows.json`

## Stop Line

Research-only. No MT5/live/app work, promotion, red-news implementation,
2020/year-by-year expansion, full matrix restart, or full seven-pair handshake
gate is opened by this diagnostic.
