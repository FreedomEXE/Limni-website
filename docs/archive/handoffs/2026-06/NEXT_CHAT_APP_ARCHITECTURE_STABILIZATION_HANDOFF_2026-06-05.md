# Next Chat App Architecture Stabilization Handoff - 2026-06-05

## Read First

This handoff is for the next fresh chat. Freedom is stopping the current Codex High / Extra High threads because repeated patching has not produced a stable app flow.

Before doing any strategy research, backtest, reconstruction, or comparison, read:

- `AGENTS.md`
- `docs/BACKTEST_CANONICAL_PROTOCOL.md`
- `docs/FUTURE_UPGRADES.md`
- `src/lib/performance/basketSource.ts`

Required handoff line from `AGENTS.md`:

`Before any new backtest, verify parity against canonical app baselines using basketSource.ts and the approved closed-week window. If parity fails, stop research and fix parity first.`

Important architecture warning from `AGENTS.md`: closed historical weeks should be treated as immutable under an app/engine version. Do not introduce paginated/lazy historical fetching for closed-week canon unless Freedom explicitly approves it as temporary debt. Prefer a versioned local/bundled canon shape, or a temporary whole-bundle endpoint with the same shape.

## Why This Handoff Exists

Freedom's goal is not a toy dashboard. The system is intended to become an investable, automatable trading platform. The current repo is carrying research-era debt: Data, Status, Performance, source-readiness audit, release canon, preload/kernel behavior, and UI projections are not cleanly separated. Recent fixes have solved some symptoms while creating new ones.

Do not continue patching isolated symptoms. The next pass should be an architecture stabilization review and plan, followed by scoped implementation only after the data-flow contract is explicit.

Target spine:

`Raw source data -> frozen source ledger -> canonical signals -> canonical performance artifacts -> UI projections -> automation`

No page should invent, backfill, relabel, or locally recompute source truth without an explicit versioned contract.

## High-Level Position As Of This Handoff

This is the important executive state for the next chat:

- The v2.0.3 work has done real hardening: ADR Grid rule definitions, drawdown/MAE contracts, source-readiness gates, Strength repair, Friday-freeze source ledger work, Data/Status source diagnostics, and stale-canon blocking all improved the system.
- The app is still not release-usable because the architecture is unstable. The latest Data "speed fix" changed the payload to one-report lazy loading, but Freedom is seeing blank states, snap-back to current week, and selected weeks only appearing after selecting them twice.
- The current app flow is therefore failing Freedom's basic expectation: if the platform has a preload/kernel layer, closed historical Data should already be available and stable, not discovered lazily through glitchy page state.
- v2.0.3 is blocked in two different ways:
  1. Source-release truth: the full 19-week source gate still fails on four Jan/Feb Sentiment rows.
  2. Product usability/trust: Data and Performance are not stable enough to be used as an institutional review surface.
- Do not treat these as independent UI bugs. They are symptoms of a bad boundary between research computation, frozen source truth, release canon, UI projection, and live/current-week refresh.

Freedom's preferred direction is pragmatic, not endless refactor:

- First, find the smallest honest architecture path that makes v2.0.3 usable and truthful.
- Then, after v2.0.3 is stable enough to move forward, do the larger v3 architecture/database/codebase refactor.
- Do not spend another pass creating local patches that make one screen look fixed while breaking preload, timestamps, Performance, or source truth.

## Possible Simple Salvage Path For v2.0.3

The next chat should evaluate this path before proposing a full rewrite.

Potential v2.0.3 stabilization strategy:

1. Stop trying to make Data both a live recomputation surface and a historical source-of-truth surface.
2. Build a versioned, precomputed Data projection bundle for the approved closed-week window.
   - This can be a temporary whole-bundle endpoint or local/bundled shape.
   - This aligns with `AGENTS.md`: prefer "single bundle now, swap source later" over lazy historical fetching.
   - It should include all approved closed weeks needed by Data, so week switching is instant and cannot blank/snap back.
