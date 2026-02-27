import pg from "pg";
const { Pool } = pg;

const databaseUrl = "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  // First check if column exists
  const columnCheck = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'mt5_accounts' AND column_name = 'planning_diagnostics'
  `);

  if (columnCheck.rowCount === 0) {
    console.log("❌ planning_diagnostics column does NOT exist in mt5_accounts table");
    console.log("Migration has not been run yet.");
  } else {
    console.log("✅ planning_diagnostics column exists");

    const result = await pool.query(`
      SELECT
        account_id,
        label,
        planning_diagnostics IS NOT NULL as has_diagnostics,
        planning_diagnostics
      FROM mt5_accounts
      WHERE planning_diagnostics IS NOT NULL
      LIMIT 2
    `);

    console.log("\nAccounts with planning_diagnostics:", result.rowCount);
    for (const row of result.rows) {
      console.log("\nAccount:", row.account_id, "Label:", row.label);
      console.log("Has diagnostics:", row.has_diagnostics);
      if (row.planning_diagnostics) {
        console.log("Diagnostics:", JSON.stringify(row.planning_diagnostics, null, 2));
      }
    }

    const allAccounts = await pool.query(`
      SELECT account_id, label, planning_diagnostics IS NOT NULL as has_diagnostics
      FROM mt5_accounts
      ORDER BY account_id
    `);
    console.log("\n\nAll accounts:");
    for (const row of allAccounts.rows) {
      console.log(`  ${row.account_id} (${row.label}): has_diagnostics=${row.has_diagnostics}`);
    }
  }
} catch (error) {
  console.error("Error:", error);
} finally {
  await pool.end();
}
