import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getPool, query } from "@database/db/client";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 60A: alpha-v1-macro-join-map-proof";
const VERDICT = "PASS_JOIN_MAP_PROOF__FAIL_CLOSED_FULL_FAMILY_SOURCE_ELIGIBILITY";
const MAPPING_RULE_VERSION = "gate60a_alpha_week_utc_date_to_macro_week_id_v1";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate60a/artifacts/gate60a-alpha-v1-macro-join-map";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate60a/GATE60A_ALPHA_V1_MACRO_JOIN_MAP_PROOF_2026-06-27.md";
const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const EXPECTED_CURRENCIES_PER_PAIR = 2;
const COMMAND = "npm run engine:gate60a:alpha-v1-macro-join-map";

type SourceKey = "rrp" | "rate_parent" | "cpi_parent" | "bpr" | "valuation";
type MacroState = "ACTIVE" | "SEALED" | "BUILDING" | "QUARANTINED" | "MISSING";

type CliOptions = {
  alphaLedgerPath: string;
  artifactDir: string;
  reportPath: string;
};

type AtomLedgerRow = {
  row_key: string;
  week: {
    week_open_utc: string;
  };
  instrument: {
    symbol: string;
    base_currency: string | null;
    quote_currency: string | null;
  };
};

type DatasetRecord = {
  regime_dataset_id: string;
  dataset_version: string;
  dataset_hash: string;
  status: string;
  snapshot_state: string;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  from_week_open_utc: Date | string;
  to_week_open_utc: Date | string;
  created_at: Date | string;
};

type ManifestRecord = {
  regime_dataset_id: string;
  promotion_manifest_id: string;
  feature_bundle_manifest_id: string | null;
  activation_scope: string | null;
  contract_manifest_hash: string;
  macro_week_id: string;
  freeze_version: string;
  snapshot_id: string;
  snapshot_hash: string;
  snapshot_state: string;
  row_snapshot_count: number | string;
  sealed_at_utc: Date | string;
  verified_at_utc: Date | string | null;
  activated_at_utc: Date | string | null;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

type SnapshotRecord = {
  regime_dataset_id: string;
  source_family: string;
  source_id: string;
  currency: string;
  instrument: string;
  week_open_utc: Date | string;
  macro_week_id: string | null;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  snapshot_id: string | null;
  snapshot_hash: string | null;
  snapshot_state: string;
  sealed_at_utc: Date | string | null;
  as_of_utc: Date | string;
  source_observation_date: Date | string | null;
  effective_at_utc: Date | string | null;
  available_at_utc: Date | string | null;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

type SourceConfig = {
  key: SourceKey;
  label: string;
  sourceFamily: string;
  datasetId: string;
  role: string;
  requiredForFullFamilyRegime: boolean;
  expectedManifestState: "ACTIVE" | "SEALED" | null;
  promotionManifestId: string | null;
  featureBundleManifestId: string | null;
  activationScope: string | null;
  sourceAmbiguityFromRowFlags: boolean;
  governanceQuarantineReason: string | null;
  parentOnly: boolean;
};

type CurrencySourceStatus = {
  currency: string | null;
  row_count: number;
  instrument_count: number;
  snapshot_states: string[];
  week_open_utc: string | null;
  missing: boolean;
  stale: boolean;
  value_unavailable: boolean;
  untrusted_for_freeze: boolean;
  source_ambiguous: boolean;
  promotion_blocked: boolean;
  latest_vintage_research_approximation: boolean;
  exception_or_delay: boolean;
  source_content_hash: string | null;
};

type SourceStatus = {
  source_key: SourceKey;
  source_family: string;
  dataset_id: string;
  dataset_state: string | null;
  manifest_state: string | null;
  effective_state: MacroState;
  mapped_macro_week_id: string;
  mapped_macro_week_open_utc: string | null;
  base: CurrencySourceStatus;
  quote: CurrencySourceStatus;
  missing: boolean;
  stale: boolean;
  quarantined: boolean;
  source_ambiguous: boolean;
  non_active: boolean;
  non_promoted: boolean;
  parent_only: boolean;
  fail_closed_reasons: string[];
  quarantine_reason: string | null;
  source_content_hash: string;
};

type JoinMapRow = {
  row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  base: string | null;
  quote: string | null;
  mapped_macro_week_id: string;
  mapped_macro_week_open_utc: string | null;
  mapping_rule_version: string;
  rrp_source_status: SourceStatus;
  rate_parent_status: SourceStatus;
  cpi_parent_status: SourceStatus;
  bpr_status: SourceStatus;
  valuation_status: SourceStatus;
  source_states: Record<SourceKey, MacroState>;
  stale_flags: Record<SourceKey, boolean>;
  missing_flags: Record<SourceKey, boolean>;
  source_ambiguous_flags: Record<SourceKey, boolean>;
  quarantined_flags: Record<SourceKey, boolean>;
  fail_closed_reason: string[];
};

type JsonlSourceStatus = {
  state: MacroState;
  dataset_state: string | null;
  manifest_state: string | null;
  mapped_macro_week_open_utc: string | null;
  base_row_count: number;
  quote_row_count: number;
  base_instrument_count: number;
  quote_instrument_count: number;
  missing: boolean;
  stale: boolean;
  source_ambiguous: boolean;
  quarantined: boolean;
  non_active: boolean;
  non_promoted: boolean;
  value_unavailable: boolean;
  untrusted_for_freeze: boolean;
  parent_only: boolean;
  quarantine_reason: string | null;
};

type JsonlJoinMapRow = Omit<
  JoinMapRow,
  "rrp_source_status" | "rate_parent_status" | "cpi_parent_status" | "bpr_status" | "valuation_status"
> & {
  rrp_source_status: JsonlSourceStatus;
  rate_parent_status: JsonlSourceStatus;
  cpi_parent_status: JsonlSourceStatus;
  bpr_status: JsonlSourceStatus;
  valuation_status: JsonlSourceStatus;
};

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    key: "rrp",
    label: "real-rate pressure attribution",
    sourceFamily: "real_rate_pressure",
    datasetId: "220fd5fd-d017-4db2-bdde-524a3c664c72",
    role: "required_active_source",
    requiredForFullFamilyRegime: true,
    expectedManifestState: "ACTIVE",
    promotionManifestId: "5f0049dc6dac1470c55309caf922996171b2250f3ee35df2be21cd84b1599def",
    featureBundleManifestId: "real_rate_pressure_attribution_v1",
    activationScope: "historical_backtest",
    sourceAmbiguityFromRowFlags: false,
    governanceQuarantineReason: null,
    parentOnly: false,
  },
  {
    key: "rate_parent",
    label: "nominal rate parent",
    sourceFamily: "rate",
    datasetId: "dcdc850a-80a2-4178-8d08-dd759be6afb8",
    role: "sealed_parent_source",
    requiredForFullFamilyRegime: true,
    expectedManifestState: "SEALED",
    promotionManifestId: "12f04bd4bec599e37fdfdf926d0d39bd73902319654993baa71ce879bb8eecb5",
    featureBundleManifestId: null,
    activationScope: null,
    sourceAmbiguityFromRowFlags: false,
    governanceQuarantineReason: null,
    parentOnly: true,
  },
  {
    key: "cpi_parent",
    label: "CPI/inflation parent",
    sourceFamily: "inflation",
    datasetId: "37b4081b-880e-4ae6-8d53-20ba900dff07",
    role: "sealed_parent_source",
    requiredForFullFamilyRegime: true,
    expectedManifestState: "SEALED",
    promotionManifestId: "b0b4f8e1c42139791447e4c7413e48f20de1e738fcd5d051ed06acf57f4c286c",
    featureBundleManifestId: null,
    activationScope: null,
    sourceAmbiguityFromRowFlags: false,
    governanceQuarantineReason: null,
    parentOnly: true,
  },
  {
    key: "bpr",
    label: "BPR / bank positioning",
    sourceFamily: "bpr",
    datasetId: "01a3b789-2928-4886-a627-eaf5ae689790",
    role: "quarantined_source_family",
    requiredForFullFamilyRegime: true,
    expectedManifestState: "SEALED",
    promotionManifestId: "1a807cdbbd79a9cc1ffc1df9b038843eacfd2eb80c3b068da9ce0c92b339f46f",
    featureBundleManifestId: null,
    activationScope: null,
    sourceAmbiguityFromRowFlags: true,
    governanceQuarantineReason:
      "Gate 52A BPR full-window promotion-grade coverage is NO; source-ambiguous/quarantine rows must fail closed.",
    parentOnly: false,
  },
  {
    key: "valuation",
    label: "valuation inputs",
    sourceFamily: "valuation",
    datasetId: "97266ab2-6feb-4962-936b-a47d73c06684",
    role: "building_source_only_input",
    requiredForFullFamilyRegime: true,
    expectedManifestState: null,
    promotionManifestId: null,
    featureBundleManifestId: null,
    activationScope: null,
    sourceAmbiguityFromRowFlags: false,
    governanceQuarantineReason: null,
    parentOnly: false,
  },
];

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`-${name}`);
}

