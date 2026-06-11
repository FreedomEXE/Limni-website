export type AccountStatus = "LIVE" | "DEMO" | "PAUSED";
export type BasketState = "IDLE" | "READY" | "ACTIVE" | "PAUSED" | "CLOSED";

export type AccountRecord = {
  id: string;
  label: string;
  broker: string;
  server: string;
  status: AccountStatus;
  currency: string;
  equity: number;
  balance: number;
  lastSyncUtc: string;
  basketState: BasketState;
  openPositions: number;
  openPairs: number;
  totalLots: number;
  riskUsedPct: number;
  weeklyPnlPct: number;
  basketPnlPct: number;
  tradeCountWeek: number;
  winRatePct: number;
  maxDrawdownPct: number;
};

const ACCOUNTS: AccountRecord[] = [
  {
    id: "limni-alpha",
    label: "Limni Alpha",
    broker: "IC Markets",
    server: "ICMarketsSC-Live",
    status: "LIVE",
    currency: "USD",
    equity: 100421.32,
    balance: 100000.0,
    lastSyncUtc: "2026-01-13T15:06:30Z",
    basketState: "ACTIVE",
    openPositions: 10,
    openPairs: 10,
    totalLots: 0.1,
    riskUsedPct: 0.82,
    weeklyPnlPct: 0.42,
    basketPnlPct: 0.57,
    tradeCountWeek: 15,
    winRatePct: 62.5,
    maxDrawdownPct: 0.38,
  },
  {
    id: "limni-beta",
    label: "Limni Beta",
    broker: "Eightcap",
    server: "Eightcap-Demo",
    status: "DEMO",
    currency: "USD",
    equity: 49782.11,
    balance: 50000.0,
    lastSyncUtc: "2026-01-13T14:58:10Z",
    basketState: "READY",
    openPositions: 0,
    openPairs: 0,
    totalLots: 0.0,
    riskUsedPct: 0.0,
    weeklyPnlPct: -0.21,
    basketPnlPct: 0.0,
    tradeCountWeek: 6,
    winRatePct: 50.0,
    maxDrawdownPct: 0.92,
  },
  {
    id: "limni-sandbox",
    label: "Limni Sandbox",
    broker: "FTMO",
    server: "FTMO-Server",
    status: "PAUSED",
    currency: "USD",
    equity: 24890.5,
    balance: 25000.0,
    lastSyncUtc: "2026-01-12T21:44:02Z",
    basketState: "PAUSED",
    openPositions: 3,
    openPairs: 3,
    totalLots: 0.03,
    riskUsedPct: 0.45,
    weeklyPnlPct: 0.08,
    basketPnlPct: 0.12,
    tradeCountWeek: 4,
    winRatePct: 75.0,
    maxDrawdownPct: 0.25,
  },
];

export function getAccounts() {
  return ACCOUNTS;
}

export function getAccountById(accountId: string) {
  return ACCOUNTS.find((account) => account.id === accountId);
}
