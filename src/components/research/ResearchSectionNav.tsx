"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/automation/research/universal", label: "Universal" },
  { href: "/automation/research/baskets", label: "Other Baskets" },
];

export default function ResearchSectionNav() {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
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
