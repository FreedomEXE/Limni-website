/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-selected-ledger-metrics.ts
 *
 * Description:
 * Exports selected-ledger metric receipts for app parity and baseline
 * promotion. Existing trade export scripts stay row-only; this script owns the
 * metric receipt by importing the shared selected-ledger read model.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { AssetClass } from "@/lib/cotMarkets";
import {
  ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
  ACTIVE_BASELINE_SEED_HISTORY_WINDOW,
} from "@/lib/appTruth/activeBaseline";
import { buildSelectedLedgerMetricReceipt } from "@/lib/appTruth/selectedLedgerMetricReceipt";
import { buildSelectedLedgerStats } from "@/lib/appTruth/selectedLedgerStats";
import {
  getStrategy,
  normalizeFilterSelection,
  resolveStrategyId,
} from "@/lib/performance/strategyConfig";
import { loadStrategyPageData, type StrategyHistoryWindow } from "@/lib/performance/strategyPageData";
import { toStrategyClientPayload } from "@/lib/performance/strategyClientPayload";
import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

loadEnvConfig(process.cwd());

const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "commodities", "crypto"];

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseScope(): AssetClass[] {
  const raw = argValue("scope") ?? "all";
  if (raw === "all") return [...ASSET_CLASSES];
  const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
  const invalid = values.filter((value) => !ASSET_CLASSES.includes(value as AssetClass));
  if (invalid.length > 0) {
    throw new Error(`Unsupported --scope value(s): ${invalid.join(", ")}. Use all or ${ASSET_CLASSES.join(",")}.`);
  }
  return values as AssetClass[];
}

function parseViewMode(): ViewMode {
  const anchor = argValue("anchor") ?? "execution";
  const normalization = argValue("normalization") ?? "raw";
  if (anchor !== "execution" && anchor !== "canonical") {
    throw new Error(`Unsupported --anchor value "${anchor}". Use execution or canonical.`);
  }
  if (normalization !== "raw" && normalization !== "adr_normalized") {
    throw new Error(`Unsupported --normalization value "${normalization}". Use raw or adr_normalized.`);
  }
  return { anchor, normalization };
}

function parseHistoryWindow(): StrategyHistoryWindow {
  const raw = argValue("history") ?? argValue("window") ?? "active-baseline";
  if (raw === "active" || raw === "active-baseline") return ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW;
  if (raw === "clean14" || raw === "v2.0.3-clean14") return ACTIVE_BASELINE_SEED_HISTORY_WINDOW;
  if (raw === "seed" || raw === "seed-window") return ACTIVE_BASELINE_SEED_HISTORY_WINDOW;
  if (raw === "data-section" || raw === "all-data-section") return "data-section";
  throw new Error(`Unsupported --history value "${raw}". Use active-baseline, seed-window, or data-section.`);
}

function slugPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  const strategyId = resolveStrategyId(argValue("strategy") ?? argValue("bias") ?? "tandem");
  const filters = normalizeFilterSelection({
    f1: argValue("f1") ?? "adr_grid",
    f2: argValue("f2") ?? "pair_fill_cap",
  });
  const selectedWeek = argValue("week") ?? "all";
  const scope = parseScope();
  const viewMode = parseViewMode();
  const historyWindow = parseHistoryWindow();
  const strategy = getStrategy(strategyId);
  if (!strategy) throw new Error(`Unsupported --strategy value "${strategyId}".`);

  const selection: RuntimeStrategySelection = {
    strategy: strategyId,
    f1: filters.f1,
    f2: filters.f2,
  };
  const data = await loadStrategyPageData(
    { strategyId, f1: filters.f1, f2: filters.f2 },
    { includeCurrentWeek: false, historyWindow },
  );
  if (!data) {
    throw new Error(`No strategy page data available for ${strategyId}/${filters.f1}/${filters.f2}.`);
  }

  const payload = toStrategyClientPayload(data, "full");
  const stats = buildSelectedLedgerStats({
    bundle: payload.selectedTradeRowsBundle,
    selectedWeek,
    scope,
    viewMode,
  });
  const receipt = buildSelectedLedgerMetricReceipt({
    stats,
    strategy,
    selection,
    historyWindow,
    viewMode,
  });

  const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? "reports/data-verification/selected-ledger");
  await mkdir(outDir, { recursive: true });
  const slug = [
    slugPart(selection.strategy),
    slugPart(selection.f1),
    slugPart(selection.f2),
    slugPart(historyWindow),
    slugPart(selectedWeek === "all" ? "all" : selectedWeek.slice(0, 10)),
    slugPart(viewMode.anchor),
    slugPart(viewMode.normalization),
  ].join("-");
  const jsonPath = path.join(outDir, `${slug}-selected-ledger-metrics.json`);
  await writeFile(jsonPath, JSON.stringify(receipt, null, 2));

  console.log(`[verification] Selected-ledger metric receipt: ${jsonPath}`);
  console.log(`[verification] Ledger: ${receipt.ledger.selectedTradeRowLedgerId ?? "missing"}`);
  console.log(`[verification] Return: ${receipt.summary.returnPct ?? "missing"}%`);
  console.log(`[verification] Trades: ${receipt.summary.tradeCount ?? "missing"}`);
  console.log(`[verification] Parity passed: ${receipt.parity.passed}`);
  if (!receipt.parity.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
