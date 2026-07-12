import { getLatestSnapshotsByProvider } from "../src/lib/sentiment/store";

type MyfxbookRawPayload = {
  longVolume?: number | string;
  shortVolume?: number | string;
  longPositions?: number | string;
  shortPositions?: number | string;
  totalPositions?: number | string;
  avgLongPrice?: number | string;
  avgShortPrice?: number | string;
};

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function main() {
  console.log("Fetching Myfxbook sentiment for BTC and ETH...\n");
  console.log("=".repeat(70));

  try {
    const symbols = ["BTC", "ETH"];
    const snapshots = await getLatestSnapshotsByProvider("MYFXBOOK", symbols);

    if (snapshots.length === 0) {
      console.log("No Myfxbook data available");
      return;
    }

    for (const snapshot of snapshots) {
      console.log(`\n${snapshot.symbol} MYFXBOOK SENTIMENT`);
      console.log("=".repeat(70));
      console.log(`Last updated: ${new Date(snapshot.timestamp_utc).toLocaleString()}\n`);

      if (!snapshot.raw_payload || typeof snapshot.raw_payload !== "object") {
        console.log("No positioning data available");
        continue;
      }

      const raw = snapshot.raw_payload as MyfxbookRawPayload;

      const longVolume = toNullableNumber(raw.longVolume);
      const shortVolume = toNullableNumber(raw.shortVolume);
      const longPositions = toNullableNumber(raw.longPositions);
      const shortPositions = toNullableNumber(raw.shortPositions);
      const totalPositions = toNullableNumber(raw.totalPositions);
      const avgLongPrice = toNullableNumber(raw.avgLongPrice);
      const avgShortPrice = toNullableNumber(raw.avgShortPrice);

      // Calculate percentages
      const totalVolume = (longVolume ?? 0) + (shortVolume ?? 0);
      const longPct = totalVolume > 0 ? ((longVolume ?? 0) / totalVolume) * 100 : 0;
      const shortPct = totalVolume > 0 ? ((shortVolume ?? 0) / totalVolume) * 100 : 0;

      console.log("VOLUME POSITIONING:");
      console.log(`  Long volume:  ${(longVolume ?? 0).toLocaleString()} lots (${longPct.toFixed(1)}%)`);
      console.log(`  Short volume: ${(shortVolume ?? 0).toLocaleString()} lots (${shortPct.toFixed(1)}%)`);
      console.log(`  Total volume: ${totalVolume.toLocaleString()} lots`);

      if (longPositions !== null && shortPositions !== null) {
        const totalPos = longPositions + shortPositions;
        const longPosPct = totalPos > 0 ? (longPositions / totalPos) * 100 : 0;
        const shortPosPct = totalPos > 0 ? (shortPositions / totalPos) * 100 : 0;

        console.log(`\nPOSITION COUNT:`);
        console.log(`  Long positions:  ${longPositions.toLocaleString()} (${longPosPct.toFixed(1)}%)`);
        console.log(`  Short positions: ${shortPositions.toLocaleString()} (${shortPosPct.toFixed(1)}%)`);
        console.log(`  Total positions: ${totalPos.toLocaleString()}`);
      }

      if (avgLongPrice !== null || avgShortPrice !== null) {
        console.log(`\nAVERAGE PRICES:`);
        if (avgLongPrice !== null) {
          console.log(`  Avg long price:  $${avgLongPrice.toLocaleString()}`);
        }
        if (avgShortPrice !== null) {
          console.log(`  Avg short price: $${avgShortPrice.toLocaleString()}`);
        }
      }

      // Analysis
      console.log(`\n📊 ANALYSIS:`);

      if (longPct > 60) {
        console.log(`  🔴 CROWDED LONG (${longPct.toFixed(1)}%)`);
        console.log(`  💡 Contrarian signal: Consider SHORT bias`);
        console.log(`  ⚠️  High risk of long squeeze if price drops`);
      } else if (shortPct > 60) {
        console.log(`  🟢 CROWDED SHORT (${shortPct.toFixed(1)}%)`);
        console.log(`  💡 Contrarian signal: Consider LONG bias`);
        console.log(`  ⚠️  High risk of short squeeze if price rises`);
      } else {
        console.log(`  ⚖️  BALANCED positioning (L:${longPct.toFixed(1)}% / S:${shortPct.toFixed(1)}%)`);
        console.log(`  💡 No extreme crowding - neutral sentiment`);
      }

      console.log();
    }

  } catch (error) {
    console.error("Error fetching Myfxbook data:", error);
  }

  console.log("=".repeat(70));
  console.log("Complete\n");
}

main().catch(console.error);
