# Limni Release Screenshot Convention

> This doc governs how each version's visual baseline is captured, organized,
> and described. Every release follows it.

## Folder Structure Per Release

```text
releases/v{N}/
├── manifest.json
├── screenshots/
│   ├── README.md
│   ├── <surface>/
│   ├── _legacy-dev-artifacts/
│   └── _review/
└── audit-trail/
```

- `screenshots/`: user-visible visual record rendered by the Documents page.
- `_legacy-dev-artifacts/`: dev/CSS sanity artifacts that should not be part of the main product story.
- `_review/`: temporary unclassified holding area. This must be empty before a release ships.
- `audit-trail/`: migration and regression artifacts kept separate from the user-visible story.

## Required Surfaces Per Release

Each major release should include at minimum one screenshot per active surface:

- performance: summary, simulation, basket, research, notes when applicable
- data: heatmap and list views for important source models
- accounts: overview, trade list, and material modal states
- automation: bots index, research index, and material bot detail pages
- documents: the documents page itself
- agents: the agents page
- news
- status

Both light and dark theme captures are preferred but not required.

## Caption Format

Captions must use this format:

`<Section> · <View/State> · <Notable context>. <One-sentence description>.`

Captions describe what a user sees in the Documents page. They should not simply restate the filename.

## File Naming

- Use lowercase hyphenated names.
- Prefer content-descriptive names over numbered names.
- Include relevant scope tokens such as strategy, time window, and state.
- Example: `performance-basket-tandem-adr-grid-pair-fill-cap-alltime.png`.

## When To Update

- Major release, `vN`: full capture pass of all active surfaces.
- Minor release, `vN.x`: capture only surfaces affected by the release.
- Mid-version UI changes: optional; if captured, store in `audit-trail/` unless they are part of a release visual baseline.

## Documents Page Rendering

The Limni Documents page renders `releases/v{N}/screenshots/` for each version. It should not include `audit-trail/` in the main visual record by default.

Audit-trail material can be exposed in a deeper engineering/audit section later, but it is not the primary release visual story.
