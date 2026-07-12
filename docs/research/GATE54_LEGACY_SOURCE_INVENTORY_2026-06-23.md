# Gate 54 Legacy Source Inventory

Date: 2026-06-23

Status: `GATE54_INVENTORY_OPEN_NOT_READY`

## Objective

Gate 54 answers one source-readiness question:

```text
Can we trust the legacy COT + Strength + ADR matrix enough to select one Signal
Model candidate for automation?
```

This receipt is inventory only. It does not select a system, optimize a
configuration, rerun BPR/RRP, or authorize live parity work.

## Locked Scope

Authorized:

- Legacy COT source lineage and point-in-time availability.
- COT lifecycle / CLP contract and rebuild parity.
- Strength / SFA source snapshots, timing, and frozen-output parity.
- ADR / price / bar inputs used by the matrix.
- Gate 44 seven-year matrix reconstruction identity.
- Pair-week contribution / trade-event attribution integrity.
- Selector output hashes for candidate baseline models.

Not authorized:

- Strategy optimization.
- Outcome grids.
- BPR optimization, BPR attribution, or persisted BPR dataset writes.
- RRP retesting.
- PPP, NEER, REER, valuation, or combined macro regime work.
- New execution rules, risk overlays, MT5 bot work, live, production, or
  promotion claims.

## Current Owner Map

| Domain | Current owner path | What it owns | Gate 54 hardening need |
|---|---|---|---|
| Canonical basket source | `app/src/lib/performance/basketSource.ts` | Canonical historical base-model signals for `dealer`, `commercial`, `sentiment`, and `strength`; checks frozen source ledger before rebuilding live source rows. | Prove canonical output hashes for the baseline candidate weeks and prove missing-source rows are explicit, not silently directional. |
| COT raw fetch | `app/src/lib/cotFetch.ts` | CFTC Socrata resources for TFF, legacy, and disaggregated reports. | Prove dataset resource IDs, variant, report-date availability, and point-in-time release handling for selected legacy matrix window. |
| COT snapshot store | `app/src/lib/cotStore.ts` | `cot_snapshots` read/write, COT variant selection, report-date refresh, dealer/commercial snapshot materialization, prior-delta enrichment. | Prove stored snapshots rebuild from the same source rows and that fallback behavior is classified when dealer or commercial rows are missing. |
| COT interpretation | `app/src/lib/cotCompute.ts` | Dealer/commercial market snapshot and pair-direction derivation. | Prove exact direction contract used by Gate 44/Gate 54 candidates and freeze any CLP/lifecycle fields separately from raw COT side. |
| Strength weekly source | `app/src/lib/strength/weeklyStrength.ts` | `strength_weekly_snapshots`, locked weekly source rows, current/fallback weekly pair strength reads. | Prove Friday/open strength timing and distinguish locked rows from live provider fallback. |
| Strength historical source | `app/src/lib/strength/historicalStrength.ts` | M1-derived historical strength snapshots in `strength_history_snapshots`. | Prove the historical M1-backed derivation and exact decision-point lookup used by matrix source contexts. |
| Strength canonical direction | `app/src/lib/strength/canonicalDirection.ts` | Canonical strength direction resolver, prior-week lookback, and fallback branch metadata. | Prove promoted candidates do not depend on unapproved provider fallback or `fallback_long_default` rows. |
| ADR lookup | `app/src/lib/performance/adrLookup.ts` | Weekly ADR% from `canonical_price_bars`, 10-day lookback, 5-day minimum, and default ADR fallbacks. | Prove matrix weeks use real ADR bars where required and classify any default ADR symbols as source caveats. |
| Price bars | `app/src/lib/canonicalHourlyBars.ts`, `app/src/lib/performance/pathBarLoader.ts`, `app/src/lib/research/localM1Warehouse.ts` | Canonical bar storage, weekly path loading, and local M1 warehouse reads. | Prove local M1 coverage, partial holiday rows, and selected path data identity for Gate 44 replay. |
| Matrix warehouse | `app/src/lib/research/matrixDataset.ts` | Research matrix dataset/version/schema, source contexts, trade opportunities, variant runs, pair decisions, week results, trade events, stop events. | Prove the matrix dataset identity and persisted/readback counts before using it for selection. |
| Matrix coverage command | `app/scripts/verification/export-research-matrix-dataset-contract.ts` | No-write coverage manifest when run without `--write`; checks receipts, M1, Strength, COT, and source context readiness. | First Gate 54 smoke candidate. |
| Matrix build/audit command | `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts` | Matrix build and optional warehouse persistence. | Not the first command; only authorized later with an explicit no-write or controlled-persistence scope. |

