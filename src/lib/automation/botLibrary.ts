/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: botLibrary.ts
 *
 * Description:
 * Canonical bot-library metadata for the Automation section. Drives the
 * whitepaper-style bot index and per-bot profile pages.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type AutomationBotStatus = "ready" | "research" | "paused";

export type AutomationBotEntry = {
  id: string;
  route: string;
  cardId:
    | "weekly-basket"
    | "bitget"
    | "bitget-lite"
    | "mt5-forex"
    | "mt5-forex-lite"
    | "solana";
  title: string;
  category: "swing" | "intraday" | "experimental";
  status: AutomationBotStatus;
  statusLabel: string;
  summary: string;
  thesis: string;
  currentDecision: string;
  whatExists: string[];
  nextSteps: string[];
  sourceDocs: string[];
  surfaces: string[];
};

export const AUTOMATION_BOT_LIBRARY: readonly AutomationBotEntry[] = [
  {
    id: "weekly-basket",
    route: "/automation/bots/weekly-basket",
    cardId: "weekly-basket",
    title: "Weekly Basket EA",
    category: "swing",
    status: "ready",
    statusLabel: "Built / Ops Reference",
    summary:
      "Execution substrate for weekly basket trading and account-side reporting, aligned to the swing flagship track.",
    thesis:
      "This page should document the weekly basket execution stack and operator workflow rather than act like a live bot monitor.",
    currentDecision:
      "Keep this as the clean automation reference for weekly basket execution while the public swing flagship is finalized elsewhere in the app.",
    whatExists: [
      "Weekly basket execution and planning flow for MT5-style accounts.",
      "Account/reporting integration already exists elsewhere in the platform.",
      "The architecture is modular enough to support Universal/Tiered-style basket plans.",
    ],
    nextSteps: [
      "Align the execution story to the locked weekly flagship once the manual/EA split is finalized.",
      "Add the lightweight weekly MT5 push script so account reporting stays current without manual page fixes.",
      "Keep account sync/reporting logic separate from strategy marketing copy.",
    ],
    sourceDocs: [
      "docs/features/MT5_FOREX_BOT_PAGE.md",
      "docs/plan.md",
      "docs/ea-refactor-progress.md",
    ],
    surfaces: ["Accounts", "Swing", "MT5 sync"],
  },
  {
    id: "katarakti-crypto",
    route: "/automation/bots/bitget",
    cardId: "bitget",
    title: "Katarakti Crypto",
    category: "intraday",
    status: "paused",
    statusLabel: "Paused / Under Review",
    summary:
      "Original Bitget sweep-entry automation stack with live monitoring, signal logging, and market-data overlays.",
    thesis:
      "The crypto implementation proved the monitoring and execution framework, but it is not the currently promoted intraday flagship.",
    currentDecision:
      "Treat the Bitget core worker as paused research infrastructure until the intraday flagship scope is relocked. Do not present it as an active production bot.",
    whatExists: [
      "Crypto sweep-entry engine with lifecycle, trade history, and signal monitoring.",
      "Supporting research on liquidation, sweep behavior, and gating.",
      "Dashboard patterns that can still inform the future intraday forward-test board.",
    ],
    nextSteps: [
      "Decide whether to retire the current Bitget worker or rebuild it around the lean intraday flagship board.",
      "If revived, scope it around entry qualification and forward testing rather than the old full monitoring stack.",
    ],
    sourceDocs: [
      "docs/bots/bitget-bot-architecture.md",
      "docs/bots/bitget-bot-strategy.md",
      "docs/bots/KATARAKTI_CLEANUP_PLAN_2026-03-21.md",
      "docs/bots/UNIFIED_KATARAKTI_GATED_SWEEP_RESULTS_2026-03-22.md",
    ],
    surfaces: ["Intraday", "Bitget", "Research"],
  },
  {
    id: "katarakti-crypto-lite",
    route: "/automation/bots/bitget-lite",
    cardId: "bitget-lite",
    title: "Katarakti Crypto Lite",
    category: "intraday",
    status: "paused",
    statusLabel: "Paused / Sidecar Research",
    summary:
      "Simplified crypto variant created for side-by-side behavior comparison against the original Bitget stack.",
    thesis:
      "The lite branch is useful as research evidence, but it should not consume mindshare or infrastructure unless the intraday program explicitly needs it.",
    currentDecision:
      "Keep the lite variant documented as a research branch only. It is not a promoted bot and should not drive the Automation section narrative.",
    whatExists: [
      "Alternative crypto entry logic with reduced complexity.",
      "Comparable dashboard and telemetry patterns for side-by-side testing.",
    ],
    nextSteps: [
      "Either fold the useful entry ideas into the next intraday design or retire the branch cleanly.",
    ],
    sourceDocs: [
      "docs/bots/bitget-v2-strategy-decisions.md",
      "docs/bots/bitget-v3-research-session-2026-03-01.md",
      "docs/bots/KATARAKTI_CLEANUP_PLAN_2026-03-21.md",
    ],
    surfaces: ["Intraday", "Bitget", "Research"],
  },
  {
    id: "katarakti-cfd",
    route: "/automation/bots/mt5-forex",
    cardId: "mt5-forex",
    title: "Katarakti CFD",
    category: "intraday",
    status: "research",
    statusLabel: "Research Track",
    summary:
      "CFD sweep-entry execution path across FX, indices, and commodities with tiered bias and stop-management logic.",
    thesis:
      "This is still part of the intraday research stack, not the finalized intraday flagship. The page should document what exists and what remains unresolved.",
    currentDecision:
      "Keep the CFD branch visible as research infrastructure while intraday forward-testing scope is finalized. Do not market it as a locked strategy.",
    whatExists: [
      "CFD sweep-entry engine covering the core tracked multi-asset universe.",
      "Signal, trade, correlation, and performance diagnostics already built.",
      "Recent normalization and reset work clarified what still needs relocking.",
    ],
    nextSteps: [
      "Define the lean intraday forward-test board and entry-qualification states.",
      "Separate reusable intraday framework pieces from old Katarakti-specific assumptions.",
    ],
    sourceDocs: [
      "docs/bots/CFD_TRIGGER_PROGRESS_AND_KATARAKTI_RESET_2026-03-21.md",
      "docs/bots/KATARAKTI_8WEEK_NORMALIZATION_RESULTS_2026-03-22.md",
      "docs/bots/SWEEP_EXIT_RESEARCH_RESULTS_2026-03-22.md",
    ],
    surfaces: ["Intraday", "CFD", "Research"],
  },
  {
    id: "katarakti-cfd-lite",
    route: "/automation/bots/mt5-forex-lite",
    cardId: "mt5-forex-lite",
    title: "Katarakti CFD Lite",
    category: "intraday",
    status: "research",
    statusLabel: "Research Branch",
    summary:
      "Reduced-complexity CFD variant for comparing re-entry and behavior assumptions against the core CFD branch.",
    thesis:
      "The lite CFD branch is useful as a documented experiment, not as a flagship candidate on its own.",
    currentDecision:
      "Document it as a research branch and avoid giving it equal billing with the final intraday direction.",
    whatExists: [
      "Side-by-side CFD variant with simplified re-entry behavior.",
      "Shared diagnostics that still inform the intraday design process.",
    ],
    nextSteps: [
      "Keep only the ideas that survive the intraday relock; retire the rest cleanly.",
    ],
    sourceDocs: [
      "docs/bots/CFD_TRIGGER_PROGRESS_AND_KATARAKTI_RESET_2026-03-21.md",
      "docs/bots/KATARAKTI_CLEANUP_PLAN_2026-03-21.md",
    ],
    surfaces: ["Intraday", "CFD", "Research"],
  },
  {
    id: "solana-meme",
    route: "/automation/solana-meme-bot",
    cardId: "solana",
    title: "Solana Meme Bot",
    category: "experimental",
    status: "research",
    statusLabel: "Experimental",
    summary:
      "High-volatility Solana meme trading experiment with recoup and moonbag tracking.",
    thesis:
      "This is a separate experimental branch and should stay clearly separated from flagship trading infrastructure.",
    currentDecision:
      "Keep the experiment documented, but do not let it compete with the swing or intraday flagship narrative.",
    whatExists: [
      "Signal summary endpoint and tracking dashboard.",
      "Experimental accounting for recoup and moonbag behavior.",
    ],
    nextSteps: [
      "Decide later whether it remains an internal lab experiment or graduates into a dedicated product area.",
    ],
    sourceDocs: [
      "src/app/automation/solana-meme-bot/page.tsx",
    ],
    surfaces: ["Experimental", "Crypto", "Lab"],
  },
] as const;

export function listAutomationBotEntries() {
  return [...AUTOMATION_BOT_LIBRARY];
}

export function getAutomationBotEntryById(id: string) {
  return AUTOMATION_BOT_LIBRARY.find((entry) => entry.id === id) ?? null;
}
