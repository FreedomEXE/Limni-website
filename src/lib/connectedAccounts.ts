import { query, queryOne } from "@/lib/db";
import { decryptJson, encryptJson, type EncryptedPayload } from "@/lib/secretVault";

export type ConnectedAccount = {
  account_key: string;
  provider: "oanda" | "bitget" | "mt5";
  account_id: string | null;
  label: string | null;
  status: string | null;
  bot_type: string;
  risk_mode: string | null;
  trail_mode: string | null;
  trail_start_pct: number | null;
  trail_offset_pct: number | null;
  config: Record<string, unknown> | null;
  analysis: Record<string, unknown> | null;
  last_sync_utc: string | null;
  created_at: string;
  updated_at: string;
};

type ConnectedAccountRow = Omit<ConnectedAccount, "last_sync_utc" | "created_at" | "updated_at"> & {
  last_sync_utc: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ConnectedAccountSecrets = Record<string, unknown>;

export async function listConnectedAccounts(): Promise<ConnectedAccount[]> {
  const rows = await query<ConnectedAccountRow>(
    `SELECT account_key, provider, account_id, label, status, bot_type,
            risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
            config, analysis, last_sync_utc, created_at, updated_at
     FROM connected_accounts
     ORDER BY created_at DESC`,
  );
  const deduped = new Map<string, ConnectedAccountRow>();
  for (const row of rows) {
    const key = `${row.provider}:${row.account_id ?? row.account_key}`;
    if (!deduped.has(key)) {
      deduped.set(key, row);
    }
  }
  return Array.from(deduped.values()).map((row) => {
    const normalizedKey = row.account_id
      ? row.account_id.startsWith(`${row.provider}:`)
        ? row.account_id
        : `${row.provider}:${row.account_id}`
      : row.account_key;
    return {
      ...row,
      account_key: normalizedKey,
      last_sync_utc: row.last_sync_utc ? row.last_sync_utc.toISOString() : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  });
}

export async function getConnectedAccount(accountKey: string): Promise<ConnectedAccount | null> {
  let row = await queryOne<ConnectedAccountRow>(
    `SELECT account_key, provider, account_id, label, status, bot_type,
            risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
            config, analysis, last_sync_utc, created_at, updated_at
     FROM connected_accounts
     WHERE account_key = $1`,
    [accountKey],
  );
  if (!row) {
    row = await queryOne<ConnectedAccountRow>(
      `SELECT account_key, provider, account_id, label, status, bot_type,
              risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
              config, analysis, last_sync_utc, created_at, updated_at
       FROM connected_accounts
       WHERE LOWER(account_key) = LOWER($1)
       LIMIT 1`,
      [accountKey],
    );
  }
  let resolved = row;
  if (!resolved && accountKey.includes(":")) {
    const [provider, ...rest] = accountKey.split(":");
    const accountId = rest.join(":");
    if (provider && accountId) {
      resolved = await queryOne<ConnectedAccountRow>(
        `SELECT account_key, provider, account_id, label, status, bot_type,
                risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                config, analysis, last_sync_utc, created_at, updated_at
         FROM connected_accounts
         WHERE provider = $1 AND account_id = $2
         ORDER BY updated_at DESC
         LIMIT 1`,
        [provider, accountId],
      );
      if (!resolved) {
        resolved = await queryOne<ConnectedAccountRow>(
          `SELECT account_key, provider, account_id, label, status, bot_type,
                  risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                  config, analysis, last_sync_utc, created_at, updated_at
           FROM connected_accounts
           WHERE provider = $1 AND account_key = $2
           ORDER BY updated_at DESC
           LIMIT 1`,
          [provider, accountId],
        );
      }
      if (!resolved) {
        resolved = await queryOne<ConnectedAccountRow>(
          `SELECT account_key, provider, account_id, label, status, bot_type,
                  risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                  config, analysis, last_sync_utc, created_at, updated_at
           FROM connected_accounts
           WHERE provider = $1 AND account_key = $2
           ORDER BY updated_at DESC
           LIMIT 1`,
          [provider, accountKey],
        );
      }
      if (!resolved) {
        resolved = await queryOne<ConnectedAccountRow>(
          `SELECT account_key, provider, account_id, label, status, bot_type,
                  risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                  config, analysis, last_sync_utc, created_at, updated_at
           FROM connected_accounts
           WHERE provider = $1 AND account_id = $2
           ORDER BY updated_at DESC
           LIMIT 1`,
          [provider, accountKey],
        );
      }
      if (!resolved) {
        resolved = await queryOne<ConnectedAccountRow>(
          `SELECT account_key, provider, account_id, label, status, bot_type,
                  risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                  config, analysis, last_sync_utc, created_at, updated_at
           FROM connected_accounts
           WHERE account_key = $1 OR account_id = $1
           ORDER BY updated_at DESC
           LIMIT 1`,
          [accountId],
        );
      }
    }
  }
  if (!resolved && accountKey) {
    resolved = await queryOne<ConnectedAccountRow>(
      `SELECT account_key, provider, account_id, label, status, bot_type,
              risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
              config, analysis, last_sync_utc, created_at, updated_at
       FROM connected_accounts
       WHERE account_id = $1
          OR account_key = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [accountKey],
    );
  }
  if (!resolved) return null;
  return {
    ...resolved,
    last_sync_utc: resolved.last_sync_utc ? resolved.last_sync_utc.toISOString() : null,
    created_at: resolved.created_at.toISOString(),
    updated_at: resolved.updated_at.toISOString(),
  };
}

export async function upsertConnectedAccount(options: {
  account_key: string;
  provider: ConnectedAccount["provider"];
  account_id?: string | null;
  label?: string | null;
  status?: string | null;
  bot_type: string;
  risk_mode?: string | null;
  trail_mode?: string | null;
  trail_start_pct?: number | null;
  trail_offset_pct?: number | null;
  config?: Record<string, unknown> | null;
  analysis?: Record<string, unknown> | null;
  secrets?: ConnectedAccountSecrets | null;
}): Promise<void> {
  const secretsPayload: EncryptedPayload | null = options.secrets
    ? encryptJson(options.secrets)
    : null;

  await query(
    `INSERT INTO connected_accounts (
      account_key, provider, account_id, label, status, bot_type,
      risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
      config, analysis, secrets, last_sync_utc
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW()
    )
    ON CONFLICT (account_key) DO UPDATE SET
      provider = EXCLUDED.provider,
      account_id = EXCLUDED.account_id,
      label = EXCLUDED.label,
      status = EXCLUDED.status,
      bot_type = EXCLUDED.bot_type,
      risk_mode = EXCLUDED.risk_mode,
      trail_mode = EXCLUDED.trail_mode,
      trail_start_pct = EXCLUDED.trail_start_pct,
      trail_offset_pct = EXCLUDED.trail_offset_pct,
      config = EXCLUDED.config,
      analysis = EXCLUDED.analysis,
      secrets = COALESCE(EXCLUDED.secrets, connected_accounts.secrets),
      last_sync_utc = NOW(),
      updated_at = NOW()`,
    [
      options.account_key,
      options.provider,
      options.account_id ?? null,
      options.label ?? null,
      options.status ?? null,
      options.bot_type,
      options.risk_mode ?? null,
      options.trail_mode ?? null,
      options.trail_start_pct ?? null,
      options.trail_offset_pct ?? null,
      options.config ? JSON.stringify(options.config) : null,
      options.analysis ? JSON.stringify(options.analysis) : null,
      secretsPayload ? JSON.stringify(secretsPayload) : null,
    ],
  );
}

export async function updateConnectedAccountAnalysis(
  accountKey: string,
  analysis: Record<string, unknown>,
) {
  const positions = Array.isArray((analysis as any)?.positions)
    ? ((analysis as any).positions as unknown[]).filter(Boolean)
    : null;
  const normalized = {
    ...analysis,
    // Single source of truth: if bots push `positions`, derive `open_positions` from it.
    open_positions:
      typeof (analysis as any)?.open_positions === "number"
        ? (analysis as any).open_positions
        : positions
          ? positions.length
          : 0,
  };
  await query(
    `UPDATE connected_accounts
     SET analysis = $2, last_sync_utc = NOW(), updated_at = NOW()
     WHERE account_key = $1`,
    [accountKey, JSON.stringify(normalized)],
  );
}

export async function loadConnectedAccountSecrets(options: {
  provider: ConnectedAccount["provider"];
  botType?: string;
}): Promise<{ account: ConnectedAccount; secrets: ConnectedAccountSecrets } | null> {
  const row = await queryOne<{
    account_key: string;
    provider: ConnectedAccount["provider"];
    account_id: string | null;
    label: string | null;
    status: string | null;
    bot_type: string;
    risk_mode: string | null;
    trail_mode: string | null;
    trail_start_pct: number | null;
    trail_offset_pct: number | null;
    config: Record<string, unknown> | null;
    analysis: Record<string, unknown> | null;
    last_sync_utc: Date | null;
    created_at: Date;
    updated_at: Date;
    secrets: EncryptedPayload | null;
  }>(
    `SELECT account_key, provider, account_id, label, status, bot_type,
            risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
            config, analysis, last_sync_utc, created_at, updated_at, secrets
     FROM connected_accounts
     WHERE provider = $1
       ${options.botType ? "AND bot_type = $2" : ""}
     ORDER BY updated_at DESC
     LIMIT 1`,
    options.botType ? [options.provider, options.botType] : [options.provider],
  );

  if (!row || !row.secrets) {
    return null;
  }

  const secrets = decryptJson<ConnectedAccountSecrets>(row.secrets);
  const account: ConnectedAccount = {
    account_key: row.account_key,
    provider: row.provider,
    account_id: row.account_id,
    label: row.label,
    status: row.status,
    bot_type: row.bot_type,
    risk_mode: row.risk_mode,
    trail_mode: row.trail_mode,
    trail_start_pct: row.trail_start_pct,
    trail_offset_pct: row.trail_offset_pct,
    config: row.config,
    analysis: row.analysis,
    last_sync_utc: row.last_sync_utc ? row.last_sync_utc.toISOString() : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };

  return { account, secrets };
}

export async function loadConnectedAccountSecretsByKey(
  accountKey: string,
): Promise<{ account: ConnectedAccount; secrets: ConnectedAccountSecrets } | null> {
  let row = await queryOne<{
    account_key: string;
    provider: ConnectedAccount["provider"];
    account_id: string | null;
    label: string | null;
    status: string | null;
    bot_type: string;
    risk_mode: string | null;
    trail_mode: string | null;
    trail_start_pct: number | null;
    trail_offset_pct: number | null;
    config: Record<string, unknown> | null;
    analysis: Record<string, unknown> | null;
    last_sync_utc: Date | null;
    created_at: Date;
    updated_at: Date;
    secrets: EncryptedPayload | null;
  }>(
    `SELECT account_key, provider, account_id, label, status, bot_type,
            risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
            config, analysis, last_sync_utc, created_at, updated_at, secrets
     FROM connected_accounts
     WHERE account_key = $1
     LIMIT 1`,
    [accountKey],
  );
  if (!row) {
    row = await queryOne<{
      account_key: string;
      provider: ConnectedAccount["provider"];
      account_id: string | null;
      label: string | null;
      status: string | null;
      bot_type: string;
      risk_mode: string | null;
      trail_mode: string | null;
      trail_start_pct: number | null;
      trail_offset_pct: number | null;
      config: Record<string, unknown> | null;
      analysis: Record<string, unknown> | null;
      last_sync_utc: Date | null;
      created_at: Date;
      updated_at: Date;
      secrets: EncryptedPayload | null;
    }>(
      `SELECT account_key, provider, account_id, label, status, bot_type,
              risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
              config, analysis, last_sync_utc, created_at, updated_at, secrets
       FROM connected_accounts
       WHERE LOWER(account_key) = LOWER($1)
       LIMIT 1`,
      [accountKey],
    );
  }
  if (!row && accountKey.includes(":")) {
    const [provider, ...rest] = accountKey.split(":");
    const accountId = rest.join(":");
    if (provider && accountId) {
      row = await queryOne<{
        account_key: string;
        provider: ConnectedAccount["provider"];
        account_id: string | null;
        label: string | null;
        status: string | null;
        bot_type: string;
        risk_mode: string | null;
        trail_mode: string | null;
        trail_start_pct: number | null;
        trail_offset_pct: number | null;
        config: Record<string, unknown> | null;
        analysis: Record<string, unknown> | null;
        last_sync_utc: Date | null;
        created_at: Date;
        updated_at: Date;
        secrets: EncryptedPayload | null;
      }>(
        `SELECT account_key, provider, account_id, label, status, bot_type,
                risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                config, analysis, last_sync_utc, created_at, updated_at, secrets
         FROM connected_accounts
         WHERE provider = $1 AND account_id = $2
         ORDER BY updated_at DESC
         LIMIT 1`,
        [provider, accountId],
      );
      if (!row) {
        row = await queryOne<{
          account_key: string;
          provider: ConnectedAccount["provider"];
          account_id: string | null;
          label: string | null;
          status: string | null;
          bot_type: string;
          risk_mode: string | null;
          trail_mode: string | null;
          trail_start_pct: number | null;
          trail_offset_pct: number | null;
          config: Record<string, unknown> | null;
          analysis: Record<string, unknown> | null;
          last_sync_utc: Date | null;
          created_at: Date;
          updated_at: Date;
          secrets: EncryptedPayload | null;
        }>(
          `SELECT account_key, provider, account_id, label, status, bot_type,
                  risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                  config, analysis, last_sync_utc, created_at, updated_at, secrets
           FROM connected_accounts
           WHERE provider = $1 AND account_key = $2
           ORDER BY updated_at DESC
           LIMIT 1`,
          [provider, accountKey],
        );
      }
      if (!row) {
        row = await queryOne<{
          account_key: string;
          provider: ConnectedAccount["provider"];
          account_id: string | null;
          label: string | null;
          status: string | null;
          bot_type: string;
          risk_mode: string | null;
          trail_mode: string | null;
          trail_start_pct: number | null;
          trail_offset_pct: number | null;
          config: Record<string, unknown> | null;
          analysis: Record<string, unknown> | null;
          last_sync_utc: Date | null;
          created_at: Date;
          updated_at: Date;
          secrets: EncryptedPayload | null;
        }>(
          `SELECT account_key, provider, account_id, label, status, bot_type,
                  risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                  config, analysis, last_sync_utc, created_at, updated_at, secrets
           FROM connected_accounts
           WHERE provider = $1 AND account_id = $2
           ORDER BY updated_at DESC
           LIMIT 1`,
          [provider, accountKey],
        );
      }
      if (!row) {
        row = await queryOne<{
          account_key: string;
          provider: ConnectedAccount["provider"];
          account_id: string | null;
          label: string | null;
          status: string | null;
          bot_type: string;
          risk_mode: string | null;
          trail_mode: string | null;
          trail_start_pct: number | null;
          trail_offset_pct: number | null;
          config: Record<string, unknown> | null;
          analysis: Record<string, unknown> | null;
          last_sync_utc: Date | null;
          created_at: Date;
          updated_at: Date;
          secrets: EncryptedPayload | null;
        }>(
          `SELECT account_key, provider, account_id, label, status, bot_type,
                  risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
                  config, analysis, last_sync_utc, created_at, updated_at, secrets
           FROM connected_accounts
           WHERE account_key = $1 OR account_id = $1
           ORDER BY updated_at DESC
           LIMIT 1`,
          [accountId],
        );
      }
    }
  }
  if (!row && accountKey) {
    row = await queryOne<{
      account_key: string;
      provider: ConnectedAccount["provider"];
      account_id: string | null;
      label: string | null;
      status: string | null;
      bot_type: string;
      risk_mode: string | null;
      trail_mode: string | null;
      trail_start_pct: number | null;
      trail_offset_pct: number | null;
      config: Record<string, unknown> | null;
      analysis: Record<string, unknown> | null;
      last_sync_utc: Date | null;
      created_at: Date;
      updated_at: Date;
      secrets: EncryptedPayload | null;
    }>(
      `SELECT account_key, provider, account_id, label, status, bot_type,
              risk_mode, trail_mode, trail_start_pct, trail_offset_pct,
              config, analysis, last_sync_utc, created_at, updated_at, secrets
       FROM connected_accounts
       WHERE account_id = $1 OR account_key = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [accountKey],
    );
  }

  if (!row || !row.secrets) {
    return null;
  }

  const secrets = decryptJson<ConnectedAccountSecrets>(row.secrets);
  const account: ConnectedAccount = {
    account_key: row.account_key,
    provider: row.provider,
    account_id: row.account_id,
    label: row.label,
    status: row.status,
    bot_type: row.bot_type,
    risk_mode: row.risk_mode,
    trail_mode: row.trail_mode,
    trail_start_pct: row.trail_start_pct,
    trail_offset_pct: row.trail_offset_pct,
    config: row.config,
    analysis: row.analysis,
    last_sync_utc: row.last_sync_utc ? row.last_sync_utc.toISOString() : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };

  return { account, secrets };
}
