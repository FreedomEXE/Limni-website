# Next Chat Prompt - Gate 98 Katarakti Entry Stack Ablation

Use this prompt to continue in a fresh Codex/Poseidon chat.

```text
You are Codex operating as Poseidon for Freedom in:
C:/Users/User/Documents/GitHub/limni-website

Before answering, recover state in this order:

1. Read C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md.
2. Read C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md.
3. Read AGENTS.md.
4. Read docs/BACKTEST_CANONICAL_PROTOCOL.md.
5. Read docs/research/gates/gate97/GATE97_LIMNI_KATARAKTI_EA_MULTIPAIRS_BASELINE_MANUAL_SMOKE_2026-07-05.md.
6. Read this file.

Use the repo voice script for Limni/Poseidon updates:

automation/voice/notify-response.ps1 -Voice en-GB-RyanNeural -Text "<short update>"

Current objective:

Open Gate 98: katarakti-entry-stack-ablation.

Context:

We are working with automation/mt5/Experts/LimniKataraktiEA.mq5 going forward,
not LimniHedge_V1. Gate 97 converted LimniKataraktiEA into a multipair MT5
Strategy Tester harness and preserved three 2026 YTD manual smoke runs across
all 28 broker FX symbols.

Gate 97 EA work already done:

- Multipair Strategy Tester harness with default FX28 broker symbol preset.
- Aggregate summary and pair-contribution CSV receipts.
- Per-symbol event, basket, and summary CSV receipts.
- Actual-vs-modeled execution receipt fields.
- Terminal markout of unresolved open baskets.
- Same-bar ambiguity counters.
- Semicolon-safe symbol receipts.
- Active-terminal install root:
  C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Experts
- MetaEditor compile evidence existed for repo and active-terminal copies with
  0 errors, 0 warnings before the preserved Gate 97 tests.

Gate 97 preserved artifacts:

- docs/research/gates/gate97/artifacts/manual-smoke-2026-ytd-david-off-tp010-uncapped/
- docs/research/gates/gate97/artifacts/manual-smoke-2026-ytd-david-against-tp010-uncapped/
- docs/research/gates/gate97/artifacts/manual-smoke-2026-ytd-david-with-tp010-uncapped/

All three runs used:

- 28 default broker FX symbols
- M1 Strategy Tester
- KTR_LOOSE
- TP 0.10 ADR
- SL 0.00 ADR
- grid enabled
- grid spacing 0.10 ADR
- MaxBasketEntries 500
- trailing disabled
- ExecutionPriceMode MT5_ORDER_FILL
- David MA 35
- David RSI 1000 / 60 / 40
- Stoch 1000 / 100 / 100, OS/OB 10/90

Gate 97 A/B/C result:

| Run | David | Closed baskets | Closed plus marked ADR | Unresolved open baskets | Worst DD ADR | Worst fill count | Multi-grid same-bar |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | OFF | 658 | 140.921307 | 1 | -45.098982 | 44 terminal / 30 closed | 47 |
| B | AGAINST | 334 | 90.300000 | 0 | -21.161269 | 21 | 16 |
| C | WITH | 325 | 50.921307 | 1 | -45.098982 | 44 terminal / 30 closed | 31 |

Freedom's current interpretation:

- David WITH is a dud for now.
- David OFF is still interesting because it harvested the most, but it left
  unresolved inventory.
- David AGAINST is interesting because it cleaned up the smoke, but we do not
  yet understand why.
- The David RSI 1000/60/40 settings were trial-and-error prototype settings,
  not proven optimal.
- Do not keep tuning David first.

Gate 98 thesis:

Pause and isolate Katarakti. The question is not "which David setting is best?"
The question is whether Katarakti itself has a useful entry event, and whether
stochastic, LRMG, and David improve it or merely throttle it.

Preferred implementation:

Do not create a separate EA unless the existing EA is too tangled. First inspect
LimniKataraktiEA and add a small, auditable switch such as EntryStackPreset or
IsolationMode. It should turn existing entry layers on/off without changing
basket management, grid accounting, execution receipts, or export shape.

Proposed presets:

- K_ONLY
- K_STOCH
- K_LRMG_REVERSAL
- K_LRMG_REVERSAL_STOCH
- K_DAVID_AGAINST
- K_STOCH_DAVID_AGAINST
- K_LRMG_REVERSAL_DAVID_AGAINST
- K_FULL_AGAINST
- K_FULL_WITH as a control only

Initial test ladder:

1. Run K_ONLY for KTR_LOOSE, KTR_BALANCED, and KTR_EXTREME.
2. If one has a useful raw shape, add K_STOCH.
3. Then add K_LRMG_REVERSAL.
4. Then add K_LRMG_REVERSAL_STOCH.
5. Only after that reintroduce David AGAINST.
6. Keep David WITH as a later negative/control comparison, not a primary path.

Important definition:

"Katarakti only" means:

- Katarakti trigger decides entries.
- David disabled as an entry filter.
- Stoch disabled as an entry filter.
- LRMG disabled as an entry filter.
- Same exits/grid/TP/accounting as Gate 97 unless Freedom explicitly changes
  them.

If Katarakti internally depends on the existing non-time-based/LRMG event
mechanics, preserve that mechanical source. Disable LRMG only as a directional
or overextension filter. Do not accidentally break the internal event grammar
while trying to isolate entry filters.

Receipt requirements before any serious run:

- Log raw Katarakti candidate signals even when later blocked.
- Log the active preset and layer booleans in summary receipts.
- Log block reasons separately: blocked_stoch, blocked_lrmg, blocked_david,
  blocked_side, blocked_existing_basket, etc.
- Preserve existing modeled/actual/accounting price receipts.
- Preserve same-bar ambiguity counters.
- Preserve aggregate pair-contribution receipts.
- Add enough fields to explain each entry candidate:
  katarakti_mode, raw side, stochastic value/state, LRMG line or distance state,
  David mode/direction, and final accepted/blocked decision.

Initial recommended run settings after the switch compiles:

- One driver symbol such as AUDCAD.i
- Optimization off
- M1 Strategy Tester
- EnableMultiSymbol true
- SymbolsCsv blank
- UseDefaultFx28Symbols true
- UseTimerPump false unless a missed-bar issue is proven
- FailIfAnySymbolUnavailable true
- PlaceTesterOrders true
- ExecutionPriceMode MT5_ORDER_FILL
- TP 0.10 ADR
- SL 0.00 ADR
- Grid enabled
- Grid spacing 0.10 ADR
- MaxBasketEntries 500 for uncapped shape discovery only
- Trailing disabled for first isolation reads

Stop lines:

- Do not modify automation/mt5/Experts/LimniHedge_V1.mq5.
- Do not touch Gate 95/Type3/LimniHedge runner logic.
- Do not start grid-cap, hold-time cap, lifecycle guard, or adaptive controller
  tests until K_ONLY and the first layer ablations are reviewed.
- Do not optimize David settings.
- Do not treat any MT5 tester result as promotion evidence.
- Do not expand into live/app integration.

Recommended first answer:

Identify as Codex/Poseidon, state Gate 98 objective, confirm the stop lines,
inspect LimniKataraktiEA, then propose the smallest code change for the
EntryStackPreset/IsolationMode. If Freedom says continue, implement it, compile
both repo and active-terminal copies, and give him exact MT5 tester settings.
```

