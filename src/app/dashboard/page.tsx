import { DateTime } from "luxon";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardViewSection, {
  type DashboardCotPayload,
  type DashboardStrengthPayload,
  type DashboardSentimentPayload,
} from "@/components/dashboard/DashboardViewSection";
import type { MyfxbookPositioning } from "@/components/SentimentHeatmap";
import {
  derivePairDirectionsByBaseWithNeutral,
  derivePairDirectionsWithNeutral,
  resolveMarketBias,
} from "@/lib/cotCompute";
import { evaluateFreshness } from "@/lib/cotFreshness";
import {
  COT_VARIANT,
  getAssetClass,
  getAssetClassDefinition,
  listAssetClasses,
  type AssetClass,
} from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS, type PairDefinition } from "@/lib/cotPairs";
import { readSnapshotHistory } from "@/lib/cotStore";
import type { CotSnapshot, CotSnapshotResponse, PairSnapshot } from "@/lib/cotTypes";
import type { Direction } from "@/lib/cotTypes";
import {
  deriveCotReportDate,
  findDataSectionWeekByReportDate,
  listDataSectionWeekEntries,
} from "@/lib/dataSectionWeeks";
import {
  resolveDashboardBias,
} from "@/lib/dashboard/dashboardSelection";
import { getWeeklyPairReturns } from "@/lib/pairReturns";
import type { PairPerformance } from "@/lib/priceStore";
import {
  evaluateStrengthGate,
  readWeeklyPairStrengthsForAsset,
  readWeeklyUnderlyingStrengths,
  type WeeklyPairStrength,
  type WeeklyUnderlyingStrength,
} from "@/lib/strength/weeklyStrength";
import {
  ALL_SENTIMENT_SYMBOLS,
  SENTIMENT_ASSET_CLASSES,
  type SentimentAssetClass,
} from "@/lib/sentiment/symbols";
import {
  getAggregatesForWeekStartWithBackfill,
  getLatestAggregatesLocked,
  getLatestSnapshotsByProvider,
} from "@/lib/sentiment/store";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { latestIso } from "@/lib/time";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DashboardPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

type ResolvedBias = {
  long: number;
  short: number;
  net: number;
  bias: string;
};

type DashboardPairRow = DashboardCotPayload["pairRowsWithPerf"][number];

function buildResponse(
  snapshot: CotSnapshot | null,
  assetClass: ReturnType<typeof getAssetClass>,
): CotSnapshotResponse {
  if (!snapshot) {
    return {
      report_date: "",
      last_refresh_utc: "",
      asset_class: assetClass,
      variant: COT_VARIANT,
      trading_allowed: false,
      reason: "no snapshot available",
      currencies: {},
      pairs: {},
    };
  }

  const freshness = evaluateFreshness(
    snapshot.report_date,
    snapshot.last_refresh_utc,
  );

  return { ...snapshot, ...freshness };
}

function formatCftcNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function buildBiasDetails({
  pairDef,
  direction,
  dataType,
  assetLabel,
  baseBias,
  quoteBias,
  baseResolved,
  quoteResolved,
}: {
  pairDef: PairDefinition;
  direction: PairSnapshot["direction"];
  dataType: "dealer" | "commercial";
  assetLabel: string;
  baseBias: PairSnapshot["base_bias"];
  quoteBias: PairSnapshot["quote_bias"];
  baseResolved?: ResolvedBias;
  quoteResolved?: ResolvedBias;
}) {
  return [
    { label: "Direction", value: direction },
    {
      label: "Data Type",
      value: dataType === "dealer" ? "Dealer" : "Commercial",
    },
    { label: "Asset Class", value: assetLabel },
    { label: "Base Market", value: pairDef.base },
    { label: "Base Bias", value: baseBias },
    { label: "Base Long", value: formatCftcNumber(baseResolved?.long) },
    { label: "Base Short", value: formatCftcNumber(baseResolved?.short) },
    { label: "Base Net", value: formatCftcNumber(baseResolved?.net) },
    { label: "Quote Market", value: pairDef.quote },
    { label: "Quote Bias", value: quoteBias },
    { label: "Quote Long", value: formatCftcNumber(quoteResolved?.long) },
    { label: "Quote Short", value: formatCftcNumber(quoteResolved?.short) },
    { label: "Quote Net", value: formatCftcNumber(quoteResolved?.net) },
  ];
}

