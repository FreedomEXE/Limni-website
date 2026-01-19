export type AssetClass = "fx" | "indices" | "crypto" | "commodities";

export type MarketDefinition = {
  id: string;
  label: string;
  marketName: string;
};

export type AssetClassDefinition = {
  id: AssetClass;
  label: string;
  biasLabel: string;
  markets: Record<string, MarketDefinition>;
};

export const COT_ASSET_CLASSES: Record<AssetClass, AssetClassDefinition> = {
  fx: {
    id: "fx",
    label: "FX",
    biasLabel: "Currency",
    markets: {
      AUD: { id: "AUD", label: "AUD", marketName: "AUSTRALIAN DOLLAR" },
      CAD: { id: "CAD", label: "CAD", marketName: "CANADIAN DOLLAR" },
      CHF: { id: "CHF", label: "CHF", marketName: "SWISS FRANC" },
      EUR: { id: "EUR", label: "EUR", marketName: "EURO FX" },
      GBP: { id: "GBP", label: "GBP", marketName: "BRITISH POUND" },
      JPY: { id: "JPY", label: "JPY", marketName: "JAPANESE YEN" },
      NZD: { id: "NZD", label: "NZD", marketName: "NZ DOLLAR" },
      USD: { id: "USD", label: "USD", marketName: "USD INDEX" },
    },
  },
  indices: {
    id: "indices",
    label: "Indices",
    biasLabel: "Index",
    markets: {
      SPX: {
        id: "SPX",
        label: "S&P 500",
        marketName: "E-MINI S&P 500",
      },
      NDX: {
        id: "NDX",
        label: "Nasdaq 100",
        marketName: "NASDAQ-100 Consolidated",
      },
      NIKKEI: {
        id: "NIKKEI",
        label: "Nikkei 225",
        marketName: "NIKKEI STOCK AVERAGE",
      },
    },
  },
  crypto: {
    id: "crypto",
    label: "Crypto",
    biasLabel: "Crypto",
    markets: {
      BTC: { id: "BTC", label: "Bitcoin", marketName: "BITCOIN" },
      ETH: {
        id: "ETH",
        label: "Ether",
        marketName: "ETHER CASH SETTLED",
      },
    },
  },
  commodities: {
    id: "commodities",
    label: "Commodities",
    biasLabel: "Commodity",
    markets: {
      XAU: { id: "XAU", label: "Gold", marketName: "GOLD" },
      XAG: { id: "XAG", label: "Silver", marketName: "SILVER" },
      WTI: {
        id: "WTI",
        label: "WTI Crude",
        marketName: "CRUDE OIL, LIGHT SWEET-WTI",
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
