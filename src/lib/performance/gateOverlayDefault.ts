/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/lib/performance/gateOverlayDefault.ts
 *
 * Description:
 * Tracked default gate overlay payload used when runtime report JSON is unavailable.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export const DEFAULT_GATE_OVERLAY_REPORT = {
  "generated_utc": "2026-03-16T16:04:50.442Z",
  "scope": {
    "weeks_used": 8,
    "week_open_utc": [
      "2026-01-19T00:00:00.000Z",
      "2026-01-26T00:00:00.000Z",
      "2026-02-02T00:00:00.000Z",
      "2026-02-09T00:00:00.000Z",
      "2026-02-16T00:00:00.000Z",
      "2026-02-23T00:00:00.000Z",
      "2026-03-02T00:00:00.000Z",
      "2026-03-08T23:00:00.000Z"
    ]
  },
  "assumptions": {
    "reduce_mode": "REDUCE_TREATED_AS_SKIP"
  },
  "comparisons": [
    {
      "strategy": "universal_v1",
      "baseline": {
        "totalReturn": 81.4899,
        "weeks": 8,
        "winRatePct": 87.5,
        "avgWeeklyPct": 10.1862,
        "maxDrawdownPct": 23.22352,
        "trades": 802,
        "tradeWinRatePct": 56.61
      },
      "gated": {
        "totalReturn": 101.1463,
        "weeks": 8,
        "winRatePct": 62.5,
        "avgWeeklyPct": 12.6433,
        "maxDrawdownPct": 1.187662,
        "trades": 390,
        "tradeWinRatePct": 54.1
      },
      "delta": {
        "totalReturnPct": 19.6564,
        "winRatePct": -25,
        "avgWeeklyPct": 2.4571,
        "maxDrawdownPct": -22.035858,
        "trades": -412,
        "tradeWinRatePct": -2.51
      },
      "gateActivity": {
        "skippedTrades": 412,
        "reducedTrades": 0,
        "passedOrNoDataTrades": 390
      },
      "weekly": [
        {
          "baselineReturn": 36.5359,
          "gatedReturn": 29.241375204019352
        },
        {
          "baselineReturn": 26.519699999999993,
          "gatedReturn": 35.464339614213756
        },
        {
          "baselineReturn": 14.69794,
          "gatedReturn": 11.594073412734383
        },
        {
          "baselineReturn": 10.18086,
          "gatedReturn": 13.091531406762233
        },
        {
          "baselineReturn": 9.62048,
          "gatedReturn": -0.30935186386533947
        },
        {
          "baselineReturn": 4.44628,
          "gatedReturn": -0.5637635667236753
        },
        {
          "baselineReturn": 2.7122599999999997,
          "gatedReturn": 13.815755190784547
        },
        {
          "baselineReturn": -23.22352,
          "gatedReturn": -1.187662441960531
        }
      ]
    },
    {
      "strategy": "universal_v2",
      "baseline": {
        "totalReturn": 100.6561,
        "weeks": 8,
        "winRatePct": 87.5,
        "avgWeeklyPct": 12.582,
        "maxDrawdownPct": 25.0634,
        "trades": 445,
        "tradeWinRatePct": 62.47
      },
      "gated": {
        "totalReturn": 105.1834,
        "weeks": 8,
        "winRatePct": 87.5,
        "avgWeeklyPct": 13.1479,
        "maxDrawdownPct": 2.220162,
        "trades": 169,
        "tradeWinRatePct": 63.31
      },
      "delta": {
        "totalReturnPct": 4.5273,
        "winRatePct": 0,
        "avgWeeklyPct": 0.5659,
        "maxDrawdownPct": -22.843238,
        "trades": -276,
        "tradeWinRatePct": 0.84
      },
      "gateActivity": {
        "skippedTrades": 276,
        "reducedTrades": 0,
        "passedOrNoDataTrades": 169
      },
      "weekly": [
        {
          "baselineReturn": 49.0645,
          "gatedReturn": 35.48779109558923
        },
        {
          "baselineReturn": 25.974,
          "gatedReturn": 32.53664538880441
        },
        {
          "baselineReturn": 16.052699999999998,
          "gatedReturn": 10.49274815542801
        },
        {
          "baselineReturn": 6.754300000000001,
          "gatedReturn": 11.449119099172833
        },
        {
          "baselineReturn": 16.60496666666667,
          "gatedReturn": 4.637309417595392
        },
        {
          "baselineReturn": 5.364366666666666,
          "gatedReturn": 1.18565077289799
        },
        {
          "baselineReturn": 5.9046666666666665,
          "gatedReturn": 11.614322867961597
        },
        {
          "baselineReturn": -25.0634,
          "gatedReturn": -2.22016200044478
        }
      ]
    },
    {
      "strategy": "universal_v3",
      "baseline": {
        "totalReturn": 67.4509,
        "weeks": 8,
        "winRatePct": 75,
        "avgWeeklyPct": 8.4314,
        "maxDrawdownPct": 24.905669,
        "trades": 566,
        "tradeWinRatePct": 55.83
      },
      "gated": {
        "totalReturn": 89.9584,
        "weeks": 8,
        "winRatePct": 62.5,
        "avgWeeklyPct": 11.2448,
        "maxDrawdownPct": 3.75983,
        "trades": 310,
        "tradeWinRatePct": 53.55
      },
      "delta": {
        "totalReturnPct": 22.5075,
        "winRatePct": -12.5,
        "avgWeeklyPct": 2.8134,
        "maxDrawdownPct": -21.145839,
        "trades": -256,
        "tradeWinRatePct": -2.28
      },
      "gateActivity": {
        "skippedTrades": 256,
        "reducedTrades": 0,
        "passedOrNoDataTrades": 310
      },
      "weekly": [
        {
          "baselineReturn": 30.33515,
          "gatedReturn": 24.66695270145859
        },
        {
          "baselineReturn": 30.955349999999996,
          "gatedReturn": 35.74139960686696
        },
        {
          "baselineReturn": 16.31995,
          "gatedReturn": 13.556528787092562
        },
        {
          "baselineReturn": 8.42825,
          "gatedReturn": 12.393306254552371
        },
        {
          "baselineReturn": 3.851000000000001,
          "gatedReturn": -2.7536628689656606
        },
        {
          "baselineReturn": 2.8231,
          "gatedReturn": -1.0346581453318193
        },
        {
          "baselineReturn": -1.4992249999999998,
          "gatedReturn": 8.520074486260274
        },
        {
          "baselineReturn": -23.7627,
          "gatedReturn": -1.1315292752089698
        }
      ]
    },
    {
      "strategy": "tiered_v1",
      "baseline": {
        "totalReturn": 391.786,
        "weeks": 8,
        "winRatePct": 87.5,
        "avgWeeklyPct": 48.9732,
        "maxDrawdownPct": 36.2961,
        "trades": 199,
        "tradeWinRatePct": 63.32
      },
      "gated": {
        "totalReturn": 357.8142,
        "weeks": 8,
        "winRatePct": 100,
        "avgWeeklyPct": 44.7268,
        "maxDrawdownPct": 0,
        "trades": 86,
        "tradeWinRatePct": 67.44
      },
      "delta": {
        "totalReturnPct": -33.9718,
        "winRatePct": 12.5,
        "avgWeeklyPct": -4.2464,
        "maxDrawdownPct": -36.2961,
        "trades": -113,
        "tradeWinRatePct": 4.12
      },
      "gateActivity": {
        "skippedTrades": 113,
        "reducedTrades": 0,
        "passedOrNoDataTrades": 86
      },
      "weekly": [
        {
          "baselineReturn": 178.4185,
          "gatedReturn": 126.85616194300076
        },
        {
          "baselineReturn": 33.7893,
          "gatedReturn": 76.95457314233538
        },
        {
          "baselineReturn": 25.8572,
          "gatedReturn": 14.46591169790204
        },
        {
          "baselineReturn": 79.1049,
          "gatedReturn": 69.83900972405712
        },
        {
          "baselineReturn": 60.5173,
          "gatedReturn": 5.882885714310901
        },
        {
          "baselineReturn": 37.3492,
          "gatedReturn": 7.807351897376094
        },
        {
          "baselineReturn": 13.0457,
          "gatedReturn": 48.78212294637701
        },
        {
          "baselineReturn": -36.2961,
          "gatedReturn": 7.226202356314454
        }
      ]
    },
    {
      "strategy": "tiered_v2",
      "baseline": {
        "totalReturn": 201.3829,
        "weeks": 8,
        "winRatePct": 87.5,
        "avgWeeklyPct": 25.1729,
        "maxDrawdownPct": 35.4603,
        "trades": 209,
        "tradeWinRatePct": 65.07
      },
      "gated": {
        "totalReturn": 165.7449,
        "weeks": 8,
        "winRatePct": 87.5,
        "avgWeeklyPct": 20.7181,
        "maxDrawdownPct": 7.561833,
        "trades": 79,
        "tradeWinRatePct": 68.35
      },
      "delta": {
        "totalReturnPct": -35.638,
        "winRatePct": 0,
        "avgWeeklyPct": -4.4548,
        "maxDrawdownPct": -27.898467,
        "trades": -130,
        "tradeWinRatePct": 3.28
      },
      "gateActivity": {
        "skippedTrades": 130,
        "reducedTrades": 0,
        "passedOrNoDataTrades": 79
      },
      "weekly": [
        {
          "baselineReturn": 105.0138,
          "gatedReturn": 68.12521978243718
        },
        {
          "baselineReturn": 24.4759,
          "gatedReturn": 39.011949151654285
        },
        {
          "baselineReturn": 26.7271,
          "gatedReturn": 7.907149460919239
        },
        {
          "baselineReturn": 0.9529,
          "gatedReturn": 15.37464816052232
        },
        {
          "baselineReturn": 54.7055,
          "gatedReturn": 11.968805413253113
        },
        {
          "baselineReturn": 17.6882,
          "gatedReturn": 3.6974744368425236
        },
        {
          "baselineReturn": 7.2798,
          "gatedReturn": 27.221473909558
        },
        {
          "baselineReturn": -35.4603,
          "gatedReturn": -7.561832822684597
        }
      ]
    },
    {
      "strategy": "tiered_v3",
      "baseline": {
        "totalReturn": 224.2006,
        "weeks": 8,
        "winRatePct": 75,
        "avgWeeklyPct": 28.0251,
        "maxDrawdownPct": 42.364066,
        "trades": 176,
        "tradeWinRatePct": 66.48
      },
      "gated": {
        "totalReturn": 153.1136,
        "weeks": 8,
        "winRatePct": 75,
        "avgWeeklyPct": 19.1392,
        "maxDrawdownPct": 9.224189,
        "trades": 88,
        "tradeWinRatePct": 65.91
      },
      "delta": {
        "totalReturnPct": -71.087,
        "winRatePct": 0,
        "avgWeeklyPct": -8.8859,
        "maxDrawdownPct": -33.139877,
        "trades": -88,
        "tradeWinRatePct": -0.57
      },
      "gateActivity": {
        "skippedTrades": 88,
        "reducedTrades": 0,
        "passedOrNoDataTrades": 88
      },
      "weekly": [
        {
          "baselineReturn": 105.5183,
          "gatedReturn": 61.4392331518475
        },
        {
          "baselineReturn": 50.0635,
          "gatedReturn": 43.10140848648238
        },
        {
          "baselineReturn": 25.915,
          "gatedReturn": 13.834236206236572
        },
        {
          "baselineReturn": 37.2938,
          "gatedReturn": 28.464382866956377
        },
        {
          "baselineReturn": 22.1189,
          "gatedReturn": 0.9218169293215386
        },
        {
          "baselineReturn": 27.9665,
          "gatedReturn": 14.797571382421674
        },
        {
          "baselineReturn": -5.9719,
          "gatedReturn": -5.185919498340853
        },
        {
          "baselineReturn": -38.7035,
          "gatedReturn": -4.259145452698945
        }
      ]
    }
  ]
} as const;
