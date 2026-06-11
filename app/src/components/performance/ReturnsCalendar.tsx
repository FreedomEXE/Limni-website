/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: ReturnsCalendar.tsx
 *
 * Description:
 * Calendar-style returns view for all-time and week simulation drilldowns.
 * Monthly and weekly modes aggregate week returns; daily mode derives trading
 * days from the selected simulation equity curve.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useMemo, useState } from "react";
import type { PerformanceSimulationSeries } from "@/components/performance/PerformanceSimulationSection";
import { buildDailySimulationReturns, type DailySimulationReturn } from "@/components/performance/dailySimulationReturns";
import {
  aggregateDailyReturnsToMonthMetrics,
  aggregateDailyReturnsToWeekMetrics,
  aggregateWeekReturnsToMonthMetrics,
  aggregateWeekReturnsToWeekMetrics,
  type CalendarPeriodMetric,
  type WeekReturn,
} from "@/components/performance/returnsCalendarMetrics";

export type { WeekReturn } from "@/components/performance/returnsCalendarMetrics";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TRADING_WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type CalendarMode = "monthly" | "weekly" | "daily";
type SeriesPrecision = "intraday_path" | "weekly_close";

type ReturnsCalendarProps = {
  weeks?: WeekReturn[];
  series?: PerformanceSimulationSeries;
  seriesPrecision?: SeriesPrecision;
  forcedMode?: CalendarMode;
  showModeToggle?: boolean;
  includeWeekends?: boolean;
};

function aggregateToWeeksByMonth(weeks: WeekReturn[]): Map<string, WeekReturn[]> {
  const map = new Map<string, WeekReturn[]>();
  for (const week of weeks) {
    const d = new Date(week.weekOpenUtc);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(week);
  }
  for (const rows of map.values()) {
    rows.sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
  }
  return map;
}

function cellColor(returnPct: number, maxAbs: number): string {
  if (maxAbs <= 0) return "rgba(148,163,184,0.08)";
  const intensity = Math.min(Math.abs(returnPct) / maxAbs, 1);
  const alpha = 0.1 + intensity * 0.5;
  return returnPct >= 0
    ? `rgba(16,185,129,${alpha.toFixed(2)})`
    : `rgba(244,63,94,${alpha.toFixed(2)})`;
}

function formatWeekLabel(weekOpenUtc: string) {
  const d = new Date(weekOpenUtc);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthTitle(year: number, month: number) {
  return `${MONTH_LABELS[month]} ${year}`;
}

function monthKeyFromDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

function signed(value: number, digits = 1) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function ddLabel(source: CalendarPeriodMetric["drawdownSource"], compact = false) {
  if (source === "path") return compact ? "Path DD" : "Path DD";
  if (source === "close") return compact ? "Close DD" : "Close DD";
  if (source === "week") return compact ? "Week DD" : "Week DD";
  return compact ? "DD" : "Drawdown";
}

function formatDrawdown(cell: CalendarPeriodMetric | undefined | null, digits = 1) {
  if (!cell || cell.maxDrawdownPct == null || !Number.isFinite(cell.maxDrawdownPct)) return "-";
  return `${cell.maxDrawdownPct.toFixed(digits)}%`;
}

function getAvailableModes(weeks: WeekReturn[], hasSeries: boolean): CalendarMode[] {
  const modes: CalendarMode[] = [];
  if (weeks.length > 0) modes.push("monthly", "weekly");
  if (hasSeries) modes.push("daily");
  return modes;
}

export default function ReturnsCalendar({
  weeks = [],
  series,
  seriesPrecision = "intraday_path",
  forcedMode,
  showModeToggle = true,
  includeWeekends = false,
}: ReturnsCalendarProps) {
  const [nowMs] = useState(() => Date.now());
  const canUseDailyPath = seriesPrecision === "intraday_path";
  const dailyReturns = useMemo(
    () => series && canUseDailyPath ? buildDailySimulationReturns(series, nowMs, { includeWeekends }) : [],
    [canUseDailyPath, includeWeekends, nowMs, series],
  );
  const availableModes = getAvailableModes(weeks, dailyReturns.length > 0);
  const fallbackMode = availableModes[0] ?? "monthly";
  const [selectedMode, setSelectedMode] = useState<CalendarMode>(forcedMode ?? fallbackMode);
  const mode = forcedMode ?? (availableModes.includes(selectedMode) ? selectedMode : fallbackMode);

  if (availableModes.length === 0 && !forcedMode) return null;
  if (mode === "daily" && dailyReturns.length === 0) return null;
  if ((mode === "monthly" || mode === "weekly") && weeks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {mode === "monthly" ? "Monthly" : mode === "weekly" ? "Weekly" : "Daily"} Returns
        </h3>
        {showModeToggle && !forcedMode && availableModes.length > 1 ? (
          <div className="flex gap-1">
            {availableModes.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSelectedMode(item)}
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                  mode === item
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] text-[color:var(--muted)] hover:border-[var(--accent)]/50"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {mode === "monthly" ? (
        <MonthlyGrid weeks={weeks} days={dailyReturns} />
      ) : mode === "weekly" ? (
        <WeeklyGrid weeks={weeks} days={dailyReturns} />
      ) : forcedMode === "daily" ? (
        <DailyWeekStrip days={dailyReturns} includeWeekends={includeWeekends} />
      ) : (
        <DailyMonthCalendars days={dailyReturns} includeWeekends={includeWeekends} />
      )}
    </div>
  );
}

