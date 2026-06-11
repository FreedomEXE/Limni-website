/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: brokerProfilesStore.ts
 *
 * Description:
 * Server-side broker profile persistence and schema migration helpers.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "@/lib/db";
import {
  BrokerProfileUpsertSchema,
  normalizeBrokerProfileId,
  type BrokerProfile,
  type BrokerProfileSummary,
  type BrokerProfileUpsertInput,
  type BrokerSymbolSpec,
} from "@/lib/brokerProfiles";

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

type BrokerProfileRow = {
  profile_id: string;
  label: string;
  broker: string | null;
  server: string | null;
  account_currency: string;
  symbol_specs: BrokerSymbolSpec[] | string;
  sl_compliance_mode: "none" | "prop_pct_of_nominal";
  sl_cap_pct_of_nominal: string | number;
  notes: string | null;
  exported_utc: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function ensureBrokerProfilesSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS broker_profiles (
      profile_id VARCHAR(64) PRIMARY KEY,
      label VARCHAR(100) NOT NULL,
      broker VARCHAR(100),
      server VARCHAR(100),
      account_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      symbol_specs JSONB NOT NULL DEFAULT '[]'::jsonb,
      sl_compliance_mode VARCHAR(30) NOT NULL DEFAULT 'none',
      sl_cap_pct_of_nominal DECIMAL(6,2) NOT NULL DEFAULT 0,
      notes TEXT,
      exported_utc TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_broker_profiles_label ON broker_profiles(label)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_broker_profiles_broker_server ON broker_profiles(broker, server)`);
}

function mapBrokerProfileRow(row: BrokerProfileRow): BrokerProfile {
  return {
    profile_id: row.profile_id,
    label: row.label,
    broker: row.broker,
    server: row.server,
    account_currency: row.account_currency,
    symbol_specs: parseJsonArray<BrokerSymbolSpec>(row.symbol_specs),
    sl_compliance_mode: row.sl_compliance_mode,
    sl_cap_pct_of_nominal: Number(row.sl_cap_pct_of_nominal ?? 0),
    notes: row.notes,
    exported_utc: row.exported_utc ? row.exported_utc.toISOString() : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function upsertBrokerProfile(input: BrokerProfileUpsertInput): Promise<BrokerProfile> {
  await ensureBrokerProfilesSchema();
  const parsed = BrokerProfileUpsertSchema.parse(input);
  const profileId = normalizeBrokerProfileId(parsed.profile_id);

  const row = await queryOne<BrokerProfileRow>(
    `INSERT INTO broker_profiles (
      profile_id, label, broker, server, account_currency, symbol_specs,
      sl_compliance_mode, sl_cap_pct_of_nominal, notes, exported_utc, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, NOW())
    ON CONFLICT (profile_id) DO UPDATE SET
      label = EXCLUDED.label,
      broker = EXCLUDED.broker,
      server = EXCLUDED.server,
      account_currency = EXCLUDED.account_currency,
      symbol_specs = EXCLUDED.symbol_specs,
      sl_compliance_mode = EXCLUDED.sl_compliance_mode,
      sl_cap_pct_of_nominal = EXCLUDED.sl_cap_pct_of_nominal,
      notes = EXCLUDED.notes,
      exported_utc = EXCLUDED.exported_utc,
      updated_at = NOW()
    RETURNING
      profile_id, label, broker, server, account_currency, symbol_specs,
      sl_compliance_mode, sl_cap_pct_of_nominal, notes, exported_utc, created_at, updated_at`,
    [
      profileId,
      parsed.label,
      parsed.broker ?? null,
      parsed.server ?? null,
      parsed.account_currency ?? "USD",
      JSON.stringify(parsed.symbol_specs),
      parsed.sl_compliance_mode ?? "none",
      parsed.sl_cap_pct_of_nominal ?? 0,
      parsed.notes ?? null,
      parsed.exported_utc ? new Date(parsed.exported_utc) : null,
    ],
  );

  if (!row) throw new Error("Broker profile upsert failed.");
  return mapBrokerProfileRow(row);
}

export async function readBrokerProfileSummaries(): Promise<BrokerProfileSummary[]> {
  await ensureBrokerProfilesSchema();
  const rows = await query<{
    profile_id: string;
    label: string;
    broker: string | null;
    server: string | null;
    symbol_count: string;
    updated_at: Date;
  }>(
    `SELECT
      profile_id,
      label,
      broker,
      server,
      COALESCE(jsonb_array_length(symbol_specs), 0)::text AS symbol_count,
      updated_at
     FROM broker_profiles
     ORDER BY label ASC`,
  );

  return rows.map((row) => ({
    profile_id: row.profile_id,
    label: row.label,
    broker: row.broker,
    server: row.server,
    symbol_count: Number(row.symbol_count ?? 0),
    updated_at: row.updated_at.toISOString(),
  }));
}

export async function readBrokerProfileById(profileId: string): Promise<BrokerProfile | null> {
  await ensureBrokerProfilesSchema();
  const row = await queryOne<BrokerProfileRow>(
    `SELECT
      profile_id, label, broker, server, account_currency, symbol_specs,
      sl_compliance_mode, sl_cap_pct_of_nominal, notes, exported_utc, created_at, updated_at
     FROM broker_profiles
     WHERE profile_id = $1
     LIMIT 1`,
    [normalizeBrokerProfileId(profileId)],
  );
  return row ? mapBrokerProfileRow(row) : null;
}
