/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# CFD Trigger Progress And Katarakti Reset
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

## Purpose

This note freezes the current CFD/crypto trigger research state and records the Katarakti audit before we pivot back to reevaluate Katarakti entries.

Date: 2026-03-21

---

## 1. Current CFD Trigger State

### Locked best entry baseline so far

- Entry family: `5m MA + Bollinger directional close`
- Base trigger:
  - weekly bias must align
  - `200 SMA` trend filter
  - `BB 20, 2.0`
  - candle tags the trend-side Bollinger band
  - same candle closes in the trade direction
- Gate:
  - weekly basket handshake `>= 60%`

### Best validated result

From `reports/cfd-handshake-sweep-latest.json`:

- Variant: `handshake_60pct__bb2_0`
- Trades: `336`
- Session WR: `53.87%`
- Avg week return: `1.7004%`
- Avg week MAE: `1.9041%`

### What is locked

- Weekly handshake is a real gate.
- Intraday handshake is informational only.
- RRanjan helps as context / alternate trigger family, but did not beat the MA+BB directional-close baseline in the matched `5m vs 5m` comparison.
- Indices are weak in this trigger family. FX + crypto are the useful asset classes.

### What was tested and shelved

- RRanjan standalone `5m`
  - slightly better session WR
  - lower expectancy than MA+BB
- Intraday SMA-side handshake
  - did not beat weekly handshake
- Real-time engulfing / RRanjan basket handshake
  - too restrictive as a gate
- Reclaim + micro swing stop
  - stop too tight
- Reclaim + 3-day stop
  - better risk shape
  - not better raw expectancy than weekly-handshake MA+BB
- Opposite-band exits
  - high WR
  - negative expectancy

### Manual matrix implication

Handshake should be surfaced visually, not used as a second noisy hard gate:

- show a pill like `W 71 | L 43`
- `W` = weekly handshake strength
- `L` = live / intraday handshake strength
- color states:
  - gray = no weekly coherence
  - amber = weekly coherence only
  - green = weekly + live coherence

---

## 2. Why We Paused Entry Tuning

Portfolio research confirmed the current entry is promising but still not clean enough to trust with aggressive book heat.

From `reports/cfd-portfolio-exit-research-latest.json`:

- `week_close` produced the most raw edge
- but open-book heat was too high
- the system still relies too much on holding through noise instead of precise entry timing

Conclusion:

- the current MA+BB + weekly handshake entry is the best baseline we have
- but it is still a baseline, not a finished production entry model

---

## 3. Katarakti Audit

The Performance app is currently showing mixed week counts because Katarakti variants do not all read from one canonical source.

There are three different source models in play:

1. legacy file / seed snapshots
2. DB-first strategy backtest snapshots
3. legacy file + appended live trade weeks

This is the real reason the app is showing `5` or `6` weeks instead of a clean `8`.

---

## 4. Root Cause Of The Week Mismatch

### Core CFD

Loader path:

- `src/lib/performance/kataraktiHistory.ts`
- function: `readMt5ForexSnapshot()`

Current source behavior:

- does **not** use `strategy_backtest_runs`
- uses legacy file candidates:
  - `reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.json`
  - then `reports/katarakti-phase1-backtest-latest.json`
- if file parsing fails, falls back to seed data in `src/lib/performance/kataraktiSeed.ts`
- then attempts to append live MT5 DB trades from `katarakti_trades`

Observed DB reality:

- no usable live MT5 rows were present in `katarakti_trades`
- so core CFD is effectively a pure legacy file / seed view

Important:

- `reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.json` is a **5-week** report
- that file is still one of the preferred sources for core CFD

So if the app shows `5 weeks` for Katarakti CFD core, that is expected from the current loader design.

### Core Crypto

Loader path:

- `src/lib/performance/kataraktiHistory.ts`
- function: `readCryptoFuturesSnapshot()`

Current source behavior:

- reads legacy files:
  - `docs/bots/backtest-weekly-summary.json`
  - `docs/bots/backtest-run-history.json`
  - `docs/bots/backtest-trade-log.json`
- default variant key = `C`
- then appends live DB weeks from `bitget_bot_trades`
  - bot id: `bitget_perp_v2`
  - dry-run only

Observed DB reality:

- `bitget_perp_v2` has `6` dry-run trades
- all of them belong to week `2026-02-23`

So crypto core is currently a hybrid:

- legacy 5-week snapshot
- plus 1 appended live week

That is why the app can show `6 weeks` for crypto core even though the legacy file set itself is only 5 weeks.

### Lite CFD / Lite Crypto / V3 Crypto

These use the DB-first registry path:

- `readRegistryDbFirstSnapshot()`

Observed DB reality from `strategy_backtest_runs`:

- `katarakti_cfd_lite`
  - generated `2026-03-03`
  - `backtest_weeks = 6`
- `katarakti_crypto_lite`
  - generated `2026-03-03`
  - `backtest_weeks = 6`
- `katarakti_v3_liq_sweep`
  - generated `2026-03-03`
  - `backtest_weeks = 6`

So if the app shows `6 weeks` for Lite or V3, that is also correct for the currently stored runs.

### Bottom line

The app is not failing randomly.

It is faithfully showing stale or hybrid source data:

