import type { CotSource } from "./cotMarkets";

const DATASETS: Record<
  CotSource,
  {
    baseUrl: string;
    longField: string;
    shortField: string;
  }
> = {
  tff: {
    baseUrl: "https://publicreporting.cftc.gov/resource/gpe5-46if.json",
    longField: "dealer_positions_long_all",
    shortField: "dealer_positions_short_all",
  },
  legacy: {
    baseUrl: "https://publicreporting.cftc.gov/resource/6dca-aqww.json",
    longField: "comm_positions_long_all",
    shortField: "comm_positions_short_all",
  },
  disaggregated: {
    baseUrl: "https://publicreporting.cftc.gov/resource/72hh-3qpy.json",
    longField: "prod_merc_positions_long",
    shortField: "prod_merc_positions_short",
  },
};

export type CotRow = {
  contract_market_name: string;
  report_date_as_yyyy_mm_dd: string;
  dealer_positions_long_all?: string;
  dealer_positions_short_all?: string;
  comm_positions_long_all?: string;
  comm_positions_short_all?: string;
  prod_merc_positions_long?: string;
  prod_merc_positions_short?: string;
  futonly_or_combined: string;
};

function normalizeReportDate(value: string): string {
  const [datePart] = value.split("T");
  return datePart;
}

export async function fetchLatestReportDate(
  source: CotSource,
): Promise<string> {
  const url = new URL(DATASETS[source].baseUrl);
  url.searchParams.set("$select", "report_date_as_yyyy_mm_dd");
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
  url.searchParams.set("$limit", "1");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CFTC fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    report_date_as_yyyy_mm_dd?: string;
  }[];

  const latest = data?.[0]?.report_date_as_yyyy_mm_dd;
  if (!latest) {
    throw new Error("CFTC response missing report_date");
  }

  return normalizeReportDate(latest);
}

export async function fetchCotRowsForDate(
  reportDate: string,
  marketNames: string[],
  variant: string,
  source: CotSource,
): Promise<CotRow[]> {
  const dataset = DATASETS[source];
  const namesList = marketNames
    .map((name) => `'${name.replace(/'/g, "''")}'`)
    .join(", ");
  const where = [
    `report_date_as_yyyy_mm_dd='${reportDate}T00:00:00.000'`,
    `futonly_or_combined='${variant}'`,
    `contract_market_name in (${namesList})`,
  ].join(" AND ");

  const url = new URL(dataset.baseUrl);
  url.searchParams.set(
    "$select",
    `contract_market_name,report_date_as_yyyy_mm_dd,${dataset.longField},${dataset.shortField},futonly_or_combined`,
  );
  url.searchParams.set("$where", where);
  url.searchParams.set("$limit", "500");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CFTC fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as CotRow[];
  return data;
}
