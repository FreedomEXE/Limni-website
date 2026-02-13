# Test Catalog

Canonical registry for recent research tests with explicit rules and short outcomes.  
Machine-readable source: `reports/test-catalog.json`.

## Universal

| Test ID | Rule Descriptor | Key Outcome |
| --- | --- | --- |
| `universal_truth_sweep_2026_02_13` | Sweep trailing start/offset combos (universal + per-model lock simulations) | Best cluster: start `30`, offset `8-12`; hold baseline `370.49%`, worst week `-13.43%`. |
| `universal_deep_analysis_2026_02_13` | Weekly close/peak/low/intraweek DD + basket comparison | Peaks and drawdowns are both very large (max peak `172.85%`, max intraweek DD `97.03%`). |
| `universal_scaleout_20pct_daily_2026_02_13` | Close `20%` of original basket daily at `16:30 ET` Mon-Fri (pro-rata) | DD improved (`76.91% -> 35.38%` avg), but return dropped (`373.28% -> 210.01%`). |
| `universal_hourly_scaleout_1pct_20on_4off_2026_02_13` | Close `1%` hourly, active `20:00-15:00 ET`, pause `16:00-19:59 ET` | DD improved (`77.09% -> 29.31%` avg), but return dropped further (`371.57% -> 191.14%`). |
| `universal_winners_hold_losers_flip_refresh_2026_02_13` | Hold losers across weeks, close invalid flips on refresh; compare no-trailing vs winners-hourly | Winners-hourly variant underperformed this carry model in the test window (`57.79%` vs `704.21%`). |
| `universal_hybrid_policy_2026_02_13` | Flips + neutral trailing/EOW neutral close + winners-only hourly + capped winner adds | Balanced profile in this run: `231.09%` total with `69.87%` overall max DD and 100% weekly win rate. |
| `universal_v1_winners_weekly_harvest_losers_carry_2026_02_13` | Winners harvested weekly, losers carried if valid, flips closed, hard/emergency stops | Static baseline DD stayed `0%`, but left-on-table remained high (`avg 41.88%`). |
| `universal_v1_weekly_adds_comparison_2026_02_13` | V1 no-adds vs weekly loser normalization adds | Loser adds did not improve total return and worsened drawdown/retention metrics. |
| `universal_v1_adaptive_trail_sweep_2026_02_13` | Dynamic trailing from rolling historical average peak vs static 30/10 | Adaptive aggressive variant led (`336.01%` total, `14.33%` avg left-on-table, `0%` baseline DD). |
| `universal_v1_trigger_basis_comparison_2026_02_13` | Compare trail trigger basis: net basket peak vs winners-only peak vs winners-peak with net gate | Winners-only peak lifted total slightly (`338.18%` vs `336.01%`) but worsened retention/giveback; net-peak stayed best balanced. |

Hourly 1% caution: real execution must respect broker `min_volume` and `volume_step`. Small positions (for example `0.21`) cannot be split into 100 exact pieces; implementation needs per-position accumulator/quantization logic.
Carry+flip caution: this simulation is very sensitive to risk constraints and should be treated as directional until lot caps/margin/financing constraints are modeled.

## Model Logic

| Test ID | Rule Descriptor | Key Outcome |
| --- | --- | --- |
| `blended_weighted_vs_agreement_current_2026_02_12` | Weighted blended (`60/40`) vs strict dealer-commercial agreement | Weighted outperformed current-week snapshot (`21.41%` vs `13.51%`) with more signals (`24` vs `3`). |
| `blended_weighted_vs_agreement_historical_2026_02_12` | Same comparison over available historical window | Weighted won all tested weeks (`4/4`), with higher total (`78.30%` vs `44.53%`). |

## Range Filter

| Test ID | Rule Descriptor | Key Outcome |
| --- | --- | --- |
| `range_filter_5y_short_only_2026_02_13` | Filter shorts only by 5Y range distance rule | Lower drawdown (`13.43% -> 11.84%`) but lower return (`340.34% -> 225.58%`). |
| `range_filter_5y_short_and_long_2026_02_13` | Symmetric short+long 5Y range filter | Bigger DD cut (`13.43% -> 5.70%`) with larger return loss (`340.34% -> 189.93%`). |

## Notes

- Most universal tests above are high-risk baseline simulations.
- For challenge planning in low-risk mode, directional interpretation is primary; magnitude can be approximated at roughly `0.1x` for quick sanity checks.
