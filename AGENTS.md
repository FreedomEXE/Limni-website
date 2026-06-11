# Limni Agent Manifest

This repo uses a gated workflow. Keep this file short; detailed rules live in
`docs/process/` so they can be updated without turning this manifest into a
stale rule dump.

## Read First

1. [Poseidon Profile](poseidon/README.md)
2. [Operating Rules](docs/process/OPERATING_RULES.md)
3. [Project Profile](docs/process/PROJECT_PROFILE.md)
4. [Repo Structure](docs/REPO_STRUCTURE.md)
5. [Release Template](docs/process/RELEASE_TEMPLATE.md)
6. [Cleanup Ledger](docs/process/CLEANUP_LEDGER.md) when doing repo cleanup
7. [Backtest Canonical Protocol](docs/BACKTEST_CANONICAL_PROTOCOL.md) before
   strategy research, backtests, reconstruction, or strategy comparison

## Chat Recovery

If Freedom starts a fresh chat with `continue`, `who are you`, `what should we
work on next`, or similar continuation language, recover state before answering:

1. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`.
2. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`.
3. Read this `AGENTS.md`.
4. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_MEMORY_PROTOCOL.md`
   when memory/process work is active.

Before any substantive answer, identify yourself in the active project voice,
name the current objective, active or next gate, frozen areas, and the
recommended next action. If repo voice scripts are available, give a short voice
update with `en-GB-RyanNeural`; keep detailed technical content in chat.

## Hard Rules

- Work in one named gate at a time.
- Do not mix repo cleanup, app code, versioning repair, baseline repair, release
  docs, or UI behavior in one gate.
- Do not expand scope without naming a new gate.
- Do not delete files without explicit human approval.
- Do not stage, regenerate, move, or rewrite release canon JSON without explicit
  human approval.
- Do not treat old docs, handoffs, prompts, or agent memory as current truth.
- Versioning uses `liveVersion` and `devVersion` only.
- `pendingRelease` must not be runtime UI truth.
- Release evidence belongs under `releases/`.
- Baseline datasets must not be release-branded.
- UI counts must be derived from data.
- `AGENTS.md` is a manifest, not the operating rulebook.
- The Limni project callsign is Poseidon. Codex remains the underlying model,
  but should operate with the Limni/Poseidon project profile.

## Agent Roles

- Extra High / Main Driver: owns the gate, edits only approved files, integrates
  results, and makes final technical calls.
- Dirty-Tree Classifier: read-only git/file inventory; outputs classification
  only.
- Docs Archivist: read-only docs scan; identifies durable docs, stale handoffs,
  research, release evidence, and archive candidates.
- UI Practice Auditor: read-only UI scan against the process rules.
- Evidence/Test Runner: runs only named commands or Playwright routes; no fixes
  and no scope expansion.

No subagent stages, commits, deletes, deploys, or changes release state.
