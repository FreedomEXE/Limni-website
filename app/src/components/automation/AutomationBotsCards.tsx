import AutomationViewCards, {
  type AutomationViewCard,
} from "@/components/automation/AutomationViewCards";

type UpdatedBotPageKey =
  | "overview"
  | "weekly-basket"
  | "bitget"
  | "bitget-lite"
  | "mt5-forex"
  | "mt5-forex-lite"
  | "solana";

const BOT_CARDS: ReadonlyArray<AutomationViewCard<UpdatedBotPageKey>> = [
  {
    id: "overview",
    label: "Bots",
    description: "Documentation-first index of what exists, what is paused, and what is still in research.",
    href: "/automation/bots",
  },
  {
    id: "weekly-basket",
    label: "Weekly Basket EA",
    description: "Swing execution and ops reference for weekly basket trading.",
    href: "/automation/bots/weekly-basket",
  },
  {
    id: "bitget",
    label: "Katarakti (Bitget)",
    description: "Paused crypto sweep-entry stack documented as research infrastructure.",
    href: "/automation/bots/bitget",
  },
  {
    id: "bitget-lite",
    label: "Katarakti Crypto Lite",
    description: "Lite crypto side-branch kept as documentation, not a promoted bot.",
    href: "/automation/bots/bitget-lite",
  },
  {
    id: "mt5-forex",
    label: "Katarakti (CFD)",
    description: "CFD intraday research branch and current scope notes.",
    href: "/automation/bots/mt5-forex",
  },
  {
    id: "mt5-forex-lite",
    label: "Katarakti CFD Lite",
    description: "Lite CFD branch documented as comparative research only.",
    href: "/automation/bots/mt5-forex-lite",
  },
  {
    id: "solana",
    label: "Solana Meme",
    description: "Recoup/moonbag tracking and sim telemetry.",
    href: "/automation/solana-meme-bot",
  },
];

export default function AutomationBotsCards({
  active,
}: {
  active: UpdatedBotPageKey;
}) {
  return <AutomationViewCards active={active} cards={BOT_CARDS} />;
}
