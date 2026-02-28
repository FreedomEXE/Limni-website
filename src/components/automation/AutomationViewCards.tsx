"use client";

import { useRouter } from "next/navigation";
import PerformanceViewCards, {
  type ViewCardDefinition,
} from "@/components/performance/PerformanceViewCards";

export type AutomationViewCard<T extends string> = ViewCardDefinition<T> & {
  href: string;
};

type AutomationViewCardsProps<T extends string> = {
  active: T;
  cards: ReadonlyArray<AutomationViewCard<T>>;
};

export default function AutomationViewCards<T extends string>({
  active,
  cards,
}: AutomationViewCardsProps<T>) {
  const router = useRouter();

  return (
    <PerformanceViewCards
      activeView={active}
      views={cards}
      onViewChange={(next) => {
        if (next === active) return;
        const target = cards.find((card) => card.id === next);
        if (!target) return;
        router.push(target.href);
      }}
    />
  );
}
