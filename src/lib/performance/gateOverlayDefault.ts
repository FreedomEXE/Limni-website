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
  "generated_utc": "2026-03-16T18:02:23.194Z",
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
    "reduce_mode": "STANDARD_REDUCE_HALF_SIZE"
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
        "totalReturn": 97.2207,
        "weeks": 8,
        "winRatePct": 62.5,
        "avgWeeklyPct": 12.1526,
        "maxDrawdownPct": 1.390271,
        "trades": 460,
        "tradeWinRatePct": 50
      },
      "delta": {
        "totalReturnPct": 15.7308,
        "winRatePct": -25,
        "avgWeeklyPct": 1.9664,
        "maxDrawdownPct": -21.833249,
        "trades": -342,
        "tradeWinRatePct": -6.61
      },
      "gateActivity": {
        "skippedTrades": 342,
        "reducedTrades": 70,
        "passedOrNoDataTrades": 390
      },
      "weekly": [
        {
          "baselineReturn": 36.5359,
          "gatedReturn": 28.694640234111763
        },
        {
          "baselineReturn": 26.519699999999993,
          "gatedReturn": 34.325809758286724
        },
        {
          "baselineReturn": 14.69794,
          "gatedReturn": 11.060101321495864
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
          "gatedReturn": -1.0842730853388836
        },
        {
          "baselineReturn": 2.7122599999999997,
          "gatedReturn": 12.71692446713953
        },
        {
          "baselineReturn": -23.22352,
          "gatedReturn": -1.2746970640553712
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
        "totalReturn": 101.1176,
        "weeks": 8,
        "winRatePct": 87.5,
        "avgWeeklyPct": 12.6397,
        "maxDrawdownPct": 2.644472,
        "trades": 202,
        "tradeWinRatePct": 55.94
      },
      "delta": {
        "totalReturnPct": 0.4615,
        "winRatePct": 0,
        "avgWeeklyPct": 0.0577,
        "maxDrawdownPct": -22.418928,
        "trades": -243,
        "tradeWinRatePct": -6.53
      },
      "gateActivity": {
        "skippedTrades": 243,
        "reducedTrades": 33,
        "passedOrNoDataTrades": 169
      },
      "weekly": [
        {
          "baselineReturn": 49.0645,
          "gatedReturn": 35.648313930110525
        },
        {
          "baselineReturn": 25.974,
          "gatedReturn": 31.842232796747407
        },
        {
          "baselineReturn": 16.052699999999998,
          "gatedReturn": 9.972598149448894
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
          "gatedReturn": 0.09384419863577402
        },
        {
          "baselineReturn": 5.9046666666666665,
          "gatedReturn": 10.118688190033376
        },
        {
          "baselineReturn": -25.0634,
          "gatedReturn": -2.644472045522072
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
        "totalReturn": 87.6294,
        "weeks": 8,
        "winRatePct": 62.5,
        "avgWeeklyPct": 10.9537,
        "maxDrawdownPct": 3.735562,
        "trades": 351,
        "tradeWinRatePct": 51
      },
      "delta": {
        "totalReturnPct": 20.1785,
        "winRatePct": -12.5,
        "avgWeeklyPct": 2.5223,
        "maxDrawdownPct": -21.170107,
        "trades": -215,
        "tradeWinRatePct": -4.83
      },
      "gateActivity": {
        "skippedTrades": 215,
        "reducedTrades": 41,
        "passedOrNoDataTrades": 310
      },
      "weekly": [
        {
          "baselineReturn": 30.33515,
          "gatedReturn": 24.286557452440572
        },
        {
          "baselineReturn": 30.955349999999996,
          "gatedReturn": 35.22059016282421
        },
        {
          "baselineReturn": 16.31995,
          "gatedReturn": 13.166416282608225
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
          "gatedReturn": -1.009703375547841
        },
        {
          "baselineReturn": -1.4992249999999998,
          "gatedReturn": 7.840245978862289
        },
        {
          "baselineReturn": -23.7627,
          "gatedReturn": -1.514347708262937
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
        "totalReturn": 334.5901,
        "weeks": 8,
        "winRatePct": 100,
        "avgWeeklyPct": 41.8238,
        "maxDrawdownPct": 0,
        "trades": 105,
        "tradeWinRatePct": 58.1
      },
      "delta": {
        "totalReturnPct": -57.1959,
        "winRatePct": 12.5,
        "avgWeeklyPct": -7.1494,
        "maxDrawdownPct": -36.2961,
        "trades": -94,
        "tradeWinRatePct": -5.22
      },
      "gateActivity": {
        "skippedTrades": 94,
        "reducedTrades": 19,
        "passedOrNoDataTrades": 86
      },
      "weekly": [
        {
          "baselineReturn": 178.4185,
          "gatedReturn": 127.6716726013569
        },
        {
          "baselineReturn": 33.7893,
          "gatedReturn": 74.53161775017276
        },
        {
          "baselineReturn": 25.8572,
          "gatedReturn": 8.103956330200486
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
          "gatedReturn": 5.6722738495155705
        },
        {
          "baselineReturn": 13.0457,
          "gatedReturn": 36.55378879738615
        },
        {
          "baselineReturn": -36.2961,
          "gatedReturn": 6.334938354486718
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
        "totalReturn": 154.4666,
        "weeks": 8,
        "winRatePct": 87.5,
        "avgWeeklyPct": 19.3083,
        "maxDrawdownPct": 9.775762,
        "trades": 94,
        "tradeWinRatePct": 58.51
      },
      "delta": {
        "totalReturnPct": -46.9163,
        "winRatePct": 0,
        "avgWeeklyPct": -5.8646,
        "maxDrawdownPct": -25.684538,
        "trades": -115,
        "tradeWinRatePct": -6.56
      },
      "gateActivity": {
        "skippedTrades": 115,
        "reducedTrades": 15,
        "passedOrNoDataTrades": 79
      },
      "weekly": [
        {
          "baselineReturn": 105.0138,
          "gatedReturn": 68.57815287315275
        },
        {
          "baselineReturn": 24.4759,
          "gatedReturn": 37.89256601884618
        },
        {
          "baselineReturn": 26.7271,
          "gatedReturn": 7.3440946693624305
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
          "gatedReturn": 2.6863226998296517
        },
        {
          "baselineReturn": 7.2798,
          "gatedReturn": 20.397806850820935
        },
        {
          "baselineReturn": -35.4603,
          "gatedReturn": -9.775762366879091
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
        "totalReturn": 144.4153,
        "weeks": 8,
        "winRatePct": 75,
        "avgWeeklyPct": 18.0519,
        "maxDrawdownPct": 16.951569,
        "trades": 101,
        "tradeWinRatePct": 59.41
      },
      "delta": {
        "totalReturnPct": -79.7853,
        "winRatePct": 0,
        "avgWeeklyPct": -9.9732,
        "maxDrawdownPct": -25.412497,
        "trades": -75,
        "tradeWinRatePct": -7.07
      },
      "gateActivity": {
        "skippedTrades": 75,
        "reducedTrades": 13,
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
          "gatedReturn": 13.089079854189588
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
          "gatedReturn": 15.109778037282219
        },
        {
          "baselineReturn": -5.9719,
          "gatedReturn": -10.447116500409042
        },
        {
          "baselineReturn": -38.7035,
          "gatedReturn": -7.263252690948822
        }
      ]
    }
  ]
} as const;
