# Next Chat Handoff - 2026-05-12

This is a working recap for the next Codex/Nyx session. Load this before making changes.

## User Preferences / Operating Principles

- Do not cherry-pick one source, one pair, or one lucky parameter. Research goal is a robust final system across all data sources.
- User is comfortable with a heavy first load after meaningful data/engine updates, but after that the app must be fast. Think "game map loading screen": build/check/load once, then navigation and strategy switching should be instant.
- Loading UI must reflect real work. Do not add cosmetic spinners/cards that do not actually build/check artifacts.
- UI-only changes must not invalidate or recompute strategy data.
- Data/engine version changes should invalidate only the affected computation layer.
- Do not hide ADR Grid from preload just to unblock the app. User wants to inspect ADR Grid, so it must be built properly.
- Pine indicator work is paused. Focus is the web app and research/automation path.
- Push commits when asked. Be careful with the dirty working tree: do not stage unrelated files.

## Current Repo / Git Notes

Recent pushed commits relevant to this session:

- `3079858 Fix performance equity path consistency`
  - Fixed closed trade realized P/L carry-forward in path engine.
  - Canonicalized position ledger return fields.
  - Sorted multi-week path processing oldest-to-newest.
  - Asset curves now use hourly path engine.
  - Bumped `PATH_SIMULATION_VERSION = path-simulation-v3` and `STRATEGY_ASSEMBLY_VERSION = assembly-v3`.

- `f18350e Fix performance artifact week freshness`
  - Performance artifact readiness now rejects stale week artifacts.
  - Checks `currentWeekOpenUtc` and completed-week signature.
  - `readReadyStrategyArtifactPayload()` now goes through `loadStrategyPageData()` for ready artifacts so current-week overlay gets merged instead of serving stale persisted snapshots directly.
  - Verified locally that Selector/Tandem Weekly Hold returned current week `2026-05-10T23:00:00.000Z` and completed week `2026-05-03T23:00:00.000Z`.

Known unrelated dirty/untracked files existed during prior work. Do not stage unless explicitly needed:

- `next-env.d.ts`
- `reports/bias-gate/canonical-weekly-basket-latest.json`
- `scripts/pinescript/limni-adr-levels.pine`
- various untracked `docs/CODEX_*.md`, research scripts, and reports.

## Research Conclusions So Far

### ADR Grid / Close + Rearm

Core tested system:

- Entry style: ADR Grid.
- Grid spacing: best zone was `0.15-0.20 ADR`; `0.20 ADR` preferred for fewer fills and similar/better R/DD.
- Exit: close 100% at `+0.10 ADR`, then re-arm that fill level.
- No cycle re-entry. Re-entry increased return but caused drawdown to explode.
- ADR-normalized sizing is canon and should apply to all systems. It should not be a user-selectable option.

Key results from FX-only spacing sweep, Close 100% + Rearm:

- `0.10 ADR`: +503.99%, 48.94% DD, 10.30 R/DD, 4,743 fills/week.
- `0.15 ADR`: +586.02%, 47.84% DD, 12.25 R/DD, 2,554 fills/week.
- `0.20 ADR`: +595.25%, 48.67% DD, 12.23 R/DD, 1,558 fills/week.
- `0.25 ADR`: +556.95%, 47.87% DD, 11.63 R/DD, 1,015 fills/week.

Interpretation: `0.10 ADR` was overtrading. `0.20 ADR` is the better execution-efficiency point.

### Asset Class

Close 100% + Rearm combined asset class results:

- FX: +503.99%, 48.94% DD, 10.30 R/DD, 4,743 fills/week.
- Indices: +39.90%, 19.83% DD, 2.01 R/DD.
- Commodities: +24.68%, 20.38% DD, 1.21 R/DD.
- Crypto: +36.25%, 12.72% DD, 2.85 R/DD.

FX carries most return and most DD. Non-FX is not destructive in no-reentry Close+Rearm, but re-entry was especially bad for commodities.

### Composite Systems

Tested FX-only, `0.20 ADR`, Close+Rearm:

Top candidates:

- Strength-Led: +264.78%, 11.33% DD, 23.37 R/DD.
- Strength-Led Norm: +164.38%, 8.50% DD, 19.34 R/DD.
- Agreement 3+: +115.98%, 6.33% DD, 18.32 R/DD.
- Selector trailing 6w: +201.54%, 12.00% DD, 16.80 R/DD.

Robustness review favored Agreement 3+:

- Agreement 3+ had lowest DD/Ulcer, stable split halves, no losing weeks, no negative 4-week rolling blocks.
- Strength-Led had higher return but more concentration and more half-split decay.
- User is cautious about overweighting Strength due to only ~15 weeks of history and prefers equal-weight structural systems.

Existing "Agreement" app description already matches Agreement 3+ logic:

> Four-source agreement filter. Trades when 3 or more of Dealer, Commercial, Sentiment, and Strength align on direction. Ties are selectively resolved when the Sentiment+Strength side agrees, otherwise skipped.

### Exposure Cap

Best improvement for Agreement 3+:

- Name in app: `Exposure Cap`.
- Intended as a risk overlay/filter, not an entry style.
- FX logic: track net currency exposure from accepted/open trades.
  - Example: EURUSD long = +EUR, -USD.
  - Cap tested: `1.5` net currency exposure.
- Non-FX currently falls back to asset-class buckets so it can be applied generally.

