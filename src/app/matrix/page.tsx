/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: matrix/page.tsx
 *
 * Description:
 * Consolidated matrix workspace hosting the CFD, Crypto, and
 * Flagship pills on a single route.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Link from "next/link";

import DashboardLayout from "@/components/DashboardLayout";
import CryptoBoard from "@/components/flagship/CryptoBoard";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";
import SwingForwardBoard from "@/components/flagship/SwingForwardBoard";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";

export const dynamic = "force-dynamic";

const DEFAULT_FLAGSHIP_STRATEGY = "universal_v1_gated";

type MatrixPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveTab(value: string | string[] | undefined) {
  if (typeof value !== "string") return "cfd" as const;
  const normalized = value.toLowerCase();
  if (normalized === "crypto" || normalized === "flagship") return normalized;
  return "cfd" as const;
}

async function resolveWeeklyFlagshipView() {
  try {
    const flagships = await resolveCanonicalFlagships();
    return {
      strategyName: flagships.weekly.strategyName,
      sourceLabel:
        flagships.weekly.status === "locked"
          ? flagships.weekly.sourceLabel
          : "Awaiting canonical flagship selection",
    };
  } catch {
    return {
      strategyName: "Awaiting canonical data",
      sourceLabel: "Awaiting canonical flagship selection",
    };
  }
}

export default async function MatrixPage({ searchParams }: MatrixPageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const selectedTab = resolveTab(resolvedSearchParams.tab);
  const strategy = process.env.FLAGSHIP_STRATEGY?.trim() || DEFAULT_FLAGSHIP_STRATEGY;
  const weeklyFlagshipView =
    selectedTab === "flagship" ? await resolveWeeklyFlagshipView() : null;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
          {[
            { key: "cfd", href: "/matrix", label: "CFD" },
            { key: "crypto", href: "/matrix?tab=crypto", label: "Crypto" },
            { key: "flagship", href: "/matrix?tab=flagship", label: "Flagship" },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                selectedTab === tab.key
                  ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {selectedTab === "crypto" ? <CryptoBoard /> : null}
        {selectedTab === "cfd" ? <FlagshipBoard strategy={strategy} /> : null}
        {selectedTab === "flagship" && weeklyFlagshipView ? (
          <SwingForwardBoard
            strategyName={weeklyFlagshipView.strategyName}
            sourceLabel={weeklyFlagshipView.sourceLabel}
          />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