function MonthlyGrid({ weeks, days }: { weeks: WeekReturn[]; days: DailySimulationReturn[] }) {
  const monthMap = days.length > 0
    ? aggregateDailyReturnsToMonthMetrics(days)
    : aggregateWeekReturnsToMonthMetrics(weeks);
  const years = [...new Set(weeks.map((week) => new Date(week.weekOpenUtc).getUTCFullYear()))].sort();
  const maxAbs = Math.max(...Array.from(monthMap.values()).map((cell) => Math.abs(cell.returnPct)), 0.01);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px] space-y-2">
        {years.map((year) => (
          <div key={year} className="grid grid-cols-[72px_repeat(12,minmax(64px,1fr))] gap-2">
            <div className="flex items-center text-xs font-bold text-[var(--foreground)]">{year}</div>
            {Array.from({ length: 12 }, (_, month) => {
              const cell = monthMap.get(`${year}-${month}`);
              return (
                <div
                  key={month}
                  className="min-h-[78px] rounded-lg border border-[var(--panel-border)] p-2 text-center"
                  style={cell ? { backgroundColor: cellColor(cell.returnPct, maxAbs) } : undefined}
                  title={cell ? `${monthTitle(year, month)} P/L: ${signed(cell.returnPct, 2)} | ${ddLabel(cell.drawdownSource)}: ${formatDrawdown(cell, 2)} (${cell.itemCount} ${days.length > 0 ? "days" : "weeks"})` : monthTitle(year, month)}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                    {MONTH_LABELS[month]}
                  </div>
                  <div className={`mt-2 text-sm font-bold ${!cell ? "text-[color:var(--muted)]" : cell.returnPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
                    {cell ? signed(cell.returnPct) : "-"}
                  </div>
                  {cell ? (
                    <div className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                      {ddLabel(cell.drawdownSource, true)} {formatDrawdown(cell)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyGrid({ weeks, days }: { weeks: WeekReturn[]; days: DailySimulationReturn[] }) {
  const years = [...new Set(weeks.map((week) => new Date(week.weekOpenUtc).getUTCFullYear()))].sort();
  const weekMap = aggregateToWeeksByMonth(weeks);
  const weekMetrics = days.length > 0
    ? aggregateDailyReturnsToWeekMetrics(weeks, days)
    : aggregateWeekReturnsToWeekMetrics(weeks);
  const maxAbs = Math.max(...Array.from(weekMetrics.values()).map((week) => Math.abs(week.returnPct)), 0.01);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1160px] space-y-3">
        {years.map((year) => (
          <div key={year} className="grid grid-cols-[72px_repeat(12,minmax(84px,1fr))] gap-2">
            <div className="flex items-start pt-2 text-xs font-bold text-[var(--foreground)]">{year}</div>
            {Array.from({ length: 12 }, (_, month) => {
              const monthWeeks = weekMap.get(`${year}-${month}`) ?? [];
              return (
                <div key={month} className="rounded-lg border border-[var(--panel-border)] p-2">
                  <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                    {MONTH_LABELS[month]}
                  </div>
                  <div className="grid gap-1.5">
                    {monthWeeks.length === 0 ? (
                      <div className="rounded-md px-2 py-3 text-center text-[color:var(--muted)]">-</div>
                    ) : monthWeeks.map((week) => {
                      const metric = weekMetrics.get(week.weekOpenUtc);
                      const returnPct = metric?.returnPct ?? week.returnPct;
                      return (
                        <div
                          key={week.weekOpenUtc}
                          className="rounded-md px-2 py-2 text-center"
                          style={{ backgroundColor: cellColor(returnPct, maxAbs) }}
                          title={`${formatWeekLabel(week.weekOpenUtc)} P/L: ${signed(returnPct, 2)} | ${ddLabel(metric?.drawdownSource ?? "none")}: ${formatDrawdown(metric, 2)}`}
                        >
                          <div className="text-[10px] text-[color:var(--muted)]">{formatWeekLabel(week.weekOpenUtc)}</div>
                          <div className={`text-sm font-bold ${returnPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
                            {signed(returnPct)}
                          </div>
                          <div className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                            {ddLabel(metric?.drawdownSource ?? "none", true)} {formatDrawdown(metric)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyWeekStrip({
  days,
  includeWeekends,
}: {
  days: DailySimulationReturn[];
  includeWeekends: boolean;
}) {
  const cellsByDay = new Map(days.map((day) => [day.dayLabel, day]));
  const maxAbs = Math.max(...days.map((day) => Math.abs(day.returnPct)), 0.01);
  const labels = includeWeekends ? WEEKDAY_LABELS : TRADING_WEEKDAY_LABELS;

  return (
    <div className={`grid gap-3 ${includeWeekends ? "lg:grid-cols-7" : "lg:grid-cols-5"}`}>
      {labels.map((dayLabel) => {
        const day = cellsByDay.get(dayLabel);
        return (
          <div
            key={dayLabel}
            className="min-h-32 rounded-xl border border-[var(--panel-border)] p-4"
            style={day ? { backgroundColor: cellColor(day.returnPct, maxAbs) } : undefined}
            title={day ? `${day.dateKey} P/L: ${signed(day.returnPct, 2)} | Path DD: ${day.maxDrawdownPct.toFixed(2)}%, active ${day.activePositions}` : undefined}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              {dayLabel}
            </div>
            <div className={`mt-4 text-3xl font-semibold ${!day ? "text-[color:var(--muted)]" : day.returnPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
              {day ? signed(day.returnPct, 2) : "-"}
            </div>
            {day ? (
              <div className="mt-4 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
                Path DD {day.maxDrawdownPct.toFixed(2)}% - Active {day.activePositions}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DailyMonthCalendars({
  days,
  includeWeekends,
}: {
  days: DailySimulationReturn[];
  includeWeekends: boolean;
}) {
  const daysByDate = new Map(days.map((day) => [day.dateKey, day]));
  const monthKeys = [...new Set(days.map((day) => monthKeyFromDateKey(day.dateKey)))].sort();
  const maxAbs = Math.max(...days.map((day) => Math.abs(day.returnPct)), 0.01);

  return (
    <div className="space-y-5">
      {monthKeys.map((monthKey) => {
        const [yearRaw, monthRaw] = monthKey.split("-");
        const year = Number(yearRaw);
        const month = Number(monthRaw);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
        const first = new Date(Date.UTC(year, month, 1));
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const leadingBlanks = first.getUTCDay();
        const slots = [
          ...Array.from({ length: leadingBlanks }, () => null),
          ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
        ];

        return (
          <section key={monthKey}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              {monthTitle(year, month)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                  {label}
                </div>
              ))}
              {slots.map((dayOfMonth, index) => {
                if (dayOfMonth === null) {
                  return <div key={`blank-${index}`} className="min-h-20 rounded-lg" />;
                }
                const date = new Date(Date.UTC(year, month, dayOfMonth));
                const dateKey = dateKeyFromDate(date);
                const day = daysByDate.get(dateKey);
                const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                return (
                  <div
                    key={dateKey}
                    className={`min-h-20 rounded-lg border border-[var(--panel-border)] p-2 ${isWeekend && !includeWeekends ? "opacity-45" : ""}`}
                    style={day ? { backgroundColor: cellColor(day.returnPct, maxAbs) } : undefined}
                    title={day ? `${dateKey} P/L: ${signed(day.returnPct, 2)} | Path DD: ${day.maxDrawdownPct.toFixed(2)}%` : dateKey}
                  >
                    <div className="text-[10px] font-semibold text-[color:var(--muted)]">{dayOfMonth}</div>
                    {day ? (
                      <>
                        <div className={`mt-2 text-sm font-bold ${day.returnPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
                          {signed(day.returnPct)}
                        </div>
                        <div className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                          Path DD {day.maxDrawdownPct.toFixed(1)}%
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
