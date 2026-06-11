import type { SentimentProvider } from "../types";
import type { SentimentProviderInterface } from "./base";
import { ForexClientSentimentProvider } from "./forexclientsentiment";
import { IgProvider } from "./ig";
import { MyfxbookProvider } from "./myfxbook";
import { OandaProvider } from "./oanda";

export function getProvider(name: SentimentProvider): SentimentProviderInterface {
  switch (name) {
    case "FOREXCLIENTSENTIMENT":
      return new ForexClientSentimentProvider();
    case "OANDA":
      return new OandaProvider();
    case "MYFXBOOK":
      return new MyfxbookProvider();
    case "IG":
      return new IgProvider();
  }
}

export function getAllProviders(): SentimentProviderInterface[] {
  // IG: Primary source for indices (SPX, NDX, NIKKEI) + FX/crypto/commodities
  // Myfxbook: FX community outlook
  // ForexClientSentiment: FX scraper
  // OANDA: FX orderbook (currently disabled due to Cloudflare)
  return [
    new IgProvider(),
    new MyfxbookProvider(),
    new ForexClientSentimentProvider(),
    new OandaProvider(),
  ];
}

export { IgProvider, OandaProvider, MyfxbookProvider, ForexClientSentimentProvider };
