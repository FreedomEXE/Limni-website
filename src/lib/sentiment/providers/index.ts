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
  }
}

export function getAllProviders(): SentimentProviderInterface[] {
  // Use ForexClientSentiment, OANDA, and Myfxbook (all via scraper service)
  return [
    new ForexClientSentimentProvider(),
    new OandaProvider(),
    new MyfxbookProvider(),
  ];
}

export { IgProvider, OandaProvider, MyfxbookProvider, ForexClientSentimentProvider };
