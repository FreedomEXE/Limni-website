# Gate 90 David RSI100 60/40 And Stoch 100/3/100 Full-History Selection

Generated: `2026-07-02`

## Verdict

`PASS_GATE90_DAVID_RSI1006040_STOCH100_3_100_FULL_HISTORY_SELECTION_DIAGNOSTIC_ONLY`

## Parking Read

This research point is saved as a useful diagnostic seed, not a promotion path.
The David/Stoch activation rules improved the raw always-on inventory shape, but
the resulting weekly equity profit factors were not strong enough to justify
continuing deeper optimization before rechecking Candidate B under the same
continuous carried-position, commission, swap, and terminal-liquidation model.

No broad settings-optimization matrix was run in this pass. The completed matrix
was a rule matrix around Freedom's corrected handpicked settings:

- David MA template: `LWMA35`, close price, RSI `100`, OB `60`, OS `40`.
- Stochastic: `K=100`, `D=3`, slowing `100`, Low/High, Simple, main line only.

Next research comparison should return to Candidate B and add the proper
Gate 89/Gate 90 fee model before judging whether directional selection beats
the David/Stoch one-sided activation candidates.

Follow-up fast Candidate B read:

- Added `candidate_b` as a Gate 90 one-sided activation rule using the locked
  Gate 74B `candidate_b_side`; it controls missing side-cycle starts only and
  does not force weekly flip closes.
- Same generic Gate 90 cost model was used: `0.06` USD entry commission per
  `0.01` lot, EURUSD-derived long/short swap, quote-to-USD PnL conversion, and
  explicit terminal liquidation.
- 26-week recent close-only screen (`2025-12-08..2026-05-31`) was weak:
  `candidate_b` net `-$2,194.71`, PF `0.871184`, max equity DD `-$5,014.25`;
  `david_stoch_release` net `+$9,050.03`, PF `2.52717`, max equity DD
  `-$1,996.77`.
- 5-week recent OHLC screen had `candidate_b` positive at `+$384.94`, but it
  still trailed the stronger David/Stoch candidates.
- Current parking read: treat Candidate B, David/Stoch, and raw always-on
  activation as weak/diagnostic for now; do not promote or optimize from this
  evidence.

Signal-calculation note:

- David MA/Stoch signals were calculated from the Gate 74B `1m` path warehouse.
  The runner reconstructs one closed bar per warehouse M1 point, updates
  RSI/LWMA/Stoch once per M1 bar, and uses the previous completed signal state
  for that bar's activation decision.
- No higher-timeframe David/Stoch aggregation was used in these tests.

## Scope

- Gate 90 warehouse activation research only.
- All available Gate 74B trade-leg path warehouse span: `373` weeks, `28` pairs, `2019-04-14T23:00:00.000Z..2026-05-31T23:00:00.000Z`.
- Grid mechanics stayed fixed: target `1.0` ADR, spacing `0.2` ADR, lot `0.01`, carried side grids, terminal liquidation explicit.
- David MA: template `LWMA35` close price, RSI period `100`, overbought `60`, oversold `40`.
- Stochastic: `K=100`, `D=3`, slowing `100`, Low/High, Simple, main line only, OB/OS `80/20`.
- Runner now supports CLI signal settings, comma-separated `--activation-rules`, `--summary-only`, and shared signal replay across variants.

## Full Close-Only Screen

Close-only was used as the broad optimizer screen across all six core rules. It is not the final MT5-parity OHLC truth.

| activation_rule_id | net_profit_usd | max_equity_drawdown_usd | max_open_positions | terminal_positions | total_swap_usd |
|---|---:|---:|---:|---:|---:|
| david_stoch_release | 64,354.26 | -61,940.24 | 1,450 | 1,179 | -70,920.82 |
| david_contra | 42,745.14 | -74,632.66 | 2,037 | 1,799 | -85,039.73 |
| david_stoch_confirm | 17,111.74 | -67,815.54 | 1,596 | 1,445 | -74,293.03 |
| stoch_contra | 6,243.95 | -99,272.02 | 2,112 | 1,989 | -110,625.43 |
| raw_both | -82,982.99 | -138,526.68 | 2,977 | 2,667 | -144,488.06 |
| david_with | -94,624.65 | -149,419.97 | 2,888 | 2,648 | -135,081.52 |

Screen read: `david_stoch_release` was the best broad protection/harvest blend. `david_contra` was second on net, but carried larger drawdown and inventory. `david_with` was rejected.

## Exact OHLC Finalists

Exact run used `ohlc_high_low`, matching the Gate 89 MT5-parity-style warehouse path mode. Finalists were `raw_both`, `david_stoch_release`, `david_contra`, and `david_stoch_confirm`.

| activation_rule_id | net_profit_usd | max_equity_drawdown_usd | max_open_positions | terminal_positions | total_swap_usd |
|---|---:|---:|---:|---:|---:|
| david_contra | 123,539.90 | -65,451.04 | 1,884 | 1,689 | -77,072.44 |
| david_stoch_release | 80,156.40 | -54,509.25 | 1,286 | 968 | -64,149.69 |
| david_stoch_confirm | 56,335.77 | -70,035.51 | 1,554 | 1,533 | -67,200.70 |
| raw_both | 48,141.70 | -119,605.92 | 2,856 | 2,558 | -136,862.21 |

## Interpretation

`david_contra` is the highest-harvest exact OHLC rule in this pass: it adds `$75,398.20` net versus raw and cuts max equity drawdown by `$54,154.88`.

`david_stoch_release` is the stronger deployment-shape candidate: it adds `$32,014.70` net versus raw while cutting max equity drawdown by `$65,096.67`, max open positions by `1,570`, terminal positions by `1,590`, and swap drag by `$72,712.52`.

`david_stoch_confirm` improves raw but trails release on net, drawdown, and terminal inventory in exact OHLC.

Current one-sided read:

- Keep `david_stoch_release` as the leading protection candidate.
- Keep `david_contra` as the leading harvest candidate and polarity reference.
- Reject `david_with` from this setting family for now.
- Do not open double-sided in-between policy yet.

## Artifacts

- Close-only screen report: `docs/research/gates/gate90/GATE90_FULL_ALLPAIRS_CORE_CLOSE_DAVID1006040_STOCH100_3_100_SUMMARY_2026-07-02.md`
- Close-only screen artifacts: `docs/research/gates/gate90/artifacts/full-allpairs-core-close-david1006040-stoch100-3-100-summary/`
- Exact OHLC finalist report: `docs/research/gates/gate90/GATE90_FULL_ALLPAIRS_FINALISTS_OHLC_DAVID1006040_STOCH100_3_100_SUMMARY_2026-07-02.md`
- Exact OHLC finalist artifacts: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/`

## Stop Line

This is diagnostic warehouse research only. It does not promote strategy logic, change MT5, retune target/spacing, add pair-specific swaps, simulate margin stopout, or open live/app integration.
