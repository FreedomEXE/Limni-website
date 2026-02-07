"use client";

import { useState, useRef, useEffect } from "react";

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeVariant?: "default" | "success" | "warning" | "error";
  children: React.ReactNode;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
};

/**
 * Collapsible section component with smooth animations and accessibility
 *
 * Features:
 * - Smooth height transitions with CSS
 * - Keyboard accessible (Enter/Space to toggle)
 * - ARIA attributes for screen readers
 * - Optional badge with variants
 * - Customizable default state
 * - Callback for toggle events
 *
 * As a UI/UX expert, this component prioritizes:
 * - Performance (CSS transitions, no JS animation)
 * - Accessibility (keyboard nav, ARIA, semantic HTML)
 * - Visual feedback (hover states, focus rings)
 * - Smooth user experience (easing functions)
 */
export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  badge,
  badgeVariant = "default",
  children,
  className = "",
  onToggle,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto");
  const contentRef = useRef<HTMLDivElement>(null);

  // Update height when content changes or open state changes
  useEffect(() => {
    if (!contentRef.current) return;

    if (isOpen) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      // After transition completes, set to auto for dynamic content
      const timer = setTimeout(() => setContentHeight("auto"), 300);
      return () => clearTimeout(timer);
    } else {
      // Set explicit height before collapsing for smooth transition
      setContentHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => {
        setContentHeight(0);
      });
    }
  }, [isOpen]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  };

  const badgeColors = {
    default: "bg-[var(--accent)]/10 text-[var(--accent)]",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    error: "bg-rose-500/10 text-rose-600",
  };

  return (
    <section
      className={`rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-sm ${className}`}
    >
      {/* Header Button */}
      <button
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between p-6 text-left transition-colors duration-200 hover:bg-[var(--panel)]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        aria-expanded={isOpen}
        aria-controls={`section-content-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
            {badge !== undefined && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColors[badgeVariant]}`}
                aria-label={`Badge: ${badge}`}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-sm text-[color:var(--muted)]">{subtitle}</p>}
        </div>

        {/* Chevron Icon */}
        <div className="ml-4 flex-shrink-0 text-[var(--muted)] transition-transform duration-300 ease-out">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`transform transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : "rotate-0"}`}
            aria-hidden="true"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* Collapsible Content */}
      <div
        id={`section-content-${title.replace(/\s+/g, "-").toLowerCase()}`}
        ref={contentRef}
        style={{
          height: contentHeight === "auto" ? "auto" : `${contentHeight}px`,
        }}
        className="overflow-hidden transition-[height] duration-300 ease-out"
        aria-hidden={!isOpen}
      >
        <div className="border-t border-[var(--panel-border)] p-6">{children}</div>
      </div>
    </section>
  );
}
