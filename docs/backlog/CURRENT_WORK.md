# Current Work

Status: active checklist. Keep this short and update it when gates change.

This is the running repo-visible checklist. Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Workflow

- Use at most three active running surfaces:
  - `CODEX_SESSION.md` for hot recovery and frozen areas.
  - `docs/backlog/CURRENT_WORK.md` for the active checklist.
  - One focused gate/release doc only when the active gate needs durable detail.
- Archive completed or stale notes under `archive/` using mirrored repo paths.
- Do not start coding until the active gate is named.
- For broad issue sets, classify first, then patch one gate at a time.

## Active Gate

Gate 27: docs workflow cleanup.

Goal:

- Keep `docs/` active and scannable.
- Move loose historical docs out of active `docs/`.
- Establish one root `archive/` that mirrors repo ownership paths.
- Define a simple forever workflow before app work resumes.

## Next Gates

1. Versioning / Documents / version-popover readiness.
2. Weekly Hold engine verification.
3. ADR Grid data-truth audit.

## Active Context

- Version UI should use `liveVersion` and `devVersion` only.
- `pendingRelease` must not be runtime UI truth.
- Documents/release docs should use one simple structure across versions.
- Data page baseline copy should be derived from data/config, not hardcoded or
  release-branded.
- Weekly Hold manual checks mostly matched the indicator, but the repo still
  needs its own reproducible proof path.
- ADR Grid is the major app-vs-indicator blocker: fills, TP counts, returns,
  drawdowns, basket counts, and recent-vs-stored week behavior need audit.
- Strategy work is three layers: baseline/data direction, ADR Grid execution,
  and risk management.
- Do not optimize trading logic until current numbers are trusted.
