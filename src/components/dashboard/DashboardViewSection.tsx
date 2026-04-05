/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: DashboardViewSection.tsx
 *
 * Description:
 * Client-side Data dashboard view that switches week, bias, and view state
 * instantly from a server-bootstrapped payload.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeET } from "@/lib/time";
import type { Direction } from "@/lib/cotTypes";
import type { PairPerformance } from "@/lib/priceStore";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import type { WeekSnapshotProvenance } from "@/lib/performance/snapshotProvenance";
import type {
  CanonicalSentimentHeatmapRow,
  MyfxbookPositioning,
} from "@/components/SentimentHeatmap";
import SummaryCards from "@/components/SummaryCards";
import MiniBiasStrip from "@/components/MiniBiasStrip";
import PairHeatmap from "@/components/PairHeatmap";
import SentimentHeatmap from "@/components/SentimentHeatmap";
import ViewToggle from "@/components/ViewToggle";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import {
  DATA_DASHBOARD_BIAS_COMMIT_EVENT,
  resolveDashboardBias,
  type DashboardBias,
} from "@/lib/dashboard/dashboardSelection";

type AssetOption = {
  id: string;
  label: string;
};

type DetailItem = {
  label: string;
  value: string;
};

type DashboardPairRow = {
  pair: string;
  direction: Direction;
  performance: PairPerformance | null;
  subtitle?: string;
  details: DetailItem[];
};

type DashboardCurrencyRow = {
  assetLabel: string;
  currency: string;
  label: string;
  long: number;
  short: number;
  net: number;
  bias: string;
};

export type DashboardCotPayload = {
  combinedRefresh: string;
  totalPairsCount: number;
  pairRowsWithPerf: DashboardPairRow[];
  missingPairs: string[];
  currencyRows: DashboardCurrencyRow[];
  biasLabel: string;
  flipDetails: DetailItem[];
};

export type DashboardSentimentPayload = {
  latestAggregateTimestamp: string | null;
  aggregates: SentimentAggregate[];
  resolvedRows: CanonicalSentimentHeatmapRow[];
  performanceByPair: Record<string, number | null>;
  flipDetails: DetailItem[];
};

export type DashboardStrengthPayload = {
  latestSnapshotUtc: string | null;
  totalPairsCount: number;
  pairRowsWithPerf: DashboardPairRow[];
  missingPairs: string[];
  stripItems: Array<{ id: string; label: string; bias: string }>;
  flipDetails: DetailItem[];
  note?: string;
};

type DashboardViewSectionProps = {
  assetOptions: AssetOption[];
  selectedAsset: string;
  reportOptions: Array<{ value: string; label: string }>;
  initialReport: string;
  initialBias: DashboardBias;
  initialView: "heatmap" | "list";
  currentWeekOpenUtc: string;
  cotDataByReport: Record<
    string,
    {
      dealer: DashboardCotPayload;
      commercial: DashboardCotPayload;
    }
  >;
  sentimentDataByReport: Record<string, DashboardSentimentPayload>;
  strengthDataByReport: Record<string, DashboardStrengthPayload>;
  myfxbookPositioningBySymbol: Record<string, MyfxbookPositioning | undefined>;
  provenanceByReport?: Record<string, WeekSnapshotProvenance>;
};

