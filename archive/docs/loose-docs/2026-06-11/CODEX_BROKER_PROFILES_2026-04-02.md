# Codex Prompt: Broker Profile System

## Goal

Build a broker profile system that allows Freedom to:

1. Run an MT5 script on each broker terminal → exports per-symbol specs as JSON
2. Upload that JSON to the site → stored per-broker in the database
3. Select a broker profile on the Risk tab → lot sizing uses real broker specs instead of generic defaults
4. Attach SL compliance rules per broker → prop firms like 5ers get automatic per-trade SL enforcement

## Context

### Current State

- `mt5/Scripts/LimniSymbolReport.mq5` already dumps per-symbol specs to **CSV**. It reads from a JSON cache or Market Watch and outputs: api_symbol, broker_symbol, price, tick_size, tick_value, contract_size, profit_currency, digits, min_vol, max_vol, step, lot_1pct_raw, lot_1pct_norm, margin_initial, trade_mode.

- `src/lib/mt5Store.ts` already has an `Mt5LotMapEntry` type that carries broker specs: `spec_tick_size`, `spec_tick_value`, `spec_contract_size`, `spec_volume_min`, `spec_volume_max`, `spec_volume_step`.

- The `mt5_accounts` table already has a `lot_map JSONB` column that stores `Mt5LotMapEntry[]`.

- `src/lib/mt5/contracts.ts` `PolicyResponseSchema` already has `per_trade_sl_compliance_mode: z.enum(["none", "prop_pct_of_nominal"])` and `per_trade_sl_cap_pct_of_nominal: z.number()`.

- The EA (`mt5/Experts/LimniBasketEA.mq5`) already has 5ers-specific logic: `FiveersMaxLegMove1PctOfEquity`, `FiveersSymbolLotCaps`, `FiveersPerTradeRiskPct`, swap guards, daily flat/reopen, etc.

- `src/lib/accounts/accountClassification.ts` already classifies accounts by broker/server/label.

### What's Missing

1. **LimniSymbolReport outputs CSV**, not JSON. Needs JSON output matching a well-defined schema.
2. **No broker_profiles table** — specs are embedded inside mt5_accounts.lot_map which is per-account, not per-broker. We need a reusable broker profile that multiple accounts can reference.
3. **No site-side ingestion API** for broker profiles specifically.
4. **No UI** for selecting a broker profile on the Risk tab's SizingAccount.
5. **No SL compliance rules** stored per broker profile — currently hardcoded in EA inputs.

## Architecture

### Phase 1: MT5 Script → JSON Export

Modify `mt5/Scripts/LimniSymbolReport.mq5` to add a JSON output mode alongside the existing CSV.

#### New inputs:

```mql5
input bool WriteJson = true;
input string JsonOutputFile = "LimniSymbolReport.json";
```

#### JSON output schema:

```json
{
  "broker": "Eightcap-Demo",
  "server": "Eightcap-Demo",
  "account_currency": "USD",
  "equity_at_export": 100000.00,
  "exported_utc": "2026-04-02T12:00:00Z",
  "symbols": [
    {
      "api_symbol": "EURUSD",
      "broker_symbol": "EURUSD",
      "price": 1.08234,
      "tick_size": 0.00001,
      "tick_value": 1.0,
      "contract_size": 100000.0,
      "profit_currency": "USD",
      "digits": 5,
      "volume_min": 0.01,
      "volume_max": 100.0,
      "volume_step": 0.01,
      "margin_initial": 0.0,
      "trade_mode": 4
    }
  ]
}
```

The `broker` field is populated from `AccountInfoString(ACCOUNT_COMPANY)` and `server` from `AccountInfoString(ACCOUNT_SERVER)`.

**Keep the existing CSV output working.** The JSON mode is additive, not a replacement.

### Phase 2: Database — broker_profiles Table

Create a new table:

```sql
CREATE TABLE IF NOT EXISTS broker_profiles (
  profile_id VARCHAR(64) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  broker VARCHAR(100),
  server VARCHAR(100),
  account_currency VARCHAR(10) DEFAULT 'USD',
  symbol_specs JSONB NOT NULL DEFAULT '[]',
  sl_compliance_mode VARCHAR(30) DEFAULT 'none',
  sl_cap_pct_of_nominal DECIMAL(6,2) DEFAULT 0,
  notes TEXT,
  exported_utc TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Fields:
- `profile_id` — slugified from label, e.g. `eightcap-demo`, `5ers-funded-100k`
- `label` — human-readable, e.g. "Eightcap Demo", "5ers Funded 100K"
- `broker` / `server` — from MT5 export, used for auto-matching
- `symbol_specs` — the full `symbols[]` array from the JSON export
- `sl_compliance_mode` — `"none"` | `"prop_pct_of_nominal"` (matches existing policy contract)
- `sl_cap_pct_of_nominal` — e.g. `2.0` for 5ers (2% SL per trade required)
- `notes` — freeform, e.g. "5ers swap guard symbols: XAUUSD, XAGUSD..."

### Phase 3: Ingestion API

Create `src/app/api/broker-profiles/route.ts`:

**POST /api/broker-profiles** — Upsert a broker profile from MT5 JSON export.

Request body:
```typescript
{
  profile_id: string;       // required, serves as key
  label: string;            // required
  broker?: string;
  server?: string;
  account_currency?: string;
  symbol_specs: Array<{
    api_symbol: string;
    broker_symbol: string;
    price: number;
    tick_size: number;
    tick_value: number;
    contract_size: number;
    profit_currency: string;
    digits: number;
    volume_min: number;
    volume_max: number;
    volume_step: number;
    margin_initial: number;
    trade_mode: number;
  }>;
  sl_compliance_mode?: "none" | "prop_pct_of_nominal";
  sl_cap_pct_of_nominal?: number;
  notes?: string;
  exported_utc?: string;
}
```

Auth: Use the existing `x-admin-token` pattern from `/api/mt5/push`.

Response: `{ ok: true, profile_id: string, symbol_count: number }`

**GET /api/broker-profiles** — List all profiles (id, label, broker, server, symbol count, updated_at).

**GET /api/broker-profiles/[id]** — Full profile with symbol_specs.

### Phase 4: Link SizingAccount to Broker Profile

Add a `brokerProfileId` field to `SizingAccount`:

```typescript
export type SizingAccount = {
  id: string;
  name: string;
  balance: number;
  currency: string;
  riskPctPerTrade: number;
  leverage: number;
  maxPortfolioHeatPct: number;
  scaleFactor: number;
  instrumentOverrides: Record<string, Partial<InstrumentSpec>>;
  brokerProfileId: string | null;  // NEW — references broker_profiles.profile_id
};
```

Update `createDefaultAccount()` to include `brokerProfileId: null`.

Update `useSizingAccounts.ts` → `parseAccounts()` to handle the new field with backward-compatible default of `null`.

### Phase 5: Risk Tab Integration

When computing lot sizes on the Risk tab:

1. If `activeAccount.brokerProfileId` is set, fetch that broker profile's `symbol_specs`
2. For each pair in the basket, look up the matching spec by `api_symbol`
3. Use the broker spec's `tick_size`, `tick_value`, `contract_size`, `volume_min`, `volume_max`, `volume_step` to override the generic `InstrumentSpec` defaults
4. If broker profile has `sl_compliance_mode === "prop_pct_of_nominal"`, display an SL badge and compute the required SL distance per pair

#### Broker Profile Selector UI

In the `SizingAccountBar` edit panel, add a broker profile dropdown:

```
Broker Profile: [None ▼]
                 Eightcap Demo
                 5ers Funded 100K
                 GoatFunded 200K
