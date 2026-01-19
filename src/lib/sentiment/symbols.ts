export const FX_PAIRS = [
  // Majors
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  // EUR crosses
  "EURGBP",
  "EURJPY",
  "EURCHF",
  "EURAUD",
  "EURCAD",
  "EURNZD",
  // GBP crosses
  "GBPJPY",
  "GBPCHF",
  "GBPAUD",
  "GBPCAD",
  "GBPNZD",
  // JPY crosses
  "AUDJPY",
  "NZDJPY",
  "CADJPY",
  "CHFJPY",
  // AUD crosses
  "AUDCAD",
  "AUDCHF",
  "AUDNZD",
  // NZD crosses
  "NZDCAD",
  "NZDCHF",
  // CAD crosses
  "CADCHF",
] as const;

export const FX_MAJORS = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
] as const;

export const JPY_CROSSES = [
  "CADJPY",
  "CHFJPY",
  "GBPJPY",
  "NZDJPY",
  "USDJPY",
] as const;

export type FxPair = (typeof FX_PAIRS)[number];
export type FxMajor = (typeof FX_MAJORS)[number];

export const INDICES_SYMBOLS = ["SPXUSD", "NDXUSD", "NIKKEIUSD"] as const;
export const CRYPTO_SYMBOLS = ["BTCUSD", "ETHUSD"] as const;
export const COMMODITY_SYMBOLS = ["XAUUSD", "XAGUSD", "WTIUSD"] as const;

export type SentimentAssetClass = "fx" | "indices" | "crypto" | "commodities";

export const SENTIMENT_ASSET_CLASSES: Record<
  SentimentAssetClass,
  { label: string; symbols: readonly string[] }
> = {
  fx: { label: "FX", symbols: FX_PAIRS },
  indices: { label: "Indices", symbols: INDICES_SYMBOLS },
  crypto: { label: "Crypto", symbols: CRYPTO_SYMBOLS },
  commodities: { label: "Commodities", symbols: COMMODITY_SYMBOLS },
};

export const ALL_SENTIMENT_SYMBOLS = [
  ...FX_PAIRS,
  ...INDICES_SYMBOLS,
  ...CRYPTO_SYMBOLS,
  ...COMMODITY_SYMBOLS,
];

export function isMajor(symbol: string): symbol is FxMajor {
  return FX_MAJORS.includes(symbol as FxMajor);
}

export function isJpyCross(symbol: string): boolean {
  return JPY_CROSSES.includes(symbol as (typeof JPY_CROSSES)[number]);
}
