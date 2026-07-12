# Gate 60 Regime Source Integrity

Generated: 2026-06-27

## Verdict

`FAIL_FULL_FAMILY_SOURCE_ELIGIBILITY__PASS_RRP_ONLY_WITH_ALPHA_WEEK_ALIGNMENT_BLOCKER`

Gate 60 inspected macro source-family integrity only. It did not build a Regime
strategy, emit Regime long/short pair decisions, test Alpha v1 improvement,
change COT, change Strength, change Alpha v1, add risk or execution overlays,
touch MT5/live, or modify app runtime code.

## Objective

Verify whether the macro source families are clean, point-in-time, active,
deterministic, and eligible to support a future forced-28 Regime shadow signal
joined to the frozen Gate 59 Alpha v1 atom ledger.

Inspected families:

- BPR / bank positioning
- nominal rates
- CPI / inflation
- real-rate pressure
- valuation inputs

## Recovery Inputs

- Gate 59 Alpha v1 atom ledger:
  `docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl`
- Gate 59 SHA identity:
  `docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.sha256.txt`
- Macro warehouse schema:
  `database/migrations/029_macro_regime_source_warehouse.sql`
- Macro warehouse helper:
  `engine/src/warehouse/macroRegimeDataset.ts`
- Prior source receipts:
  - `docs/research/GATE47_REAL_VALUE_REGIME_RESEARCH_HANDOFF_2026-06-19.md`
  - `docs/research/GATE48_MACRO_SOURCE_CONTRACT_REVIEW_HANDOFF_2026-06-19.md`
  - `docs/research/GATE50_CODEX_PRO_REVIEW_RESPONSE_2026-06-20.md`
  - `docs/research/GATE50_OFFICIAL_CPI_FEASIBILITY_AUDIT_2026-06-22.md`
  - `docs/research/GATE50_RATE_VINTAGE_RECONCILIATION_REVIEW_PACKET_2026-06-22.md`
  - `docs/research/GATE52_BPR_PUBLICATION_DATE_PROOF_DECISION_2026-06-23.md`
  - `docs/research/GATE52A_BPR_CLEAN_AMBIGUITY_MAP_DECISION_2026-06-23.md`
  - `docs/research/GATE51D_RRP_DECOMPOSITION_DIAGNOSTIC_LOCK_2026-06-23.md`

## Read-Only DB Probe

The local database contains the macro warehouse tables:

```txt
research_macro_availability_events
research_macro_execution_receipts
research_macro_regime_datasets
research_macro_snapshot_state_transitions
research_macro_source_artifact_byte_archives
research_macro_source_artifacts
research_macro_source_observations
research_macro_weekly_currency_snapshots
research_macro_weekly_snapshot_manifests
```

Read-only probes were run through `database/db/client.ts`. They queried current
dataset state, source-family row coverage, point-in-time timestamp violations,
aggregate snapshot manifests, one-ACTIVE uniqueness, execution receipts, and
exact week-key overlap against the Gate 59 Alpha v1 ledger.

No write query was run.

## Current Source-Family State

| Family | Dataset | State | Rows / weeks | Point-in-time violations | Active? | Alpha v1 exact-week coverage | Gate 60 read |
|---|---|---:|---:|---:|---:|---:|---|
| BPR | `01a3b789-2928-4886-a627-eaf5ae689790` | `SEALED` | `5,952 / 372` | `0` | No | `357 / 373` | Not eligible |
| rate | `dcdc850a-80a2-4178-8d08-dd759be6afb8` | `SEALED` | `2,976 / 372` | `0` | No | `357 / 373` | Clean parent, not standalone active |
| inflation | `37b4081b-880e-4ae6-8d53-20ba900dff07` | `SEALED` | `2,976 / 372` | `0` | No | `357 / 373` | Clean parent, not standalone active |
| real_rate_pressure | `220fd5fd-d017-4db2-bdde-524a3c664c72` | `ACTIVE` | `2,976 / 372` | `0` | Yes, RRP only | `357 / 373` | Gate 50 RRP pass, Alpha v1 join blocked |
| valuation | `97266ab2-6feb-4962-936b-a47d73c06684` | `BUILDING` | `12,416 / 388` | `0` | No | `127 / 373` | Shadow/source-only, not eligible |

Important row-quality details:

- BPR has `3,959` value-unavailable rows, `3,969` untrusted-for-freeze rows, and
  `32` stale rows in the current source snapshot view. Gate 52A remains the
  governing decision: full-window promotion-grade BPR coverage is `NO`, and
  source-ambiguous rows must stay unavailable/quarantined rather than
  neutralized or imputed.
