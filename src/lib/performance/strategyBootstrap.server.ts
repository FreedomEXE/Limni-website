import { loadStrategyPageData, type StrategyPageData } from "@/lib/performance/strategyPageData";
import {
  buildStrategySelectionKey,
  listStrategyBootstrapSelections,
} from "@/lib/performance/strategySelection";

const BOOTSTRAP_CONCURRENCY = 4;

export async function loadStrategyBootstrapMap(): Promise<
  [string, StrategyPageData | null][]
> {
  const selections = listStrategyBootstrapSelections();
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
