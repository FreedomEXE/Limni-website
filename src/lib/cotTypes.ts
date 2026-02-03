import type { AssetClass } from "./cotMarkets";

export type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";
export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type MarketSnapshot = {
  dealer_long: number;
  dealer_short: number;
  dealer_net: number;
  dealer_bias: Bias;
  commercial_long: number | null;
  commercial_short: number | null;
  commercial_net: number | null;
  commercial_bias: Bias | null;
  blended_long: number;
  blended_short: number;
  blended_net: number;
  blended_bias: Bias;
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
