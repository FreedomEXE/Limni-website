/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: db-probe.ts
 *
 * Description:
 * Minimal, redacted PostgreSQL probe for local diagnostics. This intentionally
 * bypasses the app-wide pool so database access checks are isolated from app code.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import pg from "pg";

loadEnvConfig(process.cwd());

type ProbeResult = {
  attempt: number;
  ok: boolean;
  ms: number;
  message?: string;
  rows?: unknown[];
};

function argValue(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function redactedTarget(databaseUrl: string | undefined) {
  if (!databaseUrl) return { configured: false };
  try {
    const url = new URL(databaseUrl);
    return {
      configured: true,
      protocol: url.protocol,
      hostHint: url.hostname.replace(/^[^.]+/, "<redacted>"),
      port: Number(url.port || 5432),
      sslRequested: url.searchParams.get("sslmode") ?? null,
    };
  } catch {
    return { configured: true, invalid: true };
  }
}

function buildConnectionString(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("uselibpqcompat", "true");
  }
  return url.toString();
}

async function loadSql() {
  const sqlFile = argValue("sql-file");
  if (sqlFile) return readFile(sqlFile, "utf8");
  return argValue("sql") ?? "select 1 as ok, now()::text as server_time";
}

async function runAttempt(attempt: number, sql: string): Promise<ProbeResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { attempt, ok: false, ms: 0, message: "DATABASE_URL is not configured" };
  }

  const started = Date.now();
  const client = new pg.Client({
    connectionString: buildConnectionString(databaseUrl),
    connectionTimeoutMillis: parsePositiveInt(argValue("connect-timeout-ms"), 10000),
    keepAlive: true,
    application_name: `codex-db-probe-${attempt}`,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query("set statement_timeout = '15000ms'");
    const result = await client.query(sql);
    return { attempt, ok: true, ms: Date.now() - started, rows: result.rows };
  } catch (error) {
    return {
      attempt,
      ok: false,
      ms: Date.now() - started,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const attempts = parsePositiveInt(argValue("attempts"), 3);
  const delayMs = parsePositiveInt(argValue("delay-ms"), 3000);
  const sql = await loadSql();
  const results: ProbeResult[] = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await runAttempt(attempt, sql);
    results.push(result);
    if (result.ok) break;
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(JSON.stringify({
    target: redactedTarget(process.env.DATABASE_URL),
    attempts: results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
