export function parseUtcNaiveTimestampMs(value: Date | string): number {
  if (value instanceof Date) {
    return Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds(),
    );
  }

  const raw = String(value).trim();
  if (!raw) return Number.NaN;

  const normalized = raw.replace(" ", "T");
  if (/[zZ]$|[+-]\d{2}(?::?\d{2})?$/.test(normalized)) {
    return Date.parse(normalized);
  }

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,6}))?$/,
  );
  if (!match) return Date.parse(normalized);

  const [, year, month, day, hour, minute, second = "0", fraction = "0"] = match;
  const millis = Number(fraction.slice(0, 3).padEnd(3, "0"));

  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    millis,
  );
}
