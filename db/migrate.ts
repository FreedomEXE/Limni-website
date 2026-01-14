import { Pool } from "pg";
import fs from "node:fs/promises";
import path from "node:path";

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log("🔗 Connecting to database...");
    await pool.query("SELECT NOW()");
    console.log("✅ Connected to database");

    console.log("📋 Reading schema file...");
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = await fs.readFile(schemaPath, "utf-8");

    console.log("🚀 Running migrations...");
    await pool.query(schema);
    console.log("✅ Migrations completed successfully");

    console.log("\n📊 Database tables created:");
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    result.rows.forEach((row) => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
