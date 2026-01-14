import fs from "node:fs/promises";
import path from "node:path";

export type Mt5Position = {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  lots: number;
  open_price: number;
  current_price: number;
  stop_loss: number;
  take_profit: number;
  profit: number;
  swap: number;
  commission: number;
  open_time: string;
  magic_number: number;
  comment: string;
};

export type Mt5AccountSnapshot = {
  account_id: string;
  label: string;
  broker: string;
  server: string;
  status: string;
  currency: string;
  equity: number;
  balance: number;
  margin: number;
  free_margin: number;
  basket_state: string;
  open_positions: number;
  open_pairs: number;
  total_lots: number;
  baseline_equity: number;
  locked_profit_pct: number;
  basket_pnl_pct: number;
  weekly_pnl_pct: number;
  risk_used_pct: number;
  trade_count_week: number;
  win_rate_pct: number;
  max_drawdown_pct: number;
  report_date: string;
  api_ok: boolean;
  trading_allowed: boolean;
  last_api_error: string;
  next_add_seconds: number;
  next_poll_seconds: number;
  last_sync_utc: string;
  positions?: Mt5Position[];
};

const STORE_PATH = path.join(process.cwd(), "data", "mt5_accounts.json");

async function ensureDataDir() {
  const dir = path.dirname(STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
}

export async function readMt5Accounts(): Promise<Mt5AccountSnapshot[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as Mt5AccountSnapshot[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeMt5Accounts(
  accounts: Mt5AccountSnapshot[],
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(accounts, null, 2), "utf-8");
}

export async function upsertMt5Account(
  snapshot: Mt5AccountSnapshot,
): Promise<Mt5AccountSnapshot[]> {
  const accounts = await readMt5Accounts();
  const index = accounts.findIndex(
    (account) => account.account_id === snapshot.account_id,
  );
  if (index >= 0) {
    accounts[index] = snapshot;
  } else {
    accounts.push(snapshot);
  }
  await writeMt5Accounts(accounts);
  return accounts;
}

export async function getMt5AccountById(
  accountId: string,
): Promise<Mt5AccountSnapshot | null> {
  const accounts = await readMt5Accounts();
  return accounts.find((account) => account.account_id === accountId) ?? null;
}
