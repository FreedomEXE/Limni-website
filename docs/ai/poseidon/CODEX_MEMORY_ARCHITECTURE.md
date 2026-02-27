# Codex Prompt: Proteus Memory Architecture & Stability Overhaul

> Give this entire prompt to Codex. It covers the full memory/archive system, Poseidon curation,
> crash fixes, and deity assessment.
>
> Authored by Claude (CTO) + Freedom (Founder)
> February 27, 2026
> Revised: v2 — incorporates Codex review findings (6 hardening fixes) + Poseidon awareness layer

---

## Context

Proteus is live and functional but has two categories of problems:

1. **Memory architecture is undersized** — `PROTEUS_STATE.md` is capped at 3000 chars, the system prompt ceiling is 22K chars (with ~20K already used by memory files), and there's no archive system. Proteus can't grow a meaningful long-term memory.

2. **Crash/silence issues** — Proteus goes silent mid-conversation due to unhandled API errors, token limits, and missing timeout logic. Freedom sees "Proteus hit an error" or just... nothing.

This prompt fixes both. It also adds Poseidon as the memory curator, gives Poseidon awareness of Triton/Nereus activity, and hardens Proteus against crashes.

### Codex Review Findings (All Accepted)

Six issues were identified during code review. All are valid and addressed in this revision:

1. **[HIGH] Curation output schema** — Fixed: strict 4-key schema with Zod validation before any writes
2. **[HIGH] Path traversal in archive queries** — Fixed: YYYY-MM regex enforcement + resolved path containment check
3. **[HIGH] Race conditions during curation** — Fixed: async mutex around all state/archive write paths
4. **[MEDIUM] Automatic curation trigger flag unspecified** — Fixed: defined storage location, consumer, and reset semantics
5. **[MEDIUM] Archive verification too weak** — Fixed: verify all entries by count, atomic write via tmp+rename
6. **[MEDIUM] Typing indicator gaps** — Fixed: background keep-alive interval every 4s during all async operations

---

## Part 1: Memory Architecture

### 1.1 Overview

```
PROTEUS_STATE.md (hot memory — unlimited, current context)
    │
    ├─── Proteus writes freely throughout the day
    │
    ├─── Daily @ 06:00 UTC: Poseidon curates automatically
    │       • Reads PROTEUS_STATE.md
    │       • Archives resolved/stale items → archives/YYYY-MM.md
    │       • Compresses old context into one-liner summaries
    │       • Keeps active threads, preferences, personality notes
    │       • Writes cleaned state back
    │
    ├─── On-demand: Proteus calls request_poseidon_curation()
    │       • Same curation logic, triggered mid-day if needed
    │       • Proteus detects he's overwhelmed or can't find context
    │
    └─── Automatic: loadSystemPrompt() detects overflow
            • If state + memory files > threshold, triggers curation
            • Invisible to Proteus — happens before conversation starts

Proteus needs old context?
    │
    └─── Calls get_session_archive({ query?, month? })
            • Searches monthly archive files
            • Returns relevant sections with source attribution
```

### 1.2 File Structure

```
docs/ai/poseidon/
├── memory/                          (identity + knowledge — unchanged)
│   ├── PROTEUS_CORE.md
│   ├── LIMNI_PLATFORM.md
│   ├── TRADING_FRAMEWORK.md
│   ├── BOT_OPERATIONS.md
│   └── MARKET_KNOWLEDGE.md
├── state/                           (runtime state)
│   ├── PROTEUS_STATE.md             (hot memory — no cap, git-committed)
│   ├── conversations.json
│   ├── behavior.json
│   ├── heartbeat.json
│   └── triton_state.json
└── archives/                        (monthly archives — append-only, git-committed)
    ├── 2026-02.md
    ├── 2026-03.md
    └── ...
```

### 1.3 PROTEUS_STATE.md — Hot Memory

**Current problem:** `MAX_STATE_CHARS = 3000` in `state.ts:25`. This is ~750 words. Proteus describes storing months of trade history, personality notes, and project context — impossible in 3000 chars.

**Changes to `src/lib/poseidon/state.ts`:**

1. **Remove `MAX_STATE_CHARS` constant entirely.** No hardcoded cap on the state file.

2. **Replace with a soft threshold constant:**
```typescript
const STATE_SOFT_LIMIT_CHARS = 40000;
```
This is not a truncation point — it's a signal. When state exceeds this size, Poseidon curation should be triggered. The state file itself can grow beyond this; the limit is advisory.

3. **Update `updateSessionState()`:**
   - Remove the `content.slice(0, MAX_STATE_CHARS)` truncation
   - Keep the timestamp header
   - After writing, check if the file size exceeds `STATE_SOFT_LIMIT_CHARS`
   - If it does, log a warning: `[poseidon.state] State file exceeds soft limit (${full.length} chars) — curation recommended`
   - Do NOT truncate — let Poseidon handle it

4. **Update `loadSessionState()`:**
   - Remove the `raw.slice(0, MAX_STATE_CHARS)` truncation
   - Load the full file

5. **Add a new export:**
```typescript
export async function getStateSize(): Promise<number> {
  const state = await loadSessionState();
  return state.length;
}
```

### 1.4 Monthly Archives

**Location:** `docs/ai/poseidon/archives/YYYY-MM.md`

**Format for each monthly archive:**

