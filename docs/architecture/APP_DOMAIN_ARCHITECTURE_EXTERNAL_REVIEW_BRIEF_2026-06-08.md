# External Review Brief: Limni App Domain Architecture

> Self-contained high-level review brief for an outside reviewer without repo access. Do not assume the reviewer can inspect code.
>
> Historical review package. The post-review implementation authority is `APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md` plus `APP_TRUTH_ARCHITECTURE_INDEX.md`.

Date: 2026-06-08
Status: Historical external architecture review package
Internal source spec: `docs/architecture/APP_DOMAIN_CACHE_ARCHITECTURE_V1_SPEC_2026-06-08.md`

## Review Request

Please review this as a high-level software architecture problem. Do not propose code. The goal is to validate whether the proposed system model is correct before implementation.

Limni is a trading research and automation application. The current project stage is data and app-truth verification before selecting one system to automate. The app has working research concepts, but the current UI/data architecture is fragile and inconsistent.

## Current Stage

Project path:

1. Find configurations that work on paper.
2. Verify the data is correct. Current stage.
3. Select one system to automate.
4. Build a bot to trade that system.
5. Trade live funds with segregated accounts and monitoring.
6. Get investors.
7. Growth.

The app is not ready to move to automation until the data, weekly rollover, and strategy trade views are trustworthy.

## Baseline Context

There are two important version concepts:

- `v2.0.2`: remembered as the usable/fast app-shell baseline, but not a trusted truth baseline.
- `v2.0.3-clean14`: current candidate verification baseline using a 14-week clean source window.

The point is not to preserve old numbers. The old numbers may have been inflated or wrong because execution logic, ADR Grid behavior, trade stop timing, and source snapshot timing changed. The goal is to reach a real baseline, even if numbers are worse.

## Core Architecture Problem

The app currently behaves like pages own data. That is the wrong model.

Correct model:

> Data domains own data. Pages render views/selectors from shared domain stores.

Each domain should separate:

1. Frozen/versioned data
   Historical, closed, or approved data that should persist across navigation and should only change when a data/cache namespace changes.

2. Live mutable overlay
   Current/open-week/provider/account/bot/news/status data that can refresh frequently without invalidating frozen history.

3. Private/session data
   User/account-specific state that may need to clear on logout.

## Desired App Behavior

First load after a new app/data version may take time.

After that:

- Frozen historical data should be cached and reused.
- Route navigation should not trigger full reloads.
- Logout/login should not clear public frozen market/performance data.
- UI-only deploys should not invalidate frozen data.
- Data-contract/source/engine changes should invalidate only affected domains.
- Live/current data should refresh in the background.
- Status should show diagnostics and remain reachable even when app data fails.

## Domains

The app should have shared domain stores for:

- Performance
- Data / Market Intelligence
- Status
- Accounts
- Automation
- Research Lab
- Documents
- Agents
- News

Different data, same lifecycle principle.

## Major Failures Observed

### 1. Data And Performance Do Not Share The Active Baseline

Performance is currently scoped to a 14-week clean candidate baseline.

Data can still expose broader historical weeks going back to December.

This is wrong for the active verification workflow. Older data can exist, but it should be explicit Archive/History mode, not the default active baseline.

Required rule:

> Data and Performance must consume the same active baseline/window manifest.

### 2. Weekly Freeze / Rollover Is Not Centralized

The Data page showed recent weeks with:

`Freeze ledger missing; legacy fallback`

This appeared for both June 1 and June 8 views.

Expected business logic:

- Dealer/Commercial COT data releases Friday 3:30 PM ET and should be saved as soon as it lands from CFTC.
- Sentiment and Strength snapshots should lock near Friday 5:00 PM ET.
- A frozen source ledger should be written for closed weeks.
- Current/open week should be a live overlay.

Observed problem:

- Data knew weeks existed but lacked frozen ledgers.
- Performance only showed up to May 25, missing newer closed/current weeks.

Required rule:

> One weekly rollover/freeze/materialization state machine should own the week lifecycle.

### 3. Performance Basket Is Not Usable For Parity

The Basket tab is needed to inspect grids/trades and verify app parity before automation.

