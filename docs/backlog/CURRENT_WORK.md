# Current Work

Status: active checklist. Keep this short and update it when gates change.

This is the running repo-visible checklist. Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Workflow

- Use at most three active running surfaces:
  - `CODEX_SESSION.md` for hot recovery and frozen areas.
  - `docs/backlog/CURRENT_WORK.md` for the active checklist.
  - One focused gate/release doc only when the active gate needs durable detail.
- Archive completed or stale notes under `archive/` using mirrored repo paths.
- Do not start coding until the active gate is named.
- For broad issue sets, classify first, then patch one gate at a time.
- Gate labels use a sequence number plus a scope slug. The slug is the real
  boundary; the number is only a recovery handle.

## Active Gate

Gate 55: Friday Strength selected-vs-fade baseline lock.

Status: baseline lock ready for review. Gate 55A legacy selected-vs-fade
diagnostic is closed as blocked by Strength source/coverage. Gate 55E closed
the Frozen Canonical Price Bundle v1 blocker, Gate 55F closed the canonical
Strength source-context blocker, and Gate 55G completed the canonical 1m
Friday Strength selected-vs-fade diagnostic.

Gate 55G lock interpretation:

```text
STRENGTH BASELINE LOCK FOR ADR GRID: Friday Strength selected
```

Required caveat: Friday Strength is execution-sensitive. Selected wins the
canonical 1m ADR Grid diagnostic, while fade wins simple weekly hold. This does
not authorize COT+Strength combination, regime overlays, execution
optimization, risk overlays, live/MT5, or final combined system selection.

Active Gate 55 artifacts:

- Gate 55A receipt:
  `docs/research/GATE55A_LEGACY_FRIDAY_STRENGTH_DIAGNOSTIC_RECEIPT_2026-06-24.md`
- Gate 55B plan:
  `docs/research/GATE55B_STRENGTH_SOURCE_FEATURE_CONTRACT_REBUILD_PLAN_2026-06-24.md`
- Gate 55B source-owner inventory:
  `docs/research/GATE55B_STRENGTH_SOURCE_OWNER_INVENTORY_2026-06-24.md`
- Gate 55B backfill feasibility receipt:
  `docs/research/GATE55B_STRENGTH_BACKFILL_FEASIBILITY_RECEIPT_2026-06-24.md`
- Gate 55B M1 warmup repair plan:
  `docs/research/GATE55B_M1_WARMUP_REPAIR_PLAN_2026-06-24.md`
- Gate 55B local M1 warmup repair receipt:
  `docs/research/GATE55B_LOCAL_M1_WARMUP_REPAIR_RECEIPT_2026-06-24.md`
- Gate 55C holiday/session-aware coverage rule:
  `docs/research/GATE55C_HOLIDAY_SESSION_STRENGTH_COVERAGE_RULE_2026-06-24.md`
- Gate 55D institutional price-truth boundary gap:
  `docs/research/GATE55D_INSTITUTIONAL_PRICE_TRUTH_BOUNDARY_GAP_2026-06-24.md`
- Gate 55E frozen canonical price bundle v1 receipt:
  `docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md`
- Gate 55F canonical Strength source-context proof:
  `docs/research/GATE55F_CANONICAL_STRENGTH_SOURCE_CONTEXT_PROOF_2026-06-25.md`
- Gate 55G canonical Friday Strength selected-vs-fade baseline:
  `docs/research/GATE55G_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_BASELINE_2026-06-25.md`
- Legacy smoke command:
  `npm run verification:gate55-friday-strength-baseline -- --no-doc-copy --out-dir=temp/gate55-strength-baseline-final-smoke`
- Legacy smoke receipt hash:
  `8F2804C7593E9AF14D406BB27C4C46A63B51BEA5870ECEFBFD2E3E791421B6AE`

Gate 55A decision:

```text
Status: BLOCKED_BY_STRENGTH_SOURCE_OR_COVERAGE
Secondary classification: EXECUTION_SENSITIVE_LEGACY_DIAGNOSTIC
```

Gate 55 does not fail Strength as a concept. It fails the current Friday
Strength artifact as an institutional-grade feature contract.

Gate 55A evidence:

- Native Friday Strength rows: `10,292` directional, `124` missing, `0`
  neutral/tie rows.
- Carry policy tested: `carry_previous_friday_strength_side`.
- Carry result: `10,836` rows, `544` carry-filled rows, `28` unresolved rows,
  `387` full weeks, `0` partial weeks.
- Remaining unresolved block: `2019-01-07`, all `28` pair rows. Filling it
  requires approved pre-window Strength warmup/backfill or explicit fallback.
- Source observability gap: deeper Strength tables do not cover the historical
  matrix window. `strength_history_snapshots` begins `2024-12-30`, while
  `currency_strength_snapshots` and `strength_weekly_snapshots` begin
  `2026-01-19`.
- Selected carry: ADR Grid `+1223.1925` ADR, R/DD `2.4064`, PF `1.2677`;
  weekly hold `-143.4070` ADR, PF `0.9283`.
- Fade carry: ADR Grid `+573.7539` ADR, R/DD `0.8484`, PF `1.1115`;
  weekly hold `+143.4070` ADR, PF `1.0772`.

Gate 55B active scope:

- Define Strength raw inputs and availability.
- Define point-in-time rules.
- Define historical backfill/warmup requirements before `2019-01-07`.
- Define immutable source hashes and lineage receipts.
- Define weekly 28-pair completeness rules.
- Define missing, neutral, tie, stale, and fallback policy.
- Define daily, weekly, and monthly Strength horizons.
- Define raw strength values, pair-relative deltas, ranks, z-scores,
  percentile ranks, trend, and acceleration fields.
- Define COT-style Strength buckets: follow-strength, fade-overextension, and
  neutral/no-edge.
- Define pass/fail receipts required before selected-vs-fade testing reopens.

Gate 55B source-owner inventory result:

```text
Status: SOURCE_OWNERS_MAPPED_REBUILD_REQUIRED
Preferred rebuild base: app/src/lib/strength/historicalStrength.ts
Current derivation candidate: fx_m1_currency_strength_v1
No-write estimate smoke passed with --week=2019-01-07 --estimate-only --windows=1h,4h,24h,1w,1m
Seven-year 15m estimate for those five horizons: 6,988,800 currency rows; pair spreads should be computed from the index, not materialized.
```

Gate 55B backfill feasibility result:

```text
Status: BACKFILL_FEASIBILITY_BLOCKED_BY_2018_M1_WARMUP
Local SQLite M1: 2018-12-17, 2018-12-24, and 2018-12-31 are all 0/28 complete; 2019-01-07 is 28/28 complete.
Postgres canonical M1: 2018-12-17, 2018-12-24, and 2018-12-31 are all 0/28 complete; 2019-01-07 is 11 complete, 1 partial, 16 missing.
Existing Strength history: readExisting rows=0 for 2019-01-07; weekly context available=0/28 for both Friday-close and market-open points.
```

Next Gate 55B decision: approve or reject a no-outcome M1 warmup/backfill plan
for `2018-12-17` through `2019-01-07`, including source identity, storage
target, and hash receipts. Do not reopen selected-vs-fade testing until this
source coverage and feature lineage passes.

Gate 55B M1 warmup repair plan:

```text
Status: EXECUTED_LOCAL_M1_WRITE
Recommended target: local SQLite data/canonical-m1/canonical-m1.sqlite
Repair weeks: 2018-12-17, 2018-12-24, 2018-12-31 only
Reason: local SQLite already has 2019-01-07 at 28/28; Postgres is missing the same warmup and is also incomplete for 2019-01-07.
Executed command after Freedom said continue:
npx tsx app/scripts/verification/plan-local-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 --from-chunk=51 --to-chunk=53 --execute --concurrency=2 --write
```

Gate 55B local M1 warmup repair result:

```text
Status: LOCAL_M1_WARMUP_REPAIRED_WITH_MONTHLY_COVERAGE_CAVEAT
Local missing rows fixed: chunks 51..54 now have missing=0.
Post-write local coverage: 2018-12-17 complete=27 partial=1; 2018-12-24 complete=0 partial=28; 2018-12-31 complete=0 partial=28; 2019-01-07 complete=28 partial=0.
Reason for partial: generic helper expects 7,200 calendar minutes per FX week; Christmas/New Year provider bars are lower.
No-write Strength context using LIMNI_M1_WAREHOUSE=sqlite: friday_close available=28/28, long=13, short=15; market_open_confirmation available=28/28, long=20, short=8.
Raw local M1 proof window: 709,380 rows; SHA-256 83C604B68A1A2D6B1228BA09F9AEB87CAD3BE6FC290E90A94658DB093BFC3B36.
Coverage manifest SHA-256: E150099E55D83D7B20D3A7471777B55BBEF3EE5EB18A867F5DB1EF793CB00E65.
```

Gate 55E has closed the canonical M1 price-layer blocker. Gate 55F has closed
the canonical Friday Strength source-context blocker.

Gate 55G result:

```text
Status: PASS_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_READY_FOR_BASELINE_LOCK_REVIEW
Receipt: app/reports/data-verification/gate55/gate55g-friday-strength-selected-vs-fade-20260625T052431Z.json
Receipt hash: 144CE30D67D587D8682958BF55B97F204C6950504A60556C525DED8C7AD8188F
JSON SHA-256: D55EF89A1926FD454225E21A33E238DF7AE15AFEDBFBC0E1857EDF09C50F22B2
Markdown SHA-256: 49FAE2FEA18D0717DA5B3E3F1CA0297DF83ACF2FD1C464C8D1A9EB344D167061
Weeks: 387
Rows: 10,836/10,836 retained; 0 removed; 387/387 full source weeks; 0 missing grid price rows; 0 missing hold price rows.
Selected ADR Grid: +1311.8526 ADR; DD -698.5889; R/DD 1.8779; PF 1.2674; fills 119,147.
Fade ADR Grid: +988.7181 ADR; DD -653.5674; R/DD 1.5128; PF 1.1794; fills 118,460.
Selected weekly hold: -315.1911 ADR; DD -377.0083; R/DD -0.8360; PF 0.8666.
Fade weekly hold: +315.1911 ADR; DD -230.8041; R/DD 1.3656; PF 1.1540.
Read: selected is the ADR Grid Strength baseline lock; fade remains weekly-hold context/sensitivity.
```

Gate 55F result:

```text
Status: PASS_CANONICAL_STRENGTH_SOURCE_CONTEXT_28_28_FULL_HORIZON
Receipt: app/reports/data-verification/gate55/gate55f-strength-source-context-20260625T024725Z.json
Receipt hash: 6A1E553CE7F5F1014F75A545FB0000B6C6238AB22813DF597766BDF14D9F9959
JSON SHA-256: 1CBB0F7A65575ABE89A5322B7A548BD4A7604DBD6FC606959F6384374E6E228F
Markdown SHA-256: 52A88F35A249530C961B0B11C0FF08D3361B432197263EDB4FF929D834D11753
Weeks: 387
Friday close: retained 10,836/10,836; full signal weeks 387/387; full horizon weeks 387/387; missing window lookups 0.
Market-open confirmation: retained 10,836/10,836; full signal weeks 387/387; full horizon weeks 387/387; missing window lookups 0.
```

Gate 55C holiday/session-aware coverage rule:

```text
Status: SUPERSEDED_BY_GATE55E_100_PERCENT_SOURCE_STANDARD
Corrected receipt hash: 3B70BAEADA910E6E2E8DFAB0C1962A30378A993FCA844BC3A1B4D4401332F63C
Reviewed rule: expected coverage uses observed tradable session minutes, not idealized calendar minutes.
Superseded denominator: the old `14/28` quorum rule is not the active standard.
Gate 55E now defines an active FX minute as any canonical OANDA provider-minute
inside the approved New York 5pm FX session window; all 28 pairs must have a
canonical row for every active minute.
Correction: the current code's 90% threshold is not accepted as final institutional governance.
Freedom requires 100% M1 source quality for institutional evidence unless a separate explicit waiver is approved.
Prior 99% proof on repaired local warehouse already failed: 2018-12-17 pass/fail 17/11, 2018-12-24 9/19, 2018-12-31 13/15, 2019-01-07 15/13, Friday monthly lookback 12/16, market-open monthly lookback 14/14.
The later Gate 55E canonical Postgres repair resolved the pair-minute gaps for
the frozen FX M1 bundle.
Selected-vs-fade testing is authorized only after Strength source context is
rebuilt/regenerated from the frozen Gate 55E bundle.
```

Next Gate 55 step: run canonical Friday Strength selected-vs-fade under ADR
Grid and simple weekly hold using the Gate 55E price bundle and Gate 55F
source-context rule. Do not use the legacy Gate 44 source-context rows as final
evidence.

Gate 55D institutional price-truth boundary gap:

```text
Status: HIGH_SEVERITY_PRICE_TRUTH_BOUNDARY_GAP_ACKNOWLEDGED
Classification: architectural evidence-boundary gap.
Core issue: COT outcomes, Strength staging, ADR Grid, weekly hold, path bars, pair-period returns, and future MT5 parity are not yet bound by one frozen price_bundle_id.
Gate 54 preserved with caveats: it locked the COT raw Signal Model candidate baseline under the then-current outcome price layer, not permanent COT performance across future price-bundle rebuilds.
Gate 55 expanded: Strength cannot be judged institutionally until source construction is valid and Strength/COT outcomes are evaluated against the same audited price truth.
Allowed now: local staging audits, M1 gap audit, price_bundle_id proposal, canonical price bundle contract, restatement rules.
Not allowed: institutional COT-vs-Strength comparison, COT+Strength combination, final selected-vs-fade claim, execution/risk/live/system selection.
```

Gate 55E Frozen Canonical Price Bundle v1:

