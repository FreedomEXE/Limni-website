import { query, queryOne, transaction } from "./db";

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

export async function readMt5Accounts(): Promise<Mt5AccountSnapshot[]> {
  try {
    const accounts = await query<{
      account_id: string;
      label: string;
      broker: string;
      server: string;
      status: string;
      currency: string;
      equity: string;
      balance: string;
      margin: string;
      free_margin: string;
      basket_state: string;
      open_positions: number;
      open_pairs: number;
      total_lots: string;
      baseline_equity: string;
      locked_profit_pct: string;
      basket_pnl_pct: string;
      weekly_pnl_pct: string;
      risk_used_pct: string;
      trade_count_week: number;
      win_rate_pct: string;
      max_drawdown_pct: string;
      report_date: string;
      api_ok: boolean;
      trading_allowed: boolean;
      last_api_error: string;
      next_add_seconds: number;
      next_poll_seconds: number;
      last_sync_utc: Date;
    }>("SELECT * FROM mt5_accounts ORDER BY account_id");

    const accountsWithPositions = await Promise.all(
      accounts.map(async (account) => {
        const positions = await query<{
          ticket: number;
          symbol: string;
          type: string;
          lots: string;
          open_price: string;
          current_price: string;
          stop_loss: string;
          take_profit: string;
          profit: string;
          swap: string;
          commission: string;
          open_time: Date;
          magic_number: number;
          comment: string;
        }>(
          "SELECT ticket, symbol, type, lots, open_price, current_price, stop_loss, take_profit, profit, swap, commission, open_time, magic_number, comment FROM mt5_positions WHERE account_id = $1",
          [account.account_id]
        );

        return {
          account_id: account.account_id,
          label: account.label,
          broker: account.broker,
          server: account.server,
          status: account.status,
          currency: account.currency,
          equity: Number(account.equity),
          balance: Number(account.balance),
          margin: Number(account.margin),
          free_margin: Number(account.free_margin),
          basket_state: account.basket_state,
          open_positions: account.open_positions,
          open_pairs: account.open_pairs,
          total_lots: Number(account.total_lots),
          baseline_equity: Number(account.baseline_equity),
          locked_profit_pct: Number(account.locked_profit_pct),
          basket_pnl_pct: Number(account.basket_pnl_pct),
          weekly_pnl_pct: Number(account.weekly_pnl_pct),
          risk_used_pct: Number(account.risk_used_pct),
          trade_count_week: account.trade_count_week,
          win_rate_pct: Number(account.win_rate_pct),
          max_drawdown_pct: Number(account.max_drawdown_pct),
          report_date: account.report_date,
          api_ok: account.api_ok,
          trading_allowed: account.trading_allowed,
          last_api_error: account.last_api_error,
          next_add_seconds: account.next_add_seconds,
          next_poll_seconds: account.next_poll_seconds,
          last_sync_utc: account.last_sync_utc.toISOString(),
          positions: positions.map((pos) => ({
            ticket: pos.ticket,
            symbol: pos.symbol,
            type: pos.type as "BUY" | "SELL",
            lots: Number(pos.lots),
            open_price: Number(pos.open_price),
            current_price: Number(pos.current_price),
            stop_loss: Number(pos.stop_loss),
            take_profit: Number(pos.take_profit),
            profit: Number(pos.profit),
            swap: Number(pos.swap),
            commission: Number(pos.commission),
            open_time: pos.open_time.toISOString(),
            magic_number: pos.magic_number,
            comment: pos.comment,
          })),
        };
      })
    );

    return accountsWithPositions;
  } catch (error) {
    console.error("Error reading MT5 accounts from database:", error);
    throw error;
  }
}

export async function writeMt5Accounts(
  accounts: Mt5AccountSnapshot[],
): Promise<void> {
  // This function is deprecated - use upsertMt5Account instead
  for (const account of accounts) {
    await upsertMt5Account(account);
  }
}

