/*
-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------
*/

"use client";

import { useEffect, useMemo, useState } from "react";
import type { PerformanceSystem } from "@/lib/performance/modelConfig";
import type { KataraktiMarket, KataraktiVariant } from "@/lib/performance/kataraktiHistory";
import {
  PERFORMANCE_FAMILY_META,
  resolveActiveStrategyEntry,
  type PerformanceStrategyFamily,
} from "@/lib/performance/strategyRegistry";

type PerformanceHeaderContextProps = {
  initialStyle: PerformanceStrategyFamily;
  initialSystem: PerformanceSystem;
  initialKataraktiMarket: KataraktiMarket;
  initialKataraktiVariant: KataraktiVariant;
  className?: string;
};

export default function PerformanceHeaderContext({
  initialStyle,
  initialSystem,
  initialKataraktiMarket,
  initialKataraktiVariant,
  className,
}: PerformanceHeaderContextProps) {
  const [style, setStyle] = useState<PerformanceStrategyFamily>(initialStyle);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const initialEntry = resolveActiveStrategyEntry({
    family: "katarakti",
    kataraktiVariant: initialKataraktiVariant,
    kataraktiMarket: initialKataraktiMarket,
  });
  const [kataraktiMarket, setKataraktiMarket] = useState<KataraktiMarket>(
    initialEntry?.market ?? initialKataraktiMarket,
  );
  const [kataraktiVariant, setKataraktiVariant] = useState<KataraktiVariant>(
    initialEntry?.kataraktiVariant ?? initialKataraktiVariant,
  );

  useEffect(() => {
    const onSystemChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceSystem>;
      if (custom.detail === "v1" || custom.detail === "v2" || custom.detail === "v3") {
        setSystem(custom.detail);
      }
    };

    const onStyleChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceStrategyFamily>;
      if (custom.detail === "universal" || custom.detail === "tiered" || custom.detail === "katarakti") {
        setStyle(custom.detail);
      }
    };

    const onKataraktiMarketChange = (event: Event) => {
      const custom = event as CustomEvent<KataraktiMarket>;
      if (custom.detail === "crypto_futures" || custom.detail === "mt5_forex") {
        const resolved = resolveActiveStrategyEntry({
          family: "katarakti",
          kataraktiVariant,
          kataraktiMarket: custom.detail,
        });
        setKataraktiMarket(resolved?.market ?? custom.detail);
        setKataraktiVariant(resolved?.kataraktiVariant ?? kataraktiVariant);
      }
    };

    const onKataraktiVariantChange = (event: Event) => {
      const custom = event as CustomEvent<KataraktiVariant>;
      if (custom.detail === "core" || custom.detail === "lite" || custom.detail === "v3") {
        const resolved = resolveActiveStrategyEntry({
          family: "katarakti",
          kataraktiVariant: custom.detail,
          kataraktiMarket,
        });
        setKataraktiVariant(resolved?.kataraktiVariant ?? custom.detail);
        setKataraktiMarket(resolved?.market ?? kataraktiMarket);
      }
    };

    const syncFromUrl = () => {
      if (typeof window === "undefined") return;
      const params = new URL(window.location.href).searchParams;
      const styleParam = params.get("style");
      const systemParam = params.get("system");
      const marketParam = params.get("market");
      const variantParam = params.get("variant");
      if (styleParam === "universal" || styleParam === "tiered" || styleParam === "katarakti") {
        setStyle(styleParam);
      }
      if (systemParam === "v1" || systemParam === "v2" || systemParam === "v3") {
        setSystem(systemParam);
      }
      const nextMarket = marketParam === "mt5_forex" ? "mt5_forex" : "crypto_futures";
      const nextVariant =
        variantParam === "lite" ? "lite" : variantParam === "v3" ? "v3" : "core";
      const resolved = resolveActiveStrategyEntry({
        family: "katarakti",
        kataraktiVariant: nextVariant,
        kataraktiMarket: nextMarket,
      });
      setKataraktiMarket(resolved?.market ?? nextMarket);
      setKataraktiVariant(resolved?.kataraktiVariant ?? nextVariant);
    };

    window.addEventListener("performance-system-change", onSystemChange);
    window.addEventListener("performance-style-change", onStyleChange);
    window.addEventListener("performance-katarakti-market-change", onKataraktiMarketChange);
    window.addEventListener("performance-katarakti-variant-change", onKataraktiVariantChange);
    window.addEventListener("popstate", syncFromUrl);

    return () => {
      window.removeEventListener("performance-system-change", onSystemChange);
      window.removeEventListener("performance-style-change", onStyleChange);
      window.removeEventListener("performance-katarakti-market-change", onKataraktiMarketChange);
      window.removeEventListener("performance-katarakti-variant-change", onKataraktiVariantChange);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, [kataraktiMarket, kataraktiVariant]);

  const text = useMemo(() => {
    const entry = resolveActiveStrategyEntry({
      family: style,
      systemVersion: system,
      kataraktiVariant,
      kataraktiMarket,
    });
    if (!entry) {
      return style.toUpperCase();
    }
    const familyLabel = PERFORMANCE_FAMILY_META[entry.family].label.toUpperCase();
    if (entry.family === "katarakti") {
      const marketText = entry.market === "mt5_forex" ? "CFD" : "CRYPTO FUTURES";
      const variantText = (entry.kataraktiVariant ?? kataraktiVariant).toUpperCase();
      return `${familyLabel} / ${marketText} / ${variantText}`;
    }
    const versionText = (entry.systemVersion ?? system).toUpperCase();
    return `${familyLabel} / ${versionText}`;
  }, [style, system, kataraktiMarket, kataraktiVariant]);

  return (
    <p className={className}>
      {text}
    </p>
  );
}
