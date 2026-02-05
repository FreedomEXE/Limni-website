export type NewsEvent = {
  title: string;
  country: string;
  impact: "High" | "Medium" | "Low" | "Holiday" | "Unknown";
  date: string;
  time: string;
  datetime_utc: string | null;
  forecast: string | null;
  previous: string | null;
  url: string | null;
  source: "forexfactory";
};

export type NewsWeeklySnapshot = {
  week_open_utc: string;
  source: string;
  announcements: NewsEvent[];
  calendar: NewsEvent[];
  fetched_at: string;
};
