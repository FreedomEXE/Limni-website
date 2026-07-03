# Gate 90D 2019 Open ADR-Normalized Breakdown

Generated: 2026-07-03

## Verdict

`PASS_GATE90D_2019_ADR_NORMALIZED_BREAKDOWN_VISIBLE_NO_PROMOTION`

The 2019 red-flag year is no longer a single annual number. The new diagnostic
breaks it into ADR-normalized trade, week, month, pair, pair-side, close-reason,
and strategy-class rows.

Headline return convention from here: `1 ADR = 1%`. So `+25.29%` means the
strategy harvested `25.29` ADR of price movement, reported as percent for
cross-currency comparison. Costed account return remains a secondary USD/equity
truth because commission and swap are not cleanly convertible into ADR units.

This run uses open prices only for speed. It is a conservative research proxy,
not final OHLC/MT5 fill truth.

## Scope

- Window: `2019-04-14T23:00:00.000Z..2019-12-30T00:00:00.000Z`.
- Pairs: all 28.
- Bar path mode: `open`.
- Signal clock: ADR event, brick `0.075`.
- David: LWMA `50`, RSI `50`, levels `60/40`.
- Session: New York daily window, start `18:05`, cutoff `15:45`, flatten
  `16:00`, Sunday start `20:00`.
- Target: David MA reversion.
- Spacing: `0.20 ADR` baseline; Triangle rules use adaptive range/3 spacing
  clamped to `0.20..0.30 ADR`.
- Adds: adverse only.
- Candidate B is excluded from the v1 focus path. The strict Katarakti row is
  `triangle_v0_no_candidate_b`.

## Annual Summary

| Rule | Strategy class | ADR return % | Account return % | Max account DD % | ADR return / DD | Account R/DD | Entries | Close cycles | Costed PF | Costed win % | Avg ADR / cycle |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `triangle_v1_david_contra_extension` | geometry extension | `+177.43` | `-0.74` | `-9.92` | `17.89` | `-0.07` | `15,567` | `12,363` | `0.984` | `62.70` | `+0.0144` |
| `david_contra` | standalone David | `+392.37` | `+9.30` | `-11.32` | `34.65` | `0.82` | `23,321` | `13,257` | `1.075` | `83.80` | `+0.0296` |
| `triangle_v0_no_candidate_b` | strict Katarakti | `+25.29` | `+1.17` | `-2.19` | `11.55` | `0.54` | `689` | `454` | `1.230` | `79.30` | `+0.0557` |

Read: David-only can harvest the most ADR movement, but it carries the most
open exposure and still lets session flatten do heavy damage. Strict Katarakti
is much cleaner and lower exposure, but it is not enough total harvest by
itself.

## MFE / MAE And Average Trade Shape

MFE is Maximum Favorable Excursion. MAE is Maximum Adverse Excursion. The
average win/loss columns below are ADR price movement only, so they line up with
the `1 ADR = 1%` convention. Costed PF/win-rate above still use net USD after
commission/swap.

| Rule | ADR price wins | ADR price losses | Avg win % | Avg loss % | Avg win/loss | Avg MFE % | Avg MAE % | MFE >= 1Q | MFE >= 2Q | MFE >= 3Q |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `triangle_v1_david_contra_extension` | `11,340` | `1,016` | `+0.0798` | `-0.7162` | `0.111` | `0.0849` | `0.2041` | `9.12%` | `1.96%` | `0.59%` |
| `david_contra` | `11,367` | `1,883` | `+0.2085` | `-1.0500` | `0.199` | `0.2014` | `0.4667` | `30.01%` | `10.64%` | `4.01%` |
| `triangle_v0_no_candidate_b` | `367` | `85` | `+0.2934` | `-0.9692` | `0.303` | `0.2775` | `0.4071` | `46.92%` | `8.15%` | `2.64%` |

Read: strict Katarakti has the best per-cycle quality, but average losses are
still larger than average wins. A blanket larger target is not supported yet.
The useful next test is Q-based trailing/profit-lock behavior, especially after
a cycle reaches `1Q` MFE.

## Close Reason

| Rule | Close reason | Close cycles | ADR return % | Account return % | PF | Avg ADR / cycle | Avg MFE % | Avg MAE % |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `triangle_v1_david_contra_extension` | target | `10,946` | `+835.38` | `+41.51` | `34.769` | `+0.0763` | `0.0785` | `0.1185` |
| `triangle_v1_david_contra_extension` | session_flatten | `1,417` | `-657.95` | `-42.24` | `0.081` | `-0.4643` | `0.1339` | `0.8651` |
| `david_contra` | target | `10,798` | `+2261.85` | `+126.72` | `303.067` | `+0.2095` | `0.2156` | `0.2854` |
| `david_contra` | session_flatten | `2,459` | `-1869.48` | `-117.42` | `0.052` | `-0.7603` | `0.1391` | `1.2626` |
| `triangle_v0_no_candidate_b` | target | `318` | `+100.16` | `+5.79` | `1162.111` | `+0.3150` | `0.3233` | `0.2240` |
| `triangle_v0_no_candidate_b` | session_flatten | `136` | `-74.86` | `-4.62` | `0.096` | `-0.5504` | `0.1705` | `0.8351` |

