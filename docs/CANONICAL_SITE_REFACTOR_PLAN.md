/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Canonical Site Refactor Plan
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

Date: 2026-03-22
Status: DESIGN
Owner: Codex + Freedom
Review target: Nyx

This document supersedes the old Performance-only refactor framing in:
- `docs/PERFORMANCE_SECTION_REFACTOR.md`

The old document was useful when the repo still depended on mixed snapshot and report pipelines. It is now outdated because the project has a canonical price layer and a comprehensive weekly reconstruction report.

## Objective

Refactor the site so every historical price and historical performance surface reads from one canonical source of truth, while live/current-week surfaces remain clearly separated.

This is an architecture and data-contract plan. It is not a page-design spec.

## Core Principle

Do not let pages recompute historical truth.

Historical views should read canonical derived data.
Live views may compute current-week state, but they must not become the historical record.

## Canonical Data Boundaries

### Historical price truth

- `raw_price_bars`
- `canonical_price_bars`
- `pair_period_returns`

These are the only valid sources for historical pair moves.

### Historical system performance truth

- `reports/comprehensive-reconstruction.json`
- `strategy_backtest_runs`
- `strategy_backtest_weekly`
- `strategy_backtest_trades`

Use the comprehensive reconstruction report as the current app read model for now.
Use the DB-backed weekly/trade tables as the persisted audit trail.

Important implementation note:
- `comprehensive-reconstruction.json` must not be read and parsed on every request
- the canonical app read layer should parse it once and cache the typed result in process memory
- use a module-level singleton / runtime-cache style pattern
- if the file is regenerated, the cache should be explicitly invalidated or refreshed

Important scope note:
- today, the DB-backed tables are not yet a complete mirror of every canonical run variant
- the 6 composite baseline runs are persisted
- the standalone model runs, gated variants, and some deeper component breakdowns currently live primarily in the canonical report artifact
- do not assume `strategy_backtest_trades` contains complete trade-level history for every gated/model variant until that persistence work is added

### Signal attribution truth

- `performance_snapshots`

This remains the source for model votes, directions, support counts, tiering inputs, and pair-level attribution metadata.
It is not the canonical source of historical returns.

### Live/current-week pricing truth

- current `pricePerformance.ts` path
- `market_snapshots`

This remains acceptable for live boards and current-week surfaces for now.
It must not be reused as a historical performance source.

## Rules To Lock

1. No historical page may compute returns from `pricePerformance.ts`.
2. No flagship/performance page may use `reports/performance-accuracy-audit.json` as its primary data source.
3. Historical return headline defaults to simple sum unless explicitly labeled compounded.
4. Compounded metrics are secondary derived views only.
5. Every historical surface must identify its source contract clearly:
   - canonical performance read model
   - canonical pair-period returns
   - live market snapshot
   - signal snapshot metadata

## Navigation / IA To Lock

This refactor is not just a data-source cleanup.
It also changes the product shell and section boundaries.

Target top-level navigation:

- `Data`
- `Performance`
- `Automation`
- `Accounts`
- `Matrix`
- `News`

Target section-level navigation:

- `Data`
  - `Antikythera`
  - `Bias`
  - `Sentiment`

- `Performance`
  - `Summary`
  - `Simulation`
  - `Basket`
  - `Research`
  - `Notes`

- `Automation`
  - `Bots`
  - `Research`

- `Accounts`
  - `All Accounts`
  - account detail:
    - `Overview`
    - `Trades`
    - `Analytics`

- `Matrix`
  - left-nav items:
    - `Matrix`
    - `Swing`
    - `Intraday`
  - internal `Matrix` switcher:
    - `CFD`
    - `Crypto`

- `News`
  - `News`
  - `Status`

Implication:
- `src/components/DashboardLayout.tsx` will need a coordinated navigation cleanup
- nav changes should ship with the page/data migrations, not as an afterthought

## Route And Backward-Compatibility Policy

Refactor goal:
- clean destination routes
- minimal user confusion
- temporary compatibility for old internal links where useful

Policy:

1. Keep stable primary routes when they still make sense:
   - `/performance`
   - `/accounts`
   - `/news`

2. Allow section role changes behind stable routes:
   - `/automation/bots` can become the bot-library landing page
   - `/automation/research` can become the simplified research hub

3. Consolidate or redirect routes whose product meaning changes:
   - `/flagship` -> broad `Matrix`
   - `/flagship/crypto` -> internal `Matrix` crypto mode or redirect-compatible wrapper
   - `/flagship/weekly-hold` -> `Swing`
   - `/flagship/intraday` -> `Intraday`
   - `/status` -> News section Status view