function argValue(name: string) {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseCli(): CliOptions {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(`
Build ${GATE_ID}.

Common:
  --alpha-ledger-path=<path>  Default: ${DEFAULT_ALPHA_LEDGER_PATH}
  --artifact-dir=<path>       Default: ${DEFAULT_ARTIFACT_DIR}
  --report-path=<path>        Default: ${DEFAULT_REPORT_PATH}

This is source-only. It reads the frozen Gate 59 atom ledger and existing macro
warehouse rows, emits a deterministic Alpha v1 macro join-map, and fails closed
on source eligibility blockers. It does not build Regime sides, emit LONG/SHORT
macro decisions, run P&L, change COT, Strength, Alpha v1, macro rows, app code,
risk, execution, MT5/live, or Alpha v2.
`.trim());
    process.exit(0);
  }
  return {
    alphaLedgerPath: argValue("alpha-ledger-path") ?? DEFAULT_ALPHA_LEDGER_PATH,
    artifactDir: argValue("artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: argValue("report-path") ?? DEFAULT_REPORT_PATH,
  };
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(`Failed to parse JSONL ${filePath}:${index + 1}: ${(error as Error).message}`);
      }
    });
}

async function hashFile(filePath: string) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function currentGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function dirtyTreeStatus() {
  try {
    const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], { encoding: "utf8" }).trim();
    return {
      status: status.length > 0 ? "dirty" : "clean",
      files: status ? status.split(/\r?\n/) : [],
    };
  } catch {
    return { status: "unknown", files: [] as string[] };
  }
}

function iso(value: Date | string | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}

function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(process.cwd(), filePath)).replaceAll(path.sep, "/");
}

function uniqueSorted<T extends string>(values: Array<T | null | undefined>): T[] {
  return [...new Set(values.filter((value): value is T => Boolean(value)))].sort();
}

