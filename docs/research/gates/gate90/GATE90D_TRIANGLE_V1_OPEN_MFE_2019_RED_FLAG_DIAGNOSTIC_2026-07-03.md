# Gate 90D Triangle v1 Open-Price MFE / 2019 Red-Flag Diagnostic

Date: 2026-07-03

Verdict: `PASS_GATE90D_OPEN_MFE_MAE_RECEIPTS_2019_RED_FLAG_VISIBLE_NO_PROMOTION`

## Scope

This is still Gate 90D research only.

No MT5/live/app work, red-news implementation, 2020/year-by-year expansion,
full matrix restart, full seven-pair handshake gate, or promotion work was
started.

Freedom asked to use open prices only for faster diagnostics. The Gate 90 runner
now supports `--bar-path-mode=open`. This is a fast conservative proxy, not
final fill truth. It will miss intrabar target touches that OHLC/MT5 can catch.

## Runner Additions

Added summary receipts for actual replayed close cycles:

- `close_event_avg_realized_pnl_adr`
- `close_event_avg_mfe_adr`
- `close_event_avg_mae_adr_abs`
- `close_event_mfe_1q_hit_count`
- `close_event_mfe_2q_hit_count`
- `close_event_mfe_3q_hit_count`
- `close_event_mfe_1q_hit_pct`
- `close_event_mfe_2q_hit_pct`
- `close_event_mfe_3q_hit_pct`
- `close_event_mae_1q_hit_count`
- `close_event_mae_2q_hit_count`
- `close_event_mae_3q_hit_count`
- `close_event_mae_1q_hit_pct`
- `close_event_mae_2q_hit_pct`
- `close_event_mae_3q_hit_pct`

MFE means Maximum Favorable Excursion. MAE means Maximum Adverse Excursion. In
this runner they are measured from each closed side-cycle's observed
`max_pnl_adr` and negative `min_pnl_adr`.

## Artifacts

- Open smoke:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-smoke-audchf-1w/`
- OOS4 open MFE:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-oos4-5w-david-only-mfe/`
- 2026 open MFE:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2026-26w-david-only-mfe/`
- 2019 open full close-event attribution:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/`
- 2019 open no-Candidate-B comparison summary:
  `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-summary-mfe/`

## Open-Price Summary

Percent values are account percent against the `10,000` starting balance.

### OOS4 Open, 5 Weeks

Window: `2022-01-10..2022-02-07`, all 28 pairs, open-only path,
ADR-event brick `0.10`, David MA `50`, spacing `0.20`, NY daily window.

| Rule | Return | DD | R/DD | Entries | Avg / Entry | PF | Win | Avg Win | Avg Loss | Avg MFE | Avg MAE | MFE 1Q | MFE 2Q | MFE 3Q | Flatten |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `triangle_v1_david_contra_extension` | `-0.82%` | `2.14%` | `-0.38` | `1,315` | `-0.00062%` | `0.896162` | `71.70%` | `0.01086%` | `0.03069%` | `0.151512 ADR` | `0.354344 ADR` | `19.82%` | `6.94%` | `1.98%` | `-6.93%` |
| `david_contra` | `-1.08%` | `4.20%` | `-0.26` | `2,560` | `-0.00042%` | `0.936481` | `83.87%` | `0.01392%` | `0.07731%` | `0.217481 ADR` | `0.563935 ADR` | `29.60%` | `14.51%` | `7.07%` | `-16.00%` |
| `triangle_v0_no_candidate_b` | `+0.51%` | `0.01%` | `68.92` | `77` | `0.00662%` | `2.536091` | `72.22%` | `0.02159%` | `0.02213%` | `0.303757 ADR` | `0.265611 ADR` | `51.85%` | `9.26%` | `1.85%` | `-0.17%` |

### 2026 Open, 26 Weeks

Window: `2025-12-08..2026-05-31`, all 28 pairs, open-only path,
ADR-event brick `0.025`, David MA `25`, spacing `0.10`, NY daily window.