3. Keep current/upcoming week separate from closed historical canon.
   - If the current Friday freeze ledger exists and is trusted, show it as the current planning week.
   - If it is missing, partial, stale, or future-timestamped, Status should say so and Data should not present it as frozen truth.
4. Keep Status as the heavy diagnostics and source-audit surface.
5. Keep Performance blocked/stale until clean14/frozen-ledger Performance metrics are regenerated or until full v33 canon is approved.
6. Do not present v2.0.3 as full 19-week source truth unless Jan/Feb Sentiment is repaired/replaced and `npm run source:completion:release` passes serially.

There are two honest release/baseline choices. Freedom must approve which one applies:

- Strict 19-week release truth: still blocked until Jan/Feb Sentiment is repaired or replaced.
- Usable clean14 comparison baseline: can be made app-stable if explicitly labeled `v2.0.3-clean-14w`, with full disclosure that it is not the original full 19-week source-trusted release.

The next chat should not silently choose either path.

## v2.0.3 Release Checklist State

This checklist is the release-level summary. It is intentionally blunt.

### Completed Or Mostly Completed

- [x] ADR Grid execution/risk contract moved into release docs/specs.
- [x] Drawdown/MAE terminology improved: Path DD, Close DD, MAE separation.
- [x] Source completion/readiness script hardened with JSON/strict gates.
- [x] Dealer/COT source readiness trusted across the active 19-week baseline.
- [x] Commercial/COT source readiness trusted across the active 19-week baseline.
- [x] Strength repaired across the active 19-week baseline.
- [x] Raw Sentiment retention policy changed so future raw Myfxbook rows should not be lost after 24 hours.
- [x] Friday 17:00 New York freeze helper added.
- [x] clean14 Friday-freeze ledger was built and reported passing.
- [x] Data source/audit cards were moved out of Data and into Status.
- [x] Performance was changed to avoid showing stale/deprecated 19/23-week metrics as v2.0.3 canon.

### Blocked Or Not Trustworthy Yet

- [ ] Full 19-week release source gate still fails on four Jan/Feb Sentiment rows.
- [ ] Current/upcoming Friday freeze workflow is not proven.
- [ ] Current `Jun 08 2026` Data page shows future timestamps and legacy source fallback.
- [ ] Data week switching is unstable in Freedom's live review: blank state, snap-back to current week, then loaded on second selection.
- [ ] The latest one-report lazy Data payload may conflict with the intended preload/kernel architecture.
- [ ] Performance clean14/frozen-ledger metrics have not been regenerated and approved.
- [ ] v33 canon regeneration remains blocked.
- [ ] Database/source ledger schema still needs institutional migration/backup/retention hardening.
- [ ] Final release screenshots are not approved as go-live evidence.
- [ ] App architecture has not passed a full review for Data, Performance, Status, and Automation boundaries.

### Do Not Do Yet

- [ ] Do not automate trading.
- [ ] Do not optimize strategies.
- [ ] Do not switch sentiment systems as part of this stabilization pass unless explicitly approved.
- [ ] Do not regenerate v33 canon from unstable source/UI contracts.
- [ ] Do not tag/push/deploy v2.0.3 as released.

## What Was Lost / Why This Matters

The next chat should understand the stakes.

- Raw Jan/Feb Myfxbook Sentiment evidence appears to have been lost or purged by earlier bad retention logic.
- The DB retained aggregates for some historical sentiment weeks, but not trusted raw provider proof for four Jan/Feb baseline rows.
- This is why the full 19-week source-trusted release gate remains blocked.
- The architecture must now prevent this from happening again:
  - long raw retention,
  - source-ledger persistence,
  - backups,
  - migrations instead of runtime table creation,
  - Status alerts for missing/stale/current freeze issues,
  - no page-level fake precision.

This project has had six months of work put into it. The next chat must treat data loss, future timestamps, unstable preload behavior, and fake source precision as serious production/investor-readiness failures, not minor UI polish.

## Current Release/Data State

Known source-readiness state:

- Dealer/COT: trusted across the full 19-week active baseline.
- Commercial/COT: trusted across the full 19-week active baseline.
- Strength: repaired and trusted across the full 19-week active baseline.
- Sentiment: still missing trusted raw proof for four Jan/Feb rows:
  - `2026-01-19`
  - `2026-01-26`
  - `2026-02-02`
  - `2026-02-16`

Clean consecutive comparison baseline:

- `v2.0.3-clean-14w`
- `2026-02-23T00:00:00.000Z` through `2026-05-24T23:00:00.000Z`
- 14 consecutive trusted weeks
- clean14 source completion and Friday-freeze checks were reported passing

Full release gate:

- `npm run source:completion:release`
- still fails correctly on the 4 Jan/Feb sentiment rows

Do not regenerate v33 canon until the baseline decision is settled and source truth is stable.

## Major Recent Changes Since Extra High Review

### Source Readiness / Freeze

- Strength warmup/prior-return gaps were repaired.
- Sentiment raw retention was changed from a 24-hour raw purge to long retention:
  - `SENTIMENT_SNAPSHOT_READ_HOURS=24`
  - `SENTIMENT_RAW_RETENTION_DAYS=2555`
- Friday 17:00 `America/New_York` freeze helper was added.
- A clean14 Friday-freeze ledger was added and persisted.
- Data and basket paths were changed to consume frozen ledger rows when present.
- Status was given freeze/source diagnostics.

Important caveat: the current/upcoming `Jun 08 2026` planning week is not proven to have a valid frozen Friday ledger. In the latest runtime check, it was falling back to legacy/current source timestamps.

### Loader / Kernel

Earlier bug: `/dashboard?bias=sentiment` triggered Performance canon/kernel preloading because `bias` was treated as a strategy selector. This blocked normal Data access behind stale Performance canon work.

Reported fixes:

- `deriveActiveSelectionFromParams()` no longer treats `bias` as a strategy selector.
- `AppPreloadGate` only runs Performance canon kernel/legacy preload on `/performance`.
- `/api/canon/v2/week` fails fast when release canon is stale.
- Stale week endpoint returned `409` quickly with `Performance canon stale: v33 regeneration required`.
- Dashboard/Data made zero `/api/canon/*` requests in browser smoke checks.

Extra High patched `src/lib/__tests__/canonApiStaleRoutes.test.ts` so stale canon rejects before expensive correction-shard repair work. That file was untracked at the time of review and must be included if the work is committed.

### Data / Status / Performance

Codex High moved source ledger/audit cards out of Data and into Status. Good direction.

Codex High then changed Data payload shape:

- `/api/dashboard/payload` supports `?report=...`
- Data initially loads one selected report instead of all 24 reports
- Client week switching fetches and merges one report on demand
- Report options include context such as:
  - `Trading week May 04 2026 | Friday freeze May 01 2026 5:00 PM EDT | COT report Apr 28 2026`

Measured proof file exists:

- `releases/v2/screenshots/measured-browser-proof-2026-06-05.json`

Screenshots were saved under:

- `releases/v2/screenshots/data/`
- `releases/v2/screenshots/status/`
- `releases/v2/screenshots/performance/`

Reported measurement improvement:

- Data API payload: `3.68 MB -> 170,843 bytes`
- Data initial HTML: `~4.4 MB -> 297,052 bytes`
- Dashboard `/api/canon/*` requests: `0`
- Performance navigation from Data: `784 ms`

Important caveat: this may be an architecture deviation. Freedom expected an institutional preload/kernel engine that actually preloads the app's stable data, not a patchwork lazy/on-demand system that blanks or glitches on week changes.

## Current Unacceptable Runtime Issues

Freedom observed after the latest pass:

1. Switching between weeks in Data sometimes shows nothing for a week.
2. It then glitches/reverts to the current week.
3. Going back to the originally selected week then shows it loaded.
4. This defeats the purpose of having a preloader/kernel.
5. Week/bias switching still feels slow and unstable to Freedom.

Extra High's latest runtime checks found:

- `May 01 2026` is now visible as the Friday freeze date for `May 04 2026`. That part improved.
- Previous historical `7:00 PM ET` "Snapshot" leakage appeared improved in the checked May 04 week.
- Performance now shows a stale-canon warning instead of old `23 WEEKS TRACKED` release truth.
- Current `Jun 08 2026` still shows future source timestamps:
  - Machine time checked: `2026-06-05T19:49:41-04:00`
  - Data showed: `SNAPSHOT JUN 05, 2026, 11:40 PM ET`
  - Payload values were in the future:
    - COT: `2026-06-06T03:40:10.426Z`, about 230 minutes ahead
    - Sentiment: `2026-06-06T03:10:47.900Z`, about 200 minutes ahead
    - Strength: `2026-06-06T03:00:00.000Z`, about 190 minutes ahead
- Current `Jun 08` provenance was not from frozen ledger:
  - `sentiment_aggregates_legacy`
  - `strength_snapshots_legacy`

This is a release blocker. No displayed source timestamp may be later than current server/app time unless explicitly flagged invalid. If the current/upcoming freeze ledger is missing, Data must say freeze missing/legacy fallback, not imply the Friday freeze is ready.

## Specific Issues To Audit In The Next Chat

### 1. Preload / Kernel Contract

The preloader/kernel architecture is still not doing what Freedom expects.

Audit and decide:

- What exactly must be preloaded?
- What is allowed to be lazy?
- Which surfaces use immutable release/canon bundles?
- Which surfaces use live source data?
- Which surfaces are allowed to fetch on demand?
- How are loading, missing, stale, and invalid states represented without blank/glitchy UI?

Do not keep layering page-specific fixes until this contract exists.

### 2. Data Page Contract

Data should be fast, stable, and clean.

Required behavior:

- No blank state when switching weeks.
- No snap-back to current week after selecting another week.
- No hidden background load that makes the selected week appear only after selecting it twice.
- Data cards should remain v2.0.2-style core cards only.
- Audit/diagnostic bulk belongs on Status/debug.
- Date labels must distinguish:
  - Trading week
  - Friday freeze target
  - COT report date
  - Actual source capture/lock timestamp

Current concern: the one-report on-demand payload may conflict with the architecture rule against building historical UI around lazy fetching.

### 3. Timestamp Contract

Hard rules:

- `Snapshot` means actual source capture/lock timestamp only.
- It never means trading-week open.
- It never means generated-at time.
- It never means a future timestamp.
- COT source timestamp should come from actual `cot_snapshots.fetched_at`.
- Sentiment source timestamp should come from the exact frozen aggregate/source timestamp used.
- Strength source timestamp should come from the exact frozen strength source/lock timestamp used.
- If no trusted frozen source exists, the UI must say so.

Current failure: `Jun 08 2026` shows source timestamps from the future and legacy fallback sources.

### 4. Current / Upcoming Friday Freeze Workflow

Historical clean14 freeze ledger exists, but the current/upcoming weekly planning flow is not proven.

Need define:

- When Friday freeze is built.
- Which cron/manual command builds it.
- What happens if source data comes late.
- What Data shows between Friday 5 PM ET and Sunday market open.
- How Status alerts Freedom if current freeze is missing, partial, stale, or invalid.

The app should not present `Jun 08 2026` as frozen truth unless the actual freeze ledger for that week exists and is trusted.

### 5. Performance Baseline

Performance is currently blocked/stale:

- It should not show deprecated 19/23-week metrics as v2.0.3 canon.
- It currently shows a stale-canon warning, which is better than fake release truth.
- It still needs a real clean14/frozen-ledger performance regeneration before any v2.0.3 performance claims can be shipped.

Do not regenerate until Data/source truth is fixed.

### 6. Status Page

Status is now supposed to own:

- freeze target
- actual capture timestamp/range
- source version
- evidence class
- trust class
- ledger hash
- incidents
- raw provider evidence
- missing/stale diagnostics
- missing price lists

Audit Status screenshots and runtime. Make sure diagnostics moved out of Data are present and understandable on Status.

