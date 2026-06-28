import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Text } from "@engine/research/hash";

export const GATE66_DATE = "2026-06-27";
export const SESSION_STATE_PATH = "C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md";

export const DEPRECATED_TERM_TOKENS = [
  "Body",
  "body",
  "BODY",
  "Brain body",
  "brain/body",
  "engine/src/brain/body",
  "BRAIN_ARCHITECTURE.body",
  "body_algorithm_started",
  "READY_FOR_BODY_DESIGN_REVIEW",
  "BODY_DESIGN",
  "NO_BODY",
  "Body design",
  "final Body",
  "Body truth",
  "Body ledger",
] as const;

export type DeprecatedTermCategory =
  | "active_source_code"
  | "active_architecture_contract"
  | "package_script_or_command"
  | "current_recovery_doc"
  | "current_gate65_review_packet"
  | "historical_immutable_artifact"
  | "historical_verdict_or_hash_bound_receipt"
  | "generated_artifact_that_should_not_be_mutated"
  | "migration_manifest_allowed";

export type DeprecatedTermOccurrence = {
  occurrence_id: string;
  path: string;
  line: number | null;
  token: string;
  category: DeprecatedTermCategory;
  architecture_context: boolean;
  ordinary_language: boolean;
  should_change_active_surface: boolean;
  immutable_exception: boolean;
  occurrence_count: number;
  excerpt: string;
};

export type DeprecatedTermScan = {
  generated_at: string;
  git_commit: string;
  scanned_file_count: number;
  occurrence_count: number;
  architecture_context_occurrence_count: number;
  active_change_count: number;
  immutable_exception_count: number;
  occurrences: DeprecatedTermOccurrence[];
  classification_summary: Record<string, number>;
  active_change_plan: DeprecatedTermOccurrence[];
  immutable_history_exceptions: DeprecatedTermOccurrence[];
  paths_with_deprecated_term: string[];
  json_keys_with_deprecated_term: Array<{ path: string; key: string; count: number }>;
  verdict_strings_with_deprecated_term: Array<{ path: string; line: number | null; verdict: string }>;
};

export function parseArgMap() {
  const map = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=", 2);
    if (key && value) map.set(key, value);
  }
  return map;
}

export function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

export function toRepoRelative(filePath: string) {
  const resolved = path.resolve(filePath).split(path.sep).join("/");
  const cwd = process.cwd().split(path.sep).join("/");
  if (resolved.startsWith(`${cwd}/`)) return resolved.slice(cwd.length + 1);
  return resolved;
}

export async function ensureParent(filePath: string) {
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
}

export async function writeJson(filePath: string, value: unknown) {
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeJsonl(filePath: string, rows: unknown[]) {
  await ensureParent(filePath);
  await writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

export async function writeText(filePath: string, value: string) {
  await ensureParent(filePath);
  await writeFile(filePath, value);
}

export async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function fileHash(filePath: string) {
  return sha256Text(await readFile(filePath));
}

export async function writeShaManifest(filePath: string, gateId: string, command: string, entries: Array<{ label: string; path: string }>) {
  const lines = [`gate_id ${gateId}`, `command ${command}`, `generated_at ${new Date().toISOString()}`, `git_commit ${gitCommit()}`];
  for (const entry of entries) lines.push(`${entry.label} ${await fileHash(entry.path)} ${toRepoRelative(entry.path)}`);
  await writeText(filePath, `${lines.join("\n")}\n`);
}

export function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").toUpperCase();
}

export function renderTable(rows: Array<Record<string, unknown>>, columns: string[]) {
  const lines = [`| ${columns.join(" | ")} |`, `|${columns.map(() => "---").join("|")}|`];
  for (const row of rows) lines.push(`| ${columns.map((column) => String(row[column] ?? "")).join(" | ")} |`);
  return lines.join("\n");
}

export function listWorkspaceFiles() {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked, SESSION_STATE_PATH])].filter(shouldScanPath);
}

