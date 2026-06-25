const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function runQueries() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Query 1: Latest liquidation heatmap snapshots
    console.log('=== QUERY 1: Latest Liquidation Heatmap Snapshots ===\n');
    const q1 = await client.query(`
      SELECT
        symbol,
        interval,
        snapshot_time_utc,
        current_price,
        aggregate_json,
        metadata,
        source
      FROM market_liquidation_heatmap_snapshots
      WHERE symbol IN ('BTC','ETH')
      ORDER BY snapshot_time_utc DESC
      LIMIT 16;
    `);
    console.log(JSON.stringify(q1.rows, null, 2));

    // Query 2: Latest funding rate snapshots
    console.log('\n\n=== QUERY 2: Latest Funding Rate Snapshots ===\n');
    const q2 = await client.query(`
      SELECT symbol, snapshot_time_utc, funding_rate, next_funding_time, source
      FROM market_funding_snapshots
      WHERE symbol IN ('BTC','ETH')
      ORDER BY snapshot_time_utc DESC
      LIMIT 4;
    `);
    console.log(JSON.stringify(q2.rows, null, 2));

    // Query 3: Latest OI snapshots
    console.log('\n\n=== QUERY 3: Latest OI Snapshots ===\n');
    const q3 = await client.query(`
      SELECT symbol, snapshot_time_utc, open_interest, price_at_snapshot, source
      FROM market_oi_snapshots
      WHERE symbol IN ('BTC','ETH')
      ORDER BY snapshot_time_utc DESC
      LIMIT 4;
    `);
    console.log(JSON.stringify(q3.rows, null, 2));

    // Query 4: Latest price from any recent snapshot
    console.log('\n\n=== QUERY 4: Latest Price from Heatmap Snapshots ===\n');
    const q4 = await client.query(`
      SELECT symbol, current_price, snapshot_time_utc
      FROM market_liquidation_heatmap_snapshots
      WHERE symbol IN ('BTC','ETH')
      ORDER BY snapshot_time_utc DESC
      LIMIT 2;
    `);
    console.log(JSON.stringify(q4.rows, null, 2));

    // Query 5: Latest liquidation (non-heatmap) snapshots
    console.log('\n\n=== QUERY 5: Latest Liquidation (Non-Heatmap) Snapshots ===\n');
    const q5 = await client.query(`
      SELECT
        symbol,
        snapshot_time_utc,
        reference_price,
        total_long_usd,
        total_short_usd,
        dominant_side,
        largest_above_price,
        largest_above_notional,
        largest_below_price,
        largest_below_notional,
        source
      FROM market_liquidation_snapshots
      WHERE symbol IN ('BTC','ETH')
      ORDER BY snapshot_time_utc DESC
      LIMIT 8;
    `);
    console.log(JSON.stringify(q5.rows, null, 2));

    console.log('\n\nAll queries completed successfully.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

runQueries();
