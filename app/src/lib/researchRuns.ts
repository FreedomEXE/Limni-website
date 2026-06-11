import { query, queryOne } from "@/lib/db";
import { hashResearchConfig, stableStringify } from "@/lib/research/hash";
import type { ResearchConfig, ResearchRunResult, ResearchRunStatus } from "@/lib/research/types";

type ResearchRunRow = {
  id: string;
  config_json: ResearchConfig;
  config_hash: string;
  result_json: ResearchRunResult | null;
  status: ResearchRunStatus;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
};

export type ResearchRun = {
  id: string;
  config: ResearchConfig;
  configHash: string;
  result: ResearchRunResult | null;
  status: ResearchRunStatus;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

let researchRunsReady = false;

async function ensureResearchRunsTable() {
  if (researchRunsReady) return;
  await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await query(`
    CREATE TABLE IF NOT EXISTS research_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      config_json JSONB NOT NULL,
      config_hash TEXT NOT NULL,
      result_json JSONB,
      status VARCHAR(20) NOT NULL DEFAULT 'complete',
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_research_runs_config_hash ON research_runs(config_hash)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_research_runs_created_at ON research_runs(created_at DESC)`);
  researchRunsReady = true;
}

function toResearchRun(row: ResearchRunRow): ResearchRun {
  return {
    id: row.id,
    config: row.config_json,
    configHash: row.config_hash,
    result: row.result_json,
    status: row.status,
    error: row.error ?? null,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

export async function saveResearchRun(config: ResearchConfig, result: ResearchRunResult): Promise<ResearchRun> {
  await ensureResearchRunsTable();
  const configHash = hashResearchConfig(config);
  const saved = await queryOne<ResearchRunRow>(
    `INSERT INTO research_runs (config_json, config_hash, result_json, status, completed_at)
     VALUES ($1, $2, $3, 'complete', NOW())
     RETURNING id, config_json, config_hash, result_json, status, error, created_at, completed_at`,
    [stableStringify(config), configHash, stableStringify(result)],
  );
  if (!saved) {
    throw new Error("Failed to save research run.");
  }
  return toResearchRun(saved);
}

export async function getResearchRun(id: string): Promise<ResearchRun | null> {
  await ensureResearchRunsTable();
  const row = await queryOne<ResearchRunRow>(
    `SELECT id, config_json, config_hash, result_json, status, error, created_at, completed_at
     FROM research_runs
     WHERE id = $1`,
    [id],
  );
  return row ? toResearchRun(row) : null;
}

export async function findRunByConfigHash(configHash: string): Promise<ResearchRun | null> {
  await ensureResearchRunsTable();
  const row = await queryOne<ResearchRunRow>(
    `SELECT id, config_json, config_hash, result_json, status, error, created_at, completed_at
     FROM research_runs
     WHERE config_hash = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [configHash],
  );
  return row ? toResearchRun(row) : null;
}
