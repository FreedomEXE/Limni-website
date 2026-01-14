const CFTC_BASE_URL = "https://publicreporting.cftc.gov/resource/udgc-27he.json";

export type CotRow = {
  contract_market_name: string;
  report_date_as_yyyy_mm_dd: string;
  dealer_positions_long_all: string;
  dealer_positions_short_all: string;
  futonly_or_combined: string;
};

function normalizeReportDate(value: string): string {
  const [datePart] = value.split("T");
  return datePart;
}

export async function fetchLatestReportDate(): Promise<string> {
  const url = new URL(CFTC_BASE_URL);
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
): Promise<CotRow[]> {
  const namesList = marketNames
    .map((name) => `'${name.replace(/'/g, "''")}'`)
    .join(", ");
  const where = [
    `report_date_as_yyyy_mm_dd='${reportDate}T00:00:00.000'`,
    `futonly_or_combined='${variant}'`,
    `contract_market_name in (${namesList})`,
  ].join(" AND ");

  const url = new URL(CFTC_BASE_URL);
  url.searchParams.set(
    "$select",
    "contract_market_name,report_date_as_yyyy_mm_dd,dealer_positions_long_all,dealer_positions_short_all,futonly_or_combined",
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