```text
Status: PASS_CANONICAL_FX_M1_100_PERCENT
Frozen bundle label: gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953
Architecture decision: do not build a new backtest engine or warehouse.
Canonical bars: canonical_price_bars is the shared bar source.
Canonical M1 rule: institutional M1 coverage is 100% of expected tradable session bars unless Freedom explicitly approves a named waiver.
Fast artifacts: pair_period_returns, ADR maps, path bars, Weekly Hold outcomes, Strength snapshots, regime joins, execution logs, risk overlays, and future MT5 parity receipts must trace to the same price_bundle_id.
Local SQLite: staging/import repair only, not final institutional evidence unless promoted into canonical_price_bars and included in the bundle hash.
Receipt rule: any price-derived institutional result without price_bundle_id is diagnostic-only / not promotion-eligible.
Smoke result: existing canonical FX 1h bars can repair weekly outcome rows without changing the backtest engine; four smoke weeks now have 28/28 canonical and 28/28 execution FX weekly pair_period_returns.
Canonical M1 warmup promotion: four early FX weeks were promoted from local OANDA staging into canonical_price_bars with provider rows preserved and no-tick session gaps filled as derived_no_tick_forward_fill_v1.
Canonical M1 coverage smoke: npm run performance:backfill-hourly -- --coverage-only --asset=fx --timeframe=1m --weeks=2018-12-17T00:00:00.000Z,2018-12-24T00:00:00.000Z,2018-12-31T00:00:00.000Z,2019-01-07T00:00:00.000Z -> complete=112, partial=0, missing=0, lowest=100.00%.
Strength source-contract smoke after session-aware denominator plus warmup guard: 2018-12-17 Friday close 0/28 and market open 28/28 with warmup-limited windows; 2018-12-24 and 2018-12-31 both 28/28 but 4/5-window warmup-limited; 2019-01-07 is the first clean full-horizon week with Friday close 28/28, market-open 28/28, and displayed pairs at 5/5 windows.
Code locks: Strength M1 pair-window default is 100%; canonical 1m coverage status requires 100%; local staging coverage status also requires 100%; Strength window coverage now uses canonical session minutes plus a warmup guard so early missing history cannot pass as complete.
Final full audit: 391 weeks, 10,948/10,948 complete pair-weeks, 0 partial pair-weeks, 0 source-gap weeks, 78,149,792/78,149,792 active pair-minute rows, lowest coverage 100.000000%.
Final receipt: app/reports/data-verification/gate55/gate55e-canonical-fx-m1-bundle-20260624T232148Z.json
Final JSON SHA-256: 8E37E953D0748406EE04A0FFF64ACEA778B672ACCF681DEB4B9C7C0BCB0F128F
Final Gate 55E receipt: docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md
```

Any Strength selected-vs-fade diagnostic after this point must declare the Gate
55E bundle label above or a later frozen successor bundle. Local-only Strength
diagnostics remain staging evidence unless promoted through canonical lineage.

Gate 55B hard locks: no choosing best horizon by PnL, no threshold
optimization, no pair filtering, no COT+Strength combination, no regime
overlay, no BPR/RRP retests, no PPP/NEER/REER work, no execution optimization,
no risk overlay, no MT5/live/bot work, no production/live claims, and no final
Signal Model selection.

Gate 54 accepted signal baseline remains frozen for later context only:
CLP carry-forward + carry-previous tie fill. Gate 54 is not reopened by Gate
55 unless Gate 55 finds a reproducibility defect that directly contradicts the
accepted COT signal baseline. Gate 54 performance numbers are bound to the
then-current outcome price layer and may need restatement under a future
audited price bundle.

Gate 54H: clp-tie-break-comparison.

Status: accepted as working tie policy. Receipt:
`docs/research/GATE54H_CLP_TIE_BREAK_COMPARISON_2026-06-23.md`.
Result: `PASS_CLP_TIE_BREAK_COMPARISON_READY_FOR_REVIEW`. Receipt hash:
`8E2FCBB05C62948FECD6F518446518611574C5B54C76EC766CDD37366B63DE37`.

Gate 54H asks:

```text
For the 71 tied CLP pair rows across 60 weeks, does carry-previous CLP side or
raw underlying COT spread perform better as the deterministic tie-break policy?
```

Gate 54H outputs:

- Ties are source-complete, not missing-data rows: `71` tied pair rows across
  `60` weeks, with `0` missing lifecycle pair rows.
- Both policies resolve all `71` tied rows. They agree on `34` rows and
  disagree on `37` rows.
- Tie-only simple weekly hold favors raw underlying COT spread:
  raw `+0.98` ADR vs carry-previous `-7.67` ADR, delta
  carry-minus-raw `-8.6506` ADR.
- Tie-only ADR Grid scoring favors carry-previous CLP side:
  carry `+38.53` ADR vs raw `+19.59` ADR, delta carry-minus-raw
  `+18.9421` ADR.
- Full-system context after tie fill:
  carry-previous `10,864` rows, simple hold `+339.41` ADR, ADR Grid
  `+1176.45` ADR; raw-spread `10,864` rows, simple hold `+348.06` ADR,
  ADR Grid `+1157.51` ADR.
- Institutional read: mixed result. Because ADR Grid remains the legacy matrix
  scoring path and weekly hold is context, carry-previous is the cleaner
  temporary tie-fill policy for the existing matrix; raw-spread remains a
  caveat to review before final Signal Model selection.

Frozen for Gate 54H: no final Signal Model selection, no optimization beyond
this deterministic tie-break comparison, no outcome grid expansion, no BPR/RRP
retests, no source refetch/rebuild, no PPP/NEER/REER work, no execution,
risk-overlay, MT5/live, production, or promotion claim.

Next authorized work: raw-number review of Gate 54F/G/H outputs, then decide
whether to run the separate Friday Strength fade diagnostic.

Gate 54G: cot-warmup-carry-forward.

Status: completed for review. Receipt:
`docs/research/GATE54G_COT_WARMUP_CARRY_FORWARD_PROOF_2026-06-23.md`.
Result: `PASS_COT_WARMUP_CARRY_FORWARD_READY_FOR_REVIEW`. Receipt hash:
`559855706524CE23EB6B55814FE24015857CC00DFBDB689CF286C9402C276058`.

Gate 54G asks:

```text
Can CLP use 2016 warmup history and live-style no-lookahead COT carry-forward
so missing or late COT reports do not create false no-trade weeks or lookahead
bias?
```

Gate 54G outputs:

- COT warmup backfill completed before the proof with FX-only missing-date
  scope: `157` missing COT report dates inserted, stored FX COT report dates
  now `546`, range `2016-01-05 -> 2026-06-16`, failures `0`.
- CLP lifecycle now has `156` report lookback, first lifecycle report date
  `2018-12-24`, and `0` missing metric windows.
- No-lookahead carry-forward policy: exact COT report date when available;
  holiday-adjusted report date when exact date is shifted; otherwise latest
  prior report date. Known 2025 lapse/catch-up rows are not allowed into
  earlier weeks by report date alone.
- Carry-forward coverage across `388` expected weeks: `10,793` selected rows,
  `328` full `28/28` weeks, `60` partial weeks, `0` no-signal weeks, `71` tie
  rows, and `0` missing lifecycle pair rows.
- Non-exact COT weeks: `3` holiday-adjusted weeks and `13` 2025 lapse weeks.
  The 2025 lapse weeks carry forward `2025-09-23` with ages from `7` to `91`
  days, avoiding lookahead from later catch-up rows.
- Simple weekly-hold context under carry-forward CLP: `+347.0824` ADR, max DD
  `-149.0153`, R/DD `2.3292`, profit factor `1.1887`, with `308` missing
  price rows.

Related Gate 54F receipt was regenerated after warmup:
`docs/research/GATE54F_STANDALONE_SIGNAL_BASELINES_AND_SOURCE_AVAILABILITY_2026-06-23.md`,
result `PASS_BASELINE_CONTEXT_READY_FOR_REVIEW`, receipt hash
`4D79E80013628EA7CB95FC9AA8E3409DCE195ED57480C0E9C04134AA11953FDE`.
Warmup rows are now `0`. CLP-only exact/matrix-gated diagnostic is now
`10,262` rows, `310` full weeks, ADR Grid `+1246.4123` ADR / max DD
`-372.4695` / R/DD `3.3463`, simple weekly hold `+350.0062` ADR / max DD
`-149.0153` / R/DD `2.3488`.

Frozen for Gate 54G: no final Signal Model selection, no optimization, no
outcome grid expansion, no BPR/RRP retest, no source refetch/rebuild beyond the
already completed FX COT warmup insert, no PPP/NEER/REER work, no live,
production, promotion, MT5 bot, or portfolio/risk-overlay work.

Superseded next step: Gate 54H tie-break comparison is now complete. Use the
Gate 54H block above as the active next-step pointer.

External Value Regime parking lot for later source-governance gates:

- PPP deviation / fair-value gap.
- NEER trend / deviation.
- REER trend / deviation.

### Superseded Historical Gate 51 Notes

Gate 51: rrp-regime-filter-research-suite.

Status: active at Gate 51B COT-lifecycle/RRP interaction stage. Gate 51 tests promoted
RRP as a diagnostic-only regime filter against the frozen Gate 44 seven-year
matrix. It must not claim the full COT/Strength/ADR Grid stack is
institutionally source-governed. Current boundary receipt:
`app/reports/data-verification/macro-regime/gate51-evidence-boundary-manifest-20260623.{json,md}`.
Allowed claim: promoted RRP appears useful or not useful against the frozen
legacy matrix. Forbidden claims: live, ACTIVE, production-ready, portfolio-ready,
full-stack source-promoted, BPR/PPP/NEER/REER tested, or combined macro-regime
validated.

Frozen for Gate 51: no Gate 50 source refetch/rebuild, no CPI/rate/RRP source
contract changes, no lifecycle/promotion-control edits, no release-canon edits,
no live execution, no production P&L path, no BPR/PPP/NEER/REER/valuation
combination, and no Gate 52 work.

Gate 51A first diagnostic run completed with
`npm run verification:gate51-rrp-regime-filter -- --mode=full --thresholds=0,0.25,0.5,1 --top=20`.
Receipt:
`app/reports/data-verification/macro-regime/gate51-rrp-regime-filter-diagnostic-full-20260623T164940.{json,md}`;
receipt hash `8b266ac9d883e06f8d26a6164abe9b70166f700e68f2e51c4d9804a535cb8f96`.
The run attributed all `183,879` selected pair decisions across `35` variants,
`372` weeks, and `2,976` promoted RRP currency rows. Blockers: `0` missing
week results and `0` missing RRP rows; warning: `283` selected rows had no
stored pair contribution and were zero-filled. First read: RRP is not a broad
return enhancer when simply blocking fades. It shows narrower diagnostic value
around Dealer/Commercial plus Strength agreement, especially
`dealer_commercial_agreement_open_friday_strength_agree` at `1.00` RRP
percentage-point threshold, where confirm/fade spread was `+0.3761` ADR per
pair and block-fade delta was `+88.49` ADR. Treat this as diagnostic-only
against the frozen legacy matrix, not a production filter.

Gate 51A fixed-candidate validation addendum completed with
`npm run verification:gate51-rrp-regime-filter -- --mode=full --variant-ids=dealer_commercial_agreement_open_friday_strength_agree --thresholds=1 --validation-addendum --candidate-threshold=1 --top=20`.
Receipt:
`app/reports/data-verification/macro-regime/gate51-rrp-candidate-validation-addendum-full-20260623T170954.{json,md}`;
receipt hash `41a077af97b27d4c4050161107c125b65064c05ac209de8f5755bd34059072f2`.
File SHA-256: JSON
`28679ae721039d6cafd9e74c6e9d10d45e858059949b344ffc18f37617746183`,
Markdown
`c3c7b7fe93fcd4c52979e1e12c000320c455f804b83e0131553b3d37233488da`.
All reported outcomes are ADR-normalized, not raw returns. For the fixed
`dealer_commercial_agreement_open_friday_strength_agree` candidate at `1.00`
RRP threshold, no-RRP baseline was `+125.75` ADR, max DD `-195.65`, R/DD
`0.64`, path Sharpe `0.24`, profit factor `1.20`; block-fade was `+214.24`
ADR, max DD `-152.64`, R/DD `1.40`, path Sharpe `0.60`, profit factor `1.65`.
Fade-only was `-88.49` ADR with path Sharpe `-0.26` and profit factor `0.74`.
Weak-only carried most of the positive result (`+200.55` ADR, R/DD `2.60`,
path Sharpe `0.99`, profit factor `2.09`), while confirm-only was weak
(`+13.69` ADR, R/DD `0.15`, path Sharpe `0.07`). Zero-fill sensitivity is
immaterial for the candidate: `4` total zero-filled rows, and a `-1` ADR per
zero-fill stress still leaves block-fade at `+211.24` ADR. Institutional read:
useful diagnostic evidence for fade suppression, not a confirmed regime model;
next validation should freeze this candidate and test out-of-sample/year
stability and placebo controls before any promotion discussion.

Gate 51A cross-variant fixed-threshold comparison completed with
`npm run verification:gate51-rrp-regime-filter -- --mode=full --thresholds=1 --top=50`.
Receipt:
`app/reports/data-verification/macro-regime/gate51-rrp-regime-filter-diagnostic-full-20260623T171820.{json,md}`;
receipt hash `32bd32224ec15b11eb8075c919f6a007bd44fc72c4bc2cf4f5941a42b45cd22d`.
File SHA-256: JSON
`5c663bec2498af9081d7f7dbd1faa8ecfed9aff984d4a2efc27c4892c9aa7150`,
Markdown
`a41304d006635c06e12f49edfa2b2d3bef859f5cf4ce25391f31f41c0ca0a381`.
This is not a new threshold search; it applies the fixed `1.00` RRP threshold
across all `35` existing Gate 44 variants. Cross-variant read: COT Faces
variants are usually stronger raw baselines than the Dealer/Commercial
candidate, but the simple RRP block-fade overlay usually reduces their total
ADR. Examples: `cot_faces_v1_forced_selected` fell from `+1068.88` to
`+511.06` ADR; `cot_faces_v1_commercial_delta_contrarian_selected` fell from
`+1174.87` to `+599.56` ADR. The best COT Faces pocket after block-fade was
`cot_faces_v1_forced_strength_friday_snapshot_disagree_strength`, which moved
from `+744.11` to `+682.63` ADR, while R/DD improved from `1.80` to `2.82`,
path Sharpe from `0.67` to `0.78`, and profit factor from `1.30` to `1.35`.
So RRP is not a broad overlay for the more complex COT algorithms; at best it
may act as a risk-quality filter in specific already-strong COT/Strength
disagreement pockets.

Gate 51B COT-lifecycle/RRP interaction diagnostic completed after repairing a
CLI parser issue where omitted non-negative numeric flags were read as `0`
instead of using documented defaults. Valid noncommercial receipt:
`app/reports/data-verification/macro-regime/gate51-cot-lifecycle-rrp-interaction-noncomm_net-20260623T174919.{json,md}`;
receipt hash `8db1238b61bd010c71373eb6d24aa2f4755c7c33dfb0625bd5bc0f64f5014ed2`.
Leveraged-money sensitivity receipt:
`app/reports/data-verification/macro-regime/gate51-cot-lifecycle-rrp-interaction-lev_money_net-20260623T175256.{json,md}`;
receipt hash `8faabd31cd73da1e8bc9bedc2e531dd1f09b451df4517d06f09610ddfacb5eb5`.
Both receipts are ADR-normalized diagnostics against frozen Gate 44 decisions
and promoted Gate 50 RRP. They do not rerun ADR Grid execution, refetch COT/RRP,
touch lifecycle controls, or make live/production/promotion claims.

