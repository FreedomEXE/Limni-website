/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/

# Poseidon Hardening Pass — Implementation Prompt

> Based on Codex review findings. CTO-approved approaches for each item.
> Priority order: Fix #1 and #5 first (P0), then the rest.

---

## Finding 1 — CRITICAL: Truncation drops newest state first

**File**: `src/lib/poseidon/memory.ts:133-134`

**Problem**: `sessionState.slice(0, availableForState)` keeps the beginning of PROTEUS_STATE.md and cuts the end. Since new context is appended to the bottom, this drops the freshest information first. Opposite of desired behavior.

**Fix**: Change to `sessionState.slice(-availableForState)` so we keep the NEWEST state and drop the oldest. The oldest context is what Poseidon should have already archived anyway.

```typescript
// BEFORE (wrong — drops newest)
const cappedState = availableForState > 0
  ? sessionState.slice(0, availableForState)
  : "";

// AFTER (correct — keeps newest)
const cappedState = availableForState > 0
  ? sessionState.slice(-availableForState)
  : "";
```

Update the truncation note to say `[Oldest session state truncated to fit prompt budget. Run /reckoning or request curation to archive.]`

---

## Finding 2 — MEDIUM (not critical): Offline messages dropped

**File**: `src/lib/poseidon/index.ts:184`

**Problem**: `dropPendingUpdates: true` means messages sent while bot is offline are lost.

**Approach**: This is INTENTIONAL. Processing stale messages out of context is worse than dropping them. However, we should notify Freedom that messages were missed.

**Fix**: Instead of just `dropPendingUpdates: true`, add a recovery notification after bot launch. The flow:

1. Before calling `bot.launch()`, fetch pending update count via Telegram `getUpdates` API (or use `getWebhookInfo`).
2. If there were pending updates > 0, after bot launches send Freedom a message like: `"I was offline and missed [N] message(s). Let me know if you need me to pick up where we left off."`
3. If fetching the count fails or returns 0, skip the notification silently.

Keep `dropPendingUpdates: true` — we do NOT want to process stale messages.

**Implementation hint**: Use `bot.telegram.getUpdates(0, 1, 0)` before `bot.launch()` to peek at whether updates exist. This call returns an array; check its length. After peeking, proceed with `bot.launch({ dropPendingUpdates: true })` as before. If length > 0, send the notification after launch succeeds.

Note: `getUpdates` may not return exact count — it returns a batch. Just check if the array is non-empty. Message can say "I missed some messages while offline" without specifying a count if exact count isn't available.

---

## Finding 3 — HIGH: State persistence is best-effort

**File**: `src/lib/poseidon/index.ts:169-170`

**Problem**: `appendConversationTurnToState` failure is caught and logged but not retried.

**Approach**: Do NOT fail closed (crashing the bot on state write failure is worse). The user must always get their response. But we should retry once before giving up.

**Fix**: Add a single retry with a short delay. If both attempts fail, log the error AND append to a local `missed_turns.json` file so the data isn't lost. Poseidon can pick these up during curation.

```typescript
// Pseudocode for the replacement
async function persistTurnWithRetry(userMsg: string, assistantMsg: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await appendConversationTurnToState(userMsg, assistantMsg);
      return;
    } catch (error) {
      if (attempt === 0) {
        console.warn("[poseidon] state persist failed, retrying once...");
        await new Promise(r => setTimeout(r, 500));
      } else {
        console.error("[poseidon] state persist failed after retry:", error);
        // Append to missed turns file so data isn't lost
        await appendMissedTurn(userMsg, assistantMsg).catch(() => undefined);
      }
    }
  }
}
```

Create `missed_turns.json` in the state directory. Same pattern as `activity_log.json` — append-only, capped array. Poseidon reads and replays missed turns during curation, then clears the file.

---

## Finding 4 — HIGH: Archive verification too weak

**File**: `src/lib/poseidon/poseidon-curator.ts:302-303`

**Problem**: Verification only checks title markers (`### date - title`). Duplicate titles can false-pass. Content integrity isn't proven.

**Fix**: In addition to checking title markers, compute a simple content hash for each new entry and verify the hash matches what's in the written file.

```typescript
import { createHash } from "node:crypto";

function entryFingerprint(entry: ArchiveEntry): string {
  return createHash("sha256")
    .update(`${entry.date}|${entry.title}|${entry.content}`)
    .digest("hex")
    .slice(0, 16);
}
```

After writing the tmp file and reading it back:
1. Check all title markers exist (existing check)
2. Check all entry content blocks exist via substring match on `entry.content`
3. Verify the byte length of the written file is >= expected minimum (sum of all entry content lengths)

This gives three layers of verification without over-engineering.

---

## Finding 5 — HIGH (P0): Curation parser rejects harmless model variance

**File**: `src/lib/poseidon/poseidon-curator.ts:142-145, 167-170`

