# v2 UI Surfaces

Documented: 2026-06-03

This file records the v2 active UI surfaces and the v2.0.3 candidate verification state.

## Performance

Primary strategy analysis surface.

Key components:

- [`src/app/performance/page.tsx`](../../src/app/performance/page.tsx)
- [`src/components/performance/PerformanceStrategyViewSection.tsx`](../../src/components/performance/PerformanceStrategyViewSection.tsx)
- [`src/components/performance/PerformanceViewSection.tsx`](../../src/components/performance/PerformanceViewSection.tsx)
- [`src/components/shared/StrategySidebar.tsx`](../../src/components/shared/StrategySidebar.tsx)
- [`src/components/shared/StrategySelector.tsx`](../../src/components/shared/StrategySelector.tsx)

v2.0.3 candidate verified:

- Performance loads after active kernel gate release.
- Strategy selector can switch from Tandem Pair Fill Cap to Tiered no-cap and back.
- Strategy switches do not show the global preloader after the app has released.

## Data

Pair-level source verification surface.

Key components:

- [`src/app/dashboard/page.tsx`](../../src/app/dashboard/page.tsx)
- [`src/components/dashboard/DashboardViewSection.tsx`](../../src/components/dashboard/DashboardViewSection.tsx)

v2.0.3 candidate verified:

- SPA navigation from Performance to Data works after app gate release.
- No global preloader appears during that route change.
- First Data visit can be slower because `/api/dashboard/payload` is its own server-side data path.

## Accounts

Account monitoring and execution-readiness surface.

Key components:

- [`src/app/accounts/page.tsx`](../../src/app/accounts/page.tsx)
- [`src/components/accounts/AccountsPageClient.tsx`](../../src/components/accounts/AccountsPageClient.tsx)

v2.0.3 candidate verified:

- SPA navigation Data to Accounts is fast after app gate release.
- No global preloader appears during that route change.

## Status

Kernel and release diagnostics surface.

Key page:

- [`src/app/status/page.tsx`](../../src/app/status/page.tsx)

Status route bypasses the global preload gate.

## Documents

Release and institutional documentation surface.

Key page:

- [`src/app/documents/page.tsx`](../../src/app/documents/page.tsx)

v2.0.3 candidate update:

- Documents now allows `handoff.md` in release docs.
- v2 release folder now has architecture, active systems, contracts, API surface, UI surfaces, verification, and handoff docs.
- App-visible screenshots are registered in `releases/v2/manifest.json`.

## Matrix

Matrix remains provisional/degraded outside the v2.0.2/v2.0.3 Performance kernel readiness gate. Do not use Matrix readiness as a release blocker for this verification pass unless Freedom explicitly changes scope.