Gate 51B institutional read: COT lifecycle polarity is the stronger COT
research baseline candidate; RRP is useful as a cross-check inside that
lifecycle frame, especially when the selected side goes with a crowded COT
extreme and RRP also confirms that side. For
`cot_faces_v1_commercial_delta_contrarian_selected` using `noncomm_net`, the
overall post-warmup baseline was `+1025.78` ADR, R/DD `1.59`, path Sharpe
`0.64`, profit factor `1.41`. Lifecycle `fade_lean` was strong at `+326.88`
ADR, `+0.4793` ADR/pair; lifecycle `with_extreme` was bad at `-215.41` ADR,
`-0.6119` ADR/pair. Inside `with_extreme`, RRP-confirm was the worst pocket:
`120` rows, `-154.83` ADR, `-1.2902` ADR/pair, R/DD `-0.89`, path Sharpe
`-0.39`, profit factor `0.38`. Inside `with_lean`, RRP-confirm was also
negative (`-134.19` ADR), while weak RRP carried the positive result
(`+416.61` ADR, R/DD `7.66`, path Sharpe `1.62`, profit factor `2.55`).
The leveraged-money sensitivity broadly confirms the same warning: selected
sides that go with the lifecycle lean and are RRP-confirmed are negative,
while `fade_lean` plus RRP-confirm is strong. Caveat: the Gate 51B script is
formula-compatible with Gate 46, but its bucket counts do not exactly reproduce
the prior Gate 46 published counts; treat COT lifecycle as a locked research
baseline candidate only, not a promoted source algorithm, until a later COT
source-governance/promotion gate audits and locks it.

Gate 51C selector-candidate lockdown completed with
`npm run verification:gate51-selector-lockdown`. Binding receipt:
`app/reports/data-verification/macro-regime/gate51-selector-candidate-lockdown-20260623T182917.{json,md}`;
receipt hash `bd438c8d003ca01193943d4c05dc68b1dc8c44c553e96be04e0a9d43d4ec9418`.
This receipt is ADR-normalized and uses cached Gate 44/Gate 51 evidence only:
no source refetch/rebuild, no ADR execution rerun, no live path, and no
production/promotion claim. It pins Gate 44 matrix identity, Gate 50 RRP
dataset identity, `sourceContentInvariantHash`
`fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391`,
and final ACTIVE join hash
`08723c62e089eddab7cde243a64283c9dd6bc0ebee01a070cfb32e4cb27fdbc7`.

Locked selector candidates for the remainder of Gate 51:

- COT research candidate:
  `COT Lifecycle Polarity (CLP)`, id
  `cot_lifecycle_polarity_v0_noncomm_primary`. This means COT lifecycle
  polarity is the only COT candidate to pair with RRP for now. The legacy
  `cot_faces_v1_commercial_delta_contrarian_selected` variant remains only the
  frozen Gate 44 directional harness until a pure lifecycle runner exists.
  `cot_faces_v1_forced` and `dealer_commercial_agreement` are benchmarks only,
  not active COT candidates.
- Strength research candidate:
  `Strength Fade Accord (SFA)`, id
  `strength_friday_snapshot_open_canonical_fade_agree`. Full-window metrics:
  `4,618` rows, `+698.41` ADR, max DD `-208.98`, R/DD `3.34`, path Sharpe
  `0.67`, profit factor `1.30`, active-week win rate `0.71`, worst year
  `2020` at `-20.51` ADR. This beat `strength_friday_snapshot_selected`
  on risk quality (`+1223.29` ADR, DD `-519.96`, R/DD `2.35`, Sharpe `0.61`,
  PF `1.27`) and beat the derived same-direction Friday+open agreement
  (`+439.35` ADR, DD `-377.91`, R/DD `1.16`, Sharpe `0.34`, PF `1.17`).
  `strength_open_canonical_selected` is rejected for now (`R/DD 0.94`,
  Sharpe `0.33`, DD `-815.21`).
- Retained simple Strength anchor:
  `Friday Strength Anchor (FSA)`, id `strength_friday_snapshot_selected`.
  Keep this as the broad/simple Strength benchmark and future review candidate
  because the logic is easier to defend than Sunday/Monday open-fade behavior.
  It is not a second optimization branch during Gate 51, and no promotion claim
  is made. Its full-window metrics are `10,292` rows, `+1223.29` ADR, DD
  `-519.96`, R/DD `2.35`, path Sharpe `0.61`, profit factor `1.27`, active
  win rate `0.67`, and worst year `2024` at `-211.67` ADR.

Gate 51C freeze: do not expand COT Faces, Dealer/Commercial, Strength open-only,
or new Strength composites during Gate 51 unless this selector-lockdown gate is
explicitly reopened. Next RRP work should pair only
`cot_lifecycle_polarity_v0_noncomm_primary` and
`strength_friday_snapshot_open_canonical_fade_agree`, with
`strength_friday_snapshot_selected` retained as a simple benchmark/anchor,
before any BPR/PPP/NEER/REER/valuation or combined-regime gate.

### Locked Previous Gate

Gate 50: macro-source-promotion-proof.

Status: complete/locked. Historical Gate 50 notes are retained below as source
evidence only; do not reopen them unless repo evidence contradicts the lock.

Latest state as of 2026-06-23 boundary repair: the prior boundary proof blocker
is repaired in SEALED diagnostic mode. Repaired parent datasets are rate v6
`dcdc850a-80a2-4178-8d08-dd759be6afb8`
(`3db4b84238dbf5c656a9ebaf2ff73219cc1efd2a6e1ff70842983945c4d23612`) and
CPI v7 `37b4081b-880e-4ae6-8d53-20ba900dff07`
(`0817b0ec5b4c03c2d01ddc5c014601a2b7028c78203d07f95b3393235c70cc17`).
Rebuilt RRP v8 is `220fd5fd-d017-4db2-bdde-524a3c664c72`
(`5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742`).
New SEALED diagnostic join is `10,416/10,416`, `PASS_DIAGNOSTIC`, with
`resolvedContentJoinMapHash`
`fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391`.
Boundary proof now passes `16/16` with receipt
`app/reports/data-verification/macro-regime/gate50-boundary-proof-boundary-repaired-20260623.{json,md}`;
receipt hash `c6abb67d1ddbf49248897cac8212afbd809a8a834a9ee81afa907008844cb7e1`.
ALFRED repair evidence: `31` original same-date date-only anomaly rows, `0`
same-freeze selections after repair, `31` first-later-freeze admissions, `0`
missing, `0` stale. AUD transition evidence: `23` post-transition monthly rows,
`0` quarterly rows after monthly eligibility, `0` interpolation/overlap, and no
monthly backfill eligibility before the ABS 2025-11-26 11:30 AEDT release.
Parent proof is `PASS_PARENT_APPROVED_NOT_ACTIVE` in
`gate50-parent-promotion-proof-boundary-repaired-20260623.{json,md}` with root
RRP promotion manifest
`6656b5da3d5552811b3f0f7c10b14d4af1dfbe191fb508231967a9e54d98414c`.
Warehouse canonical rebuild is `PASS` in
`gate50-warehouse-canonical-rebuild-proof-boundary-repaired-20260623.{json,md}`.
Raw artifact parser replay first failed closed as
`FAIL_RAW_ARTIFACT_PAYLOAD_INCOMPLETE` in
`app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-20260623.{json,md}`:
the current CPI parent had one CHF Swiss FSO LIK25B25 XLSX source artifact with
hash/size lineage but no archived workbook bytes. Exact bytes were recovered
from an existing local temp cache, verified against SHA-256
`4e6ee83f40ab85db7f3e44ff7ab0c2f136945df1242daecf898afa4cc6949cda` and size
`5561298`, and archived immutably in
`research_macro_source_artifact_byte_archives` without mutating the original
artifact record. Repair receipt:
`app/reports/data-verification/macro-regime/gate50-artifact-byte-archive-repair-20260623.{json,md}`;
status `PASS_ARTIFACT_BYTE_ARCHIVE_REPAIR`, `networkUsedForRecovery=false`,
`originalArtifactRecordMutated=false`. Post-repair completeness preflight:
`app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-after-byte-archive-20260623.{json,md}`;
status `READY_RAW_ARTIFACT_PARSER_REPLAY`, raw artifact archive completeness
`PASS`, `networkAccessUsed=false`, stored normalized rows, availability events,
weekly snapshots, and derived rows were not used as replay inputs. Full offline
parser replay and fail-closed negative tests now pass in
`app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-full-20260623.{json,md}`;
status `PASS_RAW_ARTIFACT_PARSER_REPLAY`, parser replay `PASS`, negative tests
`PASS` (`13/13`), `overallPromotionRebuildStatus=RAW_REPLAY_AND_NEGATIVE_TESTS_PASS`,
RRP weekly rows `2,976`, stale `0`, missing `0`, joinable pair-weeks
`10,416`, and `resolvedContentJoinMapHash`
`fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391`.
Lifecycle uniqueness now passes in
`app/reports/data-verification/macro-regime/gate50-lifecycle-uniqueness-20260623.{json,md}`;
status `PASS_LIFECYCLE_UNIQUENESS`, transition proof `PASS`, DB ACTIVE
uniqueness proof `PASS`, application guard proof `PASS`, duplicate activation
attempts `PASS`, `activationPersisted=false`, `historicalActivationCreated=false`,
manifest counts `372` SEALED / `0` ACTIVE / `0` revoked, transient disposable
ACTIVE commit `true`, duplicate rejected by DB code `23505`, disposable ACTIVE
rows cleaned up `true`, `candidateRowsPersisted=0`, and
`resolvedContentJoinMapHash`
`fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391`
unchanged. The lifecycle uniqueness key is now explicitly
`promotion_manifest_id`, `feature_bundle_manifest_id`, `macro_week_id`,
`freeze_version`, and `activation_scope`.
Revocation/quarantine/supersession proof now passes in
`app/reports/data-verification/macro-regime/gate50-revocation-supersession-20260623.{json,md}`;
status `PASS_REVOCATION_SUPERSESSION`, aggregate revoked blocks `28/28`
pair-week contexts for the selected week, aggregate quarantined blocks `28/28`,
required USD currency revocation blocks `7/7` affected pair contexts, prior
PASS receipt invalidation `true`, supersession identity proof `PASS`,
reactivation guard proof `PASS`, content hash invariant `PASS`, and
`resolvedContentJoinMapHash`
`fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391`
unchanged. Historical activation now passes in
`app/reports/data-verification/macro-regime/gate50-historical-activation-20260623.{json,md}`;
status `PASS_HISTORICAL_ACTIVATION`, active aggregate manifests `372`,
duplicate active keys `0`, activation scope `historical_backtest`, feature
bundle `real_rate_pressure_attribution_v1`, historical activation claim
`false`, content hash invariant `PASS`, post-activation duplicate probe rejected
by DB code `23505`, and `resolvedContentJoinMapHash` unchanged. Zero-P&L
exact pinned-read proof now passes in
`app/reports/data-verification/macro-regime/gate50-zero-pnl-pinned-read-20260623.{json,md}`;
status `PASS_ZERO_PNL_PINNED_READ`, active manifests read `372`, execution-read
receipts written `372`, negative read guard proof `PASS`, effective-time proof
`PASS`, `noPnlComputed=true`, and `noStrategyDecisionComputed=true`. Final
ACTIVE join now passes in
`app/reports/data-verification/macro-regime/gate50-rrp-active-join-20260623.{json,md}`;
`joinReceiptStatus=PASS`, `diagnosticOnly=false`, `promotionEligible=true`,
`joinablePairWeeks=10,416`, `blockedPairWeeks=0`, `snapshotState=ACTIVE`, and
`resolvedContentJoinMapHash`
`fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391`
unchanged. Outcome logic remains closed until Gate 51 is formally defined.
Next step is read-only Gate 50 repo verification and lock.

Gate 50 revised direction confirmed by external review on 2026-06-22: keep the
gate number and source-only scope, keep the `50A`-`50E` implementation
workstreams, but amend the governing data model to a two-axis macro contract
matrix. Rows are currency/economic-area macro bundles; columns are source
families with shared semantics and validation. Neither axis replaces the other.
The source-proof workstreams remain: `50A` BPR source proof, `50B` rate source
proof, `50C` CPI source proof, `50D` derived real-rate-pressure proof, and
`50E` aggregate composition and join proof.

The target hierarchy is: atomic source contracts -> family validation manifests
-> currency macro bundle manifests -> feature bundle manifest -> weekly currency
snapshots -> aggregate weekly manifest -> pair-week join. Atomic contracts are
the smallest independently versioned units, such as one exact CPI, rate, BPR,
PPP, NEER, or REER statistic for one currency/economic area through one
endpoint. Family manifests enforce cross-currency comparability, such as
`cpi_all_items_family_v1`, `rate_3m_market_family_v1`,
`bpr_bank_participation_family_v1`, `ppp_family_v1`,
`neer_broad_family_v1`, and `reer_broad_family_v1`. Currency macro bundle
manifests reference the selected promoted contracts for a currency or economic
area; they do not duplicate raw artifacts.

The CPI pivot is a family-column repair, not the top-level architecture. CPI
should move toward official direct producer contracts if an eight-currency
feasibility audit proves coverage, release timing, revision/rebasing behavior,
stable retrieval, and future live viability: `AUD` ABS, `CAD` Statistics
Canada, `CHF` Swiss FSO, `EUR` Eurostat, `GBP` ONS, `JPY` Statistics
Bureau/e-Stat, `NZD` Stats NZ, and `USD` BLS. FRED/ALFRED can remain CPI
shadow validation and migration evidence, but not promoted CPI truth if
official source contracts pass. The common CPI layer must normalize into one
observation schema while preserving country lineage: currency, observation
period, index level, unit, native frequency, seasonal adjustment,
availability/vintage evidence, source contract id, artifact id, parser version,
release-calendar version, staleness version, and continuity decision.

Native frequency remains intact: monthly stays monthly, quarterly stays
quarterly, weekly snapshots carry the newest still-valid official observation,
CPI YoY uses `t/t-12 - 1` for monthly and `t/t-4 - 1` for quarterly, and there
is no fake monthly interpolation. Do not splice FRED history to
national-source tails; prefer one official source contract per currency for the
entire feature version, with explicit versioned continuity decisions for base
transitions such as Japan 2015/2020/2025 or Australia's quarterly/monthly
headline transition.

BPR, OECD, and BIS are logical bundle components, not per-currency downloads.
CFTC may publish one BPR report containing many currencies; Limni should archive
the artifact once, parse currency-specific BPR observations, and let each
currency bundle reference its own observation. The same principle applies to
OECD PPP and BIS NEER/REER: one institutional artifact or response can produce
multiple currency observations. BPR remains a currency-specific source-family
observation from global CFTC reports. PPP remains an independent harmonized
valuation family candidate, likely OECD. NEER and REER remain independent BIS
competitiveness families unless a future gate changes the economic objective.
Avoid one generic `valuation` dependency because PPP, NEER, and REER are not
interchangeable.