Read: the target engine is not the 2019 problem. The problem is unresolved
cycles being forced out at session flatten. This supports Freedom's instinct:
do not let a blind EOD flatten eat the account. But blindly holding every ugly
red cycle is also not acceptable; it needs protection/trailing rules.

## Week And Month Stats

| Rule | ADR winning weeks | ADR losing weeks | ADR flat/no-close weeks | Account winning weeks | Account losing weeks | Best ADR week | Worst ADR week |
|---|---:|---:|---:|---:|---:|---|---|
| `triangle_v1_david_contra_extension` | `28` | `10` | `0` | `24` | `14` | `2019-08-04`, `+55.00%` | `2019-07-28`, `-97.28%` |
| `david_contra` | `29` | `9` | `0` | `26` | `12` | `2019-08-04`, `+91.13%` | `2019-07-28`, `-175.72%` |
| `triangle_v0_no_candidate_b` | `30` | `7` | `1` | `30` | `7` | `2019-09-29`, `+10.32%` | `2019-10-06`, `-25.07%` |

Month rows include `2020-01` because the final selected 2019 week can close
after the calendar turns.

| Rule | ADR winning months | ADR losing months | Best ADR month | Worst ADR month |
|---|---:|---:|---|---|
| `triangle_v1_david_contra_extension` | `9` | `1` | `2019-05`, `+52.42%` | `2019-08`, `-27.58%` |
| `david_contra` | `8` | `2` | `2019-05`, `+116.87%` | `2019-12`, `-36.37%` |
| `triangle_v0_no_candidate_b` | `7` | `3` | `2019-11`, `+11.67%` | `2019-10`, `-5.74%` |

## Pair Leaders And Laggards

### Strict Katarakti, No Candidate B

| Top pairs | ADR return % | Bottom pairs | ADR return % |
|---|---:|---|---:|
| `USDCAD` | `+7.66` | `AUDJPY` | `-13.52` |
| `USDJPY` | `+4.91` | `GBPJPY` | `-7.43` |
| `NZDUSD` | `+4.53` | `EURUSD` | `-2.70` |
| `GBPAUD` | `+4.50` | `USDCHF` | `-1.86` |
| `CADJPY` | `+3.99` | `EURGBP` | `-1.68` |

Worst pair-sides were `AUDJPY_LONG` `-13.80%`, `GBPJPY_SHORT` `-7.94%`,
`EURGBP_LONG` `-4.55%`, `GBPNZD_SHORT` `-4.13%`, and `USDCHF_SHORT`
`-2.35%`.

### Triangle v1 David Geometry Extension

| Top pairs | ADR return % | Bottom pairs | ADR return % |
|---|---:|---|---:|
| `NZDCAD` | `+25.64` | `AUDJPY` | `-31.06` |
| `AUDNZD` | `+25.63` | `GBPJPY` | `-21.46` |
| `USDCAD` | `+24.23` | `NZDJPY` | `-10.05` |
| `GBPCAD` | `+19.64` | `USDJPY` | `-9.99` |
| `GBPCHF` | `+19.50` | `EURJPY` | `-7.48` |

### Standalone David Contra

| Top pairs | ADR return % | Bottom pairs | ADR return % |
|---|---:|---|---:|
| `EURCAD` | `+53.36` | `AUDJPY` | `-44.84` |
| `AUDNZD` | `+44.24` | `GBPJPY` | `-31.77` |
| `NZDCAD` | `+38.86` | `NZDJPY` | `-22.31` |
| `USDCAD` | `+37.02` | `EURJPY` | `-8.86` |
| `NZDCHF` | `+35.86` | `AUDUSD` | `-8.27` |

Read: JPY-heavy pairs, especially `AUDJPY` and `GBPJPY`, remain the 2019 pain
cluster. This is evidence for protection rules, not permission to curve-fit
pair exclusions.

## Design Read

Katarakti trades are v1 trades, but not all v1 trades are Katarakti trades.
That distinction held up.

The likely shape is:

1. Direction: keep David-only/no-Candidate-B as the simple first bot path.
2. Geometry: require a valid harvestable Triangle/session regime before start.
3. Trigger: use general session-mid extension for ordinary v1 starts, but tag
   strict Katarakti as a premium confluence class.
4. Target/protection: ordinary v1 should use smaller/tighter targets or
   trailing; strict Katarakti may earn larger targets only when MFE receipts
   prove it.
5. EOD: green cycles can close; small red can be considered for hold/protect;
   ugly red must enter protection mode, not blind hold and not blind flatten.

The next 2019 pass should stay no-Candidate-B and test Q-based trailing /
profit-lock plus protected flatten behavior. Do not start MT5/live/app work,
promotion, red-news implementation, 2020/year-by-year expansion, full matrix
restart, or full seven-pair handshake from this report.

## Artifacts

- Report:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-adr-breakdown-no-candidate-b/GATE90D_2019_OPEN_ADR_BREAKDOWN_NO_CANDIDATE_B.md`
- Summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-adr-breakdown-no-candidate-b/activation-summary.rows.json`
- Close events:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-adr-breakdown-no-candidate-b/close-events.rows.json`
- Breakdown rows:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-adr-breakdown-no-candidate-b/close-event-breakdown.rows.json`

## Stop Line

Research-only diagnostic. No replay freeze, no promotion, no MT5/live/app work,
no 2020/year-by-year expansion, no full matrix restart, and no full seven-pair
handshake gate is opened here.
