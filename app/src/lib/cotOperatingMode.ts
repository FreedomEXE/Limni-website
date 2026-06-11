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
  const staleReasons: Array<{
    asset: string;
    reason: string;
    expectedReportDate: string;
    minutesSinceWeeklyRelease: number;
  }> = [];

  for (const item of snapshots) {
    if (!item.snapshot) {
      console.log(`[COT Operating Mode] ${item.asset}: No snapshot found in database`);
      staleAssetClasses.push(item.asset);
      staleReasons.push({
        asset: item.asset,
        reason: "no snapshot available",
        expectedReportDate: "",
        minutesSinceWeeklyRelease: 0,
      });
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
      staleReasons.push({
        asset: item.asset,
        reason: freshness.reason,
        expectedReportDate: freshness.expected_report_date,
        minutesSinceWeeklyRelease: freshness.minutes_since_weekly_release,
      });
    }
  }

  const halted = healthyAssetClasses.length === 0;
  if (halted) {
    const hasAnySnapshots = snapshots.some(item => item.snapshot !== null);
    const weeklyPending = staleReasons.some((item) => item.reason === "awaiting weekly CFTC update");
    const expectedDate = staleReasons.find((item) => item.expectedReportDate)?.expectedReportDate ?? "";
    const waitMinutes = Math.max(
      0,
      ...staleReasons.map((item) => item.minutesSinceWeeklyRelease),
    );
    const reason = hasAnySnapshots
      ? weeklyPending
        ? `Awaiting weekly CFTC update${expectedDate ? ` (expected ${expectedDate})` : ""}. ${waitMinutes} min since Friday 3:30 PM ET release.`
        : "COT data is stale. Refresh required on server-side /api/cot/refresh with ADMIN_TOKEN."
      : "No COT snapshots found in database. CFTC reporting may be halted, or database needs initial refresh.";

    return {
      mode: "sentiment_only",
      label: "Sentiment-only mode",
      reason,
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
