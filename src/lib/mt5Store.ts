import { DateTime } from "luxon";
import { query, queryOne, transaction } from "./db";

function parseJsonArray<T>(value: unknown): T[] | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

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
  min_volume?: number;
  max_volume?: number;
  volume_step?: number;
};

export type Mt5LotMapEntry = {
  symbol: string;
  asset_class: string;
  lot: number;
  target_lot?: number;
  deviation_pct?: number;
  margin_required?: number;
  move_1pct_usd?: number;
};

export type Mt5PlanningDiagnostics = {
  signals_raw_count_by_model?: Record<string, number>;
  signals_accepted_count_by_model?: Record<string, number>;
  signals_skipped_count_by_reason?: Record<string, number>;
  planned_legs?: Array<{
    symbol: string;
    model: string;
    direction: "LONG" | "SHORT";
    units: number;
  }>;
  execution_legs?: Array<{
    symbol: string;
    model: string;
    direction: "LONG" | "SHORT";
    units: number;
    position_id: number;
  }>;
  capacity_limited?: boolean;
  capacity_limit_reason?: string;
};

export type Mt5FrozenPlan = {
  account_id: string;
  week_open_utc: string;
  lot_map: Mt5LotMapEntry[];
  baseline_equity: number;
  captured_sync_utc: string;
};

export type Mt5ClosedPosition = {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  lots: number;
  open_price: number;
  close_price: number;
  profit: number;
  swap: number;
  commission: number;
  open_time: string;
  close_time: string;
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
  trade_mode?: "AUTO" | "MANUAL";
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
  data_source?: string;
  reconstruction_status?: string;
  reconstruction_note?: string;
  reconstruction_window_start_utc?: string;
  reconstruction_window_end_utc?: string;
  reconstruction_market_closed_segments?: number;
  reconstruction_trades?: number;
  reconstruction_week_realized?: number;
  lot_map?: Mt5LotMapEntry[];
  lot_map_updated_utc?: string;
  planning_diagnostics?: Mt5PlanningDiagnostics;
  positions?: Mt5Position[];
  closed_positions?: Mt5ClosedPosition[];
  recent_logs?: string[];
};

export type Mt5ClosedSummary = {
  week_open_utc: string;
  trades: number;
  wins: number;
  losses: number;
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  avg_net: number;
};

export type Mt5ChangeLogEntry = {
  week_open_utc: string;
  account_id: string | null;
  strategy: string | null;
  title: string;
  notes: string | null;
  created_at: string;
};

