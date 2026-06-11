# v2.0.3 Release Candidate Handoff

Canonical app-visible handoff: [`releases/v2/handoff.md`](../../releases/v2/handoff.md)

Next-chat TradingView parity handoff: [`NEXT_CHAT_TRADINGVIEW_PARITY_HANDOFF_2026-06-03.md`](./NEXT_CHAT_TRADINGVIEW_PARITY_HANDOFF_2026-06-03.md)

Use the TradingView parity handoff above for the next chat. This duplicate exists only because older workflows look in `docs/handoffs/`.

## Immediate Next Step

Do not continue final TradingView screenshot capture until the corrected path contract is visually checked in the app.

## June 4 Status Change

v2.0.3 is no longer close to release. Treat it as blocked by engine correctness work, not as a polish/verification patch.

New blockers discovered:

- app execution close timing is wrong for the desired shared strategy window;
- app market/execution windows need a documented `America/New_York` contract across FX, indices/commodities, and crypto;
- ADR Grid/Pair Fill Cap visible UI rows, stored ledger rows, and canonical compute output do not reliably agree;
- the Pine verifier has been updated first to express the intended timing and visual contract, but the app still needs to be redesigned to match it.

Current intended contract:

- Market-truth open: FX Sunday 6pm NY, indices/commodities Sunday 7pm NY, crypto Sunday 8pm NY.
- Execution open: Sunday 8pm NY for all assets.
- Execution close: Friday 4pm NY for all non-crypto, next Sunday 8pm NY for crypto.
- Weekly visual/canonical box remains market-truth/canonical; grid lines and START/STOP markers remain inside the execution window.

Use [`NEXT_CHAT_TRADINGVIEW_PARITY_HANDOFF_2026-06-03.md`](./NEXT_CHAT_TRADINGVIEW_PARITY_HANDOFF_2026-06-03.md) as the current source of truth despite the older file date in its name.

Current project stage:

- Found a configuration that works on paper.

Next stage:

- Verify the data is correct.

Reference specs:

- [`ADR_GRID_DRAWDOWN_UNIFICATION_SPEC_2026-06-03.md`](../data-verification/ADR_GRID_DRAWDOWN_UNIFICATION_SPEC_2026-06-03.md)
- [`releases/v2/verification.md`](../../releases/v2/verification.md)

TradingView parity status:

- Weekly Hold EURUSD 3-week parity is already passed at 100% for Market Truth/Execution and Raw/ADR-normalized.
- ADR Grid EURUSD no-cap is accepted for first-pass parity with the documented canonical price-store/broker-feed caveat.
- Current no-cap app screenshot captured on 2026-06-03: Tiered / ADR Grid / None, ADR-normalized, FX, EURUSD SHORT, `4 fills / +0.80%`.
- ADR Grid + Pair Fill Cap ADR-normalized Pine screenshots are now captured for EURUSD Weeks Back `0/1/2`; current week and May 25 match app fills/P&L, but May 18 is failed/open. The visible app UI row shows `1 grid`, `5W / 1L`, `+0.19%`, and cap `2/3 max active`, while Pine expects `11 fills / +2.2%` and `computeWeeklyHold()` returns `12 fills / +2.4%`.
- Expected exactness drift can still be classified as TradingView/broker-feed versus canonical price-store variance when fill logic is otherwise aligned. May 18 Pair Fill Cap is not aligned and should be treated as a visible app artifact/rollup mismatch until stored ledger rows and canonical app output are reconciled.

App UI note:

- Fill rows show MAE, but the grid rows and tier headers do not consistently show modular DD/MAE beside returns.
- Desired future behavior: tier header DD next to tier return, grid DD next to grid return, and child MAE/DD rows, using the same hierarchy pattern as returns.
- May 25 Pair Fill Cap screenshot shows that desired hierarchy behavior on week/grid/fill rows; other inspected weeks did not show it consistently.
- The MAE/DD hierarchy and zero-versus-missing MAE behavior are part of the next pass, alongside May 18 visible app output reconciliation.

Screenshot note:

- Current v2.0.3 screenshots are earlier candidate evidence from before the ADR Grid P/L unit fix.
- Replace them before v2.0.3 main/live approval.