### 7. Version / Request Spam

High reported `/api/version/current` spam improved from hundreds of requests to 1 during Data -> Performance proof. Extra High also saw total observed requests higher than 1 in a fresh browser flow.

Audit:

- `AppVersionBadge`
- `AppPreloadGate`
- Performance session/kernel stores
- any repeated `fetch("/api/version/current")`

The version manifest should be cached or shared, not hammered during navigation.

## Files Most Likely Relevant

Preload/kernel:

- `src/components/AppPreloadGate.tsx`
- `src/lib/preload/preloadRegistry.ts`
- `src/lib/preload/preloadContract.ts`
- `src/lib/canon/canonStore.ts`
- `src/lib/canon/canonKernelStore.ts`
- `src/lib/performance/strategySessionStore.ts`
- `src/lib/performance/strategyClientCache.ts`

Data:

- `src/app/dashboard/page.tsx`
- `src/app/api/dashboard/payload/route.ts`
- `src/components/dashboard/DashboardViewSection.tsx`
- `src/components/dashboard/DashboardFilters.tsx`
- `src/lib/dashboard/loadMarketIntelligence.ts`
- `src/lib/dashboard/marketIntelligencePayload.ts`
- `src/lib/dashboard/marketIntelligenceStore.ts`

Source freeze:

- `src/lib/sourceFreeze/fridayFreeze.ts`
- `src/lib/sourceFreeze/sourceLedger.ts`
- `scripts/audit-friday-freeze-source-ledger.ts`
- `scripts/build-friday-freeze-source-ledger.ts`

Timestamps:

- `src/lib/performance/snapshotProvenance.ts`
- `src/lib/time.ts`
- `src/lib/dataSectionWeeks.ts`

Performance:

- `src/app/performance/page.tsx`
- `src/components/performance/PerformanceStrategyViewSection.tsx`
- `src/components/performance/PerformanceViewSection.tsx`
- `src/lib/performance/basketSource.ts`
- `src/lib/performance/strategyPageData.ts`

Status:

- `src/app/status/page.tsx`

Release/proof:

- `releases/v2/screenshots/measured-browser-proof-2026-06-05.json`
- `releases/v2/screenshots/data/`
- `releases/v2/screenshots/status/`
- `releases/v2/screenshots/performance/`

## Commands / Checks Mentioned

Previously reported passing:

- `npx tsc --noEmit --pretty false`
- `npx vitest run src/lib/__tests__/sourceCompletionAudit.test.ts`
- `npm run source:completion:clean14`

Still expected to fail until Jan/Feb sentiment is resolved:

- `npm run source:completion:release`

Useful runtime probes used by Extra High:

- `http://localhost:3001/api/dashboard/payload?asset=all`
- `http://localhost:3001/api/dashboard/payload?asset=all&report=2026-04-28`
- `http://localhost:3001/dashboard?report=2026-04-28&bias=dealer&asset=all`
- `http://localhost:3001/performance`

## Recommended Next Chat Opening Goal

Do not start by fixing one symptom.

Start with:

1. Read this handoff.
2. Read `AGENTS.md` and `docs/FUTURE_UPGRADES.md`.
3. Inspect the current Data/preload/source-freeze architecture.
4. Reproduce the Data week-switch glitch with Playwright.
5. Reproduce the `Jun 08` future timestamp bug.
6. Decide and document the correct architecture contract:
   - immutable bundled historical data vs selected-week lazy fetch
   - current/upcoming freeze data flow
   - preloader/kernel responsibilities
   - Status vs Data responsibilities
7. Only then implement.

## Non-Negotiable Acceptance For The Next Pass

Any "done" claim must include:

- screenshots
- measured route/API timings
- API payload sizes
- Playwright proof of week switching without blank/snap-back behavior
- proof no displayed source timestamp is in the future
- proof current/upcoming week freeze status is truthful
- proof Performance does not show stale/deprecated metrics as v2.0.3 canon
- proof Status contains the diagnostics removed from Data

If these proofs are absent, the pass is not complete.
