/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Freshness-first operational status page for canonical data, live feeds, and workspace health.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
import DashboardLayout from "@/components/DashboardLayout";
import StatusPanel from "@/components/StatusPanel";
import { getAppDiagnostics } from "@/lib/diagnostics";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { queryOne } from "@/lib/db";
import { readNewsWeeklySnapshot } from "@/lib/news/store";
import { readCanonicalPerformanceReport } from "@/lib/performance/canonicalPerformanceReport";
import { readMarketSnapshot } from "@/lib/priceStore";
import { getPriceSymbolCandidates } from "@/lib/pricePerformance";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import { MyfxbookProvider } from "@/lib/sentiment/providers/myfxbook";
import { ALL_SENTIMENT_SYMBOLS } from "@/lib/sentiment/symbols";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import type { Mt5AccountSnapshot } from "@/lib/mt5Store";
import { readMt5Accounts } from "@/lib/mt5Store";
import { readBotState } from "@/lib/botState";
import { formatDateET, formatDateTimeET, latestIso } from "@/lib/time";

export const dynamic = "force-dynamic";

type HealthItem = {
  name: string;
  status: "ok" | "warning" | "error";
  detail: string;
  hint?: string;
};

type FreshnessStatus = "fresh" | "stale" | "missing";

type FreshnessCard = {
  name: string;
  status: FreshnessStatus;
  detail: string;
  lastUpdated: string | null;
  hint?: string;
};

type CanonicalStatsRow = {
  latest_updated_at: string | null;
  total_rows: string | number;
  weekly_rows?: string | number;
  daily_rows?: string | number;
};

type PriceDebugRow = {
  assetLabel: string;
  assetId: string;
  reportDate: string | null;
  missingPairs: Array<{
    pair: string;
    symbols: string[];
  }>;
};

const healthToneMap = {
  ok: "bg-emerald-100 text-emerald-700",
  warning: "bg-[var(--accent)]/10 text-[var(--accent-strong)]",
  error: "bg-rose-100 text-rose-700",
};

const freshnessToneMap = {
  fresh: "bg-emerald-100 text-emerald-700",
  stale: "bg-amber-100 text-amber-700",
  missing: "bg-rose-100 text-rose-700",
};

const botToneMap = {
  ON: "bg-emerald-100 text-emerald-700",
  READY: "bg-sky-100 text-sky-700",
  WAITING: "bg-amber-100 text-amber-700",
  OFF: "bg-[var(--panel-border)]/40 text-[var(--foreground)]/70",
};

function isFresh(iso: string | null | undefined, minutes = 15) {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= minutes * 60 * 1000;
}

function resolveFreshnessStatus(
  iso: string | null | undefined,
  freshMinutes: number,
  staleMinutes: number,
): FreshnessStatus {
  if (!iso) return "missing";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "missing";
  const ageMs = Date.now() - ts;
  if (ageMs <= freshMinutes * 60 * 1000) return "fresh";
  if (ageMs <= staleMinutes * 60 * 1000) return "stale";
  return "missing";
}

function formatLastUpdated(iso: string | null | undefined) {
  return iso ? formatDateTimeET(iso) : "No refresh yet";
}

