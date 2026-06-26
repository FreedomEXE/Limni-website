import { DateTime } from "luxon";

import { query } from "@database/db/client";
import { PAIRS_BY_ASSET_CLASS } from "@engine/contracts/cotPairs";
import { MAJOR_CURRENCIES, type MajorCurrency } from "@engine/contracts/currencyStrength";
import { getFridayFreezeTargetUtc } from "@engine/contracts/fridayFreeze";
import { normalizeWeekOpenUtc } from "@engine/contracts/weekAnchor";
import {
  attachResearchDecisionManifestHash,
  RESEARCH_DECISION_MANIFEST_VERSION,
  type ResearchDecisionManifest,
  type ResearchDecisionRow,
  type ResearchDecisionSide,
} from "@engine/research/decisionManifest";
import { sha256Stable } from "@engine/research/hash";

export const GATE57B_GATE_ID = "Gate 57B: friday-strength-15w-relative-lifecycle";
export const GATE57B_HYPOTHESIS_ID = "friday_strength_15w_relative_lifecycle";
export const GATE57B_SIGNAL_VERSION = "friday_relative_strength_15w_v1";
export const GATE57B_FEATURE_BUNDLE_ID = "gate57b_friday_relative_strength_15w_v1";
export const GATE55E_PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
export const GATE57B_DEFAULT_FROM_WEEK = "2019-01-07T00:00:00.000Z";
export const GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE = "2026-06-08T00:00:00.000Z";
export const GATE57B_LOOKBACK_WEEKS = 15;

const CLOSE_LOOKBACK_MINUTES = 2880;
const FX_PAIRS = PAIRS_BY_ASSET_CLASS.fx
  .map((row) => ({
    pair: row.pair.toUpperCase(),
    base: row.base.toUpperCase() as MajorCurrency,
    quote: row.quote.toUpperCase() as MajorCurrency,
  }))
  .sort((left, right) => left.pair.localeCompare(right.pair));

const FX_SYMBOLS = FX_PAIRS.map((row) => row.pair);

export type Gate57BFrs15ManifestSignalId =
  | "parent_selected"
  | "parent_fade"
  | "compressed_selected"
  | "middle_selected"
  | "extreme_selected"
  | "no_extreme_selected"
  | "persistent_selected"
  | "flip_selected";

export type Gate57BFrs15BuildOptions = {
  fromWeek?: string;
  toWeekExclusive?: string;
  lookbackWeeks?: number;
  closeLookbackMinutes?: number;
  signalIds?: Gate57BFrs15ManifestSignalId[];
};

export type Gate57BFrs15CurrencyScore = {
  currency: MajorCurrency;
  rawAverageLogReturnPct: number;
  normalizedScore: number;
  rankStrongestFirst: number;
};

export type Gate57BFrs15PairDecision = {
  weekOpenUtc: string;
  symbol: string;
  selectedSide: ResearchDecisionSide;
  decisionTimestampUtc: string;
  lookbackTimestampUtc: string;
  currentCloseTimeUtc: string;
  lookbackCloseTimeUtc: string;
  baseCurrency: MajorCurrency;
  quoteCurrency: MajorCurrency;
  baseScore: number;
  quoteScore: number;
  scoreSpread: number;
  absScoreSpread: number;
  pairLogReturnPct: number;
  lifecycleBucket: "compressed" | "middle" | "extreme";
  phaseBucket: "initial" | "persistent" | "flip";
  tiePolicy: "score_spread" | "carry_previous";
};

export type Gate57BFrs15WeekState = {
  weekOpenUtc: string;
  decisionTimestampUtc: string;
  lookbackTimestampUtc: string;
  retainedRows: number;
  missingReason: string | null;
  currencies: Gate57BFrs15CurrencyScore[];
  decisions: Gate57BFrs15PairDecision[];
};

export type Gate57BFrs15ShapeValidation = {
  passed: boolean;
  signalId: Gate57BFrs15ManifestSignalId;
  rows: number;
  weeks: number;
  longRows: number;
  shortRows: number;
  duplicateRows: string[];
  nonFullParentWeeks: string[];
};

