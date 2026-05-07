"use client";

import { useEffect, useMemo, useState } from "react";

type LoadingStatusTextProps = {
  finalLabel: string;
  phases?: string[];
  updateIntroLabel?: string;
  intervalMs?: number;
};

function withEllipsis(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("...") ? trimmed : `${trimmed}...`;
}

export default function LoadingStatusText({
  finalLabel,
  phases = [],
  updateIntroLabel = "Loading updates",
  intervalMs = 1100,
}: LoadingStatusTextProps) {
  const sequence = useMemo(() => {
    const cleanFinal = finalLabel.trim();
    const cleanPhases = phases.map((phase) => phase.trim()).filter(Boolean);
    if (cleanPhases.length === 0) return [cleanFinal];
    return [
      withEllipsis(updateIntroLabel),
      ...cleanPhases.map(withEllipsis),
      cleanFinal,
    ];
  }, [finalLabel, phases, updateIntroLabel]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (sequence.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= sequence.length - 1) return current;
        return current + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, sequence]);

  return <>{sequence[Math.min(index, sequence.length - 1)] ?? finalLabel}</>;
}
