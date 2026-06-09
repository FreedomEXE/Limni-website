# v2 API Surface

Documented: 2026-06-03

This file records the high-signal v2 API routes involved in the v2.0.2 kernel and v2.0.3 verification candidate.

## Release And Version

- `/api/version/current`: runtime release manifest and pending release metadata.
- `/api/release-assets/[...path]`: serves release screenshot assets to the Documents page.

## Canon Kernel

- `/api/canon/[version]/inventory`: active release inventory, baseline weeks, closed-week deltas, aggregate slot metadata.
- `/api/canon/[version]/week`: single week shard fetch for a strategy variant/week.
- `/api/performance/strategy-kernel-payload`: active Performance payload from kernel-composed history plus live week.

v2.0.3 hardening is in the server helpers used by those routes:

- [`src/lib/canon/canonWeekShard.server.ts`](../../src/lib/canon/canonWeekShard.server.ts)

## Performance And Strategy Artifacts

- `/api/performance/strategy-current-week`: live/open week current data.
- `/api/performance/strategy-page-data`: legacy/page data path.
- `/api/performance/strategy-artifacts/status`: artifact readiness.
- `/api/performance/strategy-artifacts/warm`: artifact warm endpoint.
- `/api/performance/strategy-artifacts/request-warm`: warm request endpoint.
- `/api/performance/strategy-artifacts/request-bulk-warm`: bulk warm request endpoint.

v2.0.3 expectation: strategy switches may call strategy endpoints, but must not rerun the global release preloader after app gate release.

## Data Section

- `/api/dashboard/payload`: Data page payload.
- `/api/basket/closed-history`: closed-history rows.
- `/api/basket/week-pairs`: pair-level weekly rows.
- `/api/basket/weeks`: available week list.

Observed during Playwright: Data can be the slow first-touched page because it has its own server payload, but after the global gate releases it should not show the global preloader again.

## Status

- `/api/health`: basic health.
- `/status`: app-visible kernel diagnostics page, route is bypassed from the global gate.

## Cron And Warm Jobs

Production warmup remains handled by cron/background endpoints. The preloader should not rebuild all weeks after a UI-only change unless the release/cache namespace or missing closed-week inventory requires it.
