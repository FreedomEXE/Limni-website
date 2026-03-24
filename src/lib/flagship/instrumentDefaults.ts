/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: instrumentDefaults.ts
 *
 * Description:
 * Default per-instrument sizing specifications for the flagship matrix.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type InstrumentSpec = {
  pair: string;
  contractSize: number;
  pipSize: number;
  pipValuePerLot: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  defaultLeverage: number;
  swapLong: number;
  swapShort: number;
};

const FX_BASE_DEFAULTS = {
  contractSize: 100000,
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  defaultLeverage: 100,
  swapLong: 0,
  swapShort: 0,
} satisfies Omit<InstrumentSpec, "pair" | "pipSize" | "pipValuePerLot">;

const FX_PIP_VALUE_BY_QUOTE: Record<string, number> = {
  USD: 10,
  JPY: 6.5,
  CHF: 11,
  CAD: 7.5,
  GBP: 12.5,
  AUD: 6.5,
  NZD: 6,
};

function normalizePair(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function buildFxSpec(pair: string): InstrumentSpec {
  const normalizedPair = normalizePair(pair);
  const quote = normalizedPair.slice(-3);
  const isJpyQuoted = quote === "JPY";

  return {
    pair: normalizedPair,
    contractSize: FX_BASE_DEFAULTS.contractSize,
    pipSize: isJpyQuoted ? 0.01 : 0.0001,
    pipValuePerLot: FX_PIP_VALUE_BY_QUOTE[quote] ?? 10,
    minLot: FX_BASE_DEFAULTS.minLot,
    maxLot: FX_BASE_DEFAULTS.maxLot,
    lotStep: FX_BASE_DEFAULTS.lotStep,
    defaultLeverage: FX_BASE_DEFAULTS.defaultLeverage,
    swapLong: 0,
    swapShort: 0,
  };
}

function buildUsdCryptoFallback(pair: string): InstrumentSpec {
  const normalizedPair = normalizePair(pair);
  const isBitcoin = normalizedPair.startsWith("BTC");

  return {
    pair: normalizedPair,
    contractSize: 1,
    pipSize: 0.01,
    pipValuePerLot: 1,
    minLot: isBitcoin ? 0.001 : 0.01,
    maxLot: 100,
    lotStep: isBitcoin ? 0.001 : 0.01,
    defaultLeverage: 10,
    swapLong: 0,
    swapShort: 0,
  };
}

export const INSTRUMENT_DEFAULTS: Record<string, InstrumentSpec> = {
  EURUSD: buildFxSpec("EURUSD"),
  GBPUSD: buildFxSpec("GBPUSD"),
  AUDUSD: buildFxSpec("AUDUSD"),
  NZDUSD: buildFxSpec("NZDUSD"),
  USDJPY: buildFxSpec("USDJPY"),
  USDCHF: buildFxSpec("USDCHF"),
  USDCAD: buildFxSpec("USDCAD"),
  EURGBP: buildFxSpec("EURGBP"),
  EURJPY: buildFxSpec("EURJPY"),
  EURCHF: buildFxSpec("EURCHF"),
  EURAUD: buildFxSpec("EURAUD"),
  EURNZD: buildFxSpec("EURNZD"),
  EURCAD: buildFxSpec("EURCAD"),
  GBPJPY: buildFxSpec("GBPJPY"),
  GBPCHF: buildFxSpec("GBPCHF"),
  GBPAUD: buildFxSpec("GBPAUD"),
  GBPNZD: buildFxSpec("GBPNZD"),
  GBPCAD: buildFxSpec("GBPCAD"),
  AUDJPY: buildFxSpec("AUDJPY"),
  AUDCHF: buildFxSpec("AUDCHF"),
  AUDCAD: buildFxSpec("AUDCAD"),
  AUDNZD: buildFxSpec("AUDNZD"),
  NZDJPY: buildFxSpec("NZDJPY"),
  NZDCHF: buildFxSpec("NZDCHF"),
  NZDCAD: buildFxSpec("NZDCAD"),
  CADJPY: buildFxSpec("CADJPY"),
  CADCHF: buildFxSpec("CADCHF"),
  CHFJPY: buildFxSpec("CHFJPY"),
  SPXUSD: {
    pair: "SPXUSD",
    contractSize: 1,
    pipSize: 0.01,
    pipValuePerLot: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    defaultLeverage: 100,
    swapLong: 0,
    swapShort: 0,
  },
  NDXUSD: {
    pair: "NDXUSD",
    contractSize: 1,
    pipSize: 0.01,
    pipValuePerLot: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    defaultLeverage: 100,
    swapLong: 0,
    swapShort: 0,
  },
  NIKKEIUSD: {
    pair: "NIKKEIUSD",
    contractSize: 1,
    pipSize: 1,
    pipValuePerLot: 0.01,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    defaultLeverage: 100,
    swapLong: 0,
    swapShort: 0,
  },
  BTCUSD: {
    pair: "BTCUSD",
    contractSize: 1,
    pipSize: 0.01,
    pipValuePerLot: 1,
    minLot: 0.001,
    maxLot: 100,
    lotStep: 0.001,
    defaultLeverage: 10,
    swapLong: 0,
    swapShort: 0,
  },
  ETHUSD: {
    pair: "ETHUSD",
    contractSize: 1,
    pipSize: 0.01,
    pipValuePerLot: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    defaultLeverage: 10,
    swapLong: 0,
    swapShort: 0,
  },
  XAUUSD: {
    pair: "XAUUSD",
    contractSize: 100,
    pipSize: 0.01,
    pipValuePerLot: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    defaultLeverage: 50,
    swapLong: 0,
    swapShort: 0,
  },
  XAGUSD: {
    pair: "XAGUSD",
    contractSize: 5000,
    pipSize: 0.001,
    pipValuePerLot: 5,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    defaultLeverage: 50,
    swapLong: 0,
    swapShort: 0,
  },
  WTIUSD: {
    pair: "WTIUSD",
    contractSize: 1000,
    pipSize: 0.01,
    pipValuePerLot: 10,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    defaultLeverage: 50,
    swapLong: 0,
    swapShort: 0,
  },
};

export function getInstrumentSpec(pair: string, overrides?: Partial<InstrumentSpec>): InstrumentSpec {
  const normalizedPair = normalizePair(pair);
  const fallback =
    INSTRUMENT_DEFAULTS[normalizedPair] ??
    (normalizedPair.endsWith("USD") ? buildUsdCryptoFallback(normalizedPair) : buildFxSpec(normalizedPair));

  return {
    ...fallback,
    ...overrides,
    pair: normalizedPair,
  };
}
