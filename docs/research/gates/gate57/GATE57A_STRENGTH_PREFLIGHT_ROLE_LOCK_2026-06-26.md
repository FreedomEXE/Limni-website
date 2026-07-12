# Gate 57A Strength Preflight / Role Lock

Generated: 2026-06-26

## Verdict

PASS_PREFLIGHT_ONLY_WAITING_FOR_EVALUATION_APPROVAL.

Gate 57A phase 1 opened Strength role-lock work without running full
performance evaluation. This receipt defines the candidate Strength contracts
mechanically, checks that they are point-in-time decision manifests, and proves
that their requested decision rows are covered by the Gate 57A0B durable
pair-week path outcome warehouse.

This preflight did not run warehouse aggregation scoring, raw M1 ADR Grid path
simulation, regimes, COT+Strength, risk overlays, MT5/live work, app work, COT
retuning, or evaluator changes.

## Boundaries

Frozen:

- COT logic and Gate 54 COT baseline.
- Gate 55E price bundle:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`.
- ADR Grid and Weekly Hold evaluator semantics.
- Gate 57A0B warehouse contract:
  `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`.

Allowed in this phase:

- Candidate contract definition.
- Manifest identity/hash preflight.
- Row, week, duplicate, point-in-time, and warehouse outcome coverage checks.

Not allowed in this phase:

- Performance evaluation.
- Threshold optimization by PnL.
- Strength bucket search beyond the fixed contracts below.
- Regime filters.
- COT+Strength manifests.
- Risk overlays.
- MT5/live parity.
- App/dashboard/refactor work.

## Source Bindings

All candidate contracts bind to:

- Gate 55E frozen price bundle receipt:
  `docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md`
- Gate 55F Strength source-context proof:
  `docs/research/GATE55F_CANONICAL_STRENGTH_SOURCE_CONTEXT_PROOF_2026-06-25.md`
- Gate 55G canonical Friday Strength selected-vs-fade receipt:
  `docs/research/GATE55G_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_BASELINE_2026-06-25.md`
- Gate 56E equivalent-manifest parity receipt:
  `docs/research/gates/gate56/GATE56E_GATE55G_EQUIVALENT_MANIFEST_PARITY_2026-06-25.md`
- Gate 57A0B durable warehouse receipt:
  `docs/research/gates/gate57/GATE57A0B_DURABLE_PAIR_WEEK_PATH_OUTCOME_WAREHOUSE_2026-06-26.md`

Source manifests used for preflight:

| Source | Manifest ID | Manifest hash | File SHA-256 |
|---|---|---|---|
| selected | `gate56e_gate55g_friday_strength_selected_equivalent_manifest_v1` | `33DB04595F371AF4943E2E83E0E40EBEF8C51F7AE89CF96ACF17FF0B71E53ADE` | `AEDB9BF5C368C8A14739EA4CCCEDEEDB5E91A7CADC5790258DF269AEA6D11E19` |
| fade | `gate56e_gate55g_friday_strength_fade_equivalent_manifest_v1` | `BB3142AF507A5CEBE6467E8055467C1B2003126BACA896F3827206DB0755ED28` | `95008C22FAD2B1D816637F32272F3081DEEB37C3726B44C6C2F8B1AB6977066D` |

The source manifest JSON files are ignored/reproducible local artifacts. Their
hashes are already recorded by Gate 56E and Gate 57A0B evidence.

## Warehouse Coverage

Warehouse:
`gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`.

| Check | Value |
|---|---:|
| Warehouse status | `complete` |
| Warehouse hash | `5600A36ED56C5EACCF9082AC2DCFE505BADE7B95649A0742816434FAEB2DF68C` |
| Warehouse rows loaded for exact-key check | `21,896` |
| Expected rows | `21,896` |
| Stored row count | `21,896` |
| Missing warehouse outcomes | `0` |
| Duplicate warehouse outcomes | `0` |

The preflight loaded exact warehouse row keys by:

```text
week_open_utc + symbol + direction
```

Each candidate decision row was checked against those exact keys. Missing
candidate outcome rows were `0` for every candidate below.

## Candidate Contracts

Candidate definitions are fixed mechanical contracts, not optimized thresholds.

| Candidate | Role Under Test | Manifest ID | Manifest hash | Rows | Weeks | Rows/week | Missing warehouse rows |
|---|---|---|---|---:|---:|---:|---:|
| existing selected | selected directional layer | `gate56e_gate55g_friday_strength_selected_equivalent_manifest_v1` | `33DB04595F371AF4943E2E83E0E40EBEF8C51F7AE89CF96ACF17FF0B71E53ADE` | `10,836` | `387` | `28` | `0` |
| existing fade | fade / contrarian layer | `gate56e_gate55g_friday_strength_fade_equivalent_manifest_v1` | `BB3142AF507A5CEBE6467E8055467C1B2003126BACA896F3827206DB0755ED28` | `10,836` | `387` | `28` | `0` |
| strongest quartile selected | ranking / eligibility filter | `gate57a_strength_abs_spread_strongest_quartile_selected_manifest_v1` | `97A12B8702F32ED1232BB7D3D7B0445049C5BA240A94E9661817D4AE2AFF60B9` | `2,709` | `387` | `7` | `0` |
| weakest quartile selected | diagnostic / fade context candidate | `gate57a_strength_abs_spread_weakest_quartile_selected_manifest_v1` | `BD861B660DB4F9E5414C8B47DE79ED74AF860C01E1D81FC5C6D663A8FAC74246` | `2,709` | `387` | `7` | `0` |
| rolling 52w context selected | historical-context support candidate | `gate57a_strength_rolling_52w_context_selected_manifest_v1` | `A2FB501DCA5EC099BFB372191C157B97DC9A523B529213D8632F810D73744157` | `9,380` | `335` | `28` | `0` |

### Existing Selected

Rule:

```text
Use Gate 55G / Gate 56E Friday Strength selected side for every retained FX
pair-week row.
```

Coverage:

- Weeks: `387`
- Range: `2019-01-07T00:00:00.000Z` through
  `2026-05-31T23:00:00.000Z`
- Rows: `10,836`
- Full weeks: `387`
- Non-full weeks: `0`
- Long rows: `5,612`
- Short rows: `5,224`
- Duplicate `week + symbol` rows: `0`
- Duplicate `week + symbol + side` rows: `0`
- Decision timestamp after week open: `0`
- Resolved Strength timestamp after week open: `0`
- Missing warehouse outcomes: `0`

### Existing Fade

Rule:

```text
Use the opposite of the Gate 55G / Gate 56E Friday Strength selected side for
every retained FX pair-week row.
```

Coverage:

- Weeks: `387`
- Range: `2019-01-07T00:00:00.000Z` through
  `2026-05-31T23:00:00.000Z`
- Rows: `10,836`
- Full weeks: `387`
- Non-full weeks: `0`
- Long rows: `5,224`
- Short rows: `5,612`
- Duplicate `week + symbol` rows: `0`
- Duplicate `week + symbol + side` rows: `0`
- Decision timestamp after week open: `0`
- Resolved Strength timestamp after week open: `0`
- Missing warehouse outcomes: `0`

### Strongest Quartile Selected

Rule:

```text
Within each week, rank selected Strength rows by absolute
signed_spread_sum descending. Retain the top 7 of 28. Side remains selected
Strength. Fixed quartile only; no PnL threshold selection.
```

Coverage:

- Weeks: `387`
- Rows: `2,709`
- Full 7-row weeks: `387`
- Non-full weeks: `0`
- Long rows: `1,428`
- Short rows: `1,281`
- Duplicate `week + symbol` rows: `0`
- Duplicate `week + symbol + side` rows: `0`
- Decision timestamp after week open: `0`
- Resolved Strength timestamp after week open: `0`
- Missing warehouse outcomes: `0`

### Weakest Quartile Selected

Rule:

```text
Within each week, rank selected Strength rows by absolute
signed_spread_sum ascending. Retain the bottom 7 of 28. Side remains selected
Strength. Fixed quartile only; no PnL threshold selection.
```

Coverage:

- Weeks: `387`
- Rows: `2,709`
- Full 7-row weeks: `387`
- Non-full weeks: `0`
- Long rows: `1,364`
- Short rows: `1,345`
- Duplicate `week + symbol` rows: `0`
- Duplicate `week + symbol + side` rows: `0`
- Decision timestamp after week open: `0`
- Resolved Strength timestamp after week open: `0`
- Missing warehouse outcomes: `0`

### Rolling 52-Week Historical Context Selected

Rule:

```text
Retain selected Strength rows only after the same symbol has at least 52 prior
weekly Strength observations. Side remains selected Strength. This is context
support only, not a PnL threshold.
```

Coverage:

- Supported weeks: `335`
- Supported range: `2020-01-06T00:00:00.000Z` through
  `2026-05-31T23:00:00.000Z`
- Rows: `9,380`
- Full 28-row supported weeks: `335`
- Non-full supported weeks: `0`
- First 52 weeks omitted by construction for prior-history support.
- Long rows: `4,880`
- Short rows: `4,500`
- Min prior observations: `52`
- Max prior observations: `386`
- Duplicate `week + symbol` rows: `0`
- Duplicate `week + symbol + side` rows: `0`
- Decision timestamp after week open: `0`
- Resolved Strength timestamp after week open: `0`
- Missing warehouse outcomes: `0`

## Interpretation

All five candidate contracts are mechanically buildable, point-in-time, and
covered by the Gate 57A0B warehouse. This means Gate 57A can proceed to a
separately approved warehouse-only evaluation phase without raw M1 ADR Grid path
simulation.

This preflight does not decide whether Strength is selected, fade,
ranking/eligibility, diagnostic-only, or parked. It only proves those role-lock
questions can now be asked through reusable warehouse aggregation.

## Diagnostic Artifact

Ignored local diagnostic summary:

```text
engine/reports/gate57a-strength-preflight-summary.json
```

The diagnostic JSON records the exact candidate row counts, hashes, duplicate
checks, point-in-time checks, and warehouse key checks used to write this
receipt.

## Stop Line

Stop here until Freedom explicitly approves Gate 57A full warehouse-only
evaluation.

Still blocked:

- Raw M1 ADR Grid simulation.
- New evaluator or backtest engine.
- COT logic changes or retuning.
- Regimes.
- COT+Strength.
- Risk overlays.
- MT5/live.
- App work.

Receipt hash: `0511B06606F613C1F2911115A3B0B15FDF0A748825AC6CAD92CEDC2242C697B8`