```markdown
# Proteus Archive — February 2026

## Summary
Key projects: [auto-generated by Poseidon during curation]
Key decisions: [auto-generated]
Notable trades: [auto-generated]
Status at last update: [auto-generated]

---

## Archived Entries

### 2026-02-27 — Liquidation Research Initiative
[content moved from PROTEUS_STATE.md]

### 2026-02-27 — ETH Short from 1999
[content moved from PROTEUS_STATE.md]

### 2026-02-15 — Demo Mode Week 1 Results
[content moved from PROTEUS_STATE.md]
```

**Rules:**
- **Append-only.** Curation adds entries to the archive. Never overwrites or removes existing entries.
- **Summary header gets regenerated** by Poseidon on each curation pass (it's a summary of all entries in the file).
- **Git-committed.** Both `PROTEUS_STATE.md` and all archive files should be committed to git so they survive server wipes. This is the durability layer.

### 1.5 Archive Safety Protocol — CRITICAL

**"We cannot ever lose anything."** — Freedom

The curation logic MUST follow this order:

```
1. Read PROTEUS_STATE.md (current content)
2. Identify items to archive (resolved projects, closed trades, stale threads)
3. Write identified items to archives/YYYY-MM.md (APPEND, not overwrite)
4. Confirm the archive write succeeded (verify file contains new content)
5. ONLY THEN remove those items from PROTEUS_STATE.md
6. Write the cleaned state back
```

**If step 3 or 4 fails:** Abort. Do not modify PROTEUS_STATE.md. Log the error. Try again next cycle.

**Failure mode:** If a crash happens between step 3 and step 5, the worst case is duplicate data (same content in both state and archive). That's acceptable. Lost data is not.

### 1.6 System Prompt Budget — `memory.ts` Changes

**Current problem:** `memory.ts:104` caps the entire system prompt at 22,000 chars. Memory files already consume ~20K. State gets ~2K at best before truncation.

**Changes to `src/lib/poseidon/memory.ts`:**

1. **Bump the system prompt ceiling:**
```typescript
const MAX_SYSTEM_PROMPT_CHARS = 50000;
```
At ~4 chars per token, 50K chars = ~12.5K tokens. Claude Sonnet 4.5 has a 200K token context window. This leaves ~187K tokens for conversation history + tool results. Generous and safe.

2. **Restructure `loadSystemPrompt()` to prioritize identity files:**
   - Identity files (PROTEUS_CORE, LIMNI_PLATFORM) load first — these are non-negotiable
   - Knowledge files (TRADING_FRAMEWORK, BOT_OPERATIONS, MARKET_KNOWLEDGE) load second
   - Session state loads last — this is the flexible layer
   - Session state protocol instructions load at the very end
   - If the total exceeds the ceiling, truncate from the END of the state (oldest entries first), never from identity/knowledge files

3. **Add automatic curation trigger (Finding #4 fix):**
   After loading the system prompt, if `PROTEUS_STATE.md` alone exceeds `STATE_SOFT_LIMIT_CHARS` (40K), log a warning and set a curation flag.

   **Flag specification:**
   - **Storage:** `docs/ai/poseidon/state/curation_flag.json`
   - **Schema:** `{ "requested": boolean, "reason": string, "setAt": string (ISO timestamp) }`
   - **Writer:** `loadSystemPrompt()` in `memory.ts` sets `requested: true` when state exceeds threshold
   - **Consumer:** Poseidon's daily curation in `poseidon-god.ts` checks the flag before running. If `requested: true`, curation runs with elevated priority (processes more aggressively). If `requested: false`, curation still runs daily but with normal threshold logic.
   - **Reset:** `poseidon-curator.ts` sets `requested: false` after successful curation
   - **On-demand override:** `request_poseidon_curation()` tool ignores the flag entirely — it always runs

   ```typescript
   // In memory.ts, after loading state
   const stateSize = sessionState?.length ?? 0;
   if (stateSize > STATE_SOFT_LIMIT_CHARS) {
     await writeCurationFlag({
       requested: true,
       reason: `State size ${stateSize} exceeds soft limit ${STATE_SOFT_LIMIT_CHARS}`,
       setAt: new Date().toISOString(),
     });
     console.warn(`[poseidon.memory] State exceeds soft limit (${stateSize} chars) — curation flagged`);
   }
   ```

4. **Updated `MEMORY_FILES` with adjusted budgets:**
```typescript
const MEMORY_FILES: MemorySpec[] = [
  { filename: "PROTEUS_CORE.md", maxChars: 5000 },      // bumped — personality is critical
  { filename: "LIMNI_PLATFORM.md", maxChars: 5000 },     // bumped — platform knowledge
  { filename: "TRADING_FRAMEWORK.md", maxChars: 6000 },  // bumped slightly
  { filename: "BOT_OPERATIONS.md", maxChars: 5000 },     // bumped slightly
  { filename: "MARKET_KNOWLEDGE.md", maxChars: 4000 },   // bumped slightly
];
// Total memory files budget: ~25K chars
// State budget: up to ~25K chars (flexible, managed by Poseidon curation)
// Grand total: ~50K chars max system prompt
```

---

## Part 2: New Tools

### 2.1 `get_session_archive` Tool

**Purpose:** Lets Proteus query old context from monthly archives when current state doesn't have what he needs.

**Tool definition (add to `tools.ts`):**

```typescript
{
  name: "get_session_archive",
  description: "Search your archived memory for old context — resolved projects, past trades, historical decisions. Use when current session state doesn't have what you need. Search by keyword or browse a specific month.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Keyword or phrase to search for across all archives (e.g. 'OI filtering', 'ETH trade', 'liquidation research')."
      },
      month: {
        type: "string",
        description: "Specific month to search or browse, in YYYY-MM format (e.g. '2026-02'). If omitted, searches all archives."
      }
    },
    required: []
  }
}
```

**Handler implementation (new file or in `tools.ts`):**

```typescript
const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

function sanitizeMonthInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!MONTH_FORMAT.test(trimmed)) return null;
  return trimmed;
}

function assertPathContainment(filePath: string, allowedDir: string): void {
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(allowedDir);
  if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
    throw new Error("Path traversal blocked");
  }
}

async function getSessionArchive(input: ToolInput): Promise<string> {
  const archiveDir = path.resolve(process.cwd(), config.stateDir, "..", "archives");
  const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
  const rawMonth = typeof input.month === "string" ? input.month.trim() : "";

  // If specific month requested, read that file
  if (rawMonth) {
    const month = sanitizeMonthInput(rawMonth);
    if (!month) return "Invalid month format. Use YYYY-MM (e.g. '2026-02').";
    const filePath = path.join(archiveDir, `${month}.md`);
    assertPathContainment(filePath, archiveDir);
    try {
      const content = await readFile(filePath, "utf8");
      if (query) {
        // Return only sections containing the query
        return filterArchiveSections(content, query);
      }
      // Return full archive (truncated to reasonable size)
      return content.slice(0, 8000);
    } catch {
      return `No archive found for ${month}.`;
    }
  }

  // Search all archives
  try {
    const files = await readdir(archiveDir);
    const mdFiles = files.filter(f => f.endsWith(".md")).sort().reverse(); // newest first

    if (!mdFiles.length) return "No archives exist yet.";

    if (!query) {
      // Return list of available archives with their summaries
      const summaries: string[] = [];
      for (const file of mdFiles.slice(0, 12)) { // last 12 months max
        const content = await readFile(path.join(archiveDir, file), "utf8");
        const summary = extractArchiveSummary(content);
        summaries.push(`**${file.replace(".md", "")}**: ${summary}`);
      }
      return summaries.join("\n\n");
    }

    // Search across all archives for matching sections
    const results: string[] = [];
    for (const file of mdFiles) {
      const content = await readFile(path.join(archiveDir, file), "utf8");
      const matches = filterArchiveSections(content, query);
      if (matches) {
        results.push(`--- ${file.replace(".md", "")} ---\n${matches}`);
      }
    }

    if (!results.length) return `No archive entries found matching "${input.query}".`;
    return results.join("\n\n").slice(0, 8000);
  } catch {
    return "Archive directory not found. No archives exist yet.";
  }
}
```

**Helper functions:**
```typescript
function filterArchiveSections(content: string, query: string): string {
  // Split by ### headers, return sections containing the query
  const sections = content.split(/(?=^### )/m);
  const matches = sections.filter(s => s.toLowerCase().includes(query));
  return matches.join("\n").trim().slice(0, 4000) || "";
}

function extractArchiveSummary(content: string): string {
  // Extract the ## Summary section
  const match = content.match(/## Summary\n([\s\S]*?)(?=\n---|\n## )/);
  return match?.[1]?.trim().slice(0, 300) || "No summary available.";
}
```

### 2.2 `request_poseidon_curation` Tool

**Purpose:** Lets Proteus call Poseidon (Opus) to curate his state file on-demand when he feels overwhelmed or cluttered.

**Tool definition (add to `tools.ts`):**

```typescript
{
  name: "request_poseidon_curation",
  description: "Call Poseidon to curate your memory. Use when your session state feels cluttered, you can't find what you need, or you notice your context is getting large. Poseidon will archive resolved items and keep your state lean. This is expensive (Opus call) — use only when genuinely needed, not every conversation.",
  input_schema: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "Brief explanation of why you're requesting curation (e.g. 'state feels cluttered', 'too many resolved threads')."
      }
    },
    required: []
  }
}
```

**Handler:** Calls the Poseidon curation function (see Part 3 below) and returns a summary of what was archived.

---

## Part 3: Poseidon Curation System

### 3.1 Overview

Poseidon gains a second responsibility: memory curation. This runs:
- **Automatically** after the Daily Reckoning at 06:00 UTC
- **On-demand** when Proteus calls `request_poseidon_curation()`

### 3.2 New File: `src/lib/poseidon/poseidon-curator.ts`

This module handles all curation logic. Keep it separate from `poseidon-god.ts` (the Reckoning) for clean separation.

```typescript
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: poseidon-curator.ts
 *
 * Description:
 * Poseidon's memory curation system. Reads Proteus' session state,
 * identifies resolved/stale content, archives it to monthly files,
 * and returns a lean, focused state. Uses Claude Opus for intelligent
 * curation decisions.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
```

### 3.3 Curation Prompt for Opus

```typescript
const CURATION_SYSTEM_PROMPT = `You are POSEIDON. God of the Sea. Memory Curator.

You are reviewing Proteus' session state — his persistent memory. Your job is to keep it lean,
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
```

### 3.4 Async Mutex for State/Archive Safety

**[Finding #3 fix]** Curation reads and writes state over a multi-step flow. If Proteus calls `update_session_state` concurrently (e.g., during a conversation while daily curation runs), data can be lost.

**Solution:** A shared async mutex that wraps ALL state and archive write operations.

```typescript
// src/lib/poseidon/state-mutex.ts
// Simple async mutex — no external dependencies needed

let locked = false;
const queue: Array<() => void> = [];

export async function withStateLock<T>(fn: () => Promise<T>): Promise<T> {
  // Wait for lock
  if (locked) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  locked = true;
  try {
    return await fn();
  } finally {
    locked = false;
    const next = queue.shift();
    if (next) next();
  }
}
```

**Usage:** Wrap `updateSessionState()` in `state.ts` and the entire curation flow in `poseidon-curator.ts` with `withStateLock()`. This ensures no concurrent writes.

```typescript
// In state.ts
export async function updateSessionState(content: string): Promise<string> {
  return withStateLock(async () => {
    // ... existing write logic ...
  });
}

// In poseidon-curator.ts
export async function curateProteusMemory(reason?: string): Promise<CurationResult> {
  return withStateLock(async () => {
    // ... entire curation flow ...
  });
}
```

### 3.5 Schema Validation

**[Finding #1 fix]** Raw `JSON.parse()` on Opus output is fragile. One formatting miss breaks curation.

**Solution:** Use Zod (already available in most Next.js projects) or a manual validator to enforce the schema before any writes.

```typescript
import { z } from "zod";

const ArchiveEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  content: z.string().min(1),
});

