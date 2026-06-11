/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Hourly cron that scans M5 candles for all directional signals and
 * detects ADR trades using the Fresh Start state machine. Writes
 * results to strategy_backtest_trades for the matrix to display.
 * Delegates to shared scanWeekTrades() for the actual work.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import {
  finishSchedulerRunReceipt,
  recordMaterializationRunReceipt,
  startSchedulerRunReceipt,
} from "@/lib/appTruth/runLedger";
import { isCronAuthorized } from "@/lib/cronAuth";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { scanWeekTrades } from "@/lib/flagship/adrWeekScanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const startedAtUtc = new Date().toISOString();
  const nowUtc = DateTime.utc();
  const url = new URL(request.url);
  const weekOverride = url.searchParams.get("week");
  const weekOpenUtc = weekOverride ?? getCanonicalWeekOpenUtc(nowUtc);
  let schedulerRunId: string | null = null;
  let materializationRunId: string | null = null;
  const ledgerErrors: string[] = [];

  try {
    const receipt = await startSchedulerRunReceipt({
      jobId: "adr-trade-scan",
      jobType: "trade_row_materialization",
      triggerType: weekOverride ? "manual" : "schedule",
      routePath: "/api/cron/adr-trade-scan",
      schedule: weekOverride ? null : "25 * * * *",
      startedAtUtc,
      inputArtifacts: ["strategy_backtest_runs", "canonical_price_bars", "source direction rows"],
      requiredInputs: ["week source directions", "M5 price candles", "ADR scanner config"],
      metadata: { weekOpenUtc, weekOverride: weekOverride ?? null },
    });
    schedulerRunId = receipt.runId;
  } catch (error) {
    ledgerErrors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const result = await scanWeekTrades(weekOpenUtc);
    const finishedAt = new Date().toISOString();
    const runStatus = result.errors.length > 0 ? "degraded" : "succeeded";

    if (schedulerRunId) {
      try {
        await finishSchedulerRunReceipt({
          runId: schedulerRunId,
          completedAtUtc: finishedAt,
          outputArtifacts: [`strategy_backtest_trades:${result.totalTrades}`],
          namespaceProduced: "strategy_backtest_trades",
          status: runStatus,
          degradedReasons: result.errors,
          metadata: {
            weekOpenUtc,
            signalsProcessed: result.signalsProcessed,
            totalTrades: result.totalTrades,
            totalTpHits: result.totalTpHits,
            totalActive: result.totalActive,
            weekReturnPct: result.weekReturnPct,
          },
        });
      } catch (error) {
        ledgerErrors.push(error instanceof Error ? error.message : String(error));
      }
      try {
        const receipt = await recordMaterializationRunReceipt({
          schedulerRunId,
          materializationType: "adr_trade_rows",
          domain: "performance",
          weekWindow: [weekOpenUtc],
          rowsTouched: result.totalTrades,
          inputArtifacts: ["strategy_backtest_runs", "canonical_price_bars", "source direction rows"],
          outputArtifacts: ["strategy_backtest_trades"],
          namespaceProduced: "strategy_backtest_trades",
          status: runStatus,
          degradedReasons: result.errors,
          startedAtUtc,
          completedAtUtc: finishedAt,
          metadata: {
            signalsProcessed: result.signalsProcessed,
            totalTpHits: result.totalTpHits,
            totalActive: result.totalActive,
            weekReturnPct: result.weekReturnPct,
          },
        });
        materializationRunId = receipt.runId;
      } catch (error) {
        ledgerErrors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return NextResponse.json({
      status: "ok",
      durationMs: Date.now() - startedAt,
      weekOpenUtc,
      signalsProcessed: result.signalsProcessed,
      totalTrades: result.totalTrades,
      totalTpHits: result.totalTpHits,
      totalActive: result.totalActive,
      weekReturnPct: result.weekReturnPct,
      errors: result.errors.length > 0 ? result.errors : undefined,
      appTruthLedger: {
        schedulerRunId,
        materializationRunId,
        errors: ledgerErrors.length > 0 ? ledgerErrors : undefined,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADR trade scan failed";
    const finishedAt = new Date().toISOString();
    if (schedulerRunId) {
      try {
        await finishSchedulerRunReceipt({
          runId: schedulerRunId,
          completedAtUtc: finishedAt,
          status: "failed",
          errorMessage: message,
          degradedReasons: [message],
        });
      } catch (ledgerError) {
        ledgerErrors.push(ledgerError instanceof Error ? ledgerError.message : String(ledgerError));
      }
      try {
        const receipt = await recordMaterializationRunReceipt({
          schedulerRunId,
          materializationType: "adr_trade_rows",
          domain: "performance",
          weekWindow: [weekOpenUtc],
          rowsTouched: null,
          inputArtifacts: ["strategy_backtest_runs", "canonical_price_bars", "source direction rows"],
          outputArtifacts: [],
          namespaceProduced: "strategy_backtest_trades",
          status: "failed",
          errorMessage: message,
          degradedReasons: [message],
          startedAtUtc,
          completedAtUtc: finishedAt,
        });
        materializationRunId = receipt.runId;
      } catch (ledgerError) {
        ledgerErrors.push(ledgerError instanceof Error ? ledgerError.message : String(ledgerError));
      }
    }
    return NextResponse.json(
      {
        error: message,
        appTruthLedger: {
          schedulerRunId,
          materializationRunId,
          errors: ledgerErrors.length > 0 ? ledgerErrors : undefined,
        },
      },
      { status: 500 },
    );
  }
}