function buildCanonicalPairPerformance(
  selectedWeekOpenUtc: string,
  row: { openPrice: number; closePrice: number; returnPct: number } | null,
): PairPerformance | null {
  if (!row) return null;
  return {
    open: row.openPrice,
    current: row.closePrice,
    percent: row.returnPct,
    pips: 0,
    open_time_utc: selectedWeekOpenUtc,
    current_time_utc: selectedWeekOpenUtc,
  };
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseMyfxbookPositioning(payload: unknown, timestampUtc: string): MyfxbookPositioning | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const row = payload as Record<string, unknown>;
  const longLots = toNullableNumber(row.longVolume);
  const shortLots = toNullableNumber(row.shortVolume);
  return {
    longLots,
    shortLots,
    totalLots: longLots !== null && shortLots !== null ? longLots + shortLots : null,
    longPositions: toNullableNumber(row.longPositions),
    shortPositions: toNullableNumber(row.shortPositions),
    totalPositions: toNullableNumber(row.totalPositions),
    avgLongPrice: toNullableNumber(row.avgLongPrice),
    avgShortPrice: toNullableNumber(row.avgShortPrice),
    updatedAtUtc: timestampUtc || null,
  };
}

function getSentimentSymbolsForAsset(assetClass: AssetClass | "all") {
  if (assetClass === "all") {
    return ALL_SENTIMENT_SYMBOLS;
  }
  if (assetClass in SENTIMENT_ASSET_CLASSES) {
    return SENTIMENT_ASSET_CLASSES[assetClass as SentimentAssetClass].symbols;
  }
  return ALL_SENTIMENT_SYMBOLS;
}

function buildReportOptions(reportDates: string[]) {
  return reportDates.map((date) => {
    const report = DateTime.fromISO(date, { zone: "America/New_York" });
    if (!report.isValid) {
      return { value: date, label: date };
    }
    const daysUntilMonday = (8 - report.weekday) % 7;
    const monday = report
      .plus({ days: daysUntilMonday })
      .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    return { value: date, label: monday.toFormat("MMM dd yyyy") };
  });
}

