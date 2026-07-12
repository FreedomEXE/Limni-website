# Gate 48: Macro Source Contract Review Handoff

Date: 2026-06-19

## Purpose

Fresh-eyes source review before any Gate 47 signal test or overlay.

The current macro regime warehouse has working v0 rows for BPR, rates, CPI,
real-rate snapshots, OECD PPP/exchange-rate valuation, and BIS REER/NEER. The
blocker is not whether the data layer can fill rows. The blocker is whether the
source contract is simple, official enough, current enough, and reproducible
across both the seven-year backtest and future live fills.

Do not run signal tests in this review. Do not tune stops, TP, runners, grid
entries, pair filters, or combined BPR/rate/CPI regime logic.

## Current Gate 47 Source Stack

Implementation surfaces:

- `database/migrations/029_macro_regime_source_warehouse.sql`
- `app/src/lib/research/macroRegimeDataset.ts`
- `app/scripts/verification/fill-macro-regime-source-warehouse.ts`
- `docs/research/GATE47_REAL_VALUE_REGIME_RESEARCH_HANDOFF_2026-06-19.md`
- `docs/backlog/CURRENT_WORK.md`

Persisted v2 source dataset:

- Dataset id: `a403b126-9f65-4a35-b353-0b9dcc986bd0`
- Dataset hash:
  `b184c49fbedc202dad061366ca6dbc25478470230549847fe56b420aa8647ca8`
- Raw observations: `12,058`
- Weekly snapshots: `19,788`
- Families: `bpr`, `rate`, `inflation`, derived `real_rate_pressure`

Persisted valuation slices:

- OECD Table 4 only: `5cd8e166-772a-4d1c-868a-582e70567558` /
  `60ba3840779b5ea62443fe8b94fc19c272bbe903595cdf0ba0ff7430ce58284d`
- OECD Table 4 plus BIS EER: `97266ab2-6feb-4962-936b-a47d73c06684` /
  `3131935ee881bfde850440a272fec06f1de5d3c3710a50e64d23552a0fed4cc0`

## Source Families To Audit

### BPR

Current source:

- CFTC Bank Participation Reports.
- Source ids: `cftc_bpr_futures`, `cftc_bpr_options`.
- Live CFTC report pages are fetched first.
- Wayback is used only as a fallback for canonical CFTC report URLs when live
  CFTC paths fail.
- The fill stores canonical CFTC URL, archive timestamp where used, report
  date, available timestamp, source hash, and missing/stale flags.

Review questions:

- Is CFTC the only acceptable source for BPR? It probably is.
- Is Wayback fallback acceptable for historical official CFTC pages if the
  canonical CFTC URL and archive timestamp are stored?
- Are report availability assumptions defensible for the seven-year as-of
  contract?
- Should BPR coverage gaps by FX currency be treated as missing/neutral rather
  than filled? Current answer should remain yes unless evidence says otherwise.

### Rates

Current source:

- FRED mirrors of OECD monthly 3-month interbank rates for all eight FX
  currencies.
- FRED mirrors of OECD monthly call-money/overnight interbank rates.
- FRED daily policy/reference rates only for USD, EUR, and GBP as separate
  candidate context.

Review questions:

- Can OECD direct SDMX provide the same 3-month interbank rate contract for all
  eight currencies with better provenance than FRED mirror series?
- If not, is FRED/OECD acceptable as v1, with central-bank policy rates kept
  shadow-only?
- Are 3-month interbank rates the smallest comparable rate contract, or should
  the promoted contract use policy rates instead? Do not mix them under one
  feature name.
- What is the correct available-date delay per rate source?

### CPI / Inflation

Current source:

- Mostly FRED mirrors of OECD CPI index series.
- EUR uses FRED/Eurostat HICP.
- USD uses FRED/BLS CPI.
- YoY inflation is derived from CPI index level minus the prior-year index.

Known blocker:

- JPY source id `fred_JPNCPIALLMINMEI` ends at `2021-06-01` locally.
- This makes JPY real-rate-pressure rows stale for `245/388` Gate 47 weeks.
- Official Japan CPI exists through Statistics Bureau/e-Stat, but promotion
  needs either an env-gated e-Stat API path or a reviewed official XLSX parser.

Important one-source finding to challenge:

- OECD direct `DF_PRICES_ALL` is free and official-institutional, but a narrow
  probe on 2026-06-19 was not sufficient as a one-source replacement:

```txt
https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL/AUS+CAN+CHE+EA20+GBR+JPN+NZL+USA.M..CPI.IX._T.N._Z?startPeriod=2019&dimensionAtObservation=AllDimensions&format=csvfilewithlabels
```

Observed from that probe:

- CAN national monthly CPI: `2019-01` to `2026-04`.
- CHE national and HICP monthly CPI: `2019-01` to `2025-12`.
- EA20 national/HICP monthly CPI: `2019-01` to `2025-12`.
- GBR national and HICP monthly CPI: `2019-01` to `2026-05`.
- USA national monthly CPI: `2019-01` to `2026-05`.
- AUS monthly CPI in this exact query starts only `2024-04`.
- JPN national monthly CPI still ends `2021-06`.
- NZL did not return in this exact monthly query.

Review questions:

- Is there another OECD CPI flow, dimension, or base-period contract that gives
  all eight FX currencies through current observations?
- If OECD cannot give all eight current CPI series, is IMF CPI monthly API a
  better single-source path?
- If no single free institutional source gives all eight properly, is the
  smallest robust contract:
  - OECD/Eurostat/BLS where current and direct,
  - Statistics Bureau/e-Stat for Japan,
  - national statistics agencies for AUD/NZD if OECD only provides quarterly or
    delayed data?
- Should AUD/NZD remain quarterly CPI in the promoted contract, or should a
  monthly indicator be shadow-only because the official CPI cadence is
  quarterly?
- Should CPI be stored as raw index plus YoY derived row, with exact
  observation date, available date, stale window, missing reason, source hash,
  and `feature_version`?

### Valuation

Current source:

- OECD Table 4 annual PPP and annual average exchange-rate rows.
- BIS official v2 SDMX monthly broad NEER and REER rows.

Review questions:

- Are BIS broad NEER/REER the right official monthly valuation source for all
  eight FX currencies?
- Is OECD Table 4 PPP enough as annual purchasing-power valuation context, or
  should OECD comparative price level be used only when a historical API path is
  verified?
- What stale window should annual PPP use in weekly snapshots?
- Should valuation remain separate from real-rate pressure until separate tests
  prove signal?

## Required Output

Produce a source-review note before implementation:

1. A source matrix by family, currency, source id, provider, endpoint, cadence,
   observation-date semantics, available-date semantics, current latest
   observation, and historical start coverage.
2. A classification for each source:
   `primary_official`, `institutional_direct`, `institutional_mirror`,
   `archive_fallback`, or `shadow_only`.
3. A recommended smallest promoted source stack for:
   BPR, 3-month rates, CPI/inflation, real rates, PPP, NEER, and REER.
4. A replacement plan for any weak source, starting with JPY CPI.
5. A rule for live/test parity: no live-only source can drive promoted
   decisions unless backfilled or versioned and retested.
6. Proof commands or URLs used for coverage checks.

## Hard Rules For The Reviewer

- Read recovery surfaces first:
  - `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
  - `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
  - `AGENTS.md`
  - `docs/backlog/CURRENT_WORK.md`
  - this handoff
- Keep the review read-only unless Freedom explicitly authorizes source-fill
  implementation.
- Do not modify release canon.
- Do not touch the Pine verifier.
- Do not run strategy, signal, overlay, or combined-regime tests.
- Do not silently rewrite v0 rows. New sources must use new source ids or a new
  dataset/feature version.

## Gate 49 Weekly Freeze Addendum

Decision added after external review synthesis:

- The macro regime layer is a weekly frozen source layer, like Strength and COT
  directional inputs for the first seven-year test.
- A source row is eligible for a displayed week only when its `available_at_utc`
  is at or before that week's macro `freeze_target_utc`.
- For the first seven-year test, the macro `freeze_target_utc` is the canonical
  `week_open_utc` used by the macro weekly snapshot warehouse.
- Any BPR, rate, CPI, PPP, NEER, or REER update released after that cutoff is
  stored as a raw observation, but it cannot change the already-frozen week; it
  first becomes eligible in the next weekly snapshot.
- Moving to Friday-close, Sunday-market-open, or real-time macro reactivity
  requires a new freeze version and a fresh test. It must not silently reinterpret
  Gate 47/Gate 49 rows.

## Gate 49 External Review Disposition

Final disposition after ChatGPT Pro, Gemini, and Codex review:

