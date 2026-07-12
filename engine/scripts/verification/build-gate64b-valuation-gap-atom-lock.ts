import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 64B: valuation-gap-atom-lock";
const COMMAND = "npm run engine:gate64b:valuation-gap-atom-lock";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_GATE60C_DIR = "docs/research/gates/gate60c/artifacts/gate60c-regime-source-atom-fill";
const DEFAULT_GATE64A_DIR = "docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate64b/GATE64B_VALUATION_GAP_ATOM_LOCK_2026-06-27.md";

const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const EXPECTED_CURRENCY_WEEK_ROWS = 2_984;
const CURRENCY_TIE_RANK = new Map(["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"].map((currency, index) => [currency, index]));

type Direction = "BASE_CURRENCY" | "QUOTE_CURRENCY";

type CliOptions = {
  alphaLedgerPath: string;
  gate60cDir: string;
  gate64aDir: string;
  artifactDir: string;
  reportPath: string;
};

type AlphaLedgerRow = {
  row_key: string;
  week: { week_open_utc: string };
  instrument: { symbol: string; base_currency: string | null; quote_currency: string | null };
};

type CurrencyWeekAtomRow = {
  row_key: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: string;
  atom_key: string;
  source_family: string;
  source_state: string;
  atom_role: string;
  status: string;
  promotion_eligible: boolean;
  value_available: boolean;
  value: number | null;
  missing: boolean;
  stale: boolean;
  quarantined: boolean;
  source_ambiguous: boolean;
  fail_closed_reasons: string[];
  content_hash: string;
};

type FormulaContract = {
  formula_id: string;
  formula_version: string | null;
  status: "emitted" | "fail_closed";
  label: string;
  parent_atom_keys: string[];
  currency_value_definition: string | null;
  pair_spread_definition: string | null;
  natural_direction_definition: string | null;
  inverse_direction_definition: string | null;
  tie_rule: string | null;
  required_inputs: string[];
  fail_closed_reason: string | null;
  quality_flags: string[];
};

type CurrencyGapRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: string;
  atom_key: "valuation_gap";
  formula_id: string;
  formula_version: string;
  value: number;
  value_available: true;
  parent_atom_row_keys: string[];
  parent_atom_hashes: string[];
  quality_flags: string[];
  content_hash: string;
};

type PairGapRow = {
  row_key: string;
  ledger_version: string;
  alpha_row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  base_currency: string;
  quote_currency: string;
  atom_key: "valuation_gap";
  formula_id: string;
  formula_version: string;
  base_value: number;
  quote_value: number;
  spread_base_minus_quote: number;
  natural_direction: Direction;
  inverse_direction: Direction;
  tie_rule: string;
  forced28_joinable: boolean;
  degraded: boolean;
  degraded_reasons: string[];
  parent_currency_row_keys: string[];
  parent_currency_hashes: string[];
  content_hash: string;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    alphaLedgerPath: DEFAULT_ALPHA_LEDGER_PATH,
    gate60cDir: DEFAULT_GATE60C_DIR,
    gate64aDir: DEFAULT_GATE64A_DIR,
    artifactDir: DEFAULT_ARTIFACT_DIR,
    reportPath: DEFAULT_REPORT_PATH,
  };
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=", 2);
    if (!value) continue;
    if (key === "--alpha-ledger-path") options.alphaLedgerPath = value;
    if (key === "--gate60c-dir") options.gate60cDir = value;
    if (key === "--gate64a-dir") options.gate64aDir = value;
    if (key === "--artifact-dir") options.artifactDir = value;
    if (key === "--report-path") options.reportPath = value;
  }
  return options;
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join("/");
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readJsonl<T>(filePath: string) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

