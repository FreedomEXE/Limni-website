import DashboardLayout from "@/components/DashboardLayout";
import ConnectedAccountSizing from "@/components/ConnectedAccountSizing";
import AccountClientView from "@/components/accounts/AccountClientView";
import { getConnectedAccount, listConnectedAccounts } from "@/lib/connectedAccounts";
import { formatDateTimeET } from "@/lib/time";
import { buildBasketSignals } from "@/lib/basketSignals";
import {
  buildBitgetPlannedTrades,
  filterForBitget,
  filterForOandaFx,
  groupSignals,
  signalsFromSnapshots,
} from "@/lib/plannedTrades";
import { DateTime } from "luxon";
import {
  getWeekOpenUtc,
  readPerformanceSnapshotsByWeek,
  listWeekOptionsForAccount,
} from "@/lib/performanceSnapshots";
import { formatCurrencySafe } from "@/lib/formatters";
import { getAccountStatsForWeek } from "@/lib/accountStats";
import { buildAccountEquityCurve } from "@/lib/accountEquityCurve";
import { getDefaultWeek, type WeekOption } from "@/lib/weekState";
import { buildOandaSizingForAccount } from "@/lib/oandaSizing";
import { unstable_noStore } from "next/cache";

export const dynamic = "force-dynamic";

