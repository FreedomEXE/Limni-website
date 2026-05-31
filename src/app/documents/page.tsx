import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import Image from "next/image";
import type { ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import CollapsibleSection from "@/components/accounts/CollapsibleSection";

type ReleaseManifest = {
  appVersion: string;
  semanticVersion?: string;
  releasedAt?: string;
  baselineDocumentedAt?: string;
  baselineNote?: string;
  changes?: string[];
  screenshots?: Array<{
    file: string;
    description: string;
  }>;
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
  screenshotGroups: Array<{
    name: string;
    screenshots: NonNullable<ReleaseManifest["screenshots"]>;
  }>;
};

const RELEASE_DOC_ORDER = [
  "README.md",
  "changes.md",
  "architecture.md",
  "active-systems.md",
  "data-contracts.md",
  "api-surface.md",
  "ui-surfaces.md",
  "file-audit.md",
  "quarantined.md",
  "verification.md",
  "known-issues.md",
];

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.md$/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function loadRelease(version: string): ReleaseRecord {
  const releaseDir = path.join(process.cwd(), "releases", version);
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

  const screenshots = manifest?.screenshots ?? [];
  const grouped = new Map<string, NonNullable<ReleaseManifest["screenshots"]>>();
  for (const screenshot of screenshots) {
    const parts = screenshot.file.split("/");
    const folder = parts[1] ?? "screenshots";
    if (!grouped.has(folder)) grouped.set(folder, []);
    grouped.get(folder)?.push(screenshot);
  }

  return {
    version,
    manifest,
    docs,
    screenshotGroups: [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, group]) => ({ name, screenshots: group })),
  };
}

function loadReleases() {
  const releasesRoot = path.join(process.cwd(), "releases");
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

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
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
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
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
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="pt-1 text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {line.replace(/^### /, "")}
        </h3>,
      );
      continue;
    }
    if (/^- /.test(line)) {
      flushParagraph();
      list.push(line.replace(/^- /, ""));
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  flushCode();

  return <div className="space-y-4">{blocks}</div>;
}

function ScreenshotGrid({ version, group }: { version: string; group: ReleaseRecord["screenshotGroups"][number] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {group.screenshots.map((screenshot) => (
        <figure
          key={screenshot.file}
          className="overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--background)] shadow-sm"
        >
          <Image
            src={`/api/release-assets/${version}/${screenshot.file}`}
            alt={screenshot.description}
            width={960}
            height={540}
            unoptimized
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <figcaption className="border-t border-[var(--panel-border)] p-3 text-xs leading-5 text-[color:var(--muted)]">
            {screenshot.description}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const releases = loadReleases();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Limni Labs
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Documents
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
            Release manifests, architecture snapshots, visual baselines, and version history.
            User-facing screenshots are rendered from each release&apos;s screenshot archive;
            migration audit trails stay separate.
          </p>
        </header>

        <div className="space-y-5">
          {releases.map((release, index) => {
            const versionLabel = release.manifest?.appVersion ?? release.version;
            const releaseDate = release.manifest?.releasedAt ?? release.manifest?.baselineDocumentedAt ?? "Unreleased";
            const screenshotCount = release.manifest?.screenshots?.length ?? 0;
            return (
              <CollapsibleSection
                key={release.version}
                title={`${versionLabel} Release`}
                subtitle={`${releaseDate} · ${release.docs.length} docs · ${screenshotCount} screenshots`}
                badge={release.manifest?.semanticVersion ?? release.version}
                defaultOpen={index === 0}
              >
                <div className="space-y-8">
                  {release.manifest?.baselineNote ? (
                    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--background)] p-4 text-sm leading-6 text-[color:var(--muted)]">
                      {release.manifest.baselineNote}
                    </div>
                  ) : null}

                  {release.manifest?.changes && release.manifest.changes.length > 0 ? (
                    <section className="rounded-xl border border-[var(--panel-border)] bg-[var(--background)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Changes
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                        {release.manifest.changes.map((change) => (
                          <li key={change} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <div className="space-y-4">
                    {release.docs.map((doc) => (
                      <CollapsibleSection
                        key={doc.name}
                        title={doc.title}
                        subtitle={doc.name}
                        defaultOpen={doc.name === "README.md"}
                      >
                        <MarkdownBlock body={doc.body} />
                      </CollapsibleSection>
                    ))}
                  </div>

                  {release.screenshotGroups.length > 0 ? (
                    <section className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Visual Baseline
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          Screenshots from <span className="font-semibold text-[var(--foreground)]">releases/{release.version}/screenshots</span>.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {release.screenshotGroups.map((group) => (
                          <CollapsibleSection
                            key={group.name}
                            title={titleFromFilename(group.name)}
                            subtitle={`${group.screenshots.length} screenshots`}
                            badge={group.screenshots.length}
                            defaultOpen={group.name === "performance"}
                          >
                            <ScreenshotGrid version={release.version} group={group} />
                          </CollapsibleSection>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
