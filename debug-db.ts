import { query } from './src/lib/db';

process.env.DATABASE_URL = 'postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db';

async function main() {
  try {
    // Check connected accounts
    console.log('\n=== CONNECTED ACCOUNTS ===');
    const accounts = await query(
      `SELECT account_key, provider, account_id, label, created_at
       FROM connected_accounts
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.table(accounts);

    // Check latest COT snapshots
    console.log('\n=== LATEST COT SNAPSHOTS ===');
    const cot = await query(
      `SELECT report_date, asset_class, fetched_at
       FROM cot_snapshots
       WHERE asset_class IN ('fx', 'crypto')
       ORDER BY report_date DESC
       LIMIT 10`
    );
    console.table(cot);

    // Check performance snapshot weeks
    console.log('\n=== LATEST PERFORMANCE WEEKS ===');
    const perf = await query(
      `SELECT DISTINCT week_open_utc
       FROM performance_snapshots
       ORDER BY week_open_utc DESC
       LIMIT 10`
    );
    console.table(perf);

    // Check Bitget account analysis
    console.log('\n=== BITGET ACCOUNT ANALYSIS ===');
    const bitget = await query(
      `SELECT account_key, analysis
       FROM connected_accounts
       WHERE provider = 'bitget'
       LIMIT 1`
    );
    console.log('Account:', bitget[0]?.account_key);
    console.log('Analysis:', JSON.stringify(bitget[0]?.analysis, null, 2));

    // Test getConnectedAccount lookup
    console.log('\n=== TEST ACCOUNT LOOKUP ===');
    const { getConnectedAccount } = await import('./src/lib/connectedAccounts');
    const testKey = 'bitget:bitget_2fe8b6ea36b95c6e';
    const found = await getConnectedAccount(testKey);
    console.log('Looking up:', testKey);
    console.log('Found:', found ? 'YES' : 'NO');
    if (found) {
      console.log('  account_key:', found.account_key);
      console.log('  label:', found.label);
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
  process.exit(0);
}

main();