**Problem**: Strict exact-key validation (`keys.length !== expected.length`) means if Opus returns one extra field (like `"reasoning"` or `"confidence"`), the entire curation is aborted. This WILL happen in production.

**Fix**: Change from "reject if extra keys" to "extract required keys, ignore extras". Keep validation strict on the required keys being present and correctly typed, but don't reject the response for having additional keys.

```typescript
// BEFORE (brittle — rejects extra keys)
const keys = Object.keys(obj).sort();
const expected = [...].sort();
if (keys.length !== expected.length || keys.some(...)) {
  throw new Error(...);
}

// AFTER (resilient — requires keys, ignores extras)
const required = ["active_state", "archive_entries", "archive_summary", "curation_notes"];
for (const key of required) {
  if (!(key in obj)) {
    throw new Error(`Missing required key: ${key}`);
  }
}
```

Apply the same pattern to archive entry validation — check that `date`, `title`, `summary`, `content` all exist, but don't reject if the model adds an extra field like `"category"` or `"importance"`.

---

## Finding 6 — MEDIUM: Non-reentrant lock

**File**: `src/lib/poseidon/state-mutex.ts:18`

**Problem**: If code inside a `withStateLock` block calls another function that also uses `withStateLock`, it deadlocks.

**Fix**: Add reentrancy detection. If the lock is already held by the current execution context, allow reentry. Use a simple depth counter.

```typescript
let locked = false;
let depth = 0;
const queue: Array<() => void> = [];

export async function withStateLock<T>(fn: () => Promise<T>): Promise<T> {
  if (locked && depth === 0) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }

  locked = true;
  depth += 1;
  try {
    return await fn();
  } finally {
    depth -= 1;
    if (depth === 0) {
      locked = false;
      const next = queue.shift();
      if (next) next();
    }
  }
}
```

Note: Node.js is single-threaded so true reentrancy in the pthread sense doesn't apply. The real risk is an async function inside the lock that awaits something which triggers another lock acquisition. The depth counter handles this.

---

## Finding 7 — MEDIUM: State in git could leak sensitive context

**Problem**: `PROTEUS_STATE.md` is committed to git. If repo access broadens, trading positions and psychological notes are exposed.

**Fix**: Add `PROTEUS_STATE.md` to `.gitignore`. The state file lives on the Render server's filesystem — it doesn't need to be in git. Archives similarly should be gitignored since they contain the same sensitive data.

Add to `.gitignore`:
```
# Poseidon runtime state (sensitive — lives on server only)
docs/ai/poseidon/state/
docs/ai/poseidon/archives/
```

If `PROTEUS_STATE.md` is already tracked by git, run `git rm --cached` on it after adding to gitignore.

Verify the state directory path matches what's used in `config.stateDir` before adding the ignore pattern.

---

## Finding 8 — MEDIUM: No test harness for memory pipeline

**Fix**: Create a test file at `src/lib/poseidon/__tests__/memory-pipeline.test.ts` with these test cases:

1. **Truncation direction**: Verify `loadSystemPrompt()` keeps the END of state when truncation is needed (mock a state file larger than budget, confirm the last N chars are preserved)
2. **Curation parse resilience**: Feed `validateCurationResponse` valid JSON with extra keys, confirm it passes. Feed it missing keys, confirm it rejects.
3. **Archive verification**: Test `buildArchiveDocument` + entry verification logic with duplicate titles, confirm behavior.
4. **Missed turn persistence**: Simulate a state write failure, confirm the turn is saved to `missed_turns.json`.
5. **Lock reentrancy**: Call `withStateLock` from inside `withStateLock`, confirm no deadlock.

Use the existing test framework in the project (check `package.json` for jest/vitest). Keep tests focused and fast — no API calls, mock everything external.

---

## Implementation Order

1. **Finding 1** (truncation direction) — 5 min fix, highest impact
2. **Finding 5** (resilient parsing) — 10 min fix, prevents production curation failures
3. **Finding 4** (archive verification) — 15 min, content hash + byte length check
4. **Finding 3** (retry + missed turns) — 20 min, new missed_turns mechanism
5. **Finding 6** (reentrant lock) — 5 min, depth counter
6. **Finding 2** (offline notification) — 15 min, getUpdates peek
7. **Finding 7** (gitignore sensitive state) — 5 min
8. **Finding 8** (tests) — 30 min, covers all the above

**Total estimate**: ~2 hours

---

## Acceptance Criteria

- [ ] State truncation preserves newest content (slice from end)
- [ ] Curation parser accepts responses with extra keys
- [ ] Archive verification checks content, not just titles
- [ ] Failed state writes retry once, then persist to missed_turns.json
- [ ] Lock supports reentry without deadlock
- [ ] Bot notifies Freedom if messages were missed during downtime
- [ ] PROTEUS_STATE.md and archives are gitignored
- [ ] Test file covers truncation, parsing, verification, missed turns, and lock behavior
