/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: tradeIdentity.ts
 *
 * Description:
 * Deterministic UUID helpers for universal trade identity.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { createHash } from "node:crypto";
import type { LiveTradeIdentityInput, TradeNaturalKey } from "@/lib/trades/tradeTypes";

export const LIMNI_TRADE_NAMESPACE_V1 = "4b2c5347-5342-4ce8-8a6a-6f1c1d8e0001";
export const LIMNI_TRADE_NAMESPACE_V2 = "4b2c5347-5342-4ce8-8a6a-6f1c1d8e0002";
export const TRADE_IDENTITY_VERSION = "trade-identity-v2-direction-key";

function uuidBytes(uuid: string) {
  const normalized = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(normalized)) {
    throw new Error(`Invalid UUID namespace: ${uuid}`);
  }
  return Buffer.from(normalized, "hex");
}

function uuidV5(name: string, namespace: string) {
  const hash = createHash("sha1")
    .update(uuidBytes(namespace))
    .update(Buffer.from(name, "utf8"))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));

  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function normalizeIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function normalizePart(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

export function buildTradeNaturalKeyString(input: TradeNaturalKey) {
  return [
    input.origin,
    input.strategyFamily,
    input.strategyVariant,
    input.engineVersion,
    input.anchorType,
    input.anchorVersion,
    input.symbol.toUpperCase(),
    normalizePart(input.direction),
    normalizeIso(input.weekOpenUtc),
    normalizePart(input.sourceModel),
    normalizePart(input.tier),
    normalizePart(input.parentTradeId),
    normalizePart(input.fillSeq),
  ].join(":");
}

export function deriveTradeId(input: TradeNaturalKey) {
  return uuidV5(buildTradeNaturalKeyString(input), LIMNI_TRADE_NAMESPACE_V2);
}

export function deriveLegacyTradeIdWithoutDirectionV1(input: TradeNaturalKey) {
  const legacyKey = [
    input.origin,
    input.strategyFamily,
    input.strategyVariant,
    input.engineVersion,
    input.anchorType,
    input.anchorVersion,
    input.symbol.toUpperCase(),
    normalizeIso(input.weekOpenUtc),
    normalizePart(input.sourceModel),
    normalizePart(input.tier),
    normalizePart(input.parentTradeId),
    normalizePart(input.fillSeq),
  ].join(":");
  return uuidV5(legacyKey, LIMNI_TRADE_NAMESPACE_V1);
}

export function deriveLiveTradeId(input: LiveTradeIdentityInput) {
  const brokerId = input.brokerId.trim().toLowerCase();
  const brokerTradeId = input.brokerTradeId.trim();
  if (!brokerId || !brokerTradeId) {
    throw new Error("Live trade identity requires brokerId and brokerTradeId");
  }
  return uuidV5(`live:${brokerId}:${brokerTradeId}`, LIMNI_TRADE_NAMESPACE_V1);
}