type ConnectedAccountPageProps = {
  params: { accountKey: string } | Promise<{ accountKey: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
}

function computeMaxDrawdown(points: { equity_pct: number }[]) {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;
  for (const point of points) {
    if (point.equity_pct > peak) {
      peak = point.equity_pct;
    }
    const drawdown = peak - point.equity_pct;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

function extendToWindow(
  points: { ts_utc: string; equity_pct: number; lock_pct: number | null }[],
  windowEndUtc: string | null
) {
  if (!windowEndUtc || points.length === 0) {
    return points;
  }
  const last = points[points.length - 1];
  if (DateTime.fromISO(last.ts_utc, { zone: "utc" }) >= DateTime.fromISO(windowEndUtc, { zone: "utc" })) {
    return points;
  }
  return [...points, { ...last, ts_utc: windowEndUtc }];
}

/**
 * Decode account key with multiple fallback strategies
 */
function decodeAccountKey(rawParam: string) {
  const decodeSafe = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const decodedOnce = decodeSafe(rawParam);
  const decodedTwice = decodeSafe(decodedOnce);

  return Array.from(
    new Set(
      [
        rawParam,
        decodedOnce,
        decodedTwice,
        rawParam ? rawParam.replace(/%3A/gi, ":") : "",
        decodedOnce ? decodedOnce.replace(/%3A/gi, ":") : "",
      ].filter((value) => Boolean(value && value.trim()))
    )
  );
}

/**
 * Find account with fuzzy matching fallback
 */
async function findAccount(candidates: string[]) {
  const normalize = (value: string) => value.trim().toLowerCase();

  // Try exact match first
  for (const candidate of candidates) {
    const account = await getConnectedAccount(candidate);
    if (account) {
      return account;
    }
  }

  // Fuzzy match fallback
  const all = await listConnectedAccounts();
  const normalizedCandidates = new Set(candidates.map(normalize));
  const idCandidates = new Set(
    candidates
      .flatMap((value) => {
        const decoded = value;
        if (decoded.includes(":")) {
          const [, ...rest] = decoded.split(":");
          return [rest.join(":"), decoded];
        }
        return [decoded];
      })
      .map(normalize)
  );

  return (
    all.find((item) => normalizedCandidates.has(normalize(item.account_key))) ??
    all.find((item) =>
      normalizedCandidates.has(normalize(`${item.provider}:${item.account_id ?? ""}`))
    ) ??
    all.find((item) => idCandidates.has(normalize(item.account_id ?? ""))) ??
    null
  );
}

export default async function ConnectedAccountPage({
  params,
  searchParams,
}: ConnectedAccountPageProps) {
  unstable_noStore();
  const resolvedParams = await Promise.resolve(params);
  const rawParam = resolvedParams?.accountKey ?? "";

  // Decode account key
  const candidates = decodeAccountKey(rawParam);
  const account = await findAccount(candidates);

  if (!account) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">Account Not Found</h1>
          <p className="text-[color:var(--muted)]">
            Could not find account: <code>{rawParam}</code>
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const analysis = account.analysis as Record<string, unknown> | null;

  // Get week options for this account (filtered by creation date)
  const weekOptions = await listWeekOptionsForAccount(account.account_key, true, 4);
  const currentWeekOpenUtc = getWeekOpenUtc();
  const nextWeekOpenUtc = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" })
    .plus({ days: 7 })
    .toUTC()
    .toISO();
  const weekOptionsWithUpcoming = (() => {
    const ordered: WeekOption[] = [];
    const seen = new Set<string>();
    if (nextWeekOpenUtc) {
      ordered.push(nextWeekOpenUtc);
      seen.add(nextWeekOpenUtc);
    }
    for (const week of weekOptions) {
      if (!seen.has(String(week))) {
        ordered.push(week);
        seen.add(String(week));
      }
    }
    return ordered;
  })();
  const nowUtc = DateTime.utc();
  const hoursToNext =
    nextWeekOpenUtc
      ? DateTime.fromISO(nextWeekOpenUtc, { zone: "utc" }).diff(nowUtc, "hours").hours
      : null;

  // Determine selected week
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const weekParam = resolvedSearchParams?.week;
  const weekParamValue = Array.isArray(weekParam) ? weekParam[0] : weekParam;
  const viewParam = resolvedSearchParams?.view;
  const activeView =
    typeof viewParam === "string" &&
    ["overview", "trades", "analytics", "equity", "positions", "settings"].includes(viewParam)
      ? viewParam === "equity"
        ? ("overview" as const)
        : viewParam === "positions"
          ? ("trades" as const)
          : viewParam === "settings"
            ? ("analytics" as const)
            : (viewParam as "overview" | "trades" | "analytics")
      : ("overview" as const);
  const selectedWeek: WeekOption =
    weekParamValue === "all"
      ? "all"
      : typeof weekParamValue === "string" && weekOptionsWithUpcoming.includes(weekParamValue)
        ? weekParamValue
      : hoursToNext !== null && hoursToNext <= 48 && nextWeekOpenUtc
        ? nextWeekOpenUtc
        : getDefaultWeek(weekOptionsWithUpcoming, currentWeekOpenUtc);

  // Fetch week-specific data
  const stats = await getAccountStatsForWeek(account.account_key, selectedWeek);
  let basketSignals = await buildBasketSignals();

  // Load historical basket signals if not current week
  if (selectedWeek !== "all" && selectedWeek !== currentWeekOpenUtc) {
    try {
      const history = await readPerformanceSnapshotsByWeek(selectedWeek);
      if (history.length > 0) {
        basketSignals = {
          ...basketSignals,
          week_open_utc: selectedWeek,
          pairs: signalsFromSnapshots(history),
        };
      }
    } catch (error) {
      console.error("Failed to load historical basket signals:", error);
    }
  }

  // Build equity curve
  const equityCurveRaw = await buildAccountEquityCurve(account.account_key, selectedWeek);
  const windowEndUtc =
    selectedWeek !== "all"
      ? DateTime.fromISO(String(selectedWeek), { zone: "utc" }).plus({ days: 7 }).toUTC().toISO()
      : null;
  const equityCurve = extendToWindow(equityCurveRaw, windowEndUtc);
  const maxDrawdownPct = computeMaxDrawdown(equityCurve);

  // Build planned trades (only for current/upcoming weeks)
  let plannedPairs: import("@/lib/plannedTrades").PlannedPair[] = [];
  let plannedNote: string | null = null;
  let plannedSummary: {
    marginUsed?: number | null;
    marginAvailable?: number | null;
    scale?: number | null;
    currency?: string | null;
  } | null = null;
  let plannedSizingBySymbol = new Map<string, import("@/lib/oandaSizing").OandaSizingRow>();

  if (selectedWeek !== "all") {
    if (account.provider === "bitget") {
      const filtered = filterForBitget(basketSignals.pairs);
      const planned = buildBitgetPlannedTrades(filtered);
      plannedPairs = planned.pairs;
      plannedNote = planned.note ?? null;

    } else if (account.provider === "oanda") {
      const filtered = filterForOandaFx(basketSignals.pairs);
      plannedPairs = groupSignals(filtered);
    }
  }

  if (account.provider === "oanda" && plannedPairs.length > 0) {
    try {
      const sizing = await buildOandaSizingForAccount(account.account_key, {
        symbols: plannedPairs.map((pair) => pair.symbol),
      });
      plannedSizingBySymbol = new Map(
        sizing.rows.filter((row) => row.available).map((row) => [row.symbol, row]),
      );
      const buffer =
        typeof (account.config as Record<string, unknown> | null)?.marginBuffer === "number"
          ? (account.config as Record<string, unknown>).marginBuffer as number
          : 0.1;
      let totalMargin = 0;
      for (const pair of plannedPairs) {
        const row = plannedSizingBySymbol.get(pair.symbol);
        if (!row || !Number.isFinite(row.marginRate ?? NaN)) continue;
        totalMargin += sizing.nav * (row.marginRate ?? 0) * Math.abs(pair.net);
      }
      const available = Number.isFinite(sizing.marginAvailable ?? NaN)
        ? (sizing.marginAvailable as number)
        : sizing.nav;
      const scale = totalMargin > 0 ? Math.min(1, (available * (1 - buffer)) / totalMargin) : 1;
      plannedSummary = {
        marginUsed: totalMargin * scale,
        marginAvailable: Number.isFinite(sizing.marginAvailable ?? NaN) ? sizing.marginAvailable : null,
        scale,
        currency: sizing.currency === "USD" ? "$" : `${sizing.currency ?? "USD"} `,
      };

      plannedPairs = plannedPairs.map((pair) => {
        const row = plannedSizingBySymbol.get(pair.symbol);
        if (!row || !row.available || !Number.isFinite(row.units ?? NaN)) {
          return pair;
        }
        const precision = row.tradeUnitsPrecision ?? 0;
        const scaledUnits = roundUnits((row.units ?? 0) * scale, precision, row.minUnits);
        const netUnits = scaledUnits * pair.net;
        const notionalPerUnit = row.notionalUsdPerUnit ?? 0;
        const move1pctUsd = Math.abs(netUnits) * notionalPerUnit * 0.01;
        return {
          ...pair,
          units: scaledUnits,
          netUnits,
          move1pctUsd,
          legs: pair.legs.map((leg) => ({
            ...leg,
            units: scaledUnits,
            move1pctUsd: scaledUnits * notionalPerUnit * 0.01,
          })),
        } as typeof pair & {
          units: number;
          netUnits: number;
          move1pctUsd: number;
          legs: Array<typeof pair.legs[number] & { units: number; move1pctUsd: number }>;
        };
      });
    } catch (error) {
      console.error("Failed to compute OANDA planned sizing:", error);
    }
  }

  // Extract mapped instruments
  const mapped = Array.isArray(analysis?.mapped)
    ? (analysis.mapped as Array<{ symbol: string; instrument: string; available: boolean }>)
    : [];
  const fallbackMapped =
    account.provider === "bitget"
      ? [
          { symbol: "BTCUSD", instrument: "BTCUSDT", available: true },
          { symbol: "ETHUSD", instrument: "ETHUSDT", available: true },
        ]
      : [];
  let mappedRows = mapped.length > 0 ? mapped : fallbackMapped;
  if (account.provider === "oanda") {
    mappedRows = mappedRows.filter(
      (row) => row.symbol !== "BTCUSD" && row.symbol !== "ETHUSD"
    );
  }

  const accountCurrency = stats.currency;
  const settingsExtras =
    account.provider === "oanda" ? <ConnectedAccountSizing accountKey={account.account_key} /> : null;


  return (
    <DashboardLayout>
      <AccountClientView
        activeView={activeView}
        header={{
          title: account.label ?? account.account_key,
          providerLabel: account.provider.toUpperCase(),
          tradeModeLabel:
            typeof (account.config as Record<string, unknown> | null)?.trade_mode === "string"
              ? String((account.config as Record<string, unknown>).trade_mode).toUpperCase()
              : "AUTO",
          lastSync: account.last_sync_utc ? formatDateTimeET(account.last_sync_utc) : "—",
          weekOptions: weekOptionsWithUpcoming,
          currentWeek: currentWeekOpenUtc,
          selectedWeek,
          onBackHref: "/accounts",
        }}
        kpi={{
          weeklyPnlPct: stats.weeklyPnlPct,
          maxDrawdownPct,
          tradesThisWeek: stats.tradesThisWeek,
          equity: stats.equity,
          balance: stats.balance,
          currency: accountCurrency,
          scopeLabel: selectedWeek === "all" ? "All • Account" : "Week • Account",
        }}
        overview={{
          openPositions: stats.openPositions,
          plannedCount: plannedPairs.length,
          mappingCount: mappedRows.length,
          plannedNote: plannedNote ?? null,
        }}
        plannedSummary={plannedSummary ?? undefined}
        equity={{
          title: selectedWeek === "all" ? "All-time equity curve" : "Weekly equity curve (%)",
          points: equityCurve,
        }}
        debug={{
          selectedWeekKey: selectedWeek === "all" ? "all" : String(selectedWeek),
          kpiWeekKey: stats.weekOpenUtc,
          equityWeekKey: selectedWeek === "all" ? "all" : String(selectedWeek),
        }}
        drawerData={{
          plannedPairs: plannedPairs.map((pair) => ({
            symbol: pair.symbol,
            assetClass: pair.assetClass,
            net: pair.net,
            legsCount: pair.legs.length,
            legs: pair.legs,
            units: "units" in pair ? (pair as any).units : null,
            netUnits: "netUnits" in pair ? (pair as any).netUnits : null,
            move1pctUsd: "move1pctUsd" in pair ? (pair as any).move1pctUsd : null,
          })),
          mappingRows: mappedRows.map((row) => ({
            symbol: row.symbol,
            instrument: row.instrument,
            available: row.available,
          })),
          openPositions: [],
          closedGroups: [],
          journalRows: [],
          kpiRows: [
            { label: "Equity", value: formatCurrencySafe(stats.equity, accountCurrency) },
            { label: "Balance", value: formatCurrencySafe(stats.balance, accountCurrency) },
            { label: "Basket PnL", value: formatPercent(stats.basketPnlPct) },
            {
              label: "Locked Profit",
              value: stats.lockedProfitPct !== null ? formatPercent(stats.lockedProfitPct) : "—",
            },
            { label: "Leverage", value: stats.leverage ? `${stats.leverage}x` : "—" },
            {
              label: "Margin",
              value: stats.margin ? formatCurrencySafe(stats.margin, accountCurrency) : "—",
            },
            {
              label: "Free Margin",
              value: stats.freeMargin ? formatCurrencySafe(stats.freeMargin, accountCurrency) : "—",
            },
            {
              label: "Risk Used",
              value: stats.riskUsedPct ? formatPercent(stats.riskUsedPct) : "—",
            },
          ],
        }}
        settingsExtras={settingsExtras}
      />
    </DashboardLayout>
  );
}

function roundUnits(units: number, precision: number, minUnits?: number) {
  const factor = Math.max(0, precision);
  const rounded = Number(units.toFixed(factor));
  if (minUnits && rounded > 0 && rounded < minUnits) {
    return minUnits;
  }
  return rounded;
}
