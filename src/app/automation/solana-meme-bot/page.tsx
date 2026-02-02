import DashboardLayout from "@/components/DashboardLayout";
import { fetchBitgetFuturesSnapshot, fetchBitgetPriceChange } from "@/lib/bitget";
import { getRecentRegimeDays, upsertRegimeDay } from "@/lib/market-regime";
import type { RegimeRecord } from "@/lib/market-regime";

type TrenchbotToken = {
  token_address: string;
  name: string;
  symbol: string;
  eligible_first_at: number | null;
  eligible_first_iso: string | null;
  entry_price_usd: number | null;
  current_price_usd: number | null;
  max_price_usd: number | null;
  min_price_usd: number | null;
  current_multiple: number | null;
  max_multiple: number | null;
  min_multiple: number | null;
  recouped_at: number | null;
  recouped_iso: string | null;
  moonbag_tokens: number | null;
  moonbag_sold_at: number | null;
  moonbag_sold_iso: string | null;
  moonbag_sold_value: number | null;
};

type TrenchbotSummary = {
  updated_at: string;
  sim: {
    reset_at: number;
    reset_iso: string | null;
    start_balance: number;
    position_size: number;
    cash: number;
  };
  counts: {
    taken: number;
    recouped: number;
    open: number;
  };
  stats: {
    recoup_p50_sec: number | null;
    recoup_p75_sec: number | null;
    recoup_p90_sec: number | null;
    signals_by_hour: number[];
    recoup_p50_by_hour: Array<number | null>;
  };
  solana: {
    sample_tokens_24h: number;
    volume1h_total: number | null;
    marketcap_median: number | null;
    change1h_median: number | null;
    change6h_median: number | null;
    change24h_median: number | null;
    price_median: number | null;
    holders_median: number | null;
  };
  moonbags: TrenchbotToken[];
  recent: TrenchbotToken[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  notation: "compact",
});

const priceFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8,
});

function formatUsd(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  if (Math.abs(value) >= 1000) {
    return compactCurrency.format(value);
  }
  return currency.format(value);
}

function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `$${priceFormat.format(value)}`;
}

function formatMultiple(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(2)}x`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null || Number.isNaN(seconds)) {
    return "—";
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }
  const hours = Math.round(seconds / 3600);
  return `${hours}h`;
}

function computeMoonbagValue(token: TrenchbotToken) {
  if (!token.moonbag_tokens || !token.current_price_usd) {
    return null;
  }
  return token.moonbag_tokens * token.current_price_usd;
}

function computeEquity(summary: TrenchbotSummary | null) {
  if (!summary) {
    return null;
  }
  const moonbagValue = summary.moonbags.reduce((sum, token) => {
    const value = computeMoonbagValue(token);
    return sum + (value ?? 0);
  }, 0);
  return summary.sim.cash + moonbagValue;
}

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

type SummaryError = {
  message: string;
  status?: number;
  url?: string;
};

type SummaryResult = {
  summary: TrenchbotSummary | null;
  error?: SummaryError;
};

async function loadSummary(): Promise<SummaryResult> {
  try {
    const apiUrl =
      process.env.TRENCHBOT_API_URL ??
      `${process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000"}/api/solana-meme-bot/summary`;
    const headers: Record<string, string> = {};
    if (process.env.TRENCHBOT_API_TOKEN) {
      headers["x-api-key"] = process.env.TRENCHBOT_API_TOKEN;
    }
    const response = await fetch(apiUrl, {
      cache: "no-store",
      headers,
    });
    if (!response.ok) {
      let message = `Summary request failed (${response.status})`;
      try {
        const data = await response.json();
        if (data?.error) {
          message = String(data.error);
        }
      } catch {
        // ignore json parse errors
      }
      return { summary: null, error: { message, status: response.status, url: apiUrl } };
    }
    return { summary: (await response.json()) as TrenchbotSummary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Summary request failed (unknown error)";
    return { summary: null, error: { message } };
  }
}

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

type PageProps = {
  searchParams?: Promise<{
    sort?: string;
    moon?: string;
  }>;
};

