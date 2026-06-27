import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 60H: bpr-source-direction-eligibility-classes";
const COMMAND = "npm run engine:gate60h:bpr-source-direction-eligibility-classes";
const DEFAULT_GATE60G_DIR =
  "docs/research/gates/gate60g/artifacts/gate60g-bpr-forced28-source-direction-ledger";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate60h/artifacts/gate60h-bpr-source-direction-eligibility-classes";
const DEFAULT_REPORT_PATH =
  "docs/research/gates/gate60h/GATE60H_BPR_SOURCE_DIRECTION_ELIGIBILITY_CLASSES_2026-06-27.md";

const EXPECTED_PAIR_ROWS = 10_444;
const EXPECTED_ALPHA_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;

const QUALITY_CLASSES = [
  "raw_present",
  "carried_fresh",
  "carried_stale",
  "synthetic_usd",
  "single_numeric_state_degraded",
  "deterministic_unresolved_currency_rank_fallback",
  "timing_blocked_carry",
  "unresolved_no_prior",
  "unresolved_source_ambiguous",
] as const;

const CURRENCY_QUALITY_CLASSES = [
  "raw_present",
  "carried_fresh",
  "carried_stale",
  "synthetic_usd",
  "timing_blocked_carry",
  "unresolved_no_prior",
  "unresolved_source_ambiguous",
] as const;

const PAIR_RULE_CLASSES = [
  "single_numeric_state_degraded",
  "deterministic_unresolved_currency_rank_fallback",
] as const;

type QualityClass = (typeof QUALITY_CLASSES)[number];
type CurrencyQualityClass = (typeof CURRENCY_QUALITY_CLASSES)[number];
type PairRuleClass = (typeof PAIR_RULE_CLASSES)[number];
type Direction = "BASE_CURRENCY" | "QUOTE_CURRENCY";
type Scope = "currency_state_quality" | "pair_direction_rule";
type PromotionPolicy = "always_eligible" | "conditional_row_level" | "not_eligible";
type SourceDirectionPolicy = "eligible_when_numeric" | "not_eligible";
type EligibilityBucket =
  | "source_direction_eligible"
  | "promotion_eligible"
  | "shadow_only"
  | "fail_closed";

type CliOptions = {
  gate60gDir: string;
  artifactDir: string;
  reportPath: string;
};

type PairDirectionRow = {
  row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  base: string;
  quote: string;
  bpr_source_direction: Direction;
  bpr_source_direction_rule:
    | "numeric_value_comparison"
    | "numeric_equal_currency_rank_tiebreak"
    | PairRuleClass;
  bpr_source_direction_is_neutral: boolean;
  base_bpr_net_share_of_gross: number | null;
  quote_bpr_net_share_of_gross: number | null;
  base_source_quality: CurrencyQualityClass;
  quote_source_quality: CurrencyQualityClass;
  base_promotion_eligible_currency_state: boolean;
  quote_promotion_eligible_currency_state: boolean;
  pair_source_direction_eligible: boolean;
  promotion_eligible_pair_direction: boolean;
  no_futures_options_mixing: boolean;
  no_regime_side: boolean;
  no_long_short_side: boolean;
  source_rows_mutated: boolean;
};

type Gate60gSummary = {
  gate_id: string;
  verdict: string;
  command: string;
  denominator: {
    input_rows: number;
    alpha_weeks: number;
    symbols_per_week_histogram: Record<string, number>;
    pair_direction_rows: number;
    neutral_pair_direction_rows: number;
    futures_options_mixing_rows: number;
  };
  quality_summary: {
    currency_state_quality_counts: Record<string, number>;
    pair_direction_counts: Record<string, number>;
    pair_direction_rule_counts: Record<string, number>;
    pair_base_quality_counts: Record<string, number>;
    pair_quote_quality_counts: Record<string, number>;
    pair_source_direction_eligible_rows: number;
    promotion_eligible_pair_direction_rows: number;
    promotion_ineligible_pair_direction_rows: number;
  };
  hashes: Record<string, string>;
  artifacts: Record<string, string>;
};

