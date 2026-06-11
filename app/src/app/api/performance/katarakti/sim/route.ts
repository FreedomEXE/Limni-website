/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * API endpoint for managing Katarakti simulation weekly results.
 * POST to insert/upsert weekly simulation data (percent returns, not USD).
 * GET to read current simulation results for a given market.
 * Protected by CRON_SECRET.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { query, queryOne } from "@/lib/db";
import { clearRuntimeCacheByPrefix } from "@/lib/runtimeCache";

type SimWeeklyInput = {
  market: "crypto_futures" | "mt5_forex";
  week_open_utc: string;
  return_pct: number;
  trades?: number;
  wins?: number;
  losses?: number;
  static_drawdown_pct?: number;
  gross_profit_pct?: number;
  gross_loss_pct?: number;
  source?: string;
  notes?: string;
};

function isValidMarket(value: unknown): value is "crypto_futures" | "mt5_forex" {
  return value === "crypto_futures" || value === "mt5_forex";
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function parseSimInput(body: unknown): { input: SimWeeklyInput; error: null } | { input: null; error: string } {
  if (!body || typeof body !== "object") {
    return { input: null, error: "Request body must be a JSON object" };
  }

  const obj = body as Record<string, unknown>;

  if (!isValidMarket(obj.market)) {
    return { input: null, error: "market must be 'crypto_futures' or 'mt5_forex'" };
  }

  if (!isValidIsoDate(obj.week_open_utc)) {
    return { input: null, error: "week_open_utc must be a valid ISO date string" };
  }

  const returnPct = Number(obj.return_pct);
  if (!Number.isFinite(returnPct)) {
    return { input: null, error: "return_pct must be a finite number" };
  }

  return {
    input: {
      market: obj.market,
      week_open_utc: new Date(obj.week_open_utc as string).toISOString(),
      return_pct: returnPct,
      trades: Number.isFinite(Number(obj.trades)) ? Math.max(0, Math.round(Number(obj.trades))) : 0,
      wins: Number.isFinite(Number(obj.wins)) ? Math.max(0, Math.round(Number(obj.wins))) : 0,
      losses: Number.isFinite(Number(obj.losses)) ? Math.max(0, Math.round(Number(obj.losses))) : 0,
      static_drawdown_pct: Number.isFinite(Number(obj.static_drawdown_pct)) ? Number(obj.static_drawdown_pct) : 0,
      gross_profit_pct: Number.isFinite(Number(obj.gross_profit_pct)) ? Number(obj.gross_profit_pct) : undefined,
      gross_loss_pct: Number.isFinite(Number(obj.gross_loss_pct)) ? Number(obj.gross_loss_pct) : undefined,
      source: typeof obj.source === "string" ? obj.source.trim() : "manual",
      notes: typeof obj.notes === "string" ? obj.notes.trim() : undefined,
    },
    error: null,
  };
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const market = request.nextUrl.searchParams.get("market");

  try {
    const whereClause = isValidMarket(market) ? "WHERE market = $1" : "";
    const params = isValidMarket(market) ? [market] : [];
    const rows = await query<{
      id: number;
      market: string;
      week_open_utc: Date | string;
      return_pct: number;
      trades: number;
      wins: number;
      losses: number;
      static_drawdown_pct: number;
      gross_profit_pct: number;
      gross_loss_pct: number;
      source: string;
      notes: string | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT * FROM katarakti_sim_weekly ${whereClause} ORDER BY market, week_open_utc ASC`,
      params,
    );

    return NextResponse.json({ rows, count: rows.length });
  } catch (error) {
    console.error("GET /api/performance/katarakti/sim error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read simulation data" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const items: unknown[] = Array.isArray(body) ? body : [body];
    const results: Array<{ market: string; week_open_utc: string; action: string }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const parsed = parseSimInput(items[i]);
      if (parsed.error || !parsed.input) {
        errors.push({ index: i, error: parsed.error ?? "Invalid input" });
        continue;
      }

      const input = parsed.input;
      const grossProfitPct = input.gross_profit_pct ?? (input.return_pct > 0 ? input.return_pct : 0);
      const grossLossPct = input.gross_loss_pct ?? (input.return_pct < 0 ? Math.abs(input.return_pct) : 0);

      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM katarakti_sim_weekly WHERE market = $1 AND week_open_utc = $2`,
        [input.market, input.week_open_utc],
      );

      if (existing) {
        await query(
          `UPDATE katarakti_sim_weekly SET
            return_pct = $3,
            trades = $4,
            wins = $5,
            losses = $6,
            static_drawdown_pct = $7,
            gross_profit_pct = $8,
            gross_loss_pct = $9,
            source = $10,
            notes = $11,
            updated_at = NOW()
          WHERE market = $1 AND week_open_utc = $2`,
          [
            input.market,
            input.week_open_utc,
            input.return_pct,
            input.trades,
            input.wins,
            input.losses,
            input.static_drawdown_pct,
            grossProfitPct,
            grossLossPct,
            input.source,
            input.notes ?? null,
          ],
        );
        results.push({
          market: input.market,
          week_open_utc: input.week_open_utc,
          action: "updated",
        });
      } else {
        await query(
          `INSERT INTO katarakti_sim_weekly
            (market, week_open_utc, return_pct, trades, wins, losses,
             static_drawdown_pct, gross_profit_pct, gross_loss_pct, source, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            input.market,
            input.week_open_utc,
            input.return_pct,
            input.trades,
            input.wins,
            input.losses,
            input.static_drawdown_pct,
            grossProfitPct,
            grossLossPct,
            input.source,
            input.notes ?? null,
          ],
        );
        results.push({
          market: input.market,
          week_open_utc: input.week_open_utc,
          action: "inserted",
        });
      }
    }

    clearRuntimeCacheByPrefix("performance:kataraktiHistory");

    return NextResponse.json({
      ok: true,
      processed: results.length,
      errors: errors.length > 0 ? errors : undefined,
      results,
    });
  } catch (error) {
    console.error("POST /api/performance/katarakti/sim error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save simulation data" },
      { status: 500 },
    );
  }
}
