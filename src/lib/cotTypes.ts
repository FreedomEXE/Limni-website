import type { AssetClass } from "./cotMarkets";

export type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";
export type Direction = "LONG" | "SHORT";

export type MarketSnapshot = {
  dealer_long: number;
  dealer_short: number;
  net: number;
  bias: Bias;
};

export type PairSnapshot = {
  direction: Direction;
  base_bias: Bias;
  quote_bias: Bias;
};

export type CotSnapshot = {
  report_date: string;
  last_refresh_utc: string;
  asset_class: AssetClass;
  variant: string;
  currencies: Record<string, MarketSnapshot>;
  pairs: Record<string, PairSnapshot>;
};

export type CotSnapshotResponse = CotSnapshot & {
  trading_allowed: boolean;
  reason: string;
};
