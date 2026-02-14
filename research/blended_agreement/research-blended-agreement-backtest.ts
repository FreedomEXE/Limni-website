import { readFileSync, writeFileSync } from "fs";
import { DateTime } from "luxon";
import { readSnapshot } from "@/lib/cotStore";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { getPairPerformance } from "@/lib/pricePerformance";
import type { AssetClass } from "@/lib/cotMarkets";
import type { Bias, Direction, PairSnapshot, CotSnapshot, MarketSnapshot } from "@/lib/cotTypes";
import { derivePairDirections, derivePairDirectionsByBase, biasFromNet } from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { PairDefinition } from "@/lib/cotPairs";

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

type ModelKey = "blended_weighted" | "blended_agreement" | "dealer" | "commercial";

type ModelResult = {
  model: ModelKey;
  total_percent: number;
  priced: number;
  total: number;
  missing: number;
  by_asset_class: Record<string, {
    percent: number;
    priced: number;
    total: number;
    missing: number;
    pairs: Array<{ pair: string; direction: Direction; percent: number | null }>;
  }>;
  stats: {
    avg_return: number;
    median_return: number;
    win_rate: number;
    volatility: number;
    best_pair: { pair: string; percent: number } | null;
    worst_pair: { pair: string; percent: number } | null;
  };
};

type ComparisonResult = {
  generated_at: string;
  report_dates: Record<AssetClass, string>;
  models: ModelResult[];
  comparison: {
    weighted_vs_agreement: {
      percent_diff: number;
      signal_count_diff: number;
      win_rate_diff: number;
      volatility_diff: number;
    };
  };
};

function pairSnapshot(direction: Direction, baseBias: Bias, quoteBias: Bias): PairSnapshot {
  return { direction, base_bias: baseBias, quote_bias: quoteBias };
}

// NEW: Agreement-based blended logic
// Only returns signals where BOTH dealer AND commercial agree on bias direction
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

    // Get dealer biases
    const baseDealerNet = base.dealer_short - base.dealer_long;
    const baseDealerBias = biasFromNet(baseDealerNet);
    const quoteDealerNet = quote.dealer_short - quote.dealer_long;
    const quoteDealerBias = biasFromNet(quoteDealerNet);

    // Get commercial biases
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

    // Filter 1: Both dealer and commercial must exist for base and quote
    if (baseCommercialBias === null || quoteCommercialBias === null) {
      continue;
    }

    // Filter 2: Dealer and commercial must AGREE on base bias
    if (baseDealerBias !== baseCommercialBias) {
      continue;
    }

    // Filter 3: Dealer and commercial must AGREE on quote bias
    if (quoteDealerBias !== quoteCommercialBias) {
      continue;
    }

    // Filter 4: No neutral biases
    if (baseDealerBias === "NEUTRAL" || quoteDealerBias === "NEUTRAL") {
      continue;
    }

    // Filter 5: Base and quote must have opposite biases for a signal
    if (baseDealerBias === quoteDealerBias) {
      continue;
    }

    // Generate signal
    if (baseDealerBias === "BULLISH" && quoteDealerBias === "BEARISH") {
      pairs[pairDef.pair] = pairSnapshot("LONG", baseDealerBias, quoteDealerBias);
    } else if (baseDealerBias === "BEARISH" && quoteDealerBias === "BULLISH") {
      pairs[pairDef.pair] = pairSnapshot("SHORT", baseDealerBias, quoteDealerBias);
    }
  }

  return pairs;
}

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

    // Get dealer bias
    const dealerNet = base.dealer_short - base.dealer_long;
    const dealerBias = biasFromNet(dealerNet);

    // Get commercial bias
    const commercialNet =
      typeof base.commercial_long === "number" && typeof base.commercial_short === "number"
        ? base.commercial_long - base.commercial_short
        : null;
    const commercialBias = commercialNet !== null ? biasFromNet(commercialNet) : null;

    // Filter: Dealer and commercial must AGREE
    if (commercialBias === null || dealerBias !== commercialBias) {
      continue;
    }

    // Filter: No neutral
    if (dealerBias === "NEUTRAL") {
      continue;
    }

    // Generate signal based on agreed bias
    const direction = dealerBias === "BULLISH" ? "LONG" : "SHORT";
    pairs[pairDef.pair] = pairSnapshot(direction, dealerBias, "NEUTRAL");
  }

  return pairs;
}

function computeStats(returns: Array<{ pair: string; percent: number }>) {
  if (returns.length === 0) {
    return {
      avg_return: 0,
      median_return: 0,
      win_rate: 0,
      volatility: 0,
      best_pair: null,
      worst_pair: null,
    };
  }
  const values = returns.map((item) => item.percent).sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);
  const avg = sum / values.length;
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  const wins = values.filter((value) => value > 0).length;
  const winRate = (wins / values.length) * 100;
  const variance =
    values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
  const volatility = Math.sqrt(variance);
  const bestPair = returns.reduce((best, current) =>
    current.percent > best.percent ? current : best,
  );
  const worstPair = returns.reduce((worst, current) =>
    current.percent < worst.percent ? current : worst,
  );
  return {
    avg_return: avg,
    median_return: median,
    win_rate: winRate,
    volatility,
    best_pair: bestPair,
    worst_pair: worstPair,
  };
}

