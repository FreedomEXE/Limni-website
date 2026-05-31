/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: useDisclosureHeight.ts
 *
 * Description:
 * Shared measured-height transition hook for disclosure content.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useRef, useState } from "react";

export function useDisclosureHeight(isOpen: boolean, durationMs = 300) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    if (!contentRef.current) return;

    if (isOpen) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      const timer = setTimeout(() => setContentHeight("auto"), durationMs);
      return () => clearTimeout(timer);
    }

    setContentHeight(contentRef.current.scrollHeight);
    requestAnimationFrame(() => {
      setContentHeight(0);
    });
  }, [durationMs, isOpen]);

  return {
    contentRef,
    contentStyle: {
      height: contentHeight === "auto" ? "auto" : `${contentHeight}px`,
    },
  };
}