| Rule | Return | DD | R/DD | Entries | Avg / Entry | PF | Win | Avg Win | Avg Loss | Avg MFE | Avg MAE | MFE 1Q | MFE 2Q | MFE 3Q | Flatten |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `triangle_v1_david_contra_extension` | `-11.08%` | `11.08%` | `-1.00` | `38,596` | `-0.00029%` | `0.740719` | `54.91%` | `0.00164%` | `0.00269%` | `0.024778 ADR` | `0.088400 ADR` | `0.34%` | `0.10%` | `0.06%` | `-34.86%` |
| `david_contra` | `+0.46%` | `9.48%` | `0.05` | `36,744` | `0.00001%` | `1.005488` | `83.13%` | `0.00513%` | `0.02514%` | `0.093394 ADR` | `0.348953 ADR` | `30.05%` | `3.67%` | `1.62%` | `-75.37%` |
| `triangle_v0_no_candidate_b` | `-2.95%` | `2.99%` | `-0.99` | `179` | `-0.01650%` | `0.119232` | `81.25%` | `0.00513%` | `0.18629%` | `0.101837 ADR` | `1.821073 ADR` | `4.17%` | `0.00%` | `0.00%` | `-3.35%` |

### 2019 Open, 38 Weeks

Window: `2019-04-14..2019-12-30`, all 28 pairs, open-only path,
ADR-event brick `0.075`, David MA `50`, spacing `0.20`, NY daily window.

| Rule | Return | DD | R/DD | Entries | Avg / Entry | PF | Win | Avg Win | Avg Loss | Avg MFE | Avg MAE | MFE 1Q | MFE 2Q | MFE 3Q | Flatten |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `triangle_v1_david_contra_extension` | `-0.74%` | `9.92%` | `-0.07` | `15,567` | `-0.00005%` | `0.984393` | `62.70%` | `0.00599%` | `0.01024%` | `0.084869 ADR` | `0.204106 ADR` | `9.12%` | `1.96%` | `0.59%` | `-42.24%` |
| `david_contra` | `+9.30%` | `11.32%` | `0.82` | `23,321` | `0.00040%` | `1.074854` | `83.80%` | `0.01202%` | `0.05788%` | `0.201379 ADR` | `0.466685 ADR` | `30.01%` | `10.64%` | `4.01%` | `-117.42%` |
| `triangle_v0_no_candidate_b` | `+1.17%` | `2.19%` | `0.54` | `689` | `0.00170%` | `1.229681` | `79.30%` | `0.01746%` | `0.05439%` | `0.277514 ADR` | `0.407060 ADR` | `46.92%` | `8.15%` | `2.64%` | `-4.62%` |

## MFE Read

Broad David-only v1 extension does not currently support bigger targets.

- In 2019 open, v1 David-only average MFE is only `0.084869 ADR`; only
  `9.12%` of cycles reach `1Q`, only `1.96%` reach `2Q`, and only `0.59%`
  reach `3Q`.
- In 2026 open, v1 David-only is worse: average MFE is `0.024778 ADR`, and
  only `0.34%` of cycles reach `1Q`.
- Strict `triangle_v0_no_candidate_b` has better per-trade MFE in OOS4 and
  2019 (`0.303757 ADR` and `0.277514 ADR`) and much higher `1Q` hit rates
  (`51.85%` and `46.92%`), but 2026 exposes a tail problem:
  average MAE `1.821073 ADR`, PF `0.119232`, and `-2.95%` return from only
  `179` entries.

Plain read: bigger targets belong only to a premium/Katarakti class. Broad v1
extension needs fewer, better starts before target expansion.

## 2019 Red-Flag Attribution

Full close-event rows were retained for 2019 open v1 David-only.

Close reason split:

| Close Reason | Count | Net | PF | Win | Avg MFE | Avg MAE |
|---|---:|---:|---:|---:|---:|---:|
| `target` | `10,946` | `+41.51%` | `34.769` | `67.59%` | `0.0785 ADR` | `0.0790 ADR` |
| `session_flatten` | `1,417` | `-42.24%` | `0.081` | `24.98%` | `0.1339 ADR` | `0.7982 ADR` |

2019 is not failing because target closes are bad. It is failing because a
small number of unresolved sessions flatten with large adverse inventory.

Worst pair/side net cells:

| Pair Side | Count | Net | Target | Flatten | Avg MFE | Avg MAE |
|---|---:|---:|---:|---:|---:|---:|
| `GBPJPY SHORT` | `285` | `-2.07%` | `+1.69%` | `-3.76%` | `0.07 ADR` | `0.25 ADR` |
| `USDJPY LONG` | `426` | `-0.83%` | `+0.97%` | `-1.80%` | `0.08 ADR` | `0.22 ADR` |
| `AUDJPY SHORT` | `87` | `-0.74%` | `+0.17%` | `-0.91%` | `0.07 ADR` | `0.31 ADR` |
| `GBPUSD SHORT` | `311` | `-0.71%` | `+1.55%` | `-2.27%` | `0.07 ADR` | `0.17 ADR` |
| `AUDJPY LONG` | `201` | `-0.65%` | `+0.59%` | `-1.24%` | `0.09 ADR` | `0.34 ADR` |
| `EURJPY LONG` | `154` | `-0.58%` | `+0.66%` | `-1.25%` | `0.11 ADR` | `0.36 ADR` |

Monthly split:

| Month | Count | Net | Target | Flatten | Avg MFE | Avg MAE |
|---|---:|---:|---:|---:|---:|---:|
| `2019-04` | `642` | `+0.07%` | `+1.73%` | `-1.66%` | `0.09 ADR` | `0.16 ADR` |
| `2019-05` | `1,421` | `+1.04%` | `+4.23%` | `-3.19%` | `0.09 ADR` | `0.12 ADR` |
| `2019-06` | `1,345` | `+0.59%` | `+4.52%` | `-3.93%` | `0.10 ADR` | `0.15 ADR` |
| `2019-07` | `1,123` | `-0.28%` | `+3.28%` | `-3.56%` | `0.09 ADR` | `0.14 ADR` |
| `2019-08` | `2,068` | `-1.93%` | `+6.02%` | `-7.96%` | `0.07 ADR` | `0.19 ADR` |
| `2019-09` | `1,000` | `-0.70%` | `+3.95%` | `-4.65%` | `0.10 ADR` | `0.16 ADR` |
| `2019-10` | `2,034` | `-1.07%` | `+9.36%` | `-10.44%` | `0.08 ADR` | `0.19 ADR` |
| `2019-11` | `993` | `+1.62%` | `+3.49%` | `-1.87%` | `0.10 ADR` | `0.13 ADR` |
| `2019-12` | `1,558` | `+0.07%` | `+4.54%` | `-4.46%` | `0.07 ADR` | `0.15 ADR` |

The worst event dates cluster around `2019-08-01` and `2019-10-10..2019-10-11`.
That lines up with external macro-shock candidates: the August 1 tariff/risk
move, and the October sterling rally on Brexit-deal optimism. This is an
inference from the artifact timestamps plus public market context, not a
red-news implementation.

Sources used for public market context:

- MarketWatch, August 1 2019 tariff-risk market move:
  `https://www.marketwatch.com/story/stock-futures-bounce-after-fed-disappointment-sparks-selloff-2019-08-01`
- The Guardian, October 11 2019 sterling surge on Brexit-deal hopes:
  `https://www.theguardian.com/business/2019/oct/11/pound-surges-as-hopes-of-brexit-deal-rise`

## Decision Read

Do not freeze broad v1 David-only extension as the bot.

For no-Candidate-B work, the better immediate shape is:

1. David-only direction.
2. Valid Triangle harvestable geometry.
3. Stricter start quality than broad session-mid extension.
4. Katarakti or Katarakti-like confluence as the premium class.
5. Bigger targets only for premium/Katarakti class.
6. Small/normal target for ordinary geometry starts, or omit ordinary starts
   until churn controls improve.
7. Explicit lockout / add-block rules before adding risk after profit.
8. 2019 protection gate focused on session-flatten damage, not target-close
   behavior.

Monkey version:

- The good trades pop fast.
- The bad trades sit there and get killed at the daily close.
- Broad v1 is taking too many weak pops.
- Strict v0 is fewer trades and better per-trade quality, but one bad shock can
  still hurt.
- So the next shape should be fewer starts, not bigger targets everywhere.
- Big target only when the trade has the premium Katarakti label.
- Everything else must either take the small win or not trade.