4. During migration, temporary wrappers/redirects are acceptable if needed for:
   - bookmarks
   - internal links
   - incomplete page rewires

5. Final state should prefer one canonical route per product surface.

Important note:
- the doc locks product meaning first
- exact redirect implementation can be finalized during execution once routing impact is audited

## Current State

### Data section surfaces

| Surface | Current source | Problem | Target |
|--------|--------|--------|--------|
| `/antikythera` | COT snapshots + sentiment aggregates + `performance_snapshots.pair_details.percent` + 52-week selector | Historical pair move display still comes from snapshot-embedded returns; surfaced week range exceeds canonical sentiment window | Keep UI behavior, cap to 9 canonical weeks, rewire historical pair moves to canonical `pair_period_returns` |
| `/dashboard` (Bias) | COT snapshots + `pricePerformance.ts` + long COT history | Historical pair move display uses legacy price-performance path; surfaced report history exceeds canonical cross-dataset window | Keep UI behavior, cap surfaced history to 9 canonical weeks, use canonical returns for historical pair moves, preserve live/current-week semantics explicitly |
| `/sentiment` | sentiment aggregates + `performance_snapshots.pair_details.percent` + 52-week selector | Historical pair move display still uses snapshot-embedded returns; surfaced week range exceeds actual sentiment coverage goal | Keep UI behavior, cap to 9 canonical weeks, rewire historical pair moves to canonical `pair_period_returns` |

### Historical performance surfaces

| Surface | Current source | Problem | Target |
|--------|--------|--------|--------|
| `/performance` | `reports/performance-accuracy-audit.json` + DB weekly rows | Built around old audit view, not the new canonical reconstruction | New canonical performance API backed by `comprehensive-reconstruction.json` |
| `/api/performance/comparison` | mixed: `performance_snapshots`, DB backtests, tiered derivation, gate overlay JSON, `pricePerformance.ts`, Katarakti snapshot files | Centralized legacy debt, mixed methodologies, compounded-first | Replace for flagship/performance use; keep only if needed for legacy clients during migration |
| `/automation/research/universal` | `buildUniversalBasketSummary()` + audit report | Research surface uses stale audited summary for comparison block | Rewire comparison block to canonical weekly report data |
| `/flagship/weekly-hold` | `flagshipReport.ts` -> audit report | Placeholder page still anchored to stale audit winner metadata | Rewire to canonical flagship metadata source |
| `/flagship/intraday` | `flagshipReport.ts` -> audit report | Same issue | Rewire to canonical flagship metadata source |

### Live/current-week surfaces

| Surface | Current source | Status | Notes |
|--------|--------|--------|--------|
| `/flagship` | live board logic | Keep | Not a historical return surface |
| `/flagship/crypto` | live board logic | Keep | Not a historical return surface |
| `/dashboard` | COT snapshots + `pricePerformance.ts` | Keep for now | Live bias view; should later use shared live symbol normalization only |
| `/api/performance/gated-setups` | live/dynamic gated board logic | Keep | Research/live gating board, not canonical historical performance |

### Infrastructure and helper surfaces

| Surface | Current source | Status | Notes |
|--------|--------|--------|--------|
| `src/lib/performance/flagshipReport.ts` | reads `reports/performance-accuracy-audit.json` | Replace | Demote audit report to validation-only artifact |
| `src/lib/pricePerformance.ts` | fetch/cache layer for weekly windows | Keep with tighter scope | Live and operational pricing only, not historical backtest truth |
| `/api/performance/snapshot` | refreshes `performance_snapshots` | Keep | Signal snapshot ingestion, not page truth |
| `/api/cron/performance-refresh` | refreshes `performance_snapshots` | Keep | Same |

## What Is Already Canonical

The repo already has the correct historical substrate:

- `src/lib/canonicalInstruments.ts`
- `src/lib/canonicalPriceBars.ts`
- `src/lib/canonicalPriceWindows.ts`
- `src/lib/pairReturns.ts`
- `src/lib/performance/gateEvaluation.ts`
- `reports/comprehensive-reconstruction.json`
- `reports/weekly-reconstruction-audit.json`
- `reports/pair-universe-audit.json`

The next step is not more historical math.
The next step is making the app consume this layer consistently.

## Target Read Model

Build a small canonical performance read layer for app consumption.

Recommended modules:

