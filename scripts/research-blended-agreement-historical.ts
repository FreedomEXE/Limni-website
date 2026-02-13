import { readFileSync, writeFileSync } from "fs";
import { DateTime } from "luxon";
import { query } from "@/lib/db";
import { getAggregatesForWeekStart } from "@/lib/sentiment/store";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { getPairPerformance } from "@/lib/pricePerformance";
import type { AssetClass } from "@/lib/cotMarkets";
import type { Bias, Direction, PairSnapshot, MarketSnapshot } from "@/lib/cotTypes";
import { biasFromNet } from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { PairDefinition } from "@/lib/cotPairs";
import { derivePairDirections, derivePairDirectionsByBase } from "@/lib/cotCompute";

function loadEnvFromFile() {
  try {
    const text = readFileSync(".env", "utf-8");
    text.split(/\r?\n/).forEach((line) => {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) return;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // ignore missing .env
  }
}

type WeekInfo = {
  week_open_utc: string;
  report_date: string;
};

type CotSnapshot = {
  report_date: string;
  asset_class: AssetClass;
  currencies: Record<string, MarketSnapshot>;
};

type ModelKey = "blended_weighted" | "blended_agreement" | "dealer" | "commercial";

type WeekResult = {
  week_open_utc: string;
  models: {
    model: ModelKey;
    percent: number;
    signals: number;
    priced: number;
    win_rate: number;
  }[];
};

type HistoricalResult = {
  generated_at: string;
  weeks_analyzed: number;
  week_results: WeekResult[];
  cumulative: {
    model: ModelKey;
    total_return: number;
    avg_weekly_return: number;
    total_signals: number;
    avg_signals_per_week: number;
    overall_win_rate: number;
    weeks_positive: number;
    weeks_negative: number;
    best_week: { week: string; percent: number } | null;
    worst_week: { week: string; percent: number } | null;
    volatility: number;
  }[];
  comparison: {
    weighted_vs_agreement: {
      total_return_diff: number;
      avg_weekly_return_diff: number;
      total_signals_diff: number;
      win_rate_diff: number;
      weeks_agreement_won: number;
      weeks_weighted_won: number;
    };
  };
};

function pairSnapshot(direction: Direction, baseBias: Bias, quoteBias: Bias): PairSnapshot {
  return { direction, base_bias: baseBias, quote_bias: quoteBias };
}

// Agreement-based blended logic for FX pairs
function derivePairDirectionsAgreement(
  markets: Record<string, MarketSnapshot>,
  pairDefs: PairDefinition[],
): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};

  for (const pairDef of pairDefs) {
    const base = markets[pairDef.base];
    const quote = markets[pairDef.quote];

    if (!base || !quote) {
      continue;
    }

    const baseDealerNet = base.dealer_short - base.dealer_long;
    const baseDealerBias = biasFromNet(baseDealerNet);
    const quoteDealerNet = quote.dealer_short - quote.dealer_long;
    const quoteDealerBias = biasFromNet(quoteDealerNet);

    const baseCommercialNet =
      typeof base.commercial_long === "number" && typeof base.commercial_short === "number"
        ? base.commercial_long - base.commercial_short
        : null;
    const baseCommercialBias = baseCommercialNet !== null ? biasFromNet(baseCommercialNet) : null;

    const quoteCommercialNet =
      typeof quote.commercial_long === "number" && typeof quote.commercial_short === "number"
        ? quote.commercial_long - quote.commercial_short
        : null;
    const quoteCommercialBias = quoteCommercialNet !== null ? biasFromNet(quoteCommercialNet) : null;

    if (baseCommercialBias === null || quoteCommercialBias === null) {
      continue;
    }

    if (baseDealerBias !== baseCommercialBias || quoteDealerBias !== quoteCommercialBias) {
      continue;
    }

    if (baseDealerBias === "NEUTRAL" || quoteDealerBias === "NEUTRAL") {
      continue;
    }

    if (baseDealerBias === quoteDealerBias) {
      continue;
    }

    if (baseDealerBias === "BULLISH" && quoteDealerBias === "BEARISH") {
      pairs[pairDef.pair] = pairSnapshot("LONG", baseDealerBias, quoteDealerBias);
    } else if (baseDealerBias === "BEARISH" && quoteDealerBias === "BULLISH") {
      pairs[pairDef.pair] = pairSnapshot("SHORT", baseDealerBias, quoteDealerBias);
    }
  }

  return pairs;
}

