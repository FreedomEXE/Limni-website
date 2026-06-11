#!/usr/bin/env tsx

const POLL_INTERVAL_MS = (process.env.SENTIMENT_POLL_INTERVAL_SEC || "300") as string;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const API_URL = process.env.SENTIMENT_API_URL || "http://localhost:3000";

async function refreshSentiment() {
  const url = `${API_URL}/api/sentiment/refresh`;

  console.log(`[${new Date().toISOString()}] Refreshing sentiment data...`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-admin-token": ADMIN_TOKEN,
      },
    });

    if (!response.ok) {
      console.error(`[ERROR] Refresh failed: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log(`[SUCCESS]`, data);
  } catch (error) {
    console.error(`[ERROR] Request failed:`, error);
  }
}

async function main() {
  console.log(`Starting sentiment poller (interval: ${POLL_INTERVAL_MS}s)`);

  await refreshSentiment();

  setInterval(
    async () => {
      await refreshSentiment();
    },
    Number.parseInt(POLL_INTERVAL_MS, 10) * 1000,
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