- `src/lib/performance/canonicalPerformanceReport.ts`
  - Reads and types `reports/comprehensive-reconstruction.json`
  - Exposes selectors for:
    - composite systems
    - composite gated systems
    - standalone models
    - standalone gated models
    - component breakdowns
    - summary rows

- `src/lib/performance/canonicalFlagships.ts`
  - Resolves the current weekly flagship and current intraday flagship
  - Weekly can be chosen from canonical composite/gated results
  - Intraday can remain provisional until that workstream is ready

- `src/app/api/performance/report/route.ts`
  - Serves canonical performance payloads to the UI
  - Makes `/performance` independent from the legacy comparison API

This layer should become the only historical performance contract used by public pages.

Implementation rule for Phase 1:

- `canonicalPerformanceReport.ts` should load and parse the canonical report once, then serve cached typed selectors
- do not perform file read + `JSON.parse` on every API request
- if the canonical report is refreshed, explicitly invalidate the cached payload

## Operational Refresh Model

The site should stop depending on ad hoc historical backfills as a normal operating pattern.

Target behavior:

1. Canonical price ingestion extends forward on schedule
   - new bars
   - new derived period returns

2. Weekly reconstruction refreshes from canonical inputs after the relevant week closes

3. App read models update from canonical outputs
   - canonical performance report
   - canonical flagship metadata
   - any derived UI summaries

4. Pages read those stable outputs
   - pages should not become their own rebuild pipeline

Implication:
- future "updates" should be refresh/ingest jobs, not one-off backfill projects
- if a page needs data that is not produced by the canonical pipeline, that gap should be fixed in the pipeline, not papered over in the page

Near-term implementation rule:
- app-facing canonical report readers should use cached in-process typed payloads
- avoid repeated file reads / repeated `JSON.parse` work per request

Longer-term direction:
- summary/headline canonical system results can later move into a lightweight DB read model if the file-based report becomes too heavy for app use

Status page should eventually expose freshness for this chain:

- canonical price bars
- pair-period returns
- weekly reconstruction report
- account reporting ingestion
- live matrix / forward-test feeds

## Page-By-Page Refactor Map

### Data section: Minimal logic refactor

This section is intentionally light-touch.
The current look and interaction model are acceptable.
The goal is consistency, not redesign.

#### Scope

Pages:
- `/antikythera`
- `/dashboard` (Bias)
- `/sentiment`

#### What stays

- current layout
- current controls
- current page roles:
  - Antikythera = aligned signal snapshot view
  - Bias = COT bias snapshot view
  - Sentiment = crowding snapshot view

#### What changes

1. Surface the rolling canonical week window in the UI
   - this is not a hardcoded `9`
   - it should track the currently available canonical weeks
   - older data remains in storage
   - the surfaced week list should extend forward automatically as the canonical pipeline grows

2. Use one shared week-anchor contract across all three pages
   - no page-specific week drift
   - no mixed report-date vs week-open interpretation at the page boundary

3. Historical pair-move/performance values must come from canonical `pair_period_returns`
   - not from `performance_snapshots.pair_details.percent`
   - not from `pricePerformance.ts`

4. If a page needs current-week/live movement, it may keep a live path
   - but that state must be treated as live/current, not historical truth

#### Recommended implementation

Build a small shared helper for the Data section, for example:

- `src/lib/dataSectionWeeks.ts`
  - returns the currently available canonical weeks to surface in the UI
  - defaults the UI to the most recent rolling window
  - provides a single week mapping contract for Antikythera, Bias, and Sentiment
  - should derive from canonical week truth, not invent a new one

Recommended source of week truth:
- reuse `canonicalPriceWindows.ts` where possible
- or query available weekly periods from `pair_period_returns`
- do not create a third independent week-definition source

Then rewire:

- `/antikythera`
  - replace `listPerformanceWeeks(52)` with shared 9-week helper
  - replace `readPerformanceSnapshotsByWeek(...).pair_details.percent` as the displayed pair-move source
  - use canonical weekly pair returns instead

- `/sentiment`
  - replace `listPerformanceWeeks(52)` with shared 9-week helper
  - replace `readPerformanceSnapshotsByWeek(...).pair_details.percent` as the displayed pair-move source
  - use canonical weekly pair returns instead

- `/dashboard`
  - cap surfaced report history to the same 9-week canonical window used by the other data pages
  - use canonical weekly pair returns for historical move display
  - if current-week pricing remains live, label it as live/current-week behavior

#### Additional note

The hidden bug in this section is week interpretation inconsistency:

