/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/lib/performance/gatedSetupsDefault.ts
 *
 * Description:
 * Tracked fallback for current-week gated setup board when runtime report files
 * are unavailable in deployed environments.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export const DEFAULT_GATED_SETUPS_BOARD = {
  "generated_utc": "2026-03-16T19:05:10.586Z",
  "current_week_open_utc": "2026-03-15T23:00:00.000Z",
  "weeks_used_for_stability": [
    "2026-03-15T23:00:00.000Z",
    "2026-03-08T23:00:00.000Z",
    "2026-03-02T00:00:00.000Z",
    "2026-02-23T00:00:00.000Z",
    "2026-02-16T00:00:00.000Z",
    "2026-02-09T00:00:00.000Z",
    "2026-02-02T00:00:00.000Z",
    "2026-01-26T00:00:00.000Z"
  ],
  "signals": [
    {
      "assetClass": "indices",
      "pair": "SPXUSD",
      "dealer": "LONG",
      "commercial": "LONG",
      "sentiment": "LONG",
      "direction": "LONG",
      "tier": "HIGH",
      "gateDecision": "PASS",
      "gateReasons": [
        "COT_PASS"
      ],
      "basePct": 44.642857142857146,
      "quotePct": null,
      "actionable8w": 7,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "crypto",
      "pair": "BTCUSD",
      "dealer": "SHORT",
      "commercial": "SHORT",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "HIGH",
      "gateDecision": "REDUCE",
      "gateReasons": [
        "REDUCE_NEAR_OPPOSING_CLUSTER",
        "REDUCE_NEAR_FIELD_OPPOSING_DENSITY"
      ],
      "basePct": null,
      "quotePct": null,
      "actionable8w": 8,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "crypto",
      "pair": "ETHUSD",
      "dealer": "SHORT",
      "commercial": "SHORT",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "HIGH",
      "gateDecision": "REDUCE",
      "gateReasons": [
        "REDUCE_NEAR_OPPOSING_CLUSTER",
        "REDUCE_NEAR_FIELD_OPPOSING_DENSITY"
      ],
      "basePct": null,
      "quotePct": null,
      "actionable8w": 8,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "fx",
      "pair": "CADCHF",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "PASS",
      "gateReasons": [
        "COT_PASS"
      ],
      "basePct": 1.7857142857142856,
      "quotePct": 21.428571428571427,
      "actionable8w": 6,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "fx",
      "pair": "EURCHF",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "PASS",
      "gateReasons": [
        "COT_PASS"
      ],
      "basePct": 62.5,
      "quotePct": 21.428571428571427,
      "actionable8w": 8,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "indices",
      "pair": "NIKKEIUSD",
      "dealer": "SHORT",
      "commercial": "LONG",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "PASS",
      "gateReasons": [
        "COT_PASS"
      ],
      "basePct": 60.71428571428571,
      "quotePct": null,
      "actionable8w": 7,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "commodities",
      "pair": "XAUUSD",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "PASS",
      "gateReasons": [
        "COT_PASS"
      ],
      "basePct": 3.571428571428571,
      "quotePct": null,
      "actionable8w": 1,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "fx",
      "pair": "EURGBP",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "PASS",
      "gateReasons": [
        "COT_PASS"
      ],
      "basePct": 62.5,
      "quotePct": 10.714285714285714,
      "actionable8w": 5,
      "flips8w": 1,
      "consistency8w": 0.6
    },
    {
      "assetClass": "fx",
      "pair": "EURUSD",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "PASS",
      "gateReasons": [
        "COT_PASS"
      ],
      "basePct": 62.5,
      "quotePct": 69.64285714285714,
      "actionable8w": 4,
      "flips8w": 1,
      "consistency8w": 0.5
    },
    {
      "assetClass": "indices",
      "pair": "NDXUSD",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "REDUCE",
      "gateReasons": [
        "COT_SINGLE_MARKET_MODE_BASE_ONLY",
        "COT_REDUCE_BASE_CROWDED"
      ],
      "basePct": 80.35714285714286,
      "quotePct": null,
      "actionable8w": 7,
      "flips8w": 2,
      "consistency8w": 0.8571428571428571
    },
    {
      "assetClass": "fx",
      "pair": "AUDCHF",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "LONG",
      "direction": "LONG",
      "tier": "MEDIUM",
      "gateDecision": "SKIP",
      "gateReasons": [
        "COT_SKIP_BASE_EXTREME"
      ],
      "basePct": 94.64285714285714,
      "quotePct": 80.35714285714286,
      "actionable8w": 4,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "fx",
      "pair": "AUDNZD",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "LONG",
      "direction": "LONG",
      "tier": "MEDIUM",
      "gateDecision": "SKIP",
      "gateReasons": [
        "COT_SKIP_BASE_EXTREME"
      ],
      "basePct": 94.64285714285714,
      "quotePct": 58.92857142857143,
      "actionable8w": 8,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "fx",
      "pair": "CADJPY",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "LONG",
      "direction": "LONG",
      "tier": "MEDIUM",
      "gateDecision": "SKIP",
      "gateReasons": [
        "COT_SKIP_BASE_EXTREME",
        "COT_SKIP_QUOTE_EXTREME"
      ],
      "basePct": 100,
      "quotePct": 96.42857142857143,
      "actionable8w": 1,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "fx",
      "pair": "EURJPY",
      "dealer": "LONG",
      "commercial": "SHORT",
      "sentiment": "LONG",
      "direction": "LONG",
      "tier": "MEDIUM",
      "gateDecision": "SKIP",
      "gateReasons": [
        "COT_SKIP_QUOTE_EXTREME"
      ],
      "basePct": 39.285714285714285,
      "quotePct": 96.42857142857143,
      "actionable8w": 2,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "fx",
      "pair": "GBPAUD",
      "dealer": "SHORT",
      "commercial": "LONG",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "SKIP",
      "gateReasons": [
        "COT_SKIP_BASE_EXTREME",
        "COT_SKIP_QUOTE_EXTREME"
      ],
      "basePct": 91.07142857142857,
      "quotePct": 94.64285714285714,
      "actionable8w": 8,
      "flips8w": 0,
      "consistency8w": 1
    },
    {
      "assetClass": "fx",
      "pair": "NZDCAD",
      "dealer": "SHORT",
      "commercial": "LONG",
      "sentiment": "SHORT",
      "direction": "SHORT",
      "tier": "MEDIUM",
      "gateDecision": "SKIP",
      "gateReasons": [
        "COT_SKIP_QUOTE_EXTREME"
      ],
      "basePct": 58.92857142857143,
      "quotePct": 100,
      "actionable8w": 5,
      "flips8w": 1,
      "consistency8w": 0.6
    }
  ]
} as const;
