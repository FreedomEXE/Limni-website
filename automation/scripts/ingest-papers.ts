import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const REPO_ROOT = process.cwd();
const DEFAULT_ROOT = "docs/research/papers";
const SOURCES_HEADER = ["id", "title", "authors", "year", "doi", "arxiv", "url", "source_type", "notes"];
const MANIFEST_HEADER = [
  "id",
  "title",
  "doi",
  "arxiv",
  "url",
  "pdf_path",
  "sha256",
  "bytes",
  "status",
  "license",
  "source_provider",
  "downloaded_at",
  "failure_reason",
  "text_path",
  "extraction_status",
  "extraction_failure_reason",
];
const MIN_PDF_BYTES = 10_000;
const USER_AGENT =
  "LimniPoseidonPaperIngest/1.0 (+https://github.com/FreedomEXE/Limni-website; legal OA PDF discovery)";

type SourceRow = {
  id: string;
  title: string;
  authors: string;
  year: string;
  doi: string;
  arxiv: string;
  url: string;
  source_type: string;
  notes: string;
};

type ManifestRow = {
  id: string;
  title: string;
  doi: string;
  arxiv: string;
  url: string;
  pdf_path: string;
  sha256: string;
  bytes: string;
  status: string;
  license: string;
  source_provider: string;
  downloaded_at: string;
  failure_reason: string;
  text_path: string;
  extraction_status: string;
  extraction_failure_reason: string;
};

type PdfCandidate = {
  url: string;
  provider: string;
  license?: string;
};

type JsonObject = Record<string, unknown>;

type Options = {
  root: string;
  sourcesPath: string;
  dryRun: boolean;
  skipExisting: boolean;
  limit: number | null;
  unpaywallEmail: string;
  help: boolean;
};

