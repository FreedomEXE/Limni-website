# Codex High Handoff - Source Readiness And v2.0.3 Trust Gate

Date: 2026-06-05

## Purpose

This is the implementation handoff for the next Codex High chat.

The stale-canon/cache truthfulness track is closed. Source readiness metadata
and audit output are now implemented, but the full active 19-week v2.0.3
baseline is still blocked. Do not regenerate v33 canon until source readiness is
clean and reviewed.

2026-06-05 update:

- `npm run source:completion:release` now audits the active 19-week app/reporting baseline (`2026-01-19` through `2026-05-24`) and fails strict mode with 4 untrusted source rows.
- The remaining failures are Jan/Feb Sentiment late/backfilled rows only: `2026-01-19`, `2026-01-26`, `2026-02-02`, and `2026-02-16`.
- Strength was repaired on 2026-06-05 by backfilling canonical warmup bars, rebuilding v3 weekly returns, and relocking Jan 19 index Strength. The serial release gate now reports Strength trusted for all 19 weeks.
- `npm run source:completion:trusted12` passes the clean March-through-May subset (`48/48` rows), but this is not the active 19-week baseline.
- Bare `npm run source:completion:check` is a latest-12 closed-week probe only. Do not cite it as release approval.
- Empty date windows now fail instead of passing with `Rows: 0`.
- Run source-readiness gates serially; parallel DB-heavy audits can produce false Strength failures.
- Read `releases/v2/source-readiness-gap-investigation-2026-06-05.md` before attempting source repair. It records the DB probe showing current DB state lacks raw Jan/Feb sentiment source rows and records the completed Strength repair.
- Read `releases/v2/source-data-inventory-2026-06-05.md` before attempting source repair. It records all audited live DB stores, local salvage files, the historical 24-hour raw sentiment retention root cause, the 2026-06-05 raw retention mitigation, completed Strength repair, crypto/external data stores, and 64-instrument expansion requirements.
- Next gate: repair Jan/Feb Sentiment rows, then rerun `npm run source:completion:release` serially until all 76 rows are trusted. Do not regenerate canon before that.
- Changing to a shorter release/UI baseline is not allowed unless Freedom explicitly reverses the 19-week decision.

## Current Release Goal

Restore v2.0.3 to a trusted baseline:

1. strategy definitions are frozen and documented,
2. source inputs are provably ready,
3. v33 canon is regenerated only from trusted source data,
4. Pine TradingView verifier matches the app,
5. post-regen tests and UI checks pass.

## Closed Track: Stale Canon / Cache Truthfulness

Closed by current Codex High pass:

- Release manifests truthfully mark current checked-in canon as `stale_pending_regeneration`.
- Runtime code and manifest execution derivation align on `v5_execution_ny_crypto_sun20`.
- Canon schema includes:
  - `artifactStatus`,
  - `validForEngineVersion`,
  - `requiresEngineVersion`.
- Stale monolithic historical canon API returns `409` and `Cache-Control: no-store`.
- Stale baseline release-canon week shards return `409` and `Cache-Control: no-store`.
- Transient strategy-artifact correction shards may be served during stale mode, but also with `no-store`.
- Legacy monolithic IndexedDB reuse requires stored meta to match:
  - release line,
  - app version,
  - semantic version,
  - canon version,
  - cache namespace,
  - canon generated time,
  - source ledger row count,
  - source hash,
  - engine version,
  - every manifest variant hash.
- Stale mode does not write the candidate cache namespace.
- Kernel in-memory composed history:
  - clears all composed bundles on stale/degraded/error,
  - only serves when `state.status === "ready"`,
  - only serves the active strategy variant.

Primary touched files:

- `release-manifest.json`
- `releases/v2/manifest.json`
- `src/lib/version/releaseManifest.ts`
- `src/lib/executionWeeklyReturns.ts`
- `src/lib/canon/canonArtifactStatus.ts`
- `src/lib/canon/canonStore.ts`
- `src/lib/canon/canonKernelStore.ts`
- `src/app/api/canon/[version]/historical/route.ts`
- `src/app/api/canon/[version]/week/route.ts`
- `src/app/api/canon/[version]/inventory/route.ts`
- `src/lib/__tests__/releaseVersionConsistency.test.ts`
- `src/lib/__tests__/canonApiStaleRoutes.test.ts`
- `releases/v2/strategy-execution-audit-2026-06-05.md`

## Verified Commands

These passed after the stale-canon/cache hardening:

```bash
npx tsc --noEmit --pretty false
```

