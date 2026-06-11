import type { BasketSignal } from "@/lib/basketSignals";
import type { PlannedPair } from "@/lib/plannedTrades";
import { fetchBitgetUsdtEquity } from "@/lib/accounts/bitgetAccount";
import {
  applyBitgetPlannedSizing,
  applyOandaPlannedSizing,
  buildBasePlannedPairs,
} from "@/lib/accounts/connectedPlanning";

export async function buildConnectedPlannedView(options: {
  provider: "oanda" | "bitget" | "mt5";
  accountKey: string;
  config: Record<string, unknown> | null;
  selectedWeek: string;
  basketPairs: BasketSignal[];
  statsEquity: number;
}) {
  const { provider, accountKey, config, selectedWeek, basketPairs, statsEquity } = options;
  let plannedPairs: PlannedPair[] = [];
  let plannedNote: string | null = null;
  let plannedSummary: {
    marginUsed?: number | null;
    marginAvailable?: number | null;
    scale?: number | null;
    currency?: string | null;
  } | null = null;

  if (selectedWeek !== "all") {
    const basePlan = buildBasePlannedPairs({
      provider,
      basketPairs,
      config,
    });
    plannedPairs = basePlan.plannedPairs;
    plannedNote = basePlan.plannedNote;
  }

  if (provider === "bitget" && plannedPairs.length > 0) {
    const leverage =
      typeof config?.leverage === "number"
        ? (config.leverage as number)
        : Number(process.env.BITGET_LEVERAGE ?? "10");
    const sized = await applyBitgetPlannedSizing({
      plannedPairs,
      accountKey,
      statsEquity,
      leverage,
      fetchUsdtEquity: fetchBitgetUsdtEquity,
    });
    plannedPairs = sized.plannedPairs;
  }

  if (provider === "oanda" && plannedPairs.length > 0) {
    const sized = await applyOandaPlannedSizing({
      plannedPairs,
      accountKey,
      config,
    });
    plannedPairs = sized.plannedPairs;
    plannedSummary = sized.plannedSummary;
  }

  return {
    plannedPairs,
    plannedNote,
    plannedSummary,
  };
}