type ClassPolicy = {
  class_key: QualityClass;
  scope: Scope;
  source_direction_policy: SourceDirectionPolicy;
  promotion_policy: PromotionPolicy;
  class_decision: EligibilityBucket;
  rationale: string;
};

type Gate60hDecisionRow = ClassPolicy & {
  decision_table_version: string;
  direction_semantics: "BASE_CURRENCY_OR_QUOTE_CURRENCY_ONLY";
  no_long_short_side: true;
  currency_state_rows: number;
  pair_base_occurrences: number;
  pair_quote_occurrences: number;
  pair_quality_occurrences: number;
  pair_rows_with_class_on_any_side: number;
  pair_rule_rows: number;
  source_direction_eligible_rows_or_occurrences: number;
  promotion_eligible_rows_or_occurrences: number;
  shadow_only_rows_or_occurrences: number;
  fail_closed_rows_or_occurrences: number;
  content_hash: string;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    gate60gDir: DEFAULT_GATE60G_DIR,
    artifactDir: DEFAULT_ARTIFACT_DIR,
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=", 2);
    if (!value) continue;
    if (key === "--gate60g-dir") options.gate60gDir = value;
    if (key === "--artifact-dir") options.artifactDir = value;
    if (key === "--report-path") options.reportPath = value;
  }

  return options;
}

function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join("/");
}

function getGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

async function readJsonl<T>(filePath: string) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function uniqueCount(values: string[]) {
  return new Set(values).size;
}

function withContentHash<T extends Record<string, unknown>>(row: T) {
  return { ...row, content_hash: sha256Stable(row) };
}

function getNumber(counts: Record<string, number>, key: string) {
  return counts[key] ?? 0;
}

const CLASS_POLICIES: ClassPolicy[] = [
  {
    class_key: "raw_present",
    scope: "currency_state_quality",
    source_direction_policy: "eligible_when_numeric",
    promotion_policy: "always_eligible",
    class_decision: "promotion_eligible",
    rationale: "Current BPR futures report contains a numeric same-currency state.",
  },
  {
    class_key: "carried_fresh",
    scope: "currency_state_quality",
    source_direction_policy: "eligible_when_numeric",
    promotion_policy: "always_eligible",
    class_decision: "promotion_eligible",
    rationale: "Derived carried state is within the Gate 60F 45-day fresh window.",
  },
  {
    class_key: "carried_stale",
    scope: "currency_state_quality",
    source_direction_policy: "eligible_when_numeric",
    promotion_policy: "not_eligible",
    class_decision: "shadow_only",
    rationale: "Derived carried state has a numeric direction but exceeded the fresh carry window.",
  },
  {
    class_key: "synthetic_usd",
    scope: "currency_state_quality",
    source_direction_policy: "eligible_when_numeric",
    promotion_policy: "conditional_row_level",
    class_decision: "source_direction_eligible",
    rationale: "Versioned synthetic USD can support direction; promotion is allowed only where Gate 60G component coverage remains clean.",
  },
  {
    class_key: "single_numeric_state_degraded",
    scope: "pair_direction_rule",
    source_direction_policy: "not_eligible",
    promotion_policy: "not_eligible",
    class_decision: "shadow_only",
    rationale: "Only one side has a numeric BPR state, so the pair direction is degraded diagnostic output.",
  },
  {
    class_key: "deterministic_unresolved_currency_rank_fallback",
    scope: "pair_direction_rule",
    source_direction_policy: "not_eligible",
    promotion_policy: "not_eligible",
    class_decision: "fail_closed",
    rationale: "Both sides are unresolved; deterministic forced-28 fallback is not source-direction eligible.",
  },
  {
    class_key: "timing_blocked_carry",
    scope: "currency_state_quality",
    source_direction_policy: "eligible_when_numeric",
    promotion_policy: "not_eligible",
    class_decision: "shadow_only",
    rationale: "A numeric carried state exists, but the current report is timing blocked.",
  },
  {
    class_key: "unresolved_no_prior",
    scope: "currency_state_quality",
    source_direction_policy: "not_eligible",
    promotion_policy: "not_eligible",
    class_decision: "fail_closed",
    rationale: "No current or prior clean BPR futures state exists for the currency-week.",
  },
  {
    class_key: "unresolved_source_ambiguous",
    scope: "currency_state_quality",
    source_direction_policy: "not_eligible",
    promotion_policy: "not_eligible",
    class_decision: "fail_closed",
    rationale: "The source state remains ambiguous and cannot be promoted or used as source-direction evidence.",
  },
];

