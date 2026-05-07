# Performance Artifact Loading Conventions

The Performance and Matrix pages should behave like a loaded map: the first load after a relevant engine change can build artifacts, but repeated interactions should reuse cached payloads.

## Loading UI

Use `LimniLoading` for route-level loading. The loading text must cycle through a single status line, not a list of boxes or an in-page banner. If an artifact/update check is running, the sequence is:

- Loading updates...
- Checking artifact cache...
- Comparing source fingerprints...
- Loading the target page or view

The phases must name the actual work being done, for example:

- Checking artifact cache
- Comparing source fingerprints
- Warming current-week cache
- Preparing matrix signals

If no artifact or update phases are needed, do not pass phases; the loader should only show the final page label such as `Loading Performance Page`.

Strategy selector changes should not show an in-page loading banner. The visible strategy universe should be preloaded during the Performance page load, then switched locally from client cache.

## Cache Invalidation

Strategy artifacts use dependency-scoped versions in `src/lib/performance/strategyArtifactVersions.ts`.

When changing strategy logic, bump the smallest relevant version:

- Weekly hold math: `weekly_hold`
- ADR pullback math: `adr`
- ADR grid math: `adr_grid`
- Exposure Cap behavior: `exposure_cap`
- Path/simulation presentation math: `PATH_SIMULATION_VERSION`
- Source watermark/fingerprint logic: `SOURCE_FINGERPRINT_VERSION`

Do not bump the global schema version unless the persisted artifact shape itself changes for every strategy.
