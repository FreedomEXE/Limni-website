type CoinMarketCapQuoteResponse = {
  data?: Record<string, { quote?: { USD?: { price?: number } } }>;
};

export async function fetchCryptoSpotPrice(
  symbolBase: "BTC" | "ETH",
): Promise<number | null> {
  const apiKey = process.env.COINMARKETCAP_API_KEY ?? "";
  if (!apiKey) {
    return null;
  }
  const url = new URL("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest");
  url.searchParams.set("symbol", symbolBase);
  url.searchParams.set("convert", "USD");

  const response = await fetch(url.toString(), {
    headers: { "X-CMC_PRO_API_KEY": apiKey },
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as CoinMarketCapQuoteResponse;
  const price = data.data?.[symbolBase]?.quote?.USD?.price;
  return Number.isFinite(price) ? (price as number) : null;
}