const CurationResponseSchema = z.object({
  active_state: z.string().min(1),
  archive_entries: z.array(ArchiveEntrySchema),
  archive_summary: z.string(),
  curation_notes: z.string(),
});

type CurationResponse = z.infer<typeof CurationResponseSchema>;
```

If Zod is not available, implement equivalent manual validation:
```typescript
function validateCurationResponse(raw: unknown): CurationResponse {
  if (!raw || typeof raw !== "object") throw new Error("Curation response is not an object");
  const obj = raw as Record<string, unknown>;
  if (typeof obj.active_state !== "string" || !obj.active_state) throw new Error("Missing/empty active_state");
  if (!Array.isArray(obj.archive_entries)) throw new Error("archive_entries must be array");
  for (const entry of obj.archive_entries) {
    if (!entry || typeof entry !== "object") throw new Error("Invalid archive entry");
    const e = entry as Record<string, unknown>;
    if (typeof e.date !== "string" || typeof e.title !== "string" ||
        typeof e.summary !== "string" || typeof e.content !== "string") {
      throw new Error("Archive entry missing required fields (date, title, summary, content)");
    }
  }
  if (typeof obj.archive_summary !== "string") throw new Error("Missing archive_summary");
  if (typeof obj.curation_notes !== "string") throw new Error("Missing curation_notes");
  return obj as unknown as CurationResponse;
}
```

### 3.6 Curation Function

```typescript
export async function curateProteusMemory(reason?: string): Promise<CurationResult> {
  return withStateLock(async () => {
    // 1. Read current state
    const currentState = await loadSessionState();
    if (!currentState || currentState.length < 100) {
      return { success: true, archived: 0, note: "State too small to curate." };
    }

    // 2. Determine current archive month
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const archiveDir = path.resolve(process.cwd(), config.stateDir, "..", "archives");
    const archivePath = path.join(archiveDir, `${monthKey}.md`);

    // 3. Call Opus for curation decisions
    const client = new Anthropic({ apiKey: config.anthropic.apiKey });
    const response = await client.messages.create({
      model: config.models.poseidon,
      max_tokens: 4096,
      system: CURATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Curate this session state.${reason ? ` Reason: ${reason}` : ""}\n\nCurrent date: ${now.toISOString()}\n\n---\n\n${currentState}`,
        },
      ],
    });

    // 4. Parse and VALIDATE Opus response (Finding #1 fix)
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: CurationResponse;
    try {
      const raw = JSON.parse(text);
      parsed = validateCurationResponse(raw); // or CurationResponseSchema.parse(raw) with Zod
    } catch (parseError) {
      console.error("[poseidon-curator] Invalid curation response from Opus:", parseError);
      console.error("[poseidon-curator] Raw response:", text.slice(0, 500));
      return { success: false, archived: 0, note: "Opus returned invalid schema. Curation aborted." };
    }

    // 5. ARCHIVE FIRST (safety protocol)
    if (parsed.archive_entries.length > 0) {
      await ensureArchiveDir();

      // Read existing archive (if any)
      let existingArchive = "";
      try {
        existingArchive = await readFile(archivePath, "utf8");
      } catch {
        // New archive file — create with header
        existingArchive = `# Proteus Archive — ${monthKey}\n\n## Summary\n${parsed.archive_summary || "No summary yet."}\n\n---\n\n## Archived Entries\n`;
      }

      // Update summary header
      existingArchive = existingArchive.replace(
        /## Summary\n[\s\S]*?(?=\n---)/,
        `## Summary\n${parsed.archive_summary || "No summary yet."}`
      );

      // Append new entries
      const newEntries = parsed.archive_entries.map((entry) =>
        `### ${entry.date} — ${entry.title}\n> ${entry.summary}\n\n${entry.content}\n`
      ).join("\n");

      const updatedArchive = existingArchive.trimEnd() + "\n\n" + newEntries;

      // 6. Atomic write via tmp+rename (Finding #5 fix)
      const tmpPath = archivePath + `.tmp.${Date.now()}`;
      await writeFile(tmpPath, updatedArchive, "utf8");

      // 7. Verify ALL entries present (Finding #5 fix — not just first title)
      const verification = await readFile(tmpPath, "utf8");
      const allPresent = parsed.archive_entries.every(
        (entry) => verification.includes(entry.title) && verification.includes(entry.content.slice(0, 50))
      );
      if (!allPresent) {
        // Clean up tmp file, abort
        await unlink(tmpPath).catch(() => undefined);
        throw new Error("Archive verification failed — not all entries found in written file. Aborting.");
      }

      // 8. Atomic rename (tmp → final)
      await rename(tmpPath, archivePath);
    }

    // 9. ONLY NOW update state (after archive is confirmed safe)
    // Note: updateSessionState is also wrapped in withStateLock internally,
    // but since we're already holding the lock, use the raw write here.
    await writeStateRaw(parsed.active_state);

    return {
      success: true,
      archived: parsed.archive_entries.length,
      note: parsed.curation_notes || "Curation complete.",
    };
  });
}
```

### 3.5 Wire into Poseidon's Daily Schedule

In `poseidon-god.ts`, after the Reckoning is sent, call curation:

```typescript
export async function sendReckoning(telegram: Telegram, ownerId: number): Promise<void> {
  try {
    // ... existing Reckoning logic ...

    // After Reckoning, curate Proteus memory
    try {
      const curationResult = await curateProteusMemory("daily scheduled curation");
      if (curationResult.archived > 0) {
        console.log(`[poseidon-curator] Archived ${curationResult.archived} entries: ${curationResult.note}`);
      }
    } catch (err) {
      console.error("[poseidon-curator] Daily curation failed:", err);
      // Non-fatal — don't let curation failure break the Reckoning
    }
  } catch (err) {
    // ... existing error handling ...
  }
}
```

### 3.6 Wire `request_poseidon_curation` Tool Handler

In `tools.ts`, add the handler:

```typescript
case "request_poseidon_curation": {
  const reason = typeof input.reason === "string" ? input.reason : undefined;
  const result = await curateProteusMemory(reason);
  return toJson(result);
}
```

### 3.7 Git Commit of State and Archives

Archives and state should be committed to git for durability. This should be a periodic operation, not on every write (too noisy).

**Option A (recommended for now): Manual.** Freedom or Codex commits state/archive files as part of normal development workflow. No automation needed.

**Option B (future): Automated.** Add a post-curation step that runs:
```bash
git add docs/ai/poseidon/state/PROTEUS_STATE.md docs/ai/poseidon/archives/
git commit -m "poseidon: archive curation $(date -u +%Y-%m-%d)"
git push
```
This should only run after Poseidon's daily curation, not on every state update. Implement only if Freedom requests it.

---

## Part 4: Proteus Crash & Stability Fixes

These are independent of the memory architecture and should be implemented in the same pass.

### 4.1 Error Handling on Claude API Calls — `proteus.ts`

**Problem:** `client.messages.create()` at line 69 has zero error handling. API errors (rate limits, timeouts, network failures) crash the entire chat function.

**Fix:** Wrap the API call in try/catch with retry logic. Use typed error detection (Finding #6 improvement — don't rely on string matching):

```typescript
import Anthropic from "@anthropic-ai/sdk";

