# Tandem Sleeve Portfolios

Date: 2026-04-01
Script: `scripts/backtest-tandem-sleeve-portfolios.ts`
Window: canonical weekly-hold + ADR-normalized, 10 realized weeks from `run_id = 54`

## Goal

Test whether tandem should be managed as independent strategy sleeves so one basket can stop out while the others keep running.

Portfolios tested:

- `Legacy Tandem` = Dealer + Commercial + Sentiment
- `Tandem 4` = Dealer + Commercial + Sentiment + Strength
- `Tandem 3` = Dealer + Sentiment + Strength

Variants tested:

- `Friday Hold`
- `Shared SL 0.10`
- `Sleeves SL 0.10`
- `Shared 0.15 / 0.15 / 0.10`
- `Sleeves 0.15 / 0.15 / 0.10`

## Parity

Legacy tandem Friday-hold sleeve sum matched the canonical engine exactly:

- Engine tandem: `+127.51%`, DD `-24.24%`
- Sleeve-sum Friday hold: `+127.51%`, DD `-24.24%`

## Portfolio Summary

| Portfolio | Variant | Net | Max DD | R/DD | Losing Weeks | Win Rate |
|---|---:|---:|---:|---:|---:|---:|
| Legacy Tandem | Friday Hold | `+127.51%` | `-24.24%` | `5.3x` | 3 | 70% |
| Legacy Tandem | Shared SL 0.10 | `+122.75%` | `-29.00%` | `4.2x` | 4 | 60% |
| Legacy Tandem | Sleeves SL 0.10 | `+141.52%` | `-27.12%` | `5.2x` | 4 | 60% |
| Legacy Tandem | Shared 0.15 / 0.15 / 0.10 | `+124.51%` | `-29.00%` | `4.3x` | 4 | 60% |
| Legacy Tandem | Sleeves 0.15 / 0.15 / 0.10 | `+152.58%` | `-17.43%` | `8.8x` | 3 | 70% |
| Tandem 4 | Friday Hold | `+208.40%` | `-39.22%` | `5.3x` | 4 | 60% |
| Tandem 4 | Shared SL 0.10 | `+203.27%` | `-44.35%` | `4.6x` | 4 | 60% |
| Tandem 4 | Sleeves SL 0.10 | `+203.85%` | `-38.54%` | `5.3x` | 4 | 60% |
| Tandem 4 | Shared 0.15 / 0.15 / 0.10 | `+201.79%` | `-30.63%` | `6.6x` | 3 | 70% |
| Tandem 4 | Sleeves 0.15 / 0.15 / 0.10 | `+218.82%` | `-15.63%` | `14.0x` | 3 | 70% |
| Tandem 3 | Friday Hold | `+246.47%` | `-29.22%` | `8.4x` | 4 | 60% |
| Tandem 3 | Shared SL 0.10 | `+222.10%` | `-37.80%` | `5.9x` | 5 | 50% |
| Tandem 3 | Sleeves SL 0.10 | `+226.25%` | `-29.14%` | `7.8x` | 4 | 60% |
| Tandem 3 | Shared 0.15 / 0.15 / 0.10 | `+252.51%` | `-16.98%` | `14.9x` | 4 | 60% |
| Tandem 3 | Sleeves 0.15 / 0.15 / 0.10 | `+230.08%` | `-10.93%` | `21.0x` | 2 | 80% |

## Main Read

1. `Commercial` remains a drag as a sleeve. Removing it from capital allocation improved the portfolio materially.
2. `Tandem 3` was the strongest base portfolio in this window:
   - `+246.47%`, DD `-29.22%`, `8.4x`
3. Shared-basket stop logic did **not** validate the thesis:
   - shared SL often worsened both net and drawdown
4. Independent sleeve management did validate the thesis better than shared management:
   - `Legacy Tandem`: sleeves `0.15/0.15/0.10` beat Friday hold on both net and DD
   - `Tandem 4`: sleeves `0.15/0.15/0.10` beat Friday hold on both net and DD
   - `Tandem 3`: sleeves `0.15/0.15/0.10` cut DD hard and reduced losing weeks from 4 to 2, but gave up some net vs Friday hold
5. Best balance depends on objective:
   - maximize raw return: `Tandem 3 Friday Hold` or `Tandem 3 Shared 0.15/0.15/0.10`
   - maximize robustness / reduce bad weeks: `Tandem 3 Sleeves 0.15/0.15/0.10`

## Important Week-Level Examples

### 2026-03-03

Independent sleeves helped:

- `Tandem 4 Friday Hold`: `-12.1%`
- `Tandem 4 Sleeves 0.15/0.15/0.10`: `-0.4%`
- Strength trailed out positive while Dealer, Commercial, and Sentiment were cut

### 2026-03-09

Independent sleeves helped:

- `Legacy Tandem Friday Hold`: `-10.5%`
- `Legacy Tandem Sleeves 0.15/0.15/0.10`: `+4.2%`
- `Tandem 4 Friday Hold`: `-12.4%`
- `Tandem 4 Sleeves 0.15/0.15/0.10`: `+15.3%`
- `Tandem 3 Friday Hold`: `-5.2%`
- `Tandem 3 Sleeves 0.15/0.15/0.10`: `+17.6%`

### 2026-03-23

Strength carried while others were cut:

- `Tandem 4 sleeves 0.15/0.15/0.10`
  - Dealer: `+2.5% -> -2.4% SL`
  - Commercial: `-0.8% -> -2.4% SL`
  - Sentiment: `-11.7% -> -2.4% SL`
  - Strength: `-2.5% -> +2.1% TRAIL`
  - Portfolio: `-5.1%`

- `Tandem 3 sleeves 0.15/0.15/0.10`
  - Dealer: `+2.5% -> -2.4% SL`
  - Sentiment: `-11.7% -> -2.4% SL`
  - Strength: `-2.5% -> +2.1% TRAIL`
  - Portfolio: `-2.7%`

## Recommendation

Do **not** add basket exits to the app yet.

The stronger next research branch is:

1. Treat tandem as a portfolio of independent sleeves, not one monolithic basket.
2. Move forward with `Tandem 3` research first.
3. Keep `Commercial` in data collection, but do not assume it deserves capital allocation.
4. If live-forward testing is needed next, compare:
   - `Tandem 3 Friday Hold`
   - `Tandem 3 Sleeves 0.15 / 0.15 / 0.10`

That isolates the real decision:

- max upside vs
- lower drawdown / fewer bad weeks
