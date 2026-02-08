const TIME_ZONE = "America/New_York";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  // Date-only strings (YYYY-MM-DD) are interpreted as UTC midnight by JS Date, which
  // can render as the previous day in America/New_York. Anchor at noon UTC to keep
  // the displayed calendar date stable in ET.
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function formatDateET(value?: string | null, fallback = "Unknown") {
  const parsed = parseDate(value);
  if (!parsed) {
    return fallback;
  }
  return DATE_FORMATTER.format(parsed);
}

export function formatTimeET(value?: string | null, fallback = "Unknown") {
  const parsed = parseDate(value);
  if (!parsed) {
    return fallback;
  }
  return `${TIME_FORMATTER.format(parsed)} ET`;
}

export function formatDateTimeET(value?: string | null, fallback = "Unknown") {
  const parsed = parseDate(value);
  if (!parsed) {
    return fallback;
  }
  return `${DATE_TIME_FORMATTER.format(parsed)} ET`;
}

export function latestIso(values: Array<string | null | undefined>): string | null {
  let latestValue: string | null = null;
  let latestTime = 0;
  for (const value of values) {
    const parsed = parseDate(value);
    if (!parsed) {
      continue;
    }
    const time = parsed.getTime();
    if (!latestValue || time > latestTime) {
      latestValue = value ?? null;
      latestTime = time;
    }
  }
  return latestValue;
}