- core CFD = legacy 5-week file / seed path
- core crypto = legacy 5-week file path + 1 live week
- lite/v3 = DB-stored 6-week runs from March 3

There is currently **no canonical 8-week Katarakti source** wired into the Performance page.

---

## 5. What Katarakti Is Actually Using

### Core CFD

Reference files:

- `scripts/katarakti-phase1-backtest.ts`
- `reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.md`
- `src/lib/performance/kataraktiHistory.ts`

Current pinned style in the app is effectively the old phase-2 MT5 model:

- timeframe: `H1`
- entry mode: `sweep`
- strategy type: session-based counter-trend liquidity sweep
- exit mode in the preferred legacy report: `stepped_no_hard_sl`
- lock style in the preferred legacy report: `atr`
- correlation handshake exists in this phase-2 family
- selected variant in the preferred report family:
  - `tiered__t1t2__weighted`

Important:

- there is also a newer `8-week` generic report:
  - `reports/katarakti-phase1-backtest-latest.json`
- but the app’s core CFD loader still prefers the older phase-2 no-hard-ATR report candidate first

### Core Crypto

Reference files:

- `docs/bots/bitget-v2-strategy-decisions.md`
- `docs/bots/backtest-weekly-summary.json`
- `docs/bots/backtest-run-history.json`
- `src/lib/performance/kataraktiHistory.ts`

Core crypto is still tied to the old Bitget v2 legacy snapshot model:

- weekly BTC/ETH bias
- session structure
- sweep / rejection / displacement logic
- handshake-heavy architecture
- scaling / overnight hold concepts
- default legacy variant key in the loader: `C`

Important:

- the app’s displayed core crypto number is not a clean rerun from the current codebase
- it is a legacy snapshot plus appended live dry-run week

### Lite CFD

Reference files:

- `reports/katarakti-lite-parameter-sweep-latest.txt`
- `reports/katarakti-lite-ablation-latest.txt`

Best sweep variant in the current stored 6-week report:

- `lite_d5_c035_aoff`
- interpretation:
  - dwell `5`
  - close-location `0.35`
  - ATR floor `off`

Ablation takeaway:

- `reentry_close_location_dwell`
- and `reentry_close_location_dwell_atr_floor`
- were the best risk-adjusted Lite family ideas in the ablation set

### Lite Crypto

Reference file:

- `reports/bitget-lite-entry-latest.json`

What is confirmed:

- currently stored run is `6 weeks`
- total return about `+77.41%`
- max DD about `27.99%`

What is still unclear without a fresh rerun:

- the exact final selected parameter set is not surfaced as cleanly as Lite CFD

### V3 Crypto

Reference files:

- `reports/bitget-liq-sweep-simple-latest.json`
- `reports/katarakti-v3-sustained-reentry-latest.txt`

Current DB/file-backed V3 run in the app is:

- `6 weeks`
- generated `2026-03-03`
- bot id: `katarakti_v3_liq_sweep`

The older sustained-reentry text report shows V3 itself was highly sensitive and not cleanly superior in the tested form.

---

## 6. What We Need To Do Next On Katarakti

The right move is not to compare current app cards. Those cards are not aligned to one common source model.

We need a clean Katarakti reset:

1. Choose the exact strategies we still care about:
   - core CFD
   - core crypto
   - lite CFD
   - lite crypto
   - v3 crypto

2. Reconstruct the actual rule sets for each one.

3. Rerun them all over the same `8-week` window:
   - `2026-01-19`
   - `2026-01-26`
   - `2026-02-02`
   - `2026-02-09`
   - `2026-02-16`
   - `2026-02-23`
   - `2026-03-02`
   - `2026-03-09` / canonical week open equivalent used by the repo

4. Persist those reruns into `strategy_backtest_runs` so the Performance page reads one canonical source for all non-legacy variants.

5. Decide whether core should remain legacy at all.

My recommendation:

- stop using the legacy core snapshot path as the source of truth
- rerun core CFD and core crypto explicitly
- write them into `strategy_backtest_runs`
- then switch the Performance page to DB-first for core too

---

## 7. Practical Next Questions

Before rebuilding Katarakti into the app, answer these:

1. Which core CFD report is the real source of truth?
   - old 5-week phase-2 ATR no-hard model
   - old 5-week sweep-block model
   - newer 8-week generic phase1 rerun

2. Which legacy crypto core variant is the one we actually mean by “Katarakti Core”?
   - variant `C`
   - variant `H`
   - some other legacy variant / hybrid

3. Do we still want both CFD and crypto Katarakti tracked as separate systems if the rules are fundamentally different?

My answer:

- yes, keep both
- but stop pretending they are one clean family until they are rerun on a common window

---

## 8. Recommended Immediate Plan

1. Freeze current CFD trigger work at the weekly-handshake MA+BB baseline.
2. Audit Katarakti scripts and map exact live rule sets per variant.
3. Run fresh `8-week` Katarakti reruns for:
   - core CFD
   - core crypto
   - lite CFD
   - lite crypto
   - v3 crypto
4. Persist the reruns to `strategy_backtest_runs`.
5. Then fix the Performance page source policy so the displayed week counts match the canonical reruns.

Until that happens, the current Katarakti cards should be treated as historical placeholders, not clean apples-to-apples strategy comparisons.