async function computeComparison(): Promise<ComparisonResult> {
  const snapshots: Record<AssetClass, CotSnapshot> = {
    fx: await readSnapshot({ assetClass: "fx" }) as CotSnapshot,
    indices: await readSnapshot({ assetClass: "indices" }) as CotSnapshot,
    crypto: await readSnapshot({ assetClass: "crypto" }) as CotSnapshot,
    commodities: await readSnapshot({ assetClass: "commodities" }) as CotSnapshot,
  };

  const reportDates: Record<AssetClass, string> = {
    fx: snapshots.fx.report_date,
    indices: snapshots.indices.report_date,
    crypto: snapshots.crypto.report_date,
    commodities: snapshots.commodities.report_date,
  };

  const models: ModelKey[] = ["blended_weighted", "blended_agreement", "dealer", "commercial"];
  const results: ModelResult[] = [];

  for (const model of models) {
    let totalPercent = 0;
    let priced = 0;
    let total = 0;
    let missing = 0;
    const returns: Array<{ pair: string; percent: number }> = [];
    const byAsset: ModelResult["by_asset_class"] = {};

    for (const assetClass of ["fx", "indices", "crypto", "commodities"] as AssetClass[]) {
      const snapshot = snapshots[assetClass];
      const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];

      let modelPairs: Record<string, PairSnapshot> = {};

      if (model === "blended_weighted") {
        // Current 60/40 weighted approach
        modelPairs =
          assetClass === "fx"
            ? derivePairDirections(snapshot.currencies, pairDefs, "blended")
            : derivePairDirectionsByBase(snapshot.currencies, pairDefs, "blended");
      } else if (model === "blended_agreement") {
        // NEW: Agreement-based approach
        modelPairs =
          assetClass === "fx"
            ? derivePairDirectionsAgreement(snapshot.currencies, pairDefs)
            : derivePairDirectionsByBaseAgreement(snapshot.currencies, pairDefs);
      } else {
        // dealer or commercial
        modelPairs =
          assetClass === "fx"
            ? derivePairDirections(snapshot.currencies, pairDefs, model)
            : derivePairDirectionsByBase(snapshot.currencies, pairDefs, model);
      }

      const perf = await getPairPerformance(modelPairs, {
        assetClass,
        reportDate: reportDates[assetClass],
        isLatestReport: true
      });

      let modelTotal = 0;
      let modelPriced = 0;
      let modelMissing = 0;
      const pairDetails: Array<{ pair: string; direction: Direction; percent: number | null }> = [];

      for (const [pair, info] of Object.entries(modelPairs)) {
        total += 1;
        const perfRow = perf.performance[pair];
        if (!perfRow) {
          modelMissing += 1;
          missing += 1;
          pairDetails.push({ pair, direction: info.direction, percent: null });
          continue;
        }
        const adjusted = perfRow.percent * (info.direction === "LONG" ? 1 : -1);
        modelTotal += adjusted;
        totalPercent += adjusted;
        modelPriced += 1;
        priced += 1;
        returns.push({ pair, percent: adjusted });
        pairDetails.push({ pair, direction: info.direction, percent: adjusted });
      }

      byAsset[assetClass] = {
        percent: modelTotal,
        priced: modelPriced,
        total: Object.keys(modelPairs).length,
        missing: modelMissing,
        pairs: pairDetails,
      };
    }

    results.push({
      model,
      total_percent: totalPercent,
      priced,
      total,
      missing,
      by_asset_class: byAsset,
      stats: computeStats(returns),
    });
  }

  const weighted = results.find((r) => r.model === "blended_weighted")!;
  const agreement = results.find((r) => r.model === "blended_agreement")!;

  return {
    generated_at: new Date().toISOString(),
    report_dates: reportDates,
    models: results,
    comparison: {
      weighted_vs_agreement: {
        percent_diff: agreement.total_percent - weighted.total_percent,
        signal_count_diff: agreement.total - weighted.total,
        win_rate_diff: agreement.stats.win_rate - weighted.stats.win_rate,
        volatility_diff: agreement.stats.volatility - weighted.stats.volatility,
      },
    },
  };
}

