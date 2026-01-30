import DashboardLayout from "@/components/DashboardLayout";
import {
  loadDailyBiasSummary,
  loadScalpBotStage3Summary,
  loadScalpBotSummary,
} from "@/lib/scalpBot";

export default async function AutomationPage() {
  const scalpSummary = await loadScalpBotSummary();
  const stage3Summary = await loadScalpBotStage3Summary();
  const dailyBiasSingle = await loadDailyBiasSummary("single");
  const dailyBiasHourly = await loadDailyBiasSummary("hourly");
  const dailyBiasWeekly = await loadDailyBiasSummary("weekly");

  const dailyMap = new Map(
    dailyBiasHourly?.daily.map((row) => [row.day, row.pnl_pips]) ?? [],
  );

  const months =
    dailyBiasHourly?.daily.length
      ? (() => {
          const dates = dailyBiasHourly.daily.map((row) => new Date(row.day));
          const min = new Date(
            Math.min(...dates.map((d) => d.getTime())),
          );
          const max = new Date(
            Math.max(...dates.map((d) => d.getTime())),
          );
          const months: Array<{ year: number; month: number }> = [];
          const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
          while (cursor <= max) {
            months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
            cursor.setMonth(cursor.getMonth() + 1);
          }
          return months;
        })()
      : [];

  const monthTotals = new Map(
    dailyBiasHourly?.by_month.map((row) => [row.month, row.sum]) ?? [],
  );
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Automation
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Bot downloads and quick-reference details for Limni automation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh: Static content
            </span>
            <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Release roster
            </span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                MT5 Forex Basket EA
              </h2>
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                Available
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Production-ready EA with risk controls and weekly basket logic.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
              <span>Risk guardrails included</span>
              <span>Weekly basket rebalancing</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Crypto Perp Bot (Bitget)
              </h2>
              <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
                In build
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Bias + sentiment-driven perpetual futures automation.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--foreground)]/70">
              <span>Funding + OI aware</span>
              <span>Signal throttling</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Solana Meme Bot
              </h2>
              <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
                Later
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              High-volatility meme strategy targeting Solana launches.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--foreground)]/70">
              <span>Launch sniper logic</span>
              <span>Liquidity gate</span>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                COT Daily Bias Calendar
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Daily PnL from the weekly COT bias with fixed 18:00 → 16:45 ET exposure.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {dailyBiasHourly
                ? `Updated ${new Date(dailyBiasHourly.generated_at).toLocaleString()}`
                : "No results yet"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { label: "Single entry", data: dailyBiasSingle, suffix: "days" },
              { label: "Hourly adds", data: dailyBiasHourly, suffix: "days" },
              { label: "Weekly hold", data: dailyBiasWeekly, suffix: "weeks" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {card.label}
                </p>
                {!card.data ? (
                  <p className="mt-3 text-sm text-[color:var(--muted)]">
                    No results yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-[var(--foreground)]">
                    <div className="flex items-center justify-between">
                      <span>Trades</span>
                      <span className="font-semibold">{card.data.overall.trades}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Net pips</span>
                      <span className="font-semibold">{card.data.overall.net_pips.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avg pips/{card.suffix}</span>
                      <span className="font-semibold">{card.data.overall.avg_pips.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Win rate</span>
                      <span className="font-semibold">{card.data.overall.win_rate.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!dailyBiasHourly ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-6 text-sm text-[color:var(--muted)]">
              Run `python -m research.scalp_bot.daily_bias --mode hourly --publish` to surface the calendar.
            </div>
          ) : (
            <div className="mt-6 grid gap-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Trades
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {dailyBiasHourly.overall.trades}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Net pips
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {dailyBiasHourly.overall.net_pips.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Avg pips/day
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {dailyBiasHourly.overall.avg_pips.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Win rate (days)
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {dailyBiasHourly.overall.win_rate.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                {months.map(({ year, month }) => {
                  const first = new Date(year, month, 1);
                  const startWeekday = first.getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
                  const totalPips = monthTotals.get(monthKey) ?? 0;
                  const cells = Array.from({ length: startWeekday + daysInMonth }, (_, idx) => idx);

                  return (
                    <div
                      key={monthKey}
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          {first.toLocaleString("en-US", { month: "long", year: "numeric" })}
                        </h3>
                        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          {totalPips.toFixed(1)} pips
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-7 gap-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                          <div key={label} className="text-center">
                            {label}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-7 gap-1 text-xs">
                        {cells.map((idx) => {
                          const dayNum = idx - startWeekday + 1;
                          const inMonth = dayNum > 0 && dayNum <= daysInMonth;
                          if (!inMonth) {
                            return <div key={`empty-${idx}`} className="h-16 rounded-lg bg-transparent" />;
                          }
                          const cellDate = new Date(year, month, dayNum);
                          const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
                          const dateKey = cellDate.toISOString().slice(0, 10);
                          const pnl = dailyMap.get(dateKey) ?? 0;
                          const color =
                            pnl > 0
                              ? "bg-emerald-500/15 text-emerald-200"
                              : pnl < 0
                                ? "bg-rose-500/15 text-rose-200"
                                : "bg-[var(--panel)]/60 text-[color:var(--muted)]";

                          return (
                            <div
                              key={dateKey}
                              className={`flex h-16 flex-col justify-between rounded-lg border border-[var(--panel-border)] p-2 ${isWeekend ? "bg-[var(--panel)]/40 text-[color:var(--muted)]" : color}`}
                            >
                              <span className="text-[11px]">{dayNum}</span>
                              {!isWeekend && (
                                <span className="text-[11px] font-semibold">
                                  {pnl === 0 ? "-" : pnl.toFixed(1)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Weekly breakdown
                </h3>
                <div className="mt-4 max-h-72 overflow-auto">
                  <table className="w-full text-left text-sm text-[var(--foreground)]">
                    <thead className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      <tr>
                        <th className="py-2">Week</th>
                        <th className="py-2 text-right">Days</th>
                        <th className="py-2 text-right">Net pips</th>
                        <th className="py-2 text-right">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyBiasHourly.by_week.map((row) => (
                        <tr key={row.week} className="border-t border-[var(--panel-border)]/60">
                          <td className="py-2">{row.week}</td>
                          <td className="py-2 text-right">{row.count}</td>
                          <td className="py-2 text-right">{row.sum.toFixed(1)}</td>
                          <td className="py-2 text-right">{row.mean.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Monthly breakdown
                </h3>
                <div className="mt-4 max-h-72 overflow-auto">
                  <table className="w-full text-left text-sm text-[var(--foreground)]">
                    <thead className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      <tr>
                        <th className="py-2">Month</th>
                        <th className="py-2 text-right">Days</th>
                        <th className="py-2 text-right">Net pips</th>
                        <th className="py-2 text-right">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyBiasHourly.by_month.map((row) => (
                        <tr key={row.month} className="border-t border-[var(--panel-border)]/60">
                          <td className="py-2">{row.month}</td>
                          <td className="py-2 text-right">{row.count}</td>
                          <td className="py-2 text-right">{row.sum.toFixed(1)}</td>
                          <td className="py-2 text-right">{row.mean.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 xl:col-span-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Pair contribution (hourly adds)
                </h3>
                <div className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
                  {dailyBiasHourly.by_pair
                    .slice()
                    .sort((a, b) => b.sum - a.sum)
                    .map((row) => {
                      const maxAbs = Math.max(
                        ...dailyBiasHourly.by_pair.map((item) => Math.abs(item.sum)),
                        1,
                      );
                      const width = Math.min(100, (Math.abs(row.sum) / maxAbs) * 100);
                      const color =
                        row.sum > 0
                          ? "bg-emerald-500/40"
                          : row.sum < 0
                            ? "bg-rose-500/40"
                            : "bg-[var(--panel-border)]";
                      return (
                        <div key={row.pair} className="flex items-center gap-3">
                          <span className="w-20 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            {row.pair}
                          </span>
                          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[var(--panel)]">
                            <div className={`h-full ${color}`} style={{ width: `${width}%` }} />
                          </div>
                          <span className="w-20 text-right text-xs font-semibold">
                            {row.sum.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </section>

        {dailyBiasWeekly && (
          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  Weekly Hold (COT Bias)
                </h2>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Sunday 18:00 ET entry to Friday 16:45 ET exit, one position per pair per week.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Updated {new Date(dailyBiasWeekly.generated_at).toLocaleString()}
              </div>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Weekly breakdown
                </h3>
                <div className="mt-4 max-h-72 overflow-auto">
                  <table className="w-full text-left text-sm text-[var(--foreground)]">
                    <thead className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      <tr>
                        <th className="py-2">Week</th>
                        <th className="py-2 text-right">Trades</th>
                        <th className="py-2 text-right">Net pips</th>
                        <th className="py-2 text-right">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyBiasWeekly.by_week.map((row) => (
                        <tr key={row.week} className="border-t border-[var(--panel-border)]/60">
                          <td className="py-2">{row.week}</td>
                          <td className="py-2 text-right">{row.count}</td>
                          <td className="py-2 text-right">{row.sum.toFixed(1)}</td>
                          <td className="py-2 text-right">{row.mean.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Monthly breakdown
                </h3>
                <div className="mt-4 max-h-72 overflow-auto">
                  <table className="w-full text-left text-sm text-[var(--foreground)]">
                    <thead className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      <tr>
                        <th className="py-2">Month</th>
                        <th className="py-2 text-right">Trades</th>
                        <th className="py-2 text-right">Net pips</th>
                        <th className="py-2 text-right">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyBiasWeekly.by_month.map((row) => (
                        <tr key={row.month} className="border-t border-[var(--panel-border)]/60">
                          <td className="py-2">{row.month}</td>
                          <td className="py-2 text-right">{row.count}</td>
                          <td className="py-2 text-right">{row.sum.toFixed(1)}</td>
                          <td className="py-2 text-right">{row.mean.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Limni Scalp Bot — Research Backtest
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Latest research run published from the backtest engine.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {scalpSummary ? `Updated ${new Date(scalpSummary.generated_at).toLocaleString()}` : "No results yet"}
            </div>
          </div>

          {!scalpSummary ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-6 text-sm text-[color:var(--muted)]">
              Run the backtest with `--publish` to surface results here.
            </div>
          ) : (
            <div className="mt-6 grid gap-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Trades
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {scalpSummary.overall.trades}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Net R
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {scalpSummary.overall.net_r.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Profit factor
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {scalpSummary.overall.profit_factor.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Win rate
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {scalpSummary.overall.win_rate.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Max DD (R)
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {scalpSummary.overall.max_drawdown_r.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Avg R / trade
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {scalpSummary.overall.avg_r.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Equity curve
                    </h3>
                    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]">
                      <img
                        src="/scalp-bot/equity_curve.png"
                        alt="Scalp bot equity curve"
                        className="h-auto w-full"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Drawdown
                    </h3>
                    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]">
                      <img
                        src="/scalp-bot/drawdown_curve.png"
                        alt="Scalp bot drawdown curve"
                        className="h-auto w-full"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 md:col-span-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      R distribution
                    </h3>
                    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]">
                      <img
                        src="/scalp-bot/r_histogram.png"
                        alt="Scalp bot R distribution"
                        className="h-auto w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Top / Bottom Pairs
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
                    {scalpSummary.by_pair
                      .slice()
                      .sort((a, b) => b.sum - a.sum)
                      .slice(0, 5)
                      .map((row) => (
                        <div key={`top-${row.pair}`} className="flex items-center justify-between">
                          <span>{row.pair}</span>
                          <span className="font-semibold">{row.sum.toFixed(2)} R</span>
                        </div>
                      ))}
                    <div className="border-t border-[var(--panel-border)] pt-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Bottom
                    </div>
                    {scalpSummary.by_pair
                      .slice()
                      .sort((a, b) => a.sum - b.sum)
                      .slice(0, 5)
                      .map((row) => (
                        <div key={`bottom-${row.pair}`} className="flex items-center justify-between">
                          <span>{row.pair}</span>
                          <span className="font-semibold">{row.sum.toFixed(2)} R</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Monthly performance (R)
                </h3>
                <div className="mt-4 max-h-80 overflow-auto">
                  <table className="w-full text-left text-sm text-[var(--foreground)]">
                    <thead className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      <tr>
                        <th className="py-2">Month</th>
                        <th className="py-2 text-right">Trades</th>
                        <th className="py-2 text-right">Net R</th>
                        <th className="py-2 text-right">Avg R</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scalpSummary.by_month.map((row) => (
                        <tr key={row.month} className="border-t border-[var(--panel-border)]/60">
                          <td className="py-2">{row.month}</td>
                          <td className="py-2 text-right">{row.count}</td>
                          <td className="py-2 text-right">{row.sum.toFixed(2)}</td>
                          <td className="py-2 text-right">{row.mean.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Limni Scalp Bot — Stage 3 Best Config
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Best-performing configuration from the lightweight grid search.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {stage3Summary ? `Updated ${new Date(stage3Summary.generated_at).toLocaleString()}` : "No results yet"}
            </div>
          </div>

          {!stage3Summary ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-6 text-sm text-[color:var(--muted)]">
              Run Stage 3 with `run_top_configs.py` to publish the best configuration.
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Equity curve
                  </h3>
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]">
                    <img
                      src="/scalp-bot/stage3_best/equity_curve.png"
                      alt="Stage 3 equity curve"
                      className="h-auto w-full"
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Drawdown
                  </h3>
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]">
                    <img
                      src="/scalp-bot/stage3_best/drawdown_curve.png"
                      alt="Stage 3 drawdown curve"
                      className="h-auto w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Summary
                </h3>
                <div className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
                  <div className="flex items-center justify-between">
                    <span>Trades</span>
                    <span className="font-semibold">{stage3Summary.overall.trades}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Net R</span>
                    <span className="font-semibold">{stage3Summary.overall.net_r.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Profit factor</span>
                    <span className="font-semibold">{stage3Summary.overall.profit_factor.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Win rate</span>
                    <span className="font-semibold">{stage3Summary.overall.win_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Max DD (R)</span>
                    <span className="font-semibold">{stage3Summary.overall.max_drawdown_r.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