export default async function SolanaMemeBotPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [summaryResult, solSnapshot, sol24h, sol7d] = await Promise.all([
    loadSummary(),
    safe(fetchBitgetFuturesSnapshot("SOL")),
    safe(fetchBitgetPriceChange("SOL", 24)),
    safe(fetchBitgetPriceChange("SOL", 24 * 7)),
  ]);
  const summary = summaryResult.summary;
  const summaryError = summaryResult.error;
  const equity = computeEquity(summary);
  const roi =
    summary && equity != null && summary.sim.start_balance > 0
      ? ((equity - summary.sim.start_balance) / summary.sim.start_balance) * 100
      : null;
  const recoupRate =
    summary && summary.counts.taken > 0
      ? (summary.counts.recouped / summary.counts.taken) * 100
      : null;
  const openRate =
    summary && summary.counts.taken > 0
      ? (summary.counts.open / summary.counts.taken) * 100
      : null;
  const moonbagCount = summary?.moonbags.length ?? 0;
  const moonbagValue = summary
    ? summary.moonbags.reduce((sum, token) => sum + (computeMoonbagValue(token) ?? 0), 0)
    : null;
  const rawRecent = summary?.recent ?? [];
  const moonbags = summary?.moonbags ?? [];
  const topMoonbags = [...moonbags]
    .sort((a, b) => (b.max_multiple ?? 0) - (a.max_multiple ?? 0))
    .slice(0, 4);
  const sortMode = params?.sort ?? "time";
  const moonFilter = params?.moon ?? "open";
  const recent = [...rawRecent].sort((a, b) => {
    if (sortMode === "max") {
      return (b.max_multiple ?? 0) - (a.max_multiple ?? 0);
    }
    if (sortMode === "current") {
      return (b.current_multiple ?? 0) - (a.current_multiple ?? 0);
    }
    return (b.eligible_first_at ?? 0) - (a.eligible_first_at ?? 0);
  });
  const stripValues = recent
    .slice(0, 16)
    .map((item) => Math.min(4, item.current_multiple ?? item.max_multiple ?? 0));
  const stripMax = stripValues.length ? Math.max(...stripValues, 1) : 1;
  const signalsByHour = summary?.stats.signals_by_hour ?? Array.from({ length: 24 }, () => 0);
  const recoupByHour = summary?.stats.recoup_p50_by_hour ?? Array.from({ length: 24 }, () => null);
  const signalMax = signalsByHour.length ? Math.max(...signalsByHour, 1) : 1;
  const recoupDurations = recoupByHour.filter((value): value is number => value != null);
  const recoupMax = recoupDurations.length ? Math.max(...recoupDurations, 1) : 1;
  const moonbagRows = moonbags.filter((bag) => {
    if (moonFilter === "sold") {
      return bag.moonbag_sold_at != null;
    }
    if (moonFilter === "all") {
      return true;
    }
    return bag.moonbag_sold_at == null;
  });
  const solanaStats = {
    price: solSnapshot?.lastPrice ?? sol24h?.close ?? null,
    change24h: sol24h?.percent ?? null,
    change7d: sol7d?.percent ?? null,
    volume1h: summary?.solana.volume1h_total ?? null,
    change1h: summary?.solana.change1h_median ?? null,
    change6h: summary?.solana.change6h_median ?? null,
    marketcapMedian: summary?.solana.marketcap_median ?? null,
    holdersMedian: summary?.solana.holders_median ?? null,
    sampleTokens: summary?.solana.sample_tokens_24h ?? 0,
  };
  const dayUtc = new Date().toISOString().slice(0, 10);
  let regimeDays: RegimeRecord[] = [];
  if (summary) {
    try {
      await upsertRegimeDay({
        dayUtc,
        solPrice: solanaStats.price,
        solChange24h: solanaStats.change24h,
        solChange7d: solanaStats.change7d,
        memeVolume1h: solanaStats.volume1h,
        memeChange1h: solanaStats.change1h,
        memeChange6h: solanaStats.change6h,
        memeMcapMedian: solanaStats.marketcapMedian,
        memeHoldersMedian: solanaStats.holdersMedian,
        sampleTokens: solanaStats.sampleTokens,
      });
      regimeDays = await getRecentRegimeDays(10);
    } catch {
      regimeDays = [];
    }
  }
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
              Automation / Solana
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
              Solana Meme Bot
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Recoup-first meme strategy with automated moonbag tracking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Simulating
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh: {summary ? new Date(summary.updated_at).toLocaleString() : "Offline"}
            </span>
          </div>
        </header>
        {!summary && summaryError ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                Summary fetch failed
              </p>
              <p>{summaryError.message}</p>
              {summaryError.status ? (
                <p className="text-xs text-amber-800">
                  HTTP status: {summaryError.status}
                </p>
              ) : null}
              {summaryError.url ? (
                <p className="text-xs text-amber-800 break-all">
                  URL: {summaryError.url}
                </p>
              ) : null}
              <p className="text-xs text-amber-800">
                Check TRENCHBOT_API_URL, TRENCHBOT_API_TOKEN, and that the trenchbot
                web service is running.
              </p>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.4fr,1fr,1fr]">
          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Solana pulse</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Market context
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[
                { label: "SOL price", value: formatUsd(solanaStats.price) },
                { label: "SOL 24h", value: solanaStats.change24h == null ? "—" : `${solanaStats.change24h.toFixed(2)}%` },
                { label: "SOL 7d", value: solanaStats.change7d == null ? "—" : `${solanaStats.change7d.toFixed(2)}%` },
                { label: "Meme 1h vol", value: formatUsd(solanaStats.volume1h) },
                { label: "Meme 1h", value: solanaStats.change1h == null ? "—" : `${solanaStats.change1h.toFixed(2)}%` },
                { label: "Meme 6h", value: solanaStats.change6h == null ? "—" : `${solanaStats.change6h.toFixed(2)}%` },
                { label: "Meme mcap", value: formatUsd(solanaStats.marketcapMedian) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-xs text-[color:var(--muted)]">
              Source: Bitget futures for SOL; meme stats from bot’s last 24h token samples ({solanaStats.sampleTokens}).
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Run readiness</h2>
            <div className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
              <p>Use Solana + DEX regime data to flag “degen days.”</p>
              <p>Track SOL trend, DEX volume, and meme share vs. recent averages.</p>
              <p>Label each day: Hot / Neutral / Cold.</p>
            </div>
            <div className="mt-5 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-xs text-[color:var(--muted)]">
              Suggested: run daily, review weekly, then decide if filters help.
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <span>Today</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {regimeDays[0]?.label ?? "—"}
                </span>
              </div>
              {regimeDays.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 text-xs text-[color:var(--muted)]">
                  {regimeDays.slice(0, 6).map((day) => (
                    <div
                      key={day.dayUtc}
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="uppercase tracking-[0.2em]">{day.dayUtc}</span>
                        <span className="font-semibold text-[var(--foreground)]">
                          {day.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[color:var(--muted)]">
                  Regime history will appear after the first summary sync.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Current filters</h2>
            <div className="mt-4 space-y-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Chain</span>
                <span className="font-semibold text-[var(--foreground)]">Solana</span>
              </div>
              <div className="flex items-center justify-between">
                <span>MCap max</span>
                <span className="font-semibold text-[var(--foreground)]">$100k</span>
              </div>
              <div className="flex items-center justify-between">
                <span>FDV proxy</span>
                <span className="font-semibold text-[var(--foreground)]">Off</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Profile</span>
                <span className="font-semibold text-[var(--foreground)]">Required</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Change 24h</span>
                <span className="font-semibold text-[var(--foreground)]">≥ 1%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Change 6h</span>
                <span className="font-semibold text-[var(--foreground)]">≥ 1%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Change 1h</span>
                <span className="font-semibold text-[var(--foreground)]">≥ 1%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Vol 1h</span>
                <span className="font-semibold text-[var(--foreground)]">$10k+</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr,1fr]">
          {[
            { label: "Cash", value: formatUsd(summary?.sim.cash), sub: "Available balance" },
            { label: "Equity", value: formatUsd(equity), sub: "Cash + moonbags" },
            { label: "ROI", value: roi == null ? "—" : `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`, sub: "Since reset" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {stat.label}
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-[color:var(--muted)]">{stat.sub}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Momentum strip</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Last {stripValues.length || 0} signals
              </span>
            </div>
            <div className="mt-5 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-2">
              {stripValues.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
                  Waiting for first apes to paint momentum.
                </div>
              ) : (
                stripValues.map((value, index) => {
                  const height = Math.max(12, Math.round((value / stripMax) * 100));
                  return (
                    <div key={`strip-${index}`} className="flex h-24 items-end">
                      <div
                        className="w-full rounded-full bg-[var(--accent)]/40"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Recoup speed</h2>
            <div className="mt-5 space-y-4 text-sm text-[var(--foreground)]">
              {[
                { label: "Median", value: formatDuration(summary?.stats.recoup_p50_sec ?? null) },
                { label: "P75", value: formatDuration(summary?.stats.recoup_p75_sec ?? null) },
                { label: "P90", value: formatDuration(summary?.stats.recoup_p90_sec ?? null) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3"
                >
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-[color:var(--muted)]">
              Faster recoups = more consistent moonbag farming.
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Signals by hour (UTC)</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                24-hour distribution
              </span>
            </div>
            <div className="mt-6 grid grid-cols-12 gap-3 text-xs">
              {signalsByHour.map((count, index) => {
                const height = Math.max(8, Math.round((count / signalMax) * 100));
                return (
                  <div key={`signal-${index}`} className="flex flex-col items-center gap-2">
                    <div className="flex h-24 items-end">
                      <div
                        className="w-3 rounded-full bg-[var(--accent)]/40"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {String(index).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] text-[color:var(--muted)]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Recoup speed by hour</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Median minutes
              </span>
            </div>
            <div className="mt-6 grid grid-cols-12 gap-3 text-xs">
              {recoupByHour.map((value, index) => {
                const intensity = value != null ? Math.max(0.15, value / recoupMax) : 0;
                return (
                  <div key={`recoup-${index}`} className="flex flex-col items-center gap-2">
                    <div className="h-10 w-6 rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70">
                      <div
                        className="h-full w-full rounded-full bg-[var(--accent)]/50"
                        style={{ opacity: intensity }}
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {String(index).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] text-[color:var(--muted)]">
                      {value == null ? "—" : Math.round(value / 60)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr,1fr,1fr]">
          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Account</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Recoup + Moonbag
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[
                { label: "Start", value: formatUsd(summary?.sim.start_balance) },
                { label: "Position", value: formatUsd(summary?.sim.position_size) },
                { label: "Reset", value: summary?.sim.reset_iso ? new Date(summary.sim.reset_iso).toLocaleDateString() : "—" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              <span>Taken {summary?.counts.taken ?? 0}</span>
              <span>Recouped {summary?.counts.recouped ?? 0}</span>
              <span>Open {summary?.counts.open ?? 0}</span>
              <span>Moonbags {moonbagCount}</span>
            </div>
            <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Equity pulse
                </span>
                <span className="text-xs text-[color:var(--muted)]">Last 12 signals</span>
              </div>
              <div className="mt-3 grid grid-cols-12 gap-2">
                {stripValues.slice(0, 12).map((value, index) => {
                  const height = Math.max(8, Math.round((value / stripMax) * 100));
                  return (
                    <div key={`pulse-${index}`} className="flex h-16 items-end">
                      <div
                        className="w-full rounded-full bg-[var(--accent)]/30"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  );
                })}
                {stripValues.length === 0 && (
                  <div className="col-span-full text-xs text-[color:var(--muted)]">
                    Waiting for enough fills to render pulse.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Execution health</h2>
            <div className="mt-4 space-y-4 text-sm text-[var(--foreground)]">
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Recoup rate
                  </span>
                  <span className="text-sm font-semibold">{formatPercent(recoupRate)}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--panel)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]/60"
                    style={{ width: `${recoupRate ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Open exposure
                  </span>
                  <span className="text-sm font-semibold">{formatPercent(openRate)}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--panel)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]/30"
                    style={{ width: `${openRate ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Moonbag value
                  </span>
                  <span className="text-sm font-semibold">{formatUsd(moonbagValue)}</span>
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  Aggregate value across active moonbags.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Sim settings</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
              <div className="flex items-center justify-between">
                <span>Balance</span>
                <span className="font-semibold">{formatUsd(summary?.sim.start_balance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Position</span>
                <span className="font-semibold">{formatUsd(summary?.sim.position_size)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Target</span>
                <span className="font-semibold">1.30x</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fees</span>
                <span className="font-semibold">1.0% / 1.0%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Slippage sample</span>
                <span className="font-semibold">30s</span>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-xs text-[color:var(--muted)]">
              Reset: {summary?.sim.reset_iso ? new Date(summary.sim.reset_iso).toLocaleString() : "—"}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Signal funnel</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Recoup threshold: 1.30x
              </span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                { label: "Taken", value: summary?.counts.taken ?? 0 },
                { label: "Recouped", value: summary?.counts.recouped ?? 0 },
                { label: "Open", value: summary?.counts.open ?? 0 },
                { label: "Moonbags", value: moonbagCount },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {item.value}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-[var(--panel)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]/40"
                      style={{
                        width:
                          summary?.counts.taken && item.label !== "Taken"
                            ? `${Math.min(100, (item.value / summary.counts.taken) * 100)}%`
                            : "100%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Top moonbags</h2>
            <div className="mt-4 space-y-3">
              {topMoonbags.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
                  No moonbags to rank yet.
                </div>
              ) : (
                topMoonbags.map((bag) => (
                  <div
                    key={bag.token_address}
                    className="flex items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-sm"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {bag.name || "Unknown token"}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        {bag.symbol || bag.token_address.slice(0, 6)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        Max
                      </p>
                      <p className="font-semibold text-[var(--foreground)]">
                        {formatMultiple(bag.max_multiple)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Live feed</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <span>Sort</span>
                {[
                  { label: "Newest", key: "time" },
                  { label: "Max", key: "max" },
                  { label: "Current", key: "current" },
                ].map((option) => (
                  <a
                    key={option.key}
                    href={`?sort=${option.key}`}
                    className={`rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.2em] ${
                      sortMode === option.key
                        ? "border-[var(--accent)]/60 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                        : "border-[var(--panel-border)] text-[color:var(--muted)]"
                    }`}
                  >
                    {option.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--panel-border)]">
              {recent.length === 0 ? (
                <div className="p-6 text-sm text-[color:var(--muted)]">
                  No signals yet for this sim run.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--panel)]/70 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    <tr>
                      <th className="px-4 py-3">Token</th>
                      <th className="px-4 py-3">Entry</th>
                      <th className="px-4 py-3">Now</th>
                      <th className="px-4 py-3">Max</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border)]">
                    {recent.map((item) => (
                      <tr key={item.token_address} className="text-[var(--foreground)]">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{item.name || "Unknown token"}</div>
                          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            {item.symbol || item.token_address.slice(0, 6)}
                          </div>
                        </td>
                        <td className="px-4 py-3">{formatPrice(item.entry_price_usd)}</td>
                        <td className="px-4 py-3">{formatPrice(item.current_price_usd)}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{formatMultiple(item.max_multiple)}</div>
                          <div className="text-xs text-[color:var(--muted)]">
                            Min {formatMultiple(item.min_multiple)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                              item.recouped_at
                                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                                : "border-[var(--panel-border)] text-[color:var(--muted)]"
                            }`}
                          >
                            {item.recouped_at ? "Sold" : "Open"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {recent.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Recent P/L strip
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recent.slice(0, 12).map((item) => {
                    const multiple = item.current_multiple ?? item.max_multiple ?? null;
                    const gain = multiple != null ? multiple - 1 : null;
                    const positive = gain != null && gain >= 0;
                    return (
                      <span
                        key={`pl-${item.token_address}`}
                        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                          gain == null
                            ? "border-[var(--panel-border)] text-[color:var(--muted)]"
                            : positive
                              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                              : "border-rose-400/40 bg-rose-400/10 text-rose-200"
                        }`}
                      >
                        {(item.symbol || item.token_address.slice(0, 4)).toUpperCase()}{" "}
                        {multiple == null ? "—" : `${multiple.toFixed(2)}x`}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Moonbag vault</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Live holdings
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {moonbags.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
                  No moonbags yet. Recouped trades will surface here.
                </div>
              ) : (
                moonbags.slice(0, 6).map((bag) => {
                  const value = computeMoonbagValue(bag);
                  return (
                    <div
                      key={bag.token_address}
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {bag.name || "Unknown token"}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        {bag.symbol || bag.token_address.slice(0, 6)}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span>{formatMultiple(bag.max_multiple)}</span>
                        <span className="font-semibold">{formatUsd(value)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <button className="mt-5 w-full rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Sell all moonbags
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Moonbag ledger</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Track every moonbag by status and performance.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {[
                { label: "Open", key: "open" },
                { label: "Sold", key: "sold" },
                { label: "All", key: "all" },
              ].map((option) => (
                <a
                  key={option.key}
                  href={`?moon=${option.key}`}
                  className={`rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.2em] ${
                    moonFilter === option.key
                      ? "border-[var(--accent)]/60 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                      : "border-[var(--panel-border)] text-[color:var(--muted)]"
                  }`}
                >
                  {option.label}
                </a>
              ))}
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--panel-border)]">
            {moonbagRows.length === 0 ? (
              <div className="p-6 text-sm text-[color:var(--muted)]">
                No moonbags in this view.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--panel)]/70 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">Entry</th>
                    <th className="px-4 py-3">Now</th>
                    <th className="px-4 py-3">Max</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--panel-border)]">
                  {moonbagRows.slice(0, 18).map((bag) => {
                    const value = computeMoonbagValue(bag);
                    return (
                      <tr key={`ledger-${bag.token_address}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--foreground)]">
                            {bag.name || "Unknown token"}
                          </div>
                          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            {bag.symbol || bag.token_address.slice(0, 6)}
                          </div>
                        </td>
                        <td className="px-4 py-3">{formatPrice(bag.entry_price_usd)}</td>
                        <td className="px-4 py-3">{formatPrice(bag.current_price_usd)}</td>
                        <td className="px-4 py-3">{formatMultiple(bag.max_multiple)}</td>
                        <td className="px-4 py-3">{formatUsd(value)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                              bag.moonbag_sold_at
                                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                                : "border-[var(--panel-border)] text-[color:var(--muted)]"
                            }`}
                          >
                            {bag.moonbag_sold_at ? "Sold" : "Open"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