- Antikythera currently maps COT report dates into a selected week
- Bias currently works directly from snapshot report dates
- Sentiment currently works from `week_open_utc`

Those should all resolve through one shared weekly anchor contract.

### Tier 1: Rewire now

These should move first because they are user-facing historical performance surfaces.

#### `/performance`

Action:
- Replace audit-report-first loading with canonical performance report loading
- Use simple return as headline metric
- Include compounded only when explicitly labeled
- Default the page to the weekly flagship universe
- Use the promoted flagship variant as the default state
- If the promoted flagship is gated, gated is the default and baseline is comparison-only
- Keep legacy systems available behind a switcher or expandable section
- Surface:
  - flagship summary cards
  - simulation
  - basket breakdown
  - research
  - notes
  - legacy/comparison section

Locked behavior:
- Summary cards can remain structurally similar to the current page
- Simulation should reuse `src/components/research/EquityCurveChart.tsx`
- Simulation should support multi-line comparison for the selected system context, including:
  - flagship baseline vs gated where relevant
  - component model lines inside Universal/Tiered systems
- Basket section can remain, but must read canonical reconstructed data
- Research section can remain, but must read canonical reconstructed data
- Notes can remain for now
- Katarakti should not be surfaced as a primary flagship block until intraday is relocked
- If intraday is still provisional, show explicit research/provisional status rather than promoting a stale winner

Do not:
- recompute metrics in the page
- depend on `performance-accuracy-audit.json`
- depend on legacy gate overlay payloads

#### `/flagship/weekly-hold`

Action:
- Replace `flagshipReport.ts` audit winner lookup with canonical flagship metadata
- Pull weekly winner from the new canonical performance read layer
- Keep placeholder behavior until forward-test feed is wired

Do not:
- infer winner from stale audit files

#### `/flagship/intraday`

Action:
- Same migration pattern as weekly-hold
- Until intraday flagship is relocked, allow explicit provisional state in the canonical flagship resolver

#### `/api/performance/comparison`

Action:
- Remove it from all flagship/performance page dependencies
- Either:
  - deprecate it fully, or
  - narrow it to legacy/internal consumers only

Recommendation:
- build a new canonical `/api/performance/report`
- do not keep layering fixes onto `comparison/route.ts`

Reason:
- it mixes incompatible data contracts and methodologies
- it is the main source of future drift

Recommended page structure:

- Primary flagship area
  - weekly flagship first
  - intraday secondary or provisional if not yet locked
- Summary cards
  - simple return
  - simple drawdown
  - win rate
  - trades
  - weeks
- Simulation
  - reusable equity curve component
  - multi-series comparisons
- Basket
  - pair-level and component breakdown
- Research
  - diagnostics and supporting context
- Notes
  - observations / interpretation
- Legacy / comparison drawer
  - standard vs gated comparison
  - standalone models
  - non-promoted systems

### Tier 2: Partial rewire next

These are not the main public performance surface, but they already leak stale or mixed methodology.

#### `/automation/research/universal`

Action:
- Keep the research-specific basket summary
- Replace the audit-based comparison block with canonical weekly performance data
- Make the page explicit about what is:
  - research simulation output
  - canonical system summary

Do not:
- present audit-report numbers as if they are current performance truth

#### `src/lib/performance/flagshipReport.ts`

Action:
- Replace with a canonical report helper
- Keep audit-report reading only if needed for offline validation tooling

Recommendation:
- rename legacy helper to make its role obvious if it remains

### Tier 3: Keep, but constrain

These do not need immediate return-methodology migration, but their boundary should be documented now.

#### `/flagship`
#### `/flagship/crypto`
#### `/api/performance/gated-setups`
#### `/dashboard`

Action:
- keep them live
- document that they are live/current-state surfaces, not historical performance sources

Later improvement:
- route their pair normalization and symbol mapping through the canonical instrument registry where possible

### Tier 4: Research and script cleanup later

The repo still contains many scripts and libraries using `pricePerformance.ts` for historical studies.

Examples:
- `scripts/backfill-performance.ts`
- `scripts/backfill-performance-from-reports.ts`
- `scripts/backfill-v3-performance.ts`
- multiple research and comparison scripts under `scripts/`
- `src/lib/research/bankComparison.ts`
- `src/lib/performanceLab.ts`
- `src/lib/performanceRefresh.ts`

These should be audited after the public surfaces are stable.

Target rule:
- if a script is doing historical return analysis, migrate it to canonical pair returns
- if it is doing live operational pricing, it can keep using `pricePerformance.ts`

## Automation Section

### Current state

