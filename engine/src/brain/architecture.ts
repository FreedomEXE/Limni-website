export const BRAIN_ARCHITECTURE_VERSION = "gate61a_brain_cells_atoms_v1";

export type BrainCellId = "cot" | "strength" | "regime";
export type BrainAtomStatus = "locked" | "building" | "shadow" | "sealed_parent" | "reserved";

export type BrainAtomContract = {
  atom_id: string;
  label: string;
  status: BrainAtomStatus;
  source_gate: string;
  forced_28_role: "signal_atom" | "source_quality_atom" | "shadow_atom" | "diagnostic_atom";
};

export type BrainCellContract = {
  cell_id: BrainCellId;
  label: string;
  path: string;
  forced_28_required: true;
  atoms: BrainAtomContract[];
};

export const COT_CELL_ATOMS: BrainAtomContract[] = [
  {
    atom_id: "cot_side",
    label: "locked COT side",
    status: "locked",
    source_gate: "Gate 59",
    forced_28_role: "signal_atom",
  },
  {
    atom_id: "cot_tei_spread",
    label: "base-minus-quote COT TEI spread",
    status: "locked",
    source_gate: "Gate 59",
    forced_28_role: "signal_atom",
  },
  {
    atom_id: "cot_carry_flags",
    label: "COT carry-forward and carry-previous flags",
    status: "locked",
    source_gate: "Gate 59",
    forced_28_role: "source_quality_atom",
  },
  {
    atom_id: "cot_lifecycle_state",
    label: "COT report lifecycle state",
    status: "locked",
    source_gate: "Gate 59",
    forced_28_role: "source_quality_atom",
  },
];

export const STRENGTH_CELL_ATOMS: BrainAtomContract[] = [
  {
    atom_id: "strength_gate57e_side",
    label: "locked Gate 57E Strength side",
    status: "locked",
    source_gate: "Gate 59",
    forced_28_role: "signal_atom",
  },
  {
    atom_id: "strength_score_spread",
    label: "FRS15 base-minus-quote score spread",
    status: "locked",
    source_gate: "Gate 59",
    forced_28_role: "signal_atom",
  },
  {
    atom_id: "strength_lifecycle_bucket",
    label: "Strength lifecycle bucket",
    status: "locked",
    source_gate: "Gate 59",
    forced_28_role: "source_quality_atom",
  },
  {
    atom_id: "strength_phase_bucket",
    label: "Strength phase bucket",
    status: "locked",
    source_gate: "Gate 59",
    forced_28_role: "source_quality_atom",
  },
];

export const REGIME_BPR_ATOMS: BrainAtomContract[] = [
  {
    atom_id: "bpr_futures",
    label: "BPR futures required source atom",
    status: "building",
    source_gate: "Gate 60G",
    forced_28_role: "signal_atom",
  },
  {
    atom_id: "bpr_futures_and_options",
    label: "BPR futures/options shadow source atom",
    status: "shadow",
    source_gate: "Gate 60G",
    forced_28_role: "shadow_atom",
  },
  {
    atom_id: "bpr_futures_carried_state",
    label: "BPR futures carried source state",
    status: "building",
    source_gate: "Gate 60G",
    forced_28_role: "source_quality_atom",
  },
  {
    atom_id: "bpr_futures_synthetic_usd_state",
    label: "BPR synthetic USD source state",
    status: "building",
    source_gate: "Gate 60G",
    forced_28_role: "source_quality_atom",
  },
];

export const REGIME_RATE_ATOMS: BrainAtomContract[] = [
  {
    atom_id: "nominal_rate_3m",
    label: "nominal 3m interbank rate",
    status: "sealed_parent",
    source_gate: "Gate 60C",
    forced_28_role: "signal_atom",
  },
];

export const REGIME_INFLATION_ATOMS: BrainAtomContract[] = [
  {
    atom_id: "cpi_inflation_yoy",
    label: "CPI inflation year-over-year",
    status: "sealed_parent",
    source_gate: "Gate 60C",
    forced_28_role: "signal_atom",
  },
];

export const REGIME_RRP_ATOMS: BrainAtomContract[] = [
  {
    atom_id: "rrp_derived",
    label: "real-rate-pressure derived atom",
    status: "building",
    source_gate: "Gate 60C",
    forced_28_role: "signal_atom",
  },
];

export const REGIME_VALUATION_ATOMS: BrainAtomContract[] = [
  {
    atom_id: "ppp",
    label: "purchasing power parity",
    status: "building",
    source_gate: "Gate 60C",
    forced_28_role: "signal_atom",
  },
  {
    atom_id: "neer",
    label: "nominal effective exchange rate",
    status: "building",
    source_gate: "Gate 60C",
    forced_28_role: "signal_atom",
  },
  {
    atom_id: "reer",
    label: "real effective exchange rate",
    status: "building",
    source_gate: "Gate 60C",
    forced_28_role: "signal_atom",
  },
];

export const REGIME_CELL_ATOMS: BrainAtomContract[] = [
  ...REGIME_BPR_ATOMS,
  ...REGIME_RATE_ATOMS,
  ...REGIME_INFLATION_ATOMS,
  ...REGIME_RRP_ATOMS,
  ...REGIME_VALUATION_ATOMS,
];

export const BRAIN_CELLS: BrainCellContract[] = [
  {
    cell_id: "cot",
    label: "COT cell",
    path: "engine/src/brain/cells/cot",
    forced_28_required: true,
    atoms: COT_CELL_ATOMS,
  },
  {
    cell_id: "strength",
    label: "Strength cell",
    path: "engine/src/brain/cells/strength",
    forced_28_required: true,
    atoms: STRENGTH_CELL_ATOMS,
  },
  {
    cell_id: "regime",
    label: "Regime cell",
    path: "engine/src/brain/cells/regime",
    forced_28_required: true,
    atoms: REGIME_CELL_ATOMS,
  },
];

export const BRAIN_ARCHITECTURE = {
  version: BRAIN_ARCHITECTURE_VERSION,
  system: "Brain",
  cells: BRAIN_CELLS,
  body: {
    path: "engine/src/brain/body",
    status: "reserved_for_later_integrated_forced28_decision_algorithm",
    may_reduce_expression_below_28: false,
  },
  risk: {
    path: "engine/src/brain/risk",
    status: "reserved_for_later_permission_layer",
    may_reduce_expression_below_28: true,
  },
  standing_rule:
    "Alpha-style cells and Regime-style cells preserve forced-28 weekly pair directions; only the later risk layer may reduce actual trade expression.",
} as const;

export function getBrainCell(cellId: BrainCellId) {
  return BRAIN_CELLS.find((cell) => cell.cell_id === cellId);
}

export function flattenBrainAtomInventory() {
  return BRAIN_CELLS.flatMap((cell) =>
    cell.atoms.map((atom) => ({
      cell_id: cell.cell_id,
      cell_label: cell.label,
      ...atom,
    })),
  );
}
