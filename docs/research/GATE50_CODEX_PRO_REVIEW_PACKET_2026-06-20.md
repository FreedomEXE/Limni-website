# Gate 50 Codex Pro Review Packet

Date: 2026-06-20

Gate: Gate 50: macro-source-promotion-proof

Status: review packet. This is not a promotion claim and not a strategy-result
claim.

Review response has been received and integrated. See
`docs/research/GATE50_CODEX_PRO_REVIEW_RESPONSE_2026-06-20.md` for the
current caveats and updated bundle-aware join-audit contract. This packet is
the original request sent for outside review.

## Request

Review the current Gate 50 source-proof and join-proof contract before we spend
more implementation time on the credential-bound promotion fill.

Please answer in a review stance:

1. PASS / PASS WITH CAVEATS / FAIL on the Gate 50 proof design.
2. Blocking issues that would make the source layer non-institutional even if
   the next fill produces rows.
3. Whether the join-proof contract is sufficient to prevent a false 7-year
   macro test.
4. Any missing fail-closed, activation, uniqueness, revocation, or boundary
   proof that should be added before macro outcome logic.
5. Whether the next step should remain source promotion proof, or whether a
   marked-to-market risk/accounting gate should be opened first.

## Current Scope

Gate 50 is source-only. It must prove promotion-grade weekly frozen macro
snapshots for the same seven-year control window and future live settlement
path.

Frozen areas:

- no stop, TP, runner, grid-entry, or pair-filter tuning;
- no release-canon edits;
- no Pine verifier work;
- no combined BPR/rate/CPI regime logic;
- no macro outcome or ADR Grid test until source proof passes;
- no silent rewrite of v0 data. New or upgraded sources require a new source id
  or dataset/feature version.

The intended first 7-year macro test is not allowed to run until the macro
source layer can pass the join proof against the locked matrix control.

## External Review Context We Accepted

We accept these constraints as review criteria, not as repo evidence:

- The existing COT/Strength Gate 44 matrix is a locked control, not a final
  proof sample.
- The macro treatment must be measured against the identical eligible pair-week
  baseline, not just a similar date range.
- Macro attribution should start at `effective_from_utc`, not at raw
  `week_open_utc`.
- Closed ADR or closed-trade PF is not enough for investable claims. A later
  marked-to-market ledger must unify realized and unrealized P&L, terminal
  inventory, costs, financing, sizing, margin, drawdown, and concentration.
- Stops, trailing exits, re-entry, and correlation filters should not be used
  to rescue this first source/regime attribution pass. They are later gates.

## What Gate 49/50 Implemented

Gate 49 architecture is now represented in code enough to stop asking for
direction:

- source registry and source-contract metadata;
- immutable endpoint artifacts with raw payload hashes;
- point-in-time/release availability dimensions split into
  `retrieval_capability`, `availability_precision`, and `eligibility_policy`;
- `promotion_manifest_id` and `contract_manifest_hash`;
- aggregate weekly snapshot manifests;
- one active snapshot uniqueness per
  `(promotion_manifest_id, macro_week_id, freeze_version)`;
- row-level weekly currency snapshots kept as sealed source evidence, not
  executable truth;
- revocation/quarantine/supersession fields;
- snapshot state-transition scaffold;
- execution receipt scaffold.

Gate 50 first source slice:

- BPR availability now uses
  `cftc_bpr_exception_calendar_v2_2019_2025_lapse_holiday`.
- Normal CFTC BPR release timestamp is Friday 15:30 America/New_York.
- First-Tuesday federal-holiday report-date handling is explicit.
- 2019 January/February lapse reports use official February 8 and February 22
  catch-up release dates.
- December 2025 uses official December 17 catch-up release.
- October/November 2025 are conservative not-before rows and remain
  promotion-blocked until exact BPR catch-up dates are sourced.

## Current Local Credential State

Local process and env files currently have no:

- `FRED_API_KEY`
- `ALFRED_API_KEY`
- `ESTAT_APP_ID`

Therefore FRED/ALFRED point-in-time rate/CPI fills and e-Stat JPY CPI Table
`1-1` promotion fills cannot run promotion-grade locally yet. They must fail
closed until credentials are configured.

## Verification Already Passed

Commands/evidence:

- `npx tsc --noEmit --project app/tsconfig.json --pretty false`
- no-source dry-run: `2` weekly manifests, zero writes
- BPR-only 2019 dry-run: `10/10` live CFTC reports, `90` BPR observations,
  `10` live CFTC artifacts, `90` availability events, `36` exact exception
  observations, `0` promotion-blocked observations
- BPR-only 2025 dry-run: `10/10` live CFTC reports, `90` BPR observations,
  `10` live CFTC artifacts, `90` availability events, `54` exception
  observations, `36` promotion-blocked not-before observations
- FRED rate dry-run without key failed closed:
  `FRED_API_KEY or ALFRED_API_KEY is required...`
- `npx eslint app/scripts/verification/audit-macro-regime-join-coverage.ts`
- `git diff --check` passed with only existing LF/CRLF warnings

Ignored receipt paths:

- `app/reports/data-verification/macro-regime/gate50-no-source-dry-run-20260620.json`
- `app/reports/data-verification/macro-regime/gate50-bpr-exception-calendar-2019-dry-run-20260620.json`
- `app/reports/data-verification/macro-regime/gate50-bpr-exception-calendar-2025-dry-run-20260620.json`
- `app/reports/data-verification/macro-regime/gate50-macro-join-coverage-package-script-20260620.json`

## New Join-Proof Scaffold

Added script:

- `app/scripts/verification/audit-macro-regime-join-coverage.ts`

Added package entry:

- `npm run verification:audit-macro-regime-join-coverage`

Purpose:

- zero P&L;
- zero strategy decision;
- no stops, TP, runner, grid-entry, re-entry, or pair filtering;
- bind the macro snapshot layer to the exact locked Gate 44 matrix control;
- fail closed unless macro rows are joined through eligible aggregate weekly
  manifests in allowed snapshot states;
- default allowed state is `ACTIVE`;
- enforce required macro source families:
  `bpr`, `rate`, `inflation`, `real_rate_pressure`, `valuation`;
- flag legacy/non-canonical source families such as `real_value`;
- flag missing, stale, or unavailable row-level source snapshots for the
  currencies in each pair-week context.

The script also writes a Markdown/JSON receipt and exits `1` by default when
promotion blockers remain. `--allow-fail` is only for producing diagnostic
receipts without aborting the shell run.

## Locked Matrix Control

Control dataset:

- dataset id: `479624d1-f6a2-4928-82f1-981137762bdc`
- dataset hash:
  `cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36`
- exact weeks: `372`
- FX pairs: `28`
- source-context rows: `10,416`
- week-id hash:
  `54e26e0cc3718d86b53496fc977dfcdd7c9d8841bbaa21defdb3fc4832ba21aa`

This is the same 372-week control window we intend to use for the eventual
matched macro attribution test.

## Current Join-Proof Result

Package-script command:

```powershell
npm run verification:audit-macro-regime-join-coverage -- --macro-regime-dataset-id=a403b126-9f65-4a35-b353-0b9dcc986bd0 --allow-fail --sample-limit=3 --json-out=app/reports/data-verification/macro-regime/gate50-macro-join-coverage-package-script-20260620.json
```

Result:

- promotion grade: `FAIL`
- expected pair-week contexts: `10,416`
- matrix pair-week contexts: `10,416`
- joinable pair-week contexts: `0`
- blocked pair-week contexts: `10,416`
- no P&L computed: `true`
- no strategy filter computed: `true`

Pinned exploratory macro dataset:

- regime dataset id: `a403b126-9f65-4a35-b353-0b9dcc986bd0`
- dataset hash:
  `b184c49fbedc202dad061366ca6dbc25478470230549847fe56b420aa8647ca8`
