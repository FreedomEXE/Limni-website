import type { CotSource } from "./cotMarkets";

const DATASETS: Record<
  CotSource,
  {
    baseUrl: string;
    longField: string;
    shortField: string;
    extraFields: string[];
  }
> = {
  tff: {
    baseUrl: "https://publicreporting.cftc.gov/resource/gpe5-46if.json",
    longField: "dealer_positions_long_all",
    shortField: "dealer_positions_short_all",
    extraFields: [
      "change_in_dealer_long_all",
      "change_in_dealer_short_all",
      "dealer_positions_spread_all",
      "change_in_dealer_spread_all",
      "open_interest_all",
      "change_in_open_interest_all",
      "pct_of_oi_dealer_long_all",
      "pct_of_oi_dealer_short_all",
      "pct_of_oi_dealer_spread_all",
      "traders_dealer_long_all",
      "traders_dealer_short_all",
      "asset_mgr_positions_long",
      "asset_mgr_positions_short",
      "asset_mgr_positions_spread",
      "change_in_asset_mgr_long",
      "change_in_asset_mgr_short",
      "change_in_asset_mgr_spread",
      "pct_of_oi_asset_mgr_long",
      "pct_of_oi_asset_mgr_short",
      "pct_of_oi_asset_mgr_spread",
      "traders_asset_mgr_long_all",
      "traders_asset_mgr_short_all",
      "traders_asset_mgr_spread",
      "lev_money_positions_long",
      "lev_money_positions_short",
      "lev_money_positions_spread",
      "change_in_lev_money_long",
      "change_in_lev_money_short",
      "change_in_lev_money_spread",
      "pct_of_oi_lev_money_long",
      "pct_of_oi_lev_money_short",
      "pct_of_oi_lev_money_spread",
      "traders_lev_money_long_all",
      "traders_lev_money_short_all",
      "traders_lev_money_spread",
      "other_rept_positions_long",
      "other_rept_positions_short",
      "other_rept_positions_spread",
      "change_in_other_rept_long",
      "change_in_other_rept_short",
      "change_in_other_rept_spread",
      "pct_of_oi_other_rept_long",
      "pct_of_oi_other_rept_short",
      "pct_of_oi_other_rept_spread",
      "traders_other_rept_long_all",
      "traders_other_rept_short",
      "traders_other_rept_spread",
      "nonrept_positions_long_all",
      "nonrept_positions_short_all",
      "change_in_nonrept_long_all",
      "change_in_nonrept_short_all",
      "pct_of_oi_nonrept_long_all",
      "pct_of_oi_nonrept_short_all",
      "conc_gross_le_4_tdr_long",
      "conc_gross_le_4_tdr_short",
      "conc_gross_le_8_tdr_long",
      "conc_gross_le_8_tdr_short",
      "conc_net_le_4_tdr_long_all",
      "conc_net_le_4_tdr_short_all",
      "conc_net_le_8_tdr_long_all",
      "conc_net_le_8_tdr_short_all",
    ],
  },
  legacy: {
    baseUrl: "https://publicreporting.cftc.gov/resource/6dca-aqww.json",
    longField: "comm_positions_long_all",
    shortField: "comm_positions_short_all",
    extraFields: [
      "change_in_comm_long_all",
      "change_in_comm_short_all",
      "noncomm_positions_long_all",
      "noncomm_positions_short_all",
      "noncomm_postions_spread_all",
      "change_in_noncomm_long_all",
      "change_in_noncomm_short_all",
      "change_in_noncomm_spead_all",
      "pct_of_oi_noncomm_long_all",
      "pct_of_oi_noncomm_short_all",
      "traders_noncomm_long_all",
      "traders_noncomm_short_all",
      "traders_noncomm_spread_all",
      "traders_comm_long_all",
      "traders_comm_short_all",
      "pct_of_oi_comm_long_all",
      "pct_of_oi_comm_short_all",
      "open_interest_all",
      "change_in_open_interest_all",
      "conc_gross_le_4_tdr_long",
      "conc_gross_le_4_tdr_short",
      "conc_gross_le_8_tdr_long",
      "conc_gross_le_8_tdr_short",
    ],
  },
  disaggregated: {
    baseUrl: "https://publicreporting.cftc.gov/resource/72hh-3qpy.json",
    longField: "prod_merc_positions_long",
    shortField: "prod_merc_positions_short",
    extraFields: [
      "change_in_prod_merc_long",
      "change_in_prod_merc_short",
      "open_interest_all",
      "change_in_open_interest_all",
      "conc_gross_le_4_tdr_long",
      "conc_gross_le_4_tdr_short",
      "conc_gross_le_8_tdr_long",
      "conc_gross_le_8_tdr_short",
    ],
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
  change_in_dealer_long_all?: string;
  change_in_dealer_short_all?: string;
  change_in_comm_long_all?: string;
  change_in_comm_short_all?: string;
  change_in_prod_merc_long?: string;
  change_in_prod_merc_short?: string;
  open_interest_all?: string;
  change_in_open_interest_all?: string;
  conc_gross_le_4_tdr_long?: string;
  conc_gross_le_4_tdr_short?: string;
  conc_gross_le_8_tdr_long?: string;
  conc_gross_le_8_tdr_short?: string;
  dealer_positions_spread_all?: string;
  change_in_dealer_spread_all?: string;
  pct_of_oi_dealer_long_all?: string;
  pct_of_oi_dealer_short_all?: string;
  pct_of_oi_dealer_spread_all?: string;
  traders_dealer_long_all?: string;
  traders_dealer_short_all?: string;
  asset_mgr_positions_long?: string;
  asset_mgr_positions_short?: string;
  asset_mgr_positions_spread?: string;
  change_in_asset_mgr_long?: string;
  change_in_asset_mgr_short?: string;
  change_in_asset_mgr_spread?: string;
  pct_of_oi_asset_mgr_long?: string;
  pct_of_oi_asset_mgr_short?: string;
  pct_of_oi_asset_mgr_spread?: string;
  traders_asset_mgr_long_all?: string;
  traders_asset_mgr_short_all?: string;
  traders_asset_mgr_spread?: string;
  lev_money_positions_long?: string;
  lev_money_positions_short?: string;
  lev_money_positions_spread?: string;
  change_in_lev_money_long?: string;
  change_in_lev_money_short?: string;
  change_in_lev_money_spread?: string;
  pct_of_oi_lev_money_long?: string;
  pct_of_oi_lev_money_short?: string;
  pct_of_oi_lev_money_spread?: string;
  traders_lev_money_long_all?: string;
  traders_lev_money_short_all?: string;
  traders_lev_money_spread?: string;
  other_rept_positions_long?: string;
  other_rept_positions_short?: string;
  other_rept_positions_spread?: string;
  change_in_other_rept_long?: string;
  change_in_other_rept_short?: string;
  change_in_other_rept_spread?: string;
  pct_of_oi_other_rept_long?: string;
  pct_of_oi_other_rept_short?: string;
  pct_of_oi_other_rept_spread?: string;
  traders_other_rept_long_all?: string;
  traders_other_rept_short?: string;
  traders_other_rept_spread?: string;
  nonrept_positions_long_all?: string;
  nonrept_positions_short_all?: string;
  change_in_nonrept_long_all?: string;
  change_in_nonrept_short_all?: string;
  pct_of_oi_nonrept_long_all?: string;
  pct_of_oi_nonrept_short_all?: string;
  conc_net_le_4_tdr_long_all?: string;
  conc_net_le_4_tdr_short_all?: string;
  conc_net_le_8_tdr_long_all?: string;
  conc_net_le_8_tdr_short_all?: string;
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
  noncomm_postions_spread_all?: string;
  change_in_noncomm_long_all?: string;
  change_in_noncomm_short_all?: string;
  change_in_noncomm_spead_all?: string;
  pct_of_oi_noncomm_long_all?: string;
  pct_of_oi_noncomm_short_all?: string;
  traders_noncomm_long_all?: string;
  traders_noncomm_short_all?: string;
  traders_noncomm_spread_all?: string;
  traders_comm_long_all?: string;
  traders_comm_short_all?: string;
  pct_of_oi_comm_long_all?: string;
  pct_of_oi_comm_short_all?: string;
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

export async function fetchAvailableReportDates(
  source: CotSource,
  limit = 5000,
): Promise<string[]> {
  const url = new URL(DATASETS[source].baseUrl);
  url.searchParams.set("$select", "report_date_as_yyyy_mm_dd");
  url.searchParams.set("$group", "report_date_as_yyyy_mm_dd");
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd ASC");
  url.searchParams.set("$limit", String(limit));

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CFTC dates fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    report_date_as_yyyy_mm_dd?: string;
  }[];

  return data
    .map((row) => row.report_date_as_yyyy_mm_dd)
    .filter((value): value is string => Boolean(value))
    .map(normalizeReportDate)
    .sort((left, right) => left.localeCompare(right));
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
    [
      "contract_market_name",
      "report_date_as_yyyy_mm_dd",
      dataset.longField,
      dataset.shortField,
      "futonly_or_combined",
      ...dataset.extraFields,
    ].join(","),
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
