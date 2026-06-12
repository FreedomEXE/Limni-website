import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { appPath } from "@/lib/server/repoPaths";

type ReleaseManifest = {
  releaseLine?: string;
  displayVersion?: string;
  liveVersion?: string;
  appVersion?: string;
  preparedAt?: string;
  releasedAt?: string | null;
  baselineDocumentedAt?: string;
  baselineNote?: string;
  changes?: string[];
  versionHistory?: Array<{
    appVersion: string;
    date: string;
    type: "major" | "minor" | "patch";
    summary: string;
    file: string;
  }>;
  screenshots?: ReleaseScreenshot[];
};

type ReleaseScreenshot = {
  file: string;
  description: string;
};

type ReleaseHistoryEntry = NonNullable<ReleaseManifest["versionHistory"]>[number] & {
  body: string | null;
};

type ReleaseDoc = {
  name: string;
  title: string;
  body: string;
};

type ReleaseRecord = {
  version: string;
  manifest: ReleaseManifest | null;
  docs: ReleaseDoc[];
  versionHistory: ReleaseHistoryEntry[];
  screenshotGroups: Array<{
    name: string;
    screenshots: ReleaseScreenshot[];
  }>;
};

type DocumentsTab = "overview" | "history" | "documents" | "evidence";

type DocumentsSearchParams = Record<string, string | string[] | undefined>;

type DocumentsPageProps = {
  searchParams?: DocumentsSearchParams | Promise<DocumentsSearchParams>;
};

const DOCUMENT_TABS: Array<{ id: DocumentsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "History" },
  { id: "documents", label: "Documents" },
  { id: "evidence", label: "Evidence" },
];

const RELEASE_DOC_ORDER = [
  "README.md",
  "CHANGELOG.md",
  "EVIDENCE.md",
  "changes.md",
  "architecture.md",
  "active-systems.md",
  "strategy-execution-spec.md",
  "data-contracts.md",
  "api-surface.md",
  "ui-surfaces.md",
  "file-audit.md",
  "quarantined.md",
  "verification.md",
  "handoff.md",
  "known-issues.md",
  "open-issues.md",
];

const SCREENSHOT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.md$/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function screenshotDescriptionFromPath(file: string) {
  const name = path.basename(file, path.extname(file));
  const folder = file.split("/").at(-2);
  const title = titleFromFilename(name);
  return folder && folder !== "screenshots"
    ? `${titleFromFilename(folder)} · ${title}`
    : title;
}

