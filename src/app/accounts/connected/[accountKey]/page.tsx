import DashboardLayout from "@/components/DashboardLayout";
import ConnectedAccountSizing from "@/components/ConnectedAccountSizing";
import AccountClientView from "@/components/accounts/AccountClientView";
import { getConnectedAccount, listConnectedAccounts } from "@/lib/connectedAccounts";
import { formatDateTimeET } from "@/lib/time";
import { buildBasketSignals } from "@/lib/basketSignals";
import { fetchBitgetFuturesSnapshot } from "@/lib/bitget";
import { loadConnectedAccountSecretsByKey } from "@/lib/connectedAccounts";
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
import crypto from "crypto";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

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

async function fetchBitgetUsdtEquity(accountKey: string): Promise<number | null> {
  const record = await loadConnectedAccountSecretsByKey(accountKey);
  const secrets = record?.secrets as Record<string, unknown> | undefined;
  const apiKey = typeof secrets?.apiKey === "string" ? (secrets.apiKey as string) : "";
  const apiSecret = typeof secrets?.apiSecret === "string" ? (secrets.apiSecret as string) : "";
  const apiPassphrase =
    typeof secrets?.apiPassphrase === "string" ? (secrets.apiPassphrase as string) : "";

  if (!apiKey || !apiSecret || !apiPassphrase) {
    return null;
  }

  const productType = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
  const path = "/api/v2/mix/account/accounts";
  const params = new URLSearchParams({ productType });
  const query = `?${params.toString()}`;
  const body = "";
  const timestamp = Date.now().toString();
  const prehash = `${timestamp}GET${path}${query}${body}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(prehash).digest("base64");

  const response = await fetch(`https://api.bitget.com${path}${query}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": apiPassphrase,
      locale: "en-US",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Bitget equity fetch failed:", response.status, text);
    return null;
  }

  const payload = (await response.json()) as {
    code?: string;
    msg?: string;
    data?: Array<{ marginCoin?: string; equity?: string; usdtEquity?: string }>;
  };

  if (payload.code && payload.code !== "00000") {
    console.error("Bitget equity API error:", payload.code, payload.msg);
    return null;
  }

  const list = Array.isArray(payload.data) ? payload.data : [];
  const row =
    list.find((item) => String(item.marginCoin ?? "").toUpperCase() === "USDT") ?? list[0];
  const equity = Number(row?.usdtEquity ?? row?.equity);
  return Number.isFinite(equity) && equity > 0 ? equity : null;
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
    // Always include current week so the UI doesn't default to "next week" just because
    // we have no snapshots/trades written yet for the current window.
    if (currentWeekOpenUtc) {
      ordered.push(currentWeekOpenUtc);
      seen.add(currentWeekOpenUtc);
    }
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
      plannedPairs = planned.pairs.map((pair) => ({
        ...pair,
        // Display/plan using the actual Bitget futures symbols so planned vs open lines up.
        symbol:
          pair.symbol.toUpperCase() === "BTCUSD"
            ? "BTCUSDT"
            : pair.symbol.toUpperCase() === "ETHUSD"
              ? "ETHUSDT"
              : pair.symbol,
        net: pair.net > 0 ? 1 : pair.net < 0 ? -1 : 0,
      }));
      plannedNote = planned.note ?? null;

    } else if (account.provider === "oanda") {
      const filtered = filterForOandaFx(basketSignals.pairs);
      // Keep symbols even if their basket legs hedge to net 0.
      plannedPairs = groupSignals(filtered, undefined, { dropNetted: false });
    }
  }

  if (account.provider === "bitget" && plannedPairs.length > 0) {
    const leverage =
      typeof (account.config as Record<string, unknown> | null)?.leverage === "number"
        ? (account.config as Record<string, unknown>).leverage as number
        : Number(process.env.BITGET_LEVERAGE ?? "10");

    let equity = stats.equity;
    if (!(equity > 0)) {
      const fetched = await fetchBitgetUsdtEquity(account.account_key);
      if (fetched && fetched > 0) {
        equity = fetched;
      }
    }
    const marginPerSymbol = equity > 0 ? equity / plannedPairs.length : 0;
    const notionalPerSymbol =
      equity > 0 && Number.isFinite(leverage) && leverage > 0
        ? (equity * leverage) / plannedPairs.length
        : 0;

    const priceBySymbol = new Map<string, number>();
    try {
      const [btc, eth] = await Promise.all([
        fetchBitgetFuturesSnapshot("BTC"),
        fetchBitgetFuturesSnapshot("ETH"),
      ]);
      if (Number.isFinite(Number(btc.lastPrice))) priceBySymbol.set("BTCUSD", Number(btc.lastPrice));
      if (Number.isFinite(Number(eth.lastPrice))) priceBySymbol.set("ETHUSD", Number(eth.lastPrice));
    } catch (error) {
      console.error("Failed to load Bitget prices for planned sizing:", error);
    }

    plannedPairs = plannedPairs.map((pair) => {
      const price = priceBySymbol.get(pair.symbol);
      if (!price || !Number.isFinite(price) || price <= 0 || notionalPerSymbol <= 0) {
        return pair;
      }
      const qty = notionalPerSymbol / price;
      const legQty = pair.legs.length > 0 ? qty / pair.legs.length : qty;
      const move1pctNet = notionalPerSymbol * 0.01;
      const move1pctLeg = (notionalPerSymbol / Math.max(1, pair.legs.length)) * 0.01;
      const sizeDisplay = Number.isFinite(leverage) && leverage > 0 ? `${leverage}x` : null;
      const riskDisplay = marginPerSymbol > 0 ? `$${marginPerSymbol.toFixed(2)}` : null;
      const riskDisplayLeg =
        marginPerSymbol > 0
          ? `$${(marginPerSymbol / Math.max(1, pair.legs.length)).toFixed(2)}`
          : null;
      return {
        ...pair,
        units: legQty,
        netUnits: qty * (pair.net > 0 ? 1 : pair.net < 0 ? -1 : 0),
        move1pctUsd: move1pctNet,
        sizeDisplay,
        riskDisplay,
        legs: pair.legs.map((leg) => ({
          ...leg,
          units: legQty,
          move1pctUsd: move1pctLeg,
          sizeDisplay,
          riskDisplay: riskDisplayLeg,
        })),
      } as typeof pair & {
        units: number;
        netUnits: number;
        move1pctUsd: number;
        sizeDisplay: string | null;
        riskDisplay: string | null;
        legs: Array<
          typeof pair.legs[number] & {
            units: number;
            move1pctUsd: number;
            sizeDisplay?: string | null;
            riskDisplay?: string | null;
          }
        >;
      };
    });
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
      // marginAvailable can legitimately be 0; treat that as "no free margin", not "missing".
      const available =
        Number.isFinite(sizing.marginAvailable ?? NaN)
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
    const fxSet = new Set(PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair));
    mappedRows = mappedRows.filter((row) => fxSet.has(row.symbol));
  }

  const accountCurrency = stats.currency;
  const settingsExtras =
    account.provider === "oanda" ? <ConnectedAccountSizing accountKey={account.account_key} /> : null;

  const rawPositions = Array.isArray(analysis?.positions)
    ? (analysis.positions as Array<Record<string, unknown>>)
    : [];

  const openPositions = (() => {
    const fxSet = account.provider === "oanda"
      ? new Set(PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair))
      : null;

    const map = new Map<
      string,
      {
        symbol: string;
        side: string;
        lots: number;
        pnl: number;
        legs: Array<{
          id: string;
          basket: string;
          side: string;
          lots: number;
          pnl: number;
          openTime?: string;
        }>;
      }
    >();

    rawPositions.forEach((pos, index) => {
      const symbol = String(pos.symbol ?? "").trim().toUpperCase();
      if (!symbol) return;
      if (fxSet && !fxSet.has(symbol)) return;

      const type = String(pos.type ?? "").trim().toUpperCase();
      const side = type === "SELL" || type === "SHORT" ? "SELL" : "BUY";

      const lots = Number(pos.lots ?? 0);
      if (!Number.isFinite(lots) || lots === 0) return;

      const pnl = Number(pos.profit ?? pos.pnl ?? 0);
      const comment = String(pos.comment ?? pos.tag ?? "").trim();
      const openTime = typeof pos.open_time === "string" ? (pos.open_time as string) : undefined;

      const key = `${symbol}:${side}`;
      if (!map.has(key)) {
        map.set(key, { symbol, side, lots: 0, pnl: 0, legs: [] });
      }
      const row = map.get(key)!;
      row.lots += Math.abs(lots);
      row.pnl += Number.isFinite(pnl) ? pnl : 0;
      row.legs.push({
        id: `${key}:${index}`,
        basket: comment || "live",
        side,
        lots: Math.abs(lots),
        pnl: Number.isFinite(pnl) ? pnl : 0,
        openTime,
      });
    });

    return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  })();


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
            sizeDisplay: "sizeDisplay" in pair ? (pair as any).sizeDisplay : null,
            riskDisplay: "riskDisplay" in pair ? (pair as any).riskDisplay : null,
          })),
          mappingRows: mappedRows.map((row) => ({
            symbol: row.symbol,
            instrument: row.instrument,
            available: row.available,
          })),
          openPositions,
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
  // Keep UI planned sizing consistent with the bot:
  // - truncate (never round up)
  // - if below minUnits, treat as non-tradable (0) instead of forcing 1-unit "dust" legs
  const p = Math.max(0, precision);
  const factor = p > 0 ? 10 ** p : 1;
  const truncated = p > 0 ? Math.floor(units * factor) / factor : Math.floor(units);
  const safe = Number.isFinite(truncated) ? truncated : 0;
  if (minUnits && safe > 0 && safe < minUnits) {
    return 0;
  }
  return safe;
}
