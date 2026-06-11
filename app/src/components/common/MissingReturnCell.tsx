"use client";

type Props = {
  reason?: string;
  className?: string;
};

export default function MissingReturnCell({ reason, className }: Props) {
  const label = reason ?? "Data unavailable";
  return (
    <span
      className={`text-(--muted)/40 ${className ?? ""}`}
      title={label}
      aria-label={label}
    >
      —
    </span>
  );
}
