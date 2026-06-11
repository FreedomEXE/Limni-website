import {
  computeReturnStats,
  type ModelPerformance,
  type PerformanceModel,
} from "@/lib/performanceLab";

type PairReturn = { pair: string; percent: number };
type PairDetail = {
  pair: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  reason: string[];
  percent: number | null;
};

export type ModelPerformanceLike = {
  model: PerformanceModel;
  percent: number;
  priced: number;
  total: number;
  note?: string | null;
  returns: PairReturn[];
  pair_details: PairDetail[];
  trailing?: ModelPerformance["trailing"];
};

type PerAssetResult = {
  assetLabel: string;
  results: ModelPerformanceLike[];
};

export function combinePerformanceModelTotals(options: {
  models: PerformanceModel[];
  perAsset: PerAssetResult[];
  labelWithAsset?: boolean;
  trailingByCombinedModel?: Record<string, ModelPerformance["trailing"]>;
}): ModelPerformance[] {
  const { models, perAsset, labelWithAsset = false, trailingByCombinedModel } = options;
  return models.map((model) => {
    let percent = 0;
    let priced = 0;
    let total = 0;
    const returns: PairReturn[] = [];
    const pairDetails: PairDetail[] = [];
    let note = "Combined across assets.";

    for (const asset of perAsset) {
      const result = asset.results.find((item) => item.model === model);
      if (!result) {
        continue;
      }
      percent += result.percent;
      priced += result.priced;
      total += result.total;
      if (labelWithAsset) {
        returns.push(
          ...result.returns.map((item) => ({
            pair: `${item.pair} (${asset.assetLabel})`,
            percent: item.percent,
          })),
        );
        pairDetails.push(
          ...result.pair_details.map((detail) => ({
            ...detail,
            pair: `${detail.pair} (${asset.assetLabel})`,
          })),
        );
      } else {
        returns.push(...result.returns);
        pairDetails.push(...result.pair_details);
      }
      if (result.note) {
        note = result.note;
      }
    }

    return {
      model,
      percent,
      priced,
      total,
      note,
      returns,
      pair_details: pairDetails,
      stats: computeReturnStats(returns),
      trailing: trailingByCombinedModel?.[`combined:${model}`],
    };
  });
}
