# Backtest And Testing Structure Inventory

Date: 2026-06-10

Status: cleanup inventory, not app verification.

## Purpose

This note records the current testing and backtest structure before more strategy
research. It does not certify old test results or old research outputs.

Future backtests should not be trusted until the harness first proves parity
against the app engine and the approved closed-week window.

## Current Test Entry Points

- `npm test` runs Vitest through `vitest.config.ts`.
- `vitest.config.ts` includes only `src/lib/__tests__/**/*.test.ts`.
- Current included unit test files: `71`.
- Playwright E2E tests live under `tests/e2e`; current files: `3`.
- Playwright uses `AUDIT_BASE_URL` or `http://localhost:3000`.

Important implication: tests outside `src/lib/__tests__` are not automatically
part of `npm test` unless the config changes.

## Current Backtest Surfaces

- `docs/BACKTEST_CANONICAL_PROTOCOL.md` is the active rule for strategy
  research.
- `docs/testing/APP_PARITY_TESTING.md` is the active rule for app-parity
  verification.
- `scripts/verification/` now holds app/indicator verification exporters and
  inspectors.
- `scripts/research/` now holds a small set of archived or durable research
  scripts.
- The root `scripts/` folder still contains `275` flat script files.
- Of those, `165` match research/backtest/verify/audit/compare/parity naming.

The root script layer is therefore still noisy and should not be treated as a
clean backtest framework.

## Existing Research Engine Caveat

`src/lib/research/backtestEngine.ts` is deterministic mock data. Its tests prove
contract shape and determinism for the research/lab surface, not real trading
truth.

Do not use that module as the basis for production strategy claims, investor
numbers, or app Performance parity.

## Trusted App Engine Path

Real strategy parity must start from the app engine path:

- `src/lib/performance/basketSource.ts`
- `src/lib/performance/weeklyHoldEngine.ts`
- `src/lib/performance/strategyConfig.ts`
- `src/lib/performance/strategyPageData.ts`

Current trusted verification tooling should prefer:

- `npm run verification:visible-engine-stats`
- `npm run verification:export-runtime-app`
- `npm run verification:export-app`
- `npm run verification:diff`
- `npm run verification:compare-grid-reset-filter`

## Future Backtest Gate Recommendation

Use a separate named gate before trusting any new backtest:

1. Define one canonical backtest harness entry point.
2. Make the harness reproduce app baselines first using the app engine path.
3. Record the exact week window, strategy, entry style, risk overlay, source
   snapshot, command, and output path.
4. Only after parity passes, run a new experimental variant.
5. Archive or quarantine legacy flat scripts that cannot identify their source
   of truth.

Recommended direction: repurpose the existing unit tests for app-engine contract
coverage, but build a clean real backtest harness around the production app
engine instead of extending the mock `src/lib/research/backtestEngine.ts`.

## Current Boundary

This inventory does not change app behavior, test configuration, release canon,
or baseline data. It exists to prevent future backtest work from inheriting
ambiguous old research outputs.
