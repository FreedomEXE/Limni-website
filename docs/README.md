# Docs

Active durable project documentation.

Keep this folder active and scannable. Historical notes, stale prompts, stale
handoffs, and old planning material belong in the root archive under mirrored
paths such as `archive/docs/...`.

## Key Folders

| Path | Purpose |
|---|---|
| `process/` | Operating rules, project profile, cleanup ledger, and release template. |
| `architecture/` | App-truth and architecture specs. |
| `testing/` | Testing and app-parity protocols. |
| `research/` | Decision-grade research memos. |
| `backlog/` | Backlog inventory requiring repo/session verification before use. |

## Root Files

Only durable anchors should stay loose in `docs/`:

- `README.md`
- `REPO_STRUCTURE.md`
- `BACKTEST_CANONICAL_PROTOCOL.md`

## Rules

- Active truth belongs here.
- Stale handoffs, legacy notes, old planning material, and retired assets belong
  under `archive/docs/`.
- Repo evidence and source code override docs when they conflict.
- Running work belongs in `docs/backlog/CURRENT_WORK.md` unless a gate needs one
  focused durable doc.
