import { fetchCryptoSpotPrice } from "../src/lib/cryptoPrices";
import { fetchBitgetFuturesSnapshot } from "../src/lib/bitget";

const COINANK_BASE_URL = "https://api.coinank.com";
const COINANK_WEB_VERSION = "102";
const COINANK_SEED = "b2d903dd-b31e-c547-d299-b6d07b7631ab";
const NONCE_OFFSET = 2222222222222;
const NONCE_SUFFIX = "347";

function buildCoinankApiKey(nowMs = Date.now()) {
  const seed = process.env.COINANK_API_SEED ?? COINANK_SEED;
  const prefix = seed.slice(0, 8);
  const rotated = seed.replace(prefix, "") + prefix;
  const nonce = `${nowMs + NONCE_OFFSET}${NONCE_SUFFIX}`;
  const payload = `${rotated}|${nonce}`;
  return Buffer.from(payload).toString("base64");
}

type LiqMapResponse = {
  success: boolean;
  data: {
    symbol: string;
    x90?: number[];  // 90x leverage long liquidations (or 10% distance)
    x100?: number[]; // 100x leverage
    x50?: number[];  // 50x leverage
    x25?: number[];  // 25x leverage
    prices?: number[]; // Actual price values for each index
    lastPrice?: number;
    lastIndex?: number;
  };
};

