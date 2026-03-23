/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Katarakti Cleanup Plan
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

## Goal

Put every Katarakti variant on a single canonical comparison basis before any further strategy decisions:

- same week window
- same persistence model
- same Performance-page source policy
- no more legacy file + seed + live hybrid cards

Date: 2026-03-21

---

## 1. Current State

### Core CFD

Current app source path:

- legacy file / seed path through `readMt5ForexSnapshot()`
- **not** DB-first

Observed preferred file candidates:

- `reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.json`
- `reports/katarakti-phase1-backtest-latest.json`

Problems:

- preferred file is still a `5-week` phase-2 report
- no `strategy_backtest_runs` row exists for `katarakti_v1`
- card meaning is ambiguous because multiple “core” families exist

### Core Crypto

Current app source path:

- legacy snapshot files:
  - `docs/bots/backtest-weekly-summary.json`
  - `docs/bots/backtest-run-history.json`
  - `docs/bots/backtest-trade-log.json`
- plus appended live dry-run week from `bitget_perp_v2`

Problems:

- legacy snapshot is `5 weeks`
- live append adds a `6th` week from `bitget_perp_v2`
- card is not a pure backtest card
- no `strategy_backtest_runs` row exists for core crypto

### Lite CFD

Current source:

- DB-first via `strategy_backtest_runs`
- bot id: `katarakti_cfd_lite`
- currently stored run: `6 weeks`

Status:

- persistence path is already good
- only missing a fresh `8-week` rerun

### Lite Crypto

Current source:

- DB-first via `strategy_backtest_runs`
- bot id: `katarakti_crypto_lite`
- currently stored run: `6 weeks`

Status:

- persistence path is already good
- only missing a fresh `8-week` rerun

### V3 Crypto

Current source:

- DB-first via `strategy_backtest_runs`
- bot id: `katarakti_v3_liq_sweep`
- currently stored run: `6 weeks`

Status:

- persistence path is already good
- only missing a fresh `8-week` rerun

---

## 2. Why The Current Comparison Is Invalid

The Performance page is currently comparing:

- core CFD from legacy file/seed logic
- core crypto from legacy file + live trade append
- lite/v3 from DB-stored 6-week runs

That means:

- week counts differ
- window dates differ
- rule families differ
- source quality differs

So any current “Core vs Lite vs V3” visual comparison is not a clean system comparison.

---

## 3. Katarakti Variant Map

### A. Core CFD

Known source families in repo:

1. old phase-2 ATR/no-hard-stop family
   - `reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.*`
   - `5 weeks`
   - selected variant in report family:
     - `tiered__t1t2__weighted`

2. old phase-1 sweep family
   - `reports/katarakti-phase1-backtest-latest.*`
   - now rerun for `8 weeks`
   - currently poor in latest generic report

3. seed fallback
   - `src/lib/performance/kataraktiSeed.ts`
   - `20.22%`, `5 weeks`

Open issue:

- “Core CFD” is not uniquely defined yet

### B. Core Crypto

Known source family:

- old Bitget v2 legacy snapshot set
- variant key default = `C`
- built around:
  - weekly BTC/ETH bias
  - session structure
  - sweep / rejection / displacement
  - handshake-heavy logic
  - scaling / overnight hold

Open issue:

- core crypto is still a legacy variant family, not a clean current-code rerun

### C. Lite CFD

Current best stored family:

- parameter sweep winner:
  - `lite_d5_c035_aoff`

Also important:

- best return/DD family was centered around:
  - dwell `3-5`
  - close location `0.40`
  - ATR floor `off` or `0.10x`

### D. Lite Crypto

Current source:

- `reports/bitget-lite-entry-latest.json`
- DB persisted
- `6 weeks`

Open issue:

- exact chosen config needs to be re-read from script/report at rerun time

### E. V3 Crypto

Current DB/file family:

- `katarakti_v3_liq_sweep`
- `6 weeks`

Open issue:

- V3 itself has multiple research branches
- the currently persisted liq-sweep run may not represent the full V3 idea space

---

## 4. Cleanup Principles

1. One source model only

- every active Katarakti card should resolve from `strategy_backtest_runs`
- legacy file parsing becomes fallback only, not primary truth

2. Same test window

- all active variants rerun on the same `8 closed weeks`

3. No live-week append in historical comparison cards

- live and historical should be separate concerns
- appending a live week to a legacy backtest snapshot creates fake “all-time” continuity

4. Core must be explicitly defined

- do not keep “core” as a fuzzy label
- map it to one exact rule family per market

---

## 5. Proposed Canonical Mapping

### Proposed display families

#### Katarakti Core (CFD)

Needs decision:

- Option A: keep old phase-2 weighted ATR/no-hard family as the real core CFD
- Option B: redefine core CFD as the latest `katarakti-phase1-backtest.ts` locked family

Recommendation:

- treat this as unresolved until rerun review

#### Katarakti Core (Crypto Futures)

Needs decision:

- Option A: legacy Bitget v2 variant `C`
- Option B: other legacy selected variant from old run history

Recommendation:

- treat legacy variant `C` as provisional core crypto unless rerun audit proves another variant was actually intended

#### Katarakti Lite (CFD)

- canonical bot id: `katarakti_cfd_lite`
- canonical variant: `lite`
- rerun required for `8 weeks`

#### Katarakti Lite (Crypto Futures)

- canonical bot id: `katarakti_crypto_lite`
- canonical variant: `lite`
- rerun required for `8 weeks`

#### Katarakti v3 (Crypto Futures)

- canonical bot id: `katarakti_v3_liq_sweep`
- canonical variant: `v3`
- rerun required for `8 weeks`

---

## 6. Cleanup Sequence

### Phase 1: Source normalization

1. Stop using legacy file-first core cards as comparison truth.
2. Add DB-first support for core variants.
3. Keep file parsing only as temporary fallback while reruns are in progress.
4. Remove live-week appending from historical comparison cards once canonical reruns exist.

### Phase 2: Rule audit

For each active variant, capture:

- entry model
- bias source
- filter logic
- exit engine
- selected parameters
- original report source

This produces an explicit rule card per variant.

### Phase 3: Fresh reruns

Run these on the same 8-week window:

- core CFD
- core crypto
- lite CFD
- lite crypto
- v3 crypto

Persist all to `strategy_backtest_runs`.

### Phase 4: Performance page cleanup

Update loaders so:

- all active Katarakti cards are DB-first
- week counts come only from canonical reruns
- source labels clearly show run provenance

---

## 7. Immediate Action List

### Ready now

- Lite CFD rerun to 8 weeks
- Lite crypto rerun to 8 weeks
- V3 crypto rerun to 8 weeks

These already have DB persistence wiring.

### Needs audit before rerun

- Core CFD
- Core crypto

These are the two ambiguous families.

---

## 8. Recommendation

Do not patch the Performance page first.

First:

1. lock the exact meaning of core CFD
2. lock the exact meaning of core crypto
3. rerun all five active variants on the same 8-week window
4. persist them

Then:

- switch the loaders to canonical DB-first behavior
- compare the family cleanly

Until then, the current Katarakti cards should be treated as placeholders only.
