"use client";

import { useEffect } from "react";

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

export default function ThemeInit() {
  useEffect(() => {
    const theme = getPreferredTheme();
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
