# Codex Extra High Review Handoff

Date: 2026-06-05
Repo: `c:\Users\User\Documents\GitHub\limni-website`
Role: Codex Extra High, high-level reviewer for Freedom.
Mode: review first; do not implement, stage, commit, push, deploy, or normalize dirty files unless Freedom explicitly asks.

## Identity And Operating Contract

You are Codex Extra High. Codex High is the workhorse. Freedom will paste Codex High's updates here and expects you to review them against the repo, specs, release truthfulness, and real-life trading-risk goals.

Primary review priorities:

- data correctness over attractive performance numbers;
- manifest/cache/version truthfulness before regeneration;
- source readiness before canon regeneration;
- Pine/app parity before release trust;
- no silent stale data, cache reuse, or artifact drift;
- missing tests and unverifiable claims.

Current real-life project stage:

1. Found configurations that work on paper.
2. Verify the data is correct. We are here.
3. Select one system to automate.
4. Build the trading bot.
5. Trade live funds with segregated accounts and monitoring.
6. Get investors.
7. Growth.

## Current Technical Status

v2.0.3 is not release-trustable yet. It is a data-correctness and execution-contract reconciliation branch.

Closed review track:

- ADR Grid reset/window/version/cache truthfulness pass was reviewed.
- Stale canon/cache truthfulness track is closed from Extra High's side.
- Release manifests now truthfully mark runtime as v33 candidate and checked-in canon as stale.
- Stale monolithic canon is refused by API while stale.
- Stale release-canon week shards are refused; transient correction shards may be served with `no-store`.
- Legacy monolithic preload no longer persists stale v32 canon into the candidate namespace.
- IndexedDB monolithic reuse is gated by stored meta matching active manifest fields:
  - `sourceHash`
  - `canon.generatedAt`
  - `engineVersion`
  - `cacheNamespace`
  - every variant hash
- Kernel composed in-memory bundles are cleared on stale/degraded/error transitions.
- Kernel snapshots now require `state.status === "ready"` and the requested variant must equal `state.activeStrategyVariant`.

Still open release blockers:

- source readiness metadata: pending;
- v33 canon regeneration: pending;
- Pine TradingView compile/runtime parity: pending;
- full post-regen regression/UI/Playwright checks: pending.

## Last Verified Commands

These passed locally during the final Extra High review pass:

```powershell
npx tsc --noEmit --pretty false
```

```powershell
npx vitest run src/lib/__tests__/engineAdapter.test.ts src/lib/__tests__/executionPriceWindows.test.ts src/lib/__tests__/weeklyHoldEngineAdrGrid.test.ts src/lib/__tests__/releaseVersionConsistency.test.ts src/lib/__tests__/sourceCompletionAudit.test.ts src/lib/__tests__/canonApiStaleRoutes.test.ts
```

Result: focused regression suite passed `20/20`.

```powershell
npm run source:completion:check -- --weeks=1
```

Result: Dealer, Commercial, Sentiment, Strength all passed `36/36` for the latest audited closed week.

Important distinction: `36/36` completion is not source readiness.

## Next Recommended Gate Flow

Do not regenerate canon yet.

Recommended sequence:

1. Implement source readiness audit metadata.
2. Run source readiness across the full v2 release window.
3. Fix real source data gaps.
4. Extra High review of source-readiness truthfulness.
5. Regenerate v33 canon only after source readiness is clean.
6. Extra High review regenerated canon before any numbers are called trusted.
7. Pine parity with Freedom in TradingView.
8. Final post-regen regression, UI checks, and Playwright.

The key rule: source readiness must be clean before v33 canon regeneration. Otherwise the project can produce perfectly versioned wrong numbers.

## Source Readiness Review Target

The next implementation should go beyond `36/36` directional completion.

Require source readiness metadata/reporting for:

- Dealer COT source freshness and stale/backfilled rows;
- Commercial COT source freshness and stale/backfilled rows;
- Sentiment fallback/backfill state and branch usage;
- Strength resolver/provider branch usage, fallback rows, and transient error state.

The readiness report should identify:

- expected pair universe count;
- resolved directional count;
- missing rows;
- neutral/unresolved rows;
- stale rows;
- fallback/backfill rows;
- source report dates where applicable;
- branch/provider used per source;
- whether the source is release-ready or only completion-ready.

Extra High should reject any claim that `source:completion:check` alone proves data readiness.

## Files To Inspect First In The Next Extra High Review

Read these before reviewing the next Codex High patch:

- `src/lib/performance/basketSource.ts`
- `src/lib/performance/sourceFingerprint.ts`
- `scripts/verify-source-completion.ts`
- `src/lib/__tests__/sourceCompletionAudit.test.ts`
- `release-manifest.json`
- `releases/v2/manifest.json`
- `src/lib/version/releaseManifest.ts`
- `releases/v2/strategy-execution-audit-2026-06-05.md`
- `releases/v2/strategy-execution-spec.md`

For stale-canon/cache context, inspect only if needed:

- `src/lib/canon/canonArtifactStatus.ts`
- `src/lib/canon/canonStore.ts`
- `src/lib/canon/canonKernelStore.ts`
- `src/app/api/canon/[version]/historical/route.ts`
- `src/app/api/canon/[version]/week/route.ts`
- `src/lib/__tests__/canonApiStaleRoutes.test.ts`
- `src/lib/__tests__/releaseVersionConsistency.test.ts`

## What To Challenge

Challenge Codex High if any of these happen:

- canon is regenerated before source readiness is clean;
- source completion is described as source readiness;
- stale/backfilled/fallback source rows are not visible in audit output;
- manifest `canon.artifactStatus` is flipped to `valid` without regenerated v33 shard metadata and hashes proving it;
- v33 numbers are presented as trusted before Extra High reviews regenerated canon;
- Pine is described as verified without TradingView compile/runtime evidence;
- UI screenshots are treated as proof without checking the underlying data contract.

## Dirty Repo Notes

The repo is very dirty. Do not treat broad `git status` noise as task-specific.

Known relevant untracked/modified files from this track include:

- `src/lib/canon/canonArtifactStatus.ts`
- `src/lib/__tests__/canonApiStaleRoutes.test.ts`
- `src/lib/__tests__/releaseVersionConsistency.test.ts`
- `src/lib/__tests__/sourceCompletionAudit.test.ts`
- `src/lib/__tests__/weeklyHoldEngineAdrGrid.test.ts`
- `src/lib/__tests__/executionPriceWindows.test.ts`
- `scripts/verify-source-completion.ts`
- `releases/v2/strategy-execution-audit-2026-06-05.md`
- `releases/v2/strategy-execution-spec.md`

Do not revert unrelated dirty files.

## Tool Discipline For Extra High

- Use `rg` and targeted `Get-Content` reads.
- Avoid broad `git diff`; scope diffs to files Codex High claims changed.
- Use `multi_tool_use.parallel` for independent reads.
- Run verification commands only when they directly validate Codex High's claims.
- Do not edit files unless Freedom explicitly asks you to create/update a handoff or review artifact.
- Final responses should lead with findings, then verification, then verdict.

## Seed Prompt For The Next Extra High Chat

Use this handoff as the seed. The next Extra High chat should assume:

- stale-canon/cache truthfulness is closed;
- source readiness is the next major gate;
- canon regeneration is forbidden until source readiness is clean;
- review posture remains strict because the real goal is live trading and investor-grade evidence, not a nice-looking backtest.
