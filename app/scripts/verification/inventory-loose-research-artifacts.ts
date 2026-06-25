import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FileType =
  | "script"
  | "receipt"
  | "report"
  | "config"
  | "generated_result"
  | "source_loader"
  | "app_code"
  | "unknown";

type Classification =
  | "active blessed workflow"
  | "active evidence receipt"
  | "reusable infrastructure"
  | "historical receipt script"
  | "deprecated but referenced"
  | "deprecated and safe to archive"
  | "unknown / needs review";

type ProposedAction =
  | "keep active"
  | "move to root archive"
  | "move into proper active gate folder"
  | "leave temporarily with deprecation marker"
  | "needs Freedom review";

type InventoryRow = {
  current_path: string;
  file_hash_sha256: string;
  file_type: FileType;
  reason_matched: string[];
  imported_by_active_code: { yes: boolean; paths: string[] };
  referenced_by_package_json: { yes: boolean; commands: string[] };
  referenced_by_docs_receipts: { yes: boolean; paths: string[] };
  current_classification: Classification;
  proposed_action: ProposedAction;
  replacement_blessed_path: string | null;
  archive_destination: string | null;
};

type PackageCommandRow = {
  command: string;
  script: string;
  classification: string;
  proposed_action: string;
  replacement_blessed_path: string | null;
};

const OUT_DIR = "docs/research/gates/gate55/inventory";
const ARCHIVE_MANIFEST_PATH = "archive/docs/research/gates/gate55/ARCHIVE_MANIFEST_2026-06-25.md";
const INVENTORY_JSONL = `${OUT_DIR}/LOOSE_ARTIFACT_INVENTORY_2026-06-25.jsonl`;
const INVENTORY_MD = `${OUT_DIR}/LOOSE_ARTIFACT_INVENTORY_2026-06-25.md`;
const PACKAGE_COMMAND_MD = `${OUT_DIR}/PACKAGE_COMMAND_CLASSIFICATION_2026-06-25.md`;
const PACKAGE_COMMAND_JSONL = `${OUT_DIR}/PACKAGE_COMMAND_CLASSIFICATION_2026-06-25.jsonl`;

function git(args: string[]) {
  return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();
}

function trackedFiles() {
  return git(["ls-files"]).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function normalizeSlash(value: string) {
  return value.replace(/\\/g, "/");
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function isTextLike(file: string) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonl|md|mdx|txt|csv|sql|ps1|yml|yaml|toml|xml|html|css)$/i.test(file);
}

function fileType(file: string): FileType {
  const lower = file.toLowerCase();
  if (/\.(ts|tsx|js|jsx|mjs|cjs|ps1|py)$/i.test(file)) return "script";
  if (lower.includes("/reports/") || lower.includes("data-verification")) return "generated_result";
  if (lower.includes("receipt") || /gate\d+[a-z]?_/.test(path.basename(lower))) return "receipt";
  if (lower.endsWith(".md") || lower.endsWith(".csv")) return "report";
  if (lower.includes("loader") || lower.includes("warehouse") || lower.includes("dataset")) return "source_loader";
  if (lower.startsWith("app/src/")) return "app_code";
  if (/\.(json|yml|yaml|toml)$/i.test(file)) return "config";
  return "unknown";
}

function candidateReasons(file: string) {
  const lower = file.toLowerCase();
  const base = path.basename(lower);
  const reasons: string[] = [];
  if (lower.startsWith("app/scripts/") && /(backtest|research|sweep|tester|verify-selector|audit|gate\d+|strength|cot|regime|matrix|katarakti|bitget|eightcap|universal)/.test(base)) {
    reasons.push("app/scripts research/backtest/tester naming");
  }
  if (lower.startsWith("app/src/") && (
    lower.includes("/research/") ||
    lower.includes("pathbarloader") ||
    lower.includes("weeklyholdengine") ||
    lower.includes("historicalstrength") ||
    lower.includes("matrixdataset")
  )) {
    reasons.push("app/src research/source/evaluator infrastructure");
  }
  if (lower.startsWith("docs/") && /(gate\d+|backtest|research|strategy|receipt|matrix|strength|cot|regime|sweep|tester)/.test(lower)) {
    reasons.push("docs research/gate/receipt artifact");
  }
  if (lower.startsWith("app/reports/") && /(gate\d+|backtest|research|strategy|receipt|matrix|strength|cot|regime|verification)/.test(lower)) {
    reasons.push("app/reports generated evidence artifact");
  }
  if (lower.startsWith("app/releases/") && /(gate\d+|backtest|research|strategy|verification|evidence|screenshot)/.test(lower)) {
    reasons.push("release evidence artifact");
  }
  if (lower.startsWith("database/") && /(research|matrix|regime|backtest|cot|strength)/.test(lower)) {
    reasons.push("database research schema artifact");
  }
  if (!file.includes("/") && /(backtest|research|strategy|gate\d+|receipt|report|matrix|strength|cot|regime)/.test(lower)) {
    reasons.push("root-level loose research artifact");
  }
  return reasons;
}