function screenshotTargetId(version: string, file: string) {
  return `release-shot-${version}-${file.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function publishedVersionFor(release: ReleaseRecord) {
  return release.manifest?.liveVersion ?? release.manifest?.appVersion ?? release.version;
}

function releaseDateFor(release: ReleaseRecord) {
  return release.manifest?.releasedAt
    ?? release.manifest?.preparedAt
    ?? release.manifest?.baselineDocumentedAt
    ?? "Unreleased";
}

function releaseLineLabelFor(release: ReleaseRecord) {
  return release.manifest?.displayVersion ?? release.manifest?.releaseLine ?? publishedVersionFor(release);
}

function screenshotCountFor(release: ReleaseRecord) {
  return release.screenshotGroups.reduce((total, group) => total + group.screenshots.length, 0);
}

function compareSemverDesc(a: string, b: string) {
  const aParts = a.replace(/^v/, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const bParts = b.replace(/^v/, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
    const delta = (bParts[index] ?? 0) - (aParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveTab(value: string | undefined): DocumentsTab {
  return DOCUMENT_TABS.some((tab) => tab.id === value) ? value as DocumentsTab : "overview";
}

function documentsHref(options: {
  version: string;
  tab: DocumentsTab;
  doc?: string;
  entry?: string;
  group?: string;
}) {
  const params = new URLSearchParams({
    version: options.version,
    tab: options.tab,
  });
  if (options.doc) params.set("doc", options.doc);
  if (options.entry) params.set("entry", options.entry);
  if (options.group) params.set("group", options.group);
  return `/documents?${params.toString()}`;
}

function discoverReleaseScreenshots(releaseDir: string, manifestScreenshots: ReleaseScreenshot[] = []) {
  const screenshotsRoot = path.join(releaseDir, "screenshots");
  const byFile = new Map<string, ReleaseScreenshot>();
  for (const screenshot of manifestScreenshots) {
    byFile.set(screenshot.file.replace(/\\/g, "/"), screenshot);
  }

  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_")) continue;
        walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SCREENSHOT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const relative = path.relative(releaseDir, absolute).replace(/\\/g, "/");
      if (!byFile.has(relative)) {
        byFile.set(relative, {
          file: relative,
          description: screenshotDescriptionFromPath(relative),
        });
      }
    }
  };

  walk(screenshotsRoot);
  return [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));
}

function loadRelease(version: string): ReleaseRecord {
  const releaseDir = appPath("releases", version);
  const manifestPath = path.join(releaseDir, "manifest.json");
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as ReleaseManifest)
    : null;

  const markdownFiles = RELEASE_DOC_ORDER
    .map((name) => path.join(releaseDir, name))
    .filter((file) => existsSync(file));

  const docs = markdownFiles.map((file) => ({
    name: path.basename(file),
    title: titleFromFilename(path.basename(file)),
    body: readFileSync(file, "utf8"),
  }));

  const versionHistory = (manifest?.versionHistory ?? []).map((entry) => {
    const releasePrefix = `app/releases/${version}/`;
    const legacyReleasePrefix = `releases/${version}/`;
    const relativeFile = entry.file.startsWith(releasePrefix)
      ? entry.file.slice(releasePrefix.length)
      : entry.file.startsWith(legacyReleasePrefix)
        ? entry.file.slice(legacyReleasePrefix.length)
      : entry.file;
    const normalized = path.normalize(relativeFile);
    const bodyPath = normalized.startsWith("..")
      ? null
      : path.join(releaseDir, normalized);
    return {
      ...entry,
      body: bodyPath && existsSync(bodyPath) ? readFileSync(bodyPath, "utf8") : null,
    };
  }).sort((a, b) => {
    const dateOrder = b.date.localeCompare(a.date);
    return dateOrder !== 0 ? dateOrder : compareSemverDesc(a.appVersion, b.appVersion);
  });

  const screenshots = discoverReleaseScreenshots(releaseDir, manifest?.screenshots ?? []);
  const grouped = new Map<string, ReleaseScreenshot[]>();
  for (const screenshot of screenshots) {
    const parts = screenshot.file.split("/");
    const folder = parts.length > 2 ? parts[1]! : "screenshots";
    if (!grouped.has(folder)) grouped.set(folder, []);
    grouped.get(folder)?.push(screenshot);
  }

  return {
    version,
    manifest,
    docs,
    versionHistory,
    screenshotGroups: [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, group]) => ({ name, screenshots: group })),
  };
}

function loadReleases() {
  const releasesRoot = appPath("releases");
  return readdirSync(releasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+(?:\.\d+)*$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .map(loadRelease);
}

function MarkdownBlock({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];
  let code: string[] = [];
  let table: string[][] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-6 text-[color:var(--muted)]">
        {paragraph.join(" ")}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="space-y-2 pl-4 text-sm leading-6 text-[color:var(--muted)]">
        {list.map((item) => (
          <li key={item} className="list-disc">
            {item}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  const flushCode = () => {
    if (code.length === 0) return;
    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        className="overflow-x-auto rounded-xl border border-[var(--panel-border)] bg-[var(--background)] p-4 text-xs leading-5 text-[var(--foreground)]"
      >
        {code.join("\n")}
      </pre>,
    );
    code = [];
  };

  const flushTable = () => {
    if (table.length === 0) return;
    const [header, ...rows] = table;
    blocks.push(
      <div key={`table-${blocks.length}`} className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
        <table className="min-w-full divide-y divide-[var(--panel-border)] text-left text-sm">
          <thead className="bg-[var(--background)]">
            <tr>
              {header.map((cell, cellIndex) => (
                <th key={`${cellIndex}-${cell}`} className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--panel-border)]">
            {rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join("|")}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cellIndex}-${cell}`} className="px-3 py-2 text-[color:var(--muted)]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    table = [];
  };

  const isMarkdownTableLine = (line: string) => {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|", 1);
  };

  const parseMarkdownTableRow = (line: string) => (
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
  );

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(rawLine);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }
    if (isMarkdownTableLine(line)) {
      flushParagraph();
      flushList();
      const row = parseMarkdownTableRow(line);
      const isSeparator = row.every((cell) => /^:?-{3,}:?$/.test(cell));
      if (!isSeparator) table.push(row);
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      flushTable();
      blocks.push(
        <h1 key={`h1-${blocks.length}`} className="text-2xl font-semibold text-[var(--foreground)]">
          {line.replace(/^# /, "")}
        </h1>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushTable();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="pt-2 text-lg font-semibold text-[var(--foreground)]">
          {line.replace(/^## /, "")}
        </h2>,
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      flushTable();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="pt-1 text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {line.replace(/^### /, "")}
        </h3>,
      );
      continue;
    }
    if (/^- /.test(line)) {
      flushParagraph();
      flushTable();
      list.push(line.replace(/^- /, ""));
      continue;
    }
    flushTable();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  flushTable();
  flushCode();

  return <div className="space-y-4">{blocks}</div>;
}

function ScreenshotGrid({ version, group }: { version: string; group: ReleaseRecord["screenshotGroups"][number] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {group.screenshots.map((screenshot, index) => {
        const imageSrc = `/api/release-assets/${version}/${screenshot.file}`;
        const targetId = screenshotTargetId(version, screenshot.file);
        const previous = group.screenshots[index - 1];
        const next = group.screenshots[index + 1];
        return (
          <div key={screenshot.file}>
            <figure className="overflow-hidden rounded-md border border-[var(--panel-border)] bg-[var(--background)] shadow-sm">
              <a href={`#${targetId}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                <Image
                  src={imageSrc}
                  alt={screenshot.description}
                  width={960}
                  height={540}
                  unoptimized
                  loading="lazy"
                  className="aspect-video w-full object-cover transition duration-200 hover:scale-[1.01]"
                />
              </a>
              <figcaption className="border-t border-[var(--panel-border)] p-3 text-xs leading-5 text-[color:var(--muted)]">
                {screenshot.description}
              </figcaption>
            </figure>
            <div
              id={targetId}
              className="release-lightbox fixed inset-0 z-[120] items-center justify-center bg-black/85 px-6 py-8"
              role="dialog"
              aria-modal="true"
              aria-label={screenshot.description}
            >
              <a
                href={documentsHref({ version, tab: "evidence", group: group.name })}
                aria-label="Close screenshot"
                className="absolute right-5 top-5 rounded-full border border-white/25 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-black"
              >
                Close
              </a>
              {previous ? (
                <a
                  href={`#${screenshotTargetId(version, previous.file)}`}
                  aria-label="Previous screenshot"
                  className="absolute left-5 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/60 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
                >
                  Prev
                </a>
              ) : null}
              {next ? (
                <a
                  href={`#${screenshotTargetId(version, next.file)}`}
                  aria-label="Next screenshot"
                  className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/60 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
                >
                  Next
                </a>
              ) : null}
              <figure className="flex h-full max-h-full w-full max-w-6xl flex-col gap-4">
                <div className="min-h-0 flex-1">
                  <Image
                    src={imageSrc}
                    alt={screenshot.description}
                    width={1600}
                    height={1000}
                    unoptimized
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <figcaption className="mx-auto max-w-4xl rounded-md bg-black/65 px-4 py-3 text-center text-sm leading-6 text-white">
                  {screenshot.description}
                </figcaption>
              </figure>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VersionRail({
  releases,
  activeVersion,
  activeTab,
}: {
  releases: ReleaseRecord[];
  activeVersion: string;
  activeTab: DocumentsTab;
}) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Versions">
      {releases.map((release) => {
        const active = release.version === activeVersion;
        return (
          <Link
            key={release.version}
            href={documentsHref({ version: release.version, tab: active ? activeTab : "overview" })}
            prefetch
            className={`rounded-md border px-4 py-3 text-sm font-semibold transition ${
              active
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)] hover:border-[var(--accent)]/35 hover:text-[var(--foreground)]"
            }`}
          >
            <span className="block text-xs uppercase tracking-[0.16em]">{releaseLineLabelFor(release)}</span>
            <span className="mt-1 block text-[11px]">{publishedVersionFor(release)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function TabNav({ release, activeTab }: { release: ReleaseRecord; activeTab: DocumentsTab }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--panel-border)] px-4 pt-3" aria-label="Document sections">
      {DOCUMENT_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={documentsHref({ version: release.version, tab: tab.id })}
          prefetch
          className={`rounded-t-md border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
            activeTab === tab.id
              ? "border-[var(--panel-border)] bg-[var(--background)] text-[var(--foreground)]"
              : "border-transparent text-[color:var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function OverviewPanel({ release }: { release: ReleaseRecord }) {
  const changes = release.versionHistory.length > 0
    ? release.versionHistory.map((entry) => `${entry.appVersion}: ${entry.summary}`)
    : release.manifest?.changes ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <dl className="grid shrink-0 gap-3 md:grid-cols-4">
        {[
          ["Version", publishedVersionFor(release)],
          ["Date", releaseDateFor(release)],
          ["Docs", String(release.docs.length)],
          ["Evidence", String(screenshotCountFor(release))],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-3">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</dd>
          </div>
        ))}
      </dl>

      {release.manifest?.baselineNote ? (
        <div className="shrink-0 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-sm leading-6 text-[color:var(--muted)]">
          {release.manifest.baselineNote}
        </div>
      ) : null}

      {changes.length > 0 ? (
        <section className="version-popover-scroll min-h-0 flex-1 overflow-y-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-4 pr-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Changelog</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
            {changes.map((change) => (
              <li key={change} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function HistoryPanel({ release, selectedEntry }: { release: ReleaseRecord; selectedEntry?: string }) {
  if (release.versionHistory.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No version history recorded.</p>;
  }
  const activeEntry = release.versionHistory.find((entry) => entry.appVersion === selectedEntry) ?? release.versionHistory[0]!;

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[18rem_1fr]">
      <nav className="version-popover-scroll min-h-0 space-y-2 overflow-y-auto pr-1" aria-label="Version history entries">
        {release.versionHistory.map((entry) => (
          <Link
            key={entry.appVersion}
            href={documentsHref({ version: release.version, tab: "history", entry: entry.appVersion })}
            prefetch
            className={`block rounded-md border px-3 py-2 text-sm transition ${
              activeEntry.appVersion === entry.appVersion
                ? "border-[var(--accent)]/45 bg-[var(--accent)]/10 text-[var(--foreground)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="block font-semibold">{entry.appVersion}</span>
            <span className="mt-1 block text-xs">{entry.date} · {entry.type}</span>
          </Link>
        ))}
      </nav>
      <article className="version-popover-scroll min-h-0 overflow-y-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-5 pr-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{activeEntry.summary}</h2>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">
          {activeEntry.appVersion} · {activeEntry.date}
        </p>
        <div className="mt-4">
          {activeEntry.body ? <MarkdownBlock body={activeEntry.body} /> : (
            <p className="text-sm text-[color:var(--muted)]">Version note file not found: {activeEntry.file}</p>
          )}
        </div>
      </article>
    </div>
  );
}

function DocumentsPanel({ release, selectedDoc }: { release: ReleaseRecord; selectedDoc?: string }) {
  if (release.docs.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No documents recorded.</p>;
  }
  const activeDoc = release.docs.find((doc) => doc.name === selectedDoc) ?? release.docs[0]!;

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[18rem_1fr]">
      <nav className="version-popover-scroll min-h-0 space-y-2 overflow-y-auto pr-1" aria-label="Release documents">
        {release.docs.map((doc) => (
          <Link
            key={doc.name}
            href={documentsHref({ version: release.version, tab: "documents", doc: doc.name })}
            prefetch
            className={`block rounded-md border px-3 py-2 text-sm font-semibold transition ${
              activeDoc.name === doc.name
                ? "border-[var(--accent)]/45 bg-[var(--accent)]/10 text-[var(--foreground)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {doc.title}
          </Link>
        ))}
      </nav>
      <article className="version-popover-scroll min-h-0 overflow-y-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-5 pr-6">
        <MarkdownBlock body={activeDoc.body} />
      </article>
    </div>
  );
}

function EvidencePanel({ release, selectedGroup }: { release: ReleaseRecord; selectedGroup?: string }) {
  if (release.screenshotGroups.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No screenshots recorded.</p>;
  }
  const activeGroup = release.screenshotGroups.find((group) => group.name === selectedGroup) ?? release.screenshotGroups[0]!;

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[18rem_1fr]">
      <nav className="version-popover-scroll min-h-0 space-y-2 overflow-y-auto pr-1" aria-label="Screenshot groups">
        {release.screenshotGroups.map((group) => (
          <Link
            key={group.name}
            href={documentsHref({ version: release.version, tab: "evidence", group: group.name })}
            prefetch
            className={`block rounded-md border px-3 py-2 text-sm transition ${
              activeGroup.name === group.name
                ? "border-[var(--accent)]/45 bg-[var(--accent)]/10 text-[var(--foreground)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="block font-semibold">{titleFromFilename(group.name)}</span>
            <span className="mt-1 block text-xs">{group.screenshots.length} screenshots</span>
          </Link>
        ))}
      </nav>
      <div className="version-popover-scroll min-h-0 overflow-y-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-5 pr-6">
        <ScreenshotGrid version={release.version} group={activeGroup} />
      </div>
    </div>
  );
}

function ActiveTabPanel({
  release,
  activeTab,
  params,
}: {
  release: ReleaseRecord;
  activeTab: DocumentsTab;
  params: DocumentsSearchParams;
}) {
  if (activeTab === "history") {
    return <HistoryPanel release={release} selectedEntry={firstParam(params.entry)} />;
  }
  if (activeTab === "documents") {
    return <DocumentsPanel release={release} selectedDoc={firstParam(params.doc)} />;
  }
  if (activeTab === "evidence") {
    return <EvidencePanel release={release} selectedGroup={firstParam(params.group)} />;
  }
  return <OverviewPanel release={release} />;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const releases = loadReleases();
  if (releases.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex h-[calc(100vh-5.5rem)] min-h-[34rem] items-center justify-center overflow-hidden">
          <p className="text-sm text-[color:var(--muted)]">No release documents found.</p>
        </div>
      </DashboardLayout>
    );
  }

  const params = (await Promise.resolve(searchParams)) ?? {};
  const requestedVersion = firstParam(params.version);
  const activeRelease = releases.find((release) => release.version === requestedVersion) ?? releases[0]!;
  const activeTab = resolveTab(firstParam(params.tab));

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-5.5rem)] min-h-[34rem] flex-col gap-4 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">Documents</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              {releaseLineLabelFor(activeRelease)} · {publishedVersionFor(activeRelease)}
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[12rem_1fr]">
          <VersionRail releases={releases} activeVersion={activeRelease.version} activeTab={activeTab} />
          <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-[var(--panel-border)] bg-[var(--background)]">
            <TabNav release={activeRelease} activeTab={activeTab} />
            <div className="min-h-0 flex-1 overflow-hidden p-4">
              <ActiveTabPanel release={activeRelease} activeTab={activeTab} params={params} />
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