async function fileHash(filePath: string) {
  return sha256Text(await readFile(filePath));
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function rowsPerWeek(rows: AlphaLedgerRow[]) {
  const counts = countBy(rows, (row) => row.week.week_open_utc);
  return {
    weeks: Object.keys(counts).length,
    full_weeks: Object.values(counts).filter((count) => count === EXPECTED_SYMBOLS_PER_WEEK).length,
    histogram: countBy(Object.values(counts), (count) => String(count)),
  };
}

function duplicateCount(values: string[]) {
  return Object.values(countBy(values, (value) => value)).filter((count) => count > 1).length;
}

function atomMapKey(atomKey: string, weekOpenUtc: string, currency: string) {
  return `${atomKey}|${weekOpenUtc}|${currency}`;
}

function currencyGapMapKey(formulaId: string, weekOpenUtc: string, currency: string) {
  return `${formulaId}|${weekOpenUtc}|${currency}`;
}

function currencyRankDirection(base: string, quote: string) {
  const baseRank = CURRENCY_TIE_RANK.get(base) ?? Number.MAX_SAFE_INTEGER;
  const quoteRank = CURRENCY_TIE_RANK.get(quote) ?? Number.MAX_SAFE_INTEGER;
  return baseRank <= quoteRank ? "BASE_CURRENCY" : "QUOTE_CURRENCY";
}

function opposite(direction: Direction): Direction {
  return direction === "BASE_CURRENCY" ? "QUOTE_CURRENCY" : "BASE_CURRENCY";
}

function formulaContracts(): FormulaContract[] {
  return [
    {
      formula_id: "valuation_gap_reer_deviation",
      formula_version: "valuation_gap_reer_deviation_v1",
      status: "emitted",
      label: "REER deviation from 2020=100 base",
      parent_atom_keys: ["reer"],
      currency_value_definition: "reer_broad_index_2020_100 - 100",
      pair_spread_definition: "base valuation_gap value minus quote valuation_gap value",
      natural_direction_definition: "higher valuation_gap spread selects BASE_CURRENCY",
      inverse_direction_definition: "lower valuation_gap spread selects BASE_CURRENCY",
      tie_rule: "equal spread uses deterministic currency rank AUD,CAD,CHF,EUR,GBP,JPY,NZD,USD",
      required_inputs: ["reer"],
      fail_closed_reason: null,
      quality_flags: ["reer_index_base_year_2020_neutral_assumption", "valuation_gap_not_spot_fair_value"],
    },
    {
      formula_id: "valuation_gap_neer_reer_relative",
      formula_version: "valuation_gap_neer_reer_relative_v1",
      status: "emitted",
      label: "REER minus NEER relative valuation gap",
      parent_atom_keys: ["reer", "neer"],
      currency_value_definition: "reer_broad_index_2020_100 - neer_broad_index_2020_100",
      pair_spread_definition: "base valuation_gap value minus quote valuation_gap value",
      natural_direction_definition: "higher valuation_gap spread selects BASE_CURRENCY",
      inverse_direction_definition: "lower valuation_gap spread selects BASE_CURRENCY",
      tie_rule: "equal spread uses deterministic currency rank AUD,CAD,CHF,EUR,GBP,JPY,NZD,USD",
      required_inputs: ["reer", "neer"],
      fail_closed_reason: null,
      quality_flags: ["relative_index_gap_not_spot_fair_value"],
    },
    {
      formula_id: "valuation_gap_ppp_spot",
      formula_version: null,
      status: "fail_closed",
      label: "PPP versus spot valuation gap",
      parent_atom_keys: ["ppp"],
      currency_value_definition: null,
      pair_spread_definition: null,
      natural_direction_definition: null,
      inverse_direction_definition: null,
      tie_rule: null,
      required_inputs: ["ppp", "point_in_time_spot_or_fair_value_fx"],
      fail_closed_reason: "missing_hash_bound_point_in_time_spot_or_fair_value_input",
      quality_flags: ["fail_closed_no_hidden_spot_normalization"],
    },
    {
      formula_id: "valuation_gap_composite_ppp_neer_reer",
      formula_version: null,
      status: "fail_closed",
      label: "Composite PPP, NEER, and REER valuation gap",
      parent_atom_keys: ["ppp", "neer", "reer"],
      currency_value_definition: null,
      pair_spread_definition: null,
      natural_direction_definition: null,
      inverse_direction_definition: null,
      tie_rule: null,
      required_inputs: ["ppp", "neer", "reer", "versioned_cross_unit_normalization"],
      fail_closed_reason: "ppp_xdc_per_usd_not_comparable_with_neer_reer_indices_without_versioned_normalization",
      quality_flags: ["fail_closed_no_hidden_cross_unit_normalization"],
    },
  ];
}

function valueForFormula(contract: FormulaContract, weekOpenUtc: string, currency: string, atomsByKey: Map<string, CurrencyWeekAtomRow>) {
  const parentRows = contract.parent_atom_keys.map((atomKey) => atomsByKey.get(atomMapKey(atomKey, weekOpenUtc, currency)));
  if (contract.status !== "emitted" || parentRows.some((row) => !row || row.status !== "FILLED_POINT_IN_TIME" || typeof row.value !== "number")) {
    return null;
  }
  if (contract.formula_id === "valuation_gap_reer_deviation") {
    return round((parentRows[0]?.value ?? 0) - 100);
  }
  if (contract.formula_id === "valuation_gap_neer_reer_relative") {
    const reer = parentRows.find((row) => row?.atom_key === "reer")?.value ?? 0;
    const neer = parentRows.find((row) => row?.atom_key === "neer")?.value ?? 0;
    return round(reer - neer);
  }
  return null;
}

function buildCurrencyRows(contracts: FormulaContract[], currencyAtomRows: CurrencyWeekAtomRow[]) {
  const atomsByKey = new Map(currencyAtomRows.map((row) => [atomMapKey(row.atom_key, row.alpha_week_open_utc, row.currency), row]));
  const currencyWeeks = [
    ...new Map(currencyAtomRows.map((row) => [`${row.alpha_week_open_utc}|${row.mapped_macro_week_id}|${row.currency}`, row])).values(),
  ].sort((left, right) => `${left.alpha_week_open_utc}|${left.currency}`.localeCompare(`${right.alpha_week_open_utc}|${right.currency}`));
  const rows: CurrencyGapRow[] = [];
  for (const contract of contracts.filter((entry) => entry.status === "emitted")) {
    for (const currencyWeek of currencyWeeks) {
      const value = valueForFormula(contract, currencyWeek.alpha_week_open_utc, currencyWeek.currency, atomsByKey);
      if (value === null || contract.formula_version === null) continue;
      const parentRows = contract.parent_atom_keys.map((atomKey) => atomsByKey.get(atomMapKey(atomKey, currencyWeek.alpha_week_open_utc, currencyWeek.currency)));
      const baseRow = {
        row_key: `${contract.formula_id}|${currencyWeek.alpha_week_open_utc}|${currencyWeek.currency}`,
        ledger_version: "gate64b_valuation_gap_currency_atom_ledger_v1",
        alpha_week_open_utc: currencyWeek.alpha_week_open_utc,
        mapped_macro_week_id: currencyWeek.mapped_macro_week_id,
        currency: currencyWeek.currency,
        atom_key: "valuation_gap" as const,
        formula_id: contract.formula_id,
        formula_version: contract.formula_version,
        value,
        value_available: true as const,
        parent_atom_row_keys: parentRows.flatMap((row) => (row ? [row.row_key] : [])),
        parent_atom_hashes: parentRows.flatMap((row) => (row ? [row.content_hash] : [])),
        quality_flags: contract.quality_flags,
      };
      rows.push({ ...baseRow, content_hash: sha256Stable(baseRow) });
    }
  }
  return rows;
}

function buildPairRows(alphaRows: AlphaLedgerRow[], contracts: FormulaContract[], currencyRows: CurrencyGapRow[]) {
  const rowsByKey = new Map(currencyRows.map((row) => [currencyGapMapKey(row.formula_id, row.alpha_week_open_utc, row.currency), row]));
  const rows: PairGapRow[] = [];
  for (const contract of contracts.filter((entry): entry is FormulaContract & { formula_version: string } => entry.status === "emitted" && entry.formula_version !== null)) {
    for (const alphaRow of alphaRows) {
      const base = alphaRow.instrument.base_currency;
      const quote = alphaRow.instrument.quote_currency;
      const baseRow = base ? rowsByKey.get(currencyGapMapKey(contract.formula_id, alphaRow.week.week_open_utc, base)) : undefined;
      const quoteRow = quote ? rowsByKey.get(currencyGapMapKey(contract.formula_id, alphaRow.week.week_open_utc, quote)) : undefined;
      const degradedReasons = [
        ...(base ? [] : ["missing_base_currency"]),
        ...(quote ? [] : ["missing_quote_currency"]),
        ...(baseRow ? [] : ["missing_base_valuation_gap"]),
        ...(quoteRow ? [] : ["missing_quote_valuation_gap"]),
      ];
      if (!base || !quote || !baseRow || !quoteRow) {
        const failRow = {
          row_key: `${contract.formula_id}|${alphaRow.row_key}`,
          ledger_version: "gate64b_valuation_gap_pair_atom_ledger_v1",
          alpha_row_key: alphaRow.row_key,
          alpha_week_open_utc: alphaRow.week.week_open_utc,
          symbol: alphaRow.instrument.symbol,
          base_currency: base ?? "UNKNOWN",
          quote_currency: quote ?? "UNKNOWN",
          atom_key: "valuation_gap" as const,
          formula_id: contract.formula_id,
          formula_version: contract.formula_version,
          base_value: 0,
          quote_value: 0,
          spread_base_minus_quote: 0,
          natural_direction: "BASE_CURRENCY" as Direction,
          inverse_direction: "QUOTE_CURRENCY" as Direction,
          tie_rule: contract.tie_rule ?? "none",
          forced28_joinable: false,
          degraded: true,
          degraded_reasons: degradedReasons,
          parent_currency_row_keys: [],
          parent_currency_hashes: [],
        };
        rows.push({ ...failRow, content_hash: sha256Stable(failRow) });
        continue;
      }
      const spread = round(baseRow.value - quoteRow.value);
      const naturalDirection = spread > 0 ? "BASE_CURRENCY" : spread < 0 ? "QUOTE_CURRENCY" : currencyRankDirection(base, quote);
      const basePairRow = {
        row_key: `${contract.formula_id}|${alphaRow.row_key}`,
        ledger_version: "gate64b_valuation_gap_pair_atom_ledger_v1",
        alpha_row_key: alphaRow.row_key,
        alpha_week_open_utc: alphaRow.week.week_open_utc,
        symbol: alphaRow.instrument.symbol,
        base_currency: base,
        quote_currency: quote,
        atom_key: "valuation_gap" as const,
        formula_id: contract.formula_id,
        formula_version: contract.formula_version,
        base_value: baseRow.value,
        quote_value: quoteRow.value,
        spread_base_minus_quote: spread,
        natural_direction: naturalDirection,
        inverse_direction: opposite(naturalDirection),
        tie_rule: contract.tie_rule ?? "none",
        forced28_joinable: true,
        degraded: false,
        degraded_reasons: [],
        parent_currency_row_keys: [baseRow.row_key, quoteRow.row_key],
        parent_currency_hashes: [baseRow.content_hash, quoteRow.content_hash],
      };
      rows.push({ ...basePairRow, content_hash: sha256Stable(basePairRow) });
    }
  }
  return rows;
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 64B Valuation-Gap Atom Lock",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Boundary",
    "",
    "- Builds only versioned valuation-gap derived atoms supported by existing point-in-time valuation inputs.",
    "- Raw PPP, NEER, and REER atoms remain separate Gate 60C source atoms.",
    "- No Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning, or hidden source repair.",
    "",
    "## Formula Results",
    "",
    "```json",
    JSON.stringify(summary.formula_results, null, 2),
    "```",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(summary.denominator, null, 2),
    "```",
    "",
    "## Interpretation",
    "",
    "- `valuation_gap_reer_deviation_v1` is emitted from REER index deviation versus 2020=100.",
    "- `valuation_gap_neer_reer_relative_v1` is emitted from REER minus NEER.",
    "- `valuation_gap_ppp_spot_v1` is fail-closed because no hash-bound point-in-time spot/fair-value input is present in the current artifacts.",
    "- `valuation_gap_composite_ppp_neer_reer_v1` is fail-closed because PPP XDC/USD is not comparable with NEER/REER indices without a versioned normalization formula.",
    "",
    "## Artifacts",
    "",
    `- Formula contracts: \`${summary.artifacts.formulaContracts}\``,
    `- Currency atom ledger: \`${summary.artifacts.currencyLedger}\``,
    `- Pair atom ledger: \`${summary.artifacts.pairLedger}\``,
    `- Lineage map: \`${summary.artifacts.lineageMap}\``,
    `- Fail-closed report: \`${summary.artifacts.failClosedReport}\``,
    `- SHA identity: \`${summary.artifacts.shaIdentity}\``,
    "",
    "## Stop Line",
    "",
    String(summary.stop_line),
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const alphaRows = await readJsonl<AlphaLedgerRow>(options.alphaLedgerPath);
  const currencyAtomPath = path.join(options.gate60cDir, "gate60c-currency-week-source-atom-ledger.rows.jsonl");
  const gate60cRegistryPath = path.join(options.gate60cDir, "gate60c-regime-source-registry-v2.contract.json");
  const gate64aMissingReportPath = path.join(options.gate64aDir, "missing-atom-report.json");
  const currencyAtomRows = await readJsonl<CurrencyWeekAtomRow>(currencyAtomPath);
  const gate64aMissingReport = await readJson<Record<string, unknown>>(gate64aMissingReportPath);
  const contracts = formulaContracts();
  const emittedContracts = contracts.filter((contract) => contract.status === "emitted");
  const failClosedContracts = contracts.filter((contract) => contract.status === "fail_closed");
  const currencyRows = buildCurrencyRows(contracts, currencyAtomRows);
  const pairRows = buildPairRows(alphaRows, contracts, currencyRows);
  const weekShape = rowsPerWeek(alphaRows);
  const expectedCurrencyRows = emittedContracts.length * EXPECTED_CURRENCY_WEEK_ROWS;
  const expectedPairRows = emittedContracts.length * EXPECTED_ROWS;
  const pass =
    alphaRows.length === EXPECTED_ROWS &&
    weekShape.weeks === EXPECTED_WEEKS &&
    weekShape.full_weeks === EXPECTED_WEEKS &&
    duplicateCount(alphaRows.map((row) => `${row.week.week_open_utc}|${row.instrument.symbol}`)) === 0 &&
    emittedContracts.length > 0 &&
    currencyRows.length === expectedCurrencyRows &&
    pairRows.length === expectedPairRows &&
    pairRows.filter((row) => !row.forced28_joinable || row.degraded).length === 0;

  const artifactPaths = {
    formulaContracts: toRepoRelative(path.join(artifactDir, "valuation-gap-formula-contracts.json")),
    currencyLedger: toRepoRelative(path.join(artifactDir, "valuation-gap-currency-atom-ledger.rows.jsonl")),
    pairLedger: toRepoRelative(path.join(artifactDir, "valuation-gap-pair-atom-ledger.rows.jsonl")),
    lineageMap: toRepoRelative(path.join(artifactDir, "valuation-gap-lineage-map.json")),
    failClosedReport: toRepoRelative(path.join(artifactDir, "valuation-gap-fail-closed-report.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate64b-valuation-gap-atom-lock.summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate64b-valuation-gap-atom-lock.sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_VALUATION_GAP_ATOM_LOCK__TWO_FORMULAS_EMITTED__PPP_SPOT_AND_COMPOSITE_FAIL_CLOSED"
      : "FAIL_VALUATION_GAP_ATOM_LOCK",
    denominator: {
      alpha_rows: alphaRows.length,
      expected_alpha_rows: EXPECTED_ROWS,
      alpha_weeks: weekShape.weeks,
      expected_alpha_weeks: EXPECTED_WEEKS,
      symbols_per_week_histogram: weekShape.histogram,
      expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
      full_weeks: weekShape.full_weeks,
      duplicate_week_symbol_rows: duplicateCount(alphaRows.map((row) => `${row.week.week_open_utc}|${row.instrument.symbol}`)),
      emitted_formula_count: emittedContracts.length,
      fail_closed_formula_count: failClosedContracts.length,
      currency_atom_rows: currencyRows.length,
      expected_currency_atom_rows: expectedCurrencyRows,
      pair_atom_rows: pairRows.length,
      expected_pair_atom_rows: expectedPairRows,
      degraded_pair_rows: pairRows.filter((row) => row.degraded).length,
      non_forced28_joinable_pair_rows: pairRows.filter((row) => !row.forced28_joinable).length,
    },
    formula_results: contracts.map((contract) => ({
      formula_id: contract.formula_id,
      formula_version: contract.formula_version,
      status: contract.status,
      parent_atom_keys: contract.parent_atom_keys,
      fail_closed_reason: contract.fail_closed_reason,
      currency_rows: currencyRows.filter((row) => row.formula_id === contract.formula_id).length,
      pair_rows: pairRows.filter((row) => row.formula_id === contract.formula_id).length,
    })),
    gate64a_required_missing_atoms: gate64aMissingReport.required_missing_atoms,
    input_hashes: {
      gate59_alpha_ledger: await fileHash(options.alphaLedgerPath),
      gate60c_currency_atom_ledger: await fileHash(currencyAtomPath),
      gate60c_registry: await fileHash(gate60cRegistryPath),
      gate64a_missing_report: await fileHash(gate64aMissingReportPath),
    },
    stop_line:
      "Stop Gate 64B after valuation-gap lock. Proceed to Gate 64C only to refresh the matrix with emitted valuation_gap atoms; do not start Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime, source mutation, COT retuning, or Strength retuning.",
    artifacts: artifactPaths,
  };

  const formulaContractsPath = path.join(artifactDir, "valuation-gap-formula-contracts.json");
  const currencyLedgerPath = path.join(artifactDir, "valuation-gap-currency-atom-ledger.rows.jsonl");
  const pairLedgerPath = path.join(artifactDir, "valuation-gap-pair-atom-ledger.rows.jsonl");
  const lineageMapPath = path.join(artifactDir, "valuation-gap-lineage-map.json");
  const failClosedReportPath = path.join(artifactDir, "valuation-gap-fail-closed-report.json");
  const summaryPath = path.join(artifactDir, "gate64b-valuation-gap-atom-lock.summary.json");
  const shaPath = path.join(artifactDir, "gate64b-valuation-gap-atom-lock.sha256.txt");

  await writeFile(formulaContractsPath, `${JSON.stringify({ gate_id: GATE_ID, formula_contracts: contracts }, null, 2)}\n`, "utf8");
  await writeFile(currencyLedgerPath, `${currencyRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  await writeFile(pairLedgerPath, `${pairRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  await writeFile(
    lineageMapPath,
    `${JSON.stringify(
      {
        gate_id: GATE_ID,
        lineage_version: "gate64b_valuation_gap_lineage_map_v1",
        emitted_formulas: emittedContracts.map((contract) => ({
          formula_id: contract.formula_id,
          formula_version: contract.formula_version,
          parent_atom_keys: contract.parent_atom_keys,
          source_ledger: currencyAtomPath,
        })),
        raw_atoms_preserved_separately: ["ppp", "neer", "reer"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    failClosedReportPath,
    `${JSON.stringify({ gate_id: GATE_ID, fail_closed_formulas: failClosedContracts }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(summary), "utf8");

  const contentInvariant = sha256Stable({
    denominator: summary.denominator,
    formula_results: summary.formula_results,
    currency_hashes: currencyRows.map((row) => row.content_hash),
    pair_hashes: pairRows.map((row) => row.content_hash),
    input_hashes: summary.input_hashes,
  });
  const shaLines = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${summary.generated_at}`,
    `git_commit ${summary.git_commit}`,
    `verdict ${summary.verdict}`,
    `formula_contracts ${await fileHash(formulaContractsPath)} ${toRepoRelative(formulaContractsPath)}`,
    `currency_atom_ledger ${await fileHash(currencyLedgerPath)} ${toRepoRelative(currencyLedgerPath)}`,
    `pair_atom_ledger ${await fileHash(pairLedgerPath)} ${toRepoRelative(pairLedgerPath)}`,
    `lineage_map ${await fileHash(lineageMapPath)} ${toRepoRelative(lineageMapPath)}`,
    `fail_closed_report ${await fileHash(failClosedReportPath)} ${toRepoRelative(failClosedReportPath)}`,
    `summary_json ${await fileHash(summaryPath)} ${toRepoRelative(summaryPath)}`,
    `report ${await fileHash(reportPath)} ${toRepoRelative(reportPath)}`,
    `content_invariant ${contentInvariant} content`,
    "",
  ].join("\n");
  await writeFile(shaPath, shaLines, "utf8");

  if (!pass) {
    console.error(summary.verdict);
    process.exit(1);
  }
  console.log(summary.verdict);
  console.log(`Emitted formulas: ${emittedContracts.map((contract) => contract.formula_id).join(", ")}`);
  console.log(`Fail-closed formulas: ${failClosedContracts.map((contract) => contract.formula_id).join(", ")}`);
  console.log(`Pair rows: ${pairRows.length}`);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
  console.log(`SHA identity: ${toRepoRelative(shaPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
