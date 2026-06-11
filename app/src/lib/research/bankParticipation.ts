import { DateTime } from "luxon";
import { getAssetClassDefinition, type AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { Bias, Direction, PairSnapshot } from "@/lib/cotTypes";

const INDEX_URL = "https://www.cftc.gov/MarketReports/BankParticipationReports/index.htm";

export type BankSide = {
  long: number;
  short: number;
};

export type BankCommodityRow = {
  commodity: string;
  us: BankSide | null;
  nonUs: BankSide | null;
};

export type BankReport = {
  source_url: string;
  report_date: string;
  markets: BankCommodityRow[];
};

export type BankBiasMode = "directional" | "contrarian";

function parseUsDate(value: string): string | null {
  const parsed = DateTime.fromFormat(value.trim(), "M/d/yyyy", { zone: "utc" });
  if (!parsed.isValid) {
    return null;
  }
  return parsed.toISODate();
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHtmlText(html: string): string {
  return html
    .replace(/\r/g, "")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ");
}

export function parseBankReportHtml(html: string, sourceUrl: string): BankReport {
  const dateMatch = html.match(/REPORT DATE:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);
  if (!dateMatch) {
    throw new Error("Bank report missing REPORT DATE.");
  }
  const isoDate = parseUsDate(dateMatch[1]);
  if (!isoDate) {
    throw new Error(`Invalid bank report date: ${dateMatch[1]}`);
  }

  const text = normalizeHtmlText(html);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const marketMap = new Map<string, BankCommodityRow>();
  let currentCommodity = "";

  for (const line of lines) {
    const cells = line
      .split("\t")
      .map((cell) => cell.replace(/\s+/g, " ").trim())
      .filter((cell) => cell.length > 0);
    if (cells.length < 6) {
      continue;
    }
    if (cells[0].toUpperCase() === "COMMODITY" || cells[0].startsWith("REPORT DATE")) {
      continue;
    }

    if (cells[0] && cells[0].toUpperCase() !== "U.S." && cells[0].toUpperCase() !== "NON U.S.") {
      currentCommodity = cells[0].toUpperCase();
    }
    if (!currentCommodity) {
      continue;
    }

    const bankTypeIndex = cells.findIndex((cell) => {
      const v = cell.toUpperCase();
      return v.startsWith("U.S") || v.includes("NON U.S");
    });
    if (bankTypeIndex < 0) {
      continue;
    }
    const bankType = cells[bankTypeIndex].toUpperCase();
    const long = parseNumber(cells[bankTypeIndex + 2] ?? "");
    const short = parseNumber(cells[bankTypeIndex + 4] ?? "");
    if (long === null || short === null) {
      continue;
    }

    const existing = marketMap.get(currentCommodity) ?? {
      commodity: currentCommodity,
      us: null,
      nonUs: null,
    };
    if (bankType.startsWith("U.S")) {
      existing.us = { long, short };
    } else if (bankType.includes("NON U.S")) {
      existing.nonUs = { long, short };
    } else {
      continue;
    }
    marketMap.set(currentCommodity, existing);
  }

  return {
    source_url: sourceUrl,
    report_date: isoDate,
    markets: Array.from(marketMap.values()),
  };
}

function monthFromCode(code: string): number {
  const map: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  return map[code.toLowerCase()] ?? 0;
}

export function extractBankReportLinks(indexHtml: string, reportType: "f" | "o" = "f"): string[] {
  const matches = Array.from(
    indexHtml.matchAll(/href="([^"]*\/MarketReports\/BankParticipation\/dea([a-z]{3})(\d{2})([fo]))"/gi),
  );
  const links = new Map<string, { href: string; rank: number }>();
  for (const match of matches) {
    const href = match[1];
    const month = monthFromCode(match[2]);
    const year = Number(match[3]);
    const kind = match[4].toLowerCase() as "f" | "o";
    if (!month || kind !== reportType) {
      continue;
    }
    const full = href.startsWith("http") ? href : `https://www.cftc.gov${href}`;
    const rank = (2000 + year) * 100 + month;
    links.set(full, { href: full, rank });
  }
  return Array.from(links.values())
    .sort((a, b) => b.rank - a.rank)
    .map((item) => item.href);
}

export async function fetchBankReports(options?: {
  limit?: number;
  reportType?: "f" | "o";
}): Promise<BankReport[]> {
  const limit = Math.max(1, options?.limit ?? 24);
  const reportType = options?.reportType ?? "f";
  const indexResponse = await fetch(INDEX_URL, { cache: "no-store" });
  if (!indexResponse.ok) {
    throw new Error(`Bank index fetch failed: ${indexResponse.status}`);
  }
  const indexHtml = await indexResponse.text();
  const links = extractBankReportLinks(indexHtml, reportType).slice(0, limit);
  const reports: BankReport[] = [];
  for (const link of links) {
    const response = await fetch(link, { cache: "no-store" });
    if (!response.ok) {
      continue;
    }
    const html = await response.text();
    try {
      reports.push(parseBankReportHtml(html, link));
    } catch {
      // Skip malformed monthly page; keep research run alive.
    }
  }
  return reports.sort((a, b) => a.report_date.localeCompare(b.report_date));
}

export function selectBankReportForDate(reports: BankReport[], dateIso: string): BankReport | null {
  let best: BankReport | null = null;
  for (const report of reports) {
    if (report.report_date > dateIso) {
      continue;
    }
    if (!best || report.report_date > best.report_date) {
      best = report;
    }
  }
  return best;
}

function biasFromNet(net: number): Bias {
  if (net > 0) return "BULLISH";
  if (net < 0) return "BEARISH";
  return "NEUTRAL";
}

function scoreCommodityMatch(commodity: string, keyword: string): number {
  const c = commodity.toUpperCase();
  const k = keyword.toUpperCase();
  if (c.includes(k)) {
    return k.length;
  }
  if (k.includes(c)) {
    return c.length;
  }
  return -1;
}

export function buildBankMarketBiasByAsset(
  report: BankReport,
  assetClass: AssetClass,
  mode: BankBiasMode,
): Record<string, Bias> {
  const definition = getAssetClassDefinition(assetClass);
  const result: Record<string, Bias> = {};

  for (const market of Object.values(definition.markets)) {
    let bestRow: BankCommodityRow | null = null;
    let bestScore = -1;
    for (const row of report.markets) {
      for (const name of market.marketNames) {
        const score = scoreCommodityMatch(row.commodity, name);
        if (score > bestScore) {
          bestScore = score;
          bestRow = row;
        }
      }
    }
    if (!bestRow) {
      continue;
    }
    const long = (bestRow.us?.long ?? 0) + (bestRow.nonUs?.long ?? 0);
    const short = (bestRow.us?.short ?? 0) + (bestRow.nonUs?.short ?? 0);
    if (!Number.isFinite(long) || !Number.isFinite(short) || (long === 0 && short === 0)) {
      continue;
    }
    const directionalNet = long - short;
    const contrarianNet = short - long;
    const net = mode === "directional" ? directionalNet : contrarianNet;
    result[market.id] = biasFromNet(net);
  }

  return result;
}

export function deriveBankPairs(
  assetClass: AssetClass,
  marketBias: Record<string, Bias>,
): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  for (const pairDef of pairDefs) {
    const baseBias = marketBias[pairDef.base];
    const quoteBias = marketBias[pairDef.quote] ?? "NEUTRAL";
    if (!baseBias) {
      continue;
    }

    if (assetClass === "fx") {
      if (!marketBias[pairDef.quote]) {
        continue;
      }
      if (baseBias === "NEUTRAL" || quoteBias === "NEUTRAL" || baseBias === quoteBias) {
        continue;
      }
      const direction: Direction = baseBias === "BULLISH" ? "LONG" : "SHORT";
      pairs[pairDef.pair] = {
        direction,
        base_bias: baseBias,
        quote_bias: quoteBias,
      };
      continue;
    }

    if (baseBias === "NEUTRAL") {
      continue;
    }
    pairs[pairDef.pair] = {
      direction: baseBias === "BULLISH" ? "LONG" : "SHORT",
      base_bias: baseBias,
      quote_bias: quoteBias,
    };
  }

  return pairs;
}