function buildDecisionRows(pairRows: PairDirectionRow[], summary: Gate60gSummary) {
  const baseQualityCounts = countBy(pairRows, (row) => row.base_source_quality);
  const quoteQualityCounts = countBy(pairRows, (row) => row.quote_source_quality);
  const pairRuleCounts = countBy(pairRows, (row) => row.bpr_source_direction_rule);

  return CLASS_POLICIES.map((policy): Gate60hDecisionRow => {
    if (policy.scope === "pair_direction_rule") {
      const classKey = policy.class_key as PairRuleClass;
      const rows = pairRows.filter((row) => row.bpr_source_direction_rule === classKey);
      return withContentHash({
        ...policy,
        decision_table_version: "gate60h_bpr_eligibility_decision_table_v1",
        direction_semantics: "BASE_CURRENCY_OR_QUOTE_CURRENCY_ONLY",
        no_long_short_side: true,
        currency_state_rows: 0,
        pair_base_occurrences: 0,
        pair_quote_occurrences: 0,
        pair_quality_occurrences: 0,
        pair_rows_with_class_on_any_side: 0,
        pair_rule_rows: getNumber(pairRuleCounts, classKey),
        source_direction_eligible_rows_or_occurrences: rows.filter((row) => row.pair_source_direction_eligible).length,
        promotion_eligible_rows_or_occurrences: rows.filter((row) => row.promotion_eligible_pair_direction).length,
        shadow_only_rows_or_occurrences:
          policy.class_decision === "shadow_only" ? rows.filter((row) => !row.pair_source_direction_eligible).length : 0,
        fail_closed_rows_or_occurrences: policy.class_decision === "fail_closed" ? rows.length : 0,
      });
    }

    const classKey = policy.class_key as CurrencyQualityClass;
    const baseRows = pairRows.filter((row) => row.base_source_quality === classKey);
    const quoteRows = pairRows.filter((row) => row.quote_source_quality === classKey);
    const sideOccurrences = [
      ...baseRows.map((row) => ({
        rowKey: row.row_key,
        value: row.base_bpr_net_share_of_gross,
        promotionEligible: row.base_promotion_eligible_currency_state,
      })),
      ...quoteRows.map((row) => ({
        rowKey: row.row_key,
        value: row.quote_bpr_net_share_of_gross,
        promotionEligible: row.quote_promotion_eligible_currency_state,
      })),
    ];
    const pairRowsWithClassOnAnySide = pairRows.filter(
      (row) => row.base_source_quality === classKey || row.quote_source_quality === classKey,
    );

    return withContentHash({
      ...policy,
      decision_table_version: "gate60h_bpr_eligibility_decision_table_v1",
      direction_semantics: "BASE_CURRENCY_OR_QUOTE_CURRENCY_ONLY",
      no_long_short_side: true,
      currency_state_rows: getNumber(summary.quality_summary.currency_state_quality_counts, classKey),
      pair_base_occurrences: getNumber(baseQualityCounts, classKey),
      pair_quote_occurrences: getNumber(quoteQualityCounts, classKey),
      pair_quality_occurrences: sideOccurrences.length,
      pair_rows_with_class_on_any_side: pairRowsWithClassOnAnySide.length,
      pair_rule_rows: 0,
      source_direction_eligible_rows_or_occurrences: sideOccurrences.filter((side) => side.value !== null).length,
      promotion_eligible_rows_or_occurrences: sideOccurrences.filter((side) => side.promotionEligible).length,
      shadow_only_rows_or_occurrences: sideOccurrences.filter(
        (side) => side.value !== null && !side.promotionEligible,
      ).length,
      fail_closed_rows_or_occurrences: sideOccurrences.filter((side) => side.value === null).length,
    });
  });
}

