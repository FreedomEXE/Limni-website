import { evaluateFreshness } from "./cotFreshness";
import { listAssetClasses } from "./cotMarkets";
import { readSnapshot } from "./cotStore";

export type CotOperatingMode = "normal" | "sentiment_only";

export type CotOperatingModeSummary = {
  mode: CotOperatingMode;
  label: string;
  reason: string;
  updated_at_utc: string;
  stale_asset_classes: string[];
  healthy_asset_classes: string[];
};

function isHaltForcedByEnv() {
  const raw = process.env.COT_REPORTING_HALTED ?? "";
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export async function getCotOperatingModeSummary(): Promise<CotOperatingModeSummary> {
  const updatedAt = new Date().toISOString();

  if (isHaltForcedByEnv()) {
    const reason =
      process.env.COT_REPORTING_HALTED_REASON?.trim() ||
      "COT reporting halt manually enabled.";
    return {
      mode: "sentiment_only",
      label: "Sentiment-only mode",
      reason,
      updated_at_utc: updatedAt,
      stale_asset_classes: listAssetClasses().map((asset) => asset.id),
      healthy_asset_classes: [],
    };
  }

  const assets = listAssetClasses();
  const snapshots = await Promise.all(
    assets.map(async (asset) => ({
      asset: asset.id,
      snapshot: await readSnapshot({ assetClass: asset.id }),
    })),
  );

  const staleAssetClasses: string[] = [];
  const healthyAssetClasses: string[] = [];

  for (const item of snapshots) {
    if (!item.snapshot) {
      console.log(`[COT Operating Mode] ${item.asset}: No snapshot found in database`);
      staleAssetClasses.push(item.asset);
      continue;
    }
    const freshness = evaluateFreshness(
      item.snapshot.report_date,
      item.snapshot.last_refresh_utc,
    );
    console.log(`[COT Operating Mode] ${item.asset}: report_date=${item.snapshot.report_date}, trading_allowed=${freshness.trading_allowed}, reason=${freshness.reason}`);
    if (freshness.trading_allowed) {
      healthyAssetClasses.push(item.asset);
    } else {
      staleAssetClasses.push(item.asset);
    }
  }

  const halted = healthyAssetClasses.length === 0;
  if (halted) {
    return {
      mode: "sentiment_only",
      label: "Sentiment-only mode",
      reason:
        "No fresh COT snapshot is currently available across tracked asset classes.",
      updated_at_utc: updatedAt,
      stale_asset_classes: staleAssetClasses,
      healthy_asset_classes: healthyAssetClasses,
    };
  }

  return {
    mode: "normal",
    label: "COT + Sentiment mode",
    reason: "COT snapshots are fresh.",
    updated_at_utc: updatedAt,
    stale_asset_classes: staleAssetClasses,
    healthy_asset_classes: healthyAssetClasses,
  };
}