function toCount(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function buildFreshnessCard(options: {
  name: string;
  iso: string | null | undefined;
  detail: string;
  freshMinutes: number;
  staleMinutes: number;
  hint?: string;
}): FreshnessCard {
  return {
    name: options.name,
    status: resolveFreshnessStatus(options.iso, options.freshMinutes, options.staleMinutes),
    detail: options.detail,
    lastUpdated: options.iso ?? null,
    hint: options.hint,
  };
}

function buildWorkspaceHealthCard(options: {
  name: string;
  status: FreshnessStatus;
  detail: string;
  lastUpdated?: string | null;
  hint?: string;
}): FreshnessCard {
  return {
    name: options.name,
    status: options.status,
    detail: options.detail,
    lastUpdated: options.lastUpdated ?? null,
    hint: options.hint,
  };
}

export default async function StatusPage() {
  let dbError: string | null = null;
  let priceError: string | null = null;
  let sentimentError: string | null = null;
  let accountsError: string | null = null;
  let canonicalError: string | null = null;
  let newsError: string | null = null;
  let myfxbookDebugError: string | null = null;

  let sentimentAggregates: SentimentAggregate[] = [];
  let accounts: Mt5AccountSnapshot[] = [];
  let canonicalBarsStats: CanonicalStatsRow | null = null;
  let pairReturnStats: CanonicalStatsRow | null = null;
  let canonicalReportGeneratedUtc: string | null = null;
  let canonicalSummaryCount = 0;
  let latestNewsSnapshot:
    | {
        fetched_at: string;
        announcements: unknown[];
        calendar: unknown[];
      }
    | null = null;
  let myfxbookDebug: {
    ok: boolean;
    httpStatus: number;
    statusText: string;
    latencyMs: number;
    headers: Record<string, string>;
    parseError: string | null;
    apiError: boolean | null;
    apiMessage: string | null;
    symbolCount: number;
    mappedCount: number;
    droppedCount: number;
    criticalMissing: string[];
    mappings: Array<{
      raw: string;
      mapped: string;
      wasMapped: boolean;
      reason: string;
      included: boolean;
    }>;
    bodyExcerpt: string;
    fetchedAtUtc: string;
  } | null = null;
  let priceSnapshots: Array<{
    assetLabel: string;
    assetId: string;
    lastRefreshUtc: string | null;
    missingPairs: string[];
  }> = [];
  let priceDebug: PriceDebugRow[] = [];

  const assetClasses = listAssetClasses();
  const bitgetState = await readBotState("bitget_perp_v2");

  let cotSnapshotsByAsset: Array<{
    assetId: string;
    assetLabel: string;
    reportDate: string | null;
    lastRefreshUtc: string | null;
  }> = [];

  try {
    cotSnapshotsByAsset = await Promise.all(
      assetClasses.map(async (asset) => {
        const snapshot = await readSnapshot({ assetClass: asset.id });
        return {
          assetId: asset.id,
          assetLabel: asset.label,
          reportDate: snapshot?.report_date ?? null,
          lastRefreshUtc: snapshot?.last_refresh_utc ?? null,
        };
      }),
    );
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  try {
    priceSnapshots = await Promise.all(
      assetClasses.map(async (asset) => {
        const snapshot = await readMarketSnapshot(undefined, asset.id);
        const missingPairs = snapshot
          ? Object.entries(snapshot.pairs)
              .filter(([, value]) => value === null)
              .map(([pair]) => pair)
          : [];
        return {
          assetLabel: asset.label,
          assetId: asset.id,
          lastRefreshUtc: snapshot?.last_refresh_utc ?? null,
          missingPairs,
        };
      }),
    );
  } catch (error) {
    priceError = error instanceof Error ? error.message : String(error);
  }

  try {
    sentimentAggregates = await getLatestAggregatesLocked();
  } catch (error) {
    sentimentError = error instanceof Error ? error.message : String(error);
  }

  try {
    accounts = await readMt5Accounts();
  } catch (error) {
    accountsError = error instanceof Error ? error.message : String(error);
  }

  try {
    canonicalBarsStats = await queryOne<CanonicalStatsRow>(
      `SELECT MAX(updated_at)::text AS latest_updated_at,
              COUNT(*)::bigint AS total_rows
       FROM canonical_price_bars`,
    );
    pairReturnStats = await queryOne<CanonicalStatsRow>(
      `SELECT MAX(updated_at)::text AS latest_updated_at,
              COUNT(*)::bigint AS total_rows,
              COUNT(*) FILTER (WHERE period_type = 'weekly')::bigint AS weekly_rows,
              COUNT(*) FILTER (WHERE period_type = 'daily')::bigint AS daily_rows
       FROM pair_period_returns`,
    );
    const canonicalReport = await readCanonicalPerformanceReport();
    canonicalReportGeneratedUtc = canonicalReport.generatedUtc;
    canonicalSummaryCount = canonicalReport.summary.length;
  } catch (error) {
    canonicalError = error instanceof Error ? error.message : String(error);
  }

  try {
    const snapshot = await readNewsWeeklySnapshot();
    if (snapshot) {
      latestNewsSnapshot = {
        fetched_at: snapshot.fetched_at,
        announcements: snapshot.announcements,
        calendar: snapshot.calendar,
      };
    }
  } catch (error) {
    newsError = error instanceof Error ? error.message : String(error);
  }

  try {
    const provider = new MyfxbookProvider();
    const result = await provider.fetchOutlookRaw();
    const symbols = result.parsed?.symbols?.map((symbol) => symbol.name) ?? [];
    const symbolMappings = provider.getSymbolMappingDebug(
      symbols,
      Array.from(ALL_SENTIMENT_SYMBOLS),
    );
    const mappedCount = symbolMappings.filter((item) => item.included).length;
    const droppedCount = symbolMappings.length - mappedCount;
    const criticalSymbols = [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCHF",
      "USDCAD",
      "AUDUSD",
      "NZDUSD",
      "SPXUSD",
      "NDXUSD",
      "NIKKEIUSD",
      "WTIUSD",
      "XAUUSD",
      "XAGUSD",
      "BTCUSD",
      "ETHUSD",
    ];
    const keptSymbols = new Set(
      symbolMappings.filter((item) => item.included).map((item) => item.mapped_symbol),
    );
    const criticalMissing = criticalSymbols.filter((symbol) => !keptSymbols.has(symbol));
    myfxbookDebug = {
      ok: result.http_status === 200 && !result.parsed?.error,
      httpStatus: result.http_status,
      statusText: result.status_text,
      latencyMs: result.latency_ms,
      headers: result.headers,
      parseError: result.parse_error,
      apiError: result.parsed?.error ?? null,
      apiMessage: result.parsed?.message ?? null,
      symbolCount: symbols.length,
      mappedCount,
      droppedCount,
      criticalMissing,
      mappings: symbolMappings.map((item) => ({
        raw: item.raw_symbol,
        mapped: item.mapped_symbol,
        wasMapped: item.was_mapped,
        reason: item.reason,
        included: item.included,
      })),
      bodyExcerpt: result.body_excerpt,
      fetchedAtUtc: new Date().toISOString(),
    };
  } catch (error) {
    myfxbookDebugError = error instanceof Error ? error.message : String(error);
  }

  try {
    priceDebug = await Promise.all(
      assetClasses.map(async (asset) => {
        const snapshot = await readSnapshot({ assetClass: asset.id });
        const pairs = snapshot ? Object.keys(snapshot.pairs) : [];
        return {
          assetLabel: asset.label,
          assetId: asset.id,
          reportDate: snapshot?.report_date ?? null,
          missingPairs: pairs.map((pair) => ({
            pair,
            symbols: getPriceSymbolCandidates(pair, asset.id),
          })),
        };
      }),
    );
  } catch (error) {
    priceError = error instanceof Error ? error.message : String(error);
  }

  const issues = getAppDiagnostics({
    dbError,
    priceError: priceError ?? canonicalError,
    sentimentError,
    accountsError: accountsError ?? newsError,
  });

  const latestSentimentTimestamp = latestIso(
    sentimentAggregates.map((aggregate) => aggregate.timestamp_utc),
  );
  const latestAccountSync = latestIso(accounts.map((account) => account.last_sync_utc));
  const latestCotRefresh = latestIso(cotSnapshotsByAsset.map((asset) => asset.lastRefreshUtc));
  const latestPriceSnapshotRefresh = latestIso(priceSnapshots.map((asset) => asset.lastRefreshUtc));
  const latestCanonicalBars = canonicalBarsStats?.latest_updated_at ?? null;
  const latestPairReturns = pairReturnStats?.latest_updated_at ?? null;
  const latestStatusRefresh = latestIso([
    latestCotRefresh,
    latestPriceSnapshotRefresh,
    latestSentimentTimestamp,
    latestAccountSync,
    canonicalReportGeneratedUtc,
    latestCanonicalBars,
    latestPairReturns,
    latestNewsSnapshot?.fetched_at ?? null,
  ]);

  const mt5Status =
    accounts.length === 0 ? "OFF" : isFresh(latestAccountSync, 15) ? "ON" : "OFF";
  const bitgetLifecycle = String(
    (bitgetState?.state as { lifecycle?: string } | undefined)?.lifecycle ?? "",
  );
  const bitgetStatus =
    !bitgetState || bitgetLifecycle === "" || bitgetLifecycle === "IDLE" || bitgetLifecycle === "KILLED"
      ? "OFF"
      : ["POSITION_OPEN", "SCALING", "TRAILING"].includes(bitgetLifecycle)
        ? "ON"
        : "WAITING";

  const health: HealthItem[] = [
    {
      name: "Database",
      status: dbError ? "error" : "ok",
      detail: dbError ? dbError : "Connection OK",
      hint: dbError ? "Check DATABASE_URL on Vercel." : undefined,
    },
    {
      name: "Canonical data",
      status: canonicalError ? "error" : latestPairReturns ? "ok" : "warning",
      detail: canonicalError
        ? canonicalError
        : latestPairReturns
          ? "Canonical bars, returns, and reconstruction report are available."
          : "Canonical price/performance layers are missing.",
      hint: latestPairReturns ? undefined : "Run canonical price backfill and reconstruction.",
    },
    {
      name: "Sentiment",
      status: sentimentError ? "error" : sentimentAggregates.length ? "ok" : "warning",
      detail: sentimentError
        ? sentimentError
        : sentimentAggregates.length
          ? "Aggregates available."
          : "No sentiment data.",
      hint: sentimentAggregates.length ? undefined : "Run sentiment refresh.",
    },
    {
      name: "Accounts",
      status: accountsError ? "error" : accounts.length ? "ok" : "warning",
      detail: accountsError
        ? accountsError
        : accounts.length
          ? `${accounts.length} account(s) reporting.`
          : "No MT5 accounts connected.",
      hint: accounts.length ? undefined : "Check MT5 push URL + token.",
    },
    {
      name: "News",
      status: newsError ? "error" : latestNewsSnapshot ? "ok" : "warning",
      detail: newsError
        ? newsError
        : latestNewsSnapshot
          ? "ForexFactory snapshot cache available."
          : "No news snapshot yet.",
      hint: latestNewsSnapshot ? undefined : "Run news refresh.",
    },
  ];

  const canonicalCards: FreshnessCard[] = [
    buildFreshnessCard({
      name: "Canonical Price Bars",
      iso: latestCanonicalBars,
      detail: `${toCount(canonicalBarsStats?.total_rows)} canonical bars stored.`,
      freshMinutes: 60 * 24 * 7,
      staleMinutes: 60 * 24 * 30,
      hint: "Backfill or refresh canonical bars if this lags.",
    }),
    buildFreshnessCard({
      name: "Pair Period Returns",
      iso: latestPairReturns,
      detail: `${toCount(pairReturnStats?.weekly_rows)} weekly + ${toCount(pairReturnStats?.daily_rows)} daily rows.`,
      freshMinutes: 60 * 24 * 7,
      staleMinutes: 60 * 24 * 30,
      hint: "Refresh derived returns after updating bars.",
    }),
    buildFreshnessCard({
      name: "Weekly Reconstruction",
      iso: canonicalReportGeneratedUtc,
      detail: `${canonicalSummaryCount} canonical systems in report.`,
      freshMinutes: 60 * 24 * 7,
      staleMinutes: 60 * 24 * 21,
      hint: "Re-run reconstruction when the canonical week extends.",
    }),
  ];

  const liveFeedCards: FreshnessCard[] = [
    buildFreshnessCard({
      name: "COT Snapshots",
      iso: latestCotRefresh,
      detail: `${cotSnapshotsByAsset.filter((asset) => asset.reportDate).length}/${assetClasses.length} asset classes loaded.`,
      freshMinutes: 60 * 24 * 7,
      staleMinutes: 60 * 24 * 21,
      hint: "COT refresh should advance weekly.",
    }),
    buildFreshnessCard({
      name: "Price Snapshots",
      iso: latestPriceSnapshotRefresh,
      detail: `${priceSnapshots.filter((asset) => asset.lastRefreshUtc).length}/${assetClasses.length} live snapshot classes refreshed.`,
      freshMinutes: 60 * 24,
      staleMinutes: 60 * 24 * 7,
      hint: "Refresh live market snapshots if this stalls.",
    }),
    buildFreshnessCard({
      name: "Sentiment Lock",
      iso: latestSentimentTimestamp,
      detail: `${sentimentAggregates.length} locked sentiment aggregates.`,
      freshMinutes: 60 * 24 * 2,
      staleMinutes: 60 * 24 * 7,
      hint: "Refresh sentiment providers if this goes stale.",
    }),
    buildFreshnessCard({
      name: "News Snapshot",
      iso: latestNewsSnapshot?.fetched_at ?? null,
      detail: latestNewsSnapshot
        ? `${latestNewsSnapshot.calendar.length} events cached.`
        : "No news events cached.",
      freshMinutes: 60 * 6,
      staleMinutes: 60 * 24 * 3,
      hint: "Run the news refresh if events stop updating.",
    }),
    buildFreshnessCard({
      name: "Account Sync",
      iso: latestAccountSync,
      detail: `${accounts.length} MT5 account(s) reporting.`,
      freshMinutes: 30,
      staleMinutes: 60 * 24,
      hint: "Check MT5 push script/EA if sync falls behind.",
    }),
  ];

  const nonCryptoAssetCount = assetClasses.filter((asset) => asset.id !== "crypto").length;
  const cotFreshCount = cotSnapshotsByAsset.filter((asset) => isFresh(asset.lastRefreshUtc, 60 * 24 * 7)).length;
  const priceFreshCount = priceSnapshots.filter((asset) => isFresh(asset.lastRefreshUtc, 60 * 24)).length;
  const cfdSourceHealthy =
    cotFreshCount >= Math.max(1, nonCryptoAssetCount - 1) &&
    priceFreshCount >= Math.max(1, nonCryptoAssetCount - 1) &&
    sentimentAggregates.length > 0;
  const cryptoSourcesHealthy =
    isFresh(
      cotSnapshotsByAsset.find((asset) => asset.assetId === "crypto")?.lastRefreshUtc ?? null,
      60 * 24 * 7,
    ) &&
    isFresh(
      priceSnapshots.find((asset) => asset.assetId === "crypto")?.lastRefreshUtc ?? null,
      60 * 24,
    );

  const workspaceCards: FreshnessCard[] = [
    buildWorkspaceHealthCard({
      name: "Matrix CFD",
      status: cfdSourceHealthy ? "fresh" : "stale",
      detail: cfdSourceHealthy
        ? "Live CFD matrix inputs are available."
        : "One or more CFD live inputs are stale.",
      lastUpdated: latestIso([latestCotRefresh, latestPriceSnapshotRefresh, latestSentimentTimestamp]),
      hint: cfdSourceHealthy ? undefined : "Check COT, live prices, and sentiment refresh jobs.",
    }),
    buildWorkspaceHealthCard({
      name: "Matrix Crypto",
      status: cryptoSourcesHealthy ? "fresh" : "stale",
      detail: cryptoSourcesHealthy
        ? "Crypto matrix inputs are available."
        : "Crypto COT or price snapshot inputs are stale.",
      lastUpdated: latestIso([
        cotSnapshotsByAsset.find((asset) => asset.assetId === "crypto")?.lastRefreshUtc ?? null,
        priceSnapshots.find((asset) => asset.assetId === "crypto")?.lastRefreshUtc ?? null,
      ]),
      hint: cryptoSourcesHealthy ? undefined : "Refresh crypto COT and price snapshots.",
    }),
    buildWorkspaceHealthCard({
      name: "Swing Board",
      status: canonicalReportGeneratedUtc ? "fresh" : "missing",
      detail: canonicalReportGeneratedUtc
        ? "Weekly flagship metadata is available for forward testing."
        : "Canonical weekly flagship metadata is missing.",
      lastUpdated: canonicalReportGeneratedUtc,
      hint: canonicalReportGeneratedUtc ? undefined : "Rebuild the canonical reconstruction report.",
    }),
    buildWorkspaceHealthCard({
      name: "Intraday Board",
      status: "stale",
      detail: "Intraday remains in research and is not yet promoted.",
      hint: "Lock the intraday flagship before promoting this surface.",
    }),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">System Status</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Operational health for canonical data, live feeds, account sync, and workspace surfaces.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Last refresh {latestStatusRefresh ? formatDateTimeET(latestStatusRefresh) : "No refresh yet"}
          </div>
        </header>

        <StatusPanel issues={issues} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {health.map((item) => (
            <HealthStatusCard key={item.name} item={item} />
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Canonical Freshness</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Core historical truth layers that power weekly analysis and performance reporting.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {canonicalCards.map((card) => (
              <FreshnessStatusCard key={card.name} card={card} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Feed Freshness</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Ongoing refresh cadence for live data, snapshots, and account reporting.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveFeedCards.map((card) => (
              <FreshnessStatusCard key={card.name} card={card} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Workspace Health</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Readiness of the main user-facing boards and flagship surfaces.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workspaceCards.map((card) => (
              <FreshnessStatusCard key={card.name} card={card} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Automation Bots</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Live heartbeat and readiness for currently monitored automation processes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--foreground)]">MT5 Basket EA</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${botToneMap[mt5Status]}`}>
                  {mt5Status}
                </span>
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Last sync {latestAccountSync ? formatDateTimeET(latestAccountSync) : "No sync yet"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Accounts reporting: {accounts.length}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--foreground)]">Bitget Perp Bot v2</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${botToneMap[bitgetStatus]}`}>
                  {bitgetStatus}
                </span>
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Last heartbeat {bitgetState?.updated_at ? formatDateTimeET(bitgetState.updated_at) : "No heartbeat yet"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Lifecycle: {bitgetLifecycle || "IDLE"}
              </p>
            </div>
          </div>
        </section>

        <details className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
            Debug
          </summary>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Raw provider diagnostics and symbol-mapping details for deeper troubleshooting.
          </p>

          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Price Snapshot Coverage</h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Missing live price symbols by asset class.
                </p>
              </div>
              {priceSnapshots.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">No price snapshots.</p>
              ) : (
                <div className="space-y-4">
                  {priceSnapshots.map((snapshot) => (
                    <div
                      key={snapshot.assetId}
                      className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {snapshot.assetLabel}
                        </p>
                        <span className="text-xs text-[var(--muted)]">
                          {snapshot.lastRefreshUtc
                            ? formatDateTimeET(snapshot.lastRefreshUtc)
                            : "No refresh yet"}
                        </span>
                      </div>
                      {snapshot.missingPairs.length === 0 ? (
                        <p className="mt-2 text-sm text-emerald-700">No missing prices detected.</p>
                      ) : (
                        <p className="mt-2 text-xs text-rose-700">
                          Missing: {snapshot.missingPairs.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Myfxbook Debug</h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Raw provider response diagnostics for sentiment troubleshooting.
                </p>
              </div>
              {myfxbookDebugError ? (
                <p className="text-sm text-rose-700">{myfxbookDebugError}</p>
              ) : !myfxbookDebug ? (
                <p className="text-sm text-[color:var(--muted)]">No debug data.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-[var(--foreground)]">
                    <span className="font-semibold">Status:</span> {myfxbookDebug.ok ? "OK" : "NOT OK"} (
                    {myfxbookDebug.httpStatus} {myfxbookDebug.statusText}) |{" "}
                    <span className="font-semibold">Latency:</span> {myfxbookDebug.latencyMs}ms
                  </p>
                  <p className="text-[color:var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">Fetched:</span>{" "}
                    {formatDateTimeET(myfxbookDebug.fetchedAtUtc)}
                  </p>
                  <p className="text-[color:var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">Mapped:</span>{" "}
                    {myfxbookDebug.mappedCount} |{" "}
                    <span className="font-semibold text-[var(--foreground)]">Dropped:</span>{" "}
                    {myfxbookDebug.droppedCount}
                  </p>
                  <p className="text-[color:var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">Critical Missing:</span>{" "}
                    {myfxbookDebug.criticalMissing.length === 0
                      ? "None"
                      : myfxbookDebug.criticalMissing.join(", ")}
                  </p>
                  <div className="rounded-xl border border-[var(--panel-border)]/60 bg-[var(--panel)] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Symbol Mapping
                    </p>
                    <div className="max-h-56 overflow-auto text-xs text-[var(--muted)]">
                      {myfxbookDebug.mappings.map((item, index) => (
                        <div
                          key={`${item.raw}-${item.mapped}-${index}`}
                          className="border-t border-[var(--panel-border)]/40 py-1"
                        >
                          <span className="font-semibold text-[var(--foreground)]">{item.raw}</span>
                          {" -> "}
                          <span className="font-semibold text-[var(--foreground)]">{item.mapped}</span>
                          {item.wasMapped ? " (alias map)" : ""}
                          {" | "}
                          {item.included ? "kept" : `dropped (${item.reason})`}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--panel-border)]/60 bg-[var(--panel)] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Body Excerpt
                    </p>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">
                      {myfxbookDebug.bodyExcerpt || "(empty)"}
                    </pre>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Price Symbol Candidates</h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Candidate symbol mappings used in live price debugging.
                </p>
              </div>
              {priceDebug.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">No COT snapshots.</p>
              ) : (
                <div className="space-y-4">
                  {priceDebug.map((asset) => (
                    <div
                      key={asset.assetId}
                      className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {asset.assetLabel}
                        </p>
                        <span className="text-xs text-[var(--muted)]">
                          {asset.reportDate ? formatDateET(asset.reportDate) : "No report date"}
                        </span>
                      </div>
                      <div className="mt-3 max-h-64 overflow-y-auto text-xs text-[var(--muted)]">
                        {asset.missingPairs.map((pair) => (
                          <div
                            key={`${asset.assetId}-${pair.pair}`}
                            className="border-t border-[var(--panel-border)]/40 py-2"
                          >
                            <span className="font-semibold text-[var(--foreground)]">
                              {pair.pair}
                            </span>
                            <span className="ml-2 text-[var(--muted)]">
                              {pair.symbols.join(", ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
}

function HealthStatusCard({ item }: { item: HealthItem }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${healthToneMap[item.status]}`}>
          {item.status.toUpperCase()}
        </span>
      </div>
      <p className="mt-3 text-sm text-[color:var(--muted)]">{item.detail}</p>
      {item.hint ? (
        <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">Fix: {item.hint}</p>
      ) : null}
    </div>
  );
}

function FreshnessStatusCard({ card }: { card: FreshnessCard }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">{card.name}</p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${freshnessToneMap[card.status]}`}
        >
          {card.status.toUpperCase()}
        </span>
      </div>
      <p className="mt-3 text-sm text-[color:var(--muted)]">{card.detail}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Last update {formatLastUpdated(card.lastUpdated)}
      </p>
      {card.hint ? (
        <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">{card.hint}</p>
      ) : null}
    </div>
  );
}
