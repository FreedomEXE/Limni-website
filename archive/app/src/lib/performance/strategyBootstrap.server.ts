import { loadStrategyPageData, type StrategyPageData } from "@/lib/performance/strategyPageData";
import {
  buildStrategySelectionKey,
  listStrategyBootstrapSelections,
  listVisibleStrategyBootstrapSelections,
  type StrategyBootstrapSelection,
} from "@/lib/performance/strategySelection";

const BOOTSTRAP_CONCURRENCY = 2;

export async function loadStrategyBootstrapMap(): Promise<
  [string, StrategyPageData | null][]
> {
  return loadStrategyBootstrapMapForSelections(listStrategyBootstrapSelections());
}

export async function loadVisibleStrategyBootstrapMap(): Promise<
  [string, StrategyPageData | null][]
> {
  return loadStrategyBootstrapMapForSelections(listVisibleStrategyBootstrapSelections());
}

async function loadStrategyBootstrapMapForSelections(
  selections: StrategyBootstrapSelection[],
): Promise<[string, StrategyPageData | null][]> {
  const results: [string, StrategyPageData | null][] = [];

  for (let i = 0; i < selections.length; i += BOOTSTRAP_CONCURRENCY) {
    const batch = selections.slice(i, i + BOOTSTRAP_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (selection): Promise<[string, StrategyPageData | null]> => [
        buildStrategySelectionKey(selection),
        await loadStrategyPageData(selection),
      ]),
    );
    results.push(...batchResults);
  }

  return results;
}
