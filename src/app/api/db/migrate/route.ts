import { NextResponse } from "next/server";
import { Pool } from "pg";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Check admin token
  const token = request.headers.get("x-admin-token") ?? "";
  const expectedToken = process.env.ADMIN_TOKEN ?? "";
  
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL not configured" },
      { status: 500 }
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test connection
    await pool.query("SELECT NOW()");

    // Read and execute schema
    const schemaPath = path.join(process.cwd(), "db", "schema.sql");
    const schema = await fs.readFile(schemaPath, "utf-8");
    await pool.query(schema);

    // Add recent_logs column if it doesn't exist (migration for existing tables)
    await pool.query(`
      ALTER TABLE mt5_accounts
      ADD COLUMN IF NOT EXISTS recent_logs JSONB
    `);

    // Get list of created tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    return NextResponse.json({
      success: true,
      message: "Database migrated successfully",
      tables: result.rows.map((r) => r.table_name),
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
