/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Codex Brief: Weekly System Reconstruction
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

## Objective

Reconstruct ALL weekly strategy backtests from scratch using clean, simple, auditable rules. The goal is to produce a single source of truth for every weekly system so that all numbers are consistent, reproducible, and trustworthy going forward.

**Systems to reconstruct:**
- Universal V1, V2, V3
- Tiered V1, V2, V3

**Total: 6 systems, 9 weeks each, all persisted to `strategy_backtest_runs` / `strategy_backtest_weekly`.**

---

## Rules — READ THESE FIRST

These rules are non-negotiable. Every system must follow them exactly.

### Trading Rules

1. **Net only.** For each pair in a given week, count how many models vote LONG and how many vote SHORT. If `net === 0` (equal longs and shorts), **skip that pair entirely** for the week. If `net > 0`, the pair is LONG with `|net|` units. If `net < 0`, the pair is SHORT with `|net|` units.

2. **Hold till end of week.** Every position opens at the weekly open and closes at the weekly close. No intraweek take-profit, no trailing stops, no early exits.

3. **No compounding.** Each week is independent. Returns are measured as percentage return for that week only. When computing multi-week totals, use **compounded** math: `product(1 + week_return_pct/100) - 1`. But each individual week's return is computed independently — the result of week 1 does not affect the capital in week 2.

4. **No hedging.** The netting rule in point 1 handles this. If models perfectly offset, the pair is skipped. No opposing positions are ever held simultaneously.

5. **No carry.** Every position is opened and closed within the same week. Nothing carries to the next week.

### Data Rules

6. **9 weeks, hardcoded:**
```typescript
const CANONICAL_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
  "2026-02-23T00:00:00.000Z",
  "2026-03-02T00:00:00.000Z",
  "2026-03-08T23:00:00.000Z",
  "2026-03-15T23:00:00.000Z",
];
```
Note: weeks 8-9 use `23:00` due to DST transition. Use `normalizeWeekOpenUtc()` from `src/lib/weekAnchor.ts` if needed.

7. **Source: `performance_snapshots` table.** Use `readPerformanceSnapshotsByWeek(weekOpenUtc)` from `src/lib/performanceSnapshots.ts`. This returns rows with `model`, `asset_class`, and `pair_details[]` where each pair_detail has `{ pair, direction, percent }`. The `percent` field is the open-to-close weekly return for that pair under that model.

8. **Weekly return calculation.** For each week, for each system:
   - Load all snapshot rows for that week
   - Filter to the system's model set
   - Extract signals: `{ symbol, direction, model, asset_class }` from `pair_details`
   - Apply netting via `groupSignals()` from `src/lib/plannedTrades.ts` with `{ dropNetted: true }`
   - For each surviving pair: the weekly return for that pair = `pair_detail.percent` (already stored as open-to-close). Weight by `|net|` units if net > 1.
   - Weekly system return = average of all active pair returns (equal-weighted per net unit)

9. **Win/loss counting.** A pair-week is a WIN if its return > 0, LOSS if <= 0. Wins/losses count per net unit (if net = 2, it counts as 2 trades).

10. **Drawdown.** Compute from the compounded weekly equity curve: `equity[i] = equity[i-1] * (1 + weekReturn/100)`, starting at 100. Max drawdown = maximum peak-to-trough decline as a percentage of the peak.

### Model Sets Per System

11. **Model configuration.** Each system uses a specific set of models to vote on direction:

| System       | Models (voters)                                      | Source constant                |
|-------------|------------------------------------------------------|--------------------------------|
| Universal V1 | `antikythera`, `blended`, `dealer`, `commercial`, `sentiment` | `PERFORMANCE_V1_MODELS` |
| Universal V2 | `dealer`, `sentiment`, `antikythera_v2`              | `PERFORMANCE_V2_MODELS`       |
| Universal V3 | `antikythera_v3`, `dealer`, `commercial`, `sentiment` | `PERFORMANCE_V3_MODELS`       |
| Tiered V1    | `blended`, `dealer`, `commercial`, `sentiment`       | `TIER_SOURCE_MODELS.v1`       |
| Tiered V2    | `dealer`, `sentiment`                                | `TIER_SOURCE_MODELS.v2`       |
| Tiered V3    | `dealer`, `commercial`, `sentiment`                  | `TIER_SOURCE_MODELS.v3`       |

