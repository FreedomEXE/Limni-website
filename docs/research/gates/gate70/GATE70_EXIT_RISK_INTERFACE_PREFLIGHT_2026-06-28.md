# Gate 70: Exit/Risk Interface Preflight

Date: `2026-06-28`

## Gate Result

`PASS_GATE70_EXIT_RISK_INTERFACE_PREFLIGHT__BOUNDARY_FROZEN_NO_DIRECTION_REOPENED`

## Branch / Head

- Branch: `codex/gate50-macro-source-promotion-proof`
- Repo-visible head observed before this canonical Gate 70 packet: `30e3ffa2b5a34314365da3d3d89b73c33eda16db`
- Canonical packet files are additive documentation/contracts only; final branch head is reported in the handoff after commit.

## Dependency Lock

Gate 70 depends on Gate 69 being closed. Candidate B is the locked default unnamed final forced-28 weekly FX direction algorithm.

- Locked Candidate B ledger hash: `5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390`
- Candidate C shadow/canary ledger hash: `DF4170736BC34CF95F616F8888849F018BB33A78EAEACC910E1E4C56B1408720`
- Gate 68 frozen capsule ID: `gate68c_frozen_reference_capsule_C8DC7E99DE640C2D`
- Gate 68 frozen capsule SHA: `C8DC7E99DE640C2DEA0817C0F48F604575D4FB5CCBC9A9C787261FB4E63073A3`

## Active Architecture Language

Use only:

`Brain -> Cells -> Atoms -> unnamed final forced-28 algorithm`

Brain emits the forced-28 weekly directional truth. Cells are COT, Strength, and Regime. BPR and valuation_gap belong inside Regime. Risk is a later portfolio expression layer and must not rewrite Brain truth.

## Gate 70 Objective

Gate 70 freezes the research boundary between:

1. Locked Candidate B weekly forced-28 direction truth.
2. Later exit research.
3. Later risk research.
4. Later MT5/live/app execution.

This gate is a boundary preflight only. It is not an exit optimization gate, risk implementation gate, live/MT5/app/runtime gate, Candidate B retest, Candidate C promotion gate, Alpha v2 promotion gate, new final-algorithm candidate gate, Candidate E gate, or Candidate D retest.

## What Was Verified

- Candidate B forced-28 ledger is the read-only signal-truth input for later exit/risk work.
- Candidate B weekly directions must not be changed, reweighted, excluded, relabeled, or recomputed by exit or risk layers.
- Candidate C remains shadow/canary only and cannot become the default through Gate 70.
- Exit research may manage lifecycle after a Candidate B direction exists.
- Risk research may decide expression, sizing, basket inclusion, correlation limits, delay, skip, reset, or exposure control.
- Neither exits nor risk may mutate the Brain forced-28 direction ledger.
- Weekly signal truth stays separate from tradable expression.
- All 28 signal rows per week remain preserved even if later risk expression skips, delays, or reduces some trades.
- Exit and risk contracts are explicitly documented.
- Gate 71 is scoped but not executed.

## What Was Intentionally Not Done

- No Candidate B retest.
- No Candidate C promotion.
- No source mutation.
- No COT, Strength, Regime, BPR, valuation_gap, or atom-policy change.
- No direction research reopened.
- No new final algorithm candidate.
- No Candidate E.
- No rejected Candidate D retest.
- No exit matrix.
- No risk matrix.
- No exit optimization.
- No risk implementation.
- No portfolio pruning.
- No P&L attribution.
- No hidden pair/date exclusions.
- No outcome leakage.
- No Alpha v2 promotion.
- No MT5/live/app/runtime work.

## Frozen Contract Paths

- Exit research interface contract: `docs/research/gates/gate70/contracts/exit-research-interface.schema.json`
- Risk research interface contract: `docs/research/gates/gate70/contracts/risk-research-interface.schema.json`
- Weekly decision-to-trade bridge: `docs/research/gates/gate70/contracts/weekly-decision-to-trade-bridge.md`
- Forbidden behavior register: `docs/research/gates/gate70/contracts/forbidden-behavior-register.md`
- Packet checksums: `docs/research/gates/gate70/contracts/GATE70_CANONICAL_PACKET_SHA256SUMS.txt`

## Exit Research Interface Summary

Exit input must include at minimum:

