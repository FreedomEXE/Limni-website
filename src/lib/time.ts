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
  const parsed = new Date(value);
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