- source families present: `bpr`, `inflation`, `rate`, `real_value`
- unexpected source families: `real_value`
- missing required families: `real_rate_pressure`, `valuation`

Promotion blockers:

| Blocker | Count |
|---|---:|
| `macro_dataset_missing_promotion_manifest_id` | 1 |
| `macro_dataset_missing_contract_manifest_hash` | 1 |
| `missing_required_source_family:real_rate_pressure` | 1 |
| `missing_required_source_family:valuation` | 1 |
| `unexpected_macro_source_family:real_value` | 1 |
| `no_macro_weekly_snapshot_manifests_for_matrix_weeks` | 1 |
| `missing_weekly_snapshot_manifest` | 372 |
| `pair_week_join_coverage_incomplete` | 1 |

Fail-closed proof:

- same audit without `--allow-fail` exited with code `1` when blockers remained.

Interpretation:

- The locked matrix control is valid.
- The existing exploratory macro rows cannot be used for a 7-year macro test.
- Gate 50 remains active.
- The next source fill must produce promotion manifests, contract hash, active
  weekly aggregate manifests, and canonical source families before any macro
  outcome test can run.

## Known Remaining Gate 50 Blockers

- configure `FRED_API_KEY` or `ALFRED_API_KEY`;
- configure `ESTAT_APP_ID`;
- prove FRED/ALFRED point-in-time reconstruction for rates and CPI with
  date-only conservative eligibility;
- prove JPY CPI e-Stat Table `1-1` all-items path and base-vintage continuity;
- Table `4-1` remains validation-only unless a new source contract and full
  backfill are approved;
- produce source-only promotion fill receipts;
- prove rebuild-to-identical snapshot hashes;
- prove before/at/after freeze boundary behavior;
- prove one-active-snapshot uniqueness;
- prove revocation/quarantine/fail-closed behavior;
- prove forward settlement/activation/execution-read receipts.

## Specific Review Questions

1. Is the join-proof scaffold institutionally sufficient as the gate between
   source promotion and macro outcome testing?
2. Should `ACTIVE` be the only allowed default state for a promotion-grade
   7-year macro test, or should historical `VERIFIED`/`SEALED` manifests be
   allowed under a separate proof mode?
3. Does the script need to require `effective_from_utc` on every historical
   manifest, or is that only required for live executable snapshots?
4. Are `promotion_manifest_id`, `contract_manifest_hash`, `macro_week_id`,
   `freeze_version`, `snapshot_id`, `snapshot_hash`, and `snapshot_state`
   enough identity for a promotion manifest, or should the join receipt also
   bind to a source registry hash and source-map hash explicitly?
5. Should source-family requirements be all five by default
   (`bpr`, `rate`, `inflation`, `real_rate_pressure`, `valuation`), or should
   early source-family tests run one family at a time with an explicit
   `required-source-families` override?
6. Should missing/stale/unavailable row-level snapshots block the pair-week
   join even when the aggregate manifest exists, or should they only block if
   that source family is required for the selected macro feature?
7. What additional receipts would you require before permitting the first
   source-only macro attribution run?
8. Given the external critique about marked-to-market risk, should the next
   gate after source promotion be a unified MtM ledger gate before any
   capital-level macro performance claims?

## Proposed Next Step If Review Passes

Do not run a macro outcome test. Continue Gate 50:

1. configure credentials;
2. run promotion-bound source fill;
3. generate active weekly aggregate manifests;
4. prove rebuild-identical hashes and boundary/fail-closed behavior;
5. rerun the join audit until it reaches `10,416/10,416` joinable pair-week
   contexts under the promotion contract.

Only after that should we consider opening macro attribution logic. The first
post-source performance-adjacent gate should likely be a unified
marked-to-market risk/accounting ledger for the frozen execution contract, not
stop tuning or strategy optimization.