- Approve `macro_weekly_signal_freeze_v1` with canonical `week_open_utc`; reject
  Friday `21:00 UTC` as the v1 default.
- Separate freeze from settlement: freeze defines source eligibility, while the
  weekend settlement layer must ingest, build, seal, report, and verify the
  weekly macro snapshot before the `20:00 America/New_York` execution layer.
  If the settled snapshot is not ready, live execution fails closed until fixed.
- Metadata alone does not make modeled availability promotion-grade. FRED/OECD
  rate and CPI rows must be reconstructed with ALFRED/FRED real-time
  periods/vintages as of the freeze before promotion; otherwise Gate 50 must be
  labelled latest-vintage exploratory research.
- Date-only or approximate availability cannot win an exact-boundary tie.
  Promotion-bound rows with uncertain availability must roll to the first
  subsequent canonical week open.
- Rename derived `real_value` rows to `real_rate_pressure` under a new feature
  version. PPP, NEER, and REER stay separate valuation inputs and remain
  shadow-only until their own availability contracts are hardened.
- JPY CPI primary target is Statistics Bureau/e-Stat Table `1-1`, monthly
  Subgroup Index for Japan, exact all-items code. Table `4-1` all-items is the
  validation/fallback path. Pin release-specific `statsDataId`/`stat_infid`
  values; do not rely on the broad table label. `ESTAT_APP_ID` is required for
  API access and must not enter dataset metadata or hashes.
- Add row-level and snapshot-level lineage in JSON metadata at minimum:
  `selectedRawObservationId`, `vintageDate`, `parentRawObservationIds`,
  `calendarVersion`, `snapshotSealedAtUtc`, `snapshotHash`, and
  `datasetManifestHash`.
- BPR can keep the official first-Friday-after-15:30-ET rule, but promotion
  requires an exception check for holidays, shutdowns, or delayed reports.

## Gate 49 Final Hardening Slice

Implementation follow-up:

- Derived family is now `real_rate_pressure`; `real_value` is no longer emitted
  by the macro fill code.
- FRED/OECD rate and CPI rows now require `FRED_API_KEY` or `ALFRED_API_KEY`
  for promotion-bound fills. With a key, the script uses FRED/ALFRED series
  observations `output_type=4` initial-release rows, with date-only availability
  assigned conservatively at end-of-day so exact-boundary ties roll forward.
- Latest-vintage FRED graph CSV is now only available with explicit
  `--allow-exploratory-source-fallback`; such output remains exploratory and
  cannot support a promotion-grade Gate 50.
- JPY CPI is now a separate source id:
  `estat_japan_cpi_table_1_1_all_items_2020_base`. The path requires
  `ESTAT_APP_ID`, targets Table `1-1`, and records Table `4-1` as
  validation/fallback metadata. The credential is redacted from URLs and excluded
  from hashes.
- Without `ESTAT_APP_ID`, JPY CPI fails closed unless exploratory fallback is
  explicitly requested; the old FRED/OECD Japan CPI stream is no longer a silent
  promotion path.
- Local credential check on 2026-06-19 found no `FRED_API_KEY`/`ALFRED_API_KEY`
  and no `ESTAT_APP_ID`, so the repo is code-ready but not locally runnable for
  a promotion-grade macro source fill until those credentials are configured.
- The five-layer architecture is now represented as code:
  `sourceVersions.sourceRegistry` records economic authority,
  compiler/harmonizer, dissemination endpoint, promoted endpoint, availability
  contract, revision policy, rebasing policy, exception status, and promotion
  state per source.
- The warehouse now has `research_macro_source_artifacts` as the immutable
  evidence archive. It stores sanitized request metadata, response headers,
  HTTP status, raw payload hash/size/text, and artifact metadata. Credentials
  are redacted before URL/request metadata enters dataset hashes.
- Source observations now preserve `rawArtifactId`/`rawArtifactIds` in addition
  to row hashes and raw observation ids. Weekly snapshots carry selected raw
  artifact lineage, and derived `real_rate_pressure` snapshots carry parent raw
  observation ids plus parent artifact ids.
- Verification after this slice:
  - `npx tsc --noEmit --project app/tsconfig.json --pretty false` passed.
  - A no-source dry-run passed with zero artifacts/observations/snapshots.
  - A one-week BPR-only dry-run passed with `3` live CFTC HTML artifacts,
    `27` BPR observations, `8` BPR weekly snapshots, `291,604` payload bytes,
    and zero writes.
