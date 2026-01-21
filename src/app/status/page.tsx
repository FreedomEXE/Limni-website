import DashboardLayout from "@/components/DashboardLayout";
import StatusPanel from "@/components/StatusPanel";
import { getAppDiagnostics } from "@/lib/diagnostics";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { readMarketSnapshot } from "@/lib/priceStore";
import { getLatestAggregates } from "@/lib/sentiment/store";
import { readMt5Accounts } from "@/lib/mt5Store";
import { getPriceSymbolCandidates } from "@/lib/pricePerformance";

export const dynamic = "force-dynamic";

type HealthItem = {
  name: string;
  status: "ok" | "warning" | "error";
  detail: string;
  hint?: string;
};

const toneMap = {
  ok: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
};

export default async function StatusPage() {
  let dbError: string | null = null;
  let priceError: string | null = null;
  let sentimentError: string | null = null;
  let accountsError: string | null = null;

  let cotSnapshot = null;
  let marketSnapshot = null;
  let sentimentAggregates = [];
  let accounts = [];
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
    sentimentAggregates = await getLatestAggregates();
  } catch (error) {
    sentimentError = error instanceof Error ? error.message : String(error);
  }

  try {
    accounts = await readMt5Accounts();
  } catch (error) {
    accountsError = error instanceof Error ? error.message : String(error);
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
        <header>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">System Status</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Diagnostics for deployments, data sources, and MT5 connectivity.
          </p>
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
                        ? new Date(snapshot.lastRefreshUtc).toLocaleString()
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
                    <p className="mt-2 text-xs text-amber-700">
                      All missing? Check PRICE_API_KEY credits or symbol mapping.
                    </p>
                  ) : null}
                </div>
              ))}
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
                      {asset.reportDate ?? "No report date"}
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