function shouldScanPath(filePath: string) {
  const normalized = filePath.split(path.sep).join("/");
  const denied = [
    ".git/",
    "node_modules/",
    ".next/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    "Local Environment/",
    "temp/",
    "tmp/",
    "app/.next/",
  ];
  if (denied.some((prefix) => normalized.startsWith(prefix))) return false;
  if (/^docs\/research\/gates\/gate66[^/]*\/artifacts\//.test(normalized)) return false;
  const lower = normalized.toLowerCase();
  return [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".jsonl",
    ".md",
    ".txt",
    ".yml",
    ".yaml",
    ".html",
    ".xml",
    ".csv",
    ".mq5",
    ".py",
  ].some((extension) => lower.endsWith(extension));
}

export async function scanDeprecatedTerms(): Promise<DeprecatedTermScan> {
  const files = listWorkspaceFiles();
  const occurrences: DeprecatedTermOccurrence[] = [];
  const jsonKeyCounts = new Map<string, number>();
  const verdictRows: Array<{ path: string; line: number | null; verdict: string }> = [];

  for (const filePath of files) {
    const absolutePath = path.resolve(filePath);
    let text: string;
    try {
      text = await readFile(absolutePath, "utf8");
    } catch {
      continue;
    }
    const repoPath = toRepoRelative(absolutePath);
    const aggregateLargeGenerated = text.length > 5_000_000 || repoPath.endsWith(".rows.jsonl");
    if (aggregateLargeGenerated) {
      for (const token of DEPRECATED_TERM_TOKENS) {
        const count = countToken(text, token);
        if (count === 0) continue;
        const architectureContext = isArchitectureContext(repoPath, text.slice(0, 10_000), token);
        const category = classifyPath(repoPath, architectureContext);
        const occurrence = buildOccurrence(repoPath, null, token, category, architectureContext, count, "aggregate generated artifact match");
        occurrences.push(occurrence);
      }
      collectJsonKeys(repoPath, text, jsonKeyCounts);
      collectVerdicts(repoPath, null, text, verdictRows);
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      for (const token of DEPRECATED_TERM_TOKENS) {
        const count = countToken(line, token);
        if (count === 0) continue;
        const architectureContext = isArchitectureContext(repoPath, line, token);
        const category = classifyPath(repoPath, architectureContext);
        occurrences.push(buildOccurrence(repoPath, index + 1, token, category, architectureContext, count, line.trim().slice(0, 240)));
      }
      collectVerdicts(repoPath, index + 1, line, verdictRows);
    }
    collectJsonKeys(repoPath, text, jsonKeyCounts);
  }

  const uniqueOccurrences = dedupeOccurrences(occurrences);
  const classificationSummary: Record<string, number> = {};
  for (const occurrence of uniqueOccurrences) {
    classificationSummary[occurrence.category] = (classificationSummary[occurrence.category] ?? 0) + occurrence.occurrence_count;
  }
  const activeChangePlan = uniqueOccurrences.filter((occurrence) => occurrence.should_change_active_surface);
  const immutableHistoryExceptions = uniqueOccurrences.filter((occurrence) => occurrence.immutable_exception);
  return {
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    scanned_file_count: files.length,
    occurrence_count: uniqueOccurrences.reduce((sum, occurrence) => sum + occurrence.occurrence_count, 0),
    architecture_context_occurrence_count: uniqueOccurrences.filter((occurrence) => occurrence.architecture_context).reduce((sum, occurrence) => sum + occurrence.occurrence_count, 0),
    active_change_count: activeChangePlan.reduce((sum, occurrence) => sum + occurrence.occurrence_count, 0),
    immutable_exception_count: immutableHistoryExceptions.reduce((sum, occurrence) => sum + occurrence.occurrence_count, 0),
    occurrences: uniqueOccurrences,
    classification_summary: Object.fromEntries(Object.entries(classificationSummary).sort(([left], [right]) => left.localeCompare(right))),
    active_change_plan: activeChangePlan,
    immutable_history_exceptions: immutableHistoryExceptions,
    paths_with_deprecated_term: [...new Set(uniqueOccurrences.map((occurrence) => occurrence.path).filter((filePath) => /(^|\/)body(\/|$)/i.test(filePath)))].sort(),
    json_keys_with_deprecated_term: [...jsonKeyCounts.entries()].map(([key, count]) => {
      const [filePath, jsonKey] = key.split("\u0000");
      return { path: filePath, key: jsonKey, count };
    }),
    verdict_strings_with_deprecated_term: dedupeVerdicts(verdictRows),
  };
}

function buildOccurrence(
  repoPath: string,
  line: number | null,
  token: string,
  category: DeprecatedTermCategory,
  architectureContext: boolean,
  count: number,
  excerpt: string,
): DeprecatedTermOccurrence {
  const ordinaryLanguage = token === "body" && !architectureContext;
  const immutableException =
    category === "historical_immutable_artifact" ||
    category === "historical_verdict_or_hash_bound_receipt" ||
    category === "generated_artifact_that_should_not_be_mutated" ||
    category === "current_gate65_review_packet";
  const shouldChangeActiveSurface =
    architectureContext &&
    !immutableException &&
    (category === "active_source_code" || category === "active_architecture_contract" || category === "package_script_or_command" || category === "current_recovery_doc");
  return {
    occurrence_id: stableHash({ repoPath, line, token, category, excerpt }),
    path: repoPath,
    line,
    token,
    category,
    architecture_context: architectureContext,
    ordinary_language: ordinaryLanguage,
    should_change_active_surface: shouldChangeActiveSurface,
    immutable_exception: immutableException,
    occurrence_count: count,
    excerpt,
  };
}

function classifyPath(repoPath: string, architectureContext: boolean): DeprecatedTermCategory {
  if (repoPath === SESSION_STATE_PATH) return "current_recovery_doc";
  if (repoPath === "engine/scripts/verification/gate66-utils.ts" || repoPath.startsWith("engine/scripts/verification/build-gate66")) return "migration_manifest_allowed";
  if (repoPath.startsWith("docs/research/gates/gate66")) return "migration_manifest_allowed";
  if (repoPath === "package.json" || repoPath === "package-lock.json") return "package_script_or_command";
  if (repoPath === "docs/backlog/CURRENT_WORK.md") return "current_recovery_doc";
  if (repoPath.startsWith("docs/research/gates/gate65f/")) return "current_gate65_review_packet";
  if (repoPath.startsWith("docs/research/gates/")) {
    if (/gate6[0-5]/.test(repoPath) || /gate5[0-9]/.test(repoPath)) {
      if (/sha256|summary|receipt|GATE|best-candidates|matrix|ledger|artifact/i.test(repoPath)) return "historical_verdict_or_hash_bound_receipt";
      return "historical_immutable_artifact";
    }
  }
  if (repoPath.startsWith("archive/")) return "historical_immutable_artifact";
  if (repoPath.endsWith(".rows.jsonl") || repoPath.includes("/artifacts/")) return "generated_artifact_that_should_not_be_mutated";
  if (repoPath === "engine/src/brain/architecture.ts" || repoPath === "engine/src/brain/README.md") return "active_architecture_contract";
  if (repoPath.startsWith("engine/src/brain/body/")) return "active_source_code";
  if (repoPath === "engine/scripts/verification/gate65-utils.ts") return architectureContext ? "active_source_code" : "historical_verdict_or_hash_bound_receipt";
  if (/^engine\/scripts\/verification\/build-gate65/.test(repoPath)) return architectureContext ? "active_source_code" : "historical_verdict_or_hash_bound_receipt";
  if (/^engine\/scripts\/verification\/build-gate6[1-4]/.test(repoPath)) return "historical_verdict_or_hash_bound_receipt";
  if (repoPath.startsWith("app/") || repoPath.startsWith("automation/") || repoPath.startsWith("engine/") || repoPath.startsWith(".github/")) return "active_source_code";
  return architectureContext ? "active_source_code" : "historical_immutable_artifact";
}

function isArchitectureContext(repoPath: string, line: string, token: string) {
  const normalized = repoPath.split(path.sep).join("/");
  if (normalized.startsWith("engine/src/brain/body/")) return true;
  if (normalized === "engine/src/brain/architecture.ts" || normalized === "engine/src/brain/README.md") return true;
  if (token !== "Body" && token !== "body" && token !== "BODY") return true;
  return /Brain body|brain\/body|engine\/src\/brain\/body|BRAIN_ARCHITECTURE\.body|body_algorithm|allowed_body_use|bodyReserved|blockers_before_body|before_body|bodyContracts|bodyArbitration|bodyLedgers|Body design|final Body|Body truth|Body ledger|Body direction|Body lock|Body algorithm|Body logic|Body remains|Body decisions/.test(line);
}

function countToken(text: string, token: string) {
  if (token === "Body" || token === "body" || token === "BODY") {
    const expression = new RegExp(`\\b${token}\\b`, "g");
    return [...text.matchAll(expression)].length;
  }
  return text.split(token).length - 1;
}

function collectJsonKeys(repoPath: string, text: string, counts: Map<string, number>) {
  for (const match of text.matchAll(/"([^"]*(?:body|Body|BODY)[^"]*)"\s*:/g)) {
    const key = match[1] ?? "";
    counts.set(`${repoPath}\u0000${key}`, (counts.get(`${repoPath}\u0000${key}`) ?? 0) + 1);
  }
}

function collectVerdicts(repoPath: string, line: number | null, text: string, rows: Array<{ path: string; line: number | null; verdict: string }>) {
  for (const match of text.matchAll(/(?:PASS|FAIL|READY|BLOCKED|NOT_READY)[A-Z0-9_]*BODY[A-Z0-9_]*/g)) {
    rows.push({ path: repoPath, line, verdict: match[0] ?? "" });
  }
}

function dedupeOccurrences(rows: DeprecatedTermOccurrence[]) {
  const map = new Map<string, DeprecatedTermOccurrence>();
  for (const row of rows) {
    const key = `${row.path}\u0000${row.line ?? "aggregate"}\u0000${row.token}\u0000${row.category}\u0000${row.excerpt}`;
    const existing = map.get(key);
    if (existing) {
      existing.occurrence_count += row.occurrence_count;
    } else {
      map.set(key, { ...row });
    }
  }
  return [...map.values()].sort((left, right) => left.path.localeCompare(right.path) || (left.line ?? 0) - (right.line ?? 0) || left.token.localeCompare(right.token));
}

function dedupeVerdicts(rows: Array<{ path: string; line: number | null; verdict: string }>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.path}\u0000${row.line ?? "aggregate"}\u0000${row.verdict}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
