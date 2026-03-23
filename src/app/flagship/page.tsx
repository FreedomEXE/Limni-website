/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: flagship/page.tsx
 *
 * Description:
 * Flagship manual-trading board route that hosts the
 * session-aware gated setup dashboard.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import CryptoBoard from "@/components/flagship/CryptoBoard";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DEFAULT_FLAGSHIP_STRATEGY = "universal_v1_gated";

type FlagshipPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FlagshipPage({ searchParams }: FlagshipPageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const tabParam = resolvedSearchParams.tab;
  const selectedTab =
    typeof tabParam === "string" && tabParam.toLowerCase() === "crypto" ? "crypto" : "cfd";
  const strategy = process.env.FLAGSHIP_STRATEGY?.trim() || DEFAULT_FLAGSHIP_STRATEGY;
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
          <Link
            href="/flagship"
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              selectedTab === "cfd"
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            }`}
          >
            CFD
          </Link>
          <Link
            href="/flagship?tab=crypto"
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              selectedTab === "crypto"
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            }`}
          >
            Crypto
          </Link>
        </div>
        {selectedTab === "crypto" ? <CryptoBoard /> : <FlagshipBoard strategy={strategy} />}
      </div>
    </DashboardLayout>
  );
}
