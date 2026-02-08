"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { WeekOption } from "@/lib/weekState";
import { useTransition } from "react";
import { DateTime } from "luxon";

type WeekSelectorProps = {
  weekOptions: WeekOption[];
  currentWeek: string;
  selectedWeek: WeekOption;
  labelMode?: "week_open_utc" | "monday_et";
  className?: string;
};

/**
 * Week selector component with "All Time" option and smooth navigation
 *
 * Features:
 * - Supports "all" option for all-time view
 * - Client-side navigation with optimistic UI
 * - Loading state during navigation
 * - Keyboard accessible
 * - Responsive design
 * - Visual feedback on interaction
 *
 * UX Considerations:
 * - Shows loading spinner during transitions
 * - Preserves other query params
 * - Uses Next.js router for smooth page transitions
 * - Clear visual distinction for "All Time" option
 */
export default function WeekSelector({
  weekOptions,
  currentWeek,
  selectedWeek,
  labelMode = "week_open_utc",
  className = "",
}: WeekSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleWeekChange = (newWeek: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);

      if (newWeek === "all") {
        params.set("week", "all");
      } else {
        params.set("week", newWeek);
      }

      // Navigate with new params
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const formatOption = (week: WeekOption): string => {
    if (week === "all") {
      return "All Time";
    }
    const parsed = DateTime.fromISO(week, { zone: "America/New_York" });
    if (!parsed.isValid) {
      return week;
    }
    const labelDate =
      labelMode === "monday_et"
        ? parsed.plus({ days: 1 }).startOf("day")
        : parsed;
    return `Week of ${labelDate.toFormat("MMM dd, yyyy")}`;
  };

  const isCurrentWeek = (week: WeekOption): boolean => {
    return week !== "all" && week === currentWeek;
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <label
        htmlFor="week-selector"
        className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]"
      >
        Period
      </label>

      <div className="relative">
        <select
          id="week-selector"
          value={selectedWeek}
          onChange={(e) => handleWeekChange(e.target.value)}
          disabled={isPending}
          className={`
            appearance-none rounded-full border border-[var(--panel-border)]
            bg-[var(--panel)]/80 px-4 py-1.5 pr-10 text-xs font-semibold
            uppercase tracking-[0.2em] text-[color:var(--foreground)]
            transition-all duration-200
            hover:border-[var(--accent)] hover:bg-[var(--panel)]
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isPending ? "animate-pulse" : ""}
          `}
          aria-label="Select time period"
        >
          {weekOptions.map((week) => (
            <option key={week} value={week}>
              {formatOption(week)}
              {isCurrentWeek(week) ? " (Current)" : ""}
            </option>
          ))}
        </select>

        {/* Custom dropdown arrow */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {isPending ? (
            // Loading spinner
            <svg
              className="animate-spin h-4 w-4 text-[var(--accent)]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            // Chevron down
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[var(--muted)]"
              aria-hidden="true"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Accessibility: announce loading state to screen readers */}
      {isPending && (
        <span className="sr-only" role="status" aria-live="polite">
          Loading week data...
        </span>
      )}
    </div>
  );
}
