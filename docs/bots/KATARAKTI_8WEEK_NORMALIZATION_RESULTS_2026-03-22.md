/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Katarakti 8-Week Normalization Results
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

Date: 2026-03-22

## Purpose

Normalize the active Katarakti families onto one comparable basis:

- same `8` completed-week window
- canonical `strategy_backtest_runs` persistence
- no legacy file + seed + live-week hybrid cards as comparison truth

This note records the rerun results after the cleanup pass.

---

## Cleanup Completed

### Persistence contract fixes

Added missing backtest ingestion contracts in:

- `src/lib/performance/strategyRegistry.ts`

for:

- `katarakti_cfd_lite`
- `katarakti_crypto_lite`
- `katarakti_v3_liq_sweep`
- provisional core contracts:
  - `katarakti_v1`
  - `bitget_perp_v2`

### New ingestion utility

Added:

- `scripts/ingest-katarakti-core-backtests.ts`

This ingests the selected current-app meaning of core into
`strategy_backtest_runs`:

- CFD core -> `tiered__t1t2__weighted`
- crypto core -> Bitget v2 Variant `C` (`C_handshake_scaling_risk`)

### Core loader cleanup

Updated:

- `src/lib/performance/kataraktiHistory.ts`

Core snapshots now prefer canonical DB backtests first:

- CFD core -> `bot_id = katarakti_v1`, `variant = core`
- crypto core -> `bot_id = bitget_perp_v2`, `variant = core`

Legacy file parsing remains fallback only if DB rows are missing.

---

## Canonical 8-Week Runs Now In DB

Latest normalized rows in `strategy_backtest_runs`:

- `katarakti_v1` / `core` / `mt5_forex` / `8 weeks`
- `bitget_perp_v2` / `core` / `crypto_futures` / `8 weeks`
- `katarakti_cfd_lite` / `lite` / `mt5_forex` / `8 weeks`
- `katarakti_crypto_lite` / `lite` / `crypto_futures` / `8 weeks`
- `katarakti_v3_liq_sweep` / `v3` / `crypto_futures` / `8 weeks`

So the app now has a clean 8-week DB-backed source for all active
Katarakti cards.

---

## Normalized 8-Week Results

### 1. Katarakti Core (CFD)

Provisional canonical meaning used for cleanup:

- source family: old phase-2 ATR / no-hard-stop family
- selected variant: `tiered__t1t2__weighted`
- report source:
  - `reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.json`

8-week result:

- return: `-25.75%`
- max DD: `25.75%`
- trades: `8`
- win rate: `0%`

Interpretation:

- the current-app meaning of CFD core does **not** survive the 8-week
  normalization
- this legacy phase-2 family was largely a short-window artifact

### 2. Katarakti Core (Crypto Futures)

Provisional canonical meaning used for cleanup:

- source family: Bitget v2 legacy core
- selected variant key: `C`
- selected strategy key: `C_handshake_scaling_risk`
- report sources:
  - `docs/bots/backtest-run-history.json`
  - `docs/bots/backtest-trade-log.json`

8-week result:

- return: `+102.75%`
- max DD: `3.64%`
- trades: `24`

Interpretation:

- core crypto still looks very strong on the full 8-week window
- this is the main surviving legacy Katarakti family worth
  re-examining for reusable ideas

### 3. Katarakti Lite (CFD)

Selected config after rerun:

- `lite_d2_c035_aoff`

8-week result:

- return: `-6.96%`
- max DD: `6.96%`
- trades: `8`
- win rate: `0%`

Interpretation:

- Lite CFD collapsed completely on the normalized window
- no evidence it should remain a serious candidate right now

### 4. Katarakti Lite (Crypto Futures)

Selected config after rerun:

- `d2/c0.35`

8-week BTC+ETH-only result:

- return: `-39.69%`
- max DD: `39.69%`
- trades: `2`

Alt universe results were even worse:

- high-corr alts: `-313.12%`
- full 31-symbol universe: `-491.03%`

Interpretation:

- Lite crypto does **not** survive normalization
- the previous 6-week result was not robust

### 5. Katarakti v3 (Crypto Futures)

Current DB-selected liq-sweep config:

- offset: `1.00%`
- slot mode: `per_symbol`

8-week result:

- return: `+321.12%`
- max DD: `27.42%`
- trades: `50`
- win rate: `38.00%`

Interpretation:

- v3 still has massive raw edge
- but it is a very different shape from core crypto:
  - lower win rate
  - much hotter drawdown / volatility
  - much more aggressive profile

---

## Practical Read After Cleanup

### Survived the 8-week reset

- `core crypto`
- `v3 crypto`

### Did not survive the 8-week reset

- `core CFD` (current legacy meaning)
- `lite CFD`
- `lite crypto`

This changes the strategic picture materially.

The old app cards made it look like multiple Katarakti families were
simultaneously strong. After normalization, that is no longer true.

The only Katarakti families still worth serious comparison work are:

1. `core crypto` for precision / low-DD legacy logic
2. `v3 crypto` for high-return aggressive logic

---

## What To Borrow Next

### From core crypto

The most likely reusable components to revisit:

- strict handshake logic
- session-window structure
- scaling / overnight hold
- sweep + rejection + displacement sequencing

### From v3 crypto

The most likely reusable components to revisit:

- sustained deviation entry concepts
- liquidation sweep mechanics
- aggressive but structured scaling / trail behavior

### Not worth prioritizing right now

- Lite CFD
- Lite crypto
- legacy phase-2 CFD core

These should not drive new design work unless a future regime change
or rerun proves otherwise.

---

## Remaining Caveat

`Core` is now normalized around the **current app meaning**, not a
redefined new meaning.

That is intentional.

The cleanup goal here was:

- make the comparison honest first
- reinterpret the family second

So if Freedom later wants to redefine “CFD core” to a newer family,
that should be a **new explicit decision**, not hidden inside the
cleanup.
