# Systemic Preload Fix Audit

Date: 2026-05-18

## Findings

- `DashboardLayout` was the global preload owner and hardcoded the fallback strategy selection.
- `useStrategySession` also triggered global preload, creating two owners for one preload state.
- Strategy data is shared by Performance and Matrix, so the preload unit should be the strategy data domain rather than either page.
- The existing client/server strategy cache, artifact status endpoint, current-week fetch path, and shard repair path are already the right primitives for Phase 1.
- Redirect-only legacy routes do not need `force-dynamic`; their redirect behavior can stay intact without it.

## Phase 1 Scope

- Implemented only real strategy-domain preload work.
- Left market intelligence, news, and accounts out of the phase labels until their real runners exist.
- Kept API routes, cron, `strategyPageData.ts`, and `StrategyArtifactLoadingGate.tsx` unchanged.