- Remaining promotion blocker: do not run Gate 50 as a promotion test until
  `FRED_API_KEY`/`ALFRED_API_KEY`, `ESTAT_APP_ID`, JPY base-vintage continuity,
  and BPR delayed-report exception handling are proven. Without that, Gate 50
  must be explicitly labelled exploratory.

## Codex Pro Architecture Review Amendments

High-level Codex Pro review returned `approve with amendments`. The institutional
source hierarchy is accepted, and the two blocking contract amendments are now
represented in Gate 49 code:

- endpoint capability is split into `retrieval_capability`,
  `availability_precision`, and `eligibility_policy`. BPR is
  `release_event_filterable` / `scheduled_window` /
  `eligible_at_or_before_freeze`; FRED/ALFRED is `as_of_queryable` / `date` /
  `first_freeze_strictly_after_date`; capture-only valuation inputs remain
  shadow-only; derived `real_rate_pressure` inherits parent eligibility;
- four clocks plus completion/activation are explicit:
  `freeze_target_utc`, `settlement_deadline_utc`,
  `settlement_completed_at_utc`, `sealed_at_utc`, `verified_at_utc`,
  `activated_at_utc`, and `effective_from_utc`;
- first-class availability-event evidence with basis, retrieval capability,
  precision, eligibility policy, timezone, confidence, promotion-eligible
  availability bases, exception/eligibility calendar versions, evidence
  artifact, rule version, and eligible freeze id;
- aggregate weekly snapshot lifecycle state where execution requires an `ACTIVE`
  `research_macro_weekly_snapshot_manifests` row, not merely sealed row-level
  source snapshots;
- exactly one `ACTIVE` aggregate weekly snapshot may exist per
  `(promotion_manifest_id, macro_week_id, freeze_version)`;
- post-activation corrections use revocation/quarantine/supersession fields and
  must fail closed for the affected week instead of mutating trading truth;
- future execution reads must emit `research_macro_execution_receipts`;
- semantic-drift controls: semantic contract hash, provider metadata hash,
  schema hash, segment id, continuity decision, conversion/normalization
  versions, and fail-closed drift action;
- deterministic source selection under a versioned selector;
- staleness/carry metadata separating expected carry-forward from overdue
  release state;
- no runtime table/provider fallback. CFTC archive is internal replay evidence
  for canonical CFTC artifacts, and JPY Table `4-1` is validation-only.

Implementation state after this amendment slice:

- `research_macro_regime_datasets` has promotion-manifest, contract-hash,
  lifecycle/clock/version, revocation, and supersession columns.
- `research_macro_availability_events` exists and is persisted before
  observations with the split retrieval/precision/eligibility dimensions.
- `research_macro_weekly_snapshot_manifests`,
  `research_macro_snapshot_state_transitions`, and
  `research_macro_execution_receipts` exist in the warehouse contract.
- `sourceVersions` includes the four-clock model, snapshot activation states,
  endpoint availability dimensions, active-snapshot uniqueness, availability
  rule version, selector version, and source-registry drift controls.
- Weekly snapshots carry `selectedAvailabilityEventId`,
  `selectionRuleVersion`, deterministic selector order, staleness rule version,
  carry-forward flag, stale flag/reason, release-overdue duration, row snapshot
  id/hash, promotion manifest id, contract manifest hash, macro week id, and
  freeze version.
- Verification after the final amendment patch: app TypeScript passed; a narrow
  no-source `--dry-run` passed with `2` weekly manifests and zero writes; a
  narrow BPR-only `--dry-run` passed with `3` live CFTC HTML artifacts, `27`
  BPR observations/events, `2` weekly manifests, and all availability events
  classified as `release_event_filterable` / `scheduled_window` /
  `eligible_at_or_before_freeze`; a promotion-bound FRED rate dry-run without
  `FRED_API_KEY`/`ALFRED_API_KEY` failed closed as intended.

Remaining pre-Gate-50 blockers are operational/source proof, not another
architecture review: credentials, JPY base-vintage continuity, BPR delayed-
report exception calendar, source-only promotion fill receipts, rebuild-to-
identical snapshot hashes, boundary tests, one-active-snapshot tests,
revocation/fail-closed tests, and forward settlement/activation/execution-read
receipts.
