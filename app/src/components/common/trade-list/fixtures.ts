/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: fixtures.ts
 *
 * Description:
 * Representative standalone fixtures for TradeList visual and behavior checks.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { formatCountSummary, formatDateLabel, formatSignedPercent, formatTimeLabel } from "./formatters";
import type { TradeListColumn, TradeListNode } from "./types";

export const tradeListFixtureColumns: TradeListColumn[] = [
  {
    key: "label",
    label: "Pair",
    sortable: true,
    width: "minmax(260px, 2.2fr)",
  },
  {
    key: "counts",
    label: "Structure",
    width: "minmax(150px, 1fr)",
  },
  {
    key: "entryUtc",
    label: "Week / Entry",
    sortable: true,
    defaultDirection: "desc",
    width: "minmax(150px, 0.9fr)",
    format: formatDateLabel,
  },
  {
    key: "returnPct",
    label: "Return",
    align: "right",
    sortable: true,
    width: "minmax(96px, 0.6fr)",
    format: (value) => formatSignedPercent(value),
  },
];

export const flatTradeListFixtureNodes: TradeListNode[] = [
  {
    id: "flat-audcad-long",
    level: "trade",
    label: "AUDCAD",
    assetClass: "fx",
    direction: "LONG",
    values: {
      counts: "Weekly Hold",
      entryUtc: "2026-05-11T00:00:00Z",
      returnPct: -0.71,
    },
  },
  {
    id: "flat-btcusd-short",
    level: "trade",
    label: "BTCUSD",
    assetClass: "crypto",
    direction: "SHORT",
    values: {
      counts: "ADR Grid",
      entryUtc: "2026-05-12T03:00:00Z",
      returnPct: 1.18,
    },
  },
  {
    id: "flat-xauusd-missing",
    level: "trade",
    label: "XAUUSD",
    assetClass: "commodities",
    direction: null,
    values: {
      counts: "Missing close",
      entryUtc: null,
      returnPct: null,
    },
  },
];

export const nestedTradeListFixtureNodes: TradeListNode[] = [
  {
    id: "week-2026-05-18",
    level: "week",
    label: "Week of May 18, 2026",
    expandable: true,
    values: {
      counts: formatCountSummary([
        ["P", 4],
        ["G", 114],
        ["T", 800],
      ]),
      entryUtc: "2026-05-18T00:00:00Z",
      returnPct: 22.14,
    },
    children: [
      {
        id: "portfolio-commercial",
        level: "portfolio",
        label: "Commercial Portfolio",
        expandable: true,
        values: {
          counts: formatCountSummary([
            ["G", 28],
            ["T", 200],
          ]),
          entryUtc: "2026-05-18T00:00:00Z",
          returnPct: 9.4,
        },
        children: [
          {
            id: "symbol-audcad",
            level: "symbol",
            label: "AUDCAD",
            assetClass: "fx",
            expandable: true,
            values: {
              counts: formatCountSummary([
                ["G", 1],
                ["F", 6],
              ]),
              entryUtc: "2026-05-18T00:00:00Z",
              returnPct: 0.33,
            },
            children: [
              {
                id: "grid-audcad-1",
                level: "grid",
                label: "Grid",
                expandable: true,
                values: {
                  counts: "6 fills",
                  entryUtc: "2026-05-18T21:00:00Z",
                  returnPct: 0.33,
                },
                children: [
                  {
                    id: "fill-audcad-1",
                    level: "fill",
                    label: "AUDCAD",
                    assetClass: "fx",
                    direction: "LONG",
                    values: {
                      counts: `${formatTimeLabel("2026-05-18T21:00:00Z")} → ${formatTimeLabel("2026-05-22T21:00:00Z")}`,
                      entryUtc: "2026-05-18T21:00:00Z",
                      returnPct: 0.08,
                    },
                  },
                  {
                    id: "fill-audcad-2",
                    level: "fill",
                    label: "AUDCAD",
                    assetClass: "fx",
                    direction: "LONG",
                    values: {
                      counts: `${formatTimeLabel("2026-05-18T22:00:00Z")} → ${formatTimeLabel("2026-05-22T21:00:00Z")}`,
                      entryUtc: "2026-05-18T22:00:00Z",
                      returnPct: 0.04,
                    },
                  },
                ],
              },
            ],
          },
          {
            id: "symbol-btcusd",
            level: "symbol",
            label: "BTCUSD",
            assetClass: "crypto",
            expandable: true,
            values: {
              counts: formatCountSummary([
                ["G", 1],
                ["F", 19],
              ]),
              entryUtc: "2026-05-18T00:00:00Z",
              returnPct: 0.73,
            },
            children: [
              {
                id: "grid-btcusd-1",
                level: "grid",
                label: "Grid",
                values: {
                  counts: "19 fills",
                  entryUtc: "2026-05-18T00:00:00Z",
                  returnPct: 0.73,
                },
              },
            ],
          },
        ],
      },
      {
        id: "portfolio-dealer",
        level: "portfolio",
        label: "Dealer Portfolio",
        expandable: true,
        values: {
          counts: formatCountSummary([
            ["G", 36],
            ["T", 245],
          ]),
          entryUtc: "2026-05-18T00:00:00Z",
          returnPct: 4.06,
        },
        children: [
          {
            id: "symbol-xauusd",
            level: "symbol",
            label: "XAUUSD",
            assetClass: "commodities",
            direction: "SHORT",
            values: {
              counts: "1 trade",
              entryUtc: null,
              returnPct: null,
            },
          },
          {
            id: "symbol-ndxusd",
            level: "symbol",
            label: "NDXUSD",
            assetClass: "indices",
            values: {
              counts: "1 trade",
              entryUtc: "2026-05-18T00:00:00Z",
              returnPct: -0.18,
            },
          },
        ],
      },
    ],
  },
];

export const emptyTradeListFixtureNodes: TradeListNode[] = [];
