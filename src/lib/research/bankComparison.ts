import { query } from "@/lib/db";
import type { AssetClass } from "@/lib/cotMarkets";
import type { PairSnapshot } from "@/lib/cotTypes";
import { getPairPerformance } from "@/lib/pricePerformance";
import { computeReturnStats } from "@/lib/performanceLab";
import {
  buildBankMarketBiasByAsset,
  deriveBankPairs,
  fetchBankReports,
  selectBankReportForDate,
  type BankBiasMode,
  type BankReport,
} from "@/lib/research/bankParticipation";

type BaselineRow = {
  week_open_utc: Date;
  asset_class: AssetClass;
  report_date: Date;
  blended_percent: string | null;
  dealer_percent: string | null;
  commercial_percent: string | null;
};

export type BankComparisonRow = {
  week_open_utc: string;
  asset_class: AssetClass;
  cot_report_date: string;
  bank_report_date: string | null;
  baseline_blended_percent: number | null;
  baseline_dealer_percent: number | null;
  baseline_commercial_percent: number | null;
  bank_mode: BankBiasMode;
  bank_percent: number;
  priced: number;
  total: number;
  delta_vs_blended: number | null;
  delta_vs_dealer: number | null;
  delta_vs_commercial: number | null;
  note: string;
};

export type BankComparisonPayload = {
  generated_at: string;
  options: {
    weeks: number;
    months: number;
    assets: AssetClass[];
    reportType: "f" | "o";
  };
  report_window: {
    earliest_bank_report: string | null;
    latest_bank_report: string | null;
    reports_loaded: number;
    baseline_weeks: number;
  };
  summary: Record<
    BankBiasMode,
    {
      return_stats: ReturnType<typeof computeReturnStats>;
      rows: number;
      priced_pairs: number;
      total_pairs: number;
      avg_delta_vs_blended: number;
      avg_delta_vs_dealer: number;
      avg_delta_vs_commercial: number;
    }
  >;
  rows: BankComparisonRow[];
};

type BankComparisonOptions = {
  weeks?: number;
  months?: number;
  assets?: AssetClass[];
  reportType?: "f" | "o";
};

function toNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function directionFactor(direction: PairSnapshot["direction"]) {
  return direction === "LONG" ? 1 : direction === "SHORT" ? -1 : 0;
}

async function loadBaselineRows(limitWeeks: number, assets: AssetClass[]): Promise<BaselineRow[]> {
  const rows = await query<BaselineRow>(
    `SELECT
       week_open_utc,
       asset_class,
       report_date,
       MAX(CASE WHEN model = 'blended' THEN percent::text END) AS blended_percent,
       MAX(CASE WHEN model = 'dealer' THEN percent::text END) AS dealer_percent,
       MAX(CASE WHEN model = 'commercial' THEN percent::text END) AS commercial_percent
     FROM performance_snapshots
     WHERE model IN ('blended', 'dealer', 'commercial')
       AND report_date IS NOT NULL
       AND asset_class = ANY($1::text[])
     GROUP BY week_open_utc, asset_class, report_date
     ORDER BY week_open_utc DESC
     LIMIT $2`,
    [assets, limitWeeks],
  );
  return rows;
}

async function runBankModeForRow(
  row: BaselineRow,
  reports: BankReport[],
  mode: BankBiasMode,
): Promise<BankComparisonRow> {
  const weekOpenIso = row.week_open_utc.toISOString();
  const reportDateIso = row.report_date.toISOString().slice(0, 10);
  const bankReport = selectBankReportForDate(reports, reportDateIso);
  const baselineBlended = toNumber(row.blended_percent);
  const baselineDealer = toNumber(row.dealer_percent);
  const baselineCommercial = toNumber(row.commercial_percent);

  if (!bankReport) {
    return {
      week_open_utc: weekOpenIso,
      asset_class: row.asset_class,
      cot_report_date: reportDateIso,
      bank_report_date: null,
      baseline_blended_percent: baselineBlended,
      baseline_dealer_percent: baselineDealer,
      baseline_commercial_percent: baselineCommercial,
      bank_mode: mode,
      bank_percent: 0,
      priced: 0,
      total: 0,
      delta_vs_blended: baselineBlended === null ? null : -baselineBlended,
      delta_vs_dealer: baselineDealer === null ? null : -baselineDealer,
      delta_vs_commercial: baselineCommercial === null ? null : -baselineCommercial,
      note: "No prior bank report available for this COT week.",
    };
  }

  const marketBias = buildBankMarketBiasByAsset(bankReport, row.asset_class, mode);
  const pairs = deriveBankPairs(row.asset_class, marketBias);
  const pairKeys = Object.keys(pairs);
  if (pairKeys.length === 0) {
    return {
      week_open_utc: weekOpenIso,
      asset_class: row.asset_class,
      cot_report_date: reportDateIso,
      bank_report_date: bankReport.report_date,
      baseline_blended_percent: baselineBlended,
      baseline_dealer_percent: baselineDealer,
      baseline_commercial_percent: baselineCommercial,
      bank_mode: mode,
      bank_percent: 0,
      priced: 0,
      total: 0,
      delta_vs_blended: baselineBlended === null ? null : -baselineBlended,
      delta_vs_dealer: baselineDealer === null ? null : -baselineDealer,
      delta_vs_commercial: baselineCommercial === null ? null : -baselineCommercial,
      note: "No mapped bank pairs for this asset class/week.",
    };
  }

  const perf = await getPairPerformance(pairs, {
    assetClass: row.asset_class,
    reportDate: reportDateIso,
    isLatestReport: false,
  });
  let bankPercent = 0;
  let priced = 0;
  for (const [pair, snapshot] of Object.entries(pairs)) {
    const pairPerf = perf.performance[pair];
    if (!pairPerf) {
      continue;
    }
    bankPercent += pairPerf.percent * directionFactor(snapshot.direction);
    priced += 1;
  }

  return {
    week_open_utc: weekOpenIso,
    asset_class: row.asset_class,
    cot_report_date: reportDateIso,
    bank_report_date: bankReport.report_date,
    baseline_blended_percent: baselineBlended,
    baseline_dealer_percent: baselineDealer,
    baseline_commercial_percent: baselineCommercial,
    bank_mode: mode,
    bank_percent: Number(bankPercent.toFixed(6)),
    priced,
    total: pairKeys.length,
    delta_vs_blended:
      baselineBlended === null ? null : Number((bankPercent - baselineBlended).toFixed(6)),
    delta_vs_dealer:
      baselineDealer === null ? null : Number((bankPercent - baselineDealer).toFixed(6)),
    delta_vs_commercial:
      baselineCommercial === null ? null : Number((bankPercent - baselineCommercial).toFixed(6)),
    note: perf.note,
  };
}

