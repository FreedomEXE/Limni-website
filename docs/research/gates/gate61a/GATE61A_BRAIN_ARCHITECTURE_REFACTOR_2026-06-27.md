# Gate 61A Brain Architecture Refactor

Generated: `2026-06-27T17:58:45.403Z`

## Verdict

`PASS_BRAIN_CELLS_ATOMS_NAMESPACE_LOCKED__BPR_NESTED_UNDER_REGIME__NO_EVIDENCE_MUTATION`

## Boundary

- Source-layout refactor only.
- Historical `docs/research/gates` evidence was not moved or rewritten.
- No COT logic, Strength logic, Regime/BPR source logic, matrix tests, P&L, Alpha v2, risk, execution, MT5/live, or app/runtime work.
- BPR is nested under `engine/src/brain/cells/regime/atoms/bpr`; no top-level BPR cell exists.

## Architecture

- Brain has Cells.
- Current Cells: COT, Strength, Regime.
- Cells are made of atoms.
- Body is reserved for the later integrated forced-28 decision algorithm.
- Risk is reserved for the later permission layer that may reduce actual trade expression below 28.

## Validation

```json
{
  "brain_architecture_version": "gate61a_brain_cells_atoms_v1",
  "architecture_path_count": 22,
  "missing_architecture_paths": [],
  "top_level_bpr_cell_exists": false,
  "cells_represented": [
    "cot",
    "strength",
    "regime"
  ],
  "cot_cell_represented": true,
  "strength_cell_represented": true,
  "regime_cell_represented": true,
  "bpr_nested_under_regime": true,
  "missing_package_scripts": [],
  "immutable_docs_research_gates_moved": false,
  "historical_evidence_rewritten": false
}
```

## Artifacts

- Architecture summary: `docs/research/gates/gate61a/artifacts/gate61a-brain-architecture-refactor/gate61a-brain-architecture-summary.json`
- File/adaptor map: `docs/research/gates/gate61a/artifacts/gate61a-brain-architecture-refactor/gate61a-brain-architecture-file-map.json`
- SHA identity: `docs/research/gates/gate61a/artifacts/gate61a-brain-architecture-refactor/gate61a-brain-architecture-refactor.sha256.txt`

## Stop Line

Gate 61A stops after the Brain source-layout contract and report. It does not run readiness, matrix, P&L, Alpha v2, risk, execution, MT5/live, or app work.