These are defined in:
- `src/lib/performance/modelConfig.ts` (Universal models)
- `src/lib/performance/tiered.ts` (Tiered models: `TIER_SOURCE_MODELS`)

**Important:** `antikythera_v2` is NOT stored in `performance_snapshots`. It is derived on-the-fly. Use `deriveAntikytheraV2Rows()` from `src/lib/performance/tiered.ts` to generate it before processing Universal V2 weeks.

### Tiered vs Universal — Key Difference

12. **Universal** treats all models as equal voters. Each model generates a directional signal per pair. Netting collapses them to a net direction.

13. **Tiered** uses tier classification via `classifyTierForVotes()` from `src/lib/performance/tiered.ts`. The tier determines allocation weight, not just direction:
    - Tier 1 (all agree): 3x base allocation
    - Tier 2 (majority agree): 1.5x base allocation
    - Tier 3 (marginal majority): 1x base allocation

    For the reconstruction, tier classification changes the **weight** of the return, not whether we trade:
    - Tier 1 return counts 3x
    - Tier 2 return counts 1.5x
    - Tier 3 return counts 1x
    - The weekly return is the weighted average across all tiered pairs

    **V2 has no Tier 3** (only 2 voters, so they either agree = Tier 1, or one is neutral = Tier 2).

---

## Implementation

### Phase 1: Create unified backtest script

Create a single script: `scripts/reconstruct-weekly-systems.ts`

This script:
1. Iterates all 6 systems
2. For each system, iterates all 9 weeks
3. Loads snapshots, derives signals, applies netting (Universal) or tier classification (Tiered)
4. Computes weekly returns using pair_details.percent (the stored open-to-close return)
5. Computes multi-week compounded return, max drawdown, win rate, trade count
6. Persists each system to `strategy_backtest_runs` / `strategy_backtest_weekly` via `persistStrategyBacktestSnapshot()` from `src/lib/performance/strategyBacktestIngestion.ts`
7. Writes a verification report to `reports/weekly-reconstruction-audit.json`

### Phase 2: Registry updates

Update `src/lib/performance/strategyRegistry.ts` so all 6 systems point to their DB-backed results:

```typescript
// For each system, set:
dataMode: "strategy_backtest_db",
backtestBotId: "<system_bot_id>",
backtestVariant: "<v1|v2|v3>",
backtestMarket: "multi_asset",
summarySourcePolicy: "prefer_db",
```