function formatMarkdown(result: ComparisonResult): string {
  const lines: string[] = [];

  lines.push("# Blended Logic Comparison: Weighted vs Agreement");
  lines.push("");
  lines.push(`**Generated**: ${result.generated_at}`);
  lines.push("");
  lines.push("## Report Dates");
  for (const [asset, date] of Object.entries(result.report_dates)) {
    lines.push(`- ${asset}: ${date}`);
  }
  lines.push("");

  lines.push("## Overview");
  lines.push("");
  lines.push("Comparing two blended approaches:");
  lines.push("1. **Weighted (Current)**: 60% dealer + 40% commercial weighted average");
  lines.push("2. **Agreement (Proposed)**: Only signals where dealer AND commercial agree");
  lines.push("");

  lines.push("## Performance Comparison");
  lines.push("");
  lines.push("| Model | Total Return % | Signals | Priced | Win Rate % | Avg Return % | Volatility |");
  lines.push("|-------|----------------|---------|--------|------------|--------------|------------|");

  for (const model of result.models) {
    const name = model.model.replace("_", " ");
    lines.push(
      `| ${name} | ${model.total_percent.toFixed(2)} | ${model.total} | ${model.priced} | ${model.stats.win_rate.toFixed(1)} | ${model.stats.avg_return.toFixed(2)} | ${model.stats.volatility.toFixed(2)} |`
    );
  }
  lines.push("");

  const comp = result.comparison.weighted_vs_agreement;
  lines.push("## Agreement vs Weighted Differences");
  lines.push("");
  lines.push(`- **Return Difference**: ${comp.percent_diff > 0 ? "+" : ""}${comp.percent_diff.toFixed(2)}%`);
  lines.push(`- **Signal Count Difference**: ${comp.signal_count_diff > 0 ? "+" : ""}${comp.signal_count_diff}`);
  lines.push(`- **Win Rate Difference**: ${comp.win_rate_diff > 0 ? "+" : ""}${comp.win_rate_diff.toFixed(1)}%`);
  lines.push(`- **Volatility Difference**: ${comp.volatility_diff > 0 ? "+" : ""}${comp.volatility_diff.toFixed(2)}`);
  lines.push("");

  if (comp.percent_diff > 0) {
    lines.push("✅ **Agreement approach outperformed weighted approach**");
  } else {
    lines.push("❌ **Weighted approach outperformed agreement approach**");
  }
  lines.push("");

  lines.push("## By Asset Class");
  lines.push("");

  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as AssetClass[]) {
    lines.push(`### ${assetClass.toUpperCase()}`);
    lines.push("");
    lines.push("| Model | Return % | Signals | Priced |");
    lines.push("|-------|----------|---------|--------|");
    for (const model of result.models) {
      const assetData = model.by_asset_class[assetClass];
      if (assetData && assetData.total > 0) {
        lines.push(
          `| ${model.model.replace("_", " ")} | ${assetData.percent.toFixed(2)} | ${assetData.total} | ${assetData.priced} |`
        );
      }
    }
    lines.push("");
  }

  lines.push("## Detailed Pair Breakdown");
  lines.push("");

  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as AssetClass[]) {
    const weighted = result.models.find((m) => m.model === "blended_weighted");
    const agreement = result.models.find((m) => m.model === "blended_agreement");

    if (!weighted || !agreement) continue;

    const weightedPairs = new Set(weighted.by_asset_class[assetClass]?.pairs.map(p => p.pair) || []);
    const agreementPairs = new Set(agreement.by_asset_class[assetClass]?.pairs.map(p => p.pair) || []);

    const onlyWeighted = [...weightedPairs].filter(p => !agreementPairs.has(p));
    const onlyAgreement = [...agreementPairs].filter(p => !weightedPairs.has(p));
    const both = [...weightedPairs].filter(p => agreementPairs.has(p));

    if (onlyWeighted.length > 0 || onlyAgreement.length > 0) {
      lines.push(`### ${assetClass.toUpperCase()} - Signal Differences`);
      lines.push("");

      if (onlyWeighted.length > 0) {
        lines.push(`**Only in Weighted (${onlyWeighted.length})**: ${onlyWeighted.join(", ")}`);
      }
      if (onlyAgreement.length > 0) {
        lines.push(`**Only in Agreement (${onlyAgreement.length})**: ${onlyAgreement.join(", ")}`);
      }
      lines.push(`**In Both (${both.length})**: ${both.join(", ")}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function main() {
  loadEnvFromFile();

  console.log("Running blended logic comparison...");
  const result = await computeComparison();

  const jsonPath = `reports/blended-comparison-${DateTime.utc().toISODate()}.json`;
  const mdPath = jsonPath.replace(".json", ".md");

  writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`Wrote ${jsonPath}`);

  const markdown = formatMarkdown(result);
  writeFileSync(mdPath, markdown);
  console.log(`Wrote ${mdPath}`);

  console.log("\n=== SUMMARY ===");
  console.log(`Weighted (current): ${result.models[0].total_percent.toFixed(2)}% (${result.models[0].total} signals, ${result.models[0].stats.win_rate.toFixed(1)}% win rate)`);
  console.log(`Agreement (proposed): ${result.models[1].total_percent.toFixed(2)}% (${result.models[1].total} signals, ${result.models[1].stats.win_rate.toFixed(1)}% win rate)`);
  console.log(`Difference: ${result.comparison.weighted_vs_agreement.percent_diff > 0 ? "+" : ""}${result.comparison.weighted_vs_agreement.percent_diff.toFixed(2)}%`);
}

main().catch((error) => {
  console.error("Failed to run blended comparison:", error);
  process.exit(1);
});
