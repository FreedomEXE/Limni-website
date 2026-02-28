/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: ScrollableWeekStrip.tsx
 *
 * Description:
 * Universal scrollable week selector used across all pages.
 * Shows ~5 visible pill buttons with left/right scroll arrows
 * for overflow. Replaces all <select> dropdowns for week selection.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import type { WeekOption } from "@/lib/weekState";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

type ScrollableWeekStripProps = {
  /** All week options — can include "all" as first element. */
  options: WeekOption[];
  /** Currently selected week value (ISO string or "all"). */
  selected: WeekOption;
  /** Optional: current live week ISO for badge annotation. */
  currentWeek?: string;
  /** Label shown before the strip. Default "Week". */
  label?: string;
  /** Controls how week dates are displayed. */
  labelMode?: "week_open_utc" | "monday_et";
  /** Optional custom label formatter — overrides labelMode when provided. */
  labelFormatter?: (value: WeekOption) => string;
  /** Optional callback for determining current/live option badge. */
  isCurrentOption?: (value: WeekOption) => boolean;
  /** URL search param name for the week. Default "week". */
  paramName?: string;
  /** Optional whitelist of params to preserve. Defaults to preserving all existing params. */
  preserveParams?: string[];
  /** If true, calls router.replace instead of router.push. Default false. */
  replaceState?: boolean;
  /** External callback instead of URL navigation. */
  onChange?: (value: WeekOption) => void;
  /** Extra wrapper className. */
  className?: string;
  /** Prefetch radius around selected option for faster switching. Default 2. */
  prefetchRadius?: number;
};

function formatWeekLabel(week: WeekOption, labelMode: "week_open_utc" | "monday_et"): string {
  if (week === "all") return "All Time";
  const parsed =
    labelMode === "monday_et"
      ? DateTime.fromISO(week, { zone: "America/New_York" })
      : DateTime.fromISO(week, { zone: "utc" });
  if (!parsed.isValid) return week;
  const labelDate =
    labelMode === "monday_et"
      ? parsed.plus({ days: 1 }).startOf("day")
      : parsed.weekday === 7
        ? parsed.plus({ days: 1 }).startOf("day")
        : parsed;
  return labelDate.toFormat("MMM dd");
}

