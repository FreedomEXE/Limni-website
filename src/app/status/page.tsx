import DashboardLayout from "@/components/DashboardLayout";
import StatusPanel from "@/components/StatusPanel";
import { getAppDiagnostics } from "@/lib/diagnostics";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { readMarketSnapshot } from "@/lib/priceStore";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import { MyfxbookProvider } from "@/lib/sentiment/providers/myfxbook";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { ALL_SENTIMENT_SYMBOLS } from "@/lib/sentiment/symbols";
import type { Mt5AccountSnapshot } from "@/lib/mt5Store";
import { readMt5Accounts } from "@/lib/mt5Store";
import { getPriceSymbolCandidates } from "@/lib/pricePerformance";
import { formatDateET, formatDateTimeET, latestIso } from "@/lib/time";

export const dynamic = "force-dynamic";

type HealthItem = {
  name: string;
  status: "ok" | "warning" | "error";
  detail: string;
  hint?: string;
};

const toneMap = {
  ok: "bg-emerald-100 text-emerald-700",
  warning: "bg-[var(--accent)]/10 text-[var(--accent-strong)]",
  error: "bg-rose-100 text-rose-700",
};

export default async function StatusPage() {
  let dbError: string | null = null;
  let priceError: string | null = null;
  let sentimentError: string | null = null;
  let accountsError: string | null = null;
  let myfxbookDebugError: string | null = null;

  let cotSnapshot = null;
  let marketSnapshot = null;
  let sentimentAggregates: SentimentAggregate[] = [];
  let accounts: Mt5AccountSnapshot[] = [];
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
    symbols: string[];
    mappedCount: number;
    droppedCount: number;
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
  let priceDebug: Array<{
    assetLabel: string;
    assetId: string;
    reportDate: string | null;
    missingPairs: Array<{
      pair: string;
      symbols: string[];
    }>;
  }> = [];

  try {
    cotSnapshot = await readSnapshot();
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  try {
    marketSnapshot = await readMarketSnapshot();
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
    const provider = new MyfxbookProvider();
    const result = await provider.fetchOutlookRaw();
    const symbols = result.parsed?.symbols?.map((symbol) => symbol.name) ?? [];
    const symbolMappings = provider.getSymbolMappingDebug(
      symbols,
      Array.from(ALL_SENTIMENT_SYMBOLS),
    );
    const mappedCount = symbolMappings.filter((item) => item.included).length;
    const droppedCount = symbolMappings.length - mappedCount;
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
      symbols,
      mappedCount,
      droppedCount,
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
    priceSnapshots = await Promise.all(
      listAssetClasses().map(async (asset) => {
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
    priceDebug = await Promise.all(
      listAssetClasses().map(async (asset) => {
        const snapshot = await readSnapshot({ assetClass: asset.id });
        const pairs = snapshot ? Object.keys(snapshot.pairs) : [];
        const missingPairs = pairs.map((pair) => ({
          pair,
          symbols: getPriceSymbolCandidates(pair, asset.id),
        }));
        return {
          assetLabel: asset.label,
          assetId: asset.id,
          reportDate: snapshot?.report_date ?? null,
          missingPairs,
        };
      }),
    );
  } catch (error) {
    priceError = error instanceof Error ? error.message : String(error);
  }

  const issues = getAppDiagnostics({
    dbError,
    priceError,
    sentimentError,
    accountsError,
  });
  const latestSentimentTimestamp = latestIso(
    sentimentAggregates.map((aggregate) => aggregate.timestamp_utc),
  );
  const latestAccountSync = latestIso(
    accounts.map((account) => account.last_sync_utc),
  );
  const latestStatusRefresh = latestIso([
    cotSnapshot?.last_refresh_utc ?? null,
    marketSnapshot?.last_refresh_utc ?? null,
    latestSentimentTimestamp,
    latestAccountSync,
  ]);

  const health: HealthItem[] = [
    {
      name: "Database",
      status: dbError ? "error" : "ok",
      detail: dbError ? dbError : "Connection OK",
      hint: dbError ? "Check DATABASE_URL on Vercel." : undefined,
    },
    {
      name: "COT snapshot",
      status: cotSnapshot ? "ok" : "warning",
      detail: cotSnapshot ? "Latest snapshot loaded." : "No snapshot yet.",
      hint: cotSnapshot ? undefined : "Run Refresh COT data.",
    },
    {
      name: "Price snapshot",
      status: priceError ? "error" : marketSnapshot ? "ok" : "warning",
      detail: priceError
        ? priceError
        : marketSnapshot
          ? "Price snapshot ready."
          : "No price snapshot.",
      hint: marketSnapshot ? undefined : "Run Refresh prices.",
    },
    {
      name: "Sentiment",
      status: sentimentError ? "error" : sentimentAggregates.length ? "ok" : "warning",
      detail: sentimentError
        ? sentimentError
        : sentimentAggregates.length
          ? "Aggregates available."
          : "No sentiment data.",
      hint: sentimentAggregates.length ? undefined : "Run Refresh sentiment data.",
    },
    {
      name: "Connected accounts",
      status: accountsError ? "error" : accounts.length ? "ok" : "warning",
      detail: accountsError
        ? accountsError
        : accounts.length
          ? `${accounts.length} account(s) reporting.`
          : "No MT5 accounts connected.",
      hint: accounts.length ? undefined : "Check MT5 push URL + token.",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">System Status</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Diagnostics for deployments, data sources, and MT5 connectivity.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Last refresh{" "}
            {latestStatusRefresh
              ? formatDateTimeET(latestStatusRefresh)
              : "No refresh yet"}
          </div>
        </header>

        <StatusPanel issues={issues} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {health.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${toneMap[item.status]}`}
                >
                  {item.status.toUpperCase()}
                </span>
              </div>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                {item.detail}
              </p>
              {item.hint ? (
                <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">
                  Fix: {item.hint}
                </p>
              ) : null}
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Price Debug</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Missing price symbols by asset class with the current symbol candidates.
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
                    <p className="mt-2 text-sm text-emerald-700">
                      No missing prices detected.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-rose-700">
                      Missing: {snapshot.missingPairs.join(", ")}
                    </p>
                  )}
                  {snapshot.missingPairs.length > 0 ? (
                    <p className="mt-2 text-xs text-[var(--accent-strong)]">
                      All missing? Check OANDA credentials or instrument mapping.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Myfxbook Debug</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Raw Myfxbook community outlook response (rate limit + parser diagnostics).
            </p>
          </div>
          {myfxbookDebugError ? (
            <p className="text-sm text-rose-700">{myfxbookDebugError}</p>
          ) : !myfxbookDebug ? (
            <p className="text-sm text-[color:var(--muted)]">No debug data.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-[var(--foreground)]">
                <span className="font-semibold">Status:</span>{" "}
                {myfxbookDebug.ok ? "OK" : "NOT OK"} ({myfxbookDebug.httpStatus}{" "}
                {myfxbookDebug.statusText}) | <span className="font-semibold">Latency:</span>{" "}
                {myfxbookDebug.latencyMs}ms
              </p>
              <p className="text-[color:var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">Fetched:</span>{" "}
                {formatDateTimeET(myfxbookDebug.fetchedAtUtc)}
              </p>
              <p className="text-[color:var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">API error:</span>{" "}
                {String(myfxbookDebug.apiError)} |{" "}
                <span className="font-semibold text-[var(--foreground)]">Message:</span>{" "}
                {myfxbookDebug.apiMessage ?? "none"} |{" "}
                <span className="font-semibold text-[var(--foreground)]">Parse error:</span>{" "}
                {myfxbookDebug.parseError ?? "none"}
              </p>
              <p className="text-[color:var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">Symbols:</span>{" "}
                {myfxbookDebug.symbolCount}
              </p>
              <p className="text-[color:var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">Mapped to tracked universe:</span>{" "}
                {myfxbookDebug.mappedCount} |{" "}
                <span className="font-semibold text-[var(--foreground)]">Dropped:</span>{" "}
                {myfxbookDebug.droppedCount}
              </p>
              <div className="rounded-xl border border-[var(--panel-border)]/60 bg-[var(--panel)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Symbol Mapping (Raw → Internal)
                </p>
                <div className="max-h-56 overflow-auto text-xs text-[var(--muted)]">
                  {myfxbookDebug.mappings.length === 0 ? (
                    <p>(none)</p>
                  ) : (
                    myfxbookDebug.mappings.map((item, index) => (
                      <div
                        key={`${item.raw}-${item.mapped}-${index}`}
                        className="border-t border-[var(--panel-border)]/40 py-1"
                      >
                        <span className="font-semibold text-[var(--foreground)]">
                          {item.raw}
                        </span>
                        {" -> "}
                        <span className="font-semibold text-[var(--foreground)]">
                          {item.mapped}
                        </span>
                        {item.wasMapped ? " (alias map)" : ""}
                        {" | "}
                        {item.included ? "kept" : `dropped (${item.reason})`}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--panel-border)]/60 bg-[var(--panel)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Rate Limit Headers
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">
                  {JSON.stringify(myfxbookDebug.headers, null, 2)}
                </pre>
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

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Price Debug Details
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Symbol candidates used for each pair (per asset class snapshot).
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
                    {asset.missingPairs.length === 0 ? (
                      <p>No pairs available.</p>
                    ) : (
                      asset.missingPairs.map((pair) => (
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
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
