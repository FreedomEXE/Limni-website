export type AssetClass = "fx" | "indices" | "crypto" | "commodities";
export type CotSource = "tff" | "legacy" | "disaggregated";

export type MarketDefinition = {
  id: string;
  label: string;
  marketNames: string[];
};

export type AssetClassDefinition = {
  id: AssetClass;
  label: string;
  biasLabel: string;
  positionLabel: string;
  source: CotSource;
  markets: Record<string, MarketDefinition>;
};

export const COT_ASSET_CLASSES: Record<AssetClass, AssetClassDefinition> = {
  fx: {
    id: "fx",
    label: "FX",
    biasLabel: "Currency",
    positionLabel: "Dealer",
    source: "tff",
    markets: {
      AUD: { id: "AUD", label: "AUD", marketNames: ["AUSTRALIAN DOLLAR"] },
      CAD: { id: "CAD", label: "CAD", marketNames: ["CANADIAN DOLLAR"] },
      CHF: { id: "CHF", label: "CHF", marketNames: ["SWISS FRANC"] },
      EUR: { id: "EUR", label: "EUR", marketNames: ["EURO FX"] },
      GBP: { id: "GBP", label: "GBP", marketNames: ["BRITISH POUND"] },
      JPY: { id: "JPY", label: "JPY", marketNames: ["JAPANESE YEN"] },
      NZD: { id: "NZD", label: "NZD", marketNames: ["NZ DOLLAR"] },
      USD: { id: "USD", label: "USD", marketNames: ["USD INDEX"] },
    },
  },
  indices: {
    id: "indices",
    label: "Indices",
    biasLabel: "Index",
    positionLabel: "Dealer",
    source: "tff",
    markets: {
      USD: { id: "USD", label: "USD", marketNames: ["USD INDEX"] },
      SPX: {
        id: "SPX",
        label: "S&P 500",
        marketNames: ["E-MINI S&P 500", "S&P 500 Consolidated"],
      },
      NDX: {
        id: "NDX",
        label: "Nasdaq 100",
        marketNames: ["NASDAQ-100 Consolidated", "NASDAQ MINI"],
      },
      NIKKEI: {
        id: "NIKKEI",
        label: "Nikkei 225",
        marketNames: ["NIKKEI STOCK AVERAGE", "NIKKEI STOCK AVERAGE YEN DENOM"],
      },
    },
  },
  crypto: {
    id: "crypto",
    label: "Crypto",
    biasLabel: "Crypto",
    positionLabel: "Dealer",
    source: "tff",
    markets: {
      USD: { id: "USD", label: "USD", marketNames: ["USD INDEX"] },
      BTC: { id: "BTC", label: "Bitcoin", marketNames: ["BITCOIN"] },
      ETH: {
        id: "ETH",
        label: "Ether",
        marketNames: ["ETHER CASH SETTLED"],
      },
    },
  },
  commodities: {
    id: "commodities",
    label: "Commodities",
    biasLabel: "Commodity",
    positionLabel: "Producer/Merchant",
    source: "disaggregated",
    markets: {
      USD: { id: "USD", label: "USD", marketNames: ["USD INDEX"] },
      XAU: { id: "XAU", label: "Gold", marketNames: ["GOLD"] },
      XAG: { id: "XAG", label: "Silver", marketNames: ["SILVER"] },
      WTI: {
        id: "WTI",
        label: "WTI Crude",
        marketNames: ["CRUDE OIL, LIGHT SWEET-WTI", "WTI FINANCIAL CRUDE OIL"],
      },
    },
  },
};

export const ASSET_CLASS_ORDER: AssetClass[] = [
  "fx",
  "indices",
  "crypto",
  "commodities",
];

export function getAssetClass(value?: string | null): AssetClass {
  if (value && value in COT_ASSET_CLASSES) {
    return value as AssetClass;
  }
  return "fx";
}

export function getAssetClassDefinition(assetClass: AssetClass): AssetClassDefinition {
  return COT_ASSET_CLASSES[assetClass];
}

export function listAssetClasses(): AssetClassDefinition[] {
  return ASSET_CLASS_ORDER.map((id) => COT_ASSET_CLASSES[id]);
}

export const COT_VARIANT =
  process.env.COT_VARIANT && process.env.COT_VARIANT.length > 0
    ? process.env.COT_VARIANT
    : "FutOnly";
