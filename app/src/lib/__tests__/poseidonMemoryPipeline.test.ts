import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildArchiveDocument,
  buildEntryBlocks,
  validateCurationResponse,
  verifyArchiveWrite,
} from "@/lib/poseidon/curation-schema";
import { withStateLock } from "@/lib/poseidon/state-mutex";

type TempEnv = {
  root: string;
  stateDirAbs: string;
  memoryDirAbs: string;
};

const createdTempRoots: string[] = [];

async function setupPoseidonEnv(): Promise<TempEnv> {
  const root = await mkdtemp(path.join(os.tmpdir(), "poseidon-memory-test-"));
  createdTempRoots.push(root);

  const stateDirAbs = path.join(root, "state");
  const memoryDirAbs = path.join(root, "memory");
  await mkdir(stateDirAbs, { recursive: true });
  await mkdir(memoryDirAbs, { recursive: true });

  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_OWNER_ID = "1";
  process.env.ANTHROPIC_API_KEY = "test-api-key";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.POSEIDON_STATE_DIR = stateDirAbs;
  process.env.POSEIDON_MEMORY_DIR = memoryDirAbs;

  return { root, stateDirAbs, memoryDirAbs };
}

afterEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  while (createdTempRoots.length > 0) {
    const root = createdTempRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

describe("poseidon memory pipeline hardening", () => {
  it("keeps newest session state when truncating", async () => {
    await setupPoseidonEnv();
    const { capStateToNewestWindow } = await import("@/lib/poseidon/memory");

    expect(capStateToNewestWindow("abcdefghij", 4)).toBe("ghij");
    expect(capStateToNewestWindow("abcdefghij", 20)).toBe("abcdefghij");
  });

  it("accepts curation responses with extra keys but rejects missing required keys", () => {
    const parsed = validateCurationResponse({
      active_state: "## Active Context\n- Working thread",
      archive_entries: [
        {
          date: "2026-02-27",
          title: "Same Title",
          summary: "Summary",
          content: "Archived content",
          category: "extra-field-allowed",
        },
      ],
      archive_summary: "Month summary",
      curation_notes: "Kept active work in state.",
      confidence: 0.93,
    });

    expect(parsed.active_state).toContain("Active Context");
    expect(parsed.archive_entries).toHaveLength(1);

    expect(() =>
      validateCurationResponse({
        archive_entries: [],
        archive_summary: "Month summary",
        curation_notes: "Missing active state",
      }),
    ).toThrow(/Missing required key: active_state/);
  });

  it("verifies archive writes using title, content, and fingerprint checks", () => {
    const entries = [
      {
        date: "2026-02-27",
        title: "Liquidation Initiative",
        summary: "Captured data expansion plan.",
        content: "Tracked full ladder bands for ETH and BTC.",
      },
      {
        date: "2026-02-28",
        title: "Liquidation Initiative",
        summary: "Captured second checkpoint.",
        content: "Validated milestone mapping after cluster sweep.",
      },
    ];

    const blocks = buildEntryBlocks(entries);
    const archive = buildArchiveDocument("February 2026", "Summary", "", blocks);
    const ok = verifyArchiveWrite(archive, entries);
    expect(ok.ok).toBe(true);

    const tampered = archive.replace("Validated milestone mapping after cluster sweep.", "");
    const bad = verifyArchiveWrite(tampered, entries);
    expect(bad.ok).toBe(false);
  });

  it("retries turn persistence once, then saves to missed_turns via fallback", async () => {
    await setupPoseidonEnv();

    const failingAppend = vi
      .fn()
      .mockRejectedValueOnce(new Error("db write failure #1"))
      .mockRejectedValueOnce(new Error("db write failure #2"));

    // Track what gets written to the missed turns KV store
    const missedTurnsStore: string[] = [];
    const mockKvGet = vi.fn().mockResolvedValue("[]");
    const mockKvSet = vi.fn().mockImplementation(async (_key: string, value: string) => {
      missedTurnsStore.push(value);
    });

    vi.doMock("@/lib/poseidon/state", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/poseidon/state")>();
      return {
        ...actual,
        appendConversationTurnToState: failingAppend,
      };
    });

    vi.doMock("@/lib/poseidon/state-db", () => ({
      kvGet: mockKvGet,
      kvSet: mockKvSet,
    }));

    const { persistTurnWithRetry } = await import("@/lib/poseidon/turn-persistence");

    await persistTurnWithRetry("user test", "assistant test", { retryDelayMs: 0 });

    expect(failingAppend).toHaveBeenCalledTimes(2);

    // Verify missed turn was written via kvSet
    expect(mockKvSet).toHaveBeenCalled();
    const lastWrite = missedTurnsStore[missedTurnsStore.length - 1];
    expect(lastWrite).toBeDefined();
    const parsed = JSON.parse(lastWrite!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.user_message).toBe("user test");
    expect(parsed[0]?.assistant_message).toBe("assistant test");
  });

  it("supports reentrant state locking without deadlock", async () => {
    let reachedInner = false;
    const nested = withStateLock(async () => {
      await withStateLock(async () => {
        reachedInner = true;
      });
    });

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("state lock deadlock")), 300);
    });

    await expect(Promise.race([nested, timeout])).resolves.toBeUndefined();
    expect(reachedInner).toBe(true);
  });
});
