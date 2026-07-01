# Gate 82E Single Trade Window Boundary Correction

Status: source contract correction receipt.

Verdict:

`PASS_GATE82E_SINGLE_TRADE_WINDOW_SOURCE_CORRECTED_NO_COMPILE_NO_TESTER_NO_COMPARISON_CLAIM`

## Scope

Gate 82E corrects the MT5 EA weekly boundary contract after Freedom simplified
the rule:

- one trade window only: Sunday 20:00 ET through Friday 11:00 ET;
- no entries outside the trade window;
- no grid fills outside the trade window;
- no target closes outside the trade window;
- open grids wait and resume when the next trade window opens.

This gate does not compile in MetaEditor, install terminal files, run MT5
Strategy Tester, run warehouse comparisons, optimize grid caps, promote a
variant, or make live-readiness claims.

## Source Changes

| Area | Change |
| --- | --- |
| Week key | `LimniGetWeekStartGmt` now keys the canonical trade week to Sunday 20:00 ET. |
| Trade window | Added `LimniIsTradeWindowOpen`: Sunday 20:00 ET through Friday 11:00 ET. |
| Compatibility aliases | `LimniIsEntryWindowOpen` and `LimniIsActionWindowOpen` now both delegate to the single trade window. |
| EA lifecycle | Initial entries, grid fills, current-week target closes, carried-week target closes, and price-anchor updates now use the same trade-window gate. |
| Visual/log labels | The symbol dashboard and CSV symbol-state log now expose `trade_window_open` instead of separate entry/action windows. |

## Research Implication

Gate 82D remains useful diagnostic evidence, but it is not the final
apples-to-apples comparison because it did not replay both old raw fill-anchor
and new price-anchor variants under this corrected single-window contract.

The next warehouse comparison must replay all candidate rows fresh under the
same Sunday 20:00 ET to Friday 11:00 ET trade window. The only intended
difference between raw and price-anchor V2 should be the weekly anchor logic.

## Frozen

No all-28 MT5 runtime, risk layer, live trading, Candidate B rescue,
Brain/COT/Strength/Regime work, pair-net flatten, cap optimization, promotion,
final naming, app/runtime integration, or live-readiness work is opened by this
gate.