function buildDecisionSummary(decisionRows: Gate60hDecisionRow[], pairRows: PairDirectionRow[], summary: Gate60gSummary) {
  const rowsByClass = Object.fromEntries(decisionRows.map((row) => [row.class_key, row]));
  const rowCountsByClassDecision = countBy(decisionRows, (row) => row.class_decision);
  const currencyStateRowsByClassDecision = Object.fromEntries(
    ["source_direction_eligible", "promotion_eligible", "shadow_only", "fail_closed"].map((decision) => [
      decision,
      sum(decisionRows.filter((row) => row.class_decision === decision).map((row) => row.currency_state_rows)),
    ]),
  );
  const pairQualityOccurrencesByClassDecision = Object.fromEntries(
    ["source_direction_eligible", "promotion_eligible", "shadow_only", "fail_closed"].map((decision) => [
      decision,
      sum(decisionRows.filter((row) => row.class_decision === decision).map((row) => row.pair_quality_occurrences)),
    ]),
  );
  const pairRuleRowsByClassDecision = Object.fromEntries(
    ["source_direction_eligible", "promotion_eligible", "shadow_only", "fail_closed"].map((decision) => [
      decision,
      sum(decisionRows.filter((row) => row.class_decision === decision).map((row) => row.pair_rule_rows)),
    ]),
  );

  return {
    gate_id: GATE_ID,
    summary_version: "gate60h_bpr_source_direction_eligibility_summary_v1",
    verdict: "PASS_BPR_SOURCE_DIRECTION_ELIGIBILITY_CLASSES_LOCKED__GATE60G_ARTIFACTS_ONLY__NO_REGIME_SIDE",
    command: COMMAND,
    input_gate60g_verdict: summary.verdict,
    denominator: {
      input_pair_rows: pairRows.length,
      expected_pair_rows: EXPECTED_PAIR_ROWS,
      alpha_weeks: uniqueCount(pairRows.map((row) => row.alpha_week_open_utc)),
      expected_alpha_weeks: EXPECTED_ALPHA_WEEKS,
      symbols_per_week_histogram: countBy(pairRows, (row) => row.alpha_week_open_utc),
      expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
      duplicate_pair_row_keys: pairRows.length - uniqueCount(pairRows.map((row) => row.row_key)),
      neutral_pair_direction_rows: pairRows.filter((row) => row.bpr_source_direction_is_neutral).length,
      non_base_quote_direction_rows: pairRows.filter(
        (row) => row.bpr_source_direction !== "BASE_CURRENCY" && row.bpr_source_direction !== "QUOTE_CURRENCY",
      ).length,
      no_long_short_side_false_rows: pairRows.filter((row) => !row.no_long_short_side).length,
      no_regime_side_false_rows: pairRows.filter((row) => !row.no_regime_side).length,
      futures_options_mixing_rows: pairRows.filter((row) => !row.no_futures_options_mixing).length,
      source_mutation_rows: pairRows.filter((row) => row.source_rows_mutated).length,
    },
    gate60g_pair_row_counts: {
      source_direction_eligible_rows: pairRows.filter((row) => row.pair_source_direction_eligible).length,
      source_direction_ineligible_rows: pairRows.filter((row) => !row.pair_source_direction_eligible).length,
      promotion_eligible_pair_direction_rows: pairRows.filter((row) => row.promotion_eligible_pair_direction).length,
      promotion_ineligible_pair_direction_rows: pairRows.filter((row) => !row.promotion_eligible_pair_direction).length,
      base_currency_direction_rows: pairRows.filter((row) => row.bpr_source_direction === "BASE_CURRENCY").length,
      quote_currency_direction_rows: pairRows.filter((row) => row.bpr_source_direction === "QUOTE_CURRENCY").length,
    },
    decision_class_counts: {
      row_counts_by_class_decision: rowCountsByClassDecision,
      currency_state_rows_by_class_decision: currencyStateRowsByClassDecision,
      pair_quality_occurrences_by_class_decision: pairQualityOccurrencesByClassDecision,
      pair_rule_rows_by_class_decision: pairRuleRowsByClassDecision,
    },
    decision_rows_by_class: rowsByClass,
  };
}