export default function DashboardViewSection({
  assetOptions,
  selectedAsset,
  reportOptions,
  initialReport,
  initialBias,
  initialView,
  currentWeekOpenUtc,
  cotDataByReport,
  sentimentDataByReport,
  strengthDataByReport,
  myfxbookPositioningBySymbol,
  provenanceByReport,
}: DashboardViewSectionProps) {
  const defaultReport = initialReport || reportOptions[0]?.value || "";
  const [selectedReport, setSelectedReport] = useState(defaultReport);
  const [selectedBias, setSelectedBias] = useState<DashboardBias>(initialBias);
  const [selectedView, setSelectedView] = useState<"heatmap" | "list">(initialView);

  useEffect(() => {
    setSelectedReport(initialReport || reportOptions[0]?.value || "");
  }, [initialReport, reportOptions]);

  useEffect(() => {
    setSelectedBias(initialBias);
  }, [initialBias]);

  useEffect(() => {
    setSelectedView(initialView);
  }, [initialView]);

  useEffect(() => {
    const handleBiasCommit = (event: Event) => {
      const detail = (event as CustomEvent<{ bias?: string }>).detail;
      setSelectedBias(resolveDashboardBias(detail?.bias));
    };
    window.addEventListener(DATA_DASHBOARD_BIAS_COMMIT_EVENT, handleBiasCommit);
    return () => {
      window.removeEventListener(DATA_DASHBOARD_BIAS_COMMIT_EVENT, handleBiasCommit);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedAsset) {
      url.searchParams.set("asset", selectedAsset);
    }
    if (selectedReport) {
      url.searchParams.set("report", selectedReport);
    } else {
      url.searchParams.delete("report");
    }
    url.searchParams.set("bias", selectedBias);
    url.searchParams.set("view", selectedView);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [selectedAsset, selectedReport, selectedBias, selectedView]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(DATA_DASHBOARD_BIAS_COMMIT_EVENT, {
        detail: { bias: selectedBias },
      }),
    );
  }, [selectedBias]);

  const cotPayload = useMemo(() => {
    if (selectedBias === "sentiment" || selectedBias === "strength") {
      return null;
    }
    return cotDataByReport[selectedReport]?.[selectedBias] ?? null;
  }, [cotDataByReport, selectedBias, selectedReport]);

  const sentimentPayload = useMemo(
    () => sentimentDataByReport[selectedReport] ?? null,
    [selectedReport, sentimentDataByReport],
  );

  const strengthPayload = useMemo(
    () => strengthDataByReport[selectedReport] ?? null,
    [selectedReport, strengthDataByReport],
  );

  const headerTitle = selectedBias === "commercial"
    ? "Commercial"
    : selectedBias === "sentiment"
      ? "Sentiment"
      : selectedBias === "strength"
        ? "Strength"
      : "Dealer";

  const provenance = provenanceByReport?.[selectedReport] ?? null;
  const headerRefreshLabel = useMemo(() => {
    if (provenance) {
      const snapshotUtc =
        selectedBias === "sentiment"
          ? provenance.sentiment.snapshotUtc
          : selectedBias === "strength"
            ? provenance.strength.snapshotUtc
            : provenance.cot.snapshotUtc;
      return snapshotUtc ? `Snapshot ${formatDateTimeET(snapshotUtc)}` : "No snapshot yet";
    }

    const fallback = selectedBias === "sentiment"
      ? sentimentPayload?.latestAggregateTimestamp ?? null
      : selectedBias === "strength"
        ? strengthPayload?.latestSnapshotUtc ?? null
      : cotPayload?.combinedRefresh ?? null;
    return fallback ? `Last refresh ${formatDateTimeET(fallback)}` : "No refresh yet";
  }, [cotPayload?.combinedRefresh, provenance, selectedBias, sentimentPayload?.latestAggregateTimestamp, strengthPayload?.latestSnapshotUtc]);

  const pairRows =
    selectedBias === "strength"
      ? strengthPayload?.pairRowsWithPerf ?? []
      : cotPayload?.pairRowsWithPerf ?? [];
  const longDetails = pairRows
    .filter((row) => row.direction === "LONG")
    .map((row) => ({ label: row.pair, value: "LONG" }));
  const shortDetails = pairRows
    .filter((row) => row.direction === "SHORT")
    .map((row) => ({ label: row.pair, value: "SHORT" }));
  const neutralDetails = pairRows
    .filter((row) => row.direction === "NEUTRAL")
    .map((row) => ({ label: row.pair, value: "NEUTRAL" }));

  const sentimentAggregates = sentimentPayload?.aggregates ?? [];
  const sentimentResolvedRows = sentimentPayload?.resolvedRows ?? [];
  const sentimentLongDetails = sentimentResolvedRows
    .filter((row) => row.direction === "LONG")
    .map((row) => ({ label: row.symbol, value: row.tier === "F" ? `Tier ${row.tier} · ${row.tierFSubStep ?? "forced"}` : `Tier ${row.tier}` }));
  const sentimentShortDetails = sentimentResolvedRows
    .filter((row) => row.direction === "SHORT")
    .map((row) => ({ label: row.symbol, value: row.tier === "F" ? `Tier ${row.tier} · ${row.tierFSubStep ?? "forced"}` : `Tier ${row.tier}` }));
  const sentimentNeutralDetails: Array<{ label: string; value: string }> = [];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">{headerTitle}</h1>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {headerRefreshLabel}
        </div>
      </header>

      {selectedBias === "sentiment" ? (
        <SummaryCards
          title="Sentiment"
          cards={[
            {
              id: "pairs",
              label: "Pairs tracked",
              value: String(sentimentResolvedRows.length),
              details: sentimentResolvedRows.map((row) => ({
                label: row.symbol,
                value: `${row.direction} · Tier ${row.tier}${row.tier === "F" && row.tierFSubStep ? ` · ${row.tierFSubStep}` : ""}`,
              })),
            },
            {
              id: "short",
              label: "Short",
              value: String(sentimentShortDetails.length),
              tone: "negative",
              details: sentimentShortDetails,
            },
            {
              id: "long",
              label: "Long",
              value: String(sentimentLongDetails.length),
              tone: "positive",
              details: sentimentLongDetails,
            },
            {
              id: "neutral",
              label: "Neutral",
              value: String(sentimentNeutralDetails.length),
              details: sentimentNeutralDetails,
            },
            {
              id: "flips",
              label: "Flips",
              value: String(sentimentPayload?.flipDetails.length ?? 0),
              details: sentimentPayload?.flipDetails ?? [],
            },
          ]}
          />
      ) : selectedBias === "strength" ? (
        <SummaryCards
          title="Strength"
          centered={true}
          cards={[
            {
              id: "pairs",
              label: "Pairs tracked",
              value: String(strengthPayload?.totalPairsCount ?? 0),
            },
            {
              id: "long",
              label: "Bullish",
              value: String(longDetails.length),
              tone: "positive",
              details: longDetails,
            },
            {
              id: "short",
              label: "Bearish",
              value: String(shortDetails.length),
              tone: "negative",
              details: shortDetails,
            },
            {
              id: "neutral",
              label: "Neutral",
              value: String(neutralDetails.length),
              details: neutralDetails,
            },
            {
              id: "flips",
              label: "Flips",
              value: String(strengthPayload?.flipDetails.length ?? 0),
              details: strengthPayload?.flipDetails ?? [],
            },
          ]}
        />
      ) : (
        <div data-cot-surface="true">
          <SummaryCards
            title="Bias"
            centered={true}
            cards={[
              {
                id: "pairs",
                label: "Pairs tracked",
                value: String(cotPayload?.totalPairsCount ?? 0),
              },
              {
                id: "long",
                label: "Long signals",
                value: String(longDetails.length),
                tone: "positive",
                details: longDetails,
              },
              {
                id: "short",
                label: "Short signals",
                value: String(shortDetails.length),
                tone: "negative",
                details: shortDetails,
              },
              {
                id: "neutral",
                label: "Neutral/ignored",
                value: String(neutralDetails.length),
                details: neutralDetails,
              },
              {
                id: "flips",
                label: "Flips",
                value: String(cotPayload?.flipDetails.length ?? 0),
                details: cotPayload?.flipDetails ?? [],
              },
            ]}
          />
        </div>
      )}

      <section
        data-cot-surface={selectedBias === "sentiment" ? undefined : "true"}
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <DashboardFilters
            assetOptions={assetOptions}
            reportOptions={reportOptions}
            selectedAsset={selectedAsset}
            selectedReport={selectedReport}
            selectedBias={selectedBias}
            selectedView={selectedView}
            currentWeekOpenUtc={currentWeekOpenUtc}
            onReportChange={(report) => setSelectedReport(report)}
            onBiasChange={(bias) => setSelectedBias(bias)}
          />
          <ViewToggle
            value={selectedView}
            onChange={setSelectedView}
            items={[
              { value: "heatmap", label: "heatmap" },
              { value: "list", label: "list" },
            ]}
          />
        </div>

        <div className="mt-6">
          {selectedBias === "sentiment" ? (
            <SentimentHeatmap
              aggregates={sentimentAggregates}
              resolvedRows={sentimentResolvedRows}
              view={selectedView}
              performanceByPair={sentimentPayload?.performanceByPair ?? {}}
              myfxbookPositioningBySymbol={myfxbookPositioningBySymbol}
            />
          ) : (
            <PairHeatmap
              rows={pairRows}
              view={selectedView}
              title={selectedBias === "strength" ? "Strength Heatmap" : undefined}
              description={
                selectedBias === "strength"
                  ? "Composite 1h, 4h, and 24h normalized strength across the tracked universe"
                  : undefined
              }
              note={selectedBias === "strength" ? strengthPayload?.note : undefined}
              missingPairs={
                selectedBias === "strength"
                  ? strengthPayload?.missingPairs ?? []
                  : cotPayload?.missingPairs ?? []
              }
            />
          )}
        </div>

        {selectedBias !== "sentiment" ? (
          <div className="mt-6">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {selectedBias === "strength" ? "Strength strip" : `${cotPayload?.biasLabel ?? "Asset"} bias strip`}
            </h2>
            <div className="mt-3">
              <MiniBiasStrip
                items={
                  selectedBias === "strength"
                    ? strengthPayload?.stripItems ?? []
                    : (cotPayload?.currencyRows ?? []).map((row) => ({
                        id: `${row.assetLabel}-${row.currency}`,
                        label: row.label,
                        bias: row.bias,
                      }))
                }
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
