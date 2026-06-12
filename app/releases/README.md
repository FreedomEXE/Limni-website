# Releases

Official release history and evidence.

## Contents

| Path | Purpose |
|---|---|
| `v1/` | v1 release notes and evidence. |
| `v2/` | v2 release notes, screenshots, evidence, and canon. |
| `SCREENSHOT_CONVENTION.md` | Screenshot naming and evidence convention. |
| `VERSIONING_DISCIPLINE.md` | Runtime live/dev versioning contract. |

## Rules

- Release evidence stays at root-level `releases/`.
- `releases/v2/canon/*.json` is frozen unless Freedom approves an explicit
  canon regeneration or restore gate.
- Runtime version truth uses only `liveVersion` and `devVersion`.
- Do not use release-branded datasets as runtime UI truth unless the active app
  truth docs say so.
