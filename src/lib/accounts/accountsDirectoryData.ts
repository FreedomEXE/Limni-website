import type { AccountCard } from "@/lib/accounts/accountsDirectoryTypes";

type BotState = {
  state?: {
    entered?: boolean;
    entry_equity?: number | null;
    current_equity?: number | null;
  };
};

type ConnectedAnalysis = {
  equity?: number;
  nav?: number;
  open_positions?: number;
  positions?: unknown[];
  weekly_pnl_pct?: number;
  productType?: string;
  env?: string;
  currency?: string;
  mapped_count?: number;
  fetched_at?: string;
};

function toConnectedAnalysis(
  analysis: Record<string, unknown> | null,
): ConnectedAnalysis | null {
  return analysis as ConnectedAnalysis | null;
}

export function getConnectedAnalysisFetchedAt(
  analysis: Record<string, unknown> | null,
): string | null {
  const typed = toConnectedAnalysis(analysis);
  return typeof typed?.fetched_at === "string" ? typed.fetched_at : null;
}

function resolveConnectedEquity(
  analysis: ConnectedAnalysis | null,
  botState: BotState | null,
) {
  const analysisEquity =
    typeof analysis?.equity === "number"
      ? analysis.equity
      : typeof analysis?.nav === "number"
        ? analysis.nav
        : null;
  return typeof botState?.state?.current_equity === "number"
    ? botState.state.current_equity
    : analysisEquity;
}

function resolveConnectedOpenPositions(analysis: ConnectedAnalysis | null) {
  if (typeof analysis?.open_positions === "number") {
    return analysis.open_positions;
  }
  return Array.isArray(analysis?.positions) ? analysis.positions.filter(Boolean).length : 0;
}

function resolveConnectedWeeklyPnlPct(
  analysis: ConnectedAnalysis | null,
  botState: BotState | null,
) {
  if (typeof analysis?.weekly_pnl_pct === "number") {
    return analysis.weekly_pnl_pct;
  }
  const entry = botState?.state?.entry_equity;
  const current = botState?.state?.current_equity;
  if (typeof entry !== "number" || typeof current !== "number" || entry <= 0) {
    return null;
  }
  return ((current - entry) / entry) * 100;
}

function toFiniteOrNull(value: number | null) {
  return value !== null && Number.isFinite(value) ? value : null;
}

export function buildMt5AccountCards(
  mt5Accounts: Array<{
    account_id: string;
    label: string;
    broker: string;
    server: string;
    status: string;
    currency: string;
    equity: number;
    weekly_pnl_pct: number;
    basket_state: string;
    open_positions: number | null;
    open_pairs: number | null;
    win_rate_pct: number;
    max_drawdown_pct: number;
  }>,
): AccountCard[] {
  return mt5Accounts.map((account) => ({
    account_id: account.account_id,
    label: account.label,
    broker: account.broker,
    server: account.server,
    status: account.status,
    currency: account.currency,
    equity: Number.isFinite(account.equity) ? account.equity : null,
    weekly_pnl_pct: Number.isFinite(account.weekly_pnl_pct) ? account.weekly_pnl_pct : null,
    basket_state: account.basket_state,
    open_positions: account.open_positions,
    open_pairs: account.open_pairs,
    win_rate_pct: Number.isFinite(account.win_rate_pct) ? account.win_rate_pct : null,
    max_drawdown_pct: Number.isFinite(account.max_drawdown_pct) ? account.max_drawdown_pct : null,
    source: "mt5",
    href: `/accounts/${account.account_id}`,
  }));
}

export function buildConnectedAccountCards(
  connectedAccounts: Array<{
    account_key: string;
    provider: "oanda" | "bitget" | "mt5";
    label: string | null;
    status: string | null;
    analysis: Record<string, unknown> | null;
  }>,
  botStates: { bitgetState: BotState | null; oandaState: BotState | null },
): AccountCard[] {
  return connectedAccounts.map((account) => {
    const botState =
      account.provider === "bitget"
        ? botStates.bitgetState
        : account.provider === "oanda"
          ? botStates.oandaState
          : null;
    const analysis = toConnectedAnalysis(account.analysis);
    const openPositions = resolveConnectedOpenPositions(analysis);
    const weeklyPnlPct = resolveConnectedWeeklyPnlPct(analysis, botState);

    return {
      account_id: account.account_key,
      label: account.label ?? `${account.provider.toUpperCase()} account`,
      broker:
        account.provider === "bitget"
          ? "Bitget"
          : account.provider === "oanda"
            ? "OANDA FxTrade"
            : "MT5",
      server: analysis?.productType ?? analysis?.env ?? "Connected",
      status: account.status ?? "LIVE",
      currency: analysis?.currency ?? "USD",
      equity: resolveConnectedEquity(analysis, botState),
      weekly_pnl_pct: toFiniteOrNull(weeklyPnlPct),
      basket_state: botState?.state?.entered ? "ACTIVE" : "READY",
      open_positions: openPositions,
      open_pairs: typeof analysis?.mapped_count === "number" ? analysis.mapped_count : null,
      win_rate_pct: null,
      max_drawdown_pct: null,
      source: account.provider as AccountCard["source"],
      href: `/accounts/connected/${encodeURIComponent(account.account_key)}`,
    };
  });
}

export function computeAccountsOverview(accounts: AccountCard[]) {
  const totalEquity = accounts.reduce(
    (sum, account) => sum + (Number.isFinite(account.equity ?? NaN) ? (account.equity ?? 0) : 0),
    0,
  );
  const activeBaskets = accounts.filter((account) => account.basket_state === "ACTIVE").length;
  return { totalEquity, activeBaskets };
}
