import type { AssetClass } from "./cotMarkets";

export type PairDefinition = {
  pair: string;
  base: string;
  quote: string;
};

export const PAIRS_BY_ASSET_CLASS: Record<AssetClass, PairDefinition[]> = {
  fx: [
    { pair: "EURUSD", base: "EUR", quote: "USD" },
    { pair: "GBPUSD", base: "GBP", quote: "USD" },
    { pair: "AUDUSD", base: "AUD", quote: "USD" },
    { pair: "NZDUSD", base: "NZD", quote: "USD" },
    { pair: "USDJPY", base: "USD", quote: "JPY" },
    { pair: "USDCHF", base: "USD", quote: "CHF" },
    { pair: "USDCAD", base: "USD", quote: "CAD" },
    { pair: "EURGBP", base: "EUR", quote: "GBP" },
    { pair: "EURJPY", base: "EUR", quote: "JPY" },
    { pair: "EURCHF", base: "EUR", quote: "CHF" },
    { pair: "EURAUD", base: "EUR", quote: "AUD" },
    { pair: "EURNZD", base: "EUR", quote: "NZD" },
    { pair: "EURCAD", base: "EUR", quote: "CAD" },
    { pair: "GBPJPY", base: "GBP", quote: "JPY" },
    { pair: "GBPCHF", base: "GBP", quote: "CHF" },
    { pair: "GBPAUD", base: "GBP", quote: "AUD" },
    { pair: "GBPNZD", base: "GBP", quote: "NZD" },
    { pair: "GBPCAD", base: "GBP", quote: "CAD" },
    { pair: "AUDJPY", base: "AUD", quote: "JPY" },
    { pair: "AUDCHF", base: "AUD", quote: "CHF" },
    { pair: "AUDCAD", base: "AUD", quote: "CAD" },
    { pair: "AUDNZD", base: "AUD", quote: "NZD" },
    { pair: "NZDJPY", base: "NZD", quote: "JPY" },
    { pair: "NZDCHF", base: "NZD", quote: "CHF" },
    { pair: "NZDCAD", base: "NZD", quote: "CAD" },
    { pair: "CADJPY", base: "CAD", quote: "JPY" },
    { pair: "CADCHF", base: "CAD", quote: "CHF" },
    { pair: "CHFJPY", base: "CHF", quote: "JPY" },
  ],
  indices: [
    { pair: "SPXUSD", base: "SPX", quote: "USD" },
    { pair: "NDXUSD", base: "NDX", quote: "USD" },
    { pair: "NIKKEIUSD", base: "NIKKEI", quote: "USD" },
  ],
  crypto: [
    { pair: "BTCUSD", base: "BTC", quote: "USD" },
    { pair: "ETHUSD", base: "ETH", quote: "USD" },
  ],
  commodities: [
    { pair: "XAUUSD", base: "XAU", quote: "USD" },
    { pair: "XAGUSD", base: "XAG", quote: "USD" },
    { pair: "WTIUSD", base: "WTI", quote: "USD" },
  ],
};