function isRetryableError(error: unknown): boolean {
  // Anthropic SDK typed errors (preferred)
  if (error instanceof Anthropic.RateLimitError) return true;       // 429
  if (error instanceof Anthropic.InternalServerError) return true;  // 500
  if (error instanceof Anthropic.APIConnectionError) return true;   // network issues

  // Anthropic SDK has an 'overloaded' error for 529
  if (error instanceof Anthropic.APIStatusError && error.status === 529) return true;

  // Fallback: check for network-level errors by code
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("socket hang up")) {
      return true;
    }
  }

  return false;
}

async function callClaudeWithRetry(
  params: Anthropic.MessageCreateParams,
  maxRetries = 2,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (error) {
      if (!isRetryableError(error) || attempt === maxRetries) throw error;

      const delay = (attempt + 1) * 2000; // 2s, 4s
      console.warn(`[proteus] API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
        error instanceof Error ? error.message : String(error));
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}
```

Then replace `client.messages.create(...)` in the tool loop with `callClaudeWithRetry(...)`.

### 4.2 Bump `max_tokens` — `proteus.ts`

**Problem:** `max_tokens: 2048` at line 72 is too low for multi-tool conversations. When the system prompt is large and history is long, 2048 tokens leaves almost no room for both tool calls and text responses. This causes empty or truncated responses.

**Fix:** Bump to 4096:

```typescript
max_tokens: 4096,
```

### 4.3 Typing Keep-Alive — `proteus.ts` and `index.ts`

**Problem:** `sendChatAction("typing")` is only called once before the first API call. Telegram typing indicators expire after 5 seconds. A single long API call or tool execution (not just between rounds) can cause silence.

**Fix (Finding #6):** Background keep-alive interval that sends typing every 4 seconds throughout the entire `chat()` call, not just between rounds.

```typescript
// In proteus.ts — updated signature
export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  tools: Anthropic.Tool[],
  typingFn?: () => Promise<void>,  // typing indicator function
): Promise<ChatResponse> {
  // Start keep-alive interval for entire chat duration
  let typingInterval: NodeJS.Timeout | null = null;
  if (typingFn) {
    // Send immediately, then every 4 seconds
    typingFn().catch(() => undefined);
    typingInterval = setInterval(() => {
      typingFn().catch(() => undefined);
    }, 4000);
  }

  try {
    // ... existing tool loop ...
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      // No per-round typing needed — interval handles it
      // ... rest of loop ...
    }
  } finally {
    // Always clean up interval, even on error
    if (typingInterval) clearInterval(typingInterval);
  }
}
```

```typescript
// In index.ts — pass the callback
const response = await chat(
  systemPrompt,
  history,
  toolDefinitions,
  () => ctx.sendChatAction("typing"),
);
```

This ensures typing indicator stays alive during:
- Long API calls (Opus/Sonnet thinking)
- Multi-tool execution within a single round
- Database queries that take >5 seconds
- Any async operation throughout the entire chat flow

### 4.4 `Promise.allSettled` for Tool Execution — `proteus.ts`

**Problem:** `Promise.all()` at line 95 means if ONE tool throws (e.g., DB timeout), ALL tools fail and the entire round crashes.

**Fix:** Switch to `Promise.allSettled()`:

```typescript
const toolSettled = await Promise.allSettled(
  toolUses.map(async (toolUse) => {
    const id = String(toolUse.id ?? "");
    const name = String(toolUse.name ?? "");
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const result = await handleToolCall(name, input);
    return { id, name, result };
  }),
);

const toolExecutions = toolSettled.map((settled, idx) => {
  if (settled.status === "fulfilled") return settled.value;
  const toolUse = toolUses[idx];
  return {
    id: String(toolUse.id ?? ""),
    name: String(toolUse.name ?? ""),
    result: `Tool error: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
  };
});
```

### 4.5 Per-Round Timeout — `proteus.ts`

**Problem:** No timeout on individual API calls or tool executions. A hung DB query or slow API response blocks forever.

**Fix:** Add a timeout wrapper:

```typescript
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}
```

Use it on API calls and tool executions:
```typescript
const response = await withTimeout(
  callClaudeWithRetry({ model, max_tokens, system, messages, tools }),
  30000, // 30 seconds per API call
  "Claude API call"
);

