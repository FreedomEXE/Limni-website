import { listAssetClasses } from "./cotMarkets";
import { readSnapshot } from "./cotStore";
import { refreshMarketSnapshot } from "./pricePerformance";
import { refreshSentiment } from "./sentiment/refresh";

export async function refreshAppData(): Promise<void> {
  const assetClasses = listAssetClasses();
  await Promise.all([
    (async () => {
      try {
        await refreshSentiment();
      } catch (error) {
        console.error("Sentiment refresh failed:", error);
      }
    })(),
    ...assetClasses.map(async (asset) => {
      try {
        const snapshot = await readSnapshot({ assetClass: asset.id });
        if (!snapshot) {
          return;
        }
        await refreshMarketSnapshot(snapshot.pairs, {
          assetClass: asset.id,
          force: true,
        });
      } catch (error) {
        console.error(`Price refresh failed for ${asset.id}:`, error);
      }
    }),
  ]);
}
