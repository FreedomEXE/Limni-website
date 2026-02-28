import AutomationViewCards, {
  type AutomationViewCard,
} from "@/components/automation/AutomationViewCards";

type ResearchPageKey = "lab" | "universal" | "baskets" | "symbols" | "bank";

const RESEARCH_CARDS: ReadonlyArray<AutomationViewCard<ResearchPageKey>> = [
  {
    id: "lab",
    label: "Lab",
    description: "Build custom runs and compare research configs.",
    href: "/automation/research/lab",
  },
  {
    id: "universal",
    label: "Universal",
    description: "Combined basket simulation across all models.",
    href: "/automation/research/universal",
  },
  {
    id: "baskets",
    label: "Baskets",
    description: "Per-model basket simulation and weekly tables.",
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
  active: ResearchPageKey;
}) {
  return <AutomationViewCards active={active} cards={RESEARCH_CARDS} />;
}
