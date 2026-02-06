"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem("limni-theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem("limni-theme", theme);
}

type ThemeToggleProps = {
  compact?: boolean;
};

export default function ThemeToggle({ compact }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        applyTheme(next);
      }}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] ${
        compact ? "px-2 py-2 tracking-[0.1em]" : ""
      }`}
    >
      {theme === "light" ? "Dark mode" : "Light mode"}
    </button>
  );
}