The Automation area is split between:

- `/automation/bots`
- `/automation/bots/bitget`
- `/automation/bots/bitget-lite`
- `/automation/bots/mt5-forex`
- `/automation/bots/mt5-forex-lite`
- `/automation/solana-meme-bot`
- `/automation/research/lab`
- `/automation/research/universal`
- `/automation/research/baskets`
- `/automation/research/strategies`
- `/automation/research/symbols`
- `/automation/research/bank`

This is too fragmented.

The Bots area is behaving like a live Katarakti status board.
The Research area is behaving like several unrelated mini-products.

### Locked direction for Bots

Refactor `/automation/bots` away from a live status dashboard and into a bot library / whitepaper section.

Purpose:
- document what exists
- document what is planned
- document what is paused
- document what is archived

The landing page should answer:
- what bots exist
- what each bot is for
- what is live
- what is paused
- what is production-ready
- where the relevant notes/specs/live pages are

Recommended structure:

- Bot library landing page
  - card/list per bot
  - each item behaves like a GitHub README / whitepaper index

- Each bot entry should show:
  - name
  - venue / broker
  - market
  - status:
    - live
    - paper
    - research
    - paused
    - archived
  - short thesis
  - current implementation state
  - links:
    - design doc
    - backtest/research doc
    - forward-test page if it exists
    - code module if useful

Important change:
- Katarakti should not dominate this section by default
- if Bitget Katarakti is paused, show it as paused/archived documentation, not as an active flagship automation surface

Operational note:
- if Katarakti on Bitget is wasting Render resources and is not an active priority, remove or pause the worker rather than continuing to carry it as a pseudo-live system
- the site should reflect that state honestly

### Locked direction for Research

Refactor Automation Research into one simplified research hub.

Purpose:
- compare systems
- compare configurations
- inspect equity curves
- inspect pair-level behavior

The landing page should center on one reusable equity-curve comparison surface.

Recommended structure:

- Research landing page
  - main equity-curve comparison
  - system/configuration selector
  - compare mode
  - alternate pair-level view

- Main default view:
  - equity curve explorer
  - compare different systems and configurations cleanly
  - reuse `src/components/research/EquityCurveChart.tsx`

- Secondary view:
  - pair-level explorer
  - bubble map candidate can live here once ready

What to simplify:

- `research/lab` is too configuration-heavy for the main landing page
- `research/universal`, `research/baskets`, `research/strategies`, and other sub-pages are too fragmented as the primary experience
- `research/strategies` currently depends on the legacy `/api/performance/comparison` route, which should not remain a core dependency

Recommended product stance:

- keep advanced research tools available, but demote them behind the simplified landing page
- do not make the landing experience a raw parameter console
- do not make it a collection of unrelated sub-pages

### Automation refactor principles

1. Bots section = documentation / readiness / status of real automations
2. Research section = comparative analysis workspace
3. If a bot is paused, the UI should say paused
4. If a bot is not production-ready, do not present it like a live production system
5. Use canonical historical data for research comparisons
6. Keep live operational dashboards separate from documentation surfaces

### Proposed execution order for Automation

#### Phase A: Bots simplification

- replace `/automation/bots` with bot-library framing
- decide which bot detail pages remain public
- pause/archive Katarakti surfaces that are no longer operational priorities

#### Phase B: Research simplification

- make one research landing page centered on equity-curve comparison
- demote advanced pages behind secondary navigation
- remove legacy comparison API dependency from research summaries

#### Phase C: Pair-level exploration

- add bubble-map or equivalent pair-level analysis view once the design is ready

### Review notes from audit

- `/automation/bots` is currently a live-monitoring page dominated by Katarakti variants
- `/automation/research/lab` is heavy enough that browser inspection already showed it as an overloaded surface
- `/automation/research/universal` still leaks old audit-based performance summary logic
- `/automation/research/strategies` still relies on `/api/performance/comparison?week=all`

## Accounts Section

### Current state

The Accounts area currently behaves like an account reporting surface mixed with a bot-planning and sizing surface.

Browser/code audit confirms that:

- `/accounts` is framed around "live baskets, exposure, and automation bot"
- MT5 account detail pages still foreground:
  - planned trades
  - planned vs filled
  - mappings
  - planning diagnostics
  - automation-oriented week flow
- even manual-traded accounts inherit `AUTO` / planned basket framing if the account metadata and old planning flows remain attached

This is why the section feels confusing when the same account is no longer being bot-traded.

### Locked direction

Refactor Accounts into an account reporting section first.

