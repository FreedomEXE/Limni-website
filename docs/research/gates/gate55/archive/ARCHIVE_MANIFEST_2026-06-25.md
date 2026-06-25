# Gate 55H Archive Manifest

Date: 2026-06-25

Commit at time of manifest creation: recorded by Git when this cleanup is
committed.

## Moves

No files were archived in Gate 55H.

| Old path | New archive path | File hash | Reason archived | Replacement path | Historical evidence or dead code |
|---|---|---|---|---|---|
| - | - | - | No safe archive candidate identified after reference inventory. | `app/scripts/verification/evaluate-research-decision-manifest.ts` for new research scoring. | - |

## Reason

Gate 55H found `156` tracked legacy strategy/tester-style scripts by broad
pattern. Some are directly referenced by `package.json`; many others are linked
from docs, receipts, or handoffs. The hard rule for this gate was no silent
moves of referenced files, so the safe action is zero archive moves.

Future archive work should be a separate gate that updates package commands,
docs links, and receipt references before any `git mv`.
