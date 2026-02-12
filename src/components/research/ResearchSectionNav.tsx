"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/automation/research/universal", label: "Universal" },
  { href: "/automation/research/baskets", label: "Other Baskets" },
  { href: "/automation/research/symbols", label: "Symbols" },
  { href: "/automation/research/bank", label: "Bank COT" },
];

export default function ResearchSectionNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");
  const modeParam = searchParams.get("mode");

  return (
    <div className="inline-flex rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        const params = new URLSearchParams();
        if (weekParam) params.set("week", weekParam);
        if (modeParam) params.set("mode", modeParam);
        const href = params.toString().length > 0 ? `${link.href}?${params.toString()}` : link.href;
        return (
          <Link
            key={link.href}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              active
                ? "bg-[var(--accent)] text-white"
                : "text-[color:var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
