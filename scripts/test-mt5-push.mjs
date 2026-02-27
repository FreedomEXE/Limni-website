import fetch from "node-fetch";

// Configuration
const API_URL = "http://localhost:3000/api/mt5/push";
const MT5_PUSH_TOKEN = "2121";

// Mock MT5 account snapshot with planning diagnostics
const mockSnapshot = {
  account_id: "7935823",
  label: "Tyrell Tsolakis - USD 001",
  broker: "Oanda",
  server: "Oanda-v20",
  status: "ACTIVE",
  currency: "USD",
  equity: 10000,
  balance: 10000,
  margin: 500,
  free_margin: 9500,
  basket_state: "OPEN",
  open_positions: 4,
  open_pairs: 2,
  total_lots: 0.4,
  baseline_equity: 10000,
  locked_profit_pct: 0,
  basket_pnl_pct: 1.5,
  weekly_pnl_pct: 2.3,
  risk_used_pct: 5,
  trade_count_week: 8,
  win_rate_pct: 62.5,
  max_drawdown_pct: -0.5,
  api_ok: true,
  trading_allowed: true,
  last_sync_utc: new Date().toISOString(),

  // Planning diagnostics payload
  planning_diagnostics: {
    signals_raw_count_by_model: {
      antikythera: 10,
      blended: 24,
      dealer: 24,
      commercial: 23,
      sentiment: 28,
    },
    signals_accepted_count_by_model: {
      antikythera: 10,
      blended: 24,
      dealer: 24,
      commercial: 23,
      sentiment: 28,
    },
    signals_skipped_count_by_reason: {
      lot_cap: 2,
    },
    planned_legs: [
      { symbol: "BTCUSD", model: "dealer", direction: "SHORT", units: 1.91 },
      { symbol: "BTCUSD", model: "blended", direction: "SHORT", units: 1.91 },
      { symbol: "ETHUSD", model: "dealer", direction: "SHORT", units: 64.48 },
      { symbol: "ETHUSD", model: "blended", direction: "SHORT", units: 64.48 },
      { symbol: "EURUSD", model: "antikythera", direction: "LONG", units: 10000 },
      { symbol: "EURUSD", model: "blended", direction: "LONG", units: 10000 },
      { symbol: "EURUSD", model: "dealer", direction: "LONG", units: 10000 },
      { symbol: "EURUSD", model: "commercial", direction: "LONG", units: 10000 },
      { symbol: "EURUSD", model: "sentiment", direction: "LONG", units: 10000 },
      { symbol: "GBPUSD", model: "antikythera", direction: "SHORT", units: 10000 },
      { symbol: "GBPUSD", model: "blended", direction: "SHORT", units: 10000 },
      { symbol: "GBPUSD", model: "dealer", direction: "SHORT", units: 10000 },
      { symbol: "GBPUSD", model: "commercial", direction: "SHORT", units: 10000 },
      { symbol: "GBPUSD", model: "sentiment", direction: "SHORT", units: 10000 },
    ],
    execution_legs: [
      { symbol: "BTCUSD", model: "dealer", direction: "SHORT", units: 1.91, position_id: 1001 },
      { symbol: "BTCUSD", model: "blended", direction: "SHORT", units: 1.91, position_id: 1002 },
      { symbol: "ETHUSD", model: "dealer", direction: "SHORT", units: 64.48, position_id: 1003 },
      { symbol: "ETHUSD", model: "blended", direction: "SHORT", units: 64.48, position_id: 1004 },
    ],
    capacity_limited: true,
    capacity_limit_reason: "lot_cap",
  },

  positions: [
    {
      ticket: 1001,
      symbol: "BTCUSD",
      type: "SELL",
      lots: 1.91,
      open_price: 95000,
      current_price: 94500,
      stop_loss: 0,
      take_profit: 0,
      profit: 955,
      swap: 0,
      commission: -5,
      open_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      magic_number: 20241101,
      comment: "dealer",
    },
    {
      ticket: 1002,
      symbol: "BTCUSD",
      type: "SELL",
      lots: 1.91,
      open_price: 95000,
      current_price: 94500,
      stop_loss: 0,
      take_profit: 0,
      profit: 955,
      swap: 0,
      commission: -5,
      open_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      magic_number: 20241101,
      comment: "blended",
    },
    {
      ticket: 1003,
      symbol: "ETHUSD",
      type: "SELL",
      lots: 64.48,
      open_price: 2600,
      current_price: 2590,
      stop_loss: 0,
      take_profit: 0,
      profit: 644.8,
      swap: 0,
      commission: -5,
      open_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      magic_number: 20241101,
      comment: "dealer",
    },
    {
      ticket: 1004,
      symbol: "ETHUSD",
      type: "SELL",
      lots: 64.48,
      open_price: 2600,
      current_price: 2590,
      stop_loss: 0,
      take_profit: 0,
      profit: 644.8,
      swap: 0,
      commission: -5,
      open_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      magic_number: 20241101,
      comment: "blended",
    },
  ],
};

async function testMt5Push() {
  console.log("🚀 Testing MT5 Push API with planning diagnostics...\n");
  console.log(`API URL: ${API_URL}`);
  console.log(`Account: ${mockSnapshot.account_id} (${mockSnapshot.label})`);
  console.log(`Planning diagnostics included: ${mockSnapshot.planning_diagnostics ? "✅ YES" : "❌ NO"}`);

  if (mockSnapshot.planning_diagnostics) {
    console.log("\nPlanning Diagnostics Summary:");
    console.log(`  Model counts: A${mockSnapshot.planning_diagnostics.signals_accepted_count_by_model.antikythera}/B${mockSnapshot.planning_diagnostics.signals_accepted_count_by_model.blended}/C${mockSnapshot.planning_diagnostics.signals_accepted_count_by_model.commercial}/D${mockSnapshot.planning_diagnostics.signals_accepted_count_by_model.dealer}/S${mockSnapshot.planning_diagnostics.signals_accepted_count_by_model.sentiment}`);
    console.log(`  Planned legs: ${mockSnapshot.planning_diagnostics.planned_legs.length}`);
    console.log(`  Execution legs: ${mockSnapshot.planning_diagnostics.execution_legs?.length ?? 0}`);
    console.log(`  Capacity limited: ${mockSnapshot.planning_diagnostics.capacity_limited ? "YES" : "NO"}`);
    console.log(`  Limit reason: ${mockSnapshot.planning_diagnostics.capacity_limit_reason ?? "N/A"}`);
  }

  console.log("\n📤 Sending POST request...\n");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mt5-token": MT5_PUSH_TOKEN,
      },
      body: JSON.stringify(mockSnapshot),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Push successful!");
      console.log("\nResponse:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Push failed with status ${response.status}`);
      console.log("\nError response:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("❌ Request failed:");
    console.error(error);
  }
}

testMt5Push();
