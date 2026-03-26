# ADR Forward Test — Task List (2026-03-25)

> Living document. Updated as tasks complete or new items added.

## Status Key
- [ ] Pending
- [x] Done

---

## Backfill & Data
- [x] Build H1 trade scanner (adrTradeScanner.ts — Fresh Start state machine)
- [x] Build hourly cron (adr-trade-scan — idempotent, re-scans from week open)
- [x] Build read API (adr-trades — returns current week's trades from DB)
- [x] Trigger first backfill scan (46 trades, 45 TP hits, +16.83% return this week)
- [ ] Extend cron to scan all crypto pairs using BTC/ETH regime bias (Bitget H1 candles)
- [ ] Re-run backfill to include crypto trades
- [ ] Add gamma context tagging to each trade metadata (COT/menthorq/strength for CFD, liquidation/OI/funding for crypto)

## Matrix UI
- [x] Wire CFD board to fetch from /api/flagship/adr-trades and show real trade states
- [x] Update intraday-levels API to read trigger states from adr-trades DB
- [x] Add overview stats cards at top of matrix (AdrStatsBar shared component)
- [x] Add copy-paste button for LONG/SHORT pair lists with toast confirmation
- [x] Extract shared AdrStatsBar component (used by both CFD and Crypto boards)
- [x] CryptoBoard: add AdrStatsBar + copy buttons (stats zeros until crypto cron built)
- [x] Crypto matrix: surface all pairs (DISPLAY_LIMIT 40 → 140)
- [x] Fix trigger state: HIT only for active trades, WATCHING for completed
- [ ] Add week selector to view historical weeks (sidebar card like performance lab)
- [ ] Add all-time stats card (total trades, win rate, cumulative return, weeks tracked)
- [ ] Ensure canonical week storage so historical results persist

## PineScript Indicator
- [x] Add current-week trade counter to info table (trade count, TP hits)
- [ ] Visual fixes — verify trade boxes render correctly across multiple Fresh Start re-entries
- [ ] Verify indicator and matrix show identical trades for the same week (parity check)

## Future Ideas (parked)
- Staggered TP (0.25/0.5/1.0) — backtest showed single 0.25 + re-entry beats stagger
- Session-gated entries — backtest showed marginal improvement, adds complexity
- Recursive ADR / ADR-VAP — interesting theory, not actionable yet
- AVWAP / StdDev confluence — manual discretionary, hard to automate
- Dynamic TP (scale exits based on momentum) — needs research
- Multiple entries at same level (DCA-style) — Freedom's idea, needs backtest design

---

## Architecture Reference

**DB**: Uses existing `strategy_backtest_trades` table. Run ID = 54 (bot_id: "adr-forward", variant: "fresh-start").

**Scanner**: `src/lib/flagship/adrTradeScanner.ts` — ports backtest's `simulateVariantA` exactly.

**Cron**: `src/app/api/cron/adr-trade-scan/route.ts` — runs at :25 past each hour on Vercel.

**Read API**: `src/app/api/flagship/adr-trades/route.ts` — returns trades for current or specified week.

**Indicator**: `scripts/pinescript/limni-adr-levels.pine` — Fresh Start, chart TF, ~376 lines.

**Strategy**: 1x ADR entry from running weekly extreme, 0.25x ADR TP, Fresh Start re-entry (anchor resets after TP).