Observed failure:

- Summary/sidebar showed selected-week engine stats and trade count.
- Basket/drilldown showed zero or missing row totals.
- Warning indicated the header was using engine ledger P/L while drilldown rows summed to 0.

Required rule:

> Performance summary, basket, research/drilldown, exports, and parity tests must read the same selected-week execution ledger/trade-row source.

### 4. Performance Selection Switching Creates Split-Brain UI

Switching from ADR Grid / Pair Fill Cap to Weekly Hold showed contradictory state:

- Sidebar showed `14 weeks tracked` and full stats.
- Main panel said clean14 runtime was not ready and had missing weeks.

Required rule:

> Changing signal model, execution, risk overlay, week, or metric must atomically move every Performance surface to the same selected data state.

If the selected runtime is missing, all Performance surfaces should show the same unavailable/degraded state.

### 5. Version Badge / Popover Misrepresents Release Identity

The version popover should not force local development and live production to share the same version identity.

Correct model:

- Live/stable version: approved release currently live.
- Candidate/dev version: local pending build under review.

The popover should explain:

- current live version
- current candidate version
- pending changes
- unresolved gates/blockers
- whether the candidate changes data/cache namespaces or only UI

## Proposed Architecture

Introduce an app-wide domain cache architecture.

High-level shape:

```text
App Kernel
  app version manifest
  domain namespace comparison
  readiness policy
  diagnostics

Domain Stores
  performance
  market-intelligence
  status
  accounts
  automation
  research
  documents
  agents
  news

Pages
  consume selectors
  render states
  do not own duplicate historical fetch/cache logic
```

Each domain should expose:

- manifest
- status
- frozen readiness
- live status
- cache source
- version/fingerprint
- degraded reasons
- error details

Suggested domain statuses:

```text
idle
checking-manifest
hydrating-local
fetching-frozen
ready
refreshing-live
degraded
error
```

## Storage Model

Recommended:

- Memory store for fast current-session access.
- IndexedDB for large frozen historical payloads.
- localStorage for small manifests/cache namespace stamps.
- Server/runtime/CDN cache as an accelerator, not the only cache.

Logout should clear private/session data, not public frozen market/performance caches.

## API Shape

Each major domain should define which data is frozen and which is live.

Potential shape:

```text
GET /api/{domain}/manifest
GET /api/{domain}/frozen-bundle?version=<domainVersion>
GET /api/{domain}/live-overlay
```

Not every domain needs all endpoints, but every domain needs the classification.

## Cron / Rollover Model

Cron should not mean "revalidate every page."

Cron should have separate responsibilities:

- frequent live overlay refresh
- source snapshot collection
- source freeze ledger writing
- closed-week performance materialization
- explicit data-contract invalidation when logic changes

Live refresh failure should not blank frozen historical UI.

## Review Questions

Please answer at a CTO/architecture level:

1. Is the domain-store model the right correction, or is there a simpler architecture that preserves speed and correctness?
2. Is the frozen data plus live overlay split the right abstraction for this app?
3. Should Data and Performance share one active baseline/window manifest?
4. How should weekly rollover be modeled so source freeze, Data, and Performance cannot drift?
5. Is IndexedDB plus manifest metadata a reasonable browser persistence layer for multi-MB frozen payloads?
6. What are the main risks in implementing this incrementally?
7. What should be implemented first: diagnostics, shared baseline manifest, Performance trade-row source, or Data cache?
8. What acceptance tests should block promotion of this candidate version?
9. How should the version badge distinguish live/stable release from local pending candidate?
10. What should be explicitly rejected as overengineering?

## Reviewer Output Requested

Please provide:

- a short verdict
- key architecture risks
- missing concepts or bad assumptions
- recommended implementation order
- non-negotiable acceptance tests
- any simplification opportunities

Do not write implementation code.

## Human Breakdown

What changed: this brief summarizes the architecture crisis for an outside reviewer without repo access.

Why it matters: the reviewer can critique the system model without needing local files.

What passed/failed: current app behavior shows domain/cache/rollover drift across Data and Performance.

Next gate: external review before implementation.