export type Mt5EquityPoint = {
  snapshot_at: string;
  equity: number;
  balance: number;
  open_positions: number;
  basket_pnl_pct: number;
  weekly_pnl_pct: number;
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
      trade_mode?: string | null;
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
      data_source?: string | null;
      reconstruction_status?: string | null;
      reconstruction_note?: string | null;
      reconstruction_window_start_utc?: Date | null;
      reconstruction_window_end_utc?: Date | null;
      reconstruction_market_closed_segments?: number | null;
      reconstruction_trades?: number | null;
      reconstruction_week_realized?: string | null;
      lot_map?: Mt5LotMapEntry[] | null;
      lot_map_updated_utc?: Date | null;
      planning_diagnostics?: Mt5PlanningDiagnostics | null;
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
          trade_mode:
            account.trade_mode?.toUpperCase() === "MANUAL"
              ? ("MANUAL" as const)
              : ("AUTO" as const),
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
          data_source: account.data_source ?? "realtime",
          reconstruction_status: account.reconstruction_status ?? "none",
          reconstruction_note: account.reconstruction_note ?? "",
          reconstruction_window_start_utc: account.reconstruction_window_start_utc
            ? account.reconstruction_window_start_utc.toISOString()
            : "",
          reconstruction_window_end_utc: account.reconstruction_window_end_utc
            ? account.reconstruction_window_end_utc.toISOString()
            : "",
          reconstruction_market_closed_segments: Number(account.reconstruction_market_closed_segments ?? 0),
          reconstruction_trades: Number(account.reconstruction_trades ?? 0),
          reconstruction_week_realized: Number(account.reconstruction_week_realized ?? 0),
          lot_map: parseJsonArray<Mt5LotMapEntry>(account.lot_map) ?? undefined,
          lot_map_updated_utc: account.lot_map_updated_utc
            ? account.lot_map_updated_utc.toISOString()
            : undefined,
          planning_diagnostics: (account.planning_diagnostics ?? undefined) as Mt5PlanningDiagnostics | undefined,
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
          trade_mode,
          equity, balance, margin, free_margin, basket_state,
          open_positions, open_pairs, total_lots, baseline_equity,
          locked_profit_pct, basket_pnl_pct, weekly_pnl_pct, risk_used_pct,
          trade_count_week, win_rate_pct, max_drawdown_pct, report_date,
          api_ok, trading_allowed, last_api_error, next_add_seconds,
          next_poll_seconds, last_sync_utc,
          data_source, reconstruction_status, reconstruction_note,
          reconstruction_window_start_utc, reconstruction_window_end_utc,
          reconstruction_market_closed_segments, reconstruction_trades, reconstruction_week_realized,
          lot_map, lot_map_updated_utc, planning_diagnostics, recent_logs
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42
        )
        ON CONFLICT (account_id) DO UPDATE SET
          label = EXCLUDED.label,
          broker = EXCLUDED.broker,
          server = EXCLUDED.server,
          status = EXCLUDED.status,
          currency = EXCLUDED.currency,
          trade_mode = EXCLUDED.trade_mode,
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
          data_source = EXCLUDED.data_source,
          reconstruction_status = EXCLUDED.reconstruction_status,
          reconstruction_note = EXCLUDED.reconstruction_note,
          reconstruction_window_start_utc = EXCLUDED.reconstruction_window_start_utc,
          reconstruction_window_end_utc = EXCLUDED.reconstruction_window_end_utc,
          reconstruction_market_closed_segments = EXCLUDED.reconstruction_market_closed_segments,
          reconstruction_trades = EXCLUDED.reconstruction_trades,
          reconstruction_week_realized = EXCLUDED.reconstruction_week_realized,
          lot_map = EXCLUDED.lot_map,
          lot_map_updated_utc = EXCLUDED.lot_map_updated_utc,
          planning_diagnostics = EXCLUDED.planning_diagnostics,
          recent_logs = EXCLUDED.recent_logs,
          updated_at = NOW()`,
        [
          snapshot.account_id,
          snapshot.label,
          snapshot.broker,
          snapshot.server,
          snapshot.status,
          snapshot.currency,
          snapshot.trade_mode ?? "AUTO",
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
          snapshot.data_source ?? "realtime",
          snapshot.reconstruction_status ?? "none",
          snapshot.reconstruction_note ?? "",
          snapshot.reconstruction_window_start_utc ? new Date(snapshot.reconstruction_window_start_utc) : null,
          snapshot.reconstruction_window_end_utc ? new Date(snapshot.reconstruction_window_end_utc) : null,
          snapshot.reconstruction_market_closed_segments ?? 0,
          snapshot.reconstruction_trades ?? 0,
          snapshot.reconstruction_week_realized ?? 0,
          snapshot.lot_map ? JSON.stringify(snapshot.lot_map) : null,
          snapshot.lot_map_updated_utc ? new Date(snapshot.lot_map_updated_utc) : null,
          snapshot.planning_diagnostics ? JSON.stringify(snapshot.planning_diagnostics) : null,
          snapshot.recent_logs ? JSON.stringify(snapshot.recent_logs) : null,
        ]
      );

      // Freeze weekly sizing on first push for the week to keep planned sizes stable.
      const weekOpenUtc = weekOpenUtcForTimestamp(snapshot.last_sync_utc);
      if (
        weekOpenUtc &&
        Array.isArray(snapshot.lot_map) &&
        snapshot.lot_map.length > 0 &&
        Number.isFinite(snapshot.baseline_equity) &&
        snapshot.baseline_equity > 0
      ) {
        await client.query(
          `INSERT INTO mt5_weekly_plans (
             account_id, week_open_utc, lot_map, baseline_equity, captured_sync_utc
           ) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (account_id, week_open_utc) DO NOTHING`,
          [
            snapshot.account_id,
            new Date(weekOpenUtc),
            JSON.stringify(snapshot.lot_map),
            snapshot.baseline_equity,
            new Date(snapshot.last_sync_utc),
          ],
        );
      }

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

      if (snapshot.closed_positions && snapshot.closed_positions.length > 0) {
        for (const pos of snapshot.closed_positions) {
          await client.query(
            `INSERT INTO mt5_closed_positions (
              account_id, ticket, symbol, type, lots, open_price, close_price,
              profit, swap, commission, open_time, close_time, magic_number, comment
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
            ON CONFLICT (account_id, ticket, close_time) DO NOTHING`,
            [
              snapshot.account_id,
              pos.ticket,
              pos.symbol,
              pos.type,
              pos.lots,
              pos.open_price,
              pos.close_price,
              pos.profit,
              pos.swap,
              pos.commission,
              new Date(pos.open_time),
              new Date(pos.close_time),
              pos.magic_number,
              pos.comment,
            ],
          );
        }
      }

      // Create historical snapshot
      await client.query(
        `INSERT INTO mt5_snapshots (
          account_id, equity, balance, open_positions, basket_pnl_pct,
          weekly_pnl_pct, snapshot_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          snapshot.account_id,
          snapshot.equity,
          snapshot.balance,
          snapshot.open_positions,
          snapshot.basket_pnl_pct,
          snapshot.weekly_pnl_pct,
          new Date(snapshot.last_sync_utc),
        ],
      );
    });

    return await readMt5Accounts();
  } catch (error) {
    console.error("Error upserting MT5 account:", error);
    throw error;
  }
}