```bash
npx vitest run src/lib/__tests__/canonApiStaleRoutes.test.ts src/lib/__tests__/releaseVersionConsistency.test.ts src/lib/__tests__/weeklyHoldEngineAdrGrid.test.ts src/lib/__tests__/executionPriceWindows.test.ts src/lib/__tests__/engineAdapter.test.ts src/lib/__tests__/sourceCompletionAudit.test.ts
```

Result: focused regression suite passed `20/20`.

```bash
npm run source:completion:check -- --weeks=1
```

Result for `2026-05-24`: Dealer, Commercial, Sentiment, Strength all passed `36/36` directional.

Updated status: `source:completion:check` now proves both directional completion
and source readiness. The latest single-week result is clean, but the full
19-week v2.0.3 baseline is not clean because Jan/Feb Sentiment is still
untrusted.

## Remaining Blockers

Do not call performance numbers trusted until all of these are closed:

1. Jan/Feb Sentiment source-readiness gaps repaired and the serial `npm run source:completion:release` gate reports all 76 rows trusted.
2. v33 canon regeneration.
3. Pine TradingView compile/runtime parity.
4. Full post-regen regression, UI, and Playwright checks.

## Next Task: Source Readiness Gap Closure

Use the implemented readiness audit to close the remaining Jan/Feb Sentiment
gaps. The next pass should not regenerate canon; it should either repair raw
Sentiment source rows from backups or make a deliberate source-policy decision.

For each week and source, report whether the source is trusted or untrusted and why.

### Dealer / Commercial COT Readiness

For each week:

- expected CFTC report date,
- actual snapshot/report date used,
- whether snapshot exists,
- whether snapshot is stale/late/missing,
- whether any pair was forced from valid neutral logic,
- whether any pair was neutral due to missing/error data,
- source rows resolved count,
- trusted boolean.

Missing COT data is an operational/data-readiness issue, not a normal strategy fallback.

### Sentiment Readiness

For each week:

- whether proper week-start aggregates exist,
- whether latest/backfilled aggregates were used,
- fallback tier/branch used per pair,
- stale/backfill count,
- source rows resolved count,
- trusted boolean.

The documented sentiment hardcoded fallback is a strategy-source completion rule only after valid sentiment data exists. It is not permission to silently use stale/backfilled source data for trusted stats.

### Strength Readiness

For each week:

- whether locked weekly strength snapshots exist,
- latest strength snapshot UTC,
- available strength windows,
- whether exact stored prior weekly/monthly returns exist,
- whether provider fallback was used,
- pair-level fallback/branch metadata,
- source rows resolved count,
- trusted boolean.

Strength is internal/algo based, but missing locks or provider fallback still need explicit readiness metadata.

## Suggested Output Contract

Add or extend an audit command, likely evolving `scripts/verify-source-completion.ts`, to output both completion and readiness:

```text
week | source | completion | readiness | trusted | incidents
2026-05-24 | dealer | 36/36 | ready | true | 0
2026-05-24 | strength | 36/36 | fallback_used | false | 4
```

It should be machine-readable enough for tests and human-readable enough for release review.

Recommended JSON structure:

```ts
type SourceReadinessAuditRow = {
  weekOpenUtc: string;
  source: "dealer" | "commercial" | "sentiment" | "strength";
  resolvedDirectional: number;
  expectedPairs: number;
  trusted: boolean;
  incidents: Array<{
    pair?: string;
    severity: "info" | "warning" | "error";
    code: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
};
```

## Review Gates

Use Codex Extra High as reviewer at two points:

1. After source readiness metadata/audit is implemented and run across the release window.
2. After v33 canon regeneration and manifest/hash/cache updates.

## Do Not Do Yet

- Do not regenerate v33 canon before source readiness is clean.
- Do not flip `canon.artifactStatus` to `valid` before regen metadata and hashes prove the v33 contract.
- Do not call Pine parity complete without TradingView compile/runtime validation.
- Do not trust old v2.0.2/v32 canon numbers for v2.0.3.

## Useful Docs

- `releases/v2/strategy-execution-spec.md`
- `releases/v2/strategy-execution-audit-2026-06-05.md`
- `scripts/verify-source-completion.ts`
- `src/lib/performance/basketSource.ts`
- `src/lib/performance/snapshotProvenance.ts`
- `src/lib/sentiment/resolver.ts`
- `src/lib/strength/canonicalDirection.ts`
- `src/lib/strength/weeklyStrength.ts`
