import { describe, expect, test } from "vitest";
import { collectAccountsLatestSyncIso } from "@/lib/accounts/accountsPageData";

describe("accounts page data helpers", () => {
  test("collects latest sync timestamp across account sources", () => {
    const latest = collectAccountsLatestSyncIso({
      mt5Accounts: [{ last_sync_utc: "2026-02-09T02:00:00.000Z" }],
      connectedAccounts: [
        {
          last_sync_utc: "2026-02-09T03:00:00.000Z",
          analysis: { fetched_at: "2026-02-09T04:00:00.000Z" },
        },
      ],
      bitgetUpdatedAt: "2026-02-09T01:00:00.000Z",
      oandaUpdatedAt: null,
    });

    expect(latest).toBe("2026-02-09T04:00:00.000Z");
  });

  test("returns null when no timestamps are available", () => {
    const latest = collectAccountsLatestSyncIso({
      mt5Accounts: [],
      connectedAccounts: [],
      bitgetUpdatedAt: null,
      oandaUpdatedAt: null,
    });
    expect(latest).toBeNull();
  });
});