Primary purpose:
- account list
- balances / equity
- realized and unrealized PnL
- trade history
- weekly/monthly reporting
- status and metadata

Not primary purpose:
- bot sizing surface
- strategy planning surface
- planned-vs-filled reconciliation as the default user story

### Recommended product framing

Accounts should answer:

- what accounts exist
- what type of account each one is
- whether it is demo or funded
- whether it is prop or personal
- what happened in the account
- what the account is currently holding
- what the recent performance history looks like

The section should not assume the account is currently attached to a live automation workflow.

### Locked UI/behavior direction

#### `/accounts`

Turn the landing page into an account directory with cleaner segmentation:

- Prop accounts
- Personal funded accounts
- optional later:
  - archived/inactive accounts

For prop accounts, show explicit phase/state:
- demo
- challenge
- verification
- funded

Do not rely on broker/server naming conventions to imply this.

#### Account detail pages

Default to reporting-first tabs/sections:

- Overview
  - equity / balance
  - recent PnL
  - drawdown
  - current open positions
  - equity curve

- Trades
  - open positions
  - closed trades
  - weekly / historical trade history

- Analytics
  - optional deeper stats

Demote or remove as default:

- planned trades
- planned vs filled
- mappings
- raw planning diagnostics
- bot-specific sizing explanation

Those can survive behind an advanced/debug/ops layer if still useful, but they should not define the main account UX.

### Data-model implication

The current account metadata is not sufficient to cleanly represent the new scope.

Current fields already present and useful:
- broker
- server
- status
- trade_mode
- risk_mode

But these are not enough for clean reporting segmentation.

Add explicit account metadata for:

- account category
  - `prop`
  - `personal`

- account stage
  - `demo`
  - `challenge`
  - `verification`
  - `funded`
  - `live`
  - `archived`

- optional account grouping label
  - example: firm/program/bucket

This should be explicit metadata, not inferred from account labels or broker strings.

### Weekly data refresh requirement

A lightweight MT5 push path is needed so this section stays current.

Locked direction:

- build a simple EA/script that can be run weekly on MT5 accounts
- its job is to push:
  - account equity/balance snapshot
  - open positions
  - closed trade history
  - enough weekly context to keep reporting current

This should be treated as reporting ingestion, not as strategy planning infrastructure.

### Additional note

The current account implementation is tied too tightly to the old Universal V1 / basket-planning assumptions.
That should be broken apart.

Rule:
- account reporting should survive even if the strategy layer changes entirely
- bot-specific planning should be optional metadata, not the core account model

### Recommended execution order for Accounts

#### Phase A: Reframe

- change copy and structure from automation-first to reporting-first
- segment account directory into prop vs personal
- add explicit phase/status display for prop accounts

#### Phase B: Simplify detail pages

- promote overview / trades / reporting
- demote planning/sizing/reconciliation to advanced mode or remove from default flow

#### Phase C: Ingestion refresh

- build simple MT5 weekly push script/EA
- connect additional accounts through the cleaner metadata model

### Review notes from audit

- `/accounts` currently says "Monitor live baskets, exposure, and performance across every linked account and automation bot"
- MT5 detail page currently foregrounds `AUTO`, `planned trades`, `planned vs filled`, and planning diagnostics
- manual trading on previously automated accounts becomes confusing under the current model
- current schema does not yet cleanly model prop-vs-personal and phase/funded status as first-class fields

## Matrix / Forward Testing Section

### Current state

The current left-nav and route split is:

- `/flagship` = CFD matrix
- `/flagship/crypto` = crypto matrix
- `/flagship/weekly-hold` = weekly forward-test placeholder
- `/flagship/intraday` = intraday forward-test placeholder

This currently behaves like four sibling destinations under one Matrix area.

### Locked direction

Refactor this into three left-hand navigation items:

- `Matrix`
- `Swing`
- `Intraday`

### Product distinction

#### `Matrix`

Purpose:
- broad market board
- full universe scan
- diagnostic/manual trading board

Behavior:
- shows all tracked pairs/contracts
- does not filter down only to flagship-qualified trades

Internal page switcher:
- `CFD`
- `Crypto`

So:
- left nav has a single `Matrix`
- inside the page, top-level switcher/tabs choose `CFD` vs `Crypto`

#### `Swing`

Purpose:
- weekly hold flagship forward-test board

Behavior:
- shows only trades that qualify for the selected weekly flagship logic
- not the whole market universe
- execution/monitoring surface, not a broad scanner