const result = await withTimeout(
  handleToolCall(name, input),
  15000, // 15 seconds per tool
  `Tool ${name}`
);
```

### 4.6 Cap Persisted Tool Results — `proteus.ts`

**Problem:** `persistText` includes full tool result summaries. Over time, conversation history bloats with massive JSON dumps, eating context window.

**Fix:** Already partially handled by `summarizeToolResult()` (line 33, capped at 120 chars). Verify this is working and that raw tool JSON isn't leaking into persisted history. The current implementation looks correct — just confirm no code path bypasses it.

---

## Part 5: Deity Assessment

Freedom asked whether the other deities need upgrades. Here's the assessment:

### Poseidon (Opus, daily) — UPGRADE: Add Curation

**Current role:** Daily Reckoning at 06:00 UTC.
**New role:** Daily Reckoning + Memory Curation (as detailed in Part 3).
**Cost impact:** One additional Opus call per day (~$0.10-0.30). Plus on-demand calls if Proteus triggers curation (~$0.10-0.30 each, expected to be rare).
**Verdict:** Upgrade justified. Natural extension of his role.

**Should Poseidon have his own state/archives?** Not now. His daily Reckonings are sent to Telegram and that's sufficient. If Freedom wants historical Reckoning analysis later ("what did Poseidon say last Tuesday?"), we could save Reckonings to `archives/reckonings/YYYY-MM.md` — but that's a Phase 3 enhancement. Don't build it now.

### Nereus (Haiku, twice daily) — MINOR: Activity Log Writer

**Current role:** Pre-session briefings at 23:30 UTC and 12:30 UTC.
**Assessment:** Working as intended. Briefings are delivered, Haiku is cost-efficient, and the structured format is solid.
**New addition:** Append to `activity_log.json` after each briefing delivery (see Part 6). One-line change — no architectural modifications.
**Verdict:** Minimal touch. Activity log integration only.

### Triton (polling, every 30s) — MINOR: Activity Log Writer

**Current role:** Alert monitoring and delivery. Polls 9 subsystem monitors, applies behavior filters, sends formatted alerts.
**Assessment:** Already well-built. Has its own state persistence (`triton_state.json`), dedup cache, priority system, and graceful error handling per monitor.
**New addition:** Append to `activity_log.json` after each successfully sent alert (see Part 6). One-line change — no architectural modifications.
**Verdict:** Minimal touch. Activity log integration only.

### Summary

| Deity | Change | Priority |
|-------|--------|----------|
| **Poseidon** | Add curation + awareness layer (reads activity log, curates Proteus state) | P0 (part of this prompt) |
| **Nereus** | Activity log writer (1-line addition) | P1 |
| **Triton** | Activity log writer (1-line addition) | P1 |
| **Proteus** | Memory architecture + crash fixes | P0 (this prompt) |

---

## Part 6: Poseidon Awareness Layer

### 6.1 Problem

Poseidon is the god — he reviews everything daily. But he has no awareness of what his subordinate deities actually did between Reckonings. Triton sends 15 alerts? Poseidon doesn't know. Nereus delivers a briefing flagging stale crons? Poseidon queries the DB independently and may reach a different conclusion.

The god should know what his lieutenants reported.

### 6.2 Solution: Activity Log

A lightweight append-only log that Triton and Nereus write to whenever they fire. Poseidon reads it during the Daily Reckoning, then resets it.

**File:** `docs/ai/poseidon/state/activity_log.json`

**Schema:**
```typescript
type ActivityEntry = {
  deity: "triton" | "nereus";
  timestamp: string;       // ISO 8601
  type: string;            // e.g., "alert_sent", "briefing_delivered"
  summary: string;         // 1-2 sentences: what happened
  priority?: string;       // Triton: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  metadata?: Record<string, unknown>; // Optional extra context
};