```

When a profile is selected:
- Fetch the profile via `/api/broker-profiles/[id]`
- Store `brokerProfileId` on the account
- Risk tab lot sizing uses broker specs as highest priority

When "None" is selected:
- Fall back to existing `instrumentOverrides` → `instrumentDefaults.ts` chain

### Phase 6: SL Compliance Display

If the selected broker profile has `sl_compliance_mode !== "none"`:

- Show a small badge on the Risk tab header: `SL: 2% per trade`
- In the execution plan table, add a column showing the required SL distance in pips/price for each pair
- The SL distance = `(sl_cap_pct_of_nominal / 100) * account_balance / (lot_size * pip_value_per_lot)` in pips

This is informational for now — the actual SL enforcement happens in the EA.

## File Changes

### MT5 Side
- **Modify:** `mt5/Scripts/LimniSymbolReport.mq5` — Add JSON output mode

### Database
- **New migration** in `db/schema.sql` or new migration file — `broker_profiles` table
- Auto-migrate pattern in the API route (same as `mt5/push` does for missing columns)

### API
- **New:** `src/app/api/broker-profiles/route.ts` — POST (upsert), GET (list)
- **New:** `src/app/api/broker-profiles/[id]/route.ts` — GET (single profile with specs)

### Types & Stores
- **Modify:** `src/lib/flagship/positionSizer.ts` — Add `brokerProfileId: string | null` to `SizingAccount`, update `createDefaultAccount()`
- **Modify:** `src/hooks/useSizingAccounts.ts` — Handle `brokerProfileId` in `parseAccounts()`

### UI
- **Modify:** `src/components/flagship/SizingAccountBar.tsx` — Add broker profile dropdown in edit panel
- **Modify:** `src/components/matrix/RiskBoard.tsx` — Use broker specs when available, show SL compliance info

### New Types
- **New:** `src/lib/brokerProfiles.ts` — Type definitions and fetch helpers

```typescript
export type BrokerSymbolSpec = {
  api_symbol: string;
  broker_symbol: string;
  price: number;
  tick_size: number;
  tick_value: number;
  contract_size: number;
  profit_currency: string;
  digits: number;
  volume_min: number;
  volume_max: number;
  volume_step: number;
  margin_initial: number;
  trade_mode: number;
};

export type BrokerProfile = {
  profile_id: string;
  label: string;
  broker: string | null;
  server: string | null;
  account_currency: string;
  symbol_specs: BrokerSymbolSpec[];
  sl_compliance_mode: "none" | "prop_pct_of_nominal";
  sl_cap_pct_of_nominal: number;
  notes: string | null;
  exported_utc: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerProfileSummary = {
  profile_id: string;
  label: string;
  broker: string | null;
  server: string | null;
  symbol_count: number;
  updated_at: string;
};
```

## Acceptance Criteria

1. `LimniSymbolReport.mq5` outputs JSON when `WriteJson=true` (additive to existing CSV)
2. JSON schema matches the format specified above
3. `broker_profiles` table created with auto-migration
4. POST `/api/broker-profiles` upserts a profile, returns `{ ok, profile_id, symbol_count }`
5. GET `/api/broker-profiles` returns list of `BrokerProfileSummary[]`
6. GET `/api/broker-profiles/[id]` returns full `BrokerProfile`
7. `SizingAccount` has `brokerProfileId` field, backward-compatible (null default)
8. `SizingAccountBar` edit panel has broker profile dropdown populated from GET list
9. `RiskBoard` uses broker symbol specs when a profile is linked to the active account
10. SL compliance info displayed when broker profile has non-"none" mode
11. Existing functionality unaffected — accounts with no broker profile continue using generic defaults
12. Include the standard file header on all new files (Property of Freedom_EXE (c) 2026)
13. Auth on POST uses `x-admin-token` (same pattern as `/api/mt5/push`)
14. No new npm dependencies
