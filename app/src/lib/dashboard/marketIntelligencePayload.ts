import type {
  DashboardCotPayload,
  DashboardSentimentPayload,
  DashboardStrengthPayload,
} from "@/components/dashboard/DashboardViewSection";
import type { MyfxbookPositioning } from "@/components/SentimentHeatmap";
import type { WeekSnapshotProvenance } from "@/lib/performance/snapshotProvenance";

export type MarketIntelligencePayload = {
  assetOptions: Array<{ id: string; label: string }>;
  reportOptions: Array<{
    value: string;
    label: string;
    cotReportLabel?: string;
    fridayFreezeLabel?: string;
    fridayFreezeUtc?: string;
    freezeStatusLabel?: string;
    freezeLedgerReady?: boolean;
  }>;
  selectedAsset: string;
  currentWeekOpenUtc: string;
  activeBaseline: {
    id: string;
    mode: "active";
    activeWeekCount: number;
    archiveAvailable: boolean;
  };
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
  provenanceByReport: Record<string, WeekSnapshotProvenance>;
  fetchedAtUtc: string;
};
