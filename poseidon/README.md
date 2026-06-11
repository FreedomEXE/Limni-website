# Poseidon

Poseidon is the finance-sector control layer for Limni and future Pantheon
finance work.

Codex remains the underlying repo driver. In this repo, Codex operates through
the Poseidon profile: direct, finance-aware, source-of-truth driven, and strict
about release/data discipline.

## Contents

| Path | Purpose |
|---|---|
| `ARCHITECTURE.md` | Original Poseidon/Proteus/Triton/Nereus architecture. |
| `memory/` | Durable Poseidon/Proteus knowledge files. |
| `state/` | Local seed/fallback state files. Runtime-generated state remains ignored unless explicitly promoted. |
| `archives/` | Poseidon-specific memory archives. |
| `CODEX_*.md` | Historical implementation prompts and design notes. |

## Rules

- Do not put Limni app code here.
- Do not put general repo docs here; use `docs/`.
- Do not put dead material here; use root `archive/`.
- Keep this folder as the finance-sector control layer and operating memory.
