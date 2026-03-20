/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: cryptoUniverse.ts
 *
 * Description:
 * Static Phase 1 crypto universe for the manual matrix board.
 * BTC/ETH sit at the top as anchors, with ranked alts beneath.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type CryptoUniverseTier = "ANCHOR" | "A" | "B";

export type CryptoUniverseEntry = {
  symbol: string;
  bitgetSymbol: string;
  tier: CryptoUniverseTier;
  compositeScore: number;
  btcCorrelation7d: number;
  rank: number;
};

export const CRYPTO_UNIVERSE: CryptoUniverseEntry[] = [
  { symbol: "BTC", bitgetSymbol: "BTCUSDT", tier: "ANCHOR", compositeScore: 0, btcCorrelation7d: 1.0, rank: 0 },
  { symbol: "ETH", bitgetSymbol: "ETHUSDT", tier: "ANCHOR", compositeScore: 0, btcCorrelation7d: 0.95, rank: 0 },
  { symbol: "SOL", bitgetSymbol: "SOLUSDT", tier: "A", compositeScore: 86.68, btcCorrelation7d: 0.881, rank: 1 },
  { symbol: "XRP", bitgetSymbol: "XRPUSDT", tier: "A", compositeScore: 70.82, btcCorrelation7d: 0.809, rank: 2 },
  { symbol: "SUI", bitgetSymbol: "SUIUSDT", tier: "A", compositeScore: 70.45, btcCorrelation7d: 0.873, rank: 3 },
  { symbol: "LINK", bitgetSymbol: "LINKUSDT", tier: "A", compositeScore: 60.9, btcCorrelation7d: 0.863, rank: 4 },
  { symbol: "DOGE", bitgetSymbol: "DOGEUSDT", tier: "A", compositeScore: 59.84, btcCorrelation7d: 0.769, rank: 5 },
  { symbol: "ADA", bitgetSymbol: "ADAUSDT", tier: "A", compositeScore: 59.38, btcCorrelation7d: 0.798, rank: 6 },
  { symbol: "BNB", bitgetSymbol: "BNBUSDT", tier: "A", compositeScore: 57.91, btcCorrelation7d: 0.86, rank: 7 },
  { symbol: "PEPE", bitgetSymbol: "PEPEUSDT", tier: "A", compositeScore: 56.24, btcCorrelation7d: 0.713, rank: 8 },
  { symbol: "UNI", bitgetSymbol: "UNIUSDT", tier: "A", compositeScore: 54.04, btcCorrelation7d: 0.78, rank: 9 },
  { symbol: "AVAX", bitgetSymbol: "AVAXUSDT", tier: "B", compositeScore: 52.33, btcCorrelation7d: 0.813, rank: 10 },
  { symbol: "LTC", bitgetSymbol: "LTCUSDT", tier: "B", compositeScore: 48.56, btcCorrelation7d: 0.814, rank: 11 },
  { symbol: "NEAR", bitgetSymbol: "NEARUSDT", tier: "B", compositeScore: 47.35, btcCorrelation7d: 0.714, rank: 12 },
  { symbol: "HBAR", bitgetSymbol: "HBARUSDT", tier: "B", compositeScore: 45.61, btcCorrelation7d: 0.817, rank: 13 },
];