function referenceKeys(file: string) {
  const base = path.basename(file);
  const noExt = base.replace(/\.[^.]+$/, "");
  return Array.from(new Set([
    file,
    file.replace(/\//g, "\\"),
    base,
    noExt,
  ].filter((key) => key.length >= 4)));
}

function packageCommandRows(packageText: string) {
  const packageJson = JSON.parse(packageText) as { scripts?: Record<string, string> };
  const scripts = packageJson.scripts ?? {};
  const rows: PackageCommandRow[] = [];
  const commandPattern = /(research|backtest|tester|gate\d+|audit|sweep|matrix|strength|cot|regime|rrp|macro)/i;
  for (const [command, script] of Object.entries(scripts)) {
    if (!commandPattern.test(command) && !commandPattern.test(script)) continue;
    let classification = "deprecated but temporarily retained";
    let proposedAction = "leave temporarily with deprecation marker";
    let replacement: string | null = "verification:research-manifest:evaluate";
    if (command === "verification:research-manifest:evaluate") {
      classification = "candidate shared evaluator pending Gate 55G parity";
      proposedAction = "keep active";
      replacement = null;
    } else if (command === "verification:gate55h-inventory") {
      classification = "active cleanup inventory command";
      proposedAction = "keep active";
      replacement = null;
    } else if (command === "verification:export-research-matrix-dataset-contract") {
      classification = "reusable infrastructure";
      proposedAction = "keep active";
      replacement = null;
    } else if (/verification:gate\d+|audit-|analyze-gate|macro-|rrp|gate55|gate54/.test(command) || /app\/scripts\/verification\//.test(script)) {
      classification = "historical receipt command";
      proposedAction = "leave temporarily with deprecation marker";
    }
    rows.push({ command, script, classification, proposed_action: proposedAction, replacement_blessed_path: replacement });
  }
  return rows.sort((left, right) => left.command.localeCompare(right.command));
}

function classify(options: {
  file: string;
  packageCommands: string[];
  docsRefs: string[];
  codeRefs: string[];
}): Pick<InventoryRow, "current_classification" | "proposed_action" | "replacement_blessed_path" | "archive_destination"> {
  const lower = options.file.toLowerCase();
  const safeAdrJs = /^app\/scripts\/adr-backtest-[a-z0-9-]+\.js$/.test(lower) &&
    options.packageCommands.length === 0 &&
    options.docsRefs.length === 0 &&
    options.codeRefs.length === 0;

  if (
    lower === "app/scripts/verification/evaluate-research-decision-manifest.ts" ||
    lower === "app/scripts/verification/inventory-loose-research-artifacts.ts"
  ) {
    return {
      current_classification: "reusable infrastructure",
      proposed_action: "keep active",
      replacement_blessed_path: null,
      archive_destination: null,
    };
  }

  if (
    lower.startsWith("docs/research/gates/gate55/inventory/") ||
    lower.startsWith("docs/research/gates/gate55/configs/") ||
    lower.startsWith("docs/research/gates/gate55/registry/") ||
    lower.startsWith("docs/research/gates/gate55/manifests/") ||
    lower.startsWith("docs/research/gates/gate55/receipts/")
  ) {
    return {
      current_classification: "active evidence receipt",
      proposed_action: "keep active",
      replacement_blessed_path: null,
      archive_destination: null,
    };
  }

  if (
    lower.includes("decisionmanifest") ||
    lower.includes("researchrunregistry") ||
    lower.includes("matrixdataset") ||
    lower.includes("pathbarloader") ||
    lower.includes("weeklyholdengine") ||
    lower.includes("historicalstrength") ||
    lower.includes("localm1warehouse") ||
    lower === "app/src/lib/research/hash.ts"
  ) {
    return {
      current_classification: "reusable infrastructure",
      proposed_action: "keep active",
      replacement_blessed_path: null,
      archive_destination: null,
    };
  }

  if (lower.startsWith("docs/research/gate54") || lower.startsWith("docs/research/gate55") || lower.startsWith("app/reports/data-verification/gate55/")) {
    return {
      current_classification: "active evidence receipt",
      proposed_action: "keep active",
      replacement_blessed_path: null,
      archive_destination: null,
    };
  }

  if (lower.startsWith("app/scripts/verification/") && /(audit|analyze|gate\d+|export)/.test(lower)) {
    return {
      current_classification: "historical receipt script",
      proposed_action: "leave temporarily with deprecation marker",
      replacement_blessed_path: "app/scripts/verification/evaluate-research-decision-manifest.ts for future manifest scoring",
      archive_destination: null,
    };
  }

  if (safeAdrJs) {
    return {
      current_classification: "deprecated and safe to archive",
      proposed_action: "move to root archive",
      replacement_blessed_path: "app/scripts/verification/evaluate-research-decision-manifest.ts",
      archive_destination: `archive/${options.file}`,
    };
  }

  if (options.packageCommands.length > 0 || options.docsRefs.length > 0 || options.codeRefs.length > 0) {
    return {
      current_classification: "deprecated but referenced",
      proposed_action: "leave temporarily with deprecation marker",
      replacement_blessed_path: "app/scripts/verification/evaluate-research-decision-manifest.ts where manifest scoring applies",
      archive_destination: null,
    };
  }

  return {
    current_classification: "unknown / needs review",
    proposed_action: "needs Freedom review",
    replacement_blessed_path: null,
    archive_destination: null,
  };
}

function mdEscape(value: string | null) {
  return (value ?? "-").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

async function main() {
  const files = trackedFiles();
  const packageText = await readFile("package.json", "utf8");
  const packageRows = packageCommandRows(packageText);
  const packageCommands = new Map(packageRows.map((row) => [row.command, row.script]));
  const candidateFiles = files
    .filter((file) => !file.startsWith("archive/"))
    .map(normalizeSlash)
    .map((file) => ({ file, reasons: candidateReasons(file) }))
    .filter((row) => row.reasons.length > 0)
    .sort((left, right) => left.file.localeCompare(right.file));

  const referenceFiles = files
    .filter((file) => !file.startsWith("archive/"))
    .filter((file) =>
      file === "package.json" ||
      file.startsWith("app/scripts/") ||
      file.startsWith("app/src/") ||
      file.startsWith("docs/") ||
      file.startsWith("database/") ||
      (!file.includes("/") && /\.(md|txt|json)$/i.test(file))
    )
    .filter(isTextLike)
    .filter((file) => !file.startsWith("app/reports/data-verification/gate55/"))
    .filter((file) => !file.startsWith("app/releases/"))
    .map(normalizeSlash);
  const referenceTexts = new Map<string, string>();
  for (const file of referenceFiles) {
    try {
      referenceTexts.set(file, await readFile(file, "utf8"));
    } catch {
      // Binary or transient file; skip reference matching.
    }
  }

  const rows: InventoryRow[] = [];
  for (const candidate of candidateFiles) {
    const buffer = await readFile(candidate.file);
    const keys = referenceKeys(candidate.file);
    const refs = [...referenceTexts.entries()]
      .filter(([refFile, text]) => refFile !== candidate.file && keys.some((key) => text.includes(key)))
      .map(([refFile]) => refFile)
      .sort();
    const codeRefs = refs.filter((ref) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(ref));
    const docsRefs = refs.filter((ref) => ref.startsWith("docs/") || ref.endsWith(".md") || ref.endsWith(".mdx"));
    const pkgRefs = [...packageCommands.entries()]
      .filter(([, script]) => keys.some((key) => script.includes(key)))
      .map(([command]) => command)
      .sort();
    const classification = classify({
      file: candidate.file,
      packageCommands: pkgRefs,
      docsRefs,
      codeRefs,
    });
    rows.push({
      current_path: candidate.file,
      file_hash_sha256: sha256(buffer),
      file_type: fileType(candidate.file),
      reason_matched: candidate.reasons,
      imported_by_active_code: { yes: codeRefs.length > 0, paths: codeRefs.slice(0, 20) },
      referenced_by_package_json: { yes: pkgRefs.length > 0, commands: pkgRefs },
      referenced_by_docs_receipts: { yes: docsRefs.length > 0, paths: docsRefs.slice(0, 20) },
      ...classification,
    });
  }

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.dirname(ARCHIVE_MANIFEST_PATH), { recursive: true });
  await writeFile(INVENTORY_JSONL, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  await writeFile(PACKAGE_COMMAND_JSONL, packageRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.current_classification, (counts.get(row.current_classification) ?? 0) + 1);
  const safeRows = rows.filter((row) => row.current_classification === "deprecated and safe to archive");

  const inventoryMd = [
    "# Gate 55H Loose Research Artifact Inventory",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Scope: tracked candidate loose research/test/strategy/backtest artifacts across `app/scripts/`, `app/src/`, `docs/`, `app/reports/`, `app/releases/`, `database/`, and root-level loose files.",
    "",
    "## Summary",
    "",
    `- Candidate files: ${rows.length}`,
    `- Safe archive candidates: ${safeRows.length}`,
    ...[...counts.entries()].sort().map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Safe Archive Candidates",
    "",
    "| Current path | SHA-256 | Archive destination | Replacement |",
    "|---|---|---|---|",
    ...safeRows.map((row) => `| ${row.current_path} | ${row.file_hash_sha256} | ${row.archive_destination} | ${mdEscape(row.replacement_blessed_path)} |`),
    "",
    "## File-By-File Inventory",
    "",
    "| Path | Type | Classification | Action | Package refs | Doc refs | Code refs | Archive destination |",
    "|---|---|---|---|---|---:|---:|---|",
    ...rows.map((row) => [
      row.current_path,
      row.file_type,
      row.current_classification,
      row.proposed_action,
      row.referenced_by_package_json.commands.join(", ") || "-",
      String(row.referenced_by_docs_receipts.paths.length),
      String(row.imported_by_active_code.paths.length),
      row.archive_destination ?? "-",
    ].map(mdEscape).join(" | ")).map((line) => `| ${line} |`),
    "",
    "Machine-readable inventory: `LOOSE_ARTIFACT_INVENTORY_2026-06-25.jsonl`.",
    "",
  ].join("\n");
  await writeFile(INVENTORY_MD, inventoryMd, "utf8");

  const packageMd = [
    "# Gate 55H Package Command Classification",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Forward research scoring command:",
    "",
    "```text",
    "npm run verification:research-manifest:evaluate -- --manifest=<manifest.json>",
    "```",
    "",
    "Evaluator parity status: pending Gate 55G equivalent-manifest parity. Until that receipt exists, the evaluator is a candidate shared evaluator.",
    "",
    "| Command | Classification | Proposed action | Replacement | Script |",
    "|---|---|---|---|---|",
    ...packageRows.map((row) => `| ${row.command} | ${row.classification} | ${row.proposed_action} | ${mdEscape(row.replacement_blessed_path)} | ${mdEscape(row.script)} |`),
    "",
    "Machine-readable classification: `PACKAGE_COMMAND_CLASSIFICATION_2026-06-25.jsonl`.",
    "",
  ].join("\n");
  await writeFile(PACKAGE_COMMAND_MD, packageMd, "utf8");

  const archiveMd = [
    "# Gate 55H Archive Manifest",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Archive policy: root `archive/` mirror only. No gate-local archive folders.",
    "",
    "| Old path | New archive path | SHA-256 | Reason archived | Replacement path | Historical evidence or dead code |",
    "|---|---|---|---|---|---|",
    ...safeRows.map((row) => `| ${row.current_path} | ${row.archive_destination} | ${row.file_hash_sha256} | Deprecated loose ADR JavaScript backtest with no package, docs, or code references. | ${mdEscape(row.replacement_blessed_path)} | dead code / historical loose script |`),
    "",
    "Files listed here are moved with `git mv` after inventory generation.",
    "",
  ].join("\n");
  await writeFile(ARCHIVE_MANIFEST_PATH, archiveMd, "utf8");

  console.log(`Inventory rows: ${rows.length}`);
  console.log(`Safe archive candidates: ${safeRows.length}`);
  for (const row of safeRows) {
    console.log(`SAFE_ARCHIVE ${row.current_path} -> ${row.archive_destination}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
