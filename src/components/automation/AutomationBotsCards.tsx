import AutomationViewCards, {
  type AutomationViewCard,
} from "@/components/automation/AutomationViewCards";

type BotPageKey = "overview" | "bitget" | "katarakti" | "solana";

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
    id: "katarakti",
    label: "Katarakti",
    description: "MT5 sweep-entry dashboard and diagnostics.",
    href: "/automation/bots/mt5-forex",
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