function parseArgs(argv: string[]): Options {
  const root = valueArg(argv, "--root") ?? DEFAULT_ROOT;
  return {
    root,
    sourcesPath: valueArg(argv, "--sources") ?? path.join(root, "sources.csv"),
    dryRun: argv.includes("--dry-run"),
    skipExisting: !argv.includes("--no-skip-existing"),
    limit: numberArg(argv, "--limit"),
    unpaywallEmail: valueArg(argv, "--unpaywall-email") ?? process.env.UNPAYWALL_EMAIL ?? "",
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function valueArg(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(name);
  if (index >= 0 && index + 1 < argv.length) return argv[index + 1];
  return null;
}

function numberArg(argv: string[], name: string): number | null {
  const raw = valueArg(argv, name);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

function usage(): string {
  return [
    "Usage: npm run research:papers:ingest -- [options]",
    "",
    "Options:",
    "  --sources=<path>            CSV source ledger. Default: docs/research/papers/sources.csv",
    "  --root=<path>               Paper workspace root. Default: docs/research/papers",
    "  --limit=<n>                 Process only the first n source rows.",
    "  --dry-run                   Resolve candidates and write manifests without downloading PDFs.",
    "  --no-skip-existing          Re-download even when pdf/{id}.pdf already exists.",
    "  --unpaywall-email=<email>   Email required by Unpaywall. Or set UNPAYWALL_EMAIL.",
    "",
    "Statuses:",
    "  DOWNLOADED, EXISTS, DRY_RUN, NO_LEGAL_PDF_FOUND, WEB_SOURCE, INVALID_PDF, DOWNLOAD_FAILED, SOURCE_ERROR",
  ].join("\n");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const paths = paperPaths(options.root);
  await ensureWorkspace(paths);

  const sources = await readSources(options.sourcesPath);
  const existingManifest = await readManifest(paths.manifestCsv);
  const existingById = new Map(existingManifest.map((row) => [row.id, row]));
  const sourcesToProcess = options.limit === null ? sources : sources.slice(0, options.limit);
  const processIds = new Set(sourcesToProcess.map((source) => source.id));
  const rows: ManifestRow[] = [];

  for (const source of sources) {
    if (!processIds.has(source.id)) {
      rows.push(existingById.get(source.id) ?? pendingRow(source));
      continue;
    }
    rows.push(await processSource(source, paths, options, existingById.get(source.id)));
  }

  await writeManifest(paths.manifestCsv, paths.manifestJson, rows);
  console.log(
    `paper ingest complete: sources=${sources.length} processed=${sourcesToProcess.length} manifest=${toRepoRelative(
      paths.manifestCsv,
    )}`,
  );
}

function paperPaths(root: string) {
  const absoluteRoot = path.resolve(REPO_ROOT, root);
  return {
    root: absoluteRoot,
    sources: path.resolve(REPO_ROOT, root, "sources.csv"),
    pdfDir: path.resolve(REPO_ROOT, root, "pdf"),
    textDir: path.resolve(REPO_ROOT, root, "text"),
    manifestCsv: path.resolve(REPO_ROOT, root, "papers_manifest.csv"),
    manifestJson: path.resolve(REPO_ROOT, root, "papers_manifest.json"),
  };
}

async function ensureWorkspace(paths: ReturnType<typeof paperPaths>): Promise<void> {
  await mkdir(paths.pdfDir, { recursive: true });
  await mkdir(paths.textDir, { recursive: true });
  if (!existsSync(paths.sources)) {
    await writeCsv(paths.sources, [SOURCES_HEADER], []);
  }
  if (!existsSync(paths.manifestCsv)) {
    await writeCsv(paths.manifestCsv, [MANIFEST_HEADER], []);
  }
  if (!existsSync(paths.manifestJson)) {
    await writeFile(paths.manifestJson, "[]\n", "utf8");
  }
}

async function processSource(
  source: SourceRow,
  paths: ReturnType<typeof paperPaths>,
  options: Options,
  existing: ManifestRow | undefined,
): Promise<ManifestRow> {
  validateSource(source);
  const pdfPath = path.join(paths.pdfDir, `${safeFileName(source.id)}.pdf`);
  const textPath = path.join(paths.textDir, `${safeFileName(source.id)}.txt`);
  const repoPdfPath = toRepoRelative(pdfPath);
  const repoTextPath = toRepoRelative(textPath);

  if (options.skipExisting && existsSync(pdfPath)) {
    const pdf = await inspectPdf(pdfPath);
    const extraction = await extractText(pdfPath, textPath);
    return {
      ...baseRow(source),
      pdf_path: repoPdfPath,
      sha256: pdf.sha256,
      bytes: String(pdf.bytes),
      status: "EXISTS",
      license: existing?.license ?? "",
      source_provider: existing?.source_provider ?? "local",
      downloaded_at: existing?.downloaded_at ?? "",
      failure_reason: "",
      text_path: extraction.ok ? repoTextPath : "",
      extraction_status: extraction.status,
      extraction_failure_reason: extraction.failureReason,
    };
  }

  try {
    const candidates = await resolvePdfCandidates(source, options);
    if (options.dryRun) {
      const candidate = candidates[0];
      return {
        ...baseRow(source),
        pdf_path: "",
        sha256: "",
        bytes: "",
        status: candidate ? "DRY_RUN" : sourceLooksLikeWebpageOnly(source) ? "WEB_SOURCE" : "NO_LEGAL_PDF_FOUND",
        license: candidate?.license ?? "",
        source_provider: candidate?.provider ?? "",
        downloaded_at: "",
        failure_reason: candidate ? "" : failureForNoCandidate(source, options),
        text_path: "",
        extraction_status: "NOT_RUN_DRY_RUN",
        extraction_failure_reason: "",
      };
    }

    if (candidates.length === 0) {
      return {
        ...baseRow(source),
        pdf_path: "",
        sha256: "",
        bytes: "",
        status: sourceLooksLikeWebpageOnly(source) ? "WEB_SOURCE" : "NO_LEGAL_PDF_FOUND",
        license: "",
        source_provider: "",
        downloaded_at: "",
        failure_reason: failureForNoCandidate(source, options),
        text_path: "",
        extraction_status: "NOT_RUN_NO_PDF",
        extraction_failure_reason: "",
      };
    }

    const failures: string[] = [];
    for (const candidate of candidates) {
      try {
        const downloaded = await downloadPdf(candidate, pdfPath);
        const extraction = await extractText(pdfPath, textPath);
        return {
          ...baseRow(source),
          pdf_path: repoPdfPath,
          sha256: downloaded.sha256,
          bytes: String(downloaded.bytes),
          status: "DOWNLOADED",
          license: candidate.license ?? "",
          source_provider: candidate.provider,
          downloaded_at: new Date().toISOString(),
          failure_reason: "",
          text_path: extraction.ok ? repoTextPath : "",
          extraction_status: extraction.status,
          extraction_failure_reason: extraction.failureReason,
        };
      } catch (error) {
        failures.push(`${candidate.provider}: ${errorMessage(error)}`);
      }
    }

    return {
      ...baseRow(source),
      pdf_path: "",
      sha256: "",
      bytes: "",
      status: "DOWNLOAD_FAILED",
      license: "",
      source_provider: candidates.map((candidate) => candidate.provider).join(";"),
      downloaded_at: "",
      failure_reason: failures.join(" | "),
      text_path: "",
      extraction_status: "NOT_RUN_DOWNLOAD_FAILED",
      extraction_failure_reason: "",
    };
  } catch (error) {
    return {
      ...baseRow(source),
      pdf_path: "",
      sha256: "",
      bytes: "",
      status: "SOURCE_ERROR",
      license: "",
      source_provider: "",
      downloaded_at: "",
      failure_reason: errorMessage(error),
      text_path: "",
      extraction_status: "NOT_RUN_SOURCE_ERROR",
      extraction_failure_reason: "",
    };
  }
}

function validateSource(source: SourceRow): void {
  if (!source.id) throw new Error("source id is required");
  if (!/^[a-zA-Z0-9._-]+$/.test(source.id)) {
    throw new Error(`source id must use only letters, numbers, dot, underscore, or dash: ${source.id}`);
  }
}

function pendingRow(source: SourceRow): ManifestRow {
  return {
    ...baseRow(source),
    pdf_path: "",
    sha256: "",
    bytes: "",
    status: "PENDING",
    license: "",
    source_provider: "",
    downloaded_at: "",
    failure_reason: "",
    text_path: "",
    extraction_status: "NOT_RUN",
    extraction_failure_reason: "",
  };
}

function baseRow(source: SourceRow): Pick<ManifestRow, "id" | "title" | "doi" | "arxiv" | "url"> {
  return {
    id: source.id,
    title: source.title,
    doi: cleanDoi(source.doi),
    arxiv: cleanArxivId(source.arxiv),
    url: source.url,
  };
}

async function resolvePdfCandidates(source: SourceRow, options: Options): Promise<PdfCandidate[]> {
  const candidates: PdfCandidate[] = [];
  const seen = new Set<string>();
  const add = (candidate: PdfCandidate | null | undefined) => {
    if (!candidate?.url) return;
    if (isBannedUrl(candidate.url)) return;
    const key = candidate.url.trim();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ ...candidate, url: key });
  };

  const arxivId = cleanArxivId(source.arxiv) || arxivIdFromUrl(source.url);
  if (arxivId) add({ url: `https://arxiv.org/pdf/${arxivId}.pdf`, provider: "arxiv" });

  if (looksLikePdfUrl(source.url)) add({ url: source.url, provider: "direct_pdf" });

  const doi = cleanDoi(source.doi) || doiFromUrl(source.url);
  if (doi) {
    for (const candidate of await unpaywallCandidates(doi, options.unpaywallEmail)) add(candidate);
    for (const candidate of await openAlexCandidates(doi)) add(candidate);
  }

  if (source.url && !looksLikePdfUrl(source.url) && !arxivIdFromUrl(source.url) && !doiFromUrl(source.url)) {
    for (const candidate of await htmlPdfLinkCandidates(source.url)) add(candidate);
  }

  return candidates;
}

async function unpaywallCandidates(doi: string, email: string): Promise<PdfCandidate[]> {
  if (!email) return [];
  const endpoint = `https://api.unpaywall.org/v2/${doi}?email=${encodeURIComponent(email)}`;
  const response = await fetchJson(endpoint);
  const candidates: PdfCandidate[] = [];
  const best = asRecord(response?.best_oa_location);
  if (best?.url_for_pdf) {
    candidates.push({ url: String(best.url_for_pdf), provider: "unpaywall_best_oa", license: stringOrEmpty(best.license) });
  }
  for (const location of arrayOfRecords(response?.oa_locations)) {
    if (location?.url_for_pdf) {
      candidates.push({
        url: String(location.url_for_pdf),
        provider: "unpaywall_oa_location",
        license: stringOrEmpty(location.license),
      });
    }
  }
  return candidates;
}

async function openAlexCandidates(doi: string): Promise<PdfCandidate[]> {
  const endpoint = `https://api.openalex.org/works/${encodeURIComponent(`https://doi.org/${doi}`)}`;
  const response = await fetchJson(endpoint);
  const candidates: PdfCandidate[] = [];
  const addLocation = (location: unknown, provider: string) => {
    const value = location as { pdf_url?: unknown; license?: unknown; landing_page_url?: unknown } | null;
    if (value?.pdf_url) {
      candidates.push({
        url: String(value.pdf_url),
        provider,
        license: stringOrEmpty(value.license),
      });
    } else if (typeof value?.landing_page_url === "string" && looksLikePdfUrl(value.landing_page_url)) {
      candidates.push({
        url: value.landing_page_url,
        provider,
        license: stringOrEmpty(value.license),
      });
    }
  };
  addLocation(response?.primary_location, "openalex_primary_location");
  addLocation(response?.best_oa_location, "openalex_best_oa_location");
  for (const location of arrayOfRecords(response?.locations)) {
    addLocation(location, "openalex_location");
  }
  const openAccess = asRecord(response?.open_access);
  if (typeof openAccess?.oa_url === "string" && looksLikePdfUrl(openAccess.oa_url)) {
    candidates.push({ url: openAccess.oa_url, provider: "openalex_oa_url" });
  }
  return candidates;
}

async function htmlPdfLinkCandidates(url: string): Promise<PdfCandidate[]> {
  if (!isHttpUrl(url) || isBannedUrl(url)) return [];
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) return [];
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    return [{ url, provider: "direct_pdf_content_type" }];
  }
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return [];
  const html = await response.text();
  const matches = [...html.matchAll(/href=["']([^"']+?\.pdf(?:\?[^"']*)?)["']/gi)];
  return matches
    .map((match) => {
      try {
        return new URL(match[1], url).toString();
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .slice(0, 12)
    .map((pdfUrl) => ({ url: pdfUrl, provider: "html_pdf_link" }));
}

async function downloadPdf(candidate: PdfCandidate, finalPath: string): Promise<{ sha256: string; bytes: number }> {
  const tmpPath = `${finalPath}.tmp`;
  await rm(tmpPath, { force: true });
  const response = await fetch(candidate.url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/pdf,application/octet-stream,*/*;q=0.5",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  validatePdfBytes(bytes);
  await writeFile(tmpPath, bytes);
  const inspected = await inspectPdf(tmpPath);
  await mkdir(path.dirname(finalPath), { recursive: true });
  await rename(tmpPath, finalPath);
  return inspected;
}

function validatePdfBytes(bytes: Buffer): void {
  if (bytes.length < MIN_PDF_BYTES) throw new Error(`PDF too small (${bytes.length} bytes)`);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("missing PDF magic bytes");
}

async function inspectPdf(pdfPath: string): Promise<{ sha256: string; bytes: number }> {
  const bytes = await readFile(pdfPath);
  validatePdfBytes(bytes);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    bytes: (await stat(pdfPath)).size,
  };
}

async function extractText(pdfPath: string, textPath: string): Promise<{ ok: boolean; status: string; failureReason: string }> {
  const pdftotext = await findExecutable("pdftotext");
  if (!pdftotext) {
    return { ok: false, status: "EXTRACTOR_NOT_FOUND", failureReason: "Install poppler pdftotext and rerun ingestion." };
  }
  await mkdir(path.dirname(textPath), { recursive: true });
  const result = await run(pdftotext, ["-layout", pdfPath, textPath]);
  if (result.code !== 0) {
    await rm(textPath, { force: true });
    return { ok: false, status: "EXTRACTION_FAILED", failureReason: result.stderr || result.stdout || `exit ${result.code}` };
  }
  const textSize = existsSync(textPath) ? (await stat(textPath)).size : 0;
  if (textSize <= 0) return { ok: false, status: "EXTRACTION_EMPTY", failureReason: "pdftotext wrote an empty sidecar." };
  return { ok: true, status: "EXTRACTED", failureReason: "" };
}

async function findExecutable(name: string): Promise<string | null> {
  const command = process.platform === "win32" ? "where.exe" : "which";
  const result = await run(command, [name]);
  if (result.code !== 0) return null;
  const first = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return first ?? null;
}

function run(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => resolve({ code: 1, stdout: "", stderr: error.message }));
    child.on("close", (code) =>
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
      }),
    );
  });
}

async function fetchJson(url: string): Promise<JsonObject | null> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
    },
  });
  if (!response.ok) return null;
  return asRecord(await response.json());
}

function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function arrayOfRecords(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is JsonObject => item !== null) : [];
}

async function readSources(filePath: string): Promise<SourceRow[]> {
  const content = existsSync(filePath) ? await readFile(filePath, "utf8") : SOURCES_HEADER.join(",") + "\n";
  const { header, rows } = parseCsv(content);
  assertHeader(filePath, header, SOURCES_HEADER);
  return rows.map((row) => ({
    id: row.id ?? "",
    title: row.title ?? "",
    authors: row.authors ?? "",
    year: row.year ?? "",
    doi: row.doi ?? "",
    arxiv: row.arxiv ?? "",
    url: row.url ?? "",
    source_type: row.source_type ?? "",
    notes: row.notes ?? "",
  }));
}

async function readManifest(filePath: string): Promise<ManifestRow[]> {
  if (!existsSync(filePath)) return [];
  const { header, rows } = parseCsv(await readFile(filePath, "utf8"));
  if (header.length === 0) return [];
  assertHeader(filePath, header, MANIFEST_HEADER);
  return rows.map((row) => ({
    id: row.id ?? "",
    title: row.title ?? "",
    doi: row.doi ?? "",
    arxiv: row.arxiv ?? "",
    url: row.url ?? "",
    pdf_path: row.pdf_path ?? "",
    sha256: row.sha256 ?? "",
    bytes: row.bytes ?? "",
    status: row.status ?? "",
    license: row.license ?? "",
    source_provider: row.source_provider ?? "",
    downloaded_at: row.downloaded_at ?? "",
    failure_reason: row.failure_reason ?? "",
    text_path: row.text_path ?? "",
    extraction_status: row.extraction_status ?? "",
    extraction_failure_reason: row.extraction_failure_reason ?? "",
  }));
}

async function writeManifest(csvPath: string, jsonPath: string, rows: ManifestRow[]): Promise<void> {
  await writeCsv(csvPath, [MANIFEST_HEADER], rows.map((row) => MANIFEST_HEADER.map((field) => row[field as keyof ManifestRow])));
  await writeFile(jsonPath, JSON.stringify(rows, null, 2) + "\n", "utf8");
}

async function writeCsv(filePath: string, headerRows: string[][], rows: string[][]): Promise<void> {
  const rendered = [...headerRows, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, rendered, "utf8");
}

function parseCsv(content: string): { header: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((row) => row.some((cell) => cell.trim().length > 0));
  const header = nonEmpty[0] ?? [];
  const rows = nonEmpty.slice(1).map((row) => Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""])));
  return { header, rows };
}

function assertHeader(filePath: string, actual: string[], expected: string[]): void {
  const actualText = actual.join(",");
  const expectedText = expected.join(",");
  if (actualText !== expectedText) {
    throw new Error(`${toRepoRelative(filePath)} header mismatch. Expected: ${expectedText}`);
  }
}

function csvCell(value: string): string {
  const text = value ?? "";
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function cleanDoi(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
}

function cleanArxivId(raw: string): string {
  return raw
    .trim()
    .replace(/^arxiv:\s*/i, "")
    .replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, "")
    .replace(/\.pdf$/i, "")
    .trim();
}

function doiFromUrl(raw: string): string {
  const match = raw.match(/(?:doi\.org\/|doi:)(10\.\d{4,9}\/[^\s?#]+)/i);
  return match ? cleanDoi(match[1]) : "";
}

function arxivIdFromUrl(raw: string): string {
  const match = raw.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?|[a-z.-]+\/[0-9]{7})(?:\.pdf)?/i);
  return match ? cleanArxivId(match[1]) : "";
}

function looksLikePdfUrl(raw: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(raw.trim());
}

function isHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim());
}

function isBannedUrl(raw: string): boolean {
  try {
    const hostname = new URL(raw).hostname.toLowerCase();
    return hostname.includes("sci-hub") || hostname.includes("libgen") || hostname.includes("z-lib");
  } catch {
    return false;
  }
}

function sourceLooksLikeWebpageOnly(source: SourceRow): boolean {
  return Boolean(source.url && !source.doi && !source.arxiv && !looksLikePdfUrl(source.url) && !arxivIdFromUrl(source.url));
}

function failureForNoCandidate(source: SourceRow, options: Options): string {
  if (source.doi && !options.unpaywallEmail) {
    return "No legal PDF candidate found. Unpaywall was skipped because UNPAYWALL_EMAIL/--unpaywall-email is not set.";
  }
  if (sourceLooksLikeWebpageOnly(source)) {
    return "Source URL appears to be a webpage and no direct legal PDF link was found.";
  }
  return "No legal PDF candidate found from arXiv, direct PDF URL, Unpaywall, OpenAlex, or source-page PDF links.";
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toRepoRelative(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).replaceAll(path.sep, "/");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
