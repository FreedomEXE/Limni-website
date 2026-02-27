/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: poseidon-curator.ts
 *
 * Description:
 * Poseidon's memory curation system. Reads Proteus session state, archives
 * resolved/stale context to monthly files, then writes cleaned active state.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Anthropic from "@anthropic-ai/sdk";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/poseidon/config";
import { resetCurationFlag } from "@/lib/poseidon/curation-flag";
import { loadSessionState, writeStateRaw } from "@/lib/poseidon/state";
import { withStateLock } from "@/lib/poseidon/state-mutex";

type ArchiveEntry = {
  date: string;
  title: string;
  summary: string;
  content: string;
};

type CurationResponse = {
  active_state: string;
  archive_entries: ArchiveEntry[];
  archive_summary: string;
  curation_notes: string;
};

export type CurationResult = {
  success: boolean;
  archived: number;
  note: string;
};

const CURATION_SYSTEM_PROMPT = `You are POSEIDON. God of the Sea. Memory Curator.

You are reviewing Proteus' session state - his persistent memory. Your job is to keep it lean,
relevant, and focused. You decide what stays in active memory and what gets archived.

RULES:
1. NEVER discard information. Everything removed from state goes to the archive.
2. Archive entries must include the original content, a date, and a one-line summary.
3. Keep these in active state ALWAYS:
   - Active/ongoing projects (anything not explicitly completed or abandoned)
   - Pending decisions (anything Freedom hasn't resolved yet)
   - Open trades (positions still active)
   - Personality notes, preferences, communication style observations
   - Anything less than 48 hours old (do not archive recent context)
4. Archive these:
   - Completed projects (include outcome in archive summary)
   - Closed trades (include result in archive summary)
   - Resolved decisions (include what was decided)
   - Stale threads with no activity for 7+ days
   - Historical context that's no longer actively relevant
5. When archiving, compress the content:
   - Keep key facts, decisions, and outcomes
   - Remove conversational fluff
   - Each archived entry should be 2-5 sentences
6. Generate a summary header for the monthly archive that captures:
   - Key projects worked on
   - Major decisions made
   - Notable trades and outcomes
   - Status at time of curation

OUTPUT FORMAT:
Return a JSON object with exactly four keys (all required):
{
  "active_state": "The cleaned PROTEUS_STATE.md content (markdown string)",
  "archive_entries": [
    {
      "date": "2026-02-27",
      "title": "Liquidation Research Initiative",
      "summary": "One-line summary of what this was about",
      "content": "2-5 sentence archived content with key facts and outcomes"
    }
  ],
  "archive_summary": "Updated summary paragraph for the monthly archive header",
  "curation_notes": "1-2 sentences on what you did and why (for logging)"
}

STRICT RULES:
- All four keys MUST be present. No extra keys.
- "active_state" MUST be a non-empty string.
- "archive_entries" MUST be an array (empty array if nothing to archive).
- Each entry MUST have all four fields: date, title, summary, content.
- "archive_summary" MUST be a string.
- "curation_notes" MUST be a string.
- Return ONLY the JSON object. No markdown fences, no commentary before/after.

If nothing needs archiving, return empty archive_entries and the state unchanged.
Do NOT invent or fabricate content. Only work with what's in the state file.`;

const ENTRY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function monthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(now = new Date()): string {
  return now.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function extractTextBlocks(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]);
    }
    throw new Error("Response is not valid JSON");
  }
}

function validateCurationResponse(raw: unknown): CurationResponse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Curation response is not an object");
  }

  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const expected = ["active_state", "archive_entries", "archive_summary", "curation_notes"].sort();
  if (keys.length !== expected.length || keys.some((key, idx) => key !== expected[idx])) {
    throw new Error("Curation response must contain exactly: active_state, archive_entries, archive_summary, curation_notes");
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
    const entryKeys = Object.keys(row).sort();
    const expectedEntryKeys = ["content", "date", "summary", "title"].sort();
    if (entryKeys.length !== expectedEntryKeys.length || entryKeys.some((key, idx) => key !== expectedEntryKeys[idx])) {
      throw new Error("Archive entry must contain exactly: date, title, summary, content");
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

async function ensureArchiveDir(archiveDir: string): Promise<void> {
  await mkdir(archiveDir, { recursive: true });
}

function extractArchivedEntries(content: string): string {
  const marker = "## Archived Entries";
  const markerIdx = content.indexOf(marker);
  if (markerIdx === -1) return "";
  return content.slice(markerIdx + marker.length).trim();
}

function buildArchiveDocument(
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

function buildEntryBlocks(entries: ArchiveEntry[]): string {
  return entries
    .map((entry) => `### ${entry.date} - ${entry.title}\n> ${entry.summary}\n\n${entry.content}\n`)
    .join("\n");
}

export async function curateProteusMemory(reason?: string): Promise<CurationResult> {
  return await withStateLock(async () => {
    const currentState = await loadSessionState();
    if (!currentState || currentState.length < 100) {
      return { success: true, archived: 0, note: "State too small to curate." };
    }

    const now = new Date();
    const key = monthKey(now);
    const label = monthLabel(now);
    const archiveDir = path.resolve(process.cwd(), config.stateDir, "..", "archives");
    const archivePath = path.join(archiveDir, `${key}.md`);

    const client = new Anthropic({ apiKey: config.anthropic.apiKey });
    const response = await client.messages.create({
      model: config.models.poseidon,
      max_tokens: 4096,
      system: CURATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            "Curate this session state.",
            reason ? `Reason: ${reason}` : "",
            `Current date (UTC): ${now.toISOString()}`,
            "",
            "---",
            "",
            currentState,
          ].filter(Boolean).join("\n"),
        },
      ],
    });

    const text = extractTextBlocks(response);

    let parsed: CurationResponse;
    try {
      const raw = parseJsonLoose(text);
      parsed = validateCurationResponse(raw);
    } catch (error) {
      console.error("[poseidon-curator] Invalid curation response from Opus:", error);
      console.error("[poseidon-curator] Raw response preview:", text.slice(0, 500));
      return { success: false, archived: 0, note: "Opus returned invalid schema. Curation aborted." };
    }

    if (parsed.archive_entries.length > 0) {
      await ensureArchiveDir(archiveDir);

      let existingArchive = "";
      try {
        existingArchive = await readFile(archivePath, "utf8");
      } catch {
        existingArchive = "";
      }

      const existingEntries = extractArchivedEntries(existingArchive);
      const newEntryBlocks = buildEntryBlocks(parsed.archive_entries);
      const updatedArchive = buildArchiveDocument(label, parsed.archive_summary, existingEntries, newEntryBlocks);

      const tmpPath = `${archivePath}.tmp.${Date.now()}`;
      await writeFile(tmpPath, updatedArchive, "utf8");

      const verification = await readFile(tmpPath, "utf8");
      const expectedBlocks = parsed.archive_entries.map((entry) => `### ${entry.date} - ${entry.title}`);
      const allPresent = expectedBlocks.every((block) => verification.includes(block));
      if (!allPresent) {
        await unlink(tmpPath).catch(() => undefined);
        throw new Error("Archive verification failed - not all entries found in staged write.");
      }

      await rename(tmpPath, archivePath);
    }

    await writeStateRaw(parsed.active_state);
    await resetCurationFlag();

    return {
      success: true,
      archived: parsed.archive_entries.length,
      note: parsed.curation_notes || "Curation complete.",
    };
  });
}
