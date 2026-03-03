/*
-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------
*/

"use client";

import { useEffect, useMemo, useState } from "react";
import type { PerformanceSystem } from "@/lib/performance/modelConfig";
import type { KataraktiMarket, KataraktiVariant } from "@/lib/performance/kataraktiHistory";

type PerformanceStyle = "universal" | "tiered" | "katarakti";

function marketLabel(market: KataraktiMarket) {
  return market === "mt5_forex" ? "CFD" : "CRYPTO FUTURES";
}

type PerformanceHeaderContextProps = {
  initialStyle: PerformanceStyle;
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
  const [style, setStyle] = useState<PerformanceStyle>(initialStyle);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const [kataraktiMarket, setKataraktiMarket] = useState<KataraktiMarket>(initialKataraktiMarket);
  const [kataraktiVariant, setKataraktiVariant] = useState<KataraktiVariant>(initialKataraktiVariant);

  useEffect(() => {
    const onSystemChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceSystem>;
      if (custom.detail === "v1" || custom.detail === "v2" || custom.detail === "v3") {
        setSystem(custom.detail);
      }
    };

    const onStyleChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceStyle>;
      if (custom.detail === "universal" || custom.detail === "tiered" || custom.detail === "katarakti") {
        setStyle(custom.detail);
      }
    };

    const onKataraktiMarketChange = (event: Event) => {
      const custom = event as CustomEvent<KataraktiMarket>;
      if (custom.detail === "crypto_futures" || custom.detail === "mt5_forex") {
        setKataraktiMarket(custom.detail);
      }
    };

    const onKataraktiVariantChange = (event: Event) => {
      const custom = event as CustomEvent<KataraktiVariant>;
      if (custom.detail === "core" || custom.detail === "lite" || custom.detail === "v3") {
        setKataraktiVariant(custom.detail);
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
      if (marketParam === "crypto_futures" || marketParam === "mt5_forex") {
        setKataraktiMarket(marketParam);
      }
      if (variantParam === "core" || variantParam === "lite" || variantParam === "v3") {
        setKataraktiVariant(variantParam);
      }
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
  }, []);

  const text = useMemo(() => {
    if (style === "katarakti") {
      return `KATARAKTI / ${marketLabel(kataraktiMarket)} / ${kataraktiVariant.toUpperCase()}`;
    }
    if (style === "tiered") {
      return `TIERED / ${system.toUpperCase()}`;
    }
    return `UNIVERSAL / ${system.toUpperCase()}`;
  }, [style, system, kataraktiMarket, kataraktiVariant]);

  return (
    <p className={className}>
      {text}
    </p>
  );
}
