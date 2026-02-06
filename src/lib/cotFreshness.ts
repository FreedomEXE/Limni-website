const MS_DAY = 24 * 60 * 60 * 1000;

export function evaluateFreshness(
  reportDate: string,
  lastRefreshUtc: string,
  now: Date = new Date(),
): { trading_allowed: boolean; reason: string } {
  if (!reportDate) {
    return { trading_allowed: false, reason: "missing report_date" };
  }

  const report = new Date(reportDate);

  if (Number.isNaN(report.getTime())) {
    return { trading_allowed: false, reason: "invalid report_date" };
  }

  if (report.getTime() > now.getTime()) {
    return { trading_allowed: false, reason: "report_date is in the future" };
  }

  const ageDays = (now.getTime() - report.getTime()) / MS_DAY;
  if (ageDays > 14) {
    return { trading_allowed: false, reason: "report_date is stale" };
  }

  return { trading_allowed: true, reason: "fresh" };
}
