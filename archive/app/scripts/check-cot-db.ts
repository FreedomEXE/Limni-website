import { query } from "../src/lib/db";

async function checkCotSnapshots() {
  console.log("Checking COT snapshots in production database...\n");

  const snapshots = await query<{
    asset_class: string;
    variant: string;
    report_date: string | Date;
    fetched_at: Date;
  }>(
    "SELECT asset_class, variant, report_date, fetched_at FROM cot_snapshots ORDER BY report_date DESC LIMIT 20"
  );

  console.log(`Found ${snapshots.length} snapshots in database:\n`);

  if (snapshots.length === 0) {
    console.log("❌ DATABASE IS EMPTY - No COT snapshots found!");
    console.log("\nYou need to run a COT refresh to populate the database.");
    console.log("Visit: https://limni-website-nine.vercel.app/api/cot/refresh?token=2121");
    return;
  }

  for (const snap of snapshots) {
    const reportDate = snap.report_date instanceof Date
      ? snap.report_date.toISOString().slice(0, 10)
      : snap.report_date;
    const fetchedAt = snap.fetched_at.toISOString();
    const age = Math.floor((Date.now() - new Date(reportDate).getTime()) / (1000 * 60 * 60 * 24));

    console.log(`${snap.asset_class}/${snap.variant}: ${reportDate} (${age} days old) - fetched ${fetchedAt}`);
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const fresh = snapshots.filter(s => {
    const reportDate = s.report_date instanceof Date ? s.report_date : new Date(s.report_date);
    return reportDate >= cutoff;
  });

  console.log(`\n${fresh.length} snapshots are within 10 days (fresh)`);
  console.log(`${snapshots.length - fresh.length} snapshots are older than 10 days (stale)`);
}

checkCotSnapshots()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
