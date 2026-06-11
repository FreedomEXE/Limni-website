/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: accountClassification.ts
 *
 * Description:
 * Presentation-only account grouping and phase inference helpers for the Accounts section.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type AccountPortfolioGroup = "prop" | "personal";
export type AccountPhase = "demo" | "challenge" | "verification" | "funded" | null;

export type AccountPresentationMeta = {
  portfolioGroup: AccountPortfolioGroup;
  portfolioLabel: string;
  accountTypeLabel: string;
  phase: AccountPhase;
  phaseLabel: string | null;
  phaseToneClass: string | null;
};

type ClassifyAccountOptions = {
  label?: string | null;
  broker?: string | null;
  server?: string | null;
  provider?: string | null;
  status?: string | null;
};

const PROP_TOKENS = [
  "5ers",
  "the5ers",
  "five percent",
  "fivepercent",
  "ftmo",
  "funded",
  "funding",
  "funding pips",
  "fundednext",
  "prop",
  "challenge",
  "verification",
  "phase 1",
  "phase 2",
  "evaluation",
];

function buildSearchHaystack(options: ClassifyAccountOptions) {
  return [
    options.label ?? "",
    options.broker ?? "",
    options.server ?? "",
    options.provider ?? "",
    options.status ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function resolvePhase(haystack: string, status: string, isProp: boolean): AccountPhase {
  if (!isProp) {
    return null;
  }
  if (haystack.includes("demo") || status === "DEMO") {
    return "demo";
  }
  if (haystack.includes("verification") || haystack.includes("phase 2")) {
    return "verification";
  }
  if (
    haystack.includes("challenge") ||
    haystack.includes("phase 1") ||
    haystack.includes("evaluation")
  ) {
    return "challenge";
  }
  if (haystack.includes("funded") || status === "LIVE") {
    return "funded";
  }
  return null;
}

function resolvePhaseToneClass(phase: AccountPhase) {
  if (phase === "demo") return "bg-slate-100 text-slate-700";
  if (phase === "challenge") return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
  if (phase === "verification") return "bg-sky-100 text-sky-700";
  if (phase === "funded") return "bg-emerald-100 text-emerald-700";
  return null;
}

function resolvePhaseLabel(phase: AccountPhase) {
  if (phase === "demo") return "Demo";
  if (phase === "challenge") return "Challenge";
  if (phase === "verification") return "Verification";
  if (phase === "funded") return "Funded";
  return null;
}

export function classifyAccountPresentation(
  options: ClassifyAccountOptions,
): AccountPresentationMeta {
  const haystack = buildSearchHaystack(options);
  const status = String(options.status ?? "").toUpperCase();
  const isProp = PROP_TOKENS.some((token) => haystack.includes(token));
  const phase = resolvePhase(haystack, status, isProp);

  return {
    portfolioGroup: isProp ? "prop" : "personal",
    portfolioLabel: isProp ? "Prop Funds" : "Personal Accounts",
    accountTypeLabel: isProp ? "Prop Account" : "Personal Account",
    phase,
    phaseLabel: resolvePhaseLabel(phase),
    phaseToneClass: resolvePhaseToneClass(phase),
  };
}