Rates must not be swept into the CPI pivot automatically. The canonical rate
family should be named exactly, such as `3m_market_rate` or `3m_interbank_rate`;
policy, overnight, and government-yield rows remain separate shadow families
unless a future feature version explicitly changes the economic instrument.
Direct official or benchmark-administrator rate sources require a separate
feasibility and instrument-equivalence audit before replacement. Real-rate
pressure is a derived family, not an external source family; it is computed
inside Limni from the promoted 3m nominal-rate parent, current CPI parent, and
lag CPI parent, while retaining complete parent lineage.

New source identities to formalize before implementation:
`currency_macro_bundle_id`, `currency_macro_bundle_hash`, `economic_area_id`,
`required_currency_set_hash`, `family_manifest_id`, `family_manifest_hash`,
`feature_bundle_manifest_id`, `required_dependency_set_hash`,
`root_macro_promotion_manifest_id`, and `root_macro_promotion_manifest_hash`.
The root promotion manifest must bind required currencies, selected currency
bundles, relevant family manifests, feature bundle, source map, availability and
staleness rules, calendar version, selector version, and reconstruction/build
versions. A ninth currency should require registering atomic contracts,
validating them under family manifests, creating its currency macro bundle,
updating the required-currency set and root manifest, then rerunning downstream
source proof without changing the shared schema.

Gate 50E must prove both axes before activation: every required family passes
across the required currencies, and every required currency/economic-area bundle
contains exact promotion-approved dependencies with complete lineage, valid
promotion states, deterministic bundle hashes, and no revoked or stale required
rows. Feature-bundle requirements stay independent. For example,
`real_rate_pressure_attribution_v1` requires only its frozen rate, current CPI,
lag CPI, and derived real-rate-pressure dependencies; it must not block because
PPP, NEER, REER, or unrelated BPR rows are unavailable when they are outside the
feature bundle.

Immediate pre-build order: (1) rate/ALFRED differential reconstruction
diagnosis for currently stale three-month-rate rows, (2) bounded official CPI
feasibility audit across the eight required currencies/economic areas, (3) if
CPI passes, define the new official CPI source map and rebuild a new macro
dataset rather than rewriting `01a3b789-2928-4886-a627-eaf5ae689790`, (4) keep
the failed FRED/OECD CPI dataset as immutable failed source-map evidence, and
(5) do not create ACTIVE manifests until SEALED diagnostic join proof reaches
`10,416/10,416`.

Gate 50 credential state as of the current 2026-06-22 run: Freedom supplied
FRED/ALFRED and e-Stat credentials in chat, but the current shell and local
`.env` files do not expose `FRED_API_KEY`, `ALFRED_API_KEY`, or `ESTAT_APP_ID`.
Do not paste these keys into command lines. Credential-bound promotion fills and
rate/e-Stat reconstruction must fail closed until the credentials are configured
out of band in a local environment surface that is not committed, logged,
hashed, or copied into receipts. Prior credentialed exploratory evidence remains
useful for diagnosis: the FRED/OECD CPI mirror dataset failed source promotion
because several CPI mirrors stop before the locked matrix window ends, while
rate staleness still needs separate ALFRED reconstruction diagnosis.

Gate 50 rate/ALFRED differential reconstruction scaffold added on 2026-06-22:
`app/scripts/verification/audit-macro-rate-differential-reconstruction.ts` plus
package script `verification:audit-macro-rate-differential`. It is a
source-only receipt for stale canonical 3m-rate rows in sealed dataset
`01a3b789-2928-4886-a627-eaf5ae689790`; it compares selected rows against FRED
as-of-freeze (`output_type=1`), initial-release rows (`output_type=4`), and
vintage-date windows, then classifies stale rows under the frozen rate rule:
latest eligible FRED/ALFRED vintage known at each weekly freeze.

Gate 50 credential preflight passed after local `.env.local` was corrected to
canonical names `FRED_API_KEY` and `ESTAT_APP_ID`; no credential values may be
written to source, receipts, logs, docs, command lines, or hashes. Final
rate/ALFRED differential receipt:
`app/reports/data-verification/macro-regime/gate50-rate-alfred-differential-reconstruction-20260622.{json,md}`.
It audited `139` stale three-month-rate rows from sealed dataset
`01a3b789-2928-4886-a627-eaf5ae689790` across `8` FRED/OECD series with
receipt hash
`8cbc4b565e6ccd8ea30942ec3dbacc9c5a72baa5abf6d23f44b90b2674092989`.
Classification counts: `92` `legitimate_revision`, `47`
`valid_carry_incorrectly_marked_stale`, `0` `wrong_vintage`, `0`
`reconstruction_defect`, and `0` `genuine_missing_observation`. The prior
single no-observation case was resolved by widening the reconstruction query
window so it includes the selected observation and eligible vintages through the
freeze; it is now classified as a legitimate CHF revision. The receipt preserves
that original anomaly in `rateReconciliationRepairHistory` as
`no_as_of_observation`, root cause `query-window defect`, repair version
`rate_vintage_reconciliation_query_window_repair_v1`, and post-repair
classification `legitimate_revision`. The rate receipt emits sealed diagnostic
non-ACTIVE `rate_3m_market_family_v1` and eight `RATE_DIAGNOSTIC` currency
bundle branches. Rate family manifest hash:
`c1befe5d6711265a3c2b55191eec19f9dec8b8e3e0316b48ea01a1e723eeb219`.

Gate 50 rate materialization completed on 2026-06-22 in SEALED diagnostic mode.
The source-fill path now uses `latest_eligible_vintage_as_of_weekly_freeze`,
FRED/ALFRED `fred/series/observations output_type=1`, and
`rate_3m_market_release_aware_carry_v1` for the canonical eight
`oecd_3m_interbank_rate` branches. Dataset version is now
`macro_regime_source_dataset_v3`; the warehouse source-observation key now
includes `source_observation_id` so multiple vintages for the same observation
date can coexist. Rate-only dataset:
`ee1f1611-5d6d-41cf-86fe-c06c66cb16bb` / hash
`eef3689856712225b2b1288e3a6005c8c11e8ec1271331aaf565581cc15c01cd`,
promotion manifest
`4f187897b9e60a79865e371daa2415d2654ef72aef18a2afd63609260b840947`,
contract manifest
`9d5f6d859a2f409f45a41a15f71994203ae3411fd36603aa1c40ab360ff8f774`.
Write receipt:
`app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-write-20260622.json`.
Counts: `8` rate sources, `2,886` source observations, `40` real-time-period
artifacts, `2,886` availability events, `2,976` SEALED weekly rate snapshots
(`372 x 8`), `0` stale, `0` missing. SEALED rate join receipt:
`app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-join-coverage-20260622.{json,md}`
with `joinReceiptStatus=PASS_DIAGNOSTIC`, `diagnosticOnly=true`,
`promotionEligible=false`, and `10,416/10,416` joinable pair-week contexts for
`rate_attribution_v1`. Boundary receipt:
`app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-boundary-proof-20260622.{json,md}`,
stable hash
`7ee1449a41bf46598b375650beb354af41e512857b21a430e2f2583567e49a45`,
proves `92/92` legitimate revisions have no boundary violation, `47/47`
previous valid carries are no longer stale and remain inside the FRED real-time
period, with `0` stale snapshots, `0` missing snapshots, and `0`
selection/staleness rule mismatches. This is still diagnostic-only; no ACTIVE
manifest, outcome, signal, stop, TP, runner, grid, or real-rate-pressure
activation was computed.

Gate 50 official CPI feasibility audit started on 2026-06-22:
`docs/research/GATE50_OFFICIAL_CPI_FEASIBILITY_AUDIT_2026-06-22.md`.
Preliminary conclusion: do not create eight accounts up front. Most candidate
official CPI paths appear public; only e-Stat is a confirmed configured
credential requirement so far. BLS registration is optional for expanded access,
and ABS Indicator API requires a key, but the ABS Data API should be audited
first because it may avoid another credential. Next CPI proof is endpoint/sample
proof across all eight official producer contracts, not source fill or ACTIVE
promotion.

Gate 50 official CPI endpoint receipt now exists:
`app/scripts/verification/audit-official-cpi-endpoint-feasibility.ts` plus
package script `verification:audit-official-cpi-endpoints`. Final receipt:
`app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-20260622.{json,md}`.
Receipt hash:
`0f70d9412af1e458260e73f06586222c471c1458236a57c2b3d122a185f8eeed`.
Overall status is `CPI_FAMILY_MANIFEST_BUILT_DIAGNOSTIC`,
`overallPromotionStatus=FAIL_CLOSED`, `promotionEligible=false`,
`outcomeConsumable=false`, and blocking reason
`RRP_COMPOSITION_PENDING_FOR_PROMOTION`. All eight branches now have
observed required-window endpoint samples: `USD`, `CAD`, `GBP`, `EUR`, `JPY`,
`AUD`, `NZD`, and `CHF`. The same receipt records `8/8` release-calendar
proofs, `8/8` revision/rebasing proofs, `8/8` locked continuity decisions,
`8/8` parser contracts, `8/8` normalized CPI schema branches, `8/8`
source-family validation pass branches, and `8/8` diagnostic manifest-built
branches. CPI family manifest hash:
`1e078c3f1648b13e2bfceb1278ed154a77c4065458b0956ca30e4015de73418c`.
Locked decisions include Eurostat `prc_hicp_minr` ECOICOP v2 `TOTAL` / `I25`
with evolving official euro-area composition (`EA20` through `2025-12`, `EA21`
from `2026-01`), Stats NZ Infoshare Export Direct `.sch` series
`CPIQ.SE9NS1160`, Swiss FSO `LIK25B25` `INDEX_m` all-items row parser with
layout-drift fail-closed, Japan 2020-base Table `1-1` until a future 2025-base
supersession audit, and Australia segmented native headline continuity:
quarterly through `2025-Q3`, monthly from `2025-10` with first monthly
eligibility after `2025-11-26 11:30 Australia/Sydney`, no interpolation. No
warehouse writes, ACTIVE manifests, real-rate-pressure derivation, P&L, or
macro outcomes were computed. The emitted currency bundles are CPI-only
`PARTIAL_SEALED` diagnostics and must not be labelled complete RRP bundles.

Gate 50 official CPI materialization completed on 2026-06-22 in SEALED
diagnostic mode. The source-fill path now uses official CPI contracts for all
eight currencies, preserves current and lag CPI parent observation IDs,
availability events, artifacts, native frequency, formula version, parser
version, release-calendar version, revision/rebasing version, continuity
decision, and release-aware carry. Future writes use
`macro_regime_source_dataset_v4_official_cpi`; the passed rate dataset remains
immutable v3 evidence and was not rewritten. CPI-only dataset:
`b4cbb08f-d564-452f-8c67-7e47f0ec40d6` / hash
`e8a508f0436408cdcbdd4c0ccd50acb73180c9b7321679db33e918ac4104c30b`,
promotion manifest
`d6831acfe5df0d07fdd8d551cc8cb8a3b69605afdb227346ee66e4183cbea9b5`,
contract manifest
`3ff7a511821f20f0b81c65f6589dad85965540c68687843688128e1a7b87fa7c`.
Write receipt:
`app/reports/data-verification/macro-regime/gate50-official-cpi-materialization-write-20260622.json`.
Counts: `10` official endpoint artifacts, `2,255` CPI YoY observations,
`2,255` availability events, `2,976` SEALED weekly CPI snapshots (`372 x 8`),
`0` stale, `0` missing. CPI-only SEALED join receipt:
`app/reports/data-verification/macro-regime/gate50-official-cpi-materialization-join-coverage-20260622.{json,md}`
with `joinReceiptStatus=PASS_DIAGNOSTIC`, `diagnosticOnly=true`,
`promotionEligible=false`, and `10,416/10,416` joinable pair-week contexts for
`inflation_attribution_v1`. Required verification passed:
`npm run verification:audit-official-cpi-endpoints`,
`npx tsc --noEmit --project app/tsconfig.json --pretty false`, and
`git diff --check -- . ':!app/releases/v2/canon/*.json'` with only existing
LF/CRLF warnings in dirty docs/package files.

Gate 50 lineage-enhanced RRP composition completed on 2026-06-23 in SEALED
diagnostic mode. It supersedes the earlier same-day RRP diagnostic by binding
parent weekly snapshot IDs/hashes plus parent `macro_week_id`, freeze target,
freeze version, calendar version, and immutable parent selector versions. The
new RRP dataset composes immutable rate v3 dataset
`ee1f1611-5d6d-41cf-86fe-c06c66cb16bb` /
`eef3689856712225b2b1288e3a6005c8c11e8ec1271331aaf565581cc15c01cd` with CPI
v4 dataset `b4cbb08f-d564-452f-8c67-7e47f0ec40d6` /
`e8a508f0436408cdcbdd4c0ccd50acb73180c9b7321679db33e918ac4104c30b`; it does
not refetch or rewrite either parent. RRP dataset:
`27542abe-6ce7-4e44-a7d2-f071ed258c73` / hash
`a8f3b360b972059941126f6791af1d103d7aa00be85082fff76893396a5b9603`,
promotion manifest
`205b52529b049f7fe648a9b57e52a3734566855f54959f5b78b8ee0d239b6c07`,
contract manifest
`714317f9c754278774fb79c9b758359a28a939b5fc56a139b6a7977fd9e621ff`.
Write receipt:
`app/reports/data-verification/macro-regime/gate50-rrp-composition-lineage-write-20260623.json`.
Counts: `8` complete RRP currency bundles, `2,976` SEALED weekly RRP
snapshots, `0` stale, `0` missing. SEALED RRP join receipt:
`app/reports/data-verification/macro-regime/gate50-rrp-composition-lineage-join-coverage-20260623.{json,md}`
has `joinReceiptStatus=PASS_DIAGNOSTIC`, `diagnosticOnly=true`,
`promotionEligible=false`, resolved join-map hash
`a817baf10745ed7411f0065cfb1143cdb93fdbbeaa89df96e13f30db73020085`,
resolved content join-map hash
`12f3bb76d9fb2862b4072f2def7498fe413f3cc4c036f89fc7956996c806546e`, and
`10,416/10,416` joinable pair-week contexts for
`real_rate_pressure_attribution_v1`. The join audit now treats the derived RRP
row as the joinable unit and fails closed unless embedded rate/CPI parent
lineage includes parent dataset IDs/hashes, family hashes, selected rate row,
selected current and lag CPI parents, parent availability events, artifact IDs,
parent weekly snapshot IDs/hashes, parent macro week/freeze identity, formula
version, and currency-bundle hash. Required verification passed:
`npm run verification:audit-official-cpi-endpoints`,
`npx tsc --noEmit --project app/tsconfig.json --pretty false`, and
`git diff --check -- . ':!app/releases/v2/canon/*.json'` with only existing
LF/CRLF warnings in dirty docs/package files.

