import AutomationViewCards, {
  type AutomationViewCard,
} from "@/components/automation/AutomationViewCards";

type BotPageKey = "overview" | "bitget" | "bitget-lite" | "katarakti" | "katarakti-lite" | "solana";

const BOT_CARDS: ReadonlyArray<AutomationViewCard<BotPageKey>> = [
  {
    id: "overview",
    label: "Bots",
    description: "All automation bots and status at a glance.",
    href: "/automation/bots",
  },
  {
    id: "bitget",
    label: "Katarakti (Bitget)",
    description: "Crypto futures sweep-entry automation monitoring.",
    href: "/automation/bots/bitget",
  },
  {
    id: "bitget-lite",
    label: "Katarakti Crypto Lite",
    description: "Simplified crypto entry rules for side-by-side validation.",
    href: "/automation/bots/bitget-lite",
  },
  {
    id: "katarakti",
    label: "Katarakti (CFD)",
    description: "CFD sweep-entry dashboard and diagnostics.",
    href: "/automation/bots/mt5-forex",
  },
  {
    id: "katarakti-lite",
    label: "Katarakti CFD Lite",
    description: "Simplified CFD entry rules for side-by-side validation.",
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
  active: BotPageKey;
}) {
  return <AutomationViewCards active={active} cards={BOT_CARDS} />;
}