function buildCotPayloadForReport({
  isAll,
  assetClass,
  assetClasses,
  biasMode,
  reportDate,
  previousReportDate,
  snapshotMapsByAsset,
  canonicalReturnMap,
  totalPairsCount,
}: {
  isAll: boolean;
  assetClass: AssetClass;
  assetClasses: Array<ReturnType<typeof listAssetClasses>[number]>;
  biasMode: "dealer" | "commercial";
  reportDate: string;
  previousReportDate: string | null;
  snapshotMapsByAsset: Map<AssetClass, Map<string, CotSnapshot>>;
  canonicalReturnMap: Map<string, PairPerformance | null>;
  totalPairsCount: number;
}): DashboardCotPayload {
  const currencyRows = [] as Array<{
    assetLabel: string;
    currency: string;
    label: string;
    long: number;
    short: number;
    net: number;
    bias: string;
  }>;
  const pairRowsWithPerf = [] as DashboardPairRow[];
  let missingPairs: string[] = [];
  let combinedRefresh = "";

  if (isAll) {
    const snapshotEntries = assetClasses
      .map((asset) => ({
        asset,
        snapshot: snapshotMapsByAsset.get(asset.id)?.get(reportDate) ?? null,
      }))
      .filter((entry) => Boolean(entry.snapshot));

    snapshotEntries.forEach((entry) => {
      const entrySnapshot = entry.snapshot!;
      const marketLabels = entry.asset.markets;
      const pairDefs = PAIRS_BY_ASSET_CLASS[entry.asset.id];
      const resolvedByCurrency = new Map<string, ResolvedBias>();

      Object.entries(entrySnapshot.currencies).forEach(([currency, snapshotValue]) => {
        const resolved = resolveMarketBias(snapshotValue, biasMode);
        if (resolved) {
          resolvedByCurrency.set(currency, {
            long: resolved.long,
            short: resolved.short,
            net: resolved.net,
            bias: resolved.bias,
          });
        }
      });

      Object.entries(entrySnapshot.currencies)
        .map(([currency, snapshotValue]) => {
          const resolved = resolveMarketBias(snapshotValue, biasMode);
          if (!resolved) {
            return null;
          }
          if (entry.asset.id !== "fx" && currency === "USD") {
            return null;
          }
          return {
            assetLabel: entry.asset.label,
            currency,
            long: resolved.long,
            short: resolved.short,
            net: resolved.net,
            bias: resolved.bias,
            label: marketLabels[currency]?.label ?? currency,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .forEach((row) => currencyRows.push(row));

      const derivedPairs =
        entry.asset.id === "fx"
          ? derivePairDirectionsWithNeutral(entrySnapshot.currencies, pairDefs, biasMode)
          : derivePairDirectionsByBaseWithNeutral(entrySnapshot.currencies, pairDefs, biasMode);

      const allPairs: Record<string, PairSnapshot> = {};
      for (const pairDef of pairDefs) {
        allPairs[pairDef.pair] = derivedPairs[pairDef.pair] ?? {
          direction: "NEUTRAL",
          base_bias: "NEUTRAL",
          quote_bias: "NEUTRAL",
        };
      }

      pairDefs.forEach((pairDef) => {
        const row = allPairs[pairDef.pair];
        pairRowsWithPerf.push({
          pair: `${pairDef.pair} (${entry.asset.label})`,
          direction: row.direction,
          performance: canonicalReturnMap.get(`${entry.asset.id}|${pairDef.pair}`) ?? null,
          subtitle: entry.asset.label,
          details: buildBiasDetails({
            pairDef,
            direction: row.direction,
            dataType: biasMode,
            assetLabel: entry.asset.label,
            baseBias: row.base_bias,
            quoteBias: row.quote_bias,
            baseResolved: resolvedByCurrency.get(pairDef.base),
            quoteResolved: resolvedByCurrency.get(pairDef.quote),
          }),
        });
      });

      missingPairs = missingPairs.concat(
        pairDefs
          .filter((pairDef) => !canonicalReturnMap.has(`${entry.asset.id}|${pairDef.pair}`))
          .map((pairDef) => `${pairDef.pair} (${entry.asset.label})`),
      );
    });

    currencyRows.sort((a, b) =>
      `${a.assetLabel}-${a.currency}`.localeCompare(`${b.assetLabel}-${b.currency}`),
    );
    pairRowsWithPerf.sort((a, b) => a.pair.localeCompare(b.pair));
    const refreshDates = snapshotEntries
      .map((entry) => entry.snapshot?.last_refresh_utc)
      .filter((value): value is string => Boolean(value));
    combinedRefresh = refreshDates.length > 0 ? refreshDates.sort().at(-1) ?? "" : "";
  } else {
    const assetDefinition = getAssetClassDefinition(assetClass);
    const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
    const snapshot = snapshotMapsByAsset.get(assetClass)?.get(reportDate) ?? null;
    const data = buildResponse(snapshot, assetClass);

    Object.entries(data.currencies)
      .map(([currency, snapshotValue]) => {
        const resolved = resolveMarketBias(snapshotValue, biasMode);
        return resolved
          ? {
              assetLabel: assetDefinition.label,
              currency,
              label: assetDefinition.markets[currency]?.label ?? currency,
              long: resolved.long,
              short: resolved.short,
              net: resolved.net,
              bias: resolved.bias,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => assetClass === "fx" || row.currency !== "USD")
      .sort((a, b) => a.currency.localeCompare(b.currency))
      .forEach((row) => currencyRows.push(row));

    const derivedPairs =
      assetClass === "fx"
        ? derivePairDirectionsWithNeutral(data.currencies, pairDefs, biasMode)
        : derivePairDirectionsByBaseWithNeutral(data.currencies, pairDefs, biasMode);

    const allPairs: Record<string, PairSnapshot> = {};
    for (const pairDef of pairDefs) {
      allPairs[pairDef.pair] = derivedPairs[pairDef.pair] ?? {
        direction: "NEUTRAL",
        base_bias: "NEUTRAL",
        quote_bias: "NEUTRAL",
      };
    }

    const pairRows = pairDefs
      .map((pairDef) => ({
        pairDef,
        row: allPairs[pairDef.pair],
      }))
      .sort((a, b) => a.pairDef.pair.localeCompare(b.pairDef.pair));

    missingPairs = pairRows
      .filter(({ pairDef }) => !canonicalReturnMap.has(`${assetClass}|${pairDef.pair}`))
      .map(({ pairDef }) => pairDef.pair);

    pairRows.forEach(({ pairDef, row }) => {
      pairRowsWithPerf.push({
        pair: pairDef.pair,
        direction: row.direction,
        performance: canonicalReturnMap.get(`${assetClass}|${pairDef.pair}`) ?? null,
        subtitle: assetDefinition.label,
        details: buildBiasDetails({
          pairDef,
          direction: row.direction,
          dataType: biasMode,
          assetLabel: assetDefinition.label,
          baseBias: row.base_bias,
          quoteBias: row.quote_bias,
          baseResolved: data.currencies[pairDef.base]
            ? (resolveMarketBias(data.currencies[pairDef.base], biasMode) ?? undefined)
            : undefined,
          quoteResolved: data.currencies[pairDef.quote]
            ? (resolveMarketBias(data.currencies[pairDef.quote], biasMode) ?? undefined)
            : undefined,
        }),
      });
    });

    combinedRefresh = data.last_refresh_utc;
  }

  const previousDirectionMap = new Map<string, "LONG" | "SHORT" | "NEUTRAL">();
  if (previousReportDate) {
    if (isAll) {
      assetClasses.forEach((asset) => {
        const previousSnapshot = snapshotMapsByAsset.get(asset.id)?.get(previousReportDate) ?? null;
        if (!previousSnapshot) {
          return;
        }
        const pairDefs = PAIRS_BY_ASSET_CLASS[asset.id];
        const derivedPairs =
          asset.id === "fx"
            ? derivePairDirectionsWithNeutral(previousSnapshot.currencies, pairDefs, biasMode)
            : derivePairDirectionsByBaseWithNeutral(previousSnapshot.currencies, pairDefs, biasMode);
        pairDefs.forEach((pairDef) => {
          const direction = derivedPairs[pairDef.pair]?.direction ?? "NEUTRAL";
          previousDirectionMap.set(`${pairDef.pair} (${asset.label})`, direction);
        });
      });
    } else {
      const previousSnapshot = snapshotMapsByAsset.get(assetClass)?.get(previousReportDate) ?? null;
      if (previousSnapshot) {
        const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
        const derivedPairs =
          assetClass === "fx"
            ? derivePairDirectionsWithNeutral(previousSnapshot.currencies, pairDefs, biasMode)
            : derivePairDirectionsByBaseWithNeutral(previousSnapshot.currencies, pairDefs, biasMode);
        pairDefs.forEach((pairDef) => {
          const direction = derivedPairs[pairDef.pair]?.direction ?? "NEUTRAL";
          previousDirectionMap.set(pairDef.pair, direction);
        });
      }
    }
  }

  const flipDetails = pairRowsWithPerf
    .map((row) => {
      const prior = previousDirectionMap.get(row.pair);
      if (!prior || prior === row.direction) {
        return null;
      }
      return { label: row.pair, value: `${prior} → ${row.direction}` };
    })
    .filter((detail): detail is { label: string; value: string } => Boolean(detail));

  return {
    combinedRefresh,
    totalPairsCount,
    pairRowsWithPerf,
    missingPairs,
    currencyRows,
    biasLabel: isAll ? "Asset" : getAssetClassDefinition(assetClass).biasLabel,
    flipDetails,
  };
}

async function buildSentimentPayloadForWeek(
  weekOpenUtc: string | null,
  sentimentSymbols: readonly string[],
  weeklyReturns: Array<{ symbol: string; returnPct: number }>,
): Promise<DashboardSentimentPayload> {
  let aggregates: SentimentAggregate[] = [];
  let previousAggregates: SentimentAggregate[] = [];

  try {
    if (weekOpenUtc) {
      const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
      const close = open.isValid ? open.plus({ days: 7 }) : open;
      aggregates = open.isValid
        ? await getAggregatesForWeekStartWithBackfill(
            open.toUTC().toISO() ?? weekOpenUtc,
            close.toUTC().toISO() ?? weekOpenUtc,
          )
        : await getLatestAggregatesLocked();
      const prevOpen = open.isValid ? open.minus({ days: 7 }) : null;
      if (prevOpen?.isValid) {
        const prevClose = prevOpen.plus({ days: 7 });
        previousAggregates = await getAggregatesForWeekStartWithBackfill(
          prevOpen.toUTC().toISO() ?? weekOpenUtc,
          prevClose.toUTC().toISO() ?? weekOpenUtc,
        );
      }
    } else {
      aggregates = await getLatestAggregatesLocked();
    }
  } catch (error) {
    console.error("Sentiment load failed:", error instanceof Error ? error.message : String(error));
  }

  const filteredAggregates = aggregates.filter((agg) => sentimentSymbols.includes(agg.symbol));
  const latestAggregateTimestamp = latestIso(filteredAggregates.map((agg) => agg.timestamp_utc));
  const previousBySymbol = new Map(
    previousAggregates
      .filter((agg) => sentimentSymbols.includes(agg.symbol))
      .map((agg) => [agg.symbol, agg.crowding_state]),
  );
  const flipDetails = filteredAggregates
    .map((agg) => {
      const prior = previousBySymbol.get(agg.symbol);
      if (!prior || prior === agg.crowding_state) {
        return null;
      }
      return {
        label: agg.symbol,
        value: `${prior.replace("CROWDED_", "")} → ${agg.crowding_state.replace("CROWDED_", "")}`,
      };
    })
    .filter((detail): detail is { label: string; value: string } => Boolean(detail));

  const performanceByPair = weeklyReturns.reduce<Record<string, number | null>>((acc, row) => {
    acc[row.symbol] = row.returnPct;
    return acc;
  }, {});

  return {
    latestAggregateTimestamp,
    aggregates: filteredAggregates.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    performanceByPair,
    flipDetails,
  };
}

function strengthBias(direction: Direction) {
  if (direction === "LONG") return "BULLISH";
  if (direction === "SHORT") return "BEARISH";
  return "NEUTRAL";
}

function invertDirection(direction: Direction): Direction {
  if (direction === "LONG") return "SHORT";
  if (direction === "SHORT") return "LONG";
  return "NEUTRAL";
}

function formatSignedNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatStrengthLabel(assetClass: AssetClass, symbol: string) {
  const definition = getAssetClassDefinition(assetClass);
  return definition.markets[symbol]?.label ?? symbol;
}

function buildStrengthDetailItems(row: WeeklyPairStrength) {
  const longGate = evaluateStrengthGate(row, "LONG");
  const shortGate = evaluateStrengthGate(row, "SHORT");
  const tradableDirection = invertDirection(row.compositeDirection);
  const details = [
    { label: "Asset Class", value: getAssetClassDefinition(row.assetClass).label },
    { label: "Tradable Fade Direction", value: tradableDirection },
    { label: "Raw Composite Strength", value: row.compositeDirection },
    { label: "Composite Score", value: String(row.compositeScore) },
    { label: "Available Windows", value: `${row.availableWindows}/3` },
    {
      label: "Gate vs LONG Bias",
      value: `${longGate.passes ? "PASS" : "BLOCK"} (${longGate.score})`,
    },
    {
      label: "Gate vs SHORT Bias",
      value: `${shortGate.passes ? "PASS" : "BLOCK"} (${shortGate.score})`,
    },
  ] as Array<{ label: string; value: string }>;

  row.windows.forEach((windowRow) => {
    const longWindow = longGate.windows.find((gateRow) => gateRow.window === windowRow.window);
    const shortWindow = shortGate.windows.find((gateRow) => gateRow.window === windowRow.window);
    details.push(
      { label: `${windowRow.window} Snapshot`, value: windowRow.snapshotTimeUtc ?? "Missing" },
      { label: `${windowRow.window} Raw Strength`, value: windowRow.direction },
      { label: `${windowRow.window} Signed Spread`, value: formatSignedNumber(windowRow.signedSpread) },
      {
        label: `${windowRow.window} Normalized ${windowRow.baseSymbol}`,
        value: formatSignedNumber(windowRow.normalizedBase),
      },
      {
        label: `${windowRow.window} Normalized ${windowRow.quoteSymbol}`,
        value: formatSignedNumber(windowRow.normalizedQuote),
      },
      {
        label: `${windowRow.window} vs LONG Bias`,
        value: longWindow?.relation ?? "NEUTRAL",
      },
      {
        label: `${windowRow.window} vs SHORT Bias`,
        value: shortWindow?.relation ?? "NEUTRAL",
      },
    );
  });

  return details;
}

async function buildStrengthPayloadForWeek({
  weekOpenUtc,
  selectedAsset,
  weeklyReturns,
  previousWeekOpenUtc,
  totalPairsCount,
}: {
  weekOpenUtc: string | null;
  selectedAsset: AssetClass | "all";
  weeklyReturns: Array<{ symbol: string; assetClass: AssetClass; returnPct: number; openPrice: number; closePrice: number }>;
  previousWeekOpenUtc: string | null;
  totalPairsCount: number;
}): Promise<DashboardStrengthPayload> {
  if (!weekOpenUtc) {
    return {
      latestSnapshotUtc: null,
      totalPairsCount,
      pairRowsWithPerf: [],
      missingPairs: [],
      stripItems: [],
      flipDetails: [],
      note: "No canonical week-open strength snapshot available.",
    };
  }

  const [strengthRows, previousRows, underlyingRows] = await Promise.all([
    readWeeklyPairStrengthsForAsset(weekOpenUtc, selectedAsset),
    previousWeekOpenUtc
      ? readWeeklyPairStrengthsForAsset(previousWeekOpenUtc, selectedAsset)
      : Promise.resolve([]),
    readWeeklyUnderlyingStrengths(weekOpenUtc, selectedAsset),
  ]);

  const performanceByKey = new Map(
    weeklyReturns.map((row) => [
      `${row.assetClass}|${row.symbol}`,
      buildCanonicalPairPerformance(weekOpenUtc, row),
    ]),
  );
  const previousDirections = new Map(
    previousRows.map((row) => [row.pair, invertDirection(row.compositeDirection)]),
  );

  const pairRowsWithPerf = [...strengthRows]
    .sort((a, b) => a.pair.localeCompare(b.pair))
    .map((row) => {
      const tradableDirection = invertDirection(row.compositeDirection);
      return {
      pair: row.pair,
      direction: tradableDirection,
      performance: performanceByKey.get(`${row.assetClass}|${row.pair}`) ?? null,
      subtitle: row.windows.map((windowRow) => `${windowRow.window} raw ${windowRow.direction}`).join(" · "),
      details: buildStrengthDetailItems(row),
    };});

  const flipDetails = pairRowsWithPerf
    .map((row) => {
      const prior = previousDirections.get(row.pair);
      if (!prior || prior === row.direction) {
        return null;
      }
      return { label: row.pair, value: `${prior} → ${row.direction}` };
    })
    .filter((detail): detail is { label: string; value: string } => Boolean(detail));

  const stripItems = underlyingRows
    .filter((row) => row.window === "24h")
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map((row: WeeklyUnderlyingStrength) => ({
      id: row.id,
      label: formatStrengthLabel(row.assetClass, row.symbol),
      bias: strengthBias(row.direction),
    }));

  const missingPairs = strengthRows
    .filter((row) => row.availableWindows < 3)
    .map((row) => row.pair);

  const latestSnapshotUtc = latestIso([
    ...strengthRows.map((row) => row.latestSnapshotUtc),
    ...underlyingRows.map((row) => row.snapshotTimeUtc),
  ]);

  return {
    latestSnapshotUtc,
    totalPairsCount,
    pairRowsWithPerf,
    missingPairs,
    stripItems,
    flipDetails,
    note: "Tiles show the tradable fade direction. Modal details include the raw 1h, 4h, and 24h strength readings plus long/short gate outcomes.",
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const assetParam = resolvedSearchParams?.asset;
  const reportParam = resolvedSearchParams?.report;
  const biasParam = resolvedSearchParams?.bias;
  const viewParam = resolvedSearchParams?.view;
  const rawAsset = Array.isArray(assetParam) ? assetParam[0] : assetParam;
  const isAll = rawAsset === "all" || !rawAsset;
  const assetClass = getAssetClass(rawAsset);
  const selectedAsset = isAll ? "all" : assetClass;
  const currentWeekOpen = getDisplayWeekOpenUtc();
  const biasMode = resolveDashboardBias(Array.isArray(biasParam) ? biasParam[0] : biasParam);
  const view =
    viewParam === "list" || viewParam === "heatmap" ? viewParam : "heatmap";
  const reportDate = Array.isArray(reportParam) ? reportParam[0] : reportParam;

  const assetClasses = listAssetClasses();
  const weekEntries = await listDataSectionWeekEntries();
  const currentWeekEntry = {
    weekOpenUtc: currentWeekOpen,
    cotReportDate: deriveCotReportDate(currentWeekOpen),
  };
  const allEntries = [currentWeekEntry, ...weekEntries].filter(
    (entry, index, all) =>
      all.findIndex((candidate) => candidate.cotReportDate === entry.cotReportDate) === index,
  );
  const availableDates = allEntries.map((entry) => entry.cotReportDate);
  const orderedDates = [...availableDates].sort((a, b) => b.localeCompare(a));
  const selectedReportDate =
    reportDate && orderedDates.includes(reportDate)
      ? reportDate
      : orderedDates[0] ?? "";
  const reportOptions = buildReportOptions(orderedDates);
  const totalPairsCount = isAll
    ? assetClasses.reduce((sum, asset) => sum + (PAIRS_BY_ASSET_CLASS[asset.id]?.length ?? 0), 0)
    : PAIRS_BY_ASSET_CLASS[assetClass]?.length ?? 0;

  const reportToWeekMap = new Map(allEntries.map((entry) => [entry.cotReportDate, entry.weekOpenUtc]));
  if (!reportToWeekMap.has(selectedReportDate) && selectedReportDate) {
    const foundWeek = await findDataSectionWeekByReportDate(selectedReportDate);
    if (foundWeek?.weekOpenUtc) {
      reportToWeekMap.set(selectedReportDate, foundWeek.weekOpenUtc);
    }
  }

  const selectedWeeks = orderedDates
    .map((date) => ({
      reportDate: date,
      weekOpenUtc: reportToWeekMap.get(date) ?? null,
    }))
    .filter((entry) => Boolean(entry.reportDate));

  const weeklyReturnsEntries = await Promise.all(
    selectedWeeks.map(async ({ reportDate, weekOpenUtc }) => [
      reportDate,
      weekOpenUtc
        ? await getWeeklyPairReturns(weekOpenUtc, isAll ? undefined : assetClass)
        : [],
    ] as const),
  );
  const weeklyReturnsByReport = new Map(weeklyReturnsEntries);

  const snapshotMapsByAsset = new Map<AssetClass, Map<string, CotSnapshot>>();
  const assetsToLoad = isAll ? assetClasses.map((asset) => asset.id) : [assetClass];
  const snapshotHistories = await Promise.all(
    assetsToLoad.map(async (assetId) => [
      assetId,
      await readSnapshotHistory(assetId, orderedDates.length + 1),
    ] as const),
  );
  snapshotHistories.forEach(([assetId, snapshots]) => {
    snapshotMapsByAsset.set(
      assetId,
      new Map(snapshots.map((snapshot) => [snapshot.report_date, snapshot])),
    );
  });

  const cotDataByReport = orderedDates.reduce<Record<string, { dealer: DashboardCotPayload; commercial: DashboardCotPayload }>>(
    (acc, currentReportDate, index) => {
      const currentWeekOpenUtc = reportToWeekMap.get(currentReportDate) ?? null;
      const canonicalReturns = weeklyReturnsByReport.get(currentReportDate) ?? [];
      const canonicalReturnMap = new Map(
        canonicalReturns.map((row) => [
          `${row.assetClass}|${row.symbol}`,
          buildCanonicalPairPerformance(currentWeekOpenUtc ?? row.symbol, row),
        ]),
      );
      const previousReportDate = orderedDates[index + 1] ?? null;
      acc[currentReportDate] = {
        dealer: buildCotPayloadForReport({
          isAll,
          assetClass,
          assetClasses,
          biasMode: "dealer",
          reportDate: currentReportDate,
          previousReportDate,
          snapshotMapsByAsset,
          canonicalReturnMap,
          totalPairsCount,
        }),
        commercial: buildCotPayloadForReport({
          isAll,
          assetClass,
          assetClasses,
          biasMode: "commercial",
          reportDate: currentReportDate,
          previousReportDate,
          snapshotMapsByAsset,
          canonicalReturnMap,
          totalPairsCount,
        }),
      };
      return acc;
    },
    {},
  );

  const sentimentSymbols = getSentimentSymbolsForAsset(selectedAsset);
  let myfxbookPositioningBySymbol: Record<string, MyfxbookPositioning | undefined> = {};
  try {
    const myfxbookSnapshots = await getLatestSnapshotsByProvider("MYFXBOOK", Array.from(sentimentSymbols));
    myfxbookPositioningBySymbol = myfxbookSnapshots.reduce<Record<string, MyfxbookPositioning | undefined>>(
      (acc, snapshot) => {
        acc[snapshot.symbol] =
          parseMyfxbookPositioning(snapshot.raw_payload, snapshot.timestamp_utc) ?? undefined;
        return acc;
      },
      {},
    );
  } catch {}

  const sentimentPayloadEntries = await Promise.all(
    selectedWeeks.map(async ({ reportDate: currentReportDate, weekOpenUtc }) => [
      currentReportDate,
      await buildSentimentPayloadForWeek(
        weekOpenUtc,
        sentimentSymbols,
        (weeklyReturnsByReport.get(currentReportDate) ?? []).map((row) => ({
          symbol: row.symbol,
          returnPct: row.returnPct,
        })),
      ),
    ] as const),
  );
  const sentimentDataByReport = Object.fromEntries(sentimentPayloadEntries) as Record<
    string,
    DashboardSentimentPayload
  >;

  const strengthPayloadEntries = await Promise.all(
    selectedWeeks.map(async ({ reportDate: currentReportDate, weekOpenUtc }, index) => [
      currentReportDate,
      await buildStrengthPayloadForWeek({
        weekOpenUtc,
        selectedAsset: isAll ? "all" : assetClass,
        weeklyReturns: weeklyReturnsByReport.get(currentReportDate) ?? [],
        previousWeekOpenUtc: selectedWeeks[index + 1]?.weekOpenUtc ?? null,
        totalPairsCount,
      }),
    ] as const),
  );
  const strengthDataByReport = Object.fromEntries(strengthPayloadEntries) as Record<
    string,
    DashboardStrengthPayload
  >;

  return (
    <DashboardLayout>
      {/* Guardrail: Data week/bias/view changes should switch this preloaded
          payload locally in DashboardViewSection, not rerun the dashboard page. */}
      <DashboardViewSection
        assetOptions={assetClasses.map((asset) => ({
          id: asset.id,
          label: asset.label,
        }))}
        selectedAsset={selectedAsset}
        reportOptions={reportOptions}
        initialReport={selectedReportDate}
        initialBias={biasMode}
        initialView={view}
        currentWeekOpenUtc={currentWeekOpen}
        cotDataByReport={cotDataByReport}
        sentimentDataByReport={sentimentDataByReport}
        strengthDataByReport={strengthDataByReport}
        myfxbookPositioningBySymbol={myfxbookPositioningBySymbol}
      />
    </DashboardLayout>
  );
}
