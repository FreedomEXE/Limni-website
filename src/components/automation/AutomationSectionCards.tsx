import AutomationViewCards, {
  type AutomationViewCard,
} from "@/components/automation/AutomationViewCards";

type AutomationSectionKey = "bots" | "research";

const SECTION_CARDS: ReadonlyArray<AutomationViewCard<AutomationSectionKey>> = [
  {
    id: "bots",
    label: "Bots",
    description: "Live automation dashboards and bot status.",
    href: "/automation/bots",
  },
  {
    id: "research",
    label: "Research",
    description: "Backtests, diagnostics, and strategy experiments.",
    href: "/automation/research",
  },
];

export default function AutomationSectionCards({
  active,
}: {
  active: AutomationSectionKey;
}) {
  return <AutomationViewCards active={active} cards={SECTION_CARDS} />;
}