export async function upsertMt5Account(
  snapshot: Mt5AccountSnapshot,
): Promise<Mt5AccountSnapshot[]> {
  try {
    await transaction(async (client) => {
      // Upsert account
      await client.query(
        `INSERT INTO mt5_accounts (
          account_id, label, broker, server, status, currency,
          equity, balance, margin, free_margin, basket_state,
          open_positions, open_pairs, total_lots, baseline_equity,
          locked_profit_pct, basket_pnl_pct, weekly_pnl_pct, risk_used_pct,
          trade_count_week, win_rate_pct, max_drawdown_pct, report_date,
          api_ok, trading_allowed, last_api_error, next_add_seconds,
          next_poll_seconds, last_sync_utc
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
        )
        ON CONFLICT (account_id) DO UPDATE SET
          label = EXCLUDED.label,
          broker = EXCLUDED.broker,
          server = EXCLUDED.server,
          status = EXCLUDED.status,
          currency = EXCLUDED.currency,
          equity = EXCLUDED.equity,
          balance = EXCLUDED.balance,
          margin = EXCLUDED.margin,
          free_margin = EXCLUDED.free_margin,
          basket_state = EXCLUDED.basket_state,
          open_positions = EXCLUDED.open_positions,
          open_pairs = EXCLUDED.open_pairs,
          total_lots = EXCLUDED.total_lots,
          baseline_equity = EXCLUDED.baseline_equity,
          locked_profit_pct = EXCLUDED.locked_profit_pct,
          basket_pnl_pct = EXCLUDED.basket_pnl_pct,
          weekly_pnl_pct = EXCLUDED.weekly_pnl_pct,
          risk_used_pct = EXCLUDED.risk_used_pct,
          trade_count_week = EXCLUDED.trade_count_week,
          win_rate_pct = EXCLUDED.win_rate_pct,
          max_drawdown_pct = EXCLUDED.max_drawdown_pct,
          report_date = EXCLUDED.report_date,
          api_ok = EXCLUDED.api_ok,
          trading_allowed = EXCLUDED.trading_allowed,
          last_api_error = EXCLUDED.last_api_error,
          next_add_seconds = EXCLUDED.next_add_seconds,
          next_poll_seconds = EXCLUDED.next_poll_seconds,
          last_sync_utc = EXCLUDED.last_sync_utc,
          updated_at = NOW()`,
        [
          snapshot.account_id,
          snapshot.label,
          snapshot.broker,
          snapshot.server,
          snapshot.status,
          snapshot.currency,
          snapshot.equity,
          snapshot.balance,
          snapshot.margin,
          snapshot.free_margin,
          snapshot.basket_state,
          snapshot.open_positions,
          snapshot.open_pairs,
          snapshot.total_lots,
          snapshot.baseline_equity,
          snapshot.locked_profit_pct,
          snapshot.basket_pnl_pct,
          snapshot.weekly_pnl_pct,
          snapshot.risk_used_pct,
          snapshot.trade_count_week,
          snapshot.win_rate_pct,
          snapshot.max_drawdown_pct,
          snapshot.report_date,
          snapshot.api_ok,
          snapshot.trading_allowed,
          snapshot.last_api_error,
          snapshot.next_add_seconds,
          snapshot.next_poll_seconds,
          new Date(snapshot.last_sync_utc),
        ]
      );

      // Delete old positions for this account
      await client.query("DELETE FROM mt5_positions WHERE account_id = $1", [
        snapshot.account_id,
      ]);

      // Insert new positions
      if (snapshot.positions && snapshot.positions.length > 0) {
        for (const pos of snapshot.positions) {
          await client.query(
            `INSERT INTO mt5_positions (
              account_id, ticket, symbol, type, lots, open_price,
              current_price, stop_loss, take_profit, profit, swap,
              commission, open_time, magic_number, comment
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )`,
            [
              snapshot.account_id,
              pos.ticket,
              pos.symbol,
              pos.type,
              pos.lots,
              pos.open_price,
              pos.current_price,
              pos.stop_loss,
              pos.take_profit,
              pos.profit,
              pos.swap,
              pos.commission,
              new Date(pos.open_time),
              pos.magic_number,
              pos.comment,
            ]
          );
        }
      }

      // Create historical snapshot
      await client.query(
        `INSERT INTO mt5_snapshots (
          account_id, equity, balance, open_positions, basket_pnl_pct,
          weekly_pnl_pct, snapshot_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          snapshot.account_id,
          snapshot.equity,
          snapshot.balance,
          snapshot.open_positions,
          snapshot.basket_pnl_pct,
          snapshot.weekly_pnl_pct,
          new Date(snapshot.last_sync_utc),
        ]
      );
    });

    return await readMt5Accounts();
  } catch (error) {
    console.error("Error upserting MT5 account:", error);
    throw error;
  }
}

export async function getMt5AccountById(
  accountId: string,
): Promise<Mt5AccountSnapshot | null> {
  try {
    const account = await queryOne<{
      account_id: string;
      label: string;
      broker: string;
      server: string;
      status: string;
      currency: string;
      equity: string;
      balance: string;
      margin: string;
      free_margin: string;
      basket_state: string;
      open_positions: number;
      open_pairs: number;
      total_lots: string;
      baseline_equity: string;
      locked_profit_pct: string;
      basket_pnl_pct: string;
      weekly_pnl_pct: string;
      risk_used_pct: string;
      trade_count_week: number;
      win_rate_pct: string;
      max_drawdown_pct: string;
      report_date: string;
      api_ok: boolean;
      trading_allowed: boolean;
      last_api_error: string;
      next_add_seconds: number;
      next_poll_seconds: number;
      last_sync_utc: Date;
    }>("SELECT * FROM mt5_accounts WHERE account_id = $1", [accountId]);

    if (!account) {
      return null;
    }

    const positions = await query<{
      ticket: number;
      symbol: string;
      type: string;
      lots: string;
      open_price: string;
      current_price: string;
      stop_loss: string;
      take_profit: string;
      profit: string;
      swap: string;
      commission: string;
      open_time: Date;
      magic_number: number;
      comment: string;
    }>(
      "SELECT ticket, symbol, type, lots, open_price, current_price, stop_loss, take_profit, profit, swap, commission, open_time, magic_number, comment FROM mt5_positions WHERE account_id = $1",
      [accountId]
    );

    return {
      account_id: account.account_id,
      label: account.label,
      broker: account.broker,
      server: account.server,
      status: account.status,
      currency: account.currency,
      equity: Number(account.equity),
      balance: Number(account.balance),
      margin: Number(account.margin),
      free_margin: Number(account.free_margin),
      basket_state: account.basket_state,
      open_positions: account.open_positions,
      open_pairs: account.open_pairs,
      total_lots: Number(account.total_lots),
      baseline_equity: Number(account.baseline_equity),
      locked_profit_pct: Number(account.locked_profit_pct),
      basket_pnl_pct: Number(account.basket_pnl_pct),
      weekly_pnl_pct: Number(account.weekly_pnl_pct),
      risk_used_pct: Number(account.risk_used_pct),
      trade_count_week: account.trade_count_week,
      win_rate_pct: Number(account.win_rate_pct),
      max_drawdown_pct: Number(account.max_drawdown_pct),
      report_date: account.report_date,
      api_ok: account.api_ok,
      trading_allowed: account.trading_allowed,
      last_api_error: account.last_api_error,
      next_add_seconds: account.next_add_seconds,
      next_poll_seconds: account.next_poll_seconds,
      last_sync_utc: account.last_sync_utc.toISOString(),
      positions: positions.map((pos) => ({
        ticket: pos.ticket,
        symbol: pos.symbol,
        type: pos.type as "BUY" | "SELL",
        lots: Number(pos.lots),
        open_price: Number(pos.open_price),
        current_price: Number(pos.current_price),
        stop_loss: Number(pos.stop_loss),
        take_profit: Number(pos.take_profit),
        profit: Number(pos.profit),
        swap: Number(pos.swap),
        commission: Number(pos.commission),
        open_time: pos.open_time.toISOString(),
        magic_number: pos.magic_number,
        comment: pos.comment,
      })),
    };
  } catch (error) {
    console.error("Error getting MT5 account by ID:", error);
    throw error;
  }
}
