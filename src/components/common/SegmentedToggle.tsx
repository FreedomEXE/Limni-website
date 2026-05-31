/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: SegmentedToggle.tsx
 *
 * Description:
 * Shared segmented-pill toggle primitive for view switches and mode controls.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import Link from "next/link";

export type SegmentedToggleItem<T extends string> = {
  value: T;
  label: string;
  tooltip?: string;
  href?: string;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  items: readonly SegmentedToggleItem<T>[];
  onChange?: (next: T) => void;
  ariaLabel?: string;
  size?: "sm" | "md";
};

export default function SegmentedToggle<T extends string>({
  value,
  items,
  onChange,
  ariaLabel,
  size = "md",
}: SegmentedToggleProps<T>) {
  const sizeClasses = size === "sm"
    ? "px-2.5 py-0.5 text-[10px]"
    : "px-3 py-1 text-xs";

  const baseClass = `${sizeClasses} rounded-full border transition`;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-full border border-(--panel-border) bg-(--panel)/70 p-1 font-semibold uppercase tracking-[0.2em] text-(--muted)"
    >
      {items.map((item) => {
        const active = value === item.value;
        const className = `${baseClass} ${
          active
            ? "border-(--accent) bg-(--accent) text-background shadow-[0_0_0_1px_var(--accent)]"
            : "border-transparent text-(--muted) hover:text-(--accent-strong)"
        }`;

        if (!onChange && item.href) {
          return (
            <Link
              key={item.value}
              href={item.href}
              scroll={false}
              title={item.tooltip}
              aria-pressed={active}
              data-state={active ? "active" : "inactive"}
              className={className}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange?.(item.value)}
            title={item.tooltip}
            aria-pressed={active}
            data-state={active ? "active" : "inactive"}
            className={className}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
