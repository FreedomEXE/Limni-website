export type SentimentProvider = "FOREXCLIENTSENTIMENT" | "OANDA" | "MYFXBOOK" | "IG";

export type CrowdingState = "CROWDED_LONG" | "CROWDED_SHORT" | "NEUTRAL";
export type FlipState = "FLIPPED_UP" | "FLIPPED_DOWN" | "FLIPPED_NEUTRAL" | "NONE";

export type ProviderSentiment = {
  symbol: string;
  long_pct: number;
  short_pct: number;
  net: number;
  ratio: number;
  timestamp_utc: string;
  provider: SentimentProvider;
  raw_payload?: unknown;
  fetch_latency_ms?: number;
};

export type SentimentAggregate = {
  symbol: string;
  timestamp_utc: string;
  agg_long_pct: number;
  agg_short_pct: number;
  agg_net: number;
  sources_used: SentimentProvider[];
  confidence_score: number;
  crowding_state: CrowdingState;
  flip_state: FlipState;
};

export type SourceHealth = {
  name: SentimentProvider;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  last_success_at: string;
  last_error: string;
  consecutive_failures: number;
  rate_limit_notes?: string;
};

export type SentimentConfig = {
  weights: Record<SentimentProvider, number>;
  crowding_thresholds: {
    long: number;
    short: number;
  };
  flip_persistence_minutes: number;
  stale_threshold_minutes: number;
};

export const DEFAULT_SENTIMENT_CONFIG: SentimentConfig = {
  weights: {
    FOREXCLIENTSENTIMENT: 0.33,
    OANDA: 0.33,
    MYFXBOOK: 1.0, // Using 1.0 since it's the only working source currently
    IG: 1.0, // Primary source for indices sentiment
  },
  crowding_thresholds: {
    long: 65,
    short: 35,
  },
  flip_persistence_minutes: 10,
  stale_threshold_minutes: 30,
};