function buildSymbolsPerWeekHistogram(pairRows: PairDirectionRow[]) {
  const weekToSymbols = new Map<string, Set<string>>();
  for (const row of pairRows) {
    const symbols = weekToSymbols.get(row.alpha_week_open_utc) ?? new Set<string>();
    symbols.add(row.symbol);
    weekToSymbols.set(row.alpha_week_open_utc, symbols);
  }
  return countBy([...weekToSymbols.values()], (symbols) => String(symbols.size));
}

function buildMarkdownTable(rows: Gate60hDecisionRow[]) {
  const lines = [
    "| Class | Scope | Source-direction | Promotion | Decision | Currency rows | Pair occurrences | Pair rule rows | Promotion count | Shadow count | Fail-closed count |",
    "|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|",
  ];

  for (const row of rows) {
    lines.push(
      [
        row.class_key,
        row.scope,
        row.source_direction_policy,
        row.promotion_policy,
        row.class_decision,
        String(row.currency_state_rows),
        String(row.pair_quality_occurrences),
        String(row.pair_rule_rows),
        String(row.promotion_eligible_rows_or_occurrences),
        String(row.shadow_only_rows_or_occurrences),
        String(row.fail_closed_rows_or_occurrences),
      ].join(" | ").replace(/^/, "| ") + " |",
    );
  }

  return lines.join("\n");
}

async function writeTextArtifact(filePath: string, text: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
}