- Rate and inflation have clean current parent datasets for the inspected
  372-week control: `0` stale rows, `0` missing rows, `0` timestamp violations.
  They remain `SEALED` diagnostic/source-parent surfaces unless a feature bundle
  explicitly activates them.
- Real-rate pressure is the only inspected macro source with an `ACTIVE`
  historical-backtest manifest set: `372` active manifests, `0` duplicate active
  keys, and `1,860` execution receipt rows with `0` non-active observations.
- Valuation rows exist as source inputs, but the dataset is still `BUILDING`,
  has no promotion manifest, no contract manifest hash, and no aggregate
  manifests. It is not source-eligible for a Regime shadow ledger.

## Prior Receipt Alignment

Gate 50 receipts support only a narrow RRP source lane:

- Rate standalone join receipt: `PASS_DIAGNOSTIC`, `10,416 / 10,416`, not
  promotion eligible.
- CPI/inflation standalone join receipt: `PASS_DIAGNOSTIC`, `10,416 / 10,416`,
  not promotion eligible.
- RRP sealed diagnostic join receipt: `PASS_DIAGNOSTIC`, `10,416 / 10,416`, not
  promotion eligible.
- RRP historical activation receipt: `PASS_HISTORICAL_ACTIVATION`, `372` active
  manifests for `real_rate_pressure_attribution_v1`.
- RRP active join receipt: `PASS`, promotion eligible, `10,416 / 10,416`,
  required source family `real_rate_pressure`.

That does not make BPR, rate, inflation, or valuation standalone ACTIVE Regime
sources. It only proves the specific `real_rate_pressure_attribution_v1` source
bundle against the older Gate 44 `372`-week / `10,416` pair-week control.

## Alpha V1 Week-Key Blocker

Gate 59 Alpha v1 is now the forward signal ledger boundary:

```txt
Alpha v1 weeks: 373
Alpha v1 rows: 10,444
Rows per week: 28
First week: 2019-04-14T23:00:00.000Z
Last week: 2026-05-31T23:00:00.000Z
```

The active RRP dataset covers:

```txt
RRP macro weeks: 372
Full currency weeks: 372
Active historical_backtest manifests: 372
First macro week: 2019-01-07 00:00:00+00
Last macro week: 2026-06-07 23:00:00+00
```

Exact `week_open_utc` overlap with Gate 59 Alpha v1:

```txt
Alpha weeks with active RRP exact macro key: 357 / 373
Alpha rows with active RRP exact macro key: 9,996 / 10,444
Missing Alpha weeks: 16
Missing Alpha row equivalents: 448
```

Missing Alpha v1 weeks under exact macro key:

```txt
2024-01-01T00:00:00.000Z
2024-12-23T00:00:00.000Z
2024-12-30T00:00:00.000Z
2025-10-05T23:00:00.000Z
2025-10-12T23:00:00.000Z
2025-10-19T23:00:00.000Z
2025-10-26T23:00:00.000Z
2025-11-03T00:00:00.000Z
2025-11-10T00:00:00.000Z
2025-11-17T00:00:00.000Z
2025-11-24T00:00:00.000Z
2025-12-01T00:00:00.000Z
2025-12-08T00:00:00.000Z
2025-12-15T00:00:00.000Z
2025-12-22T00:00:00.000Z
2025-12-29T00:00:00.000Z
```

This blocks a forced-28 Regime shadow signal against Alpha v1 until a later
source-only gate proves a deterministic Alpha v1 week mapping or rebuilds the
macro snapshot layer on the Alpha v1 week identity. Missing weeks must fail
closed; they must not be neutralized, forward-filled, or silently skipped.

## Non-Claims

Gate 60 does not say RRP improves Alpha v1.

Gate 60 does not authorize a Regime strategy.

Gate 60 does not authorize final Regime long/short decisions.

Gate 60 does not authorize Alpha v2 arbitration, BPR attribution, valuation
attribution, risk overlays, execution optimization, MT5/live work, or app work.

Gate 60 does not describe Alpha v1 as economically mostly COT. Gate 59 remains
the authority: Alpha v1 is COT-parented as governance/fallback language, while
row-level authority is Strength-heavy at `7,377 / 10,444` rows (`70.6%`).

## Next Permitted Gate

The next safe gate is a source-only Alpha v1 macro join-map proof:

1. Use the Gate 59 atom ledger as the denominator: `373` weeks, `10,444` rows,
   `28` symbols per week.
2. Do zero P&L and zero Regime decision logic.
3. Define the deterministic mapping from Alpha v1 `week_open_utc` to macro week
   identity.
4. Prove row coverage for each required source family under that mapping.
5. Fail closed for missing, stale, quarantined, source-ambiguous, non-ACTIVE, or
   non-promoted rows.
6. Emit a join-map hash and source-content invariant hash before any Regime
   shadow signal construction.

Stop here.