Gate 50 parent-promotion proof completed on 2026-06-23 for the current SEALED
RRP checkpoint. The diagnostic RRP promotion manifest was not mutated. New
receipt:
`app/reports/data-verification/macro-regime/gate50-parent-promotion-proof-20260623.{json,md}`.
Status is `PASS_PARENT_APPROVED_NOT_ACTIVE`, `diagnosticOnly=true`,
`promotionEligible=false`, `activationEligible=false`, and
`outcomeConsumable=false`. Root RRP promotion manifest id:
`f6c4a3e3223ee4e54f7dfd6bbc7bb2bd29d17d7a98b59440b8e0f9bcfad9b619`;
root manifest hash:
`85e76ca98a34553d0b1d29535f5c271b485eafc4b271df7136151a3b0800004d`.
Parent proof hashes: rate
`453d14a2bbb6d9f1e64eae3c150554eff7227466b43f0cd42cd60864e6950d99`,
CPI `c836614277f41c755150dd3de21cc14dd8692231b20b84d537d2a02e08e04709`.
The pinned `resolvedContentJoinMapHash` remains
`12f3bb76d9fb2862b4072f2def7498fe413f3cc4c036f89fc7956996c806546e` and must
remain unchanged through deterministic rebuild, historical activation,
lifecycle transitions, and final ACTIVE join unless a superseding dataset or
manifest explicitly explains the change. Outcome logic remains prohibited as of
this checkpoint.

Gate 50 deterministic rebuild proof completed on 2026-06-23. New script:
`app/scripts/verification/audit-macro-deterministic-rebuild-proof.ts`; package
script: `verification:audit-macro-deterministic-rebuild-proof`. Receipt:
`app/reports/data-verification/macro-regime/gate50-deterministic-rebuild-proof-20260623.{json,md}`.
Status is `PASS_DETERMINISTIC_REBUILD`; parent-to-RRP rebuild is `PASS`;
receipt hash
`5ff451fc40ddd29c6376e7359b3430d23cee8d1dd7a86cbb74bf79cc336e6c89`.
The receipt now explicitly scopes the proof as
`STORED_CANONICAL_WAREHOUSE_CONTENT_WITH_ARCHIVED_ARTIFACT_HASH_VALIDATION`:
`storedNormalizedRowsUsedAsInputs=true`, `storedWeeklySnapshotsUsedAsInputs=true`,
`rawArchivedArtifactsReparsed=false`, `comparisonTarget=STORED_CANONICAL_CONTENT`,
and `rawArtifactReparseStatus=PENDING_FULL_PARSER_REPLAY`. Do not describe this
as a full raw archived artifact parser replay until a separate frozen-parser
replay proof exists.
The proof binds rate parent dataset
`ee1f1611-5d6d-41cf-86fe-c06c66cb16bb` /
`eef3689856712225b2b1288e3a6005c8c11e8ec1271331aaf565581cc15c01cd`, CPI
parent dataset `b4cbb08f-d564-452f-8c67-7e47f0ec40d6` /
`e8a508f0436408cdcbdd4c0ccd50acb73180c9b7321679db33e918ac4104c30b`, and RRP
dataset `27542abe-6ce7-4e44-a7d2-f071ed258c73` /
`a8f3b360b972059941126f6791af1d103d7aa00be85082fff76893396a5b9603`. It
recomputed stable canonical content identities for artifact payload sets,
normalized observations, availability events, weekly parent snapshots,
aggregate manifests, RRP rows, and RRP currency bundles. Rate proof counts:
`40` text artifacts, `2,886` observations, `2,886` availability events,
`2,976` weekly rows, and `372` aggregate manifests. CPI proof counts: `10`
artifacts (`9` text, `1` binary hash-only workbook), `2,255` observations,
`2,255` availability events, `2,976` weekly rows, and `372` aggregate
manifests. RRP proof counts: `2,976` rows, `8` currency bundles, `0` stale,
`0` missing. Parent lineage mismatches are all `0`, and the recomputed
`resolvedContentJoinMapHash` remains
`12f3bb76d9fb2862b4072f2def7498fe413f3cc4c036f89fc7956996c806546e`.
Canonical proof excludes database UUIDs, build/generated timestamps, local file
paths, raw receipt-generation times, non-semantic HTTP response headers, and
binary payload bytes when the warehouse stores hash/size only. No ACTIVE state,
P&L, macro outcome, strategy decision, stop, TP, runner, grid, or correlation
logic was opened.

Gate 50 combined boundary proof is now the active blocker. New script:
`app/scripts/verification/audit-macro-boundary-proof.ts`; package script:
`verification:audit-macro-boundary-proof`. Receipt:
`app/reports/data-verification/macro-regime/gate50-boundary-proof-20260623.{json,md}`.
Status is `FAIL_BOUNDARY_PROOF`; receipt hash
`86f158730c6e704fbe34e27dda99f65bba2ef28c0a9ff989581ea7fdeae13801`.
Boundary assertions passed `14/16`. Passing assertions include exact
before/equal/after freeze behavior, rate future-vintage rejection, rate revision
vintage switching, CPI revision/rebasing version binding, NZD quarterly carry,
AUD no-retrospective-monthly before transition, EUR EA20/EA21 transition, RRP
derived eligibility equal to latest parent eligibility, SEALED diagnostic
`10,416/10,416` join, New York/Sydney DST conversion, and delayed-release
exception rollover simulation. Blocking assertions:
`rate_date_only_vintage_same_freeze_eligible` because `31` date-precision
ALFRED rows are selected and eligible on the same weekly freeze date, and
`aud_monthly_transition_not_materialized` because `23` AUD CPI rows after the
October 2025 transition remain quarterly (`0` monthly, `23` quarterly). Do not
continue to uniqueness/lifecycle, revocation, historical activation, zero-P&L
execution-read, or final ACTIVE join until these two boundary blockers are
resolved or a versioned reviewer-approved contract supersedes the invariant.

Gate 50 first slice completed: BPR availability now uses
`cftc_bpr_exception_calendar_v2_2019_2025_lapse_holiday`; normal BPR release
timestamps are corrected to Friday 15:30 America/New_York; first-Tuesday
federal-holiday report-date handling is explicit; 2019 January/February lapse
reports use the official February 8 and February 22 catch-up release dates;
December 2025 uses the official December 17 catch-up release; October/November
2025 are conservative not-before rows and are promotion-blocked until an exact
BPR catch-up date is sourced.

Gate 50 proof after that slice: `npx tsc --noEmit --project app/tsconfig.json
--pretty false` passed; no-source dry-run wrote `2` weekly manifests and zero
writes; BPR-only 2019 delay-window dry-run fetched `10/10` live CFTC reports
with `90` BPR observations, `10` artifacts, `90` availability events, `36`
exact exception observations, and `0` promotion-blocked observations; BPR-only
2025 lapse-window dry-run fetched `10/10` live CFTC reports with `90` BPR
observations, `10` artifacts, `90` availability events, `54` exception
observations, and `36` promotion-blocked not-before observations; FRED rate
dry-run without a key failed closed as intended; `git diff --check` passed with
only existing LF/CRLF warnings. Ignored receipts:
`app/reports/data-verification/macro-regime/gate50-no-source-dry-run-20260620.json`,
`app/reports/data-verification/macro-regime/gate50-bpr-exception-calendar-2019-dry-run-20260620.json`,
and
`app/reports/data-verification/macro-regime/gate50-bpr-exception-calendar-2025-dry-run-20260620.json`.

Gate 50 join-proof scaffold added:
`app/scripts/verification/audit-macro-regime-join-coverage.ts` and package
script `verification:audit-macro-regime-join-coverage`. It is zero-P&L and
binds macro weekly snapshots to the locked Gate 44 control dataset
`479624d1-f6a2-4928-82f1-981137762bdc` /
`cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36`.
The current proof confirms the matrix side is clean: `372` exact weeks, `28`
FX pairs, `10,416` source-context rows, and week-id hash
`54e26e0cc3718d86b53496fc977dfcdd7c9d8841bbaa21defdb3fc4832ba21aa`. The
audit fails closed by default when promotion blockers remain. Pinned
exploratory macro dataset `a403b126-9f65-4a35-b353-0b9dcc986bd0` fails join
promotion: no `promotion_manifest_id`, no `contract_manifest_hash`, no
aggregate weekly manifests, missing `real_rate_pressure` and `valuation`, and
legacy `real_value` source-family rows. Ignored receipts:
`app/reports/data-verification/macro-regime/gate50-macro-join-coverage-current-20260620.json`,
`app/reports/data-verification/macro-regime/gate50-macro-join-coverage-pinned-full-exploratory-20260620.json`,
and
`app/reports/data-verification/macro-regime/gate50-macro-join-coverage-fail-closed-20260620.json`.

Codex Pro reviewed the Gate 50 packet and returned `PASS WITH CAVEATS` for the
proof design; the current exploratory macro dataset remains a correct `FAIL`.
Immediate caveats implemented in the join audit: `--feature-bundle-id` is now
required; dependency blocking is bundle-specific rather than all-family by
default; receipts include `joinReceiptStatus`, `diagnosticOnly`,
`promotionEligible`, `featureBundleManifestId`, `requiredDependencySetHash`,
`resolvedJoinMapHash`, pair/week key hashes, and derived source-lineage hashes;
future outcome runners must require a non-diagnostic PASS receipt and pinned
`resolvedJoinMapHash`. New bundle-aware diagnostic receipt for
`real_rate_pressure_attribution_v1` still fails correctly at `0/10,416`:
missing `promotion_manifest_id`, missing `contract_manifest_hash`, missing
`real_rate_pressure`, legacy `real_value`, no aggregate manifests, `372`
missing weekly manifests, and incomplete pair-week join coverage. Ignored
receipt:
`app/reports/data-verification/macro-regime/gate50-macro-join-coverage-feature-bundle-rrp-20260620.json`.
Review response doc:
`docs/research/GATE50_CODEX_PRO_REVIEW_RESPONSE_2026-06-20.md`.

Remaining Gate 50 blockers are operational/source proof, not another
architecture review: failed FRED/OECD CPI mirror suitability, official CPI
family feasibility, FRED/ALFRED point-in-time rate reconstruction,
source-disposition receipts, source-only promotion fill receipts,
rebuild-to-identical snapshot hashes, boundary tests, one-active-snapshot
tests, revocation/fail-closed tests, and forward settlement/activation/
execution-read receipts. JPY CPI Table 1-1 API acquisition is no longer the
main blocker, but base-vintage continuity remains part of the official CPI
family proof.

External-review disposition: keep `week_open_utc`, reject Friday `21:00 UTC` as
the v1 default, and separate source freeze from weekend settlement. The
settlement layer must ingest, build, seal, report, and verify the weekly macro
snapshot before the `20:00 America/New_York` execution layer; if not ready,
live execution fails closed. Metadata alone does not cure modeled
`available_at_utc`: FRED/OECD rate and CPI rows need ALFRED/FRED point-in-time
vintage reconstruction before promotion, or Gate 50 must be labelled
latest-vintage exploratory research. JPY CPI primary target is e-Stat Table
`1-1` monthly Subgroup Index for Japan all-items, with Table `4-1` all-items as
validation-only evidence. The derived family name is now `real_rate_pressure`,
not `real_value`.

Gate 49 final hardening slice: the macro source fill now fails closed for
promotion-bound FRED/OECD rate and CPI rows unless `FRED_API_KEY` or
`ALFRED_API_KEY` is available. With the key, FRED/ALFRED observations use
initial-release point-in-time rows (`output_type=4`) instead of latest-vintage
graph CSV. Latest-vintage CSV is allowed only with explicit
`--allow-exploratory-source-fallback`. JPY CPI is a new e-Stat source id
(`estat_japan_cpi_table_1_1_all_items_2020_base`), requires `ESTAT_APP_ID`,
and no longer silently uses stale FRED/OECD Japan CPI. Local credential check on
2026-06-19 found no `FRED_API_KEY`/`ALFRED_API_KEY` and no `ESTAT_APP_ID`, so a
promotion-grade fill cannot run on this machine until those are configured.
The five-layer source architecture is now represented in code, not only docs:
`sourceVersions.sourceRegistry` records economic authority, compiler/harmonizer,
dissemination endpoint, promoted endpoint, availability contract, revision and
rebasing policy, exception status, and promotion state per source. The warehouse
now includes `research_macro_source_artifacts` for immutable endpoint evidence:
sanitized request, response headers, HTTP status, raw payload hash/size/text,
and artifact metadata. Source observations and weekly snapshots carry
`rawArtifactId`/`rawArtifactIds` alongside `rawObservationId`, parent lineage,
snapshot hash, and dataset manifest hash. This is still source-contract
plumbing only; no regime direction, overlay, or signal result has been run.
Verification after this slice: `npx tsc --noEmit --project app/tsconfig.json
--pretty false` passed; a no-source dry-run passed; a one-week BPR-only dry-run
captured `3` live CFTC HTML artifacts / `291,604` payload bytes with zero
writes.

Codex Pro high-level architecture review returned `approve with amendments`.
The two blocking amendments are now represented as Gate 49 contract plumbing:

- endpoint capability is split into `retrieval_capability`,
  `availability_precision`, and `eligibility_policy`. BPR is
  `release_event_filterable` / `scheduled_window` /
  `eligible_at_or_before_freeze`; FRED/ALFRED is `as_of_queryable` / `date` /
  `first_freeze_strictly_after_date`; capture-only valuation inputs remain
  shadow-only; derived `real_rate_pressure` inherits parent eligibility;
- four clocks plus completion/activation are explicit:
  `freeze_target_utc`, `settlement_deadline_utc`,
  `settlement_completed_at_utc`, `sealed_at_utc`, `verified_at_utc`,
  `activated_at_utc`, and `effective_from_utc`;
- datasets now have lifecycle fields for `snapshot_state`,
  `promotion_manifest_id`, `contract_manifest_hash`,
  `settlement_deadline_utc`, `settlement_completed_at_utc`, `sealed_at_utc`,
  `verified_at_utc`, `activated_at_utc`, `effective_from_utc`,
  `effective_to_utc`, revocation/supersession fields, `verification_run_id`,
  reconstruction mode, calendar version, selector version, validation contract
  version, and build version;
- `research_macro_availability_events` records availability basis, retrieval
  capability, precision, eligibility policy, timezone, confidence,
  promotion-eligible availability bases, exception/eligibility calendar
  versions, evidence artifact, rule version, and first eligible freeze per
  source observation;
- `research_macro_weekly_snapshot_manifests` is the aggregate weekly snapshot
  identity. A partial unique index allows exactly one `ACTIVE` row per
  `(promotion_manifest_id, macro_week_id, freeze_version)`. Row-level weekly
  currency snapshots stay sealed source evidence, not executable trading truth;
- `research_macro_snapshot_state_transitions` and
  `research_macro_execution_receipts` scaffold post-activation revocation and
  future execution-read proof;
- the weekly selector is deterministic under `macro_weekly_snapshot_selector_v1`:
  newest eligible observation period, latest eligible vintage, allowed prelim/
  final state, then deterministic raw-observation-id tie-break;
