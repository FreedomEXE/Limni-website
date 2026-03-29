/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Session Bootstrap Loader Spec
/*-----------------------------------------------
  Manifested by Codex
-----------------------------------------------*/

Date: 2026-03-28
Status: FUTURE SPEC
Owner: Codex + Freedom

## Purpose

Define the future loading model for Limni so the app feels like a professional platform instead of a collection of pages that each recompute on demand.

The target feel is:

- user logs in
- app shows a purposeful loading/build sequence
- canonical historical state is loaded once
- app becomes fast and stable for the rest of the session
- only live data continues to refresh incrementally

Freedom described the desired feel correctly:

- similar to a video game loading into a map
- one strong initial build phase
- then blazing-fast navigation inside the app

## Core Product Goal

Do the heavy historical work once.
Do the light live work continuously.

That means Limni should stop behaving like each route is its own mini data build.

Instead, it should behave like:

1. bootstrap the world
2. enter the world
3. stream live state on top

## Target Mental Model

### Layer 1: Canonical world state

This is the heavy data that should feel prebuilt or session-built once:

- canonical week list
- canonical basket history
- strategy outputs
- per-week Matrix data
- Performance summaries
- simulations
- sidebar stats
- research read models

This state is mostly historical and should not be rebuilt on every route change.

### Layer 2: Session bootstrap payload

This is the app-ready payload loaded when the user enters the platform:

- the currently needed historical read models
- precomputed week maps
- default strategy selection data
- section summaries
- caches needed for instant switching

This is what gives the app the feeling of having "loaded the world."

### Layer 3: Live overlays

This is the lightweight data that should remain dynamic:

- current prices
- live trigger states
- active current-week trade state
- account status
- automation status
- news freshness
- system health

This layer updates during the session without rebuilding historical truth.

## Locked Architecture Principle

Historical canonical state and live state must be separate loading concerns.

Historical state should be loaded once per session or prebuilt ahead of time.
Live state should be hydrated and refreshed independently.

If live fetching is allowed to recreate historical state, the app will stay slow and drift-prone.

## Desired UX

### Login / App Entry

After login, Limni should enter a dedicated bootstrap phase instead of immediately rendering a partially loaded dashboard.

The screen should feel intentional and high-trust.

Recommended behavior:

- full-screen loader or shell loader
- progress text with real system stages
- stable visual identity
- no rapid flashing between incomplete pages

Example loading messages:

- `Building historical snapshots...`
- `Loading canonical basket history...`
- `Loading canonical price bars...`
- `Computing strategy maps...`
- `Preparing Performance and Matrix views...`
- `Hydrating live market data...`
- `Entering workspace...`

These messages should map to real system stages where possible, not fake animation text.

## Target Loading Modes

### Mode A: Scheduled prebuild

Best long-term mode.

The server precomputes and caches canonical read models on a schedule:

- after weekly data refresh
- after sentiment refresh
- after canonical basket interpretation changes
- after performance/strategy rebuilds

Then user login mostly pulls an already-built bootstrap payload.

This gives the best speed and the best stability.

### Mode B: Session bootstrap

Fallback or secondary mode.

At login, the server assembles the session payload if it is not already warm.

This may take longer, but it still happens once instead of repeatedly on every page.

### Mode C: Incremental live hydration

After canonical bootstrap is complete, live overlays begin:

- current prices
- live triggers
- account state
- health checks

This should never block entry into the app once the historical session payload is ready.

## Recommended Build Pipeline

### Phase 1: Canonical artifacts

Build or fetch:

- canonical week options
- canonical basket source outputs
- strategy engine outputs
- precomputed week maps for Matrix and Performance
- sidebar stats
- simulation data
- section-level summaries

This data should be server-owned.

### Phase 2: Session payload

Package the currently needed artifacts into one bootstrap response.

Recommended examples:

- default strategy selection
- default week data
- precomputed `weekMap`
- precomputed `simMap`
- sidebar stats
- Data section summaries
- Matrix section defaults
- Performance section defaults

### Phase 3: Client activation

The client receives the bootstrap payload and mounts the workspace with near-zero additional historical fetching.

Page switches should mostly become state selection, not new heavy data work.

### Phase 4: Live subscriptions / polling

Once the workspace is active, live overlays start updating in the background.

## What Should Be Instant After Bootstrap

After the loader completes, these should feel instant or near-instant:

- switching weeks in Matrix
- switching weeks in Performance
- switching sections
- opening basket details
- opening research views backed by canonical data
- changing among already-bootstrapped strategy/filter selections
- re-opening a strategy/filter/week combination that was already computed earlier in the same session
- re-opening a strategy/filter/week combination that already has a valid cached canonical artifact from a prior session

If one of these actions still triggers a full historical recompute, the bootstrap model is incomplete.

## Reuse Before Recompute

This rule needs to be explicit:

- first check whether the requested canonical result already exists
- then check whether any source data changed since that result was built
- only rebuild if the source inputs are newer than the cached artifact

Limni should stop treating "user asked for the same strategy again" as a reason to rerun the strategy.

The correct behavior is:

1. user selects strategy/filter/week
2. app checks cache/artifact metadata
3. if inputs are unchanged, return the existing result immediately
4. if inputs changed, invalidate and rebuild once

This should apply app-wide, not just to one page.

## Invalidation Model

Canonical historical artifacts should be invalidated by source changes, not by navigation.

Examples of valid invalidation triggers:

- a new COT snapshot arrives
- new sentiment data arrives
- a new historical week is added
- canonical interpretation logic changes
- engine execution logic changes
- risk-profile / strategy-definition logic changes

Examples of invalidation triggers that are NOT valid:

- user switches weeks
- user revisits Performance
- user revisits Matrix
- user reruns a strategy with the same inputs and no new data
- user changes tabs inside an already-bootstrapped workspace

## Artifact Metadata Requirement

Every canonical artifact should carry enough metadata to support reuse safely.

Recommended metadata:

- artifact key
- strategy id
- filter ids
- risk profile id when introduced
- covered week range
- source data versions / timestamps
- engine version
- built at timestamp
- invalidation reason when rebuilt

Without this metadata, the app cannot answer the key performance question:

`Can I reuse this, or do I actually need to rebuild it?`

## Section-Specific Performance Expectations

### Matrix

Matrix is currently the most urgent speed problem.

The target behavior for Matrix is:

- week switching should feel immediate because historical rows and stats are already in `weekMap`
- changing among already-built strategy/filter selections should reuse canonical payloads instead of recomputing
- only live overlays should refresh after the historical board is already present
- the board should never block on historical recomputation just because the user changed weeks

If Matrix still feels like it is rebuilding the page on every week change, the bootstrap/cache model is not done.

### Performance

Performance already demonstrates the correct week-switch feel better than Matrix, but it still wastes work when the same strategy is rerun repeatedly.

The target behavior for Performance is:

- week switching remains fast
- rerunning an unchanged strategy should hit cache, not recompute
- only changed inputs should cause a rebuild

### App-Wide Rule

The same reuse/invalidation contract should apply to:

- Matrix
- Performance
- Data
- Research / Lab
- Automation views backed by canonical historical state

## What Can Still Load After Entry

These are acceptable to refresh after the workspace opens:

- current prices
- current week trigger states
- live open trade state
- news updates
- account status changes
- automation/worker health

These should appear as lightweight overlays, not page-blocking rebuilds.

## Cache Model

The bootstrap architecture should support multiple cache levels.

### Cache level 1: persistent canonical artifacts

Examples:

- basket history
- canonical strategy outputs
- week maps
- simulations

These should be rebuilt when source data changes, not when a user clicks around.

### Cache level 2: runtime server cache

Examples:

- already-parsed read models
- hot strategy payloads
- section bootstrap bundles

This improves speed for active sessions.

### Cache level 3: session/client state

Examples:

- selected strategy
- selected week
- already-loaded section payloads
- current view mode

This removes unnecessary route-level loading churn.

## Professional Loading Principles

### Principle 1: No fragmented route loading

The app should not feel like every route has to rediscover the world independently.

### Principle 2: No fake completeness

Do not show the app as "ready" while the heavy canonical state is still being built invisibly.

### Principle 3: Live data is not historical data

Live hydration should never redefine historical views.

### Principle 4: Real stages beat generic spinners

`Loading...` is weak.
Named system stages feel more deliberate and trustworthy.

### Principle 5: Fast once inside

The initial load can be heavier if the experience after entry is excellent.

That tradeoff is often correct for a professional intelligence platform.

## Suggested Loader Copy Style

Tone should feel technical and premium, not playful.

Good examples:

- `Syncing canonical market state`
- `Building historical basket snapshots`
- `Computing strategy layers`
- `Hydrating live market overlays`
- `Preparing workspace`

Bad examples:

- vague spinner with no context
- fake percentage with no real stages
- multiple page-level skeletons fighting each other

## Data Ownership Under This Model

### Prebuilt / canonical

- historical baskets
- historical strategy results
- historical stats
- historical research summaries
- historical simulations

### Live

- active price state
- trigger-watch state
- open trade state
- live account/automation status

This is the same separation already required by the anti-drift architecture.

The loader model is a UX layer on top of that architecture.

## Relationship To Current Work

This spec should not be implemented before the source-of-truth chain is corrected.

Required foundation first:

1. canonical basket source below the engine
2. shared engine output consumed by Matrix and Performance
3. no historical recomputation drift across sections

Only then does it make sense to optimize loading around that stable substrate.

## Suggested Future Deliverables

When this work is picked up later, split it into:

1. `Canonical artifact build spec`
   Defines what is precomputed, what metadata it carries, and when it is invalidated.

2. `Session bootstrap API spec`
   Defines the payload returned at login/app entry, including warm cache reuse behavior.

3. `Loader UX spec`
   Defines the actual screen, stage copy, sequencing, and transitions.

4. `Live hydration spec`
   Defines polling/subscriptions, staleness rules, and refresh boundaries.

5. `Canonical cache reuse spec`
   Defines cache keys, source-version checks, invalidation triggers, and reuse rules for repeated strategy requests.

## Acceptance Criteria

This future system passes if:

1. the app performs one obvious initial bootstrap instead of many page-level historical loads
2. historical section switching after entry is fast because data is already loaded
3. live data continues updating without rebuilding canonical history
4. loading stages correspond to real system work
5. Matrix, Performance, Data, and Research all benefit from the same bootstrap model
6. rerunning an unchanged strategy/filter/week selection reuses the prior canonical result instead of recomputing
7. new builds happen only when source data, strategy logic, or engine logic actually changed

## Final Rule

Limni should feel like it loads a coherent trading world once, then lets the user move through it instantly while live state updates around that world.

That is the target experience.