Bot IDs to use:
- `universal_v1_net_hold` (was `universal_v1_tp1_friday_carry_aligned` — we're replacing it)
- `universal_v2_net_hold`
- `universal_v3_net_hold`
- `tiered_v1_net_hold` (was `tiered_v1_flagship` — we're replacing it)
- `tiered_v2_net_hold`
- `tiered_v3_net_hold`

### Phase 3: Verification report

The `reports/weekly-reconstruction-audit.json` must contain for each system:

```json
{
  "system": "universal_v1",
  "bot_id": "universal_v1_net_hold",
  "weeks": 9,
  "weekly_returns": [
    { "week": "2026-01-19T00:00:00.000Z", "return_pct": 2.34, "trades": 12, "wins": 8, "losses": 4 }
  ],
  "compounded_return_pct": 15.67,
  "max_drawdown_pct": 3.45,
  "total_trades": 108,
  "total_wins": 72,
  "total_losses": 36,
  "win_rate": 66.67,
  "pairs_skipped_due_to_netting": 23,
  "config": {
    "mode": "net_only",
    "carry": "none",
    "stops": "none",
    "tp": "none",
    "hold": "open_to_close",
    "weeks": 9,
    "models": ["antikythera", "blended", "dealer", "commercial", "sentiment"]
  }
}
```

### Phase 4: Update Performance page data source

After reconstruction, the Performance page (`src/app/performance/page.tsx`) should automatically pick up the new DB-backed results because the registry entries will point to the new bot IDs. Verify this works by running `npm run build`.

### Phase 5: Audit comparison

Create `scripts/verify-reconstruction.ts` that:
1. Reads the persisted `strategy_backtest_weekly` rows for each system
2. Re-derives the same calculation from raw `performance_snapshots` in-memory
3. Asserts that every weekly return matches to within 0.0001%
4. Outputs PASS/FAIL for each system

This is a **hard gate**. If verification fails for any system, do not proceed.

---

## Existing Code to Reuse

| What | Where | How |
|------|-------|-----|
| Load weekly snapshots | `readPerformanceSnapshotsByWeek()` | `src/lib/performanceSnapshots.ts` |
| Signal netting | `groupSignals(signals, models, { dropNetted: true })` | `src/lib/plannedTrades.ts` |
| Tier classification | `classifyTierForVotes()` | `src/lib/performance/tiered.ts` |
| Antikythera V2 derivation | `deriveAntikytheraV2Rows()` | `src/lib/performance/tiered.ts` |
| Model constants | `PERFORMANCE_V1_MODELS`, etc. | `src/lib/performance/modelConfig.ts` |
| DB persistence | `persistStrategyBacktestSnapshot()` | `src/lib/performance/strategyBacktestIngestion.ts` |
| DB upsert layer | `upsertStrategyBacktestSnapshot()` | `src/lib/performance/strategyBacktestStore.ts` |
| Week normalization | `normalizeWeekOpenUtc()` | `src/lib/weekAnchor.ts` |
| Strategy registry | `strategyRegistry.ts` | `src/lib/performance/strategyRegistry.ts` |
| Env loading pattern | See `scripts/ingest-tiered-flagship-backtest.ts` lines 19-37 | Copy this pattern |

---

## DO NOT

- **DO NOT** use carry mode. All positions close at week end.
- **DO NOT** use take-profit targets. Hold to close.
- **DO NOT** use stops. Hold to close.
- **DO NOT** fetch live price data from Oanda or Bitget. Use the stored `pair_details.percent` from `performance_snapshots`.
- **DO NOT** sum weekly returns for multi-week totals. Always compound: `product(1 + r/100) - 1`.
- **DO NOT** touch `/flagship`, `/flagship/crypto`, or any existing matrix pages.
- **DO NOT** modify existing backtest scripts. Create new ones.
- **DO NOT** change the `performance_snapshots` table or its data.
- **DO NOT** modify `strategyBacktestIngestion.ts` or `strategyBacktestStore.ts` (the persistence layer is already correct).

---

## Execution Order

1. Read and understand the model configs, `groupSignals()`, and `classifyTierForVotes()`
2. Create `scripts/reconstruct-weekly-systems.ts`
3. Run it against the DB — verify output in console
4. Check `reports/weekly-reconstruction-audit.json` for correctness
5. Update `strategyRegistry.ts` with new bot IDs and `dataMode: "strategy_backtest_db"`
6. Create `scripts/verify-reconstruction.ts` and run it — must PASS for all 6 systems
7. Run `npx tsc --noEmit` — must pass
8. Run `npm run build` — must pass
9. Commit all changes

---

## Success Criteria

- All 6 systems have 9 weekly rows each in `strategy_backtest_weekly`
- All weekly returns are derived from `performance_snapshots.pair_details.percent` with net-only logic
- Compounded returns and drawdowns are mathematically verified
- `verify-reconstruction.ts` passes for all 6 systems
- TypeScript compiles clean
- Production build passes
- No regressions to existing pages

---

## File Header

Every new file must include:

```
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: <filename>
 *
 * Description:
 * <what it does>
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
```
