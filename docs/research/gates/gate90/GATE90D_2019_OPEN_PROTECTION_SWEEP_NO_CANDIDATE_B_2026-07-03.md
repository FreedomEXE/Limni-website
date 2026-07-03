# Gate 90D 2019 Open Protection Sweep, No Candidate B

Generated: 2026-07-03

## Verdict

`PASS_GATE90D_2019_PROTECTION_SWEEP_VISIBLE_NAIVE_PROTECTION_NOT_A_FREE_WIN_NO_PROMOTION`

The focused 2019 open-price no-Candidate-B protection sweep completed. It did
not prove that simple Q trailing or protected flatten should be added globally.

The important answer is:

- strict Katarakti/no-Candidate-B baseline remains the cleanest low-exposure
  shape in this sweep;
- standalone David remains the highest 2019 harvester, but still runs hot;
- broad Triangle v1 David geometry remains too loose;
- naive protected flatten mostly moves the loss from `session_flatten` into
  `protected_flatten`; it does not solve the bad cycles by itself.

Headline return convention remains ADR-normalized percent: `1 ADR = 1%`.
Account return is secondary costed USD/equity truth.

## Scope

- Window: `2019-04-14T23:00:00.000Z..2019-12-30T00:00:00.000Z`.
- Pairs: all 28.
- Bar path mode: `open`.
- Signal clock: ADR event, brick `0.075`.
- David: LWMA `50`, RSI `50`, levels `60/40`.
- Session: New York daily window, start `18:05`, cutoff `15:45`, flatten
  `16:00`, Sunday start `20:00`.
- Target: David MA reversion.
- Adds: adverse only.
- Candidate B: excluded from the focused Triangle path.

Protection modes:

- `baseline`: current behavior.
- `lock_1q_stop_adds`: after a cycle reaches `+1Q` MFE, no new grid adds.
- `trail_1q_1q`: after `+1Q` MFE, close after `1Q` giveback.
- `trail_1q_0_5q`: after `+1Q` MFE, close after `0.5Q` giveback.
- `protected_flatten_1q`: at EOD, close green, hold small red, close ugly red
  at `-1Q`.
- `protected_flatten_1q_trail_1q`: protected flatten plus `1Q/1Q` trail.

## Decision Table

| Rule | Protection | ADR return % | Account % | Max DD % | Account R/DD | Entries | Max open | PF | Win % | Avg ADR/cycle | Target net | Flatten net | Protection net |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `triangle_v1_david_contra_extension` | `baseline` | `+177.43` | `-0.74` | `-9.92` | `-0.07` | `15,567` | `106` | `0.984` | `62.70` | `+0.0144` | `+4,150.80` | `-4,224.46` | `0.00` |
| `triangle_v1_david_contra_extension` | `protected_flatten_1q` | `+174.31` | `-1.83` | `-9.41` | `-0.19` | `15,365` | `104` | `0.962` | `64.07` | `+0.0143` | `+4,159.27` | `+333.72` | `-4,676.07` |
| `david_contra` | `baseline` | `+392.37` | `+9.30` | `-11.32` | `0.82` | `23,321` | `131` | `1.075` | `83.80` | `+0.0296` | `+12,672.23` | `-11,742.10` | `0.00` |
| `david_contra` | `lock_1q_stop_adds` | `+346.80` | `+7.43` | `-10.58` | `0.70` | `22,316` | `101` | `1.061` | `83.08` | `+0.0263` | `+12,252.91` | `-11,509.55` | `0.00` |
| `triangle_v0_no_candidate_b` | `baseline` | `+25.29` | `+1.17` | `-2.19` | `0.54` | `689` | `13` | `1.230` | `79.30` | `+0.0557` | `+579.01` | `-461.57` | `0.00` |
| `triangle_v0_no_candidate_b` | `protected_flatten_1q` | `+25.92` | `+1.03` | `-2.32` | `0.44` | `677` | `13` | `1.196` | `84.07` | `+0.0573` | `+580.51` | `+42.76` | `-520.68` |
| `triangle_v0_no_candidate_b` | `trail_1q_0_5q` | `+22.96` | `+0.98` | `-2.14` | `0.46` | `761` | `13` | `1.190` | `81.08` | `+0.0443` | `+473.78` | `-474.95` | `+98.80` |

## What This Means

Strict Katarakti baseline still wins the no-Candidate-B quality read:

- best strict account return: `+1.17%`;
- best strict account return/DD: `0.54`;
- low max open: `13`;
- low fill count: `689`;
- best costed PF among strict rows: `1.230`.

Protected flatten looked attractive because it turned strict session-flatten net
from `-$461.57` into `+$42.76`, but that was not free. It created
`-$520.68` of protected-flatten loss. Net result: lower account return
(`+1.03%` vs `+1.17%`) and worse max DD (`-2.32%` vs `-2.19%`).