- the source registry includes semantic/provider hashes, schema hash, segment
  id, continuity decision, unit-conversion version, normalization version, and
  drift action;
- CFTC historical archive language is corrected to internal replay evidence for
  canonical CFTC artifacts, not runtime provider fallback;
- JPY Table `4-1` is validation-only under this contract; Table `1-1` failure
  must fail closed unless a new source contract and full backfill are approved.

Gate 49 baseline verification before Gate 50:
`npx tsc --noEmit --project app/tsconfig.json --pretty false` passed; a narrow
no-source `--dry-run` passed with `2` weekly manifests and zero writes; a
narrow BPR-only `--dry-run` passed with `3` live CFTC HTML artifacts, `27` BPR
observations/events, `2` weekly manifests, and all availability events
classified as `release_event_filterable` / `scheduled_window` /
`eligible_at_or_before_freeze`; a promotion-bound FRED rate dry-run without
`FRED_API_KEY`/`ALFRED_API_KEY` failed closed as intended.

Gate 49 handoff blockers became the Gate 50 work queue: credentials, JPY
base-vintage continuity, BPR delayed-report exception calendar, source-only
promotion fill receipts, rebuild-to-identical snapshot hashes, boundary tests,
one-active-snapshot tests, revocation/fail-closed tests, and forward
settlement/activation/execution-read receipts. The first BPR exception-calendar
slice above reduces that queue but does not make the macro source layer
promotion-grade yet.

Gate 47 source-foundation evidence: the prior source-row gate filled BPR and
rates source rows with source URLs, cadence, availability timestamps,
stale/missing flags, and weekly currency snapshots before deciding how
BPR/rates should be used. Do not encode fade/extreme/combined real-rate-pressure logic
yet. Local v2 warehouse fill passed on `2026-06-19` as dataset
`a403b126-9f65-4a35-b353-0b9dcc986bd0` /
`b184c49fbedc202dad061366ca6dbc25478470230549847fe56b420aa8647ca8`:
`12,058` raw observations and `19,788` weekly snapshots across `388` weeks.
The data foundation now stores raw `bpr`, `rate`, and `inflation` source
families plus derived weekly `real_rate_pressure` rows. BPR report coverage is closed:
`184/184` monthly futures/options reports fetched, `106` from live CFTC routes
and `78` via Wayback CFTC archive fallback, `0` failed. Rates rows are
populated from FRED/OECD and FRED daily policy/reference series. CPI rows are
computed from FRED index levels as YoY inflation with source, lag date, cadence,
and availability metadata. Derived real-rate rows use
`3m interbank rate - CPI YoY`; this is a stored feature row, not a regime
decision. Direct DB readback: BPR snapshots `6,208` rows / `2,103` available /
`4,105` missing; rate snapshots `7,372` rows / `7,372` available / `207` stale;
inflation snapshots `3,104` rows / `3,104` available / `486` stale; real-rate-pressure
snapshots `3,104` rows / `3,104` available / `497` stale. Japan CPI is the
known weak v0 source: FRED/OECD Japan CPI ends at `2021-06-01`, making JPY
real-rate-pressure rows stale for `245/388` weeks. Source hardening then mapped CPI
replacement candidates by currency, confirmed BIS monthly broad REER/NEER
availability for all eight FX currencies, and rejected OECD monthly comparative
price levels for seven-year parity because the audited API pull was
current-period only. The first valuation fill slice used OECD annual Table 4
PPP household final consumption plus annual average exchange-rate rows as raw
valuation inputs only. It persisted dataset
`5cd8e166-772a-4d1c-868a-582e70567558` /
`60ba3840779b5ea62443fe8b94fc19c272bbe903595cdf0ba0ff7430ce58284d`:
`136` raw valuation observations and `6,208` weekly valuation snapshots, all
available with `0` stale and `0` missing. Next action: pin the JPY e-Stat CPI
replacement path and BIS REER/NEER ingestion path before any read-only overlay
or signal test. BIS ingestion is now pinned to the official v2 SDMX API and a
second valuation slice persisted dataset
`97266ab2-6feb-4962-936b-a47d73c06684` /
`3131935ee881bfde850440a272fec06f1de5d3c3710a50e64d23552a0fed4cc0`:
`1,608` raw valuation observations and `12,416` weekly valuation snapshots
across OECD annual PPP/exchange-rate and BIS monthly broad NEER/REER rows, all
available with `0` stale and `0` missing. Next action: pin the JPY e-Stat CPI
replacement path before any read-only overlay or signal test. JPY CPI official
path is now pinned to Statistics Bureau/e-Stat CPI 2020-base Table `4-1`,
`Indices of Items for Japan Monthly`, item `総合` / all items. Example probed
stat/file id: `000040276983`; API path requires `ESTAT_APP_ID`, while the
official Excel fallback is accessible but needs a reviewed XLSX parser before
promotion. No replacement JPY CPI rows were filled in this slice. Next action:
choose env-gated e-Stat API fill or a tiny versioned XLSX parser, then backfill
JPY CPI as a new source id/dataset version before any overlay or signal test.

Live/test parity rule: the promoted regime algo must use only the feature
contract that the seven-year backtest can reproduce. Better live-only sources
can be collected as shadow enrichment, but they cannot drive live decisions
until they are backfilled with defensible as-of timestamps or promoted as a new
versioned regime candidate with a fresh retest.
Immediate continuation is still source hardening, not signal testing: upgrade
weak CPI sources, keep richer live-only data shadow-only until
backfilled/versioned, then run a read-only overlay against Gate 44 pair
decisions.

Gate 44 below is prior matrix context, not the active implementation gate.

## Prior Gate Context

Gate 44: reusable-seven-year-matrix-dataset.

Status: active. Gate 43 created the M1-backed Strength history/context layer
and corrected market-open confirmation to use FX market-truth open, separate
from the later execution window. Gate 44 builds the reusable seven-year matrix
warehouse so source context, grid opportunities, variant decisions, trade
events, stops, and attribution can be queried after the run without rerunning
market/source truth. First one-week warehouse proof passed on `2026-06-08`
with M1 marks, Gate 43 market-open Strength context, `28/28` Friday and
market-open directional Strength rows, and exact JSON-to-DB weekly-result
parity. The proof wrote dataset
`799e6a2c-5aa3-4583-bd59-2f04dd3ff2a6` with `28` source-context rows, `579`
base trade opportunities, `420` variant runs, `11,760` pair decisions, `420`
variant-week rows, `102,084` trade events, and `290` stop events. Read: do not
run the broad seven-year matrix yet. The first warehouse write took about
`93.9s` of `162.4s` wall time for one week; the COPY-backed writer now brings
the same `420`-variant / `102,084`-event proof to `66.9s` wall time, `22.8s`
warehouse write, and `17.2s` trade-event write with exact parity. Gate 44 now
has explicit trade-event persistence modes. Exploratory mode
`--matrix-trade-event-mode=none` wrote the same `420` variant weeks with source
contexts, opportunities, pair decisions, weekly results, and stop events in
`22.8s` wall / `4.5s` warehouse time, with `0` trade-event rows by design and
exact JSON-to-DB weekly-result parity. Selected-event mode also passed on a
narrow COT slice, writing `12` variant weeks and `147` detailed trade events
for one chosen runner variant. Read: broad discovery should default to
exploratory persistence; promotion-grade or failure-autopsy runs can use full
or selected trade-event ledgers without rebuilding source/market truth.
Current-2026 closed-week proof then exposed and fixed the next real blocker:
M1-backed Gate 43 Strength initially existed only for the latest current weeks,
so the first `23`-week warehouse was fast and parity-clean but not
source-complete. Current-2026 FX M1 bars were materialized for `2026-01-05`
through `2026-06-08` plus the prior `2025-12-29` week, and Strength history
was derived/written for `15m` cadence with `1h/4h/24h` windows
(`382,176` rows). The source-complete warehouse proof wrote dataset
`90ab914f-13a8-415d-ba54-851f1f25ac4a` /
`gate44-explore-420-current2026-sourcecomplete-noevents-20260618-23w` with
`644` source contexts, `12,699` opportunities, `420` variants, `270,480` pair
decisions, `9,660` variant-week rows, `0` trade events, and `17,105` stop
events. DB parity was exact (`9,660/9,660`, zero mismatches), Friday Strength
was `644/644` directional, market-open Strength was `644/644` directional, and
bad source weeks were `0`. Runtime was `273.8s`; the remaining bottlenecks are
multi-week bar/source preparation and pair-decision persistence. A follow-up
targeted mark-price pass changed the shared `pathBarLoader` mark matrix so
side-selector scoring reads latest marks at receipt path timestamps instead of
scanning every M1 bar in each week, with a dense-timestamp fallback for future
minute-level consumers. Pair decisions now use COPY by default and store a
source-context join pointer unless a verbose run is requested. The
source-complete current-2026 proof after this pass wrote dataset
`27da83a7-26e5-4352-8e13-98f71683ff15` /
`gate44-targetmarks-420-current2026-noevents-20260618-23w`: exact DB parity
(`9,660/9,660`, zero mismatches), Friday Strength `644/644`, market-open
Strength `644/644`, bad source rows `0`. Profile shifted materially:
`canonical_bar_load` `84.9s -> 6.35s`, `week_prepare_all` `106.9s -> 32.0s`,
warehouse write `72.7s -> 41.7s`, pair-decision write `52.8s -> 22.1s`.
Remaining broad-run bottlenecks are variant evaluation, source-context reads,
and analysis/query reporting.

Clean-2025 separated-year test is now real, not all-zero. The local path
materialized M1 for `2024-12-30` plus the `39` clean displayed weeks
`2025-01-06` through `2025-09-29` (`7,917,672` rows fetched/upserted,
`0` errors). Coverage readback was `1,090` complete, `30` partial, `0`
missing. M1-backed Strength was written in nine month chunks after the full
range hit Node heap limits; readback loaded `640,224` Strength rows in
`12.44s`, and all `39/39` weeks had `28/28` Friday plus `28/28` market-open
directional Strength. First/last Friday Strength:
`2025-01-03T22:00:00Z` / `2025-09-26T21:00:00Z`; first/last market-open
Strength: `2025-01-05T23:15:00Z` / `2025-09-28T22:30:00Z`. This preserves FX
market-truth open, separate from the later 8pm Eastern execution zone.

Clean-2025 candidate datasets:
`gate44-clean2025-cot-candidates-noevents-20260618` /
`89f068d3-38c6-4756-816e-76803457ac8d` and
`gate44-clean2025-dealer-commercial-candidates-noevents-20260618` /
`10dd52b6-c8f5-4c98-99dd-6bc5e36f4f88`. Both passed exact JSON-to-DB weekly
parity (`234/234`, zero mismatches), each with `1,092` source contexts and `0`
bad Friday/open Strength rows. COT fixed `15` ADR basket SL + `25%` BE runner
returned `+28.92` ADR / `-23.99` worst-path DD / `1.21` R/DD / `-2.28`
week-close ADR; the `20%` BE runner row returned `+25.07` / `-24.16` /
`1.04` / `-19.09`. Dealer/Commercial with the current-2026 fixed `0.70` pair
inventory SL failed clean-2025 (`25%` BE row `-2.80` ADR / `-16.19` DD), while
Dealer/Commercial without the pair stop was the clean-2025 leader (`25%` BE
row `+71.40` ADR / `-28.73` DD / `2.48` R/DD / `-18.53` week-close ADR).
Read: do not promote the fixed `0.70` pair stop from current-2026; stop policy
and source model must be separated before a seven-year sweep.

Seven-year coverage manifest now exists:
`app/reports/data-verification/research-matrix-coverage/research-matrix-coverage-manifest-2019-2026-20260619-002530.md`
and matching JSON. This is coverage/readiness only, not a strategy run. Current
state: 2019 `0/52` ready, 2020 `0/52`, 2021 `0/52`, 2022 `0/52`, 2023 `0/52`,
2024 `0/53`, 2025 `36/39` strict-ready, 2026 `21/23` strict-ready. The 2025
and 2026 source/Strength contexts are complete; strict blockers are the known
partial M1 rows, not a source failure. Named COT gaps are `2019-01-07`,
`2020-12-28`, and `2023-07-10`.

Freedom correctly challenged the manual year-by-year recovery path. Gate 44
pivoted to M1-first warehouse build:
`canonical M1 bars -> M1 coverage proof -> Strength snapshots -> source/receipt
checks -> matrix`. The first DB planner/executor
`app/scripts/verification/plan-bulk-m1-backfill.ts` proved the all-years raw-M1
backlog (`9,072` missing rows, about `65,743,200` weak M1 bars) and bounded DB
proofs worked for early 2024, but a later older-year DB fill hit PostgreSQL
storage exhaustion (`No space left on device`). Render/Postgres is therefore
the wrong place to force seven-year raw M1.

Gate 44 now uses a local SQLite raw-M1 warehouse for research:
`app/src/lib/research/localM1Warehouse.ts`,
`app/scripts/verification/plan-local-m1-backfill.ts`, and
`data/canonical-m1/canonical-m1.sqlite` (`data/` is gitignored). It is opt-in
only through `LIMNI_M1_WAREHOUSE=sqlite` or `LIMNI_M1_SQLITE_PATH`; production
DB behavior is unchanged by default. `pathBarLoader` and
`historicalStrength` now read `1m` bars from SQLite when enabled.

Local M1 fill is complete through latest display week `2026-06-08`:
`2019-2022` receipt
`app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2019-2022-20260619-080858.md`,
`2023-2026` receipt
`app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2023-2026-20260619-090641.md`,
and year summary
`app/reports/data-verification/local-m1-warehouse/local-m1-year-coverage-summary-20260619-093609.md`.
Readback: 2019 `1126` complete / `330` partial / `0` missing, 2020 `1303` /
`153` / `0`, 2021 `1340` / `116` / `0`, 2022 `1420` / `36` / `0`, 2023
`1428` / `28` / `0`, 2024 `1400` / `84` / `0`, 2025 `1398` / `58` / `0`,
2026 `643` / `1` / `0`. Read: raw M1 infrastructure is no longer the blocker;
partials are market/holiday/provider facts to carry into attribution, not a
failed backfill state.

SQLite loader smokes passed: `pathBarLoader` loaded EURUSD `2024-04-01` from
local M1 with `1413` bars, and `deriveFxStrengthHistoryFromM1` generated
`3` hourly snapshots / `24` rows for `2024-04-01T00:00..03:00Z` with `0`
incomplete rows. Next action: derive M1-backed Strength from the local SQLite
warehouse in bounded chunks, then rerun weekly context/source/receipt coverage
with `LIMNI_M1_WAREHOUSE=sqlite` before the broad seven-year source/model
matrix.