export async function ensureMt5AccountSchema() {
  // Safe, idempotent schema patch for production where /api/db/migrate wasn't run yet.
  // This prevents MT5 pushes from 500'ing when the EA starts sending new fields.
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS recent_logs JSONB
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS lot_map JSONB
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS lot_map_updated_utc TIMESTAMP
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS trade_mode VARCHAR(12)
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS data_source VARCHAR(24)
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS reconstruction_status VARCHAR(24)
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS reconstruction_note TEXT
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS reconstruction_window_start_utc TIMESTAMP
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS reconstruction_window_end_utc TIMESTAMP
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS reconstruction_market_closed_segments INTEGER DEFAULT 0
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS reconstruction_trades INTEGER DEFAULT 0
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS reconstruction_week_realized NUMERIC(18,2) DEFAULT 0
  `);
  await query(`
    ALTER TABLE mt5_accounts
    ADD COLUMN IF NOT EXISTS planning_diagnostics JSONB
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS mt5_weekly_plans (
      account_id VARCHAR(64) NOT NULL,
      week_open_utc TIMESTAMP NOT NULL,
      lot_map JSONB NOT NULL,
      baseline_equity NUMERIC(18,2) NOT NULL,
      captured_sync_utc TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (account_id, week_open_utc)
    )
  `);
}

export function weekOpenUtcForTimestamp(timestamp: string): string {
  const parsed = DateTime.fromISO(timestamp, { zone: "utc" });
  if (!parsed.isValid) {
    return timestamp;
  }
  const nyTime = parsed.setZone("America/New_York");
  const daysSinceSunday = nyTime.weekday % 7;
  let sunday = nyTime.minus({ days: daysSinceSunday });

  if (daysSinceSunday === 0 && nyTime.hour < 19) {
    sunday = sunday.minus({ days: 7 });
  }

  const open = sunday.set({
    hour: 19,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  return open.toUTC().toISO() ?? timestamp;
}

export async function readMt5FrozenPlan(
  accountId: string,
  weekOpenUtc: string,
): Promise<Mt5FrozenPlan | null> {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!week.isValid) return null;
  const row = await queryOne<{
    account_id: string;
    week_open_utc: Date;
    lot_map: Mt5LotMapEntry[] | string;
    baseline_equity: string;
    captured_sync_utc: Date;
  }>(
    `SELECT account_id, week_open_utc, lot_map, baseline_equity, captured_sync_utc
     FROM mt5_weekly_plans
     WHERE account_id = $1
       AND week_open_utc = $2
     LIMIT 1`,
    [accountId, week.toJSDate()],
  );
  if (!row) return null;
  return {
    account_id: row.account_id,
    week_open_utc: row.week_open_utc.toISOString(),
    lot_map: parseJsonArray<Mt5LotMapEntry>(row.lot_map) ?? [],
    baseline_equity: Number(row.baseline_equity),
    captured_sync_utc: row.captured_sync_utc.toISOString(),
  };
}

export function isMt5WeekOpenUtc(isoValue: string): boolean {
  const parsed = DateTime.fromISO(isoValue, { zone: "utc" });
  if (!parsed.isValid) {
    return false;
  }
  return weekOpenUtcForTimestamp(isoValue) === isoValue;
}

export function getMt5WeekOpenUtc(now = DateTime.utc()): string {
  const nyTime = now.setZone("America/New_York");
  const daysSinceSunday = nyTime.weekday % 7;
  let sunday = nyTime.minus({ days: daysSinceSunday });

  if (daysSinceSunday === 0 && nyTime.hour < 19) {
    sunday = sunday.minus({ days: 7 });
  }

  const open = sunday.set({
    hour: 19,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  return open.toUTC().toISO() ?? now.toUTC().toISO();
}

export async function listMt5WeekOptions(
  accountId: string,
  limit = 6,
): Promise<string[]> {
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 52) : 6;
  const minSnapshot = await queryOne<{ min: Date | null }>(
    "SELECT MIN(snapshot_at) AS min FROM mt5_snapshots WHERE account_id = $1",
    [accountId],
  );
  const minClosed = await queryOne<{ min: Date | null }>(
    "SELECT MIN(close_time) AS min FROM mt5_closed_positions WHERE account_id = $1",
    [accountId],
  );
  const minDate = minSnapshot?.min ?? minClosed?.min ?? null;
  if (!minDate) {
    return [];
  }
  const minWeekOpen = weekOpenUtcForTimestamp(minDate.toISOString());
  const currentWeekOpen = getMt5WeekOpenUtc();
  const minWeek = DateTime.fromISO(minWeekOpen, { zone: "utc" });
  let cursor = DateTime.fromISO(currentWeekOpen, { zone: "utc" });
  if (!minWeek.isValid || !cursor.isValid) {
    return [];
  }
  const weeks: string[] = [];
  while (cursor >= minWeek && weeks.length < safeLimit) {
    weeks.push(cursor.toUTC().toISO() ?? currentWeekOpen);
    cursor = cursor.minus({ days: 7 });
  }
  return weeks;
}

export async function readMt5ClosedPositions(
  accountId: string,
  limit = 200,
): Promise<Mt5ClosedPosition[]> {
  const rows = await query<{
    ticket: number;
    symbol: string;
    type: string;
    lots: string;
    open_price: string;
    close_price: string;
    profit: string;
    swap: string;
    commission: string;
    open_time: Date;
    close_time: Date;
    magic_number: number;
    comment: string;
  }>(
    `SELECT ticket, symbol, type, lots, open_price, close_price, profit, swap,
        commission, open_time, close_time, magic_number, comment
     FROM mt5_closed_positions
     WHERE account_id = $1
     ORDER BY close_time DESC
     LIMIT $2`,
    [accountId, limit],
  );

  return rows.map((row) => ({
    ticket: row.ticket,
    symbol: row.symbol,
    type: row.type as "BUY" | "SELL",
    lots: Number(row.lots),
    open_price: Number(row.open_price),
    close_price: Number(row.close_price),
    profit: Number(row.profit),
    swap: Number(row.swap),
    commission: Number(row.commission),
    open_time: row.open_time.toISOString(),
    close_time: row.close_time.toISOString(),
    magic_number: row.magic_number,
    comment: row.comment,
  }));
}

export async function readMt5ClosedPositionsByWeek(
  accountId: string,
  weekOpenUtc: string,
  limit = 500,
): Promise<Mt5ClosedPosition[]> {
  const start = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!start.isValid) {
    return [];
  }
  const end = start.plus({ days: 7 });
  const rows = await query<{
    ticket: number;
    symbol: string;
    type: string;
    lots: string;
    open_price: string;
    close_price: string;
    profit: string;
    swap: string;
    commission: string;
    open_time: Date;
    close_time: Date;
    magic_number: number;
    comment: string;
  }>(
    `SELECT ticket, symbol, type, lots, open_price, close_price, profit, swap,
        commission, open_time, close_time, magic_number, comment
     FROM mt5_closed_positions
     WHERE account_id = $1
       AND close_time >= $2
       AND close_time < $3
     ORDER BY close_time DESC
     LIMIT $4`,
    [accountId, start.toJSDate(), end.toJSDate(), limit],
  );

  return rows.map((row) => ({
    ticket: row.ticket,
    symbol: row.symbol,
    type: row.type as "BUY" | "SELL",
    lots: Number(row.lots),
    open_price: Number(row.open_price),
    close_price: Number(row.close_price),
    profit: Number(row.profit),
    swap: Number(row.swap),
    commission: Number(row.commission),
    open_time: row.open_time.toISOString(),
    close_time: row.close_time.toISOString(),
    magic_number: row.magic_number,
    comment: row.comment,
  }));
}

export async function readMt5ClosedSummary(
  accountId: string,
  weeks = 12,
): Promise<Mt5ClosedSummary[]> {
  const safeWeeks =
    Number.isFinite(weeks) && weeks > 0 ? Math.min(weeks, 104) : 12;
  const rows = await query<{
    profit: string;
    swap: string;
    commission: string;
    close_time: Date;
  }>(
    `SELECT profit, swap, commission, close_time
     FROM mt5_closed_positions
     WHERE account_id = $1
       AND close_time >= NOW() - make_interval(weeks => $2)
     ORDER BY close_time DESC`,
    [accountId, safeWeeks],
  );

  const byWeek = new Map<string, Mt5ClosedSummary>();

  for (const row of rows) {
    const closeTime = row.close_time.toISOString();
    const weekOpen = weekOpenUtcForTimestamp(closeTime);
    const net = Number(row.profit) + Number(row.swap) + Number(row.commission);
    const current = byWeek.get(weekOpen) ?? {
      week_open_utc: weekOpen,
      trades: 0,
      wins: 0,
      losses: 0,
      net_profit: 0,
      gross_profit: 0,
      gross_loss: 0,
      avg_net: 0,
    };

    current.trades += 1;
    current.net_profit += net;
    if (net >= 0) {
      current.wins += 1;
      current.gross_profit += net;
    } else {
      current.losses += 1;
      current.gross_loss += Math.abs(net);
    }
    current.avg_net = current.trades > 0 ? current.net_profit / current.trades : 0;
    byWeek.set(weekOpen, current);
  }

  return Array.from(byWeek.values()).sort((a, b) =>
    b.week_open_utc.localeCompare(a.week_open_utc),
  );
}

export async function readMt5ClosedNetForWeek(
  accountId: string,
  weekOpenUtc: string,
): Promise<{ net: number; trades: number }> {
  const start = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!start.isValid) {
    return { net: 0, trades: 0 };
  }
  const end = start.plus({ days: 7 });
  const row = await queryOne<{
    net: string | null;
    trades: string | null;
  }>(
    `SELECT
      COALESCE(SUM(profit + swap + commission), 0) AS net,
      COUNT(*)::text AS trades
     FROM mt5_closed_positions
     WHERE account_id = $1
       AND close_time >= $2
       AND close_time < $3`,
    [accountId, start.toJSDate(), end.toJSDate()],
  );
  return {
    net: row?.net ? Number(row.net) : 0,
    trades: row?.trades ? Number(row.trades) : 0,
  };
}

export async function readMt5DrawdownRange(
  accountId: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const start = DateTime.fromISO(startIso, { zone: "utc" });
  const end = DateTime.fromISO(endIso, { zone: "utc" });
  if (!start.isValid || !end.isValid || end <= start) {
    return 0;
  }

  const rows = await query<{ equity: string }>(
    `SELECT equity
     FROM mt5_snapshots
     WHERE account_id = $1
       AND snapshot_at >= $2
       AND snapshot_at < $3
     ORDER BY snapshot_at ASC`,
    [accountId, start.toJSDate(), end.toJSDate()],
  );

  let peak = 0;
  let maxDrawdown = 0;
  for (const row of rows) {
    const equity = Number(row.equity);
    if (!Number.isFinite(equity) || equity <= 0) {
      continue;
    }
    if (equity > peak) {
      peak = equity;
    }
    if (peak > 0) {
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
    }
  }

  return maxDrawdown;
}

export async function readMt5EquityCurveByRange(
  accountId: string,
  startIso: string,
  endIso: string,
): Promise<Mt5EquityPoint[]> {
  const start = DateTime.fromISO(startIso, { zone: "utc" });
  const end = DateTime.fromISO(endIso, { zone: "utc" });
  if (!start.isValid || !end.isValid || end <= start) {
    return [];
  }

  const rows = await query<{
    equity: string;
    balance: string;
    open_positions: number;
    basket_pnl_pct: string;
    weekly_pnl_pct: string;
    snapshot_at: Date;
  }>(
    `SELECT equity, balance, open_positions, basket_pnl_pct, weekly_pnl_pct, snapshot_at
     FROM mt5_snapshots
     WHERE account_id = $1
       AND snapshot_at >= $2
       AND snapshot_at < $3
     ORDER BY snapshot_at ASC`,
    [accountId, start.toJSDate(), end.toJSDate()],
  );

  return rows.map((row) => ({
    snapshot_at: row.snapshot_at.toISOString(),
    equity: Number(row.equity),
    balance: Number(row.balance),
    open_positions: Number(row.open_positions ?? 0),
    basket_pnl_pct: Number(row.basket_pnl_pct),
    weekly_pnl_pct: Number(row.weekly_pnl_pct),
  }));
}

export async function readMt5ChangeLog(
  accountId: string | null = null,
  weeks = 12,
): Promise<Mt5ChangeLogEntry[]> {
  const safeWeeks =
    Number.isFinite(weeks) && weeks > 0 ? Math.min(weeks, 104) : 12;
  const rows = await query<{
    week_open_utc: Date;
    account_id: string | null;
    strategy: string | null;
    title: string;
    notes: string | null;
    created_at: Date;
  }>(
    `SELECT week_open_utc, account_id, strategy, title, notes, created_at
     FROM mt5_change_log
     WHERE ($1::varchar IS NULL OR account_id = $1)
       AND week_open_utc >= NOW() - make_interval(weeks => $2)
     ORDER BY week_open_utc DESC, created_at DESC`,
    [accountId, safeWeeks],
  );

  return rows.map((row) => ({
    week_open_utc: row.week_open_utc.toISOString(),
    account_id: row.account_id,
    strategy: row.strategy,
    title: row.title,
    notes: row.notes,
    created_at: row.created_at.toISOString(),
  }));
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
      trade_mode?: string | null;
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
      data_source?: string | null;
      reconstruction_status?: string | null;
      reconstruction_note?: string | null;
      reconstruction_window_start_utc?: Date | null;
      reconstruction_window_end_utc?: Date | null;
      reconstruction_market_closed_segments?: number | null;
      reconstruction_trades?: number | null;
      reconstruction_week_realized?: string | null;
      recent_logs?: string[] | null;
      lot_map?: Mt5LotMapEntry[] | null;
      lot_map_updated_utc?: Date | null;
      planning_diagnostics?: Mt5PlanningDiagnostics | null;
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
      trade_mode:
        account.trade_mode?.toUpperCase() === "MANUAL"
          ? ("MANUAL" as const)
          : ("AUTO" as const),
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
      data_source: account.data_source ?? "realtime",
      reconstruction_status: account.reconstruction_status ?? "none",
      reconstruction_note: account.reconstruction_note ?? "",
      reconstruction_window_start_utc: account.reconstruction_window_start_utc
        ? account.reconstruction_window_start_utc.toISOString()
        : "",
      reconstruction_window_end_utc: account.reconstruction_window_end_utc
        ? account.reconstruction_window_end_utc.toISOString()
        : "",
      reconstruction_market_closed_segments: Number(account.reconstruction_market_closed_segments ?? 0),
      reconstruction_trades: Number(account.reconstruction_trades ?? 0),
      reconstruction_week_realized: Number(account.reconstruction_week_realized ?? 0),
      lot_map: parseJsonArray<Mt5LotMapEntry>(account.lot_map) ?? undefined,
      lot_map_updated_utc: account.lot_map_updated_utc
        ? account.lot_map_updated_utc.toISOString()
        : undefined,
      planning_diagnostics: (account.planning_diagnostics ?? undefined) as Mt5PlanningDiagnostics | undefined,
      recent_logs: account.recent_logs ?? undefined,
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
