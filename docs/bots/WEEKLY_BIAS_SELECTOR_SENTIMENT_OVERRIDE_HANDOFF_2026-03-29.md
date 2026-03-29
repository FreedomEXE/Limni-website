## Weekly Bias Selector Handoff

Candidate strategy:

- `selector_sentiment_context_override`

Status:

- saved as current weekly-bias context-engine leader
- research result only until visual site verification is complete
- app baselines were compared through the canonical weekly-hold engine
- future backtests must follow [BACKTEST_CANONICAL_PROTOCOL.md](C:/Users/User/Documents/GitHub/limni-website/docs/BACKTEST_CANONICAL_PROTOCOL.md)

Canonical comparison snapshot on the exact 10-week closed window:

- `selector_sentiment_context_override`: `+134.29%`, max DD `-4.71%`
- `tiered_v3`: `+137.21%`, max DD `-22.89%`
- `sentiment`: `+129.13%`, max DD `-21.66%`
- `agree_2of3`: `+114.98%`, max DD `-21.30%`
- `dealer`: `+116.64%`, max DD `-40.71%`

Primary interpretation:

- This is the first selector branch that is competitive with the strongest canonical weekly models.
- It does not beat `tiered_v3` on raw return in this window, but its drawdown profile is dramatically better.
- If visual verification matches the research numbers, this is a legitimate flagship candidate.

ADR overlay check on the same closed-week window:

- `selector_sentiment_context_override` weekly hold: `+134.29%`, max DD `-4.71%`
- `selector_sentiment_context_override` + ADR pullback: `+19.78%`, max DD `-10.19%`

Interpretation:

- ADR does not improve this selector.
- It cuts return materially and worsens drawdown.
- For now this model should stay classified as a weekly-hold candidate, independent from the intraday flagship decision.

## Locked Research Logic

Base rule:

- follow `sentiment` by default

Override rule:

- if `sentiment` is stretched and weakening, do not blindly follow it
- allow COT context to override instead

Current implementation details from the research script:

1. Compute current directional scores for:
   - `sentiment`
   - `dealer`
   - `commercial`
2. Compute `sentiment` extremity from its normalized historical range.
3. Compute whether `sentiment` is:
   - strengthening
   - weakening
   - flipped
4. Decision logic:
   - if `sentiment` exists and is not highly stretched, follow `sentiment`
   - if `sentiment` is stretched but still strengthening, still follow `sentiment`
   - if `sentiment` is stretched and weakening, try to override with COT
   - if both `dealer` and `commercial` agree, use their combined direction
   - otherwise use the less-stretched available COT side
   - if no strong signal exists, fall back to:
     - `dealer`
     - `commercial`
     - previous-week return
     - `LONG`

## App Integration Goal

Goal:

- add this as a visual weekly-hold strategy inside the site so it can be inspected week by week, pair by pair

Minimum app integration requirements:

1. Add a new strategy id for this selector.
2. Implement canonical direction resolution inside the weekly-hold engine.
3. Expose the selector in the strategy picker.
4. Ensure Performance and Matrix views can render it week-by-week.
5. Confirm current-week and historical-week boards match the research script.

Verification requirements before promotion:

- same week set as canonical app baselines
- same per-pair directions as the site view
- same total return and max drawdown as the research report
- visual spot-check on key reversal / exhaustion weeks

## Source Artifacts

- [backtest-weekly-bias-context-selector.ts](/C:/Users/User/Documents/GitHub/limni-website/scripts/backtest-weekly-bias-context-selector.ts)
- [compare-weekly-bias-selector-vs-app-baselines.ts](/C:/Users/User/Documents/GitHub/limni-website/scripts/compare-weekly-bias-selector-vs-app-baselines.ts)
- [compare-selector-sentiment-override-weekly-vs-adr.ts](/C:/Users/User/Documents/GitHub/limni-website/scripts/compare-selector-sentiment-override-weekly-vs-adr.ts)
- [weekly-bias-context-selector-latest.json](/C:/Users/User/Documents/GitHub/limni-website/reports/weekly-bias-context/weekly-bias-context-selector-latest.json)
- [weekly-bias-vs-app-baselines-latest.json](/C:/Users/User/Documents/GitHub/limni-website/reports/weekly-bias-context/weekly-bias-vs-app-baselines-latest.json)
- [selector-sentiment-override-weekly-vs-adr-latest.json](/C:/Users/User/Documents/GitHub/limni-website/reports/weekly-bias-context/selector-sentiment-override-weekly-vs-adr-latest.json)
- [WEEKLY_BIAS_CONTEXT_ENGINE_SPEC_2026-03-29.md](/C:/Users/User/Documents/GitHub/limni-website/docs/bots/WEEKLY_BIAS_CONTEXT_ENGINE_SPEC_2026-03-29.md)
