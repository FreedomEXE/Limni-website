import { DateTime } from "luxon";
import type { NewsEvent } from "./types";

const FOREX_FACTORY_WEEK_FEED =
  "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";
const FOREX_FACTORY_CALENDAR_PAGE = "https://secure.forexfactory.com/calendar";
const NEWS_DISPLAY_TIME_ZONE = "America/Toronto";
const XML_SOURCE_TIME_ZONE = process.env.NEWS_XML_SOURCE_TIMEZONE?.trim() || "UTC";

type ForexFactoryScriptDay = {
  events?: ForexFactoryScriptEvent[];
};

type ForexFactoryScriptEvent = {
  name?: string;
  currency?: string;
  impactName?: string;
  dateline?: number;
  timeLabel?: string;
  timeMasked?: boolean;
  actual?: string;
  forecast?: string;
  previous?: string;
  soloUrl?: string;
  url?: string;
};

function decodeCdata(value: string) {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) {
    return "";
  }
  return decodeCdata(match[1] ?? "");
}

function normalizeImpact(raw: string): NewsEvent["impact"] {
  const lower = raw.toLowerCase();
  if (lower.includes("high")) return "High";
  if (lower.includes("medium")) return "Medium";
  if (lower.includes("low")) return "Low";
  if (lower.includes("holiday")) return "Holiday";
  return "Unknown";
}

function normalizeField(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asAbsoluteForexFactoryUrl(raw: string | null) {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `https://www.forexfactory.com${raw}`;
  }
  return `https://www.forexfactory.com/${raw}`;
}

function toUtcIso(dateRaw: string, timeRaw: string) {
  if (!dateRaw) return null;
  const normalizedTime = timeRaw.trim().toLowerCase();
  if (
    normalizedTime === "" ||
    normalizedTime.includes("all day") ||
    normalizedTime.includes("tentative")
  ) {
    const dateOnly = DateTime.fromFormat(dateRaw, "MM-dd-yyyy", {
      zone: XML_SOURCE_TIME_ZONE,
    });
    return dateOnly.isValid
      ? dateOnly.startOf("day").toUTC().toISO()
      : null;
  }

  const parsed = DateTime.fromFormat(
    `${dateRaw} ${timeRaw.replace(/\s+/g, "")}`,
    "MM-dd-yyyy h:mma",
    { zone: XML_SOURCE_TIME_ZONE },
  );
  if (!parsed.isValid) {
    return null;
  }
  return parsed.toUTC().toISO();
}

function parseForexFactoryXml(xml: string): NewsEvent[] {
  const events: NewsEvent[] = [];
  const blocks = xml.match(/<event>[\s\S]*?<\/event>/gi) ?? [];
  for (const block of blocks) {
    const title = extractTag(block, "title");
    if (!title) continue;
    const country = extractTag(block, "country") || "All";
    const date = extractTag(block, "date");
    const time = extractTag(block, "time");
    const impactRaw = extractTag(block, "impact");
    const actualRaw = extractTag(block, "actual");
    const forecastRaw = extractTag(block, "forecast");
    const previousRaw = extractTag(block, "previous");
    const urlRaw = extractTag(block, "url");

    events.push({
      title,
      country,
      impact: normalizeImpact(impactRaw),
      date,
      time: time || "Tentative",
      datetime_utc: toUtcIso(date, time),
      actual: actualRaw || null,
      forecast: forecastRaw || null,
      previous: previousRaw || null,
      url: urlRaw || null,
      source: "forexfactory",
    });
  }
  return events.sort((a, b) => {
    const aTs = a.datetime_utc ? Date.parse(a.datetime_utc) : 0;
    const bTs = b.datetime_utc ? Date.parse(b.datetime_utc) : 0;
    return aTs - bTs;
  });
}

function parseCalendarDaysPayload(html: string): ForexFactoryScriptDay[] {
  const match = html.match(
    /window\.calendarComponentStates\[\d+\]\s*=\s*\{[\s\S]*?days:\s*(\[[\s\S]*?\])\s*,\s*time:/,
  );
  if (!match || !match[1]) {
    throw new Error("Calendar days payload not found");
  }
  const parsed = JSON.parse(match[1]) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Calendar days payload is invalid");
  }
  return parsed as ForexFactoryScriptDay[];
}

function parseForexFactoryCalendarPage(html: string): NewsEvent[] {
  const days = parseCalendarDaysPayload(html);
  const events: NewsEvent[] = [];

  for (const day of days) {
    const dayEvents = Array.isArray(day.events) ? day.events : [];
    for (const item of dayEvents) {
      const title = normalizeField(item.name);
      if (!title) {
        continue;
      }

      const impact = normalizeImpact(normalizeField(item.impactName) ?? "Unknown");
      const datelineSeconds =
        typeof item.dateline === "number" && Number.isFinite(item.dateline)
          ? item.dateline
          : null;
      const eventUtc =
        datelineSeconds !== null
          ? DateTime.fromSeconds(datelineSeconds, { zone: "utc" })
          : null;
      const eventLocal =
        eventUtc && eventUtc.isValid ? eventUtc.setZone(NEWS_DISPLAY_TIME_ZONE) : null;

      const date = eventLocal?.toFormat("MM-dd-yyyy") ?? "";
      const masked = item.timeMasked === true;
      const sourceTime = normalizeField(item.timeLabel);
      const time = sourceTime ?? (eventLocal ? eventLocal.toFormat("h:mma").toLowerCase() : "Tentative");
      const datetimeUtc = !masked && eventUtc?.isValid ? eventUtc.toUTC().toISO() : null;

      events.push({
        title,
        country: normalizeField(item.currency) ?? "All",
        impact,
        date,
        time,
        datetime_utc: datetimeUtc,
        actual: normalizeField(item.actual),
        forecast: normalizeField(item.forecast),
        previous: normalizeField(item.previous),
        url: asAbsoluteForexFactoryUrl(normalizeField(item.soloUrl) ?? normalizeField(item.url)),
        source: "forexfactory",
      });
    }
  }

  return events.sort((a, b) => {
    const aTs = a.datetime_utc ? Date.parse(a.datetime_utc) : 0;
    const bTs = b.datetime_utc ? Date.parse(b.datetime_utc) : 0;
    return aTs - bTs;
  });
}

async function fetchForexFactoryCalendarPageEvents(): Promise<NewsEvent[]> {
  const response = await fetch(FOREX_FACTORY_CALENDAR_PAGE, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LimniLabs-NewsBot/1.0)",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`ForexFactory calendar page failed (${response.status})`);
  }
  const html = await response.text();
  const events = parseForexFactoryCalendarPage(html);
  if (events.length === 0) {
    throw new Error("ForexFactory calendar page returned no events");
  }
  return events;
}

export async function fetchForexFactoryCalendarEvents(): Promise<NewsEvent[]> {
  try {
    return await fetchForexFactoryCalendarPageEvents();
  } catch (primaryError) {
    console.warn(
      "[news] secure ForexFactory calendar parse failed; falling back to export feed:",
      primaryError instanceof Error ? primaryError.message : String(primaryError),
    );
  }
  const response = await fetch(FOREX_FACTORY_WEEK_FEED, {
    headers: { "User-Agent": "LimniLabs-News/1.0" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`ForexFactory feed failed (${response.status})`);
  }
  const xml = await response.text();
  return parseForexFactoryXml(xml);
}
