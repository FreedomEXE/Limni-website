import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { getClient } from "../src/lib/db";

type CandidateRow = {
  id: number;
  asset_class: string;
  model: string;
  report_date: Date;
  week_open_utc: Date;
  priced: number;
  total: number;
  percent: string;
  created_at: Date;
  canonical_week_open_utc: Date;
  duplicate_count: number;
};

type CleanupOptions = {
  apply: boolean;
  assetClass: string | null;
  lookbackWeeks: number | null;
};

function loadDotEnv() {
  const cwd = process.cwd();
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(cwd, fileName);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  let apply = false;
  let assetClass: string | null = null;
  let lookbackWeeks: number | null = null;
  for (const arg of args) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg.startsWith("--asset=")) {
      const value = arg.slice("--asset=".length).trim().toLowerCase();
      if (value) assetClass = value;
      continue;
    }
    if (arg.startsWith("--weeks=")) {
      const raw = Number(arg.slice("--weeks=".length).trim());
      if (Number.isFinite(raw) && raw > 0) {
        lookbackWeeks = Math.floor(raw);
      }
    }
  }
  return { apply, assetClass, lookbackWeeks };
}

async function main() {
  loadDotEnv();
  const options = parseArgs();
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const filters: string[] = ["report_date IS NOT NULL"];
    const params: Array<string | number> = [];
    if (options.assetClass) {
      params.push(options.assetClass);
      filters.push(`asset_class = $${params.length}`);
    }
    if (options.lookbackWeeks !== null) {
      params.push(options.lookbackWeeks);
      filters.push(`report_date >= CURRENT_DATE - ($${params.length} * INTERVAL '7 days')`);
    }
    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const queryText = `
      WITH base AS (
        SELECT
          id,
          asset_class,
          model,
          report_date,
          week_open_utc,
          priced,
          total,
          percent,
          created_at,
          (
            (
              (
                report_date::date
                + (((7 - EXTRACT(DOW FROM report_date::date)::int) % 7) * INTERVAL '1 day')
              )::timestamp
              + INTERVAL '19 hours'
            ) AT TIME ZONE 'America/New_York'
          ) AS canonical_week_open_utc
        FROM performance_snapshots
        ${whereClause}
      ),
      ranked AS (
        SELECT
          *,
          COUNT(*) OVER (
            PARTITION BY asset_class, model, report_date
          ) AS duplicate_count,
          ROW_NUMBER() OVER (
            PARTITION BY asset_class, model, report_date
            ORDER BY
              priced DESC,
              total DESC,
              ABS(EXTRACT(EPOCH FROM (week_open_utc - canonical_week_open_utc))) ASC,
              created_at DESC,
              id DESC
          ) AS keep_rank
        FROM base
      )
      SELECT
        id,
        asset_class,
        model,
        report_date,
        week_open_utc,
        priced,
        total,
        percent,
        created_at,
        canonical_week_open_utc,
        duplicate_count
      FROM ranked
      WHERE duplicate_count > 1
      ORDER BY asset_class, model, report_date, keep_rank, week_open_utc DESC;
    `;

    const candidates = await client.query<CandidateRow>(queryText, params);
    if (candidates.rowCount === 0) {
      await client.query("ROLLBACK");
      console.log("No duplicate performance rows found for cleanup.");
      return;
    }

    const grouped = new Map<string, CandidateRow[]>();
    for (const row of candidates.rows) {
      const key = `${row.asset_class}|${row.model}|${DateTime.fromJSDate(
        row.report_date,
        { zone: "utc" },
      ).toISODate()}`;
      const list = grouped.get(key) ?? [];
      list.push(row);
      grouped.set(key, list);
    }

    const idsToDelete: number[] = [];
    for (const rows of grouped.values()) {
      // Rows are already ordered by keep rank. Keep first row, delete the rest.
      rows.slice(1).forEach((row) => idsToDelete.push(row.id));
    }

    console.log(
      `Found ${grouped.size} duplicate groups and ${idsToDelete.length} rows marked for deletion.`,
    );
    for (const [groupKey, rows] of grouped.entries()) {
      const winner = rows[0];
      const losers = rows.slice(1);
      console.log(`\n[${groupKey}] keep id=${winner.id} week=${winner.week_open_utc.toISOString()} priced=${winner.priced}/${winner.total} pct=${winner.percent}`);
      losers.forEach((row) => {
        console.log(
          `  delete id=${row.id} week=${row.week_open_utc.toISOString()} priced=${row.priced}/${row.total} pct=${row.percent}`,
        );
      });
    }

    if (!options.apply) {
      await client.query("ROLLBACK");
      console.log("\nDry run only. Re-run with --apply to execute deletions.");
      return;
    }

    if (idsToDelete.length > 0) {
      await client.query(
        "DELETE FROM performance_snapshots WHERE id = ANY($1::int[])",
        [idsToDelete],
      );
    }

    await client.query("COMMIT");
    console.log(`\nDeleted ${idsToDelete.length} duplicate rows from performance_snapshots.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});

