/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AutomationResearchCards.tsx
 *
 * Description:
 * Static card definitions for the simplified Automation research hub navigation.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
import AutomationViewCards, {
type AutomationViewCard,
} from "@/components/automation/AutomationViewCards";

type ResearchPageKey = "lab" | "universal" | "baskets" | "symbols" | "bank" | "strategies";
type ResearchCardPageKey = "overview" | ResearchPageKey;

const RESEARCH_CARDS: ReadonlyArray<AutomationViewCard<ResearchCardPageKey>> = [
  {
    id: "overview",
    label: "Overview",
    description: "Canonical research hub with flagship curves and drilldown links.",
    href: "/automation/research",
  },
  {
    id: "strategies",
    label: "Strategies",
    description: "DB-backed strategy backtest runs, coverage, and metrics.",
    href: "/automation/research/strategies",
  },
  {
    id: "universal",
    label: "Universal",
    description: "Combined basket simulation across all models.",
    href: "/automation/research/universal",
  },
  {
    id: "baskets",
    label: "Legacy Baskets",
    description: "Older per-model basket simulation pages retained for internal comparison.",
    href: "/automation/research/baskets",
  },
  {
    id: "symbols",
    label: "Symbols",
    description: "Per-symbol performance and model overlays.",
    href: "/automation/research/symbols",
  },
  {
    id: "bank",
    label: "Bank",
    description: "Bank participation futures/options comparison.",
    href: "/automation/research/bank",
  },
];

export default function AutomationResearchCards({
  active,
}: {
  active: ResearchCardPageKey;
}) {
  return <AutomationViewCards active={active} cards={RESEARCH_CARDS} />;
}