// Agreement-based blended logic for non-FX pairs
function derivePairDirectionsByBaseAgreement(
  markets: Record<string, MarketSnapshot>,
  pairDefs: PairDefinition[],
): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};

  for (const pairDef of pairDefs) {
    const base = markets[pairDef.base];

    if (!base) {
      continue;
    }

    const dealerNet = base.dealer_short - base.dealer_long;
    const dealerBias = biasFromNet(dealerNet);

    const commercialNet =
      typeof base.commercial_long === "number" && typeof base.commercial_short === "number"
        ? base.commercial_long - base.commercial_short
        : null;
    const commercialBias = commercialNet !== null ? biasFromNet(commercialNet) : null;

    if (commercialBias === null || dealerBias !== commercialBias) {
      continue;
    }

    if (dealerBias === "NEUTRAL") {
      continue;
    }

    const direction = dealerBias === "BULLISH" ? "LONG" : "SHORT";
    pairs[pairDef.pair] = pairSnapshot(direction, dealerBias, "NEUTRAL");
  }

  return pairs;
}

async function getHistoricalWeeks(limit: number = 20): Promise<WeekInfo[]> {
  const rows = await query<WeekInfo>(
    `SELECT DISTINCT week_open_utc, report_date
     FROM performance_snapshots
     WHERE model = 'blended' AND asset_class = 'fx'
     ORDER BY week_open_utc DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

async function getCotSnapshot(reportDate: string, assetClass: AssetClass): Promise<CotSnapshot | null> {
  const rows = await query<CotSnapshot>(
    `SELECT report_date, asset_class, currencies
     FROM cot_snapshots
     WHERE report_date = $1 AND asset_class = $2`,
    [reportDate, assetClass]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

function computeStats(values: number[]) {
  if (values.length === 0) {
    return { avg: 0, median: 0, volatility: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance = sorted.reduce((acc, val) => acc + (val - avg) ** 2, 0) / sorted.length;
  const volatility = Math.sqrt(variance);
  return { avg, median, volatility };
}

async function analyzeHistoricalPerformance(weeks: number = 20): Promise<HistoricalResult> {
  const weekList = await getHistoricalWeeks(weeks);
  console.log(`Found ${weekList.length} historical weeks to analyze`);

  const weekResults: WeekResult[] = [];
  const modelReturns: Record<ModelKey, number[]> = {
    blended_weighted: [],
    blended_agreement: [],
    dealer: [],
    commercial: [],
  };
  const modelSignalCounts: Record<ModelKey, number[]> = {
    blended_weighted: [],
    blended_agreement: [],
    dealer: [],
    commercial: [],
  };
  const modelWinRates: Record<ModelKey, number[]> = {
    blended_weighted: [],
    blended_agreement: [],
    dealer: [],
    commercial: [],
  };

  for (const weekInfo of weekList) {
    const { week_open_utc: weekOpenUtc, report_date: reportDate } = weekInfo;
    console.log(`\nAnalyzing week: ${weekOpenUtc} (report: ${reportDate})`);

    const weekOpenDt = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekCloseDt = weekOpenDt.plus({ days: 7 });

    // Load snapshots for all asset classes
    const snapshots: Record<AssetClass, CotSnapshot | null> = {
      fx: await getCotSnapshot(reportDate, "fx"),
      indices: await getCotSnapshot(reportDate, "indices"),
      crypto: await getCotSnapshot(reportDate, "crypto"),
      commodities: await getCotSnapshot(reportDate, "commodities"),
    };

    // Load sentiment
    let sentiment: SentimentAggregate[] = [];
    try {
      sentiment = await getAggregatesForWeekStart(
        weekOpenDt.toUTC().toISO() ?? weekOpenUtc,
        weekCloseDt.toUTC().toISO() ?? weekOpenUtc
      );
    } catch (err) {
      console.log(`  No sentiment data for week ${weekOpenUtc}`);
    }

    const models: ModelKey[] = ["blended_weighted", "blended_agreement", "dealer", "commercial"];
    const weekModelResults: WeekResult["models"] = [];

    for (const model of models) {
      let totalPercent = 0;
      let totalSignals = 0;
      let totalPriced = 0;
      let wins = 0;

      for (const assetClass of ["fx", "indices", "crypto", "commodities"] as AssetClass[]) {
        const snapshot = snapshots[assetClass];
        if (!snapshot) continue;

        const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
        let modelPairs: Record<string, PairSnapshot> = {};

        if (model === "blended_weighted") {
          modelPairs =
            assetClass === "fx"
              ? derivePairDirections(snapshot.currencies, pairDefs, "blended")
              : derivePairDirectionsByBase(snapshot.currencies, pairDefs, "blended");
        } else if (model === "blended_agreement") {
          modelPairs =
            assetClass === "fx"
              ? derivePairDirectionsAgreement(snapshot.currencies, pairDefs)
              : derivePairDirectionsByBaseAgreement(snapshot.currencies, pairDefs);
        } else {
          modelPairs =
            assetClass === "fx"
              ? derivePairDirections(snapshot.currencies, pairDefs, model)
              : derivePairDirectionsByBase(snapshot.currencies, pairDefs, model);
        }

        totalSignals += Object.keys(modelPairs).length;

        const perf = await getPairPerformance(modelPairs, {
          assetClass,
          reportDate: reportDate,
          isLatestReport: false,
        });

        for (const [pair, info] of Object.entries(modelPairs)) {
          const perfRow = perf.performance[pair];
          if (!perfRow) continue;

          totalPriced++;
          const adjusted = perfRow.percent * (info.direction === "LONG" ? 1 : -1);
          totalPercent += adjusted;
          if (adjusted > 0) wins++;
        }
      }

      const winRate = totalPriced > 0 ? (wins / totalPriced) * 100 : 0;

      weekModelResults.push({
        model,
        percent: totalPercent,
        signals: totalSignals,
        priced: totalPriced,
        win_rate: winRate,
      });

      modelReturns[model].push(totalPercent);
      modelSignalCounts[model].push(totalSignals);
      modelWinRates[model].push(winRate);

      console.log(`  ${model}: ${totalPercent.toFixed(2)}% (${totalSignals} signals, ${winRate.toFixed(1)}% win rate)`);
    }

    weekResults.push({
      week_open_utc: weekOpenUtc,
      models: weekModelResults,
    });
  }

  // Compute cumulative stats
  const cumulative: HistoricalResult["cumulative"] = [];

  for (const model of ["blended_weighted", "blended_agreement", "dealer", "commercial"] as ModelKey[]) {
    const returns = modelReturns[model];
    const signals = modelSignalCounts[model];
    const winRates = modelWinRates[model];

    const totalReturn = returns.reduce((acc, val) => acc + val, 0);
    const avgWeeklyReturn = returns.length > 0 ? totalReturn / returns.length : 0;
    const totalSignals = signals.reduce((acc, val) => acc + val, 0);
    const avgSignalsPerWeek = signals.length > 0 ? totalSignals / signals.length : 0;
    const overallWinRate = winRates.length > 0 ? winRates.reduce((acc, val) => acc + val, 0) / winRates.length : 0;
    const weeksPositive = returns.filter((val) => val > 0).length;
    const weeksNegative = returns.filter((val) => val < 0).length;

    let bestWeek: { week: string; percent: number } | null = null;
    let worstWeek: { week: string; percent: number } | null = null;

    for (let i = 0; i < returns.length; i++) {
      const ret = returns[i];
      if (!bestWeek || ret > bestWeek.percent) {
        bestWeek = { week: weekResults[i].week_open_utc, percent: ret };
      }
      if (!worstWeek || ret < worstWeek.percent) {
        worstWeek = { week: weekResults[i].week_open_utc, percent: ret };
      }
    }

    const stats = computeStats(returns);

    cumulative.push({
      model,
      total_return: totalReturn,
      avg_weekly_return: avgWeeklyReturn,
      total_signals: totalSignals,
      avg_signals_per_week: avgSignalsPerWeek,
      overall_win_rate: overallWinRate,
      weeks_positive: weeksPositive,
      weeks_negative: weeksNegative,
      best_week: bestWeek,
      worst_week: worstWeek,
      volatility: stats.volatility,
    });
  }

  const weighted = cumulative.find((c) => c.model === "blended_weighted")!;
  const agreement = cumulative.find((c) => c.model === "blended_agreement")!;

  let weeksAgreementWon = 0;
  let weeksWeightedWon = 0;

  for (let i = 0; i < weekResults.length; i++) {
    const wModels = weekResults[i].models;
    const wWeighted = wModels.find((m) => m.model === "blended_weighted")!;
    const wAgreement = wModels.find((m) => m.model === "blended_agreement")!;

    if (wAgreement.percent > wWeighted.percent) {
      weeksAgreementWon++;
    } else if (wWeighted.percent > wAgreement.percent) {
      weeksWeightedWon++;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    weeks_analyzed: weekResults.length,
    week_results: weekResults,
    cumulative,
    comparison: {
      weighted_vs_agreement: {
        total_return_diff: agreement.total_return - weighted.total_return,
        avg_weekly_return_diff: agreement.avg_weekly_return - weighted.avg_weekly_return,
        total_signals_diff: agreement.total_signals - weighted.total_signals,
        win_rate_diff: agreement.overall_win_rate - weighted.overall_win_rate,
        weeks_agreement_won: weeksAgreementWon,
        weeks_weighted_won: weeksWeightedWon,
      },
    },
  };
}

function formatMarkdown(result: HistoricalResult): string {
  const lines: string[] = [];

  lines.push("# Historical Blended Logic Comparison: Weighted vs Agreement");
  lines.push("");
  lines.push(`**Generated**: ${result.generated_at}`);
  lines.push(`**Weeks Analyzed**: ${result.weeks_analyzed}`);
  lines.push("");

  lines.push("## Cumulative Performance");
  lines.push("");
  lines.push("| Model | Total Return % | Avg Weekly % | Total Signals | Avg Signals/Week | Win Rate % | Weeks + | Weeks - | Volatility |");
  lines.push("|-------|----------------|--------------|---------------|------------------|------------|---------|---------|------------|");

  for (const cum of result.cumulative) {
    lines.push(
      `| ${cum.model.replace("_", " ")} | ${cum.total_return.toFixed(2)} | ${cum.avg_weekly_return.toFixed(2)} | ${cum.total_signals} | ${cum.avg_signals_per_week.toFixed(1)} | ${cum.overall_win_rate.toFixed(1)} | ${cum.weeks_positive} | ${cum.weeks_negative} | ${cum.volatility.toFixed(2)} |`
    );
  }
  lines.push("");

  const comp = result.comparison.weighted_vs_agreement;
  lines.push("## Agreement vs Weighted");
  lines.push("");
  lines.push(`- **Total Return Difference**: ${comp.total_return_diff > 0 ? "+" : ""}${comp.total_return_diff.toFixed(2)}%`);
  lines.push(`- **Avg Weekly Return Difference**: ${comp.avg_weekly_return_diff > 0 ? "+" : ""}${comp.avg_weekly_return_diff.toFixed(2)}%`);
  lines.push(`- **Total Signals Difference**: ${comp.total_signals_diff > 0 ? "+" : ""}${comp.total_signals_diff}`);
  lines.push(`- **Win Rate Difference**: ${comp.win_rate_diff > 0 ? "+" : ""}${comp.win_rate_diff.toFixed(1)}%`);
  lines.push(`- **Weeks Agreement Won**: ${comp.weeks_agreement_won}`);
  lines.push(`- **Weeks Weighted Won**: ${comp.weeks_weighted_won}`);
  lines.push("");

  if (comp.total_return_diff > 0) {
    lines.push("✅ **Agreement approach outperformed weighted approach over the analyzed period**");
  } else {
    lines.push("❌ **Weighted approach outperformed agreement approach over the analyzed period**");
  }
  lines.push("");

  lines.push("## Week-by-Week Breakdown");
  lines.push("");
  lines.push("| Week | Weighted % | Agreement % | Dealer % | Commercial % | Winner |");
  lines.push("|------|------------|-------------|----------|--------------|--------|");

  for (const week of result.week_results) {
    const weighted = week.models.find((m) => m.model === "blended_weighted")!;
    const agreement = week.models.find((m) => m.model === "blended_agreement")!;
    const dealer = week.models.find((m) => m.model === "dealer")!;
    const commercial = week.models.find((m) => m.model === "commercial")!;

    const winner = agreement.percent > weighted.percent ? "Agreement" : weighted.percent > agreement.percent ? "Weighted" : "Tie";

    const weekStr = week.week_open_utc;

    lines.push(
      `| ${weekStr.slice(0, 10)} | ${weighted.percent.toFixed(2)} (${weighted.signals}) | ${agreement.percent.toFixed(2)} (${agreement.signals}) | ${dealer.percent.toFixed(2)} | ${commercial.percent.toFixed(2)} | ${winner} |`
    );
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  loadEnvFromFile();

  const weeksToAnalyze = parseInt(process.argv[2] || "20", 10);
  console.log(`Analyzing last ${weeksToAnalyze} weeks...`);

  const result = await analyzeHistoricalPerformance(weeksToAnalyze);

  const jsonPath = `reports/blended-historical-${weeksToAnalyze}w-${DateTime.utc().toISODate()}.json`;
  const mdPath = jsonPath.replace(".json", ".md");

  writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${jsonPath}`);

  const markdown = formatMarkdown(result);
  writeFileSync(mdPath, markdown);
  console.log(`Wrote ${mdPath}`);

  console.log("\n=== SUMMARY ===");
  const weighted = result.cumulative.find((c) => c.model === "blended_weighted")!;
  const agreement = result.cumulative.find((c) => c.model === "blended_agreement")!;
  console.log(`Weighted: ${weighted.total_return.toFixed(2)}% total (${weighted.avg_weekly_return.toFixed(2)}% avg/week, ${weighted.avg_signals_per_week.toFixed(1)} signals/week)`);
  console.log(`Agreement: ${agreement.total_return.toFixed(2)}% total (${agreement.avg_weekly_return.toFixed(2)}% avg/week, ${agreement.avg_signals_per_week.toFixed(1)} signals/week)`);
  console.log(`Difference: ${result.comparison.weighted_vs_agreement.total_return_diff > 0 ? "+" : ""}${result.comparison.weighted_vs_agreement.total_return_diff.toFixed(2)}%`);
}

main().catch((error) => {
  console.error("Failed to run historical comparison:", error);
  process.exit(1);
});
