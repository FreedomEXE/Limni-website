# Release Template

Every release should follow one repeatable structure. Do not invent a new
release-doc shape per version.

## Target Folder Shape

```txt
app/releases/
  vX/
    vX.Y.Z/
      README.md
      CHANGELOG.md
      EVIDENCE.md
      screenshots/
        page-or-flow/
          gate-or-state/
            image-files
```

Existing releases may be migrated toward this shape in a dedicated release
normalization gate. Do not migrate old releases as part of unrelated cleanup.

## README.md

Required sections:

- Version
- Status
- Live/dev relationship
- Summary
- User-facing changes
- Data or baseline used
- Known limitations
- Links to evidence

## CHANGELOG.md

Required sections:

- Added
- Changed
- Fixed
- Removed
- Deferred

## EVIDENCE.md

Required sections:

- Screenshots
- Verification notes
- Data checks
- Known risks
- Approval notes

## Screenshot Rules

- Latest releases appear first in index views.
- Screenshots must be grouped by page or workflow.
- Screenshots should be expandable in the app Documents UI.
- Evidence screenshots belong under `app/releases/`, not loose root folders.

## Runtime UI Rules

- The version popover shows only the compact live/dev version pair.
- Full release details belong in Documents.
- Documents render a published release index and must not expose local dev
  metadata as release history.
- Runtime UI must not carry historical release narratives.
- Runtime UI must not use `pendingRelease` as product truth.
