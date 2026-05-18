import { readBotState } from "@/lib/botState";
import { listConnectedAccounts } from "@/lib/connectedAccounts";
import { readMt5Accounts } from "@/lib/mt5Store";
import {
  buildConnectedAccountCards,
  buildMt5AccountCards,
  computeAccountsOverview,
} from "@/lib/accounts/accountsDirectoryData";
import { collectAccountsLatestSyncIso } from "@/lib/accounts/accountsPageData";
import type { AccountCard } from "@/lib/accounts/accountsDirectoryTypes";
import type { AccountsPayload } from "@/lib/accounts/accountsPayload";

type BitgetV2BotState = {
  lifecycle?: string;
  positions?: Array<{
    currentEquityUsd?: number;
    entryEquityUsd?: number;
  }>;
};

function appendLoadError(current: string | null, message: string) {
  if (!current) return message;
  return current.split("; ").includes(message) ? current : `${current}; ${message}`;
}

export async function loadAccountsPayload(): Promise<AccountsPayload> {
  let loadError: string | null = null;
  let mt5Accounts: Awaited<ReturnType<typeof readMt5Accounts>> = [];
  let connectedAccounts: Awaited<ReturnType<typeof listConnectedAccounts>> = [];

  try {
    mt5Accounts = await readMt5Accounts();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loadError = appendLoadError(loadError, message);
    console.error("Accounts MT5 load failed:", message);
  }

  let bitgetState: Awaited<ReturnType<typeof readBotState<BitgetV2BotState>>> = null;
  try {
    bitgetState = await readBotState<BitgetV2BotState>("bitget_perp_v2");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loadError = appendLoadError(loadError, message);
    console.error("Bitget bot state load failed:", message);
  }

  try {
    connectedAccounts = await listConnectedAccounts();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loadError = appendLoadError(loadError, message);
    console.error("Connected accounts load failed:", message);
  }

  const mt5Cards: AccountCard[] = buildMt5AccountCards(mt5Accounts);
  const connectedCards: AccountCard[] = buildConnectedAccountCards(connectedAccounts, {
    bitgetState,
  });
  const accounts = [...mt5Cards, ...connectedCards];

  return {
    accounts,
    overview: computeAccountsOverview(accounts),
    latestSync: collectAccountsLatestSyncIso({
      mt5Accounts,
      connectedAccounts,
      bitgetUpdatedAt: bitgetState?.updated_at ?? null,
    }),
    loadError,
    fetchedAtUtc: new Date().toISOString(),
  };
}
