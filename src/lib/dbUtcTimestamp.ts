import { DateTime } from "luxon";

export function parseUtcSqlTimestamp(value: string | null | undefined): DateTime | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const iso = DateTime.fromISO(text, { zone: "utc" });
  if (iso.isValid) return iso.toUTC();

  const sql = DateTime.fromSQL(text, { zone: "utc" });
  return sql.isValid ? sql.toUTC() : null;
}

export function utcSqlTimestampTextToIso(value: string | null | undefined): string | null {
  const parsed = parseUtcSqlTimestamp(value);
  return parsed?.toISO() ?? null;
}

export function dbTimestampValueToIsoUtc(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return utcSqlTimestampTextToIso(value) ?? String(value);
}