This replaces the current conceptual role of `/flagship/weekly-hold`, but as a first-class nav item.

#### `Intraday`

Purpose:
- intraday flagship forward-test board

Behavior:
- shows only trades/signals relevant to the selected intraday flagship logic
- more interactive than Swing because entry qualification and state changes matter
- should support live transition states such as:
  - watching
  - armed
  - qualified
  - entered
  - active
  - closed

This replaces the current conceptual role of `/flagship/intraday`, but as a first-class nav item.

### Locked separation rule

- `Matrix` = all tracked pairs/contracts
- `Swing` = only weekly flagship-qualified trades
- `Intraday` = only intraday flagship-qualified signals/trades

Do not mix those scopes.

### Price/source-of-truth rule

The same consistency rule applies here as everywhere else:

- live matrix/forward-test state can use live data paths
- but symbol normalization and shared market definitions should come from the same canonical instrument/source rules
- any historical or archived performance shown inside these surfaces must use canonical historical sources

So:
- live state = live source, canonical symbol language
- historical state = canonical price/performance source

### UI direction

#### Matrix

Keep the matrix visual language for the broad board, but make it one product:

- `Matrix`
  - `CFD`
  - `Crypto`

#### Swing / Intraday

Use the same matrix-style visual grammar, but simplify the columns around forward testing.

These boards should focus on:
- symbol
- direction
- entry/qualification state
- current P&L / WTD P&L / session P&L as appropriate
- notes / status

They should not inherit every bias/context/trigger/sizing field unless that field is truly useful for the flagship workflow.

### Scope note on intraday

Intraday remains partially undefined because the exact flagship logic is not locked yet.

So the spec should allow:
- interactive stateful rows
- entry qualification tracking
- later refinement once the intraday flagship scope is finalized

### Recommended execution order for Matrix / Forward Testing

#### Phase A: Navigation cleanup

- move from:
  - CFD Matrix
  - Crypto Matrix
  - Weekly Hold
  - Intraday

- to:
  - Matrix
  - Swing
  - Intraday

#### Phase B: Matrix unification

- make Matrix the single broad-universe board
- add CFD/Crypto switcher inside the page

#### Phase C: Forward-test boards

- convert weekly-hold placeholder into Swing board
- convert intraday placeholder into Intraday board
- keep them filtered to flagship-qualified rows only

### Review notes from audit

- current `/flagship` page is a CFD broad-universe board
- current `/flagship/crypto` page is a separate crypto broad-universe board
- current `/flagship/weekly-hold` and `/flagship/intraday` are placeholders
- the broad-universe matrix and the filtered flagship forward-test boards should not be treated as the same product

## News / Status Section

### Current state

The News area currently behaves as:

- `/news?view=calendar`
- `/news?view=announcements`
- `/news?view=impact`
- `/status`

And the News left-subnav currently exposes:
- Calendar
- Announcements
- Impact
- Status

### Browser audit findings

1. Day ordering is wrong for the main calendar experience
   - current day / most recent trading day is not surfaced first
   - the current implementation sorts grouped days oldest-to-newest and opens the last group
   - this makes the page feel backwards when scanning the current week

2. The three-view split is too fragmented
   - Calendar
   - Announcements
   - Impact

These views are related enough that the section can be consolidated into a cleaner single experience.

3. The current Status page is an old diagnostics page
   - it still contains useful raw checks
   - but it is not aligned to the current build priorities
   - it should be rebuilt around current APIs, canonical data freshness, and active system health

### Locked direction for News

Refactor News into one cleaner primary page.

Purpose:
- weekly macro context
- current-week event visibility
- high-signal announcements and impacts

Recommended direction:

- one consolidated News page
- current day / current trading day surfaced at the top
- the rest of the week follows below in clear order

Instead of three separate content modes, consolidate into one experience that includes:
- daily grouped calendar
- impact tags
- announcement relevance/highlights

This can still support filtering, but it should not feel like three separate products.

### Locked behavior for News page

1. Current day first
   - today / most relevant current day should be expanded at the top
   - older/future days should follow in a logical sequence

2. Consolidated event view
   - one event surface with impact and announcement context merged where useful

3. Week selector can remain
   - but the internal presentation should be clearer and more current-oriented

4. Keep historical weekly snapshots
   - but the page should emphasize the active/current week first

### Locked direction for Status

Status should remain a separate tab under the News section, but it needs to be rebuilt.

Purpose:
- operational health for the current Limni build

It should focus on:
- key APIs
- canonical data freshness
- ingestion/refresh health
- active automation/forward-test health where relevant
- connectivity and sync health

