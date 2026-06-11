import { getLatestAggregatesLocked } from "../src/lib/sentiment/store";

async function main() {
  console.log("Fetching sentiment data for crypto...\n");
  console.log("=".repeat(70));

  try {
    const aggregates = await getLatestAggregatesLocked();

    // Filter for crypto symbols
    const cryptoSymbols = aggregates.filter(
      agg => agg.symbol === "BTC" || agg.symbol === "ETH"
    );

    if (cryptoSymbols.length === 0) {
      console.log("No crypto sentiment data available in database");
      console.log("\nNote: The sentiment aggregator may only track forex pairs.");
      console.log("BTC and ETH sentiment might not be available yet.");
      return;
    }

    for (const agg of cryptoSymbols) {
      console.log(`\n${agg.symbol} SENTIMENT`);
      console.log("=".repeat(70));
      console.log(`Last updated: ${new Date(agg.timestamp_utc).toLocaleString()}\n`);

      console.log("CROWDING STATE:");
      console.log(`  ${agg.crowding_state}`);

      if (Number.isFinite(agg.agg_long_pct) && Number.isFinite(agg.agg_short_pct)) {
        console.log(`\nPOSITIONING:`);
        console.log(`  Long:  ${agg.agg_long_pct.toFixed(1)}%`);
        console.log(`  Short: ${agg.agg_short_pct.toFixed(1)}%`);
      }

      console.log(`\n📊 ANALYSIS:`);
      if (agg.crowding_state === "CROWDED_LONG") {
        console.log(`  🔴 TOO MANY LONGS`);
        console.log(`  💡 Contrarian signal: Consider SHORT bias`);
      } else if (agg.crowding_state === "CROWDED_SHORT") {
        console.log(`  🟢 TOO MANY SHORTS`);
        console.log(`  💡 Contrarian signal: Consider LONG bias`);
      } else {
        console.log(`  ⚖️  NEUTRAL - no extreme crowding`);
      }

      console.log();
    }

  } catch (error) {
    console.error("Error:", error);
  }

  console.log("=".repeat(70));
  console.log("Complete\n");
}

main().catch(console.error);
