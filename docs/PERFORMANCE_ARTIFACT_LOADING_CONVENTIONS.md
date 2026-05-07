# Performance Artifact Loading Conventions

The Performance and Matrix pages should behave like a loaded map: the first load after a relevant engine change can build artifacts, but repeated interactions should reuse cached payloads.

## Loading UI

Use `ArtifactLoadingPanel` for strategy or matrix updates. The phases must name the actual work being done, for example:

- Checking artifact cache
- Comparing source fingerprints
- Warming current-week cache
- Preparing matrix signals

Use `LimniLoading` with `phases` for route-level loading screens.

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
