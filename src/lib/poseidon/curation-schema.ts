/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: curation-schema.ts
 *
 * Description:
 * Validation and archive-build helpers for Poseidon curation responses.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { createHash } from "node:crypto";

export type ArchiveEntry = {
  date: string;
  title: string;
  summary: string;
  content: string;
};

export type CurationResponse = {
  active_state: string;
  archive_entries: ArchiveEntry[];
  archive_summary: string;
  curation_notes: string;
};

const ENTRY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function entryFingerprint(entry: ArchiveEntry): string {
  return createHash("sha256")
    .update(`${entry.date}|${entry.title}|${entry.summary}|${entry.content}`)
    .digest("hex")
    .slice(0, 16);
}

export function validateCurationResponse(raw: unknown): CurationResponse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Curation response is not an object");
  }

  const obj = raw as Record<string, unknown>;
  const required = ["active_state", "archive_entries", "archive_summary", "curation_notes"];
  for (const key of required) {
    if (!(key in obj)) {
      throw new Error(`Missing required key: ${key}`);
    }
  }

  if (typeof obj.active_state !== "string" || !obj.active_state.trim()) {
    throw new Error("Missing/empty active_state");
  }
  if (!Array.isArray(obj.archive_entries)) {
    throw new Error("archive_entries must be an array");
  }
  if (typeof obj.archive_summary !== "string") {
    throw new Error("archive_summary must be a string");
  }
  if (typeof obj.curation_notes !== "string") {
    throw new Error("curation_notes must be a string");
  }

  const archiveEntries: ArchiveEntry[] = obj.archive_entries.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Invalid archive entry object");
    }

    const row = entry as Record<string, unknown>;
    const requiredEntryKeys = ["date", "title", "summary", "content"];
    for (const key of requiredEntryKeys) {
      if (!(key in row)) {
        throw new Error(`Archive entry missing required key: ${key}`);
      }
    }

    const date = typeof row.date === "string" ? row.date.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const summary = typeof row.summary === "string" ? row.summary.trim() : "";
    const content = typeof row.content === "string" ? row.content.trim() : "";

    if (!ENTRY_DATE_RE.test(date)) throw new Error("Archive entry date must match YYYY-MM-DD");
    if (!title) throw new Error("Archive entry title is required");
    if (!summary) throw new Error("Archive entry summary is required");
    if (!content) throw new Error("Archive entry content is required");

    return { date, title, summary, content };
  });

  return {
    active_state: obj.active_state.trim(),
    archive_entries: archiveEntries,
    archive_summary: obj.archive_summary.trim(),
    curation_notes: obj.curation_notes.trim(),
  };
}

function buildEntryBlock(entry: ArchiveEntry): string {
  const fp = entryFingerprint(entry);
  return [
    `### ${entry.date} - ${entry.title}`,
    `> ${entry.summary}`,
    `<!-- poseidon-fp:${fp} -->`,
    "",
    entry.content,
    "",
  ].join("\n");
}

export function buildEntryBlocks(entries: ArchiveEntry[]): string {
  return entries.map((entry) => buildEntryBlock(entry)).join("\n");
}

export function buildArchiveDocument(
  label: string,
  summary: string,
  existingEntries: string,
  newEntryBlocks: string,
): string {
  const sections: string[] = [
    `# Proteus Archive - ${label}`,
    "",
    "## Summary",
    summary || "No summary yet.",
    "",
    "---",
    "",
    "## Archived Entries",
  ];

  if (existingEntries) {
    sections.push("", existingEntries.trim());
  }
  if (newEntryBlocks) {
    sections.push("", newEntryBlocks.trim());
  }

  return `${sections.join("\n").trimEnd()}\n`;
}

function expectedMinimumBytes(entries: ArchiveEntry[]): number {
  if (entries.length === 0) return 0;

  let bytes = 0;
  for (const entry of entries) {
    bytes += Buffer.byteLength(`### ${entry.date} - ${entry.title}\n`, "utf8");
    bytes += Buffer.byteLength(`> ${entry.summary}\n`, "utf8");
    bytes += Buffer.byteLength(`<!-- poseidon-fp:${entryFingerprint(entry)} -->\n\n`, "utf8");
    bytes += Buffer.byteLength(`${entry.content}\n`, "utf8");
  }
  return bytes;
}

export function verifyArchiveWrite(stagedArchive: string, entries: ArchiveEntry[]): {
  ok: boolean;
  reason?: string;
} {
  const expectedTitles = entries.map((entry) => `### ${entry.date} - ${entry.title}`);
  const allTitlesPresent = expectedTitles.every((marker) => stagedArchive.includes(marker));
  if (!allTitlesPresent) {
    return { ok: false, reason: "Archive verification failed - missing title marker." };
  }

  const allContentsPresent = entries.every((entry) => stagedArchive.includes(entry.content));
  if (!allContentsPresent) {
    return { ok: false, reason: "Archive verification failed - missing entry content." };
  }

  const allFingerprintsPresent = entries.every((entry) =>
    stagedArchive.includes(`<!-- poseidon-fp:${entryFingerprint(entry)} -->`),
  );
  if (!allFingerprintsPresent) {
    return { ok: false, reason: "Archive verification failed - fingerprint mismatch." };
  }

  const minimumBytes = expectedMinimumBytes(entries);
  const actualBytes = Buffer.byteLength(stagedArchive, "utf8");
  if (actualBytes < minimumBytes) {
    return { ok: false, reason: "Archive verification failed - staged file too short." };
  }

  return { ok: true };
}