Agreement 3+ baseline vs cap:

- Baseline: +110.43%, 6.33% DD, 17.44 R/DD, 15/0, max fill-level concentration 6.80 JPY.
- Cap 1.5: +67.54%, 3.15% DD, 21.43 R/DD, 15/0, max concentration ~2.05 EUR.

Decision: adopt Exposure Cap. Thin-market 2h block was marginal and dropped.

## App / Artifact Architecture Status

Performance artifacts were added because strategy computation, especially ADR Grid, is too heavy on request path.

Current architecture pieces:

- `strategy_artifacts`: monolithic persisted payloads for strategy selections.
- `strategy_week_shards`: per-week shards so heavy ADR Grid builds survive across invocations.
- Cron/admin warm routes exist:
  - `/api/cron/strategy-artifacts`
  - `/api/admin/warm-artifacts`
  - burst mode was added earlier.
- Readiness/status endpoint:
  - `/api/performance/strategy-artifacts/status`
- Request warm endpoints:
  - `/api/performance/strategy-artifacts/request-warm`
  - `/api/performance/strategy-artifacts/request-bulk-warm`

Important fixes already done:

- Shards were introduced so one Vercel function does not need to compute all 15 weeks of ADR Grid in one run.
- Read path was changed to serve from shards when monolithic artifact cannot be persisted.
- Later, stale-week detection was fixed because Performance missed new weeks while Data had them.

Known concern:

- `readReadyStrategyArtifactPayload()` now calls `loadStrategyPageData()` for ready artifacts to merge current week. This prevents stale current-week display but may be slower than the ideal pure artifact fast path.
- Need to monitor whether this reintroduces slow strategy switching. The correct long-term architecture may need a small current-week overlay artifact/cache, not a full recompute/read path.

## Current Issue Before Handoff

User reported:

- Data section shows current week May 11, 2026.
- Performance section was missing the last two weeks.
- The latest commit `f18350e` should address this by invalidating stale week artifacts and merging current-week data.

Need next chat to verify in deployed app:

1. Open Performance.
2. Confirm week pills include:
   - `MAY 11 2026` current week
   - `MAY 04 2026` completed week
   - `APR 27 2026`, etc.
3. Test multiple strategies/entry styles, especially:
   - Selector Weekly Hold
   - Tandem Weekly Hold
   - Agreement Weekly Hold
   - ADR Grid variants
4. Check that no "artifact not ready" card appears during normal use once loading gate completes.

## Numbers / Drawdown Quality Work Still Needed

User wants to return to strategy accuracy before bot automation:

- Quadruple-check drawdown, equity curves, and all visible performance numbers.
- Equity curves were previously reported broken across the board.
- Need Playwright audit to compare values across:
  - Sidebar
  - Flagship cards
  - Comparison panel
  - Simulation cards
  - Equity curve header
- Negative DD anywhere is an automatic bug.

Prompts/docs referenced:

- `docs/CODEX_PHASE1_DD_CONSISTENCY_FIX_2026-05-09.md`
- `docs/CODEX_PHASE2_PLAYWRIGHT_NUMBERS_AUDIT_2026-05-10.md`
- `docs/CODEX_SPLIT_ENGINE_ASSEMBLY_VERSIONS_2026-05-09.md`
- `docs/CODEX_VERSIONED_SHARD_TABLE_2026-05-10.md`

Known DD/assembly issue previously identified:

- `buildMultiWeekResultFromWeeks()` in `strategyPageData.ts` had a negative DD formula similar to the one fixed in `weeklyHoldEngine.ts`.
- Version split was introduced:
  - shard engine version for computation changes.
  - assembly version for display/formula changes.
  - UI-only changes should not bump either.

## Automation Direction

After numbers are trusted, goal is to decide which system to automate into a bot.

Candidate system likely:

- Agreement 3+.
- Entry style likely ADR Grid Close+Rearm at `0.20 ADR`.
- Exposure Cap overlay.
- ADR-normalized sizing.

There is old automation work in repo:

- Old MT5 bot exists somewhere and was essentially original Tandem style.
- Need later inventory before building new automation:
  - MT5 account integration.
  - Bitget bot.
  - weekly basket bot.
  - current risk/account pages.

## Trading Context Mentioned By User

Use care: this is live trading risk context, not app implementation.

User had:

- 5ers Phase 1 account:
  - balance ~100,155
  - equity ~96,500 at the time
  - positions:
    - AUDUSD, EURUSD, GBPUSD, NZDUSD shorts
    - USDCAD, USDCHF longs
    - BTCUSD, ETHUSD shorts
  - roughly 0.5 lots each forex pair, significant BTC/ETH size.
- Bitget BTC/ETH shorts with BTC liquidation around ~84k.
- User was asking about USD and crypto liquidation analysis. Those require fresh live market data if revisited.

## Suggested Next Steps

1. Verify deployed Performance weeks after `f18350e`.
2. If Performance still missing weeks, inspect:
   - `/api/performance/strategy-page-data?...`
   - `/api/performance/strategy-artifacts/status?...`
   - DB rows in `strategy_artifacts` and `strategy_week_shards`
   - `currentWeekOpenUtc`, `weekOptionsSignature`, and `fingerprint_json`.
3. Run/repair Playwright numbers audit.
4. Fix any remaining DD/equity curve inconsistencies.
5. Once numbers are trusted, compare final candidate systems for automation.
6. Only then revisit bot implementation.

