export const MAJOR_CURRENCIES = ["EUR", "USD", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"] as const;
export type MajorCurrency = (typeof MAJOR_CURRENCIES)[number];
