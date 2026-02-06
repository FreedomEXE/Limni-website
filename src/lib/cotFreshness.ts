const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

export function evaluateFreshness(
  reportDate: string,
  lastRefreshUtc: string,
  now: Date = new Date(),
): { trading_allowed: boolean; reason: string } {
  if (!reportDate) {
    return { trading_allowed: false, reason: "missing report_date" };
  }

  if (!lastRefreshUtc) {
    return { trading_allowed: false, reason: "missing last_refresh_utc" };
  }

  const report = new Date(reportDate);
  const refresh = new Date(lastRefreshUtc);

  if (Number.isNaN(report.getTime())) {
    return { trading_allowed: false, reason: "invalid report_date" };
  }

  if (Number.isNaN(refresh.getTime())) {
    return { trading_allowed: false, reason: "invalid last_refresh_utc" };
  }

  if (report.getTime() > now.getTime()) {
    return { trading_allowed: false, reason: "report_date is in the future" };
  }

  const ageDays = (now.getTime() - report.getTime()) / MS_DAY;
  if (ageDays > 10) {
    return { trading_allowed: false, reason: "report_date is stale" };
  }

  const refreshAgeHours = (now.getTime() - refresh.getTime()) / MS_HOUR;
  const refreshedRecently = refreshAgeHours <= 24;
  const refreshedAfterReport = refresh.getTime() >= report.getTime();
  const reportDay = report.toISOString().slice(0, 10);
  const refreshDay = refresh.toISOString().slice(0, 10);
  const refreshedOnOrAfterReportDay = refreshDay >= reportDay;

  if (!refreshedRecently && !refreshedAfterReport && !refreshedOnOrAfterReportDay) {
    return { trading_allowed: false, reason: "refresh is too old" };
  }

  return { trading_allowed: true, reason: "fresh" };
}