export type Gate57BFrs15ManifestBuild = {
  manifests: Record<Gate57BFrs15ManifestSignalId, ResearchDecisionManifest>;
  source: {
    weeks: string[];
    supportedWeeks: Gate57BFrs15WeekState[];
    unsupportedWeeks: Gate57BFrs15WeekState[];
    decisions: Gate57BFrs15PairDecision[];
    lookbackWeeks: number;
    closeLookbackMinutes: number;
    priceLookupRequests: number;
    missingPriceLookups: number;
    shape: Record<Gate57BFrs15ManifestSignalId, Gate57BFrs15ShapeValidation>;
  };
};

type PriceLookupRow = {
  requested_time_utc: Date | string;
  symbol: string;
  bar_close_utc: Date | string | null;
  close_price: number | string | null;
};

type PriceLookup = {
  requestedTimeUtc: string;
  symbol: string;
  closeTimeUtc: string | null;
  closePrice: number | null;
};

function normalizeWeek(value: string, field: string) {
  const normalized = normalizeWeekOpenUtc(value);
  if (normalized) return normalized;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) throw new Error(`Invalid ${field}: ${value}`);
  return parsed.toUTC().toISO() ?? value;
}

function isoUtc(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function round(value: number | null | undefined, digits = 8) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function generateWeeks(fromWeek: string, toWeekExclusive: string) {
  const from = DateTime.fromISO(normalizeWeek(fromWeek, "fromWeek"), { zone: "utc" });
  const to = DateTime.fromISO(normalizeWeek(toWeekExclusive, "toWeekExclusive"), { zone: "utc" });
  if (!from.isValid || !to.isValid || to <= from) {
    throw new Error(`Invalid Gate 57B week range: from=${fromWeek} to=${toWeekExclusive}`);
  }
  const weeks: string[] = [];
  for (let cursor = from; cursor.toMillis() < to.toMillis(); cursor = cursor.plus({ weeks: 1 })) {
    const raw = cursor.toUTC().toISO() ?? cursor.toJSDate().toISOString();
    weeks.push(normalizeWeekOpenUtc(raw) ?? raw);
  }
  return [...new Set(weeks)];
}

function lookbackWeekOpen(weekOpenUtc: string, lookbackWeeks: number) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!parsed.isValid) throw new Error(`Invalid weekOpenUtc: ${weekOpenUtc}`);
  const raw = parsed.minus({ weeks: lookbackWeeks }).toUTC().toISO() ?? weekOpenUtc;
  return normalizeWeekOpenUtc(raw) ?? raw;
}

function fridayFreezeForWeek(weekOpenUtc: string) {
  return new Date(getFridayFreezeTargetUtc(weekOpenUtc)).toISOString();
}

function priceKey(requestedTimeUtc: string, symbol: string) {
  return `${requestedTimeUtc}|${symbol.toUpperCase()}`;
}

