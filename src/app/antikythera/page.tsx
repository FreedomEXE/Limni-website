import DashboardLayout from "@/components/DashboardLayout";
import PageTabs from "@/components/PageTabs";
import SignalHeatmap from "@/components/SignalHeatmap";
import ViewToggle from "@/components/ViewToggle";
import SummaryCards from "@/components/SummaryCards";
import { buildAntikytheraSignals } from "@/lib/antikythera";
import { listAssetClasses } from "@/lib/cotMarkets";
import { listSnapshotDates, readSnapshot } from "@/lib/cotStore";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import { formatDateET, formatDateTimeET, latestIso } from "@/lib/time";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { refreshAppData } from "@/lib/appRefresh";
import { listPerformanceWeeks, readPerformanceSnapshotsByWeek } from "@/lib/performanceSnapshots";
import { DateTime } from "luxon";

export const dynamic = "force-dynamic";

type AntikytheraPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

export default async function AntikytheraPage({ searchParams }: AntikytheraPageProps) {
  try {
    await refreshAppData();
  } catch (error) {
    console.error("App refresh failed:", error);
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const reportParam = resolvedSearchParams?.report;
  const assetParam = resolvedSearchParams?.asset;
  const viewParam = resolvedSearchParams?.view;
  const reportDate =
    Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const selectedAsset = Array.isArray(assetParam) ? assetParam[0] : assetParam;
  const view =
    viewParam === "list" || viewParam === "heatmap" ? viewParam : "heatmap";
  const assetClasses = listAssetClasses();
  const assetIds = assetClasses.map((asset) => asset.id);
  const availableDates = await Promise.all(
    assetClasses.map((asset) => listSnapshotDates(asset.id)),
  ).then((lists) => {
    if (lists.length === 0) {
      return [];
    }
    return lists.reduce((acc, list) => acc.filter((date) => list.includes(date)));
  });
  const selectedReportDate =
    reportDate && availableDates.includes(reportDate)
      ? reportDate
      : availableDates[0];
  const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
  let sentiment: SentimentAggregate[] = [];

  try {
    const [snapshotResults, sentimentResult] = await Promise.all([
      Promise.all(
        assetIds.map((assetClass) =>
          selectedReportDate
            ? readSnapshot({ assetClass, reportDate: selectedReportDate })
            : readSnapshot({ assetClass }),
        ),
      ),
      getLatestAggregatesLocked(),
    ]);
    snapshotResults.forEach((snapshot, index) => {
      snapshots.set(assetIds[index], snapshot);
    });
    sentiment = sentimentResult;
  } catch (error) {
    console.error(
      "Antikythera data load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const signalGroups = assetClasses.map((asset) => {
    const snapshot = snapshots.get(asset.id) ?? null;
    const signals =
      snapshot
        ? buildAntikytheraSignals({
            assetClass: asset.id,
            snapshot,
            sentiment,
          })
        : [];
    return { asset, signals, hasHistory: Boolean(snapshot) };
  });

  const allSignals = signalGroups.flatMap((group) =>
    group.signals.map((signal) => ({
      ...signal,
      assetId: group.asset.id,
      assetLabel: group.asset.label,
    })),
  );
  const filteredSignals = selectedAsset && selectedAsset !== "all"
    ? allSignals.filter((signal) => signal.assetId === selectedAsset)
    : allSignals;
  const latestSnapshotRefresh = latestIso(
    assetClasses.map((asset) => snapshots.get(asset.id)?.last_refresh_utc),
  );
  const latestSentimentRefresh = latestIso(
    sentiment.map((item) => item.timestamp_utc),
  );
  const latestAntikytheraRefresh = latestIso([
    latestSnapshotRefresh,
    latestSentimentRefresh,
  ]);
  const weeks = await listPerformanceWeeks();
  let selectedWeek = weeks[0] ?? null;
  if (selectedReportDate) {
    const report = DateTime.fromISO(selectedReportDate, { zone: "America/New_York" });
    if (report.isValid) {
      const daysUntilMonday = (8 - report.weekday) % 7;
      const monday = report
        .plus({ days: daysUntilMonday })
        .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
      const weekIso = monday.toUTC().toISO();
      if (weekIso && weeks.includes(weekIso)) {
        selectedWeek = weekIso;
      }
    }
  }
  let performanceByPair: Record<string, number | null> = {};
  if (selectedWeek) {
    try {
      const weekSnapshots = await readPerformanceSnapshotsByWeek(selectedWeek);
      const assetLabelMap = new Map(
        assetClasses.map((asset) => [asset.id, asset.label]),
      );
      weekSnapshots
        .filter((row) => row.model === "antikythera")
        .forEach((row) => {
          row.pair_details.forEach((detail) => {
            const assetLabel = assetLabelMap.get(row.asset_class) ?? row.asset_class;
            const key = `${detail.pair} (${assetLabel})`;
            performanceByPair[key] = detail.percent ?? null;
          });
        });
    } catch (error) {
      console.error("Antikythera performance load failed:", error);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Antikythera
          </h1>
          <PageTabs />
        </header>

        <SummaryCards
          title="Antikythera"
          cards={[
            {
              id: "signals",
              label: "Signals tracked",
              value: String(allSignals.length),
              details: [
                { label: "FX", value: String(signalGroups.find((g) => g.asset.id === "fx")?.signals.length ?? 0) },
                { label: "Indices", value: String(signalGroups.find((g) => g.asset.id === "indices")?.signals.length ?? 0) },
                { label: "Crypto", value: String(signalGroups.find((g) => g.asset.id === "crypto")?.signals.length ?? 0) },
                { label: "Commodities", value: String(signalGroups.find((g) => g.asset.id === "commodities")?.signals.length ?? 0) },
              ],
            },
            {
              id: "long",
              label: "Long signals",
              value: String(allSignals.filter((s) => s.direction === "LONG").length),
              tone: "positive",
            },
            {
              id: "short",
              label: "Short signals",
              value: String(allSignals.filter((s) => s.direction === "SHORT").length),
              tone: "negative",
            },
            {
              id: "sentiment",
              label: "Sentiment aligned",
              value: String(allSignals.filter((s) => s.reasons.some((r) => r.toLowerCase().includes("sentiment"))).length),
            },
          ]}
        />

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <form action="/antikythera" method="get" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="view" value={view} />
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Report week
                </label>
                <select
                  name="report"
                  defaultValue={selectedReportDate ?? ""}
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {availableDates.map((date) => (
                    <option key={date} value={date}>
                      {formatDateET(date)}
                    </option>
                  ))}
                </select>
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Asset class
                </label>
                <select
                  name="asset"
                  defaultValue={selectedAsset ?? "all"}
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <option value="all">ALL</option>
                  {assetClasses.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  View
                </button>
              </form>
            </div>
            <ViewToggle
              value={view}
              onChange={(next) => {
                const params = new URLSearchParams();
                if (selectedReportDate) {
                  params.set("report", selectedReportDate);
                }
                if (selectedAsset) {
                  params.set("asset", selectedAsset);
                }
                params.set("view", next);
                window.location.href = `/antikythera?${params.toString()}`;
              }}
            />
          </div>

          <div className="mt-6">
            <SignalHeatmap
              signals={filteredSignals.map((signal) => ({
                pair: signal.pair,
                direction: signal.direction,
                assetLabel: signal.assetLabel,
                reasons: signal.reasons,
              }))}
              view={view}
              performanceByPair={performanceByPair}
            />
          </div>
        </section>

        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {latestAntikytheraRefresh
            ? `Last refresh ${formatDateTimeET(latestAntikytheraRefresh)}`
            : "No refresh yet"}
        </div>
      </div>
    </DashboardLayout>
  );
}
