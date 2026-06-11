import type { AccountCard } from "@/lib/accounts/accountsDirectoryTypes";

export type AccountsPayload = {
  accounts: AccountCard[];
  overview: {
    totalEquity: number;
    openPositions: number;
    propAccounts: number;
    personalAccounts: number;
  };
  latestSync: string | null;
  loadError: string | null;
  fetchedAtUtc: string;
};
