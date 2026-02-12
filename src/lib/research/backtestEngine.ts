import { hashResearchConfig } from "@/lib/research/hash";
import type {
  ResearchConfig,
  ResearchModel,
  ResearchRunResult,
} from "@/lib/research/types";
import {
  computeStaticDrawdownPctFromPercentCurve,
  computeTrailingDrawdownPct,
} from "@/lib/risk/drawdown";

const MODEL_ORDER = ["antikythera", "blended", "dealer", "commercial", "sentiment"] as const;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function numberFromHash(hash: string) {
  return Number.parseInt(hash.slice(0, 8), 16) >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildWeekTimeline(fromIso: string, toIso: string) {
  const start = new Date(fromIso);
  const end = new Date(toIso);
  const safeStart = Number.isFinite(start.getTime()) ? start : new Date("2025-01-06T00:00:00.000Z");
  const safeEnd = Number.isFinite(end.getTime()) ? end : new Date("2026-01-05T00:00:00.000Z");
  const from = safeStart.getTime() <= safeEnd.getTime() ? safeStart : safeEnd;
  const to = safeStart.getTime() <= safeEnd.getTime() ? safeEnd : safeStart;

  const weeks: string[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime() && weeks.length < 260) {
    weeks.push(new Date(cursor).toISOString());
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks.length > 0 ? weeks : [new Date("2026-01-05T00:00:00.000Z").toISOString()];
}

function buildSymbols(config: ResearchConfig) {
  const provided = (config.universe.symbols ?? [])
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  if (provided.length > 0) return provided.slice(0, 16);
  if (config.universe.assetClasses.includes("fx")) {
    return [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCHF",
      "USDCAD",
      "AUDUSD",
      "NZDUSD",
      "EURGBP",
    ];
  }
  return ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XAUUSD"];
}

export async function runBacktest(config: ResearchConfig): Promise<ResearchRunResult> {
  const configHash = hashResearchConfig(config);
  const rand = mulberry32(numberFromHash(configHash));
  const weekOpenUtc = buildWeekTimeline(config.dateRange.from, config.dateRange.to);
  const symbols = buildSymbols(config);
  const models: ResearchModel[] =
    config.models.length > 0 ? [...config.models] : ["sentiment"];

  const modelWeight =
    models.reduce((sum, model) => sum + (MODEL_ORDER.indexOf(model) + 1), 0) /
    (models.length || 1);
  const leverageBoost = config.risk.leverage ? Math.log10(Math.max(1, config.risk.leverage)) : 1;
  const modeBias = config.mode === "as_traded_replay" ? 0.75 : 1;
  const legModeBias = config.execution.legMode === "net_only" ? 1.05 : 0.95;
  const variance = 0.5 + rand() * 0.8;

  const weekly: Array<{
    week_open_utc: string;
    return_pct: number;
    static_drawdown_pct: number;
    trailing_drawdown_pct: number;
  }> = [];
  const equityCurve: Array<{
    ts_utc: string;
    equity_pct: number;
    equity_usd: number;
    static_baseline_usd: number;
    lock_pct: number | null;
  }> = [];
  let equity = 0;
  let wins = 0;
  const startingEquity = Number(config.risk.startingEquity ?? 100000);
  const equityHistory: number[] = [];

  const baseWeeklyMove = (0.4 + modelWeight * 0.22 + leverageBoost * 0.35) * modeBias * legModeBias;
  for (const [index, week] of weekOpenUtc.entries()) {
    const cyclical = Math.sin((index + 1) * 0.75 + rand() * 0.3) * 0.9;
    const noise = (rand() - 0.5) * variance * 2.2;
    const returnPct = Number((baseWeeklyMove + cyclical + noise).toFixed(4));
    equity += returnPct;
    const trailingDrawdown = Number(
      computeTrailingDrawdownPct([...equityHistory, equity]).toFixed(4),
    );
    const staticDrawdown = Number(Math.max(0, -equity).toFixed(4));
    const equityUsd = Number((startingEquity * (1 + equity / 100)).toFixed(2));
    if (returnPct > 0) wins += 1;
    weekly.push({
      week_open_utc: week,
      return_pct: returnPct,
      static_drawdown_pct: staticDrawdown,
      trailing_drawdown_pct: trailingDrawdown,
    });
    equityCurve.push({
      ts_utc: week,
      equity_pct: Number(equity.toFixed(4)),
      equity_usd: equityUsd,
      static_baseline_usd: startingEquity,
      lock_pct: config.risk.trailing ? Number((equity * 0.4).toFixed(4)) : null,
    });
    equityHistory.push(equity);
  }

  const totalReturnPct = Number((weekly.reduce((sum, row) => sum + row.return_pct, 0)).toFixed(4));
  const trailingDrawdownPct = Number(
    computeTrailingDrawdownPct(equityCurve.map((row) => row.equity_pct)).toFixed(4),
  );
  const staticDrawdownPct = Number(
    computeStaticDrawdownPctFromPercentCurve(equityCurve).toFixed(4),
  );
  const winRatePct = weekly.length > 0 ? Number(((wins / weekly.length) * 100).toFixed(2)) : 0;
  const totalTrades = weekly.length * Math.max(1, models.length) * Math.max(1, Math.floor(symbols.length / 2));
  const pricedTrades = Math.max(0, Math.floor(totalTrades * clamp(0.85 + (rand() - 0.5) * 0.2, 0.65, 0.99)));

  const byModel = models.map((model) => {
    const score = (MODEL_ORDER.indexOf(model) + 1) / MODEL_ORDER.length;
    const returnPct = Number((totalReturnPct * (0.65 + score * 0.6) / models.length).toFixed(4));
    const trailingDdPct = Number(
      (trailingDrawdownPct * (0.8 + (1 - score) * 0.4)).toFixed(4),
    );
    const staticDdPct = Number(
      (staticDrawdownPct * (0.8 + (1 - score) * 0.4)).toFixed(4),
    );
    const trades = Math.max(1, Math.floor(totalTrades / models.length));
    return {
      model,
      return_pct: returnPct,
      static_drawdown_pct: staticDdPct,
      trailing_drawdown_pct: trailingDdPct,
      trades,
    };
  });

  const bySymbol = symbols.map((symbol, index) => {
    const tilt = Math.cos(index * 0.7 + rand()) * 0.2 + 1;
    const returnPct = Number((totalReturnPct * tilt / symbols.length).toFixed(4));
    const winRate = Number(clamp(45 + rand() * 30 + (returnPct > 0 ? 5 : -5), 20, 90).toFixed(2));
    const trades = Math.max(1, Math.floor(totalTrades / symbols.length + rand() * 4));
    return {
      symbol,
      return_pct: returnPct,
      win_rate_pct: winRate,
      trades,
    };
  });

  const byWeekday = [1, 2, 3, 4, 5].map((weekday) => {
    const bias = Math.sin(weekday + rand()) * 0.6;
    return {
      weekday,
      return_pct: Number((totalReturnPct / 5 + bias).toFixed(4)),
      trades: Math.max(1, Math.floor(totalTrades / 5 + rand() * 5)),
    };
  });

  const assumptionsNotes: string[] = [];
  if (config.mode === "hypothetical_sim") {
    assumptionsNotes.push("Hypothetical simulation with deterministic mock data.");
  } else {
    assumptionsNotes.push("Replay mode currently uses deterministic mock timeline.");
  }
  if (config.risk.stopLoss) {
    assumptionsNotes.push("Stop-loss behavior is mocked; use production engine for exact fills.");
  }

  return {
    runId: `mock-${configHash.slice(0, 12)}`,
    configHash,
    generatedAt: new Date().toISOString(),
    assumptions: {
      dataGranularity: "weekly",
      notes: assumptionsNotes,
    },
    headline: {
      totalReturnPct,
      staticDrawdownPct,
      trailingDrawdownPct,
      winRatePct,
      trades: totalTrades,
      pricedTrades,
    },
    risk: {
      avgMarginUsedPct: Number(clamp(30 + rand() * 35, 5, 95).toFixed(2)),
      peakMarginUsedPct: Number(clamp(45 + rand() * 45, 10, 99).toFixed(2)),
      fillRatePct: Number(clamp((pricedTrades / Math.max(totalTrades, 1)) * 100, 0, 100).toFixed(2)),
    },
    equityCurve,
    weekly,
    byModel,
    bySymbol,
    byWeekday,
  };
}
