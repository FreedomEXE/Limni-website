export const COT_MARKETS = {
  AUD: { marketName: "AUSTRALIAN DOLLAR" },
  CAD: { marketName: "CANADIAN DOLLAR" },
  CHF: { marketName: "SWISS FRANC" },
  EUR: { marketName: "EURO FX" },
  GBP: { marketName: "BRITISH POUND" },
  JPY: { marketName: "JAPANESE YEN" },
  NZD: { marketName: "NZ DOLLAR" },
  USD: { marketName: "USD INDEX" },
} as const;

export type SupportedCurrency = keyof typeof COT_MARKETS;

export const SUPPORTED_CURRENCIES = Object.keys(
  COT_MARKETS,
) as SupportedCurrency[];

export const COT_VARIANT =
  process.env.COT_VARIANT && process.env.COT_VARIANT.length > 0
    ? process.env.COT_VARIANT
    : "FutOnly";