- week identifier
- pair
- Candidate B direction
- signal ledger hash
- signal source gate
- entry timestamp candidate
- entry price source
- allowed price/path data identity
- spread/slippage assumptions if present
- exit rule version
- risk prefilter state if any, only as expression metadata and never as signal mutation

Exit output must include at minimum:

- week identifier
- pair
- Candidate B direction
- entry eligibility
- entry timestamp
- entry price
- exit timestamp
- exit price
- exit rule used
- stop rule used
- take-profit rule used
- trailing rule used, if any
- account reset behavior, if any
- re-entry behavior, if any
- result/PnL
- drawdown/adverse excursion if available
- favorable excursion if available
- reason code
- deterministic run ID
- config hash
- input ledger hash
- output ledger hash

## Risk Research Interface Summary

Risk input must include at minimum:

- week identifier
- all 28 Candidate B directions
- candidate tradable rows
- pair
- direction
- signal ledger hash
- exit candidate metadata if applicable
- volatility/ADR/ATR inputs if used
- fair-value/price-location input if used
- correlation/basket exposure inputs if used
- account state assumptions if used

Risk output must include at minimum:

- week identifier
- pair
- Candidate B direction
- expression decision: express / skip / delay / reduce / basket-limit
- size multiplier or risk allocation if applicable
- reason code
- portfolio/basket state
- correlation/exposure state if applicable
- reset state if applicable
- deterministic run ID
- config hash
- input ledger hash
- output ledger hash

## Weekly Decision-To-Trade Bridge

The bridge preserves the full separation between signal truth and expression:

1. Signal row: immutable Candidate B Brain output row. All 28 pair rows per week are preserved.
2. Tradable candidate row: candidate trade lifecycle row derived from a signal row. It references Candidate B direction and ledger hash but does not rewrite either.
3. Expressed trade row: later risk-approved trade expression. It may include size, basket, delay, and execution metadata.
4. Skipped/delayed/reduced risk row: risk expression outcome that explains why a signal row was not fully expressed. This row must preserve the original signal row identity.
5. Closed trade outcome row: realized or simulated lifecycle result after entry/exit management. It must reference the signal row, tradable candidate row, risk expression row if any, deterministic run ID, config hash, and output ledger hash.

## Forbidden Behavior Register

Exit and risk research must not:

- change Candidate B direction
- exclude pair-weeks from signal truth
- silently drop bad weeks
- use future price movement to decide entry eligibility
- use future weekly outcome to choose an exit rule
- use pair-specific curve fitting without a formal versioned gate
- use regime-specific curve fitting without a formal versioned gate
- use data-mined stop/take-profit values without out-of-sample discipline
- allow risk to become a hidden second direction model
- allow exits to become a hidden second signal model
- modify source atoms or Brain rules
- do live/MT5/app work in this gate
- retune Candidate B
- promote Candidate C
- introduce Candidate E
- retest rejected Candidate D

## Initial Exit Research Menu For Gate 71 Only

These are allowed future Gate 71 candidates. They are not run in Gate 70.

1. Weekly hold baseline.
2. ADR Grid baseline using current/legacy behavior, if already available.
3. Fixed stop / fixed take-profit using predeclared ADR or ATR multiples.
4. One-reset-and-stop weekly rule.
5. No re-entry after account reset.
6. Optional re-entry rule only if it can be deterministic and non-leaky.
7. Sunday-open fair-value/price-location eligibility screen, only as risk/expression pruning, not Brain mutation.
8. Global exit rules before pair-specific rules.
9. Pair-specific or regime-aware exits only in later gates after the global baseline is established.

## Gate 71 Recommendation

Recommended next gate:

**Gate 71: Candidate B Exit Baseline Matrix**

Gate 71 should compare simple exit rules against the locked Candidate B ledger without changing directions.

Suggested Gate 71 order:

1. Reproduce current/legacy ADR Grid behavior as baseline, if available.
2. Weekly hold baseline.
3. One-reset-and-stop baseline.
4. Fixed ADR/ATR stop/take-profit matrix with a very small predeclared parameter set.
5. Compare by year, pair, week, drawdown, win/loss profile, tail risk, and stability.
6. No pair-specific optimization in the first pass.
7. No regime-aware exits in the first pass unless only used as reporting slices, not behavior changes.

## Final Allowed Next Step

The only allowed next step is to open **Gate 71: Candidate B Exit Baseline Matrix** explicitly. Gate 71 must consume the locked Candidate B ledger without changing directions and must not perform pair-specific optimization in the first pass.