async function readFridayClosePrices(options: {
  requestedTimesUtc: string[];
  symbols: string[];
  closeLookbackMinutes: number;
}) {
  const rows = await query<PriceLookupRow>(
    `WITH request_times AS (
        SELECT unnest($1::timestamptz[]) AS requested_time_utc
      ),
      request_symbols AS (
        SELECT unnest($2::text[]) AS symbol
      )
      SELECT
        request_times.requested_time_utc,
        request_symbols.symbol,
        price.bar_close_utc,
        price.close_price
      FROM request_times
      CROSS JOIN request_symbols
      LEFT JOIN LATERAL (
        SELECT bar_close_utc, close_price
          FROM canonical_price_bars
         WHERE asset_class = 'fx'
           AND timeframe = '1m'
           AND symbol = request_symbols.symbol
           AND bar_open_utc < request_times.requested_time_utc
           AND bar_open_utc >= request_times.requested_time_utc - ($3::int * interval '1 minute')
           AND bar_close_utc <= request_times.requested_time_utc
         ORDER BY bar_open_utc DESC
         LIMIT 1
      ) price ON true
      ORDER BY request_times.requested_time_utc ASC, request_symbols.symbol ASC`,
    [options.requestedTimesUtc, options.symbols, options.closeLookbackMinutes],
  );

  const prices = new Map<string, PriceLookup>();
  for (const row of rows) {
    const requestedTimeUtc = isoUtc(row.requested_time_utc);
    if (!requestedTimeUtc) continue;
    const symbol = row.symbol.toUpperCase();
    prices.set(priceKey(requestedTimeUtc, symbol), {
      requestedTimeUtc,
      symbol,
      closeTimeUtc: isoUtc(row.bar_close_utc),
      closePrice: row.close_price === null ? null : Number(row.close_price),
    });
  }
  return prices;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizedCurrencyScores(rawScores: Record<MajorCurrency, number>): Gate57BFrs15CurrencyScore[] {
  const rows = MAJOR_CURRENCIES.map((currency) => ({
    currency,
    rawAverageLogReturnPct: rawScores[currency],
  }));
  const values = rows.map((row) => row.rawAverageLogReturnPct);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const ranked = [...rows].sort((left, right) => {
    const scoreDelta = right.rawAverageLogReturnPct - left.rawAverageLogReturnPct;
    return Math.abs(scoreDelta) > 1e-12 ? scoreDelta : left.currency.localeCompare(right.currency);
  });
  const rankByCurrency = new Map(ranked.map((row, index) => [row.currency, index + 1]));

  return rows
    .map((row) => ({
      currency: row.currency,
      rawAverageLogReturnPct: round(row.rawAverageLogReturnPct, 8) ?? row.rawAverageLogReturnPct,
      normalizedScore: span > 1e-12 ? round(((row.rawAverageLogReturnPct - min) / span) * 100, 8) ?? 50 : 50,
      rankStrongestFirst: rankByCurrency.get(row.currency) ?? 0,
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

function classifyLifecycle(decisions: Gate57BFrs15PairDecision[]) {
  const ordered = [...decisions].sort((left, right) => {
    const delta = left.absScoreSpread - right.absScoreSpread;
    return Math.abs(delta) > 1e-12 ? delta : left.symbol.localeCompare(right.symbol);
  });
  const compressed = new Set(ordered.slice(0, 7).map((row) => row.symbol));
  const extreme = new Set(ordered.slice(-7).map((row) => row.symbol));

  return decisions.map((decision) => ({
    ...decision,
    lifecycleBucket: compressed.has(decision.symbol)
      ? "compressed" as const
      : extreme.has(decision.symbol)
        ? "extreme" as const
        : "middle" as const,
  }));
}

function opposite(side: ResearchDecisionSide): ResearchDecisionSide {
  return side === "LONG" ? "SHORT" : "LONG";
}

function candidateIncludes(signalId: Gate57BFrs15ManifestSignalId, decision: Gate57BFrs15PairDecision) {
  switch (signalId) {
    case "parent_selected":
    case "parent_fade":
      return true;
    case "compressed_selected":
      return decision.lifecycleBucket === "compressed";
    case "middle_selected":
      return decision.lifecycleBucket === "middle";
    case "extreme_selected":
      return decision.lifecycleBucket === "extreme";
    case "no_extreme_selected":
      return decision.lifecycleBucket !== "extreme";
    case "persistent_selected":
      return decision.phaseBucket === "persistent";
    case "flip_selected":
      return decision.phaseBucket === "flip";
    default:
      return false;
  }
}

function candidateSide(signalId: Gate57BFrs15ManifestSignalId, side: ResearchDecisionSide) {
  return signalId === "parent_fade" ? opposite(side) : side;
}

function candidateScope(signalId: Gate57BFrs15ManifestSignalId) {
  return `fx_28pair_weekly_friday_relative_strength_15w_${signalId}`;
}

function candidateDescription(signalId: Gate57BFrs15ManifestSignalId) {
  switch (signalId) {
    case "parent_selected":
      return "All supported Friday 15-week relative Strength selected rows.";
    case "parent_fade":
      return "Opposite side of all supported Friday 15-week relative Strength rows.";
    case "compressed_selected":
      return "Bottom 7 of 28 weekly absolute score-spread rows; selected side.";
    case "middle_selected":
      return "Middle 14 of 28 weekly absolute score-spread rows; selected side.";
    case "extreme_selected":
      return "Top 7 of 28 weekly absolute score-spread rows; selected side.";
    case "no_extreme_selected":
      return "Parent selected rows excluding the top weekly absolute score-spread quartile.";
    case "persistent_selected":
      return "Rows whose selected side matches the previous supported Friday side for the same pair.";
    case "flip_selected":
      return "Rows whose selected side flips versus the previous supported Friday side for the same pair.";
    default:
      return signalId;
  }
}

function buildRows(signalId: Gate57BFrs15ManifestSignalId, decisions: Gate57BFrs15PairDecision[]): ResearchDecisionRow[] {
  return decisions
    .filter((decision) => candidateIncludes(signalId, decision))
    .map((decision) => ({
      row_id: `gate57b_${signalId}_${decision.weekOpenUtc.slice(0, 10)}_${decision.symbol}`,
      week_open_utc: decision.weekOpenUtc,
      symbol: decision.symbol,
      side: candidateSide(signalId, decision.selectedSide),
      decision_timestamp_utc: decision.decisionTimestampUtc,
      source_metadata: {
        source_gate: GATE57B_GATE_ID,
        source_signal: signalId,
        selected_side: decision.selectedSide,
        requested_friday_freeze_utc: decision.decisionTimestampUtc,
        current_close_time_utc: decision.currentCloseTimeUtc,
        lookback_friday_freeze_utc: decision.lookbackTimestampUtc,
        lookback_close_time_utc: decision.lookbackCloseTimeUtc,
        base_currency: decision.baseCurrency,
        quote_currency: decision.quoteCurrency,
        lifecycle_bucket: decision.lifecycleBucket,
        phase_bucket: decision.phaseBucket,
        tie_policy: decision.tiePolicy,
      },
      signal_scores: {
        base_score: round(decision.baseScore),
        quote_score: round(decision.quoteScore),
        score_spread: round(decision.scoreSpread),
        abs_score_spread: round(decision.absScoreSpread),
        pair_log_return_pct_15w: round(decision.pairLogReturnPct),
      },
      bucket_id: `${decision.lifecycleBucket}_${decision.phaseBucket}`,
      regime_id: null,
    }));
}

function buildConfigHash(options: {
  signalId: Gate57BFrs15ManifestSignalId;
  fromWeek: string;
  toWeekExclusive: string;
  lookbackWeeks: number;
  closeLookbackMinutes: number;
}) {
  return sha256Stable({
    gate_id: GATE57B_GATE_ID,
    signal_id: options.signalId,
    signal_version: GATE57B_SIGNAL_VERSION,
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    feature_bundle_id: GATE57B_FEATURE_BUNDLE_ID,
    from_week: options.fromWeek,
    to_week_exclusive: options.toWeekExclusive,
    lookback_weeks: options.lookbackWeeks,
    close_lookup: "latest_1m_bar_close_at_or_before_friday_freeze",
    close_lookback_minutes: options.closeLookbackMinutes,
    currency_score: "average_oriented_15w_pair_log_return_pct_then_weekly_minmax_0_100",
    lifecycle_buckets: "weekly_abs_score_spread_bottom7_middle14_top7",
    phase_buckets: "initial_persistent_flip_vs_previous_supported_friday",
    pairs: FX_SYMBOLS,
    currencies: MAJOR_CURRENCIES,
  });
}

function validateShape(
  signalId: Gate57BFrs15ManifestSignalId,
  manifest: ResearchDecisionManifest,
): Gate57BFrs15ShapeValidation {
  const duplicateRows: string[] = [];
  const seen = new Set<string>();
  const rowsByWeek = new Map<string, number>();
  for (const row of manifest.decisions) {
    const key = `${row.week_open_utc}|${row.symbol}`;
    if (seen.has(key)) duplicateRows.push(key);
    seen.add(key);
    rowsByWeek.set(row.week_open_utc, (rowsByWeek.get(row.week_open_utc) ?? 0) + 1);
  }
  const parentSignals: Gate57BFrs15ManifestSignalId[] = ["parent_selected", "parent_fade"];
  const nonFullParentWeeks = parentSignals.includes(signalId)
    ? [...rowsByWeek.entries()].filter(([, count]) => count !== 28).map(([week]) => week)
    : [];
  return {
    passed: duplicateRows.length === 0 && nonFullParentWeeks.length === 0,
    signalId,
    rows: manifest.decisions.length,
    weeks: rowsByWeek.size,
    longRows: manifest.decisions.filter((row) => row.side === "LONG").length,
    shortRows: manifest.decisions.filter((row) => row.side === "SHORT").length,
    duplicateRows,
    nonFullParentWeeks,
  };
}

function buildManifest(options: {
  signalId: Gate57BFrs15ManifestSignalId;
  decisions: Gate57BFrs15PairDecision[];
  supportedWeeks: string[];
  fromWeek: string;
  toWeekExclusive: string;
  lookbackWeeks: number;
  closeLookbackMinutes: number;
}) {
  const rows = buildRows(options.signalId, options.decisions);
  const manifest: ResearchDecisionManifest = {
    manifest_id: `gate57b_friday_relative_strength_15w_${options.signalId}_manifest_v1`,
    manifest_version: RESEARCH_DECISION_MANIFEST_VERSION,
    gate_id: GATE57B_GATE_ID,
    hypothesis_id: GATE57B_HYPOTHESIS_ID,
    signal_id: `gate57b_frs15_${options.signalId}`,
    signal_version: GATE57B_SIGNAL_VERSION,
    decision_scope: candidateScope(options.signalId),
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    feature_bundle_id: GATE57B_FEATURE_BUNDLE_ID,
    source_context_ids: [
      "docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md",
      "docs/research/gates/gate57/GATE57A0B_DURABLE_PAIR_WEEK_PATH_OUTCOME_WAREHOUSE_2026-06-26.md",
    ],
    universe: {
      asset_class: "fx",
      symbols: FX_SYMBOLS,
    },
    week_range: {
      from_week_open_utc: options.supportedWeeks[0] ?? options.fromWeek,
      to_week_open_utc: options.supportedWeeks.at(-1) ?? options.toWeekExclusive,
    },
    source_metadata: {
      source_gate: GATE57B_GATE_ID,
      description: candidateDescription(options.signalId),
      price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
      source_table: "canonical_price_bars",
      source_timeframe: "1m",
      friday_only: true,
      open_confirmation_used: false,
      return_method: "15-week log return, expressed as percent",
      currency_isolation: "each major averaged against its 7 related FX crosses",
      score_normalization: "weekly 8-currency min-max normalization to 0-100",
      direction_rule: "base normalized score greater than quote normalized score selects LONG; lower selects SHORT",
      tie_rule: "carry previous supported Friday side for the same pair",
      lookback_weeks: options.lookbackWeeks,
      close_lookup: `latest 1m bar close at or before Friday freeze within ${options.closeLookbackMinutes} minutes`,
    },
    config_hash: buildConfigHash(options),
    decisions: rows,
  };
  return attachResearchDecisionManifestHash(manifest);
}

function buildWeekState(options: {
  weekOpenUtc: string;
  prices: Map<string, PriceLookup>;
  previousSideBySymbol: Map<string, ResearchDecisionSide>;
  lookbackWeeks: number;
}) {
  const decisionTimestampUtc = fridayFreezeForWeek(options.weekOpenUtc);
  const lookbackTimestampUtc = fridayFreezeForWeek(lookbackWeekOpen(options.weekOpenUtc, options.lookbackWeeks));
  const pairReturns = new Map<string, {
    symbol: string;
    base: MajorCurrency;
    quote: MajorCurrency;
    pairLogReturnPct: number;
    currentCloseTimeUtc: string;
    lookbackCloseTimeUtc: string;
  }>();
  const missing: string[] = [];

  for (const pair of FX_PAIRS) {
    const current = options.prices.get(priceKey(decisionTimestampUtc, pair.pair));
    const lookback = options.prices.get(priceKey(lookbackTimestampUtc, pair.pair));
    if (
      !current?.closeTimeUtc ||
      !lookback?.closeTimeUtc ||
      current.closePrice === null ||
      lookback.closePrice === null ||
      !(current.closePrice > 0) ||
      !(lookback.closePrice > 0)
    ) {
      missing.push(pair.pair);
      continue;
    }
    pairReturns.set(pair.pair, {
      symbol: pair.pair,
      base: pair.base,
      quote: pair.quote,
      pairLogReturnPct: Math.log(current.closePrice / lookback.closePrice) * 100,
      currentCloseTimeUtc: current.closeTimeUtc,
      lookbackCloseTimeUtc: lookback.closeTimeUtc,
    });
  }

  if (missing.length > 0) {
    return {
      weekOpenUtc: options.weekOpenUtc,
      decisionTimestampUtc,
      lookbackTimestampUtc,
      retainedRows: 0,
      missingReason: `missing_pair_prices:${missing.join(",")}`,
      currencies: [],
      decisions: [],
    } satisfies Gate57BFrs15WeekState;
  }

  const rawScores = Object.fromEntries(MAJOR_CURRENCIES.map((currency) => [currency, 0])) as Record<MajorCurrency, number>;
  for (const currency of MAJOR_CURRENCIES) {
    const values = [...pairReturns.values()]
      .filter((row) => row.base === currency || row.quote === currency)
      .map((row) => row.base === currency ? row.pairLogReturnPct : -row.pairLogReturnPct);
    if (values.length !== 7) {
      return {
        weekOpenUtc: options.weekOpenUtc,
        decisionTimestampUtc,
        lookbackTimestampUtc,
        retainedRows: 0,
        missingReason: `missing_currency_isolation:${currency}:${values.length}/7`,
        currencies: [],
        decisions: [],
      } satisfies Gate57BFrs15WeekState;
    }
    rawScores[currency] = average(values);
  }

  const currencies = normalizedCurrencyScores(rawScores);
  const scoreByCurrency = new Map(currencies.map((row) => [row.currency, row.normalizedScore]));
  const draftDecisions: Gate57BFrs15PairDecision[] = [];

  for (const pair of FX_PAIRS) {
    const pairReturn = pairReturns.get(pair.pair);
    const baseScore = scoreByCurrency.get(pair.base);
    const quoteScore = scoreByCurrency.get(pair.quote);
    if (!pairReturn || baseScore === undefined || quoteScore === undefined) continue;
    const scoreSpread = baseScore - quoteScore;
    const previousSide = options.previousSideBySymbol.get(pair.pair) ?? null;
    const selectedSide: ResearchDecisionSide = scoreSpread > 0
      ? "LONG"
      : scoreSpread < 0
        ? "SHORT"
        : previousSide ?? (pairReturn.pairLogReturnPct >= 0 ? "LONG" : "SHORT");
    const phaseBucket = previousSide === null ? "initial" : previousSide === selectedSide ? "persistent" : "flip";
    draftDecisions.push({
      weekOpenUtc: options.weekOpenUtc,
      symbol: pair.pair,
      selectedSide,
      decisionTimestampUtc,
      lookbackTimestampUtc,
      currentCloseTimeUtc: pairReturn.currentCloseTimeUtc,
      lookbackCloseTimeUtc: pairReturn.lookbackCloseTimeUtc,
      baseCurrency: pair.base,
      quoteCurrency: pair.quote,
      baseScore,
      quoteScore,
      scoreSpread,
      absScoreSpread: Math.abs(scoreSpread),
      pairLogReturnPct: pairReturn.pairLogReturnPct,
      lifecycleBucket: "middle",
      phaseBucket,
      tiePolicy: scoreSpread === 0 ? "carry_previous" : "score_spread",
    });
  }

  const decisions = classifyLifecycle(draftDecisions);
  for (const decision of decisions) {
    options.previousSideBySymbol.set(decision.symbol, decision.selectedSide);
  }

  return {
    weekOpenUtc: options.weekOpenUtc,
    decisionTimestampUtc,
    lookbackTimestampUtc,
    retainedRows: decisions.length,
    missingReason: decisions.length === 28 ? null : `incomplete_decisions:${decisions.length}/28`,
    currencies,
    decisions,
  } satisfies Gate57BFrs15WeekState;
}

export async function buildGate57BFridayRelativeStrength15wManifests(
  rawOptions: Gate57BFrs15BuildOptions = {},
): Promise<Gate57BFrs15ManifestBuild> {
  const fromWeek = normalizeWeek(rawOptions.fromWeek ?? GATE57B_DEFAULT_FROM_WEEK, "fromWeek");
  const toWeekExclusive = normalizeWeek(
    rawOptions.toWeekExclusive ?? GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE,
    "toWeekExclusive",
  );
  const lookbackWeeks = Math.max(1, Math.floor(rawOptions.lookbackWeeks ?? GATE57B_LOOKBACK_WEEKS));
  const closeLookbackMinutes = Math.max(
    1,
    Math.floor(rawOptions.closeLookbackMinutes ?? CLOSE_LOOKBACK_MINUTES),
  );
  const signalIds = rawOptions.signalIds && rawOptions.signalIds.length > 0
    ? [...new Set(rawOptions.signalIds)]
    : [
        "parent_selected",
        "parent_fade",
        "compressed_selected",
        "middle_selected",
        "extreme_selected",
        "no_extreme_selected",
        "persistent_selected",
        "flip_selected",
      ] as Gate57BFrs15ManifestSignalId[];
  const weeks = generateWeeks(fromWeek, toWeekExclusive);
  const requestedTimes = new Set<string>();
  for (const week of weeks) {
    requestedTimes.add(fridayFreezeForWeek(week));
    requestedTimes.add(fridayFreezeForWeek(lookbackWeekOpen(week, lookbackWeeks)));
  }
  const prices = await readFridayClosePrices({
    requestedTimesUtc: [...requestedTimes].sort(),
    symbols: FX_SYMBOLS,
    closeLookbackMinutes,
  });
  const missingPriceLookups = [...prices.values()].filter((row) => !row.closeTimeUtc || row.closePrice === null).length;
  const previousSideBySymbol = new Map<string, ResearchDecisionSide>();
  const supportedWeeks: Gate57BFrs15WeekState[] = [];
  const unsupportedWeeks: Gate57BFrs15WeekState[] = [];

  for (const week of weeks) {
    const state = buildWeekState({
      weekOpenUtc: week,
      prices,
      previousSideBySymbol,
      lookbackWeeks,
    });
    if (state.missingReason === null && state.retainedRows === 28) supportedWeeks.push(state);
    else unsupportedWeeks.push(state);
  }

  const decisions = supportedWeeks.flatMap((week) => week.decisions);
  const supportedWeekIds = supportedWeeks.map((week) => week.weekOpenUtc);
  const manifestEntries = signalIds.map((signalId) => {
    const manifest = buildManifest({
      signalId,
      decisions,
      supportedWeeks: supportedWeekIds,
      fromWeek,
      toWeekExclusive,
      lookbackWeeks,
      closeLookbackMinutes,
    });
    return [signalId, manifest] as const;
  });
  const manifests = Object.fromEntries(manifestEntries) as Record<Gate57BFrs15ManifestSignalId, ResearchDecisionManifest>;
  const shape = Object.fromEntries(
    manifestEntries.map(([signalId, manifest]) => [signalId, validateShape(signalId, manifest)]),
  ) as Record<Gate57BFrs15ManifestSignalId, Gate57BFrs15ShapeValidation>;

  return {
    manifests,
    source: {
      weeks,
      supportedWeeks,
      unsupportedWeeks,
      decisions,
      lookbackWeeks,
      closeLookbackMinutes,
      priceLookupRequests: requestedTimes.size * FX_SYMBOLS.length,
      missingPriceLookups,
      shape,
    },
  };
}
