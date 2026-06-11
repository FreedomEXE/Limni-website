import { Pool } from "pg";
import fs from "node:fs/promises";
import path from "node:path";

async function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const contents = await fs.readFile(envPath, "utf-8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const [rawKey, ...rest] = trimmed.split("=");
      const key = rawKey.trim();
      if (!key || process.env[key]) {
        continue;
      }
      let value = rest.join("=").trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("⚠️ Could not read .env file:", error);
    }
  }
}

async function runMigration() {
  await loadEnvFile();
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable not set");
    process.exit(1);
  }

  const shouldUseSsl =
    process.env.DB_SSL === "true" ||
    process.env.DB_SSL === "1" ||
    process.env.NODE_ENV === "production" ||
    databaseUrl.includes("render.com");

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
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