2026-06-19 Gate 44 update: the setup path is now past coverage and into real
seven-year source tests. Local M1 is filled through `2026-06-08`; local weekly
decision-point Strength was derived from that M1 warehouse; latest-valid
receipts cover `372` clean displayed weeks; source coverage passed over
`10,416` pair rows with zero missing-all-source rows. The side-selector runner
was repaired so broad exploratory runs process bounded week batches, avoid
retaining full mark-price matrices, skip trade-event materialization when
`--matrix-trade-event-mode=none`, clear per-week path caches, and write compact
warehouse rows. A 10-week smoke wrote dataset
`1fff4936-3e4b-4df5-8d6e-02291f7596da` with exact persisted counts in `30.6s`.
The first six-variant 372-week numeric pass wrote `2,232` variant-week rows and
passed JSON-to-DB parity with zero mismatches.

The broad source-model-only seven-year matrix is now complete:
dataset `479624d1-f6a2-4928-82f1-981137762bdc`, hash
`cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36`,
`35` variants, `372` weeks, `10,416` source contexts, `222,769` trade
opportunities, `364,560` pair decisions, `13,020` variant-week results,
`0` trade events by design, and exact JSON-to-DB parity (`13,020/13,020`,
zero mismatches). Receipt:
`app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-372w-20260619-134630.md`.
Read report:
`app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-model-matrix-read-372w-20260619-134630.md`.
Top R/DD rows are open canonical Strength fade, Friday Strength when it
disagrees with COT Faces, COT Faces when open Strength disagrees, and
Friday/open-fade agreement. Do not treat this as stop-policy proof: the leaders
have severe week-close drag, so stops/runners/TP are the next separate gate
after source-model analysis, not part of this coverage gate.

Gate 44 save point: complete enough for review. Do not continue by tuning
stops, runners, TP, grid entries, or pair filters. The next gate is:

```txt
Gate 45: seven-year-matrix-review-and-accuracy-audit
```

Gate 45 handoff:
`docs/research/GATE45_SEVEN_YEAR_MATRIX_REVIEW_AND_ACCURACY_AUDIT_HANDOFF_2026-06-19.md`.

Gate 45 job: audit the Gate 44 warehouse and broad source-model matrix for
accuracy, robustness, modularity, future-proofing, and metadata sufficiency.
The expected output is `PASS`, `PASS WITH CAVEATS`, or `FAIL` before any new
optimization work.

Durable notes:

- Gate 39 result:
  `docs/research/GATE39_ADR_BASKET_STOP_LOSS_HARDENING_2026-06-16.md`.
- Gate 40 review handoff and first-pass result:
  `docs/research/GATE40_TAKE_PROFIT_RUNNER_REVIEW_HANDOFF_2026-06-16.md`.
- Gate 41 review/design handoff:
  `docs/research/GATE41_BACKWARD_REGIME_VALIDATION_HANDOFF_2026-06-16.md`.
- Gate 42 cleanup/speed handoff:
  `docs/research/GATE42_RESEARCH_STATE_CLEANUP_AND_BACKTEST_ENGINE_REARCHITECTURE_2026-06-16.md`.
- Gate 43 Strength history state:
  `docs/research/GATE43_STRENGTH_HISTORY_AND_CONTINUOUS_CONTEXT_2026-06-18.md`.
- Gate 44 reusable matrix dataset state:
  `docs/research/GATE44_REUSABLE_SEVEN_YEAR_MATRIX_DATASET_2026-06-18.md`.
- Gate 44 first warehouse proof receipt:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-1w-20260618-044522.md`.
- Gate 41 clean-2025 kickstart receipts:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-39w-20260616-190246.md`
  for COT and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-39w-20260616-191152.md`
  for Dealer/Commercial, each with matching `-stop-events.csv` ledgers.
- Gate 39 review receipt repair: the side-selector audit now emits stop-event
  ledgers proving active fills closed at stops and skipped-fill opportunity
  cost.

Receipts:

- Coarse ADR basket SL sweep:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-124910.md`.
- Refined ADR basket SL sweep:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-125153.md`.
- Pair inventory stop sweeps:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-132732.md`,
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-133045.md`,
  and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-133329.md`.
- Gate 39 review receipts with stop-event ledgers:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-160225.md`,
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-160515.md`,
  and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-161014.md`.
- Gate 40 current-2026 TP/runner sweeps:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-163225.md`
  for COT and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-163524.md`
  for Dealer/Commercial.
- Gate 40 reset-point trailing follow-up sweeps:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-174946.md`
  for COT and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-175407.md`
  for Dealer/Commercial.

Current read:

- Window: 23 closed displayed weeks, `2026-01-05` through `2026-06-08`.
  Excluded partial/current `2026-06-15`.
- Graduated rows tested: COT commercial-delta + open + Friday Strength
  go-with, and Dealer/Commercial + open + Friday Strength go-with.
- Basket SL definition: close active selected fills and block later selected
  fills when selected-basket marked ADR reaches `-N` from week-open baseline.
- COT row: no stop returned `+113.61` ADR / `-18.91` DD / `6.01` R/DD /
  `-65.57` week-close ADR. The only defensible active stop is around `15` ADR:
  `+98.48` ADR / `-16.57` DD / `5.94` R/DD / `-53.82` week-close ADR, one hit
  week, 33 skipped fills. Stops below `14` ADR cut too much recovery; `20+`
  ADR does nothing.
- Dealer/Commercial row: no stop returned `+58.88` ADR / `-12.46` DD / `4.73`
  R/DD / `-9.99` week-close ADR. Active stops at `11` or `12` ADR hurt return
  without improving the measured worst path DD; `13+` ADR does not trigger.
- 39b pair inventory stop definition: close active fills for a pair-side and
  block later fills for that pair-side when adverse distance from active
  average entry reaches the threshold in that pair's ADR units. Pair stop runs
  before any basket stop.
- Dealer/Commercial benefits from a `0.70` ADR pair inventory stop in current
  2026: `+52.28` ADR / `-6.31` DD / `8.29` R/DD / `-2.68` week-close ADR.
  This sacrifices `6.60` ADR versus no stop but roughly halves measured worst
  DD.
- COT does not improve on pure R/DD with pair stops. Primary hardening remains
  the `15` ADR basket band. A `1.10` ADR pair inventory stop is only a
  secondary candidate if broader proof shows week-close drag is a bigger regime
  risk than current-2026 R/DD suggests.
- Working threshold before backward expansion: COT can carry a `15` ADR basket
  SL candidate; Dealer/Commercial can carry `0.70` ADR pair inventory SL.
- Gate 39 review result: stop definitions and threshold reads pass as a
  research base. The new event ledgers show the stops are robustness pistons,
  not free edge; they reduce measured path/week-close risk by sacrificing some
  recovery and skipped winners.
- Gate 40 first-pass result: basket TP is not validated. `10` ADR is too tight
  and hurts; `15` ADR is weak/non-helpful; `20` and `25` ADR are non-binding in
  the current-2026 window. Break-even runners are the constructive mechanism.
  Trailing runners improved some headline return rows but worsened drawdown,
  stop churn, or week-close quality enough to stay frozen.
- COT Gate 40 leader with the fixed `15` ADR basket SL is `20%` runner BE:
  `+114.31` ADR / `-17.08` DD / `6.69` R/DD / `+3.17` week-close ADR.
  This beats the fixed Gate 39 COT stop row on return and week-close quality,
  with only about `0.52` ADR worse worst-path DD.
- Dealer/Commercial Gate 40 leader with the fixed `0.70` ADR pair SL is `20%`
  runner BE: `+67.48` ADR / `-6.83` DD / `9.88` R/DD / `+27.66` week-close
  ADR. This adds `+15.20` ADR versus the fixed Gate 39 row, with about `0.52`
  ADR worse worst-path DD.
- Gate 40 reset-point trailing follow-up added three runner families: pure BE,
  pure reset trail armed at `+1.0` ADR, and BE-then-reset-trail. Pure reset
  trail is not viable for COT in this current window; it expands drawdown and
  loses too much edge. BE-then-reset-trail is mechanically viable but gives
  away much of the week-close rescue. Pure BE remains the leader.
- Updated current-window leaders after BE sizing: COT fixed `15` ADR basket SL
  + `25%` runner BE is `+118.27` ADR / `-17.21` DD / `6.87` R/DD / `+17.41`
  week-close ADR. Dealer/Commercial fixed `0.70` ADR pair SL + `25%` runner BE
  is `+71.28` ADR / `-6.96` DD / `10.24` R/DD / `+35.24` week-close ADR.
- Gate 40 completion decision: candidate rows for Gate 41 are pure BE runners
  at `20%` and `25%` on the fixed hardening rows. Basket TP, pure reset-point
  trailing, BE-then-reset trailing, and broad trailing-stop matrices are frozen
  unless Freedom explicitly reopens them.
- Gate 41 first recommended slice: clean pre-shutdown 2025, displayed weeks
  `2025-01-06` through `2025-09-29`. Exclude shutdown-affected source report
  dates `2025-09-30` through `2025-12-23`; do not score displayed weeks
  `2025-10-06` through `2025-12-30` as clean live source truth.
- Gate 41 clean-2025 kickstart result: `39` unique latest receipts were
  selected from the generated clean-2025 hedged ADR Grid set. The mechanical
  grid receipts have `28` pair summaries per week, `22,246` total grid trades,
  `112` path points per week, no missing symbols, and no default ADR symbols.
  Four duplicate generated weeks exist (`2025-07-14`, `2025-07-21`,
  `2025-07-28`, `2025-08-04`); duplicates were not deleted, and the latest
  receipt per week was selected.
- Gate 41 source blocker: both candidate runs returned zero selected pair
  sides and `+0.00` ADR, not because paths were missing but because the
  candidate rows require Friday frozen Strength. Local DB coverage starts at
  `2026-01-19` for `currency_strength_snapshots` and
  `asset_strength_snapshots`, while `strength_weekly_snapshots` starts at
  `2026-01-19` and `source_freeze_ledger_weeks` starts at `2026-02-23`.
  `cot_snapshots` for FX FutOnly cover back to `2019-01-08`, so COT coverage is
  not the immediate blocker.
- Gate 41 diagnostic receipt:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-191355.md`.
  On `2025-01-06`, the COT base row excluded all `28` pairs for
  `missing_friday_strength`; Dealer/Commercial excluded `17` pairs for
  `missing_friday_strength` and `11` for `dealer_commercial_disagree`.
- Current Gate 41 decision: clean 2025 cannot validate or falsify the Gate 40
  candidate rows until historical Friday Strength/frozen-source coverage is
  reconstructed or Freedom explicitly changes the test definition. Do not call
  the all-zero 2025 result a strategy pass or fail.
- Gate 42 next read: the research scripts share source/data primitives with
  the app, but the newer hedged 28-pair ADR Grid runner remains research-only.
  Do not pretend the research engine and app runtime engine are fully unified
  yet. The promotion path is: make the local research kernel fast and
  reproducible, then later move a winning candidate into a shared runtime
  boundary with parity tests.
- Gate 42 speed target: profile first, then split the local research pipeline
  into data-prep/cache, source-context cache, numeric simulation kernel, and
  output/report layer. Use vectorized/matrix-style preprocessing for bars,
  source masks, ADR values, and candidate filters; reserve event-driven logic
  for stateful order execution. Avoid heavy object allocation in tight loops,
  avoid repeated JSON parsing/path rebuilding per variant, and calculate global
  metrics lazily at the end.
- Gate 42 execution-data target: current hedged ADR Grid research uses
  confirmed `1h` bars and guardrails to avoid overstating intrabar precision.
  The repo can load/save `1m` Oanda bars, and canonical price bars were intended
  to support alternate resolutions/providers. Verify that coverage and adapter
  boundary, then move ADR Grid research execution toward `1m` bars with cached,
  prealigned arrays. Retire the `1h` overstatement guardrails only after the
  `1m` path has parity/smoke receipts.
- Gate 42 smoke target after `1m` migration: current-2026 closed weeks only,
  one COT candidate row and one Dealer/Commercial candidate row, no source
  definition changes, and a receipt reporting runtime, selected pair sides,
  trade count, total ADR, worst path DD, week-close ADR, and missing `1m`
  coverage.
- Gate 42 repo classification/staging pass is complete for the selected durable
  set: Gate 36-42 research scripts/docs, selected Gate 40/41 side-selector
  receipts, `package.json`, and shared source-context speed helpers. Pine
  verifier changes, release screenshots, `$1`, bulk reports, local profile
  outputs, and release canon remain unstaged.
- Gate 42 profiling found source context, not numeric simulation, as the slow
  path. The first 39-week COT profile spent about `287.8s` in
  `source_context_build`; after source-context need selection it was still
  about `273.9s`. A shared Strength lookback batch read then cut the one-week
  mixed COT plus Dealer/Commercial smoke from about `4.6s` source-context time
  to about `1.6s` with unchanged summary results.
- Gate 42 `1h` exporter smoke for `2026-06-08` passed: 28 pairs, 56 engines,
  579 fills, `+81.4034` final ADR, `-17.4714` max drawdown. The same `1m`
  smoke ran cleanly but produced zero engines/fills, confirming the adapter path
  is wired but stored M1 coverage/materialization is still missing.
- Gate 42 M1 materialization path now reuses the existing canonical hourly
  backfill/coverage owner with `--timeframe=1m`; default behavior remains `1h`
  for existing callers. Read-only EURUSD coverage for `2026-06-08` showed
  stored M1 missing at `0/7200`; dry-run Oanda fetch returned `7159` complete M1
  bars and wrote `0` DB rows. The write path now batches canonical bar upserts
  through the existing owner instead of writing one row per DB call.
- Gate 42 M1 smoke materialization is complete for displayed week
  `2026-06-08`: EURUSD wrote `7159` M1 bars and read back complete at `99.43%`;
  gap-only all-FX materialization wrote the other `27` FX pairs with `192619`
  M1 bars, 28/28 complete coverage, and lowest coverage `95.24%`.
- Gate 42 `1m` exporter smoke now passes after materialization: 28 pairs,
  56 engines, 611 fills, `+87.8034` final ADR, `-21.3196` max drawdown.
  One-week `1m` COT and Dealer/Commercial side-selector smokes also passed on
  the candidate families.
- Gate 42 path-cache consolidation has started in the existing app performance
  owner: `app/src/lib/performance/pathBarLoader.ts` now builds prealigned
  timelines/mark lookups, and both the FX hedged exporter and side-selector
  audit consume it. A follow-up direct timeline loader trims the M1 DB payload
  to close/high/low/price rows and avoids a script-local mark-lookup build.
  Direct timeline smokes preserved the same `1m` outputs; single COT and
  Dealer/Commercial reruns put `canonical_bar_load` around `2.6s` to `3.0s`.
  A variant path cache then cut repeated marked-path rebuilding across four
  current-week rows: COT `pair_stop_path_build` dropped from about `4.4s` to
  about `1.5s`, and Dealer/Commercial dropped from about `0.8s` to about
  `0.6s`. Parallel DB runs are still noisy, so broad M1 sweeps need the next
  layer: reusable week-level numeric arrays/source masks, not another local
  receipt parser.
