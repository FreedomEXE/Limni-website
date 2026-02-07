import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    // Check connected accounts
    console.log('\n=== CONNECTED ACCOUNTS ===');
    const accounts = await pool.query(
      `SELECT account_key, provider, account_id, label, created_at
       FROM connected_accounts
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.table(accounts.rows);

    // Check latest COT snapshots
    console.log('\n=== LATEST COT SNAPSHOTS ===');
    const cot = await pool.query(
      `SELECT report_date, asset_class, fetched_at
       FROM cot_snapshots
       WHERE asset_class IN ('fx', 'crypto')
       ORDER BY report_date DESC
       LIMIT 10`
    );
    console.table(cot.rows);

    // Check performance snapshot weeks
    console.log('\n=== LATEST PERFORMANCE WEEKS ===');
    const perf = await pool.query(
      `SELECT DISTINCT week_open_utc
       FROM performance_snapshots
       ORDER BY week_open_utc DESC
       LIMIT 10`
    );
    console.table(perf.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