The trail modes are also not a free win. `trail_1q_0_5q` created `+$98.80` in
protection closes, but reduced target net from `+$579.01` to `+$473.78` and
lowered account return to `+0.98%`.

For standalone David, `lock_1q_stop_adds` is a real risk tradeoff:

- max open improved from `131` to `101`;
- max DD improved from `-11.32%` to `-10.58%`;
- account return fell from `+9.30%` to `+7.43%`.

That is not better as a headline, but it is a useful control knob if we later
decide David harvest is worth shaping.

## Week And Month Read

| Rule | Protection | Account winning weeks | Account losing weeks | Worst week | Best week | Account winning months | Account losing months |
|---|---|---:|---:|---|---|---:|---:|
| `triangle_v1_david_contra_extension` | `baseline` | `24` | `14` | `2019-07-28`, `-5.29%` | `2019-08-04`, `+2.21%` | `5` | `5` |
| `triangle_v1_david_contra_extension` | `protected_flatten_1q` | `23` | `15` | `2019-07-28`, `-5.10%` | `2019-08-04`, `+2.04%` | `5` | `5` |
| `david_contra` | `baseline` | `26` | `12` | `2019-07-28`, `-10.25%` | `2019-08-04`, `+4.18%` | `7` | `3` |
| `david_contra` | `lock_1q_stop_adds` | `26` | `12` | `2019-07-28`, `-9.11%` | `2019-08`, `+5.57%` month | `6` | `4` |
| `triangle_v0_no_candidate_b` | `baseline` | `30` | `7` | `2019-10-06`, `-1.98%` | `2019-09-29`, `+0.77%` | `8` | `2` |
| `triangle_v0_no_candidate_b` | `protected_flatten_1q` | `31` | `6` | `2019-10-06`, `-2.11%` | `2019-09-29`, `+0.77%` | `7` | `3` |

Read: strict protected flatten improved the week win count by one, but made the
worst week and month shape worse. That is not enough to adopt it.

## Close-Reason Read

| Rule | Protection | Close reason | Events | ADR return % | Account % | Avg ADR/cycle |
|---|---|---|---:|---:|---:|---:|
| `triangle_v0_no_candidate_b` | `baseline` | `target` | `318` | `+100.16` | `+5.79` | `+0.3150` |
| `triangle_v0_no_candidate_b` | `baseline` | `session_flatten` | `136` | `-74.86` | `-4.62` | `-0.5504` |
| `triangle_v0_no_candidate_b` | `protected_flatten_1q` | `target` | `333` | `+101.10` | `+5.81` | `+0.3036` |
| `triangle_v0_no_candidate_b` | `protected_flatten_1q` | `session_flatten` | `71` | `+7.49` | `+0.43` | `+0.1055` |
| `triangle_v0_no_candidate_b` | `protected_flatten_1q` | `protected_flatten` | `48` | `-82.67` | `-5.21` | `-1.7224` |
| `triangle_v0_no_candidate_b` | `trail_1q_0_5q` | `protection_trail` | `96` | `+15.79` | `+0.99` | `+0.1645` |
| `triangle_v0_no_candidate_b` | `trail_1q_0_5q` | `session_flatten` | `132` | `-76.49` | `-4.75` | `-0.5795` |

Read: protected flatten did exactly what it was told to do, but the ugly-red
bucket is too ugly. Closing those at `-1Q` is not enough; by the time they are
classified, the average protected-flatten close is much worse than `-1Q`.

## Engineering Read

This was still a useful pass. It says the next improvement is not a blind
trailing stop and not a simple EOD green/red rule.

The next shape should be:

1. Keep no-Candidate-B as the simple coding path for now.
2. Keep strict Katarakti as the quality anchor / premium class.
3. Do not apply naive protected flatten globally.
4. Do not apply 1Q trailing globally.
5. Use `lock_1q_stop_adds` only as a risk knob, not as alpha.
6. Next diagnostic should inspect the bad-cycle origin before EOD:
   which cycles became ugly because they had no MFE, which had MFE then gave it
   back, and which were bad from entry.

Plain-English rule: do not trail every trade just because it went green once.
First separate bad starts from good starts that gave back profit. Those require
different fixes.

## Artifacts

- Runner report:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/GATE90D_2019_OPEN_PROTECTION_SWEEP_NO_CANDIDATE_B.md`
- Summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/activation-summary.rows.json`
- Close events:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/close-events.rows.json`
- Close-event breakdown:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/close-event-breakdown.rows.json`
- One-pair smoke:
  `docs/research/gates/gate90/artifacts/gate90d-protection-smoke-audchf-2019-1w/`

## Stop Line

Research-only. No replay freeze, no promotion, no MT5/live/app work, no
2020/year-by-year expansion, no full matrix restart, and no full seven-pair
handshake gate is opened by this sweep.
