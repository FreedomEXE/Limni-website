import { DateTime } from "luxon";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { readMarketSnapshot } from "@/lib/priceStore";
import { readNewsWeeklySnapshot } from "@/lib/news/store";
import { getLatestAggregates } from "@/lib/sentiment/store";
import { queryOne } from "@/lib/db";
import { getWeekOpenUtc } from "@/lib/performanceSnapshots";

export type CronSubsystemStatus = {
  key: "cot" | "prices" | "sentiment" | "news" | "performance";
  label: string;
  state: "ok" | "stale" | "error";
  last_refresh_utc: string | null;
  detail: string;
};

export type CronStatusSummary = {
  generated_at_utc: string;
  overall_state: "ok" | "stale" | "error";
  subsystems: CronSubsystemStatus[];
};

function envMinutes(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? String(fallback));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function ageMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: "utc" });
  if (!dt.isValid) return null;
  return DateTime.utc().diff(dt, "minutes").minutes;
}

function stateFromAge(iso: string | null, staleMinutes: number): "ok" | "stale" | "error" {
  const age = ageMinutes(iso);
  if (age === null) return "error";
  return age <= staleMinutes ? "ok" : "stale";
}

export async function getCronStatusSummary(): Promise<CronStatusSummary> {
  const cotStaleMin = envMinutes("CRON_STATUS_COT_STALE_MINUTES", 30);
  const pricesStaleMin = envMinutes("CRON_STATUS_PRICES_STALE_MINUTES", 30);
  const sentimentStaleMin = envMinutes("CRON_STATUS_SENTIMENT_STALE_MINUTES", 90);
  const newsStaleMin = envMinutes("CRON_STATUS_NEWS_STALE_MINUTES", 180);
  const perfStaleMin = envMinutes("CRON_STATUS_PERF_STALE_MINUTES", 180);

  const assets = listAssetClasses();
  const nowIso = DateTime.utc().toISO() ?? new Date().toISOString();

  const cotSnapshots = await Promise.all(assets.map((asset) => readSnapshot({ assetClass: asset.id })));
  const cotLast = cotSnapshots
    .map((s) => s?.last_refresh_utc ?? null)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;
  const cotReport = cotSnapshots.map((s) => s?.report_date ?? null).filter(Boolean).sort().at(-1) ?? null;
  const cotState = stateFromAge(cotLast, cotStaleMin);

  const priceSnapshots = await Promise.all(assets.map((asset) => readMarketSnapshot(undefined, asset.id)));
  const pricesLast = priceSnapshots
    .map((s) => s?.last_refresh_utc ?? null)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;
  const pricesState = stateFromAge(pricesLast, pricesStaleMin);

  const sentimentLatest = await getLatestAggregates();
  const sentimentLast = sentimentLatest
    .map((row) => row.timestamp_utc)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const sentimentState = stateFromAge(sentimentLast, sentimentStaleMin);

  const news = await readNewsWeeklySnapshot();
  const newsLast = news?.fetched_at ?? null;
  const newsState = stateFromAge(newsLast, newsStaleMin);

  const perfMeta = await queryOne<{ latest_created_at: Date | null; latest_week_open: Date | null; rows: number }>(
    `SELECT MAX(created_at) AS latest_created_at, MAX(week_open_utc) AS latest_week_open, COUNT(*)::int AS rows
     FROM performance_snapshots`,
  );
  const perfLast = perfMeta?.latest_created_at ? perfMeta.latest_created_at.toISOString() : null;
  const perfWeek = perfMeta?.latest_week_open ? perfMeta.latest_week_open.toISOString() : getWeekOpenUtc();
  const perfRows = perfMeta?.rows ?? 0;
  const perfState = stateFromAge(perfLast, perfStaleMin);

  const subsystems: CronSubsystemStatus[] = [
    {
      key: "cot",
      label: "COT",
      state: cotState,
      last_refresh_utc: cotLast,
      detail: cotReport ? `report ${cotReport}` : "report unknown",
    },
    {
      key: "prices",
      label: "Prices",
      state: pricesState,
      last_refresh_utc: pricesLast,
      detail: `assets ${assets.length}`,
    },
    {
      key: "sentiment",
      label: "Sentiment",
      state: sentimentState,
      last_refresh_utc: sentimentLast,
      detail: `symbols ${sentimentLatest.length}`,
    },
    {
      key: "news",
      label: "News",
      state: newsState,
      last_refresh_utc: newsLast,
      detail: news ? `week ${news.week_open_utc.slice(0, 10)}` : "no snapshot",
    },
    {
      key: "performance",
      label: "Performance",
      state: perfState,
      last_refresh_utc: perfLast,
      detail: `week ${perfWeek.slice(0, 10)} · rows ${perfRows}`,
    },
  ];

  const hasError = subsystems.some((row) => row.state === "error");
  const hasStale = subsystems.some((row) => row.state === "stale");
  const overall_state = hasError ? "error" : hasStale ? "stale" : "ok";

  return {
    generated_at_utc: nowIso,
    overall_state,
    subsystems,
  };
}