- Gate 42 indexed-trade matrix pass now binds each trade once to entry/exit
  milliseconds, size, and the shared M1 mark-price series. Results stayed
  unchanged on the one-week current smoke. COT path rebuilding dropped from
  seconds to about `0.2s` and runner simulation to about `0.5s`; Dealer/
  Commercial path rebuilding dropped to about `0.07s` and runner simulation to
  about `0.02s`. The remaining smoke bottlenecks are now `canonical_bar_load`
  and source-context reads, not marked-path reconstruction.
- Gate 42 close-only mark matrix now separates side-selector mark-price reads
  from high/low path-bar timelines. Side-selector M1 smokes still preserve the
  exact rows, while `canonical_bar_load` fell to about `1.9s` for COT and
  about `2.2s` for Dealer/Commercial in sequential one-week profiles. The
  shared canonical basket source now also has a short runtime cache so mixed
  COT/app-source contexts can reuse the same week result inside one process.
- Gate 42 prepared-week pass added bounded week-list preparation to the
  side-selector. Each receipt week is parsed once, source context and M1 mark
  matrix are attached once, then all variants consume that prepared object.
  Preload is bounded by `--week-preload-concurrency` /
  `SIDE_SELECTOR_WEEK_PRELOAD_CONCURRENCY`; source and bars load sequentially
  inside each week to avoid DB connection contention. One-week COT and
  Dealer/Commercial candidate smokes preserved the exact rows.
- Gate 42 source-only pass added `--source-coverage-only` to the existing
  side-selector audit. It reuses the prepared source-context and pair
  qualification path while skipping path-bar loading and numeric simulation.
  The clean-2025 39-week source-only receipt selected `0/1092` rows for both
  exact Gate 40 candidates: COT had `1092` missing Friday Strength rows;
  Dealer/Commercial had `407` missing Friday Strength rows plus source-filter
  exclusions. After model-filtered basket reads, source-only `buildBaseWeek`,
  and pair-filtered canonical Strength, the same audit dropped to about `34s`
  wall time with unchanged blocker counts.
- Gate 43 direction agreed: reconstruct Strength history as a reusable
  historical/continuous Strength context layer, not a Friday-only patch. Friday
  and Sunday confirmation are the first consumers, but future systems may need
  daily recalculation or continuous Strength agreement to keep trades open.
  Current canonical weekly Strength is mostly `1h`/`4h`/`24h` snapshots plus
  prior `1w`/`1m` lookback returns; older scripts sometimes used only
  `4h`/`24h`. The next gate should design storage once around canonical M1
  raw truth, derived Strength snapshots, fast pair-spread lookup, source freeze
  ledgers, and compact arrays/source masks for seven-year sweeps.
- Gate 43 first implementation slice now exists: `strength_history_snapshots`,
  `app/src/lib/strength/historicalStrength.ts`, and
  `app/scripts/verification/export-strength-history-context.ts`. A two-week
  current-2026 M1 slice wrote `27,648` derived FX Strength rows at `15m`
  cadence for `1h`/`4h`/`24h` windows. Prior-Friday and Friday/week-close
  M1-derived directions matched the legacy cutoff resolver `84/84`; Sunday/open
  exposed a source-model conflict because the legacy table contains weekend
  neutral `50/50` rows while the M1 layer falls back to the latest real
  prior-Friday source state.
- Gate 43 runtime follow-up added an explicit weekly Strength decision context:
  `friday_close` uses the latest complete pre-week Friday 17:00 New York source
  state, while `market_open_confirmation` uses the first complete source state
  at or after the FX market-truth open from `getCanonicalWeekWindow(...,
  "fx").openUtc`, separate from the later execution window. The verifier now
  supports `--read-existing-only --weekly-context` so cached source-context
  reads can be profiled separately from M1 derivation. Corrected current
  two-week proof read `27,648` existing snapshot rows in `3.03s`; all-28
  current-week context produced `28/28` Friday directional rows and `28/28`
  market-open directional rows, with market-open rows resolving to
  `2026-06-07T22:15:00Z`. Coverage and directional resolution are separate:
  only zero covered Strength windows should become source-blocked.
- Gate 44 first contract slice added the reusable matrix warehouse contract:
  `database/migrations/028_research_matrix_warehouse.sql`,
  `app/src/lib/research/matrixDataset.ts`, and
  `app/scripts/verification/export-research-matrix-dataset-contract.ts`.
  A 7-year / 28-pair / 64-variant estimate is roughly `10,192` source-context
  rows, `163,072` base trade opportunities, `652,288` pair-decision rows,
  `23,296` variant-week rows, and `10,436,608` trade events. Treat this as an
  indexed-ledger warehouse, not a Markdown/CSV report.
- Gate 42 execution-data decision: `1m` is the shared canonical execution path
  for research and future app engine promotion. Keep `1h` as fallback/debug
  until parity receipts prove the M1 path is stable enough to retire hourly
  guardrails.
- Gate 41 second recommended slice remains 2024 as a separate adversarial
  validation year, but do not run it until the Friday Strength/source-coverage
  decision is made and the local test cycle is materially faster.
- Frozen: no ADR Grid term tuning, costs/margin, pair clustering, sentiment,
  live-strategy promotion, release canon changes, or broad history sweep before
  separated-year receipts are reviewed.

## Next Gates

Recommended next data gates:

1. Continue `Gate 44: reusable-seven-year-matrix-dataset`.
2. Optimize pair-decision persistence and multi-week bar/source preparation
   before separated-year expansion.
3. Only after historical M1 and Strength coverage are proven, materialize clean
   separated historical years and then seven-year strategy sweeps.
6. Focused failure/concentration breakout for top Dealer/Commercial rows,
   especially `2026-01-19`, JPY/NZD/USD concentration, and Friday-snapshot
   coverage gaps.
7. If Freedom approves, run the two graduated definitions backward with COT at
   `15` ADR basket SL and Dealer/Commercial at `0.70` ADR pair inventory SL.
8. Keep ADR Grid parameter tuning and live promotion frozen until source-side
   and basket-SL evidence survive a stronger validation window.

## Repo Size / Consolidation WIP

Baseline captured 2026-06-12 with `git ls-files`:

- tracked repo files: 2150
- tracked `app/` files: 1844
- tracked `app/src/` files: 681
- tracked `docs/` files: 81
- tracked `app/releases/` files: 399
- `app/src` split: `lib` 353, `components` 172, `app` 153

Use this as a working metric. As gates touch an area, classify stale files and
prefer consolidation/archive over adding more owners. New files are acceptable
only when they simplify ownership enough to retire older paths.

## Active Context

- Version UI should use `liveVersion` and `devVersion` only.
- Current live version is `v2.0.5`.
- `pendingRelease` must not be runtime UI truth or visible as a separate
  runtime state.
- Documents/release docs should use one simple structure across versions.
- Version popover should be compact: live is the current public version; dev is
  the new working version.
- Freedom approved Gate 28 visuals as good enough for v2.0.4 packaging. Runtime
  truth remains split into `liveVersion` and `devVersion`; both are `v2.0.4` at
  the promotion boundary until Gate 29 names the next dev version.
- Data page baseline copy should be derived from data/config, not hardcoded or
  release-branded.
- Weekly Hold manual checks mostly matched the indicator, but the repo still
  needs its own reproducible proof path.
- ADR Grid is the major app-vs-indicator blocker: fills, TP counts, returns,
  drawdowns, basket counts, and recent-vs-stored week behavior need audit.
- Strategy work is three layers: baseline/data direction, ADR Grid execution,
  and risk management.
- Do not optimize trading logic until current numbers are trusted.

## Gate 31 Notes

- Current-week Weekly Hold portfolio rows now expand and collapse instead of
  being forced open for signal-only direction rows.
- Stored Weekly Hold single-trade symbols flatten to one row, e.g.
  `Commercial > AUDCAD`, with direction, asset class, trade count, W/L, source,
  and P/L in the header.
- Stored ADR Grid symbol/grid headers now show direction and source/sleeve in
  the header.
- Basket focused/dimmed state resets when week, scope, strategy, or view mode
  changes.
- Browser proof on port 3000 covered current-week collapse, stored Weekly Hold
  flattening, week-switch focus reset, and ADR Grid header identity.
- Validation passed: TypeScript, focused basket/ledger tests, `npm run build`,
  and `git diff --check`.
- Pushed as part of `831a99f Gate 30-32: finalize v2.0.5 readiness`.
- No `app/releases/v2/canon/*.json` files changed.

## Gate 32 Notes

- Performance repeat visits now reuse the existing persistent strategy kernel
  payload cache when metadata matches.
- Client router cache stale time now follows the hourly cron cadence instead of
  expiring after a short idle window.
- Performance keeps warmed Summary, Simulation, and Basket sections mounted so
  tab switches do not remount the heavy chart/Basket trees.
- Browser speed receipt:
  `app/releases/v2/screenshots/performance-data-correctness-2026-06-12/gate32-performance-speed-evidence.json`.
  It showed initial Performance hydration hit `strategy-kernel-payload`, repeat
  Performance after Data avoided it, and warmed Summary/Simulation/Basket tab
  switches were sub-second in headless verification.
- v2 release docs now use `manifest.json`/`release-manifest.json` as current
  version truth and record v2.0.5 as cumulative Gates 29-32 readiness.
- Added visible release screenshots for Jun 15 Weekly Hold current directions
  and Jun 01 flattened Weekly Hold drilldown under the existing v2.0.5 evidence
  folder.
- Validation passed: TypeScript, focused basket/ledger/release tests,
  `npm run build`, and `git diff --check`.
- Pushed as part of `831a99f Gate 30-32: finalize v2.0.5 readiness`.
- No `app/releases/v2/canon/*.json` files changed.

## Gate 30-32 Result

Pushed as v2.0.5 readiness completion:

- Commit: `831a99f Gate 30-32: finalize v2.0.5 readiness`
- Remote: `origin/main`
- Scope: Friday rollover/source readiness, Basket expansion parity,
  Performance speed/cache, release docs truth, and evidence receipts.
- Verification before push: `git diff --check`, `git diff --cached --check`,
  `npx tsc --noEmit --project app/tsconfig.json --pretty false`, focused
  basket/ledger/release Vitest suite, `npm run build`, browser speed receipt,
  and screenshot evidence.
- No `app/releases/v2/canon/*.json` files changed.

## Gate 29 Notes

- Current-week Summary card shading is visually accepted.
- Basket behavior is visually consistent across current and previous weeks.
- Jun 08, Jun 01, and May 25 Basket views show 144 total grids and 36 grids per
  portfolio after the selected trade-row path was shared.
- Stored-week Simulation now shows Equity and Balance. The shared
  `EquityCurveChart` should not render Total/Equity as white in light mode.
- No-fill current-week grids still show `P/L 0.00%`; changing that is strategy
  math and belongs in ADR Grid indicator parity.
- `/api/system/mode` can report normal/fresh COT while the missing warning
  banner leaves the user unsure whether new data has arrived. Rollover/status
  should show source freshness clearly without reviving "sentiment-only" copy.
- Dealer/Commercial COT may be fresh while Sentiment/Strength update later.
  Rollover logic should distinguish partial source readiness instead of making
  the app feel blocked on every source.

## Gate 29 Result

Packaged as `v2.0.5`:

- Runtime manifests now use `liveVersion: v2.0.5` and
  `cacheNamespace: v2.0.5-gate29-performance-data-correctness`.
- Current, stored, and all-time Basket views share the selected trade-row
  hierarchy.
- Planned ADR grid rows are present for Basket count parity without counting as
  fills or changing P/L.
- Stored-week Simulation keeps Equity, Balance, and Total path visibility.
- Summary portfolio cards shade from signed return across current and stored
  weeks.
- The stale COT banner copy no longer exposes old sentiment-only mode language.
- Equity/Total chart colours are theme-safe in light and dark mode.
- Release evidence lives under
  `app/releases/v2/screenshots/performance-data-correctness-2026-06-12/`.
- No `app/releases/v2/canon/*.json` files were changed.

Next chat should not reopen Gate 29 unless Freedom explicitly asks. Gate 30 is
the active Friday rollover/source-readiness review.

## Gate 28 Result

Corrective pass was committed and pushed:

- Commit: `4651a37 Gate 28: finalize v2.0.4 readiness`
- Remote: `origin/main`
- Full SHA: `4651a37f9e1020c3ed36c94f5d8addf012ccba49`

- Version popover is active-runtime only in dev and does not show the public
  live version in the dev popover.
- Documents use one version rail plus one tab skeleton for v1 and v2.
- Documents navigation uses app-native `Link` navigation instead of raw anchors.
- Long History/Documents content scrolls inside the selected panel while the
  page itself does not become a long scroll.
- Changelog/history entries are sorted newest-to-oldest.
- Documents discover screenshots under each release's `screenshots/` folder and
  use manifest descriptions only as optional metadata.
- Evidence screenshots open into an enlarged overlay with close and previous/next
  controls inside the selected screenshot group.
- The custom loading-bar keyframe added in the failed pass was removed. Route
  loading screens now use the existing shared `LimniLoading` owner with one
  width-transition progress bar.
- Route loading labels are no longer set in individual route `loading.tsx`
  files. They derive from `DashboardLayout`'s canonical navigation table, with a
  route-name fallback for non-canonical pages.
- The shared loader checks runtime version once per session/cache when needed,
  then shows `Loading Limni v2.0.4...`; later page switches show route labels
  like `Loading Data...` and `Loading Documents...`.
- Data dashboard filters were trimmed back to controls only: no visible Bias,
  active-baseline, trading-week provenance, Friday-freeze/COT, or Asset Class
  labels in the filter block.
- Sentiment summary cards now use the same centered `SummaryCards` sizing path
  as Dealer/Commercial/Strength.
- App Truth route readiness no longer renders a visible page blocker on Data or
  Performance. It stays as route metadata, and local missing-DB readiness errors
  fail open to the app content.
- Dashboard COT history loading now fails open to an empty history when the
  local database is unavailable instead of throwing the Data page.
- Login now falls back to the repo-root auth username/password env keys when the
  Next dev server is launched with `next dev app`; the fallback is limited to
  `AUTH_USERNAME` and `AUTH_PASSWORD` and does not load root `AUTH_BYPASS`.
- Root layout no longer shows a generic `Loading page...` fallback before
  route-specific loading screens.
- Added one release note: `app/releases/v2/patches/v2.0.4.md`.
- No release canon regeneration.
- Final proof run: `git diff --check`, TypeScript project check, focused
  release/canon tests, `npm run build`, version API smoke, and fresh-login
  Playwright smoke for Data, Performance, Documents, and Status.
- Broader Playwright route sweep before packaging checked 32 app routes. Dynamic
  account detail routes were skipped because no connected account records were
  present.

Still not solved as a full release-process system:

- There is no general release screenshot capture automation script yet. Current
  Documents rendering is automatic from release folders, but capture itself is a
  separate release-process gate.
