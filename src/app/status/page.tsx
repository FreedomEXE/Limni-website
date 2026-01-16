import DashboardLayout from "@/components/DashboardLayout";
import StatusPanel from "@/components/StatusPanel";
import { getAppDiagnostics } from "@/lib/diagnostics";
import { readSnapshot } from "@/lib/cotStore";
import { readMarketSnapshot } from "@/lib/priceStore";
import { getLatestAggregates } from "@/lib/sentiment/store";
import { readMt5Accounts } from "@/lib/mt5Store";

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
          <h1 className="text-3xl font-semibold text-slate-900">System Status</h1>
          <p className="mt-2 text-sm text-slate-600">
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
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
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
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  Fix: {item.hint}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      </div>
    </DashboardLayout>
  );
}
