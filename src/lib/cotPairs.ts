import type { SupportedCurrency } from "./cotMarkets";

export type PairDefinition = {
  pair: string;
  base: SupportedCurrency;
  quote: SupportedCurrency;
};

export const PAIRS: PairDefinition[] = [
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
];
