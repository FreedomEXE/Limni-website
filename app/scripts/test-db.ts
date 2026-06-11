import { readFileSync } from "node:fs";
import path from "node:path";
const envPath = path.resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

import { query } from "@/lib/db";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  console.log("DB URL contains render.com:", url.includes("render.com"));
  console.log("DB URL contains sslmode:", url.includes("sslmode"));
  console.log("DB URL host:", url.replace(/^.*@/, "").replace(/\/.*$/, ""));

  try {
    const res = await query("SELECT 1 as ok");
    console.log("DB OK:", res);
  } catch (err: any) {
    console.error("DB FAIL:", err.code, err.message);
  }
  process.exit(0);
}

main();