async function fetchLiquidationMap(symbol: string, exchange: string = "Binance") {
  const url = new URL("/api/liqMap/getLiqMap", COINANK_BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("exchange", exchange);

  const headers = {
    client: "web",
    token: "",
    "web-version": COINANK_WEB_VERSION,
    "coinank-apikey": buildCoinankApiKey(),
    "User-Agent": "Mozilla/5.0",
    Referer: "https://www.coinank.com/",
  };

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const payload = (await response.json()) as LiqMapResponse;
  if (!payload.success) {
    throw new Error("Failed to fetch liquidation map");
  }

  return payload.data;
}

function parseLiquidationLevels(
  liquidationAmounts: number[],
  prices: number[],
  currentPrice: number,
) {
  return liquidationAmounts
    .map((amount, index) => ({
      price: prices[index] || 0,
      amount,
      index,
    }))
    .filter((level) => level.amount > 0 && level.price > 0);
}

async function main() {
  console.log("Analyzing BTC and ETH liquidation levels...\n");
  console.log("=".repeat(70));

  for (const coin of ["BTC", "ETH"] as const) {
    const symbol = `${coin}USDT`;
    console.log(`\n${coin} LIQUIDATION ANALYSIS`);
    console.log("=".repeat(70));

    // Get current price
    let price: number | null = null;
    let priceSource: string = "";

    try {
      const snapshot = await fetchBitgetFuturesSnapshot(coin);
      if (Number.isFinite(snapshot.lastPrice) && snapshot.lastPrice !== null) {
        price = snapshot.lastPrice;
        priceSource = "Bitget Futures";
      }
    } catch (error) {
      // fallback
    }

    if (!price) {
      try {
        const spotPrice = await fetchCryptoSpotPrice(coin);
        if (Number.isFinite(spotPrice ?? NaN)) {
          price = spotPrice as number;
          priceSource = "CMC Spot";
        }
      } catch (error) {
        // ignore
      }
    }

    if (!price) {
      console.log(`❌ Could not fetch price for ${coin}\n`);
      continue;
    }

    console.log(`\nCurrent Price: $${price.toLocaleString()} (${priceSource})\n`);

    // Fetch liquidation map
    try {
      const liqMap = await fetchLiquidationMap(symbol);
      console.log(`Liquidation map data received for ${symbol}`);

      if (!liqMap.prices || !liqMap.x90) {
        console.log("No price data available");
        continue;
      }

      // Parse long liquidations using actual prices
      const longLevels = parseLiquidationLevels(liqMap.x90, liqMap.prices, price);

      // Find LONG liquidation clusters BELOW price (will act as support when hit)
      const belowPrice = longLevels
        .filter((level) => level.price < price!)
        .sort((a, b) => b.price - a.price) // Sort by price descending (closest first)
        .slice(0, 10);

      console.log(`\n💚 LONG LIQUIDATION CLUSTERS BELOW PRICE (Support zones):`);
      if (belowPrice.length === 0) {
        console.log(`  No significant long liquidation clusters below price`);
      } else {
        console.log(`  Found ${belowPrice.length} support zones:\n`);
        belowPrice.forEach((level, i) => {
          const distance = ((price! - level.price) / price!) * 100;
          console.log(`  ${i + 1}. $${level.price.toLocaleString()} (-${distance.toFixed(2)}%)`);
          console.log(`     Size: $${level.amount.toLocaleString()} in longs`);
        });

        const totalBelow = belowPrice.reduce((sum, level) => sum + level.amount, 0);
        console.log(`\n  📊 Total longs below price: $${totalBelow.toLocaleString()}`);
      }

      // Find LONG liquidation clusters ABOVE price (resistance)
      const abovePrice = longLevels
        .filter((level) => level.price > price!)
        .sort((a, b) => a.price - b.price) // Sort by price ascending
        .slice(0, 10);

      console.log(`\n🔴 LONG LIQUIDATION CLUSTERS ABOVE PRICE (Resistance):`);
      if (abovePrice.length === 0) {
        console.log(`  No significant long liquidation clusters above price`);
      } else {
        console.log(`  Found ${abovePrice.length} resistance zones:\n`);
        abovePrice.forEach((level, i) => {
          const distance = ((level.price - price!) / price!) * 100;
          console.log(`  ${i + 1}. $${level.price.toLocaleString()} (+${distance.toFixed(2)}%)`);
          console.log(`     Size: $${level.amount.toLocaleString()} in longs`);
        });

        const totalAbove = abovePrice.reduce((sum, level) => sum + level.amount, 0);
        console.log(`\n  📊 Total longs above price: $${totalAbove.toLocaleString()}`);
      }

      // Analysis: Compare fuel above vs below
      const totalBelow = belowPrice.reduce((sum, level) => sum + level.amount, 0);
      const totalAbove = abovePrice.reduce((sum, level) => sum + level.amount, 0);

      console.log(`\n📈 LIQUIDATION ANALYSIS:`);
      console.log(`  Longs below (support): $${totalBelow.toLocaleString()}`);
      console.log(`  Longs above (resistance): $${totalAbove.toLocaleString()}`);

      if (totalAbove > totalBelow * 1.2) {
        console.log(`  ⚠️  More resistance above - harder to push up`);
      } else if (totalBelow > totalAbove * 1.2) {
        console.log(`  ✅ More support below - easier to push up`);
      } else {
        console.log(`  ⚖️  Balanced - could go either way`);
      }

      console.log(`\n💡 SHORT LIQUIDATIONS:`);
      console.log(`  Note: This heatmap shows LONG liquidations only.`);
      console.log(`  For shorts getting rekt, we need to look at recent liquidation history.`);
      console.log(`  When price goes UP, shorts get liquidated.`);
      console.log(`  The recent pump from lower levels already liquidated many shorts.`);

      console.log("\n");
    } catch (error) {
      console.error(`Error fetching liquidation map for ${symbol}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Now fetch recent liquidation history
  console.log("\n" + "=".repeat(70));
  console.log("RECENT SHORT LIQUIDATIONS (Last 6 hours)");
  console.log("=".repeat(70));

  const { fetchLiquidationSummary } = await import("../src/lib/coinank");

  for (const coin of ["BTC", "ETH"] as const) {
    try {
      let price: number | null = null;
      try {
        const snapshot = await fetchBitgetFuturesSnapshot(coin);
        price = snapshot.lastPrice;
      } catch {
        const spotPrice = await fetchCryptoSpotPrice(coin);
        price = spotPrice as number;
      }

      if (!price) continue;

      const summary = await fetchLiquidationSummary(coin, price, "Bitget Futures");

      console.log(`\n${coin}:`);
      console.log(`  Short liquidations: $${summary.totalShortUsd.toLocaleString()} 💀`);
      console.log(`  Long liquidations: $${summary.totalLongUsd.toLocaleString()}`);

      const ratio = summary.totalShortUsd / (summary.totalLongUsd || 1);
      if (ratio > 3) {
        console.log(`  🔥 MASSIVE SHORT SQUEEZE - ${ratio.toFixed(1)}x more shorts liquidated`);
        console.log(`  💡 Most shorts already got REKT on the way up`);
      } else if (ratio > 1.5) {
        console.log(`  📈 Short squeeze happening - ${ratio.toFixed(1)}x more shorts liquidated`);
      } else if (ratio < 0.5) {
        console.log(`  📉 Long squeeze - more longs getting liquidated`);
      }
    } catch (error) {
      console.error(`Error fetching ${coin} liquidation summary:`, error);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("Analysis complete\n");
}

main().catch(console.error);
