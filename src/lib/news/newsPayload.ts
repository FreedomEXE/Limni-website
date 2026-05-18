import type { NewsWeeklySnapshot } from "@/lib/news/types";

export type NewsPayload = {
  currentWeekOpenUtc: string;
  weekOptions: string[];
  selectedWeek: string | null;
  snapshotsByWeek: Record<string, NewsWeeklySnapshot | null>;
  loadError: string | null;
  fetchedAtUtc: string;
};
