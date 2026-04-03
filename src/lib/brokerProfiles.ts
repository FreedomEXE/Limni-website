/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: brokerProfiles.ts
 *
 * Description:
 * Shared broker profile types, validation schemas, and client-safe sizing helpers.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { z } from "zod";

import type { InstrumentSpec } from "@/lib/flagship/instrumentDefaults";

export const BrokerSymbolSpecSchema = z.object({
  api_symbol: z.string().min(1),
  broker_symbol: z.string().min(1),
  price: z.number(),
  tick_size: z.number(),
  tick_value: z.number(),
  contract_size: z.number(),
  profit_currency: z.string(),
  digits: z.number().int(),
  volume_min: z.number(),
  volume_max: z.number(),
  volume_step: z.number(),
  margin_initial: z.number(),
  trade_mode: z.number().int(),
});

export const BrokerProfileSchema = z.object({
  profile_id: z.string().min(1),
  label: z.string().min(1),
  broker: z.string().nullable(),
  server: z.string().nullable(),
  account_currency: z.string(),
  symbol_specs: z.array(BrokerSymbolSpecSchema),
  sl_compliance_mode: z.enum(["none", "prop_pct_of_nominal"]),
  sl_cap_pct_of_nominal: z.number(),
  notes: z.string().nullable(),
  exported_utc: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const BrokerProfileSummarySchema = z.object({
  profile_id: z.string(),
  label: z.string(),
  broker: z.string().nullable(),
  server: z.string().nullable(),
  symbol_count: z.number().int(),
  updated_at: z.string(),
});

export const BrokerProfileUpsertSchema = z.object({
  profile_id: z.string().min(1),
  label: z.string().min(1),
  broker: z.string().optional(),
  server: z.string().optional(),
  account_currency: z.string().optional(),
  symbol_specs: z.array(BrokerSymbolSpecSchema).min(1),
  sl_compliance_mode: z.enum(["none", "prop_pct_of_nominal"]).optional(),
  sl_cap_pct_of_nominal: z.number().optional(),
  notes: z.string().optional(),
  exported_utc: z.string().optional(),
});

export type BrokerSymbolSpec = z.infer<typeof BrokerSymbolSpecSchema>;
export type BrokerProfile = z.infer<typeof BrokerProfileSchema>;
export type BrokerProfileSummary = z.infer<typeof BrokerProfileSummarySchema>;
export type BrokerProfileUpsertInput = z.infer<typeof BrokerProfileUpsertSchema>;

export function normalizeSymbol(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeBrokerProfileId(value: string) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "broker-profile";
}

export function findBrokerSymbolSpec(symbolSpecs: BrokerSymbolSpec[], pair: string) {
  const normalizedPair = normalizeSymbol(pair);
  return (
    symbolSpecs.find((spec) => normalizeSymbol(spec.api_symbol) === normalizedPair)
    ?? symbolSpecs.find((spec) => normalizeSymbol(spec.broker_symbol) === normalizedPair)
    ?? null
  );
}

export function applyBrokerSymbolSpec(
  baseSpec: InstrumentSpec,
  brokerSpec: BrokerSymbolSpec | null,
  overrides?: Partial<InstrumentSpec>,
): InstrumentSpec {
  const pipSize = baseSpec.pipSize > 0 ? baseSpec.pipSize : brokerSpec?.tick_size ?? baseSpec.pipSize;
  const pipValuePerLot =
    brokerSpec && brokerSpec.tick_size > 0 && brokerSpec.tick_value > 0 && pipSize > 0
      ? brokerSpec.tick_value * (pipSize / brokerSpec.tick_size)
      : baseSpec.pipValuePerLot;

  return {
    ...baseSpec,
    ...(brokerSpec
      ? {
          contractSize: brokerSpec.contract_size > 0 ? brokerSpec.contract_size : baseSpec.contractSize,
          minLot: brokerSpec.volume_min > 0 ? brokerSpec.volume_min : baseSpec.minLot,
          maxLot: brokerSpec.volume_max > 0 ? brokerSpec.volume_max : baseSpec.maxLot,
          lotStep: brokerSpec.volume_step > 0 ? brokerSpec.volume_step : baseSpec.lotStep,
          pipSize,
          pipValuePerLot: pipValuePerLot > 0 ? pipValuePerLot : baseSpec.pipValuePerLot,
        }
      : {}),
    ...(overrides ?? {}),
  };
}

export function computePerTradeSlRequirement(params: {
  accountBalance: number;
  capPctOfNominal: number;
  lotSize: number | null;
  spec: InstrumentSpec | null;
}) {
  const { accountBalance, capPctOfNominal, lotSize, spec } = params;
  if (!(accountBalance > 0) || !(capPctOfNominal > 0) || !(lotSize && lotSize > 0) || !spec || !(spec.pipValuePerLot > 0) || !(spec.pipSize > 0)) {
    return null;
  }
  const riskUsd = accountBalance * (capPctOfNominal / 100);
  const pipValueAtLots = lotSize * spec.pipValuePerLot;
  if (!(pipValueAtLots > 0)) return null;
  const distancePips = riskUsd / pipValueAtLots;
  return {
    riskUsd,
    distancePips,
    distancePrice: distancePips * spec.pipSize,
  };
}

export async function fetchBrokerProfileSummaries() {
  const response = await fetch("/api/broker-profiles", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load broker profiles.");
  const payload = BrokerProfileSummarySchema.array().parse(await response.json());
  return payload;
}

export async function fetchBrokerProfile(profileId: string) {
  const response = await fetch(`/api/broker-profiles/${encodeURIComponent(profileId)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Failed to load broker profile.");
  return BrokerProfileSchema.parse(await response.json());
}
