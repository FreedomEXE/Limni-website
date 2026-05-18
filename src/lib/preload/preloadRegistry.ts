import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
  toRuntimeStrategySelection,
  type RuntimeStrategySelection,
} from "@/lib/performance/strategySelection";
import {
  normalizeFilterSelection,
  resolveStrategyId,
} from "@/lib/performance/strategyConfig";
import { fetchAndSeedAccounts } from "@/lib/accounts/accountsSessionStore";
import { fetchAndSeedMarketIntelligence } from "@/lib/dashboard/marketIntelligenceStore";
import { fetchAndSeedNews } from "@/lib/news/newsSessionStore";
import { ensureStrategySession } from "@/lib/performance/strategySessionStore";

export type PreloadDomain = "strategy" | "market-intelligence" | "news" | "accounts";

type BasePreloadTask = {
  id: string;
  domain: PreloadDomain;
  priority: "active" | "background";
  run: (options?: { force?: boolean }) => Promise<void>;
};

export type StrategyPreloadTask = BasePreloadTask & {
  domain: "strategy";
  selection: RuntimeStrategySelection;
};

export type PreloadTask =
  | StrategyPreloadTask
  | (BasePreloadTask & { domain: "market-intelligence" | "news" | "accounts" });

export type PreloadManifest = {
  tasks: PreloadTask[];
  activeTaskId: string | null;
};

export const FALLBACK_DEFAULT_SELECTION: RuntimeStrategySelection = {
  strategy: "tandem",
  f1: "adr_grid",
  f2: "exposure_cap",
};

export function deriveActiveSelectionFromParams(
  searchParams: URLSearchParams | null,
): RuntimeStrategySelection | null {
  if (!searchParams) return null;
  const strategyParam = searchParams.get("strategy") ?? searchParams.get("bias");
  const f1Param = searchParams.get("f1") ?? searchParams.get("filter");
  const f2Param = searchParams.get("f2");
  if (!strategyParam && !f1Param && !f2Param) return null;

  const normalized = normalizeFilterSelection({
    f1: f1Param,
    f2: f2Param,
  });

  return {
    strategy: resolveStrategyId(strategyParam),
    f1: normalized.f1,
    f2: normalized.f2,
  };
}

export function buildPreloadManifest(
  activeOverride?: RuntimeStrategySelection | null,
): PreloadManifest {
  const active = activeOverride ?? FALLBACK_DEFAULT_SELECTION;
  const activeKey = buildStrategySelectionKey({
    strategy: active.strategy,
    f1: active.f1,
    f2: active.f2,
  });

  const tasks: PreloadTask[] = listVisibleStrategyBootstrapSelections().map((selection) => {
    const key = buildStrategySelectionKey(selection);
    const runtimeSelection = toRuntimeStrategySelection(selection);
    return {
      id: key,
      domain: "strategy",
      selection: runtimeSelection,
      priority: key === activeKey ? "active" : "background",
      run: (options) => ensureStrategySession(runtimeSelection, {
        currentWeek: false,
        force: options?.force === true,
      }),
    };
  });

  if (!tasks.some((task) => task.id === activeKey)) {
    tasks.unshift({
      id: activeKey,
      domain: "strategy",
      selection: active,
      priority: "active",
      run: (options) => ensureStrategySession(active, {
        currentWeek: false,
        force: options?.force === true,
      }),
    });
  }

  tasks.push({
    id: "market-intelligence",
    domain: "market-intelligence",
    priority: "active",
    run: () => fetchAndSeedMarketIntelligence(),
  });

  tasks.push({
    id: "news",
    domain: "news",
    priority: "background",
    run: () => fetchAndSeedNews(),
  });

  tasks.push({
    id: "accounts",
    domain: "accounts",
    priority: "background",
    run: () => fetchAndSeedAccounts(),
  });

  return {
    tasks,
    activeTaskId: activeKey,
  };
}