## Existing Evidence Boundary

| Evidence | Current read | Gate 54 meaning |
|---|---|---|
| Gate 43 Strength history | Defines M1-backed Strength history and weekly decision points. | Useful source-contract evidence, but not final Gate 54 parity proof. |
| Gate 44 matrix dataset | Preserved seven-year matrix identity with source contexts and known coverage caveats. Latest cited full matrix hash: `cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36`. | Strong reconstruction anchor, but Gate 54 must separately prove source-owner contracts and candidate selector output hashes. |
| Gate 44 coverage caveats | Known COT gaps: 84 pair rows from `2019-01-07`, `2020-12-28`, `2023-07-10`; local M1 missing symbol-weeks later reduced to zero, with remaining partial rows treated as market/holiday/provider facts. | These caveats must remain visible. They cannot be hidden by selector selection. |
| Gate 46 COT lifecycle | COT lifecycle slice starts from `2021-12-28` because local COT history starts `2019-01-08`; full 156-week lifecycle coverage needs pre-2019 warmup history. | CLP/lifecycle cannot be treated as full-window promotion-grade until warmup history is proven or scope is narrowed. |
| Gate 53 architecture | Source Governance / Feature Contracts is Layer 0 and a precondition layer, not an alpha layer. | Gate 54 remains data/contract verification, not system selection. |

## Readiness Classification

| Source family | Current classification | Reason |
|---|---|---|
| COT dealer/commercial | `legacy_needs_hardening` | Source path is known, but point-in-time report availability, missing weeks, variant, and rebuild parity still require Gate 54 proof. |
| COT lifecycle / CLP | `partial_window_needs_hardening` | Existing lifecycle evidence is source-useful but warmup-limited. |
| Strength / SFA | `strong_candidate_needs_output_hashing` | M1-backed history and weekly decision points exist, but candidate selector outputs still need frozen hashes and fallback exclusion proof. |
| ADR / price bars | `usable_needs_fallback_receipt` | ADR reads canonical daily bars but has default fallback behavior that must be counted and classified. |
| Gate 44 matrix | `identity_anchor_not_selection_authority` | The warehouse hash and counts anchor reconstruction, but do not by themselves authorize final system selection. |
| Selector outputs | `not_yet_authorized` | Gate 54 still needs exact output hashes for candidate baseline models. |

## First Proof Command Candidate

Smallest no-write Gate 54 smoke:

```powershell
npm run verification:export-research-matrix-dataset-contract -- --coverage-manifest --from-year=2019 --to-year=2026 --latest-display-week=2026-06-08
```

Expected boundary:

- Reads existing DB/source/receipt state.
- Does not write files unless `--write` is added.
- Excludes the 2025 shutdown window unless `--include-shutdown-2025` is added.
- Reports yearly coverage for receipts, local M1, Friday Strength, market-open
  Strength, COT snapshots, and ready weeks.

Do not add `--write` for the first Gate 54 smoke.

## Gate 54 Required Receipts

The next receipts should be:

- `gate54-legacy-source-inventory` - this document.
- `gate54-cot-source-contract-proof`.
- `gate54-strength-source-contract-proof`.
- `gate54-adr-price-matrix-proof`.
- `gate54-selector-output-rebuild-proof`.
- `gate54-legacy-baseline-evidence-boundary`.
- `gate54-system-selection-readiness-summary`.

## Decision

Gate 54 is open and correctly scoped.

Current decision:

```text
Gate 54 source inventory: ACCEPT AS STARTING BOUNDARY
Legacy baseline source readiness: NOT YET
System selection: NOT AUTHORIZED
Optimization: PAUSED
Next authorized move: no-write matrix/source coverage smoke
```
