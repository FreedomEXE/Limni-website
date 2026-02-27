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
import {
  buildArchiveDocument,
  buildEntryBlocks,
  validateCurationResponse,
  verifyArchiveWrite,
  type CurationResponse,
} from "@/lib/poseidon/curation-schema";
import { resetCurationFlag } from "@/lib/poseidon/curation-flag";
import {
  appendMissedTurnsToState,
  clearMissedTurns,
  readMissedTurns,
} from "@/lib/poseidon/missed-turns";
import { loadSessionState, writeStateRaw } from "@/lib/poseidon/state";
import { withStateLock } from "@/lib/poseidon/state-mutex";

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
- All four keys MUST be present.
- "active_state" MUST be a non-empty string.
- "archive_entries" MUST be an array (empty array if nothing to archive).
- Each entry MUST have all four fields: date, title, summary, content.
- "archive_summary" MUST be a string.
- "curation_notes" MUST be a string.
- Return ONLY the JSON object. No markdown fences, no commentary before/after.

If nothing needs archiving, return empty archive_entries and the state unchanged.
Do NOT invent or fabricate content. Only work with what's in the state file.`;

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

async function ensureArchiveDir(archiveDir: string): Promise<void> {
  await mkdir(archiveDir, { recursive: true });
}

function extractArchivedEntries(content: string): string {
  const marker = "## Archived Entries";
  const markerIdx = content.indexOf(marker);
  if (markerIdx === -1) return "";
  return content.slice(markerIdx + marker.length).trim();
}

export async function curateProteusMemory(reason?: string): Promise<CurationResult> {
  return await withStateLock(async () => {
    const currentState = await loadSessionState();
    const missedTurns = await readMissedTurns();
    const replayedState = appendMissedTurnsToState(currentState, missedTurns);

    if (!replayedState || replayedState.length < 100) {
      if (missedTurns.length > 0) {
        await writeStateRaw(replayedState);
        await clearMissedTurns();
        await resetCurationFlag();
        return {
          success: true,
          archived: 0,
          note: `State too small to curate. Replayed ${missedTurns.length} missed turn(s).`,
        };
      }
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
            replayedState,
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
      const verify = verifyArchiveWrite(verification, parsed.archive_entries);
      if (!verify.ok) {
        await unlink(tmpPath).catch(() => undefined);
        throw new Error(verify.reason ?? "Archive verification failed.");
      }

      await rename(tmpPath, archivePath);
    }

    await writeStateRaw(parsed.active_state);
    if (missedTurns.length > 0) {
      await clearMissedTurns();
    }
    await resetCurationFlag();

    return {
      success: true,
      archived: parsed.archive_entries.length,
      note: parsed.curation_notes || "Curation complete.",
    };
  });
}
