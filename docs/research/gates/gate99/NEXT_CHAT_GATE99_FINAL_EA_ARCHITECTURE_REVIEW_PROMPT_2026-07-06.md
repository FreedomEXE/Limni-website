# Next Chat Prompt - Gate 99L Final EA Architecture Review

Paste this into a fresh Codex chat:

```text
Continue from Limni/Poseidon state.

Recovery order:
1. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`.
2. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`.
3. Read `AGENTS.md`.
4. Read `docs/BACKTEST_CANONICAL_PROTOCOL.md`.
5. Read the current Gate 99 closeout docs:
   - `docs/research/gates/gate99/GATE99H_LIMNIBETA_SIMPLE_NAMES_2026-07-06.md`
   - `docs/research/gates/gate99/GATE99I_LIMNIBETA_EXIT_SCOPE_TP_2026-07-06.md`
   - `docs/research/gates/gate99/GATE99J_LIMNIBETA_BACKTEST_INTEGRITY_RECEIPTS_2026-07-06.md`
   - `docs/research/gates/gate99/GATE99K_LIMNIBETA_FAST_INTERNAL_SIGNALS_2026-07-06.md`

Current branch should be `codex/gate88-mt5-lifecycle-protection-controls`.
Verify live git before making branch/dirty-tree claims.

Context:
- `LimniBeta.mq5` is a diagnostic scaffold, not the final EA.
- It became too large because we stacked urgent tester fixes into one file:
  signal logic, LRMG q, grid management, account TP, week guard, receipts,
  and speed fixes.
- Gate 99K made the current single-symbol diagnostic faster by replacing
  tester-time `iCustom` signal reads with a fast internal fixed-M1 signal path.
- Freedom is currently running/trying AUDCAD diagnostics, but the next design
  problem is the final institutional 28-pair EA architecture.
- Freedom explicitly said: no code until he approves.

The next gate is review-only:

Gate 99L `final-ea-architecture-review`

Objectives:
1. Design a clean institutional MQL5 architecture for the final EA.
2. Split the final system into small `.mqh` modules instead of expanding
   `LimniBeta.mq5`.
3. Support all 28 FX pairs.
4. Support multiple strategy lanes:
   - trend-follow
   - anti-trend/reversal
   - future variants
5. Ensure strategies emit intents only; they must not directly trade.
6. Add a portfolio/risk layer that arbitrates intents.
7. Include currency-token exposure guard design.
8. Include account-level TP design across all managed symbols.
9. Include fast backtesting rules so six-year 28-pair tests do not become
   unusably slow.
10. Define what belongs in visual indicators versus inside the EA engine.

Important architecture constraints:
- Visual indicators can remain for chart inspection.
- The EA should not depend on `iCustom` visual indicators for fast backtests.
- The final engine should process newly closed M1 bars, cache per-symbol state,
  compute completed-day q once per symbol/day, and write receipts on events,
  not every bar.
- Currency exposure guard should count base/quote tokens across managed open
  positions/grids, filtered by magic/comment/strategy ownership.
- Use `SymbolInfoString(symbol, SYMBOL_CURRENCY_BASE)` and
  `SYMBOL_CURRENCY_PROFIT` where possible, with suffix-safe fallback parsing.
- Account-level TP must eventually be true portfolio-level, not only
  chart-symbol level.
- MT5 terminal-history results remain diagnostic-only unless canonical price
  lineage is proven per `docs/BACKTEST_CANONICAL_PROTOCOL.md`.

Deliverable:
- Do not code.
- Give Freedom a concise architecture proposal with:
  - proposed `.mq5` / `.mqh` file decomposition
  - core structs/enums
  - strategy intent flow
  - portfolio/risk arbitration flow
  - currency guard design
  - magic/comment convention
  - fast tester design
  - migration plan from `LimniBeta` to final EA
  - open questions that must be decided before implementation

Tone:
- Be direct and pragmatic.
- Treat `LimniBeta` as useful scaffolding but technical debt.
- Challenge any design that would balloon into a 5000-line EA.
```