function booleanFromJson(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function alphaWeekToMacroWeekId(alphaWeekOpenUtc: string) {
  return `macro_week_${new Date(alphaWeekOpenUtc).toISOString().slice(0, 10)}`;
}

function rowWeekCounts(rows: AtomLedgerRow[]) {
  const counts = new Map<string, Set<string>>();
  for (const row of rows) {
    const week = row.week.week_open_utc;
    const symbols = counts.get(week) ?? new Set<string>();
    symbols.add(row.instrument.symbol);
    counts.set(week, symbols);
  }
  const histogram: Record<string, number> = {};
  const nonFullWeeks: Array<{ week_open_utc: string; symbol_count: number }> = [];
  for (const [week, symbols] of [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    const count = symbols.size;
    histogram[String(count)] = (histogram[String(count)] ?? 0) + 1;
    if (count !== EXPECTED_SYMBOLS_PER_WEEK) {
      nonFullWeeks.push({ week_open_utc: week, symbol_count: count });
    }
  }
  return {
    week_count: counts.size,
    full_weeks: [...counts.values()].filter((symbols) => symbols.size === EXPECTED_SYMBOLS_PER_WEEK).length,
    histogram,
    non_full_weeks: nonFullWeeks,
  };
}

function countDuplicates(values: string[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const value of values) {
    if (seen.has(value)) duplicates += 1;
    seen.add(value);
  }
  return duplicates;
}

async function readDatasets() {
  const ids = SOURCE_CONFIGS.map((config) => config.datasetId);
  const rows = await query<DatasetRecord>(
    `
      SELECT
        regime_dataset_id::text,
        dataset_version,
        dataset_hash,
        status,
        snapshot_state,
        promotion_manifest_id,
        contract_manifest_hash,
        from_week_open_utc,
        to_week_open_utc,
        created_at
      FROM research_macro_regime_datasets
      WHERE regime_dataset_id = ANY($1::uuid[])
      ORDER BY regime_dataset_id::text
    `,
    [ids],
  );
  return new Map(rows.map((row) => [row.regime_dataset_id, row]));
}

async function readManifests(macroWeekIds: string[]) {
  const ids = SOURCE_CONFIGS.map((config) => config.datasetId);
  return await query<ManifestRecord>(
    `
      SELECT
        regime_dataset_id::text,
        promotion_manifest_id,
        feature_bundle_manifest_id,
        activation_scope,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        row_snapshot_count,
        sealed_at_utc,
        verified_at_utc,
        activated_at_utc,
        coverage,
        flags
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = ANY($1::uuid[])
        AND macro_week_id = ANY($2::text[])
      ORDER BY regime_dataset_id::text, macro_week_id, promotion_manifest_id, snapshot_state, snapshot_id
    `,
    [ids, macroWeekIds],
  );
}

async function readSnapshots(macroWeekIds: string[], currencies: string[]) {
  const ids = SOURCE_CONFIGS.map((config) => config.datasetId);
  const families = uniqueSorted(SOURCE_CONFIGS.map((config) => config.sourceFamily));
  return await query<SnapshotRecord>(
    `
      SELECT
        regime_dataset_id::text,
        source_family,
        source_id,
        currency,
        instrument,
        week_open_utc,
        macro_week_id,
        promotion_manifest_id,
        contract_manifest_hash,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        sealed_at_utc,
        as_of_utc,
        source_observation_date,
        effective_at_utc,
        available_at_utc,
        coverage,
        flags
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = ANY($1::uuid[])
        AND macro_week_id = ANY($2::text[])
        AND currency = ANY($3::text[])
        AND source_family = ANY($4::text[])
      ORDER BY regime_dataset_id::text, macro_week_id, source_family, currency, instrument, snapshot_id
    `,
    [ids, macroWeekIds, currencies, families],
  );
}

function matchesConfig(config: SourceConfig, manifest: ManifestRecord) {
  if (manifest.regime_dataset_id !== config.datasetId) return false;
  if (config.promotionManifestId && manifest.promotion_manifest_id !== config.promotionManifestId) return false;
  if ((config.featureBundleManifestId ?? null) !== (manifest.feature_bundle_manifest_id ?? null)) return false;
  if ((config.activationScope ?? null) !== (manifest.activation_scope ?? null)) return false;
  return true;
}

function manifestFor(config: SourceConfig, macroWeekId: string, manifests: ManifestRecord[]) {
  const candidates = manifests.filter((row) => row.macro_week_id === macroWeekId && matchesConfig(config, row));
  if (config.expectedManifestState) {
    const stateMatches = candidates.filter((row) => row.snapshot_state === config.expectedManifestState);
    if (stateMatches.length > 0) return stateMatches[0]!;
  }
  return candidates[0] ?? null;
}

function snapshotKey(config: SourceConfig, macroWeekId: string, currency: string) {
  return `${config.datasetId}|${config.sourceFamily}|${macroWeekId}|${currency.toUpperCase()}`;
}

function aggregateCurrencyStatus(
  currency: string | null,
  rows: SnapshotRecord[],
  config: SourceConfig,
): CurrencySourceStatus {
  const rowCount = rows.length;
  const coverageRows = rows.map((row) => row.coverage ?? {});
  const flagRows = rows.map((row) => row.flags ?? {});
  const stale = rows.some((row) => (
    booleanFromJson(row.coverage?.isStale, false) ||
    booleanFromJson(row.coverage?.staleFlag, false) ||
    booleanFromJson(row.flags?.staleByCadence, false)
  ));
  const valueUnavailable = rowCount === 0 || rows.some((row) =>
    booleanFromJson(row.coverage?.valueAvailable, true) === false);
  const untrustedForFreeze = rows.some((row) =>
    booleanFromJson(row.coverage?.trustedForFreeze, true) === false);
  const promotionBlocked = rows.some((row) =>
    booleanFromJson(row.flags?.promotionBlockedUntilExactPublicationDate, false) ||
    booleanFromJson(row.flags?.promotionBlockedUntilPointInTimeAvailability, false));
  const latestVintageResearchApproximation = rows.some((row) =>
    booleanFromJson(row.flags?.latestVintageResearchApproximation, false));
  const exceptionOrDelay = rows.some((row) =>
    booleanFromJson(row.coverage?.exceptionOrDelayFlag, false) ||
    booleanFromJson(row.flags?.delayedReportException, false));
  const sourceAmbiguous = config.sourceAmbiguityFromRowFlags
    ? promotionBlocked || latestVintageResearchApproximation || exceptionOrDelay
    : false;
  const hashPayload = rows.map((row) => ({
    regime_dataset_id: row.regime_dataset_id,
    source_family: row.source_family,
    source_id: row.source_id,
    currency: row.currency,
    instrument: row.instrument,
    week_open_utc: iso(row.week_open_utc),
    macro_week_id: row.macro_week_id,
    promotion_manifest_id: row.promotion_manifest_id,
    contract_manifest_hash: row.contract_manifest_hash,
    snapshot_id: row.snapshot_id,
    snapshot_hash: row.snapshot_hash,
    snapshot_state: row.snapshot_state,
    normalized_row_hash: row.coverage?.normalizedRowHash ?? row.flags?.normalizedRowHash ?? null,
    coverage_hash: sha256Stable(row.coverage),
    flags_hash: sha256Stable(row.flags),
  }));
  return {
    currency,
    row_count: rowCount,
    instrument_count: uniqueSorted(rows.map((row) => row.instrument)).length,
    snapshot_states: uniqueSorted(rows.map((row) => row.snapshot_state)),
    week_open_utc: uniqueSorted(rows.map((row) => iso(row.week_open_utc)))[0] ?? null,
    missing: rowCount === 0,
    stale,
    value_unavailable: valueUnavailable,
    untrusted_for_freeze: untrustedForFreeze,
    source_ambiguous: sourceAmbiguous,
    promotion_blocked: promotionBlocked,
    latest_vintage_research_approximation: latestVintageResearchApproximation,
    exception_or_delay: exceptionOrDelay,
    source_content_hash: rowCount > 0 ? sha256Stable(hashPayload) : null,
  };
}

function effectiveState(config: SourceConfig, dataset: DatasetRecord | null, manifest: ManifestRecord | null): MacroState {
  if (config.governanceQuarantineReason) return "QUARANTINED";
  if (manifest?.snapshot_state === "ACTIVE") return "ACTIVE";
  if (manifest?.snapshot_state === "SEALED") return "SEALED";
  if (dataset?.snapshot_state === "BUILDING") return "BUILDING";
  if (dataset?.snapshot_state === "QUARANTINED") return "QUARANTINED";
  return "MISSING";
}

function buildSourceStatus(input: {
  config: SourceConfig;
  macroWeekId: string;
  dataset: DatasetRecord | null;
  manifest: ManifestRecord | null;
  baseRows: SnapshotRecord[];
  quoteRows: SnapshotRecord[];
  base: string | null;
  quote: string | null;
}): SourceStatus {
  const state = effectiveState(input.config, input.dataset, input.manifest);
  const base = aggregateCurrencyStatus(input.base, input.baseRows, input.config);
  const quote = aggregateCurrencyStatus(input.quote, input.quoteRows, input.config);
  const missing = !input.dataset || !input.manifest || base.missing || quote.missing;
  const stale = base.stale || quote.stale;
  const rowAmbiguous = base.source_ambiguous || quote.source_ambiguous;
  const quarantined = state === "QUARANTINED";
  const sourceAmbiguous = rowAmbiguous || Boolean(input.config.governanceQuarantineReason);
  const nonActive = input.config.requiredForFullFamilyRegime && state !== "ACTIVE";
  const nonPromoted = (
    !input.config.promotionManifestId ||
    !input.dataset?.promotion_manifest_id ||
    (input.config.promotionManifestId !== null && input.dataset?.promotion_manifest_id !== input.config.promotionManifestId)
  );
  const reasons = new Set<string>();
  if (!input.dataset) reasons.add(`${input.config.key}_missing_dataset`);
  if (!input.manifest) reasons.add(`${input.config.key}_missing_manifest`);
  if (input.config.expectedManifestState && input.manifest?.snapshot_state !== input.config.expectedManifestState) {
    reasons.add(`${input.config.key}_manifest_not_${input.config.expectedManifestState.toLowerCase()}`);
  }
  if (base.missing) reasons.add(`${input.config.key}_missing_base_currency_row`);
  if (quote.missing) reasons.add(`${input.config.key}_missing_quote_currency_row`);
  if (stale) reasons.add(`${input.config.key}_stale`);
  if (base.value_unavailable || quote.value_unavailable) reasons.add(`${input.config.key}_value_unavailable`);
  if (base.untrusted_for_freeze || quote.untrusted_for_freeze) reasons.add(`${input.config.key}_untrusted_for_freeze`);
  if (sourceAmbiguous) reasons.add(`${input.config.key}_source_ambiguous`);
  if (quarantined) reasons.add(`${input.config.key}_quarantined`);
  if (nonActive) reasons.add(`${input.config.key}_not_active`);
  if (nonPromoted) reasons.add(`${input.config.key}_non_promoted`);
  if (input.config.parentOnly) reasons.add(`${input.config.key}_sealed_parent_only_not_standalone_active`);
  const mappedWeekOpenUtc = uniqueSorted([base.week_open_utc, quote.week_open_utc])[0] ?? null;
  const contentHash = sha256Stable({
    config: {
      key: input.config.key,
      dataset_id: input.config.datasetId,
      source_family: input.config.sourceFamily,
      expected_manifest_state: input.config.expectedManifestState,
      promotion_manifest_id: input.config.promotionManifestId,
      feature_bundle_manifest_id: input.config.featureBundleManifestId,
      activation_scope: input.config.activationScope,
    },
    dataset: input.dataset ? {
      dataset_hash: input.dataset.dataset_hash,
      snapshot_state: input.dataset.snapshot_state,
      promotion_manifest_id: input.dataset.promotion_manifest_id,
      contract_manifest_hash: input.dataset.contract_manifest_hash,
    } : null,
    manifest: input.manifest ? {
      macro_week_id: input.manifest.macro_week_id,
      snapshot_id: input.manifest.snapshot_id,
      snapshot_hash: input.manifest.snapshot_hash,
      snapshot_state: input.manifest.snapshot_state,
      row_snapshot_count: Number(input.manifest.row_snapshot_count),
    } : null,
    base_source_content_hash: base.source_content_hash,
    quote_source_content_hash: quote.source_content_hash,
  });
  return {
    source_key: input.config.key,
    source_family: input.config.sourceFamily,
    dataset_id: input.config.datasetId,
    dataset_state: input.dataset?.snapshot_state ?? null,
    manifest_state: input.manifest?.snapshot_state ?? null,
    effective_state: state,
    mapped_macro_week_id: input.macroWeekId,
    mapped_macro_week_open_utc: mappedWeekOpenUtc,
    base,
    quote,
    missing,
    stale,
    quarantined,
    source_ambiguous: sourceAmbiguous,
    non_active: nonActive,
    non_promoted: nonPromoted,
    parent_only: input.config.parentOnly,
    fail_closed_reasons: [...reasons].sort(),
    quarantine_reason: input.config.governanceQuarantineReason,
    source_content_hash: contentHash,
  };
}

function summarizeJoinMap(rows: JoinMapRow[]) {
  const sourceKeys: SourceKey[] = ["rrp", "rate_parent", "cpi_parent", "bpr", "valuation"];
  const bySource = Object.fromEntries(sourceKeys.map((key) => {
    const statuses = rows.map((row) => statusByKey(row, key));
    return [key, {
      rows: rows.length,
      complete_rows: statuses.filter((status) => !status.missing).length,
      missing_rows: statuses.filter((status) => status.missing).length,
      stale_rows: statuses.filter((status) => status.stale).length,
      source_ambiguous_rows: statuses.filter((status) => status.source_ambiguous).length,
      quarantined_rows: statuses.filter((status) => status.quarantined).length,
      active_rows: statuses.filter((status) => status.effective_state === "ACTIVE").length,
      sealed_rows: statuses.filter((status) => status.effective_state === "SEALED").length,
      building_rows: statuses.filter((status) => status.effective_state === "BUILDING").length,
      non_active_rows: statuses.filter((status) => status.non_active).length,
      non_promoted_rows: statuses.filter((status) => status.non_promoted).length,
      row_fail_closed_count: statuses.filter((status) => status.fail_closed_reasons.length > 0).length,
    }];
  }));
  const failReasonCounts: Record<string, number> = {};
  for (const row of rows) {
    for (const reason of row.fail_closed_reason) {
      failReasonCounts[reason] = (failReasonCounts[reason] ?? 0) + 1;
    }
  }
  return {
    rows: rows.length,
    weeks: new Set(rows.map((row) => row.alpha_week_open_utc)).size,
    symbols: new Set(rows.map((row) => row.symbol)).size,
    rows_with_any_fail_closed_reason: rows.filter((row) => row.fail_closed_reason.length > 0).length,
    rows_without_fail_closed_reason: rows.filter((row) => row.fail_closed_reason.length === 0).length,
    full_family_eligible_rows: rows.filter((row) => row.fail_closed_reason.length === 0).length,
    source_coverage: bySource,
    fail_reason_counts: Object.fromEntries(Object.entries(failReasonCounts).sort((a, b) => a[0].localeCompare(b[0]))),
    missing_macro_weeks: uniqueSorted(rows
      .filter((row) => row.rrp_source_status.missing)
      .map((row) => row.alpha_week_open_utc)),
  };
}

function statusByKey(row: JoinMapRow, key: SourceKey) {
  switch (key) {
    case "rrp":
      return row.rrp_source_status;
    case "rate_parent":
      return row.rate_parent_status;
    case "cpi_parent":
      return row.cpi_parent_status;
    case "bpr":
      return row.bpr_status;
    case "valuation":
      return row.valuation_status;
  }
}

function compactSourceStatus(status: SourceStatus): JsonlSourceStatus {
  return {
    state: status.effective_state,
    dataset_state: status.dataset_state,
    manifest_state: status.manifest_state,
    mapped_macro_week_open_utc: status.mapped_macro_week_open_utc,
    base_row_count: status.base.row_count,
    quote_row_count: status.quote.row_count,
    base_instrument_count: status.base.instrument_count,
    quote_instrument_count: status.quote.instrument_count,
    missing: status.missing,
    stale: status.stale,
    source_ambiguous: status.source_ambiguous,
    quarantined: status.quarantined,
    non_active: status.non_active,
    non_promoted: status.non_promoted,
    value_unavailable: status.base.value_unavailable || status.quote.value_unavailable,
    untrusted_for_freeze: status.base.untrusted_for_freeze || status.quote.untrusted_for_freeze,
    parent_only: status.parent_only,
    quarantine_reason: status.quarantine_reason,
  };
}

function compactJoinMapRow(row: JoinMapRow): JsonlJoinMapRow {
  return {
    row_key: row.row_key,
    alpha_week_open_utc: row.alpha_week_open_utc,
    symbol: row.symbol,
    base: row.base,
    quote: row.quote,
    mapped_macro_week_id: row.mapped_macro_week_id,
    mapped_macro_week_open_utc: row.mapped_macro_week_open_utc,
    mapping_rule_version: row.mapping_rule_version,
    rrp_source_status: compactSourceStatus(row.rrp_source_status),
    rate_parent_status: compactSourceStatus(row.rate_parent_status),
    cpi_parent_status: compactSourceStatus(row.cpi_parent_status),
    bpr_status: compactSourceStatus(row.bpr_status),
    valuation_status: compactSourceStatus(row.valuation_status),
    source_states: row.source_states,
    stale_flags: row.stale_flags,
    missing_flags: row.missing_flags,
    source_ambiguous_flags: row.source_ambiguous_flags,
    quarantined_flags: row.quarantined_flags,
    fail_closed_reason: row.fail_closed_reason,
  };
}

function renderSummaryMarkdown(options: {
  generatedAt: string;
  summary: ReturnType<typeof summarizeJoinMap>;
  denominator: Record<string, unknown>;
  artifactHashes: Record<string, string>;
}) {
  const sourceRows = Object.entries(options.summary.source_coverage)
    .map(([key, value]) => {
      const row = value as {
        complete_rows: number;
        missing_rows: number;
        active_rows: number;
        sealed_rows: number;
        building_rows: number;
        quarantined_rows: number;
        stale_rows: number;
        source_ambiguous_rows: number;
        non_active_rows: number;
        non_promoted_rows: number;
      };
      return `| ${key} | ${row.complete_rows} | ${row.missing_rows} | ${row.active_rows} | ${row.sealed_rows} | ${row.building_rows} | ${row.quarantined_rows} | ${row.stale_rows} | ${row.source_ambiguous_rows} | ${row.non_active_rows} | ${row.non_promoted_rows} |`;
    });
  const topReasons = Object.entries(options.summary.fail_reason_counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([reason, count]) => `| ${reason} | ${count} |`);
  return [
    "# Gate 60A Alpha v1 Macro Join-Map Summary",
    "",
    `Generated: ${options.generatedAt}`,
    "",
    "## Verdict",
    "",
    `\`${VERDICT}\``,
    "",
    "Gate 60A built the source-only join map and intentionally stopped before Regime construction.",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(options.denominator, null, 2),
    "```",
    "",
    "## Source Coverage",
    "",
    "| Source | Complete rows | Missing rows | ACTIVE | SEALED | BUILDING | QUARANTINED | Stale | Source ambiguous | Non-ACTIVE | Non-promoted |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...sourceRows,
    "",
    "## Top Fail-Closed Reasons",
    "",
    "| Reason | Rows |",
    "|---|---:|",
    ...topReasons,
    "",
    "## Artifact Hashes",
    "",
    "```json",
    JSON.stringify(options.artifactHashes, null, 2),
    "```",
    "",
  ].join("\n");
}

function renderReceiptMarkdown(options: {
  generatedAt: string;
  runtimeCommit: string;
  dirty: ReturnType<typeof dirtyTreeStatus>;
  sourceDatasets: DatasetRecord[];
  sourceManifestCount: number;
  sourceSnapshotRowsRead: number;
  sourceContentInvariantHash: string;
  command: string;
}) {
  const datasetRows = options.sourceDatasets.map((row) =>
    `| ${row.regime_dataset_id} | ${row.snapshot_state} | ${row.status} | ${row.promotion_manifest_id ?? "-"} | ${row.contract_manifest_hash ?? "-"} |`);
  return [
    "# Gate 60A Query Probe Receipt",
    "",
    `Generated: ${options.generatedAt}`,
    "",
    "## Command",
    "",
    "```powershell",
    options.command,
    "```",
    "",
    "## Runtime",
    "",
    `- Git commit: \`${options.runtimeCommit}\``,
    `- Dirty tree status at script start: \`${options.dirty.status}\``,
    `- Dirty files: \`${options.dirty.files.length}\``,
    "",
    "## Source Datasets Included",
    "",
    "| Dataset | Snapshot state | Dataset status | Promotion manifest | Contract manifest hash |",
    "|---|---|---|---|---|",
    ...datasetRows,
    "",
    "## Probe Counts",
    "",
    `- Source manifest rows read: \`${options.sourceManifestCount}\``,
    `- Source snapshot rows read: \`${options.sourceSnapshotRowsRead}\``,
    `- Source content invariant hash: \`${options.sourceContentInvariantHash}\``,
    "",
    "## Boundary",
    "",
    "Read-only database probe. No macro source rows, Gate 59 rows, COT, Strength, Alpha v1, app runtime, Regime side, P&L, risk, execution, MT5/live, or Alpha v2 work was run.",
    "",
  ].join("\n");
}

function renderReport(options: {
  generatedAt: string;
  denominator: Record<string, unknown>;
  summary: ReturnType<typeof summarizeJoinMap>;
  artifactPaths: Record<string, string>;
  artifactHashes: Record<string, string>;
}) {
  return [
    "# Gate 60A Alpha v1 Macro Join-Map Proof",
    "",
    `Generated: ${options.generatedAt}`,
    "",
    "## Verdict",
    "",
    `\`${VERDICT}\``,
    "",
    "Gate 60A proves the source-only join map from the frozen Gate 59 Alpha v1 atom ledger to existing macro warehouse source families. It does not build a Regime strategy, emit macro LONG/SHORT decisions, run P&L, test Alpha v1 improvement, change COT, change Strength, change Alpha v1, change macro rows, touch app runtime, start Alpha v2, risk, execution, or MT5/live work.",
    "",
    "## Mapping Rule",
    "",
    `\`${MAPPING_RULE_VERSION}\`: map each Alpha v1 \`week_open_utc\` to \`macro_week_YYYY-MM-DD\` using the UTC date portion of the Alpha week-open timestamp. The proof records the raw Alpha timestamp and the matched macro source timestamp when present; missing source weeks fail closed.`,
    "",
    "## Denominator Proof",
    "",
    "```json",
    JSON.stringify(options.denominator, null, 2),
    "```",
    "",
    "## Coverage Result",
    "",
    `- Full-family eligible rows: \`${options.summary.full_family_eligible_rows} / ${options.summary.rows}\``,
    `- Rows fail-closed: \`${options.summary.rows_with_any_fail_closed_reason} / ${options.summary.rows}\``,
    `- RRP missing macro weeks: \`${options.summary.missing_macro_weeks.length}\``,
    "",
    "The RRP lane is the only ACTIVE historical-backtest source family, but the Alpha v1 denominator still has missing mapped RRP weeks. Rate and CPI are SEALED parents, BPR is governance-quarantined by Gate 52A, and valuation remains BUILDING/non-promoted.",
    "",
    "## Artifacts",
    "",
    `- Join-map JSONL: \`${options.artifactPaths.joinMapRows}\``,
    `- Summary Markdown: \`${options.artifactPaths.summary}\``,
    `- Query/probe receipt: \`${options.artifactPaths.receipt}\``,
    `- SHA-256 identity: \`${options.artifactPaths.sha}\``,
    "",
    "## Hashes",
    "",
    "```json",
    JSON.stringify(options.artifactHashes, null, 2),
    "```",
    "",
    "## Stop Line",
    "",
    "Stop here. Do not proceed to Regime shadow-signal construction, macro side decisions, P&L, attribution, strategy tests, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row changes.",
    "",
  ].join("\n");
}

async function main() {
  const startedAt = new Date();
  const generatedAt = startedAt.toISOString();
  const cli = parseCli();
  const alphaLedgerPath = path.resolve(process.cwd(), cli.alphaLedgerPath);
  const artifactDir = path.resolve(process.cwd(), cli.artifactDir);
  const reportPath = path.resolve(process.cwd(), cli.reportPath);
  const joinMapPath = path.join(artifactDir, "gate60a-alpha-v1-macro-join-map.rows.jsonl");
  const summaryPath = path.join(artifactDir, "gate60a-alpha-v1-macro-join-map.summary.md");
  const receiptPath = path.join(artifactDir, "gate60a-alpha-v1-macro-join-map.query-receipt.md");
  const shaPath = path.join(artifactDir, "gate60a-alpha-v1-macro-join-map.sha256.txt");

  const runtimeCommit = currentGitCommit();
  const dirty = dirtyTreeStatus();
  const [alphaRows, alphaLedgerHash] = await Promise.all([
    readJsonl<AtomLedgerRow>(alphaLedgerPath),
    hashFile(alphaLedgerPath),
  ]);
  const weekStats = rowWeekCounts(alphaRows);
  const inputKeys = alphaRows.map((row) => row.row_key);
  const denominator = {
    input_rows: alphaRows.length,
    expected_input_rows: EXPECTED_ROWS,
    alpha_weeks: weekStats.week_count,
    expected_alpha_weeks: EXPECTED_WEEKS,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    full_weeks: weekStats.full_weeks,
    rows_per_week_histogram: weekStats.histogram,
    non_full_weeks: weekStats.non_full_weeks,
    duplicate_input_row_keys: countDuplicates(inputKeys),
  };
  if (
    denominator.input_rows !== EXPECTED_ROWS ||
    denominator.alpha_weeks !== EXPECTED_WEEKS ||
    denominator.full_weeks !== EXPECTED_WEEKS ||
    denominator.duplicate_input_row_keys !== 0
  ) {
    throw new Error(`Gate 60A denominator invariant failed: ${JSON.stringify(denominator, null, 2)}`);
  }

  const macroWeekIds = uniqueSorted(alphaRows.map((row) => alphaWeekToMacroWeekId(row.week.week_open_utc)));
  const currencies = uniqueSorted(alphaRows.flatMap((row) => [row.instrument.base_currency, row.instrument.quote_currency]));
  const [datasets, manifests, snapshots] = await Promise.all([
    readDatasets(),
    readManifests(macroWeekIds),
    readSnapshots(macroWeekIds, currencies),
  ]);

  const snapshotIndex = new Map<string, SnapshotRecord[]>();
  for (const snapshot of snapshots) {
    if (!snapshot.macro_week_id) continue;
    const matchingConfig = SOURCE_CONFIGS.find((config) =>
      config.datasetId === snapshot.regime_dataset_id && config.sourceFamily === snapshot.source_family);
    if (!matchingConfig) continue;
    const key = snapshotKey(matchingConfig, snapshot.macro_week_id, snapshot.currency);
    snapshotIndex.set(key, [...(snapshotIndex.get(key) ?? []), snapshot]);
  }

  const joinMapRows: JoinMapRow[] = [];
  for (const alpha of alphaRows) {
    const mappedMacroWeekId = alphaWeekToMacroWeekId(alpha.week.week_open_utc);
    const sourceStatuses = Object.fromEntries(SOURCE_CONFIGS.map((config) => {
      const baseRows = alpha.instrument.base_currency
        ? snapshotIndex.get(snapshotKey(config, mappedMacroWeekId, alpha.instrument.base_currency)) ?? []
        : [];
      const quoteRows = alpha.instrument.quote_currency
        ? snapshotIndex.get(snapshotKey(config, mappedMacroWeekId, alpha.instrument.quote_currency)) ?? []
        : [];
      return [config.key, buildSourceStatus({
        config,
        macroWeekId: mappedMacroWeekId,
        dataset: datasets.get(config.datasetId) ?? null,
        manifest: manifestFor(config, mappedMacroWeekId, manifests),
        baseRows,
        quoteRows,
        base: alpha.instrument.base_currency,
        quote: alpha.instrument.quote_currency,
      })];
    })) as Record<SourceKey, SourceStatus>;
    const mappedMacroWeekOpenUtc = uniqueSorted([
      sourceStatuses.rrp.mapped_macro_week_open_utc,
      sourceStatuses.rate_parent.mapped_macro_week_open_utc,
      sourceStatuses.cpi_parent.mapped_macro_week_open_utc,
      sourceStatuses.bpr.mapped_macro_week_open_utc,
      sourceStatuses.valuation.mapped_macro_week_open_utc,
    ])[0] ?? null;
    const failClosedReason = uniqueSorted(Object.values(sourceStatuses).flatMap((status) => status.fail_closed_reasons));
    joinMapRows.push({
      row_key: alpha.row_key,
      alpha_week_open_utc: alpha.week.week_open_utc,
      symbol: alpha.instrument.symbol,
      base: alpha.instrument.base_currency,
      quote: alpha.instrument.quote_currency,
      mapped_macro_week_id: mappedMacroWeekId,
      mapped_macro_week_open_utc: mappedMacroWeekOpenUtc,
      mapping_rule_version: MAPPING_RULE_VERSION,
      rrp_source_status: sourceStatuses.rrp,
      rate_parent_status: sourceStatuses.rate_parent,
      cpi_parent_status: sourceStatuses.cpi_parent,
      bpr_status: sourceStatuses.bpr,
      valuation_status: sourceStatuses.valuation,
      source_states: {
        rrp: sourceStatuses.rrp.effective_state,
        rate_parent: sourceStatuses.rate_parent.effective_state,
        cpi_parent: sourceStatuses.cpi_parent.effective_state,
        bpr: sourceStatuses.bpr.effective_state,
        valuation: sourceStatuses.valuation.effective_state,
      },
      stale_flags: {
        rrp: sourceStatuses.rrp.stale,
        rate_parent: sourceStatuses.rate_parent.stale,
        cpi_parent: sourceStatuses.cpi_parent.stale,
        bpr: sourceStatuses.bpr.stale,
        valuation: sourceStatuses.valuation.stale,
      },
      missing_flags: {
        rrp: sourceStatuses.rrp.missing,
        rate_parent: sourceStatuses.rate_parent.missing,
        cpi_parent: sourceStatuses.cpi_parent.missing,
        bpr: sourceStatuses.bpr.missing,
        valuation: sourceStatuses.valuation.missing,
      },
      source_ambiguous_flags: {
        rrp: sourceStatuses.rrp.source_ambiguous,
        rate_parent: sourceStatuses.rate_parent.source_ambiguous,
        cpi_parent: sourceStatuses.cpi_parent.source_ambiguous,
        bpr: sourceStatuses.bpr.source_ambiguous,
        valuation: sourceStatuses.valuation.source_ambiguous,
      },
      quarantined_flags: {
        rrp: sourceStatuses.rrp.quarantined,
        rate_parent: sourceStatuses.rate_parent.quarantined,
        cpi_parent: sourceStatuses.cpi_parent.quarantined,
        bpr: sourceStatuses.bpr.quarantined,
        valuation: sourceStatuses.valuation.quarantined,
      },
      fail_closed_reason: failClosedReason,
    });
  }
  joinMapRows.sort((left, right) => left.row_key.localeCompare(right.row_key));

  const outputKeys = joinMapRows.map((row) => row.row_key);
  const denominatorWithOutput = {
    ...denominator,
    output_join_map_rows: joinMapRows.length,
    dropped_rows: alphaRows.length - joinMapRows.length,
    duplicate_output_row_keys: countDuplicates(outputKeys),
    output_row_keys_match_input_row_keys:
      outputKeys.length === inputKeys.length &&
      outputKeys.every((key, index) => key === [...inputKeys].sort()[index]),
  };
  if (
    denominatorWithOutput.output_join_map_rows !== EXPECTED_ROWS ||
    denominatorWithOutput.dropped_rows !== 0 ||
    denominatorWithOutput.duplicate_output_row_keys !== 0
  ) {
    throw new Error(`Gate 60A output invariant failed: ${JSON.stringify(denominatorWithOutput, null, 2)}`);
  }

  const sourceContentInvariantHash = sha256Stable({
    source_configs: SOURCE_CONFIGS,
    datasets: [...datasets.values()].map((dataset) => ({
      regime_dataset_id: dataset.regime_dataset_id,
      dataset_version: dataset.dataset_version,
      dataset_hash: dataset.dataset_hash,
      snapshot_state: dataset.snapshot_state,
      promotion_manifest_id: dataset.promotion_manifest_id,
      contract_manifest_hash: dataset.contract_manifest_hash,
      from_week_open_utc: iso(dataset.from_week_open_utc),
      to_week_open_utc: iso(dataset.to_week_open_utc),
    })),
    manifests: manifests.map((manifest) => ({
      regime_dataset_id: manifest.regime_dataset_id,
      promotion_manifest_id: manifest.promotion_manifest_id,
      feature_bundle_manifest_id: manifest.feature_bundle_manifest_id,
      activation_scope: manifest.activation_scope,
      contract_manifest_hash: manifest.contract_manifest_hash,
      macro_week_id: manifest.macro_week_id,
      snapshot_id: manifest.snapshot_id,
      snapshot_hash: manifest.snapshot_hash,
      snapshot_state: manifest.snapshot_state,
      row_snapshot_count: Number(manifest.row_snapshot_count),
    })),
    snapshots: snapshots.map((snapshot) => ({
      regime_dataset_id: snapshot.regime_dataset_id,
      source_family: snapshot.source_family,
      source_id: snapshot.source_id,
      currency: snapshot.currency,
      instrument: snapshot.instrument,
      week_open_utc: iso(snapshot.week_open_utc),
      macro_week_id: snapshot.macro_week_id,
      promotion_manifest_id: snapshot.promotion_manifest_id,
      contract_manifest_hash: snapshot.contract_manifest_hash,
      snapshot_id: snapshot.snapshot_id,
      snapshot_hash: snapshot.snapshot_hash,
      snapshot_state: snapshot.snapshot_state,
      normalized_row_hash: snapshot.coverage?.normalizedRowHash ?? snapshot.flags?.normalizedRowHash ?? null,
      coverage_hash: sha256Stable(snapshot.coverage),
      flags_hash: sha256Stable(snapshot.flags),
    })),
  });

  const summary = summarizeJoinMap(joinMapRows);
  const joinMapOutputRows = joinMapRows.map((row) => compactJoinMapRow(row));
  const joinMapText = `${joinMapOutputRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const joinMapHash = sha256Text(joinMapText);
  const receiptText = renderReceiptMarkdown({
    generatedAt,
    runtimeCommit,
    dirty,
    sourceDatasets: SOURCE_CONFIGS.map((config) => datasets.get(config.datasetId)).filter((row): row is DatasetRecord => Boolean(row)),
    sourceManifestCount: manifests.length,
    sourceSnapshotRowsRead: snapshots.length,
    sourceContentInvariantHash,
    command: COMMAND,
  });
  const receiptHash = sha256Text(receiptText);
  const artifactHashesBase = {
    gate59_alpha_ledger_jsonl_sha256: alphaLedgerHash,
    join_map_jsonl_sha256: joinMapHash,
    query_receipt_md_sha256: receiptHash,
    source_content_invariant_sha256: sourceContentInvariantHash,
  };
  const summaryText = renderSummaryMarkdown({
    generatedAt,
    summary,
    denominator: denominatorWithOutput,
    artifactHashes: artifactHashesBase,
  });
  const summaryHash = sha256Text(summaryText);
  const reportText = renderReport({
    generatedAt,
    denominator: denominatorWithOutput,
    summary,
    artifactPaths: {
      joinMapRows: toRepoRelative(joinMapPath),
      summary: toRepoRelative(summaryPath),
      receipt: toRepoRelative(receiptPath),
      sha: toRepoRelative(shaPath),
    },
    artifactHashes: {
      ...artifactHashesBase,
      summary_md_sha256: summaryHash,
    },
  });
  const reportHash = sha256Text(reportText);
  const combinedHash = sha256Stable({
    gate59_alpha_ledger_jsonl_sha256: alphaLedgerHash,
    join_map_jsonl_sha256: joinMapHash,
    summary_md_sha256: summaryHash,
    query_receipt_md_sha256: receiptHash,
    report_md_sha256: reportHash,
    source_content_invariant_sha256: sourceContentInvariantHash,
  });
  const shaText = [
    "# Gate 60A Alpha v1 macro join-map identity",
    "",
    `${alphaLedgerHash}  ${toRepoRelative(alphaLedgerPath)}`,
    `${joinMapHash}  ${toRepoRelative(joinMapPath)}`,
    `${summaryHash}  ${toRepoRelative(summaryPath)}`,
    `${receiptHash}  ${toRepoRelative(receiptPath)}`,
    `${reportHash}  ${toRepoRelative(reportPath)}.report-text`,
    `${sourceContentInvariantHash}  source_content_invariant`,
    "",
    `combined_hash ${combinedHash}`,
    `rebuild_command ${COMMAND}`,
    `mapping_rule_version ${MAPPING_RULE_VERSION}`,
    "",
  ].join("\n");

  await Promise.all([
    mkdir(artifactDir, { recursive: true }),
    mkdir(path.dirname(reportPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(joinMapPath, joinMapText, "utf8"),
    writeFile(summaryPath, summaryText, "utf8"),
    writeFile(receiptPath, receiptText, "utf8"),
    writeFile(reportPath, reportText, "utf8"),
    writeFile(shaPath, shaText, "utf8"),
  ]);

  console.log(`Gate 60A join-map rows: ${joinMapRows.length}`);
  console.log(`Gate 60A weeks: ${summary.weeks}`);
  console.log(`Gate 60A full-family eligible rows: ${summary.full_family_eligible_rows}`);
  console.log(`Gate 60A fail-closed rows: ${summary.rows_with_any_fail_closed_reason}`);
  console.log(`Gate 60A RRP missing macro weeks: ${summary.missing_macro_weeks.length}`);
  console.log(`Join-map JSONL SHA-256: ${joinMapHash}`);
  console.log(`Source content invariant SHA-256: ${sourceContentInvariantHash}`);
  console.log(`Combined hash: ${combinedHash}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
  });