function summarize(rows: BankComparisonRow[]): BankComparisonPayload["summary"] {
  const byMode = new Map<
    BankBiasMode,
    {
      returns: Array<{ pair: string; percent: number }>;
      total: number;
      priced: number;
      deltaVsBlended: number[];
      deltaVsDealer: number[];
      deltaVsCommercial: number[];
    }
  >();

  for (const row of rows) {
    const state = byMode.get(row.bank_mode) ?? {
      returns: [],
      total: 0,
      priced: 0,
      deltaVsBlended: [],
      deltaVsDealer: [],
      deltaVsCommercial: [],
    };
    state.returns.push({
      pair: `${row.asset_class}:${row.week_open_utc}`,
      percent: row.bank_percent,
    });
    state.total += row.total;
    state.priced += row.priced;
    if (row.delta_vs_blended !== null) state.deltaVsBlended.push(row.delta_vs_blended);
    if (row.delta_vs_dealer !== null) state.deltaVsDealer.push(row.delta_vs_dealer);
    if (row.delta_vs_commercial !== null) state.deltaVsCommercial.push(row.delta_vs_commercial);
    byMode.set(row.bank_mode, state);
  }

  const result: BankComparisonPayload["summary"] = {
    directional: {
      return_stats: computeReturnStats([]),
      rows: 0,
      priced_pairs: 0,
      total_pairs: 0,
      avg_delta_vs_blended: 0,
      avg_delta_vs_dealer: 0,
      avg_delta_vs_commercial: 0,
    },
    contrarian: {
      return_stats: computeReturnStats([]),
      rows: 0,
      priced_pairs: 0,
      total_pairs: 0,
      avg_delta_vs_blended: 0,
      avg_delta_vs_dealer: 0,
      avg_delta_vs_commercial: 0,
    },
  };

  for (const mode of ["directional", "contrarian"] as const) {
    const state = byMode.get(mode);
    if (!state) continue;
    const avg = (values: number[]) =>
      values.length === 0
        ? 0
        : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6));
    result[mode] = {
      return_stats: computeReturnStats(state.returns),
      rows: state.returns.length,
      priced_pairs: state.priced,
      total_pairs: state.total,
      avg_delta_vs_blended: avg(state.deltaVsBlended),
      avg_delta_vs_dealer: avg(state.deltaVsDealer),
      avg_delta_vs_commercial: avg(state.deltaVsCommercial),
    };
  }
  return result;
}

export async function computeBankComparison(
  options: BankComparisonOptions = {},
): Promise<BankComparisonPayload> {
  const weeks = Math.max(8, options.weeks ?? 104);
  const months = Math.max(3, options.months ?? 24);
  const assets = options.assets && options.assets.length > 0
    ? options.assets
    : ["fx", "indices", "crypto", "commodities"];
  const reportType = options.reportType ?? "f";

  const reports = await fetchBankReports({ limit: months, reportType });
  const baselineRows = await loadBaselineRows(weeks, assets);
  const rows: BankComparisonRow[] = [];

  for (const baseline of baselineRows) {
    rows.push(await runBankModeForRow(baseline, reports, "directional"));
    rows.push(await runBankModeForRow(baseline, reports, "contrarian"));
  }

  return {
    generated_at: new Date().toISOString(),
    options: { weeks, months, assets, reportType },
    report_window: {
      earliest_bank_report: reports[0]?.report_date ?? null,
      latest_bank_report: reports.at(-1)?.report_date ?? null,
      reports_loaded: reports.length,
      baseline_weeks: baselineRows.length,
    },
    summary: summarize(rows),
    rows,
  };
}
