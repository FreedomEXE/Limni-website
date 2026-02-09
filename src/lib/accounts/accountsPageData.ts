import { latestIso } from "@/lib/time";
import { getConnectedAnalysisFetchedAt } from "@/lib/accounts/accountsDirectoryData";

type Mt5SyncLike = {
  last_sync_utc?: string | null;
};

type ConnectedSyncLike = {
  last_sync_utc?: string | null;
  analysis?: Record<string, unknown> | null;
};

export function collectAccountsLatestSyncIso(options: {
  mt5Accounts: Mt5SyncLike[];
  connectedAccounts: ConnectedSyncLike[];
  bitgetUpdatedAt: string | null;
  oandaUpdatedAt: string | null;
}) {
  const { mt5Accounts, connectedAccounts, bitgetUpdatedAt, oandaUpdatedAt } = options;
  return latestIso([
    ...mt5Accounts.map((account) => account.last_sync_utc ?? null),
    bitgetUpdatedAt,
    oandaUpdatedAt,
    ...connectedAccounts.map((account) => account.last_sync_utc ?? null),
    ...connectedAccounts.map((account) =>
      getConnectedAnalysisFetchedAt(account.analysis ?? null),
    ),
  ]);
}