It should not primarily be an old debug dump page.

### Recommended Status scope

Prioritize:
- canonical price layer freshness
- pair-period return freshness
- weekly reconstruction / canonical report freshness
- COT snapshot freshness
- sentiment freshness
- news refresh freshness
- account sync freshness
- live matrix / forward-test API health
- active worker/process status that still matters

De-emphasize or move behind debug mode:
- oversized raw provider dumps
- legacy diagnostics that no longer support current workflows

### Navigation direction

Keep News and Status as separate sub-tabs inside the News section.

Recommended subnav:
- News
- Status

Do not keep:
- Calendar
- Announcements
- Impact

as separate left-nav tabs if the page is consolidated successfully.

### Review notes from audit

- `/news` currently uses separate `calendar`, `announcements`, and `impact` modes
- the grouped day list is ordered oldest-to-newest, which makes the current day appear too low
- `/status` is currently a broad legacy diagnostics page including old provider debug output
- the new build needs a more focused operational status page tied to current canonical and API workflows

## Proposed Execution Order

### Phase 1: Canonical performance read layer

Build:
- `src/lib/performance/canonicalPerformanceReport.ts`
- `src/lib/performance/canonicalFlagships.ts`
- `src/app/api/performance/report/route.ts`

Outcome:
- One clean contract for historical performance pages

### Phase 2: Public performance surfaces

Migrate:
- `/performance`
- `/flagship/weekly-hold`
- `/flagship/intraday`

Outcome:
- all user-facing flagship/performance pages read the same canonical source

### Phase 3: Legacy comparison API isolation

Action:
- remove `/performance` dependency on `/api/performance/comparison`
- mark old comparison route as legacy/internal
- stop using it for flagship decisions

Outcome:
- historical performance UI no longer depends on mixed legacy math

### Phase 4: Research surface cleanup

Migrate:
- `/automation/research/universal`
- any research summaries currently using audit-report values

Outcome:
- research pages stop leaking stale performance summaries

### Phase 5: Live surface normalization

Action:
- review `/dashboard`, `/flagship`, `/flagship/crypto`, and live pricing helpers
- standardize symbol normalization against canonical instrument registry
- keep live data separate from historical truth

Outcome:
- one symbol language across live and historical systems

## Proposed App Contracts

### Historical performance contract

Every historical performance payload should expose:

- `returnMethodology`
- `simpleReturnPct`
- `compoundedReturnPct`
- `maxDrawdownSimplePct`
- `maxDrawdownPct`
- `weeks`
- `tradeCount`
- `winRatePct`
- `weeklyReturns`
- `gateMode`
- `isGated`
- `componentBreakdown` when applicable

### Historical pair-performance contract

Every historical pair query should come from:

- `pair_period_returns`

Not from:

- `performance_snapshots.pair_details.percent`
- `market_snapshots`
- direct provider fetches

### Live/current-state contract

Every live surface should state that it is:

- current week
- current snapshot
- live gating board
- live signal board

It must not present itself as the historical flagship record.

## Validation Plan

### For each migrated page/API

1. Confirm source contract in code
2. Confirm no historical return math is recomputed in the page layer
3. Confirm simple return is the default headline
4. Confirm compounded is labeled secondary
5. Confirm winner metadata comes from canonical performance read model
6. Confirm no dependency on `performance-accuracy-audit.json` remains unless explicitly marked validation-only

### Regression checks

- `npx tsc --noEmit --pretty false -p tsconfig.json`
- `npm run build`
- browser checks on:
  - `/performance`
  - `/flagship/weekly-hold`
  - `/flagship/intraday`
  - `/automation/research/universal`

## Locked Product Decisions

These decisions are now locked for execution unless changed explicitly later.

1. Gated variants should be public on `/performance`
   - show baseline and gated side-by-side
   - do not hide the strongest canonical results behind admin-only views

2. Standalone models should appear behind an expandable `Component Models` section
   - visible
   - not competing with the composite system headline area

3. Initial weekly flagship recommendation:
   - promote `Tiered V3 Gated` first
   - label the sample-size caveat clearly (`9-week sample`)

4. Intraday representation until relocked:
   - show `Coming Soon` / `Research`
   - do not promote stale Katarakti numbers as the intraday flagship

## Recommendation

Do not patch the existing performance page or the existing comparison API further.

Build a clean canonical performance read layer, move the historical pages onto it, and quarantine the audit and legacy comparison paths.

That gives the site one historical truth, one live truth, and a clean line between them.
