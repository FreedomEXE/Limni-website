import { DateTime } from "luxon";

const MS_DAY = 24 * 60 * 60 * 1000;
const ET_ZONE = "America/New_York";

function buildWeeklyExpectation(now: DateTime) {
  const nowEt = now.setZone(ET_ZONE);
  const daysSinceSunday = nowEt.weekday % 7;
  const weekStartEt = nowEt.startOf("day").minus({ days: daysSinceSunday });
  const fridayReleaseEt = weekStartEt.plus({ days: 5, hours: 15, minutes: 30 });
  const expectedReportDate = weekStartEt.plus({ days: 2 }).toFormat("yyyy-LL-dd");

  return {
    nowEt,
    fridayReleaseEt,
    expectedReportDate,
  };
}

export function evaluateFreshness(
  reportDate: string,
  lastRefreshUtc: string,
  now: Date = new Date(),
): {
  trading_allowed: boolean;
  reason: string;
  expected_report_date: string;
  weekly_release_utc: string;
  minutes_since_weekly_release: number;
} {
  const nowUtc = DateTime.fromJSDate(now, { zone: "utc" });
  const expected = buildWeeklyExpectation(nowUtc);

  if (!reportDate) {
    return {
      trading_allowed: false,
      reason: "missing report_date",
      expected_report_date: expected.expectedReportDate,
      weekly_release_utc: expected.fridayReleaseEt.toUTC().toISO() ?? "",
      minutes_since_weekly_release: 0,
    };
  }

  const report = DateTime.fromISO(reportDate, { zone: "utc" });
  if (!report.isValid) {
    return {
      trading_allowed: false,
      reason: "invalid report_date",
      expected_report_date: expected.expectedReportDate,
      weekly_release_utc: expected.fridayReleaseEt.toUTC().toISO() ?? "",
      minutes_since_weekly_release: 0,
    };
  }

  if (report.toMillis() > nowUtc.toMillis()) {
    return {
      trading_allowed: false,
      reason: "report_date is in the future",
      expected_report_date: expected.expectedReportDate,
      weekly_release_utc: expected.fridayReleaseEt.toUTC().toISO() ?? "",
      minutes_since_weekly_release: 0,
    };
  }

  const releasePassed = nowUtc.toMillis() >= expected.fridayReleaseEt.toUTC().toMillis();
  const reportIso = report.toFormat("yyyy-LL-dd");
  const minutesSinceRelease = Math.max(
    0,
    Math.floor(nowUtc.diff(expected.fridayReleaseEt.toUTC(), "minutes").minutes),
  );
  if (releasePassed && reportIso < expected.expectedReportDate) {
    return {
      trading_allowed: false,
      reason: "awaiting weekly CFTC update",
      expected_report_date: expected.expectedReportDate,
      weekly_release_utc: expected.fridayReleaseEt.toUTC().toISO() ?? "",
      minutes_since_weekly_release: minutesSinceRelease,
    };
  }

  const ageDays = (nowUtc.toMillis() - report.toMillis()) / MS_DAY;
  if (ageDays > 14) {
    return {
      trading_allowed: false,
      reason: "report_date is stale",
      expected_report_date: expected.expectedReportDate,
      weekly_release_utc: expected.fridayReleaseEt.toUTC().toISO() ?? "",
      minutes_since_weekly_release: minutesSinceRelease,
    };
  }

  void lastRefreshUtc;
  return {
    trading_allowed: true,
    reason: "fresh",
    expected_report_date: expected.expectedReportDate,
    weekly_release_utc: expected.fridayReleaseEt.toUTC().toISO() ?? "",
    minutes_since_weekly_release: minutesSinceRelease,
  };
}