// File is a JSON array of ActivityEntry objects
// Example:
[
  {
    "deity": "triton",
    "timestamp": "2026-02-27T14:32:00Z",
    "type": "alert_sent",
    "summary": "BTC SHORT trade opened @ 97,450. Bitget v2, 5x leverage.",
    "priority": "HIGH"
  },
  {
    "deity": "triton",
    "timestamp": "2026-02-27T15:10:00Z",
    "type": "alert_sent",
    "summary": "BTC SHORT milestone +5% hit. Leverage scaled to 10x.",
    "priority": "MEDIUM"
  },
  {
    "deity": "nereus",
    "timestamp": "2026-02-27T12:30:00Z",
    "type": "briefing_delivered",
    "summary": "Pre-NY briefing: Short bias, clean alignment. 2 stale crons flagged."
  }
]
```

### 6.3 Writers

**Triton** — append after each successfully sent alert:
```typescript
// In triton.ts, after successful telegram.sendMessage()
await appendActivityLog({
  deity: "triton",
  timestamp: new Date().toISOString(),
  type: "alert_sent",
  summary: `${alert.type}: ${alert.body.slice(0, 100)}`,
  priority: alert.priority,
});
```

**Nereus** — append after each briefing delivery:
```typescript
// In nereus.ts, after successful briefing send
await appendActivityLog({
  deity: "nereus",
  timestamp: new Date().toISOString(),
  type: "briefing_delivered",
  summary: `${sessionType} briefing delivered. Commentary: ${commentary.slice(0, 100)}`,
});
```

### 6.4 Implementation: `src/lib/poseidon/activity-log.ts`

```typescript
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: activity-log.ts
 *
 * Description:
 * Lightweight append-only activity log for deity actions. Triton and
 * Nereus write entries when they fire. Poseidon reads and resets the
 * log during the Daily Reckoning.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/poseidon/config";

