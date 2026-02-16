import crypto from "node:crypto";

import { query, queryOne } from "@/lib/db";

type Mt5LicenseRow = {
  license_key: string;
  status: string;
  bound_account_id: string | null;
  bound_server: string | null;
  bound_broker: string | null;
  expires_at: Date | null;
};

export type Mt5LicenseCheckResult = {
  ok: boolean;
  reason: string;
  bypassed: boolean;
};

function parseCsvSet(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function isMt5LicenseEnforced(): boolean {
  const raw = String(process.env.MT5_ENFORCE_CLIENT_LICENSES ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function isOwnerMt5Account(accountId: string): boolean {
  const ownerAccounts = parseCsvSet(process.env.MT5_OWNER_ACCOUNT_IDS);
  return ownerAccounts.has(String(accountId).trim());
}

export async function ensureMt5LicensingSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS mt5_client_licenses (
      license_key VARCHAR(96) PRIMARY KEY,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      bound_account_id VARCHAR(64),
      bound_server VARCHAR(120),
      bound_broker VARCHAR(120),
      notes TEXT,
      expires_at TIMESTAMP,
      bound_at TIMESTAMP,
      last_seen_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_mt5_client_licenses_account
      ON mt5_client_licenses(bound_account_id)
  `);
}

export async function validateMt5License(options: {
  accountId: string;
  licenseKey: string;
  server?: string;
  broker?: string;
}): Promise<Mt5LicenseCheckResult> {
  const accountId = String(options.accountId ?? "").trim();
  if (!accountId) {
    return { ok: false, reason: "account_id_missing", bypassed: false };
  }

  if (!isMt5LicenseEnforced()) {
    return { ok: true, reason: "licensing_disabled", bypassed: true };
  }

  if (isOwnerMt5Account(accountId)) {
    return { ok: true, reason: "owner_bypass", bypassed: true };
  }

  const licenseKey = String(options.licenseKey ?? "").trim();
  if (!licenseKey) {
    return { ok: false, reason: "license_required", bypassed: false };
  }

  await ensureMt5LicensingSchema();

  const row = await queryOne<Mt5LicenseRow>(
    `SELECT license_key, status, bound_account_id, bound_server, bound_broker, expires_at
     FROM mt5_client_licenses
     WHERE license_key = $1
     LIMIT 1`,
    [licenseKey],
  );
  if (!row) {
    return { ok: false, reason: "license_not_found", bypassed: false };
  }
  if (String(row.status).toLowerCase() !== "active") {
    return { ok: false, reason: "license_inactive", bypassed: false };
  }
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
    return { ok: false, reason: "license_expired", bypassed: false };
  }

  const inputServer = String(options.server ?? "").trim();
  const inputBroker = String(options.broker ?? "").trim();
  const boundAccountId = String(row.bound_account_id ?? "").trim();
  const boundServer = String(row.bound_server ?? "").trim();
  const boundBroker = String(row.bound_broker ?? "").trim();

  if (boundAccountId && boundAccountId !== accountId) {
    return { ok: false, reason: "license_bound_to_other_account", bypassed: false };
  }
  if (boundServer && inputServer && boundServer.toLowerCase() !== inputServer.toLowerCase()) {
    return { ok: false, reason: "license_server_mismatch", bypassed: false };
  }
  if (boundBroker && inputBroker && boundBroker.toLowerCase() !== inputBroker.toLowerCase()) {
    return { ok: false, reason: "license_broker_mismatch", bypassed: false };
  }

  if (!boundAccountId) {
    await query(
      `UPDATE mt5_client_licenses
       SET bound_account_id = $2,
           bound_server = NULLIF($3, ''),
           bound_broker = NULLIF($4, ''),
           bound_at = NOW(),
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE license_key = $1`,
      [licenseKey, accountId, inputServer, inputBroker],
    );
  } else {
    await query(
      `UPDATE mt5_client_licenses
       SET last_seen_at = NOW(),
           bound_server = COALESCE(bound_server, NULLIF($2, '')),
           bound_broker = COALESCE(bound_broker, NULLIF($3, '')),
           updated_at = NOW()
       WHERE license_key = $1`,
      [licenseKey, inputServer, inputBroker],
    );
  }

  return { ok: true, reason: "ok", bypassed: false };
}

export async function createMt5License(options?: {
  licenseKey?: string;
  notes?: string;
  expiresAtIso?: string;
}): Promise<{ licenseKey: string }> {
  await ensureMt5LicensingSchema();
  const licenseKey =
    String(options?.licenseKey ?? "").trim() ||
    `lic_${crypto.randomBytes(18).toString("hex")}`;
  const notes = String(options?.notes ?? "").trim();
  const expiresAtRaw = String(options?.expiresAtIso ?? "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  await query(
    `INSERT INTO mt5_client_licenses (license_key, status, notes, expires_at)
     VALUES ($1, 'active', NULLIF($2, ''), $3)
     ON CONFLICT (license_key) DO UPDATE
       SET status = 'active',
           notes = COALESCE(EXCLUDED.notes, mt5_client_licenses.notes),
           expires_at = COALESCE(EXCLUDED.expires_at, mt5_client_licenses.expires_at),
           updated_at = NOW()`,
    [licenseKey, notes, expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null],
  );

  return { licenseKey };
}
