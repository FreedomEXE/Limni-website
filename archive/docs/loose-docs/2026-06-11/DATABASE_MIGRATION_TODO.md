# Database Migration to PostgreSQL - TODO

## Current Status

✅ **Completed:**
- PostgreSQL database provisioned on Render
- Database schema created (`db/schema.sql`)
- Migration API endpoint created (`/api/db/migrate`)
- Database tables initialized successfully
- `pg` library installed

## What's Left to Do

### 1. Create Database Connection Pool Utility

**File**: `src/lib/db.ts`

Create a reusable database connection pool for all database operations.

**Key Features:**
- Singleton pool pattern (reuse connections)
- SSL configuration for production
- Connection pooling for performance
- Helper functions for queries

---

### 2. Update MT5 Store (`src/lib/mt5Store.ts`)

**Current**: Stores data in `data/mt5_accounts.json`

**New**: Store in PostgreSQL tables:
- `mt5_accounts` - Current account state
- `mt5_positions` - Open positions
- `mt5_snapshots` - Historical tracking

**Functions to Update:**
- `upsertMt5Account()` - Insert/update account + positions
- `getMt5Accounts()` - Fetch all accounts from DB
- `getMt5AccountById()` - Fetch single account with positions

---

### 3. Update COT Store (`src/lib/cotStore.ts`)

**Current**: Stores data in `data/cot_snapshot.json`

**New**: Store in `cot_snapshots` table

**Functions to Update:**
- `writeSnapshot()` - Upsert COT data
- `readSnapshot()` - Fetch latest COT snapshot

**Note**: Store `currencies` and `pairs` as JSONB for flexibility

---

### 4. Update Price Store (`src/lib/priceStore.ts`)

**Current**: Stores data in `data/market_snapshot.json`

**New**: Store in `market_snapshots` table

**Functions to Update:**
- `writeSnapshot()` - Insert weekly price data
- `readSnapshot()` - Fetch latest market snapshot

---

### 5. Update Sentiment Store (`src/lib/sentiment/store.ts`)

**Current**: Stores data in `data/sentiment_*.json` files

**New**: Store in PostgreSQL tables:
- `sentiment_data` - Raw provider data
- `sentiment_aggregates` - Computed aggregates

**Functions to Update:**
- Sentiment writing functions
- Sentiment reading functions
- Aggregate calculation queries

---

## Implementation Steps

### Step 1: Create DB Utility
```
src/lib/db.ts
```
- Connection pool setup
- Query helper functions
- Error handling

### Step 2: Update MT5 Store
Priority: HIGH (this is the main data source)

- Modify `upsertMt5Account()` to use PostgreSQL
- Update account retrieval functions
- Add position management
- Create historical snapshots

### Step 3: Update COT Store
Priority: MEDIUM

- Migrate JSON storage to PostgreSQL
- Update read/write functions
- Test with COT refresh endpoint

### Step 4: Update Price Store
Priority: MEDIUM

- Store market snapshots in DB
- Update retrieval logic

### Step 5: Update Sentiment Store
Priority: LOW (can wait)

- Migrate sentiment data storage
- Update aggregate calculations

---

## Testing Checklist

After each store update:

- [ ] Test locally with DATABASE_URL
- [ ] Verify data writes correctly
- [ ] Verify data reads correctly
- [ ] Check error handling
- [ ] Deploy to Render and test

Final testing:

- [ ] MT5 EA pushes data successfully
- [ ] Accounts page displays data
- [ ] Positions show correctly
- [ ] COT data refreshes work
- [ ] Historical data accessible

---

## MT5 EA Configuration

Once MT5 store is migrated:

**Update in MetaEditor:**
1. Change `PushUrl` input parameter:
   - From: `http://127.0.0.1:3001/api/mt5/push`
   - To: `https://limni-website.onrender.com/api/mt5/push`

2. Set `PushToken` to match Render env var `MT5_PUSH_TOKEN`

3. Recompile EA (F7)

4. Restart EA on chart

---

## Code Examples

### Database Connection Utility

```typescript
// src/lib/db.ts
import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
    });
  }
  return pool;
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows;
}
```

### MT5 Account Upsert Example

```typescript
// In mt5Store.ts
import { getPool } from "./db";

export async function upsertMt5Account(snapshot: Mt5AccountSnapshot) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Upsert account
    await client.query(`
      INSERT INTO mt5_accounts (account_id, label, equity, ...)
      VALUES ($1, $2, $3, ...)
      ON CONFLICT (account_id) DO UPDATE SET ...
    `, [...]);

    // Delete old positions
    await client.query(
      "DELETE FROM mt5_positions WHERE account_id = $1",
      [snapshot.account_id]
    );

    // Insert new positions
    for (const pos of snapshot.positions || []) {
      await client.query(`
        INSERT INTO mt5_positions (...)
        VALUES (...)
      `, [...]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

---

## Environment Variables

**Render requires:**
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Render)
- `ADMIN_TOKEN` - For protected endpoints
- `MT5_PUSH_TOKEN` - For MT5 data push
- `AUTH_USERNAME` - Login username
- `AUTH_PASSWORD` - Login password
- `NODE_ENV=production`

---

## Rollback Plan

If migration fails:
1. Keep JSON file-based stores as fallback
2. Use conditional logic: `if (DATABASE_URL) { use DB } else { use files }`
3. Can run hybrid mode during migration

---

## Next Session

**Start with:** Create `src/lib/db.ts` and update `mt5Store.ts`

**Goal:** Get MT5 data flowing from EA → PostgreSQL → Frontend

---

**Status**: Ready for implementation
**Priority**: MT5 store first (highest value)
**Estimated Time**: 2-3 hours for full migration
**Last Updated**: 2026-01-14
