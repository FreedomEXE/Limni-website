import { DateTime } from "luxon";
import type { NewsEvent } from "./types";

const FOREX_FACTORY_WEEK_FEED =
  "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";

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

function toUtcIso(dateRaw: string, timeRaw: string) {
  if (!dateRaw) return null;
  const normalizedTime = timeRaw.trim().toLowerCase();
  if (
    normalizedTime === "" ||
    normalizedTime.includes("all day") ||
    normalizedTime.includes("tentative")
  ) {
    const dateOnly = DateTime.fromFormat(dateRaw, "MM-dd-yyyy", {
      zone: "America/New_York",
    });
    return dateOnly.isValid
      ? dateOnly.startOf("day").toUTC().toISO()
      : null;
  }

  const parsed = DateTime.fromFormat(
    `${dateRaw} ${timeRaw.replace(/\s+/g, "")}`,
    "MM-dd-yyyy h:mma",
    { zone: "America/New_York" },
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

export async function fetchForexFactoryCalendarEvents(): Promise<NewsEvent[]> {
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