async function main() {
  const options = parseArgs();
  const generatedAt = new Date().toISOString();
  const gitCommit = getGitCommit();
  const pairLedgerPath = path.join(options.gate60gDir, "gate60g-bpr-pair-direction-ledger.rows.jsonl");
  const sourceQualitySummaryPath = path.join(options.gate60gDir, "gate60g-bpr-source-quality-summary.json");
  const gate60gShaIdentityPath = path.join(options.gate60gDir, "gate60g-bpr-forced28-source-direction-ledger.sha256.txt");
  const artifactPaths = {
    decisionTableJsonl: path.join(options.artifactDir, "gate60h-bpr-eligibility-decision-table.rows.jsonl"),
    decisionTableMd: path.join(options.artifactDir, "gate60h-bpr-eligibility-decision-table.md"),
    summaryJson: path.join(options.artifactDir, "gate60h-bpr-source-direction-eligibility-summary.json"),
    queryReceipt: path.join(options.artifactDir, "gate60h-bpr-source-direction-eligibility.query-receipt.md"),
    shaIdentity: path.join(options.artifactDir, "gate60h-bpr-source-direction-eligibility-classes.sha256.txt"),
    report: options.reportPath,
  };

  const pairRows = await readJsonl<PairDirectionRow>(pairLedgerPath);
  const summary = await readJson<Gate60gSummary>(sourceQualitySummaryPath);
  const gate60gShaIdentityText = await readFile(gate60gShaIdentityPath, "utf8");
  const decisionRows = buildDecisionRows(pairRows, summary);
  const gate60hSummary = buildDecisionSummary(decisionRows, pairRows, summary);
  const symbolsPerWeekHistogram = buildSymbolsPerWeekHistogram(pairRows);

  gate60hSummary.denominator.symbols_per_week_histogram = symbolsPerWeekHistogram;

  const missingDecisionClasses = QUALITY_CLASSES.filter(
    (classKey) => !decisionRows.some((row) => row.class_key === classKey),
  );
  const invariantFailures = [
    pairRows.length === EXPECTED_PAIR_ROWS ? null : `expected ${EXPECTED_PAIR_ROWS} pair rows, got ${pairRows.length}`,
    uniqueCount(pairRows.map((row) => row.alpha_week_open_utc)) === EXPECTED_ALPHA_WEEKS
      ? null
      : "unexpected alpha week count",
    Object.keys(symbolsPerWeekHistogram).length === 1 && symbolsPerWeekHistogram[String(EXPECTED_SYMBOLS_PER_WEEK)] === EXPECTED_ALPHA_WEEKS
      ? null
      : `symbols/week histogram mismatch: ${JSON.stringify(symbolsPerWeekHistogram)}`,
    pairRows.length === uniqueCount(pairRows.map((row) => row.row_key)) ? null : "duplicate pair row keys",
    pairRows.some((row) => row.bpr_source_direction_is_neutral) ? "neutral pair direction rows found" : null,
    pairRows.some((row) => row.bpr_source_direction !== "BASE_CURRENCY" && row.bpr_source_direction !== "QUOTE_CURRENCY")
      ? "non BASE_CURRENCY/QUOTE_CURRENCY directions found"
      : null,
    pairRows.some((row) => !row.no_long_short_side) ? "LONG/SHORT side flag violation found" : null,
    pairRows.some((row) => !row.no_regime_side) ? "Regime side flag violation found" : null,
    pairRows.some((row) => !row.no_futures_options_mixing) ? "futures/options mixing violation found" : null,
    pairRows.some((row) => row.source_rows_mutated) ? "source mutation violation found" : null,
    missingDecisionClasses.length === 0 ? null : `missing decision classes: ${missingDecisionClasses.join(", ")}`,
    summary.denominator.pair_direction_rows === pairRows.length ? null : "summary pair direction row count mismatch",
    summary.denominator.neutral_pair_direction_rows === 0 ? null : "Gate 60G summary has neutral rows",
    summary.denominator.futures_options_mixing_rows === 0 ? null : "Gate 60G summary has futures/options mixing rows",
  ].filter((failure): failure is string => Boolean(failure));

  const decisionTableJsonlText = `${decisionRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const decisionTableMdText = [
    "# Gate 60H BPR Eligibility Decision Table",
    "",
    buildMarkdownTable(decisionRows),
    "",
  ].join("\n");
  const summaryJsonText = `${JSON.stringify(
    {
      ...gate60hSummary,
      generated_at: generatedAt,
      gate60g_inputs: {
        pair_direction_ledger: toRepoRelative(pairLedgerPath),
        source_quality_summary: toRepoRelative(sourceQualitySummaryPath),
        gate60g_sha_identity: toRepoRelative(gate60gShaIdentityPath),
      },
      invariant_failures: invariantFailures,
    },
    null,
    2,
  )}\n`;
  const queryReceiptText = [
    "# Gate 60H BPR Source-Direction Eligibility Query Receipt",
    "",
    `Generated: \`${generatedAt}\``,
    `Command: \`${COMMAND}\``,
    `Gate 60G pair ledger: \`${toRepoRelative(pairLedgerPath)}\``,
    `Gate 60G source-quality summary: \`${toRepoRelative(sourceQualitySummaryPath)}\``,
    `Gate 60G SHA identity: \`${toRepoRelative(gate60gShaIdentityPath)}\``,
    "",
    "Source use:",
    "",
    "- Gate 60G artifacts only.",
    "- No source-data rebuild.",
    "- No Regime transform, matrix, side, P&L, attribution, Alpha v2, risk, execution, MT5/live, app work, or source mutation.",
    "",
  ].join("\n");
  const reportText = [
    "# Gate 60H BPR Source-Direction Eligibility Classes",
    "",
    `Generated: \`${generatedAt}\``,
    "",
    "## Verdict",
    "",
    invariantFailures.length === 0
      ? "`PASS_BPR_SOURCE_DIRECTION_ELIGIBILITY_CLASSES_LOCKED__GATE60G_ARTIFACTS_ONLY__NO_REGIME_SIDE`"
      : "`FAIL_BPR_SOURCE_DIRECTION_ELIGIBILITY_CLASSES`",
    "",
    "## Boundary",
    "",
    "- Gate 60G artifacts only.",
    "- BPR source-direction eligibility classes only.",
    "- Direction remains `BASE_CURRENCY` / `QUOTE_CURRENCY`; no LONG/SHORT side.",
    "- No Regime transform, broad matrix, side construction, P&L, attribution, Alpha v2, risk, execution, MT5/live, app work, or source mutation.",
    "",
    "## Denominator",
    "",
    `- Pair rows: \`${pairRows.length}\` / \`${EXPECTED_PAIR_ROWS}\``,
    `- Alpha weeks: \`${uniqueCount(pairRows.map((row) => row.alpha_week_open_utc))}\` / \`${EXPECTED_ALPHA_WEEKS}\``,
    `- Symbols/week histogram: \`${JSON.stringify(symbolsPerWeekHistogram)}\``,
    `- Duplicate row keys: \`${pairRows.length - uniqueCount(pairRows.map((row) => row.row_key))}\``,
    `- Neutral pair-direction rows: \`${pairRows.filter((row) => row.bpr_source_direction_is_neutral).length}\``,
    `- Non BASE_CURRENCY/QUOTE_CURRENCY rows: \`${pairRows.filter((row) => row.bpr_source_direction !== "BASE_CURRENCY" && row.bpr_source_direction !== "QUOTE_CURRENCY").length}\``,
    "",
    "## Eligibility Decision Table",
    "",
    buildMarkdownTable(decisionRows),
    "",
    "## Gate 60G Pair-Level Counts",
    "",
    `- Source-direction eligible pair rows: \`${gate60hSummary.gate60g_pair_row_counts.source_direction_eligible_rows}\``,
    `- Source-direction ineligible pair rows: \`${gate60hSummary.gate60g_pair_row_counts.source_direction_ineligible_rows}\``,
    `- Promotion eligible pair-direction rows: \`${gate60hSummary.gate60g_pair_row_counts.promotion_eligible_pair_direction_rows}\``,
    `- Promotion ineligible pair-direction rows: \`${gate60hSummary.gate60g_pair_row_counts.promotion_ineligible_pair_direction_rows}\``,
    `- BASE_CURRENCY direction rows: \`${gate60hSummary.gate60g_pair_row_counts.base_currency_direction_rows}\``,
    `- QUOTE_CURRENCY direction rows: \`${gate60hSummary.gate60g_pair_row_counts.quote_currency_direction_rows}\``,
    "",
    "## Stop Line",
    "",
    "Gate 60H stops after locking BPR source-direction eligibility classes. It does not proceed to BPR promotion or Regime construction.",
    "",
  ].join("\n");

  const decisionTableHash = sha256Text(decisionTableJsonlText);
  const decisionTableMdHash = sha256Text(decisionTableMdText);
  const summaryJsonHash = sha256Text(summaryJsonText);
  const queryReceiptHash = sha256Text(queryReceiptText);
  const reportHash = sha256Text(reportText);
  const contentHashes = {
    gate60g_pair_direction_ledger_sha256: sha256Text(await readFile(pairLedgerPath)),
    gate60g_source_quality_summary_sha256: sha256Text(await readFile(sourceQualitySummaryPath)),
    gate60g_sha_identity_sha256: sha256Text(gate60gShaIdentityText),
    gate60h_decision_table_jsonl_sha256: decisionTableHash,
    gate60h_decision_table_md_sha256: decisionTableMdHash,
    gate60h_summary_json_sha256: summaryJsonHash,
    gate60h_query_receipt_sha256: queryReceiptHash,
    gate60h_report_sha256: reportHash,
    gate60h_content_invariant_hash: sha256Stable({
      decisionRows,
      gate60g_input_hashes: {
        pairLedger: sha256Text(await readFile(pairLedgerPath)),
        sourceQualitySummary: sha256Text(await readFile(sourceQualitySummaryPath)),
        shaIdentity: sha256Text(gate60gShaIdentityText),
      },
      gate60hSummary,
    }),
  };
  const shaIdentityText = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${generatedAt}`,
    `git_commit ${gitCommit}`,
    `verdict ${invariantFailures.length === 0 ? gate60hSummary.verdict : "FAIL_BPR_SOURCE_DIRECTION_ELIGIBILITY_CLASSES"}`,
    `gate60g_pair_direction_ledger ${contentHashes.gate60g_pair_direction_ledger_sha256} ${toRepoRelative(pairLedgerPath)}`,
    `gate60g_source_quality_summary ${contentHashes.gate60g_source_quality_summary_sha256} ${toRepoRelative(sourceQualitySummaryPath)}`,
    `gate60g_sha_identity ${contentHashes.gate60g_sha_identity_sha256} ${toRepoRelative(gate60gShaIdentityPath)}`,
    `gate60h_decision_table_jsonl ${contentHashes.gate60h_decision_table_jsonl_sha256} ${toRepoRelative(artifactPaths.decisionTableJsonl)}`,
    `gate60h_decision_table_md ${contentHashes.gate60h_decision_table_md_sha256} ${toRepoRelative(artifactPaths.decisionTableMd)}`,
    `gate60h_summary_json ${contentHashes.gate60h_summary_json_sha256} ${toRepoRelative(artifactPaths.summaryJson)}`,
    `gate60h_query_receipt ${contentHashes.gate60h_query_receipt_sha256} ${toRepoRelative(artifactPaths.queryReceipt)}`,
    `gate60h_report ${contentHashes.gate60h_report_sha256} ${toRepoRelative(artifactPaths.report)}`,
    `gate60h_content_invariant ${contentHashes.gate60h_content_invariant_hash} content`,
    "",
  ].join("\n");

  await writeTextArtifact(artifactPaths.decisionTableJsonl, decisionTableJsonlText);
  await writeTextArtifact(artifactPaths.decisionTableMd, decisionTableMdText);
  await writeTextArtifact(artifactPaths.summaryJson, summaryJsonText);
  await writeTextArtifact(artifactPaths.queryReceipt, queryReceiptText);
  await writeTextArtifact(artifactPaths.shaIdentity, shaIdentityText);
  await writeTextArtifact(artifactPaths.report, reportText);

  if (invariantFailures.length > 0) {
    throw new Error(`Gate 60H invariant failure: ${invariantFailures.join(", ")}`);
  }

  console.log(
    JSON.stringify(
      {
        verdict: gate60hSummary.verdict,
        pairRows: pairRows.length,
        sourceDirectionEligibleRows: gate60hSummary.gate60g_pair_row_counts.source_direction_eligible_rows,
        promotionEligibleRows: gate60hSummary.gate60g_pair_row_counts.promotion_eligible_pair_direction_rows,
        shaIdentity: toRepoRelative(artifactPaths.shaIdentity),
        report: toRepoRelative(artifactPaths.report),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
