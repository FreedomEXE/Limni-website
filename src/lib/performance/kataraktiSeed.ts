export type KataraktiSeedMarket = "crypto_futures" | "mt5_forex";

export type KataraktiSeedWeekly = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  staticDrawdownPct: number;
};

export type KataraktiSeedSnapshot = {
  market: KataraktiSeedMarket;
  selectedVariantId: string;
  sourceLabel: string;
  totalReturnPct: number;
  maxDrawdownPct: number;
  startingEquityUsd: number;
  weekly: KataraktiSeedWeekly[];
};

export const KATARAKTI_SEED_SNAPSHOTS: Record<KataraktiSeedMarket, KataraktiSeedSnapshot> = {
  crypto_futures: {
    market: "crypto_futures",
    selectedVariantId: "C",
    sourceLabel: "seed:bitget-v2-variant-c",
    totalReturnPct: 112.5397119,
    maxDrawdownPct: 6.185709330844648,
    startingEquityUsd: 100_000,
    weekly: [
      {
        weekOpenUtc: "2026-01-19T00:00:00.000Z",
        returnPct: 22.090064899999998,
        trades: 4,
        wins: 4,
        losses: 0,
        staticDrawdownPct: 0,
      },
      {
        weekOpenUtc: "2026-01-26T00:00:00.000Z",
        returnPct: 33.78201070970191,
        trades: 4,
        wins: 4,
        losses: 0,
        staticDrawdownPct: 0,
      },
      {
        weekOpenUtc: "2026-02-02T00:00:00.000Z",
        returnPct: 28.94525464670582,
        trades: 4,
        wins: 3,
        losses: 0,
        staticDrawdownPct: 0,
      },
      {
        weekOpenUtc: "2026-02-09T00:00:00.000Z",
        returnPct: -6.185709330844648,
        trades: 2,
        wins: 1,
        losses: 1,
        staticDrawdownPct: 6.209,
      },
      {
        weekOpenUtc: "2026-02-16T00:00:00.000Z",
        returnPct: 7.5691360526058595,
        trades: 2,
        wins: 2,
        losses: 0,
        staticDrawdownPct: 0,
      },
    ],
  },
  mt5_forex: {
    market: "mt5_forex",
    selectedVariantId: "tiered__t1t2__weighted",
    sourceLabel: "seed:katarakti-phase2-tiered__t1t2__weighted",
    totalReturnPct: 21.6156683838692,
    maxDrawdownPct: 0.564018892664675,
    startingEquityUsd: 100_000,
    weekly: [
      {
        weekOpenUtc: "2026-01-19T00:00:00.000Z",
        returnPct: 7.048413675526522,
        trades: 3,
        wins: 2,
        losses: 0,
        staticDrawdownPct: 0,
      },
      {
        weekOpenUtc: "2026-01-26T00:00:00.000Z",
        returnPct: 5.484594129974558,
        trades: 5,
        wins: 3,
        losses: 1,
        staticDrawdownPct: 0,
      },
      {
        weekOpenUtc: "2026-02-02T00:00:00.000Z",
        returnPct: 7.399334187098357,
        trades: 6,
        wins: 4,
        losses: 0,
        staticDrawdownPct: 0,
      },
      {
        weekOpenUtc: "2026-02-09T00:00:00.000Z",
        returnPct: -0.564018892664675,
        trades: 8,
        wins: 0,
        losses: 2,
        staticDrawdownPct: 0.564018892664675,
      },
      {
        weekOpenUtc: "2026-02-16T00:00:00.000Z",
        returnPct: 0.8498151797788378,
        trades: 8,
        wins: 2,
        losses: 0,
        staticDrawdownPct: 0,
      },
    ],
  },
};
