const { Client } = require('pg');

const DATABASE_URL = 'postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db';

async function checkSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check all tables
    console.log('=== Available Tables ===\n');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log(tables.rows.map(r => r.table_name).join('\n'));

    // Check columns for liquidation heatmap table
    console.log('\n\n=== market_liquidation_heatmap_snapshots columns ===\n');
    const cols1 = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'market_liquidation_heatmap_snapshots'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(cols1.rows, null, 2));

    // Check columns for funding snapshots
    console.log('\n\n=== market_funding_snapshots columns ===\n');
    const cols2 = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'market_funding_snapshots'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(cols2.rows, null, 2));

    // Check columns for OI snapshots
    console.log('\n\n=== market_oi_snapshots columns ===\n');
    const cols3 = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'market_oi_snapshots'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(cols3.rows, null, 2));

    // Check columns for liquidation snapshots
    console.log('\n\n=== market_liquidation_snapshots columns ===\n');
    const cols4 = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'market_liquidation_snapshots'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(cols4.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkSchema();
