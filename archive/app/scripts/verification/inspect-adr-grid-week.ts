import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeWeeklyHold } from "../../src/lib/performance/weeklyHoldEngine";
import { getBiasSource, getEntryStyle, getRiskOverlay } from "../../src/lib/performance/strategyConfig";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] != null) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function argValue(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] ?? fallback : fallback;
}

function round(value: number | null | undefined, places = 6) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(places))
    : null;
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  const biasSource = getBiasSource(argValue("bias", "tiered_4w"));
  const entryStyle = getEntryStyle(argValue("f1", "adr_grid"));
  const riskOverlay = getRiskOverlay(argValue("f2", "pair_fill_cap"));
  const week = argValue("week", "2026-05-31T23:00:00.000Z");
  const symbol = argValue("symbol", "EURUSD").toUpperCase();

  if (!biasSource || !entryStyle) throw new Error("Missing strategy config");
  const result = await computeWeeklyHold(biasSource, week, entryStyle, riskOverlay);
  const trades = result.trades.filter((trade) => trade.symbol === symbol);

  console.log(JSON.stringify({
    week,
    symbol,
    totalTrades: result.tradeCount,
    totalNormalizedReturnPct: round(result.totalReturnPct),
    totalRawReturnPct: round(result.rawTotalReturnPct),
    symbolTradeCount: trades.length,
    symbolRawReturnPct: round(trades.reduce((sum, trade) => sum + (trade.rawReturnPct ?? trade.returnPct), 0)),
    symbolAdrNormalizedReturnPct: round(trades.reduce((sum, trade) => sum + (trade.normalizedReturnPct ?? trade.returnPct), 0)),
    fills: trades.map((trade) => ({
      tradeNumber: trade.detail?.tradeNumber ?? null,
      source: trade.source,
      tier: trade.tier,
      direction: trade.direction,
      entryTimeUtc: trade.detail?.entryTimeUtc ?? null,
      exitTimeUtc: trade.detail?.exitTimeUtc ?? null,
      entry: round(trade.openPrice, 8),
      exit: round(trade.closePrice, 8),
      tp: round(trade.detail?.tpPrice, 8),
      exitReason: trade.detail?.exitReason ?? null,
      adrPct: round(trade.adrPct ?? trade.detail?.adrPct),
      rawReturnPct: round(trade.rawReturnPct),
      adrNormalizedReturnPct: round(trade.normalizedReturnPct),
      displayReturnPct: round(trade.returnPct),
      maeRawPct: round(trade.detail?.maePct),
      maeAdrNormalizedPct: trade.detail?.maePct && trade.adrPct
        ? round(trade.detail.maePct / trade.adrPct)
        : null,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
