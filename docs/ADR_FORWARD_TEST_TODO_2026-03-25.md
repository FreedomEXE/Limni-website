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
- [ ] Add gamma context tagging to each trade metadata (COT/menthorq/strength for CFD, liquidation/OI/funding for crypto)

## Matrix UI
- [ ] Wire CFD + Crypto boards to fetch from /api/flagship/adr-trades and show real trade states (HIT/WATCHING/ACTIVE)
- [ ] Update intraday-levels API to read trigger states from adr-trades DB (replace hardcoded `false`)
- [ ] Add overview stats cards at top of matrix (trades count, TP hits, win rate, active trades, week return — like Flagship section cards)
- [ ] Add copy-paste button for LONG/SHORT pair lists (click → copies comma-separated pairs for indicator input)
- [ ] Add week selector to view historical weeks (sidebar card like performance lab)
- [ ] Add all-time stats card (total trades, win rate, cumulative return, weeks tracked)
- [ ] Ensure canonical week storage so historical results persist

## PineScript Indicator
- [ ] Add current-week trade counter to info table (trade count, wins, active)
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
