# Limni Agent Notes

## Required Read Before Strategy Research

Before running any backtest, reconstruction, or strategy comparison in this repo, read:

- [docs/BACKTEST_CANONICAL_PROTOCOL.md](C:/Users/User/Documents/GitHub/limni-website/docs/BACKTEST_CANONICAL_PROTOCOL.md)

## Non-Negotiable Rule

Weekly dealer, commercial, and sentiment research must reconcile to the app's canonical source of truth before any new result is trusted.

If a new script cannot reproduce the canonical app baselines documented in the protocol, stop research and fix parity first.

## Canonical Source

Use:

- [src/lib/performance/basketSource.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/basketSource.ts)

Do not rebuild base-model weekly directions independently from raw data if the canonical basket source already defines them.

## Hand-off Line

Use this line in future sessions or handoffs:

`Before any new backtest, verify parity against canonical app baselines using basketSource.ts and the approved closed-week window. If parity fails, stop research and fix parity first.`

## Audit Discipline

When classifying a UI surface as inactive, verify both sides before making the claim:

- Source references: search for active imports/usages, not just file existence.
- Runtime reachability: use Playwright to exercise the normal route/tabs/modes and probe for component-specific test IDs or visible copy.

If only the audited paths are clean, say "not found in audited paths." Say "inactive in current source/UI" only when source references are absent outside docs and Playwright also finds no DOM evidence in the relevant flows.

When a migrated surface has both a new shared control and an older local control for the same concept, treat that as an audit finding even if the numbers are correct. Identify which control owns state, document the duplicate path, and clean up the older control before building new hierarchy or drilldown features on top of it.

## Architecture Fit Check

Before implementing or accepting Nyx/UI prompts, compare the requested data flow against [docs/FUTURE_UPGRADES.md](C:/Users/User/Documents/GitHub/limni-website/docs/FUTURE_UPGRADES.md), especially the app-versioned immutable historical canon model.

Closed historical weeks should be treated as immutable under an app/engine version. New all-time historical UI should consume a versioned local/bundled canon shape, or a temporary whole-bundle endpoint with the same shape. Do not introduce paginated/lazy historical fetching for closed-week canon unless the user explicitly approves it as temporary debt.

If a recommendation optimizes for incremental fetching of historical canon, pause and flag the architecture conflict before implementation. Prefer "version first" or "single bundle now, swap source later" over building a UI around pagination that will be removed by v2.0.0 versioning.
