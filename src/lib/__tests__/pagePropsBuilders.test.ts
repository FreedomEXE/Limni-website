import { describe, expect, test } from "vitest";
import { buildMt5AccountClientViewProps } from "@/lib/accounts/mt5PageProps";
import { buildConnectedAccountClientViewProps } from "@/lib/accounts/connectedPageProps";

describe("page props builders", () => {
  test("builds mt5 account client view props", () => {
    const props = buildMt5AccountClientViewProps({
      activeView: "overview",
      account: {
        label: "A",
        trade_mode: "AUTO",
        status: "LIVE",
        last_sync_utc: null,
        trade_count_week: 0,
        equity: 100,
        balance: 100,
        currency: "USD",
        recent_logs: [],
        basket_pnl_pct: 1,
      },
      weekOptions: ["2026-02-09"],
      currentWeekOpenUtc: "2026-02-09",
      selectedWeek: "2026-02-09",
      statsWeekOpenUtc: "2026-02-09",
      showStopLoss1pct: false,
      weeklyPnlToShow: 1,
      basketPnlToShow: 1,
      maxDrawdownPct: 0,
      filteredOpenPositions: [],
      filteredClosedPositions: [],
      plannedPairs: [],
      plannedSummary: null,
      equityCurvePoints: [],
      changeLog: [],
    });
    expect(props.header.providerLabel).toBe("MT5");
    expect(props.kpi.currency).toBe("USD");
  });

  test("builds connected account client view props", () => {
    const props = buildConnectedAccountClientViewProps({
      activeView: "trades",
      account: {
        account_key: "oanda:1",
        label: "O",
        provider: "oanda",
        config: null,
        last_sync_utc: null,
      },
      weekOptionsWithUpcoming: ["2026-02-09"],
      currentWeekOpenUtc: "2026-02-09",
      selectedWeek: "2026-02-09",
      stats: {
        weekOpenUtc: "2026-02-09",
        equity: 100,
        balance: 100,
        weeklyPnlPct: 0,
        basketPnlPct: 0,
        currency: "USD",
        lockedProfitPct: null,
        openPositions: 0,
        tradesThisWeek: 0,
        leverage: null,
        margin: null,
        freeMargin: null,
        riskUsedPct: null,
      },
      plannedPairs: [],
      plannedNote: null,
      plannedSummary: null,
      equityCurve: [],
      maxDrawdownPct: 0,
      mappedRows: [],
      openPositions: [],
    });
    expect(props.header.providerLabel).toBe("OANDA");
    expect(props.debug.selectedWeekKey).toBe("2026-02-09");
  });
});