type ActivityEntry = {
  deity: "triton" | "nereus";
  timestamp: string;
  type: string;
  summary: string;
  priority?: string;
  metadata?: Record<string, unknown>;
};

const LOG_PATH = path.resolve(process.cwd(), config.stateDir, "activity_log.json");
const MAX_ENTRIES = 200; // Safety cap — oldest entries dropped if exceeded

async function ensureDir() {
  await mkdir(path.dirname(LOG_PATH), { recursive: true });
}

export async function appendActivityLog(entry: ActivityEntry): Promise<void> {
  await ensureDir();
  let entries: ActivityEntry[] = [];
  try {
    const raw = await readFile(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) entries = parsed;
  } catch {
    // Fresh log
  }

  entries.push(entry);

  // Safety cap — keep most recent entries
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }

  await writeFile(LOG_PATH, JSON.stringify(entries, null, 2), "utf8");
}

export async function readActivityLog(): Promise<ActivityEntry[]> {
  await ensureDir();
  try {
    const raw = await readFile(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function resetActivityLog(): Promise<void> {
  await ensureDir();
  await writeFile(LOG_PATH, "[]", "utf8");
}
```

### 6.5 Consumer: Poseidon Daily Reckoning

In `poseidon-god.ts`, inject the activity log into the Reckoning data:

```typescript
import { readActivityLog, resetActivityLog } from "@/lib/poseidon/activity-log";

async function gatherReckoningData(): Promise<string> {
  // ... existing data gathering ...

  // DEITY ACTIVITY (new section)
  try {
    const activity = await readActivityLog();
    if (activity.length > 0) {
      const tritonAlerts = activity.filter(a => a.deity === "triton");
      const nereusBriefings = activity.filter(a => a.deity === "nereus");

      const lines: string[] = ["DEITY ACTIVITY (last 24h)"];
      lines.push(`  Triton: ${tritonAlerts.length} alerts sent`);

      // Summarize by priority
      const critical = tritonAlerts.filter(a => a.priority === "CRITICAL").length;
      const high = tritonAlerts.filter(a => a.priority === "HIGH").length;
      if (critical) lines.push(`    CRITICAL: ${critical}`);
      if (high) lines.push(`    HIGH: ${high}`);

      // List notable alerts (HIGH and CRITICAL only, to keep Reckoning data lean)
      for (const alert of tritonAlerts.filter(a => a.priority === "CRITICAL" || a.priority === "HIGH").slice(0, 5)) {
        lines.push(`    ${alert.timestamp.slice(11, 16)} UTC: ${alert.summary}`);
      }

      lines.push(`  Nereus: ${nereusBriefings.length} briefings delivered`);
      for (const briefing of nereusBriefings.slice(0, 2)) {
        lines.push(`    ${briefing.summary}`);
      }

      sections.push(lines.join("\n"));
    } else {
      sections.push("DEITY ACTIVITY\n  No activity logged since last Reckoning.");
    }
  } catch {
    sections.push("DEITY ACTIVITY\n  Error reading activity log.");
  }

  return sections.join("\n\n");
}
```

After the Reckoning is sent and curation is complete, reset the log:

```typescript
// In sendReckoning(), after curation
await resetActivityLog().catch(e => console.warn("[poseidon] Failed to reset activity log:", e));
```

### 6.6 Why This Matters

- **Poseidon sees the full picture.** He knows Triton sent 3 CRITICAL alerts about bot errors, and Nereus flagged stale data in the pre-NY briefing. His Reckoning can now reference what his subordinates reported.
- **No separate archives needed.** The activity log resets daily. Poseidon's Reckoning is the archive — it synthesizes everything into one authoritative statement.
- **Minimal overhead.** JSON append on each alert/briefing. No AI calls. No DB writes. Trivial cost.
- **Feeds into Proteus too.** If Proteus ever needs to know "what alerts did Triton send today?", we could add a `get_activity_log` tool later. Not needed now.

---

## Part 7: Files to Modify

| File | Changes |
|------|---------|
| `src/lib/poseidon/state.ts` | Remove `MAX_STATE_CHARS`, add `STATE_SOFT_LIMIT_CHARS`, add `getStateSize()`, remove truncation, wrap writes in `withStateLock` |
| `src/lib/poseidon/memory.ts` | Bump system prompt ceiling to 50K, restructure priority loading, bump individual file budgets, add curation flag writer |
| `src/lib/poseidon/proteus.ts` | Add retry logic with typed errors, bump max_tokens to 4096, add typing keep-alive interval, switch to `Promise.allSettled`, add timeout wrapper |
| `src/lib/poseidon/tools.ts` | Add `get_session_archive` (with path traversal protection) and `request_poseidon_curation` tool definitions + handlers |
| `src/lib/poseidon/index.ts` | Pass typing callback to `chat()`, no other changes needed |
| `src/lib/poseidon/poseidon-god.ts` | Add curation call after Reckoning, inject activity log into Reckoning data, reset activity log after Reckoning |
| `src/lib/poseidon/triton.ts` | Add `appendActivityLog()` call after each successfully sent alert |
| `src/lib/poseidon/nereus.ts` | Add `appendActivityLog()` call after each briefing delivery |
| `src/lib/poseidon/poseidon-curator.ts` | **NEW FILE** — Curation logic, Opus prompt, schema validation, archive read/write, atomic writes, safety protocol |
| `src/lib/poseidon/state-mutex.ts` | **NEW FILE** — Shared async mutex for state/archive write safety |
| `src/lib/poseidon/activity-log.ts` | **NEW FILE** — Deity activity log (append, read, reset) |

## Files NOT to Modify

- `src/lib/poseidon/config.ts` — leave as-is
- `src/lib/poseidon/conversations.ts` — leave as-is
- `src/lib/poseidon/behavior.ts` — leave as-is
- `src/lib/poseidon/animations.ts` — leave as-is
- All memory `.md` files — leave as-is
- Any files outside `src/lib/poseidon/` and `docs/ai/poseidon/` — DO NOT TOUCH

---

## Acceptance Criteria

### Memory Architecture
1. `PROTEUS_STATE.md` has no hardcoded character cap — Proteus can write freely
2. System prompt ceiling bumped to 50K chars with correct priority loading (identity first, state last)
3. `archives/` directory structure created and writable
4. `get_session_archive` tool works — returns results when archives exist, graceful "no archives" when empty
5. `get_session_archive` rejects invalid month formats and blocks path traversal
6. `request_poseidon_curation` tool works — calls Opus, archives resolved items, cleans state

### Archive Safety
7. Archive safety protocol enforced — archive-first, then delete, with verification of ALL entries
8. Atomic writes via tmp+rename for archive files
9. Async mutex prevents concurrent state/archive writes
10. Curation response validated against strict 4-key schema before any writes

### Poseidon Awareness
11. Triton appends to `activity_log.json` after each alert
12. Nereus appends to `activity_log.json` after each briefing
13. Poseidon's `gatherReckoningData()` includes deity activity section
14. Activity log resets after Reckoning delivery

### Crash Fixes
15. `proteus.ts` has retry logic using typed Anthropic SDK error classes (2 retries with backoff)
16. `max_tokens` bumped to 4096
17. Typing keep-alive interval every 4 seconds throughout entire `chat()` call, cleaned up in `finally`
18. `Promise.allSettled` used for tool execution
19. Timeout wrapper on API calls (30s) and tool calls (15s)

### Curation Trigger
20. `curation_flag.json` written when state exceeds soft limit
21. Poseidon reads and respects the flag during daily curation
22. Flag reset after successful curation

### General
23. `npx tsc` compiles with zero errors (or only pre-existing errors outside poseidon/)
24. All existing commands (/start, /health, /status, /clear, /briefing, /reckoning) still work
25. No files outside the poseidon module are modified (except `triton.ts` and `nereus.ts` for activity log integration)

---

## Testing

After building:
1. `npx tsc` — should compile clean
2. Start bot locally: `npx tsx src/lib/poseidon/index.ts`
3. Send several messages to build up conversation context
4. Verify `PROTEUS_STATE.md` can grow beyond 3000 chars
5. Manually trigger curation: ask Proteus to call `request_poseidon_curation()`
6. Verify archive file created in `docs/ai/poseidon/archives/YYYY-MM.md`
7. Verify archived content was removed from `PROTEUS_STATE.md`
8. Ask Proteus to recall archived content — should call `get_session_archive` and find it
9. Verify crash resilience: kill DB connection mid-conversation, bot should recover gracefully
10. Verify typing indicator persists through multi-tool chains
11. `/health` — should still work
12. `/reckoning` — should deliver Reckoning AND run curation afterward

---

## Cost Estimate

| Operation | Model | Frequency | Est. Cost/Day |
|-----------|-------|-----------|---------------|
| Daily Reckoning | Opus 4 | 1x/day | ~$0.15-0.30 |
| Daily Curation | Opus 4 | 1x/day | ~$0.10-0.20 |
| On-demand Curation | Opus 4 | ~0-2x/day | ~$0.00-0.40 |
| Proteus conversations | Sonnet 4.5 | ~10-50x/day | ~$0.50-2.00 |
| Nereus briefings | Haiku 4.5 | 2x/day | ~$0.01-0.02 |
| **Total** | — | — | **~$0.76-2.92/day** |

---

*"The sea-god Proteus knew all things — past, present, and things to come.
But to learn his secrets, you had to hold him fast while he changed his shape."*
*— Homer, The Odyssey*