export default function ScrollableWeekStrip({
  options,
  selected,
  currentWeek,
  label = "Week",
  labelMode = "week_open_utc",
  labelFormatter,
  isCurrentOption,
  paramName = "week",
  preserveParams,
  replaceState = false,
  onChange,
  className = "",
  prefetchRadius = 2,
}: ScrollableWeekStripProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [optimisticSelected, setOptimisticSelected] = useState<WeekOption>(selected);

  useEffect(() => {
    setOptimisticSelected(selected);
  }, [selected]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    setHasOverflow(el.scrollWidth > el.clientWidth + 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState, options.length]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(updateScrollState);
    const timeout = window.setTimeout(updateScrollState, 80);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [updateScrollState, options, optimisticSelected]);

  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const pill = selectedRef.current;
      const pillLeft = pill.offsetLeft;
      const pillRight = pillLeft + pill.offsetWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;
      if (pillLeft < viewLeft || pillRight > viewRight) {
        container.scrollTo({
          left: pillLeft - container.clientWidth / 2 + pill.offsetWidth / 2,
          behavior: "smooth",
        });
      }
    }
  }, [optimisticSelected]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const pillWidth = 110;
    const delta = pillWidth * 3;
    el.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
  };

  const buildUrl = useCallback(
    (week: WeekOption) => {
      const current = new URLSearchParams(searchParams.toString());
      const params = new URLSearchParams();
      if (preserveParams && preserveParams.length > 0) {
        for (const key of preserveParams) {
          const val = current.get(key);
          if (val) params.set(key, val);
        }
      } else {
        current.forEach((value, key) => {
          params.append(key, value);
        });
      }
      params.set(paramName, week);
      const qs = params.toString();
      return qs.length > 0 ? `${pathname}?${qs}` : pathname;
    },
    [searchParams, preserveParams, paramName, pathname],
  );

  const handleSelect = (week: WeekOption) => {
    if (week === optimisticSelected) {
      return;
    }
    setOptimisticSelected(week);
    if (onChange) {
      onChange(week);
      return;
    }
    const url = buildUrl(week);
    if (replaceState) {
      router.replace(url, { scroll: false });
    } else {
      router.push(url, { scroll: false });
    }
  };

  const onWheelScroll = (event: WheelEvent<HTMLDivElement>) => {
    if (!hasOverflow) return;
    const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (Math.abs(horizontalDelta) < 1) return;
    event.currentTarget.scrollBy({ left: horizontalDelta });
  };

  const isCurrentWeek = (week: WeekOption): boolean => {
    if (week === "all") return false;
    if (isCurrentOption) {
      try {
        return Boolean(isCurrentOption(week));
      } catch {
        return false;
      }
    }
    if (!currentWeek) return false;
    const normalizedWeek = normalizeWeekOpenUtc(week);
    const normalizedCurrentWeek = normalizeWeekOpenUtc(currentWeek);
    if (normalizedWeek && normalizedCurrentWeek) {
      return normalizedWeek === normalizedCurrentWeek;
    }
    return week === currentWeek;
  };

  useEffect(() => {
    if (onChange) {
      return;
    }
    if (!Number.isFinite(prefetchRadius) || prefetchRadius <= 0) {
      return;
    }
    const selectedIndex = options.findIndex((option) => option === optimisticSelected);
    if (selectedIndex < 0) {
      return;
    }
    const start = Math.max(0, selectedIndex - prefetchRadius);
    const end = Math.min(options.length - 1, selectedIndex + prefetchRadius);
    const toPrefetch = options.slice(start, end + 1).filter((option) => option !== optimisticSelected);
    if (toPrefetch.length === 0) {
      return;
    }
    const prefetchWork = () => {
      for (const option of toPrefetch) {
        router.prefetch(buildUrl(option));
      }
    };
    const hasIdle = "requestIdleCallback" in window;
    if (hasIdle) {
      const id = window.requestIdleCallback(prefetchWork);
      return () => window.cancelIdleCallback(id);
    }
    const timeout = window.setTimeout(prefetchWork, 50);
    return () => window.clearTimeout(timeout);
  }, [onChange, prefetchRadius, options, optimisticSelected, router, buildUrl]);

  const fallbackOverflow = options.length > 7;
  const showOverflowControls = hasOverflow || fallbackOverflow;
  const showScrollLeft = showOverflowControls && canScrollLeft;
  const showScrollRight =
    showOverflowControls && (canScrollRight || (!canScrollLeft && fallbackOverflow));

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${className}`}>
      <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </span>

      <div className="relative min-w-0 flex-1">
        {showScrollLeft ? (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll weeks left"
            className="absolute left-0 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}

        <div
          ref={scrollRef}
          onWheel={onWheelScroll}
          className={`scrollbar-hidden flex w-full gap-1.5 overflow-x-auto scroll-smooth py-1 ${
            showOverflowControls ? "px-10" : "px-1"
          }`}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {options.map((week) => {
            const isSelected = week === optimisticSelected;
            const isCurrent = isCurrentWeek(week);
            return (
              <button
                key={week}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                onClick={() => handleSelect(week)}
                className={`
                  relative shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold
                  uppercase tracking-[0.15em] transition-all duration-200
                  ${isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)] shadow-sm"
                    : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
                  }
                `}
              >
                {labelFormatter ? labelFormatter(week) : formatWeekLabel(week, labelMode)}
                {isCurrent ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                ) : null}
              </button>
            );
          })}
        </div>

        {showScrollRight ? (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll weeks right"
            className="absolute right-0 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
