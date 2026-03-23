/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Unified Katarakti Gated Sweep Results

Date: 2026-03-22

Files:
- [backtest-cfd-unified-katarakti-sweep.ts](c:/Users/User/Documents/GitHub/limni-website/scripts/backtest-cfd-unified-katarakti-sweep.ts)
- [cfd-unified-katarakti-sweep-latest.json](c:/Users/User/Documents/GitHub/limni-website/reports/cfd-unified-katarakti-sweep-latest.json)

## Purpose

Test whether Katarakti-style `sweep + rejection + displacement` entries can beat the current `MA+BB directional close + weekly 60 handshake` control when both are run on the same:

- 8 completed weeks
- OANDA M5 CFD data
- weekly basket handshake logic
- COT-date-aware gate modes

Gate modes:
- `UNGATED`: dealer + commercial + weekly sentiment snapshot
- `FROZEN`: dealer + commercial + daily sentiment lock at entry-window open
- `LIVE`: dealer + commercial + daily sentiment lock at candidate entry time

## High-level read

1. COT-date gating does matter, but mostly on the MA+BB control, not on the sweep family.
2. The sweep family produced stronger expectancy than the MA+BB control, but sample sizes are much smaller.
3. The strongest sweep results were the BB-confirm confluence variants, but they only produced ~27-28 trades in 8 weeks, so they are exploratory, not locked.
4. The practical benchmark remains the MA+BB control until a sweep variant shows the same strength on materially larger sample.

## Key results

### MA+BB control with weekly 60 handshake

- `mabb_dirclose__w60__ungated`
  - 272 trades
  - 52.94% session WR
  - 1.4136% avg week return
  - 1.6734% avg week MAE

- `mabb_dirclose__w60__frozen`
  - 233 trades
  - 48.93% session WR
  - 1.5679% avg week return
  - 1.9271% avg week MAE

- `mabb_dirclose__w60__live`
  - 247 trades
  - 48.18% session WR
  - 1.5166% avg week return
  - 1.8454% avg week MAE

Interpretation:
- applying COT-date gating reduced trade count materially on the MA+BB control
- gating improved avg week return modestly
- but it did not improve session win rate and did not reduce avg week MAE in this control family

### Sweep + rejection + displacement

Best exploratory result:

- `sweep_010__w60__bb_confirm__live`
  - 27 trades
  - 51.85% session WR
  - 3.7815% avg week return
  - 3.2607% avg week MAE

Comparable siblings:

- `sweep_010__w60__bb_confirm__frozen`
  - 28 trades
  - 50.00% session WR
  - 3.6893% avg week return
  - 3.1713% avg week MAE

- `sweep_010__w60__bb_confirm__ungated`
  - 28 trades
  - 53.57% session WR
  - 3.6160% avg week return
  - 3.1897% avg week MAE

Interpretation:
- the entry model looks real
- BB-confluent sweep entries were the strongest family in this run
- gate mode barely changed the sweep results
- but the sample is too small to lock

### Sweep without BB confluence

- `sweep_010__w60__ungated`
  - 59 trades
  - 50.85% session WR
  - 2.1194% avg week return

- `sweep_010__w60__frozen`
  - 59 trades
  - 49.15% session WR
  - 2.1572% avg week return

- `sweep_010__w60__live`
  - 57 trades
  - 49.12% session WR
  - 2.2418% avg week return

Interpretation:
- even the plain sweep family outperformed the MA+BB control on avg week return
- gate mode again had only mild effect
- sample still too small for lock

## Main conclusion

The user’s gating note was correct to test, but the result is nuanced:

- `COT-date gating` is not the thing making the sweep family work
- the bigger change is the `entry model` itself
- for the MA+BB control, gating changes the book shape more visibly
- for the sweep family, `UNGATED / FROZEN / LIVE` are mostly close together

So the current read is:

- `entry model` > `gate timing` as the main source of improvement
- but sweep variants still need a broader sample before replacing the current control

## Next sensible moves

1. Promote the sweep family to focused follow-up testing, not production lock.
2. Compare only the most credible subset:
   - `sweep_010__w60`
   - `sweep_010__w60__bb_confirm`
   - `mabb_dirclose__w60`
3. Run wider-window or additional-history testing if possible.
4. If continuing with sweep entries, add proper exit research next instead of stacking more entry filters immediately.
