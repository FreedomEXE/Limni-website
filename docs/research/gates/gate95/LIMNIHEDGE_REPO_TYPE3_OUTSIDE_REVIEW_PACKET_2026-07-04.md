# LimniHedge Repo Type 3 Outside Review Packet

Date: 2026-07-04

Status: ready for outside review

## Objective

We have moved the LimniHedge Type 3 research lane out of MT5 and into the repo
engine. The immediate goal is now to find a consistently profitable Type
3-derived system across the full 28-pair universe, using repo-verifiable
evidence before any future MT5 or live work.

The outside reviewer should critique the evidence so far and recommend the next
bounded research plan.

## Current Repo State

- Repo: `C:/Users/User/Documents/GitHub/limni-website`
- Branch: `codex/gate88-mt5-lifecycle-protection-controls`
- Latest pushed base before this packet: `f9f8d22d`
- Current lane: LimniHedge Type 3 repo parity and movement-candle diagnostics
- Current principle: no more MT5-first research. MT5 is now reference/parity
  evidence only; discovery should happen in the repo.

## Critical Boundary

Do not recommend mutating `automation/mt5/Experts/LimniHedge_V1.mq5` as the
next step.

The EA is the legacy reference implementation. The repo now has enough parity
surface to test Type 3 behavior without using MT5 as the research driver.

Frozen unless explicitly reopened:

- MT5 EA re-engineering
- live MT5 trading
- broad MT5 optimization
- LRMG/zero-line direction promotion
- Katarakti-lite integration
- new trailing/lifecycle changes before repo evidence
- app/live promotion

## Evidence So Far

### Gate 92: LimniHedge Legacy Parity

Report:
`docs/research/gates/gate92/GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_2026-07-04.md`

Command:

```powershell
npm run engine:gate92:limnihedge-legacy-parity
```

Verdict:
`PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY`

Validation failures: `0`

Gate 92 parsed Freedom's saved MT5 reports, rebuilt the legacy entry-shape
replica, and matched the saved MT5 entry stream.

Parsed saved-report surface:

| case | entries | net | PF | terminal liquidations |
|---|---:|---:|---:|---:|
| AUDCAD Type1+Type3 primary | 1432 | 5039.46 | 5.15 | 16 |
| AUDCAD Type3 MA-changed primary | 260 | 5140.60 | 15.78 | 2 |
| AUDJPY Type3 primary | 1518 | 11965.24 | 39.57 | 11 |
| AUDCHF Type3 secondary | 386 | 3260.96 | 10.16 | 36 |
| AUDCAD discovered Type3 | 260 | 1333.04 | 12.39 | 11 |

Gate 92 result:

- Entry parity: `5/5`
- Lifecycle count parity: `5/5`
- Accounting shape parity: `5/5`
- Yearly closed split shape: no failing rows
- Replica PnL exits: `3856`
- Type 3 rows available for downstream diagnostics: `3826`

Caveat:

Accounting carries MT5 saved-report swap as observed broker accounting
passthrough. This is behavioral/report-shape parity, not independent historical
swap modelling.

### Gate 93: H1 Triangle Overlay

Report:
`docs/research/gates/gate93/GATE93_LIMNIHEDGE_TRIANGLE_OVERLAY_DIAGNOSTIC_2026-07-04.md`

Command:

```powershell
npm run engine:gate93:limnihedge-triangle-overlay
```

Verdict:
`PASS_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_NO_KEEPER_NO_PROMOTION`

Validation failures: `0`

Question tested:

If Gate 91 Triangle-style geometry is measured on broker H1 candles around each
verified LimniHedge entry, does it identify a cleaner Type 3 subset?

Aggregate baseline:

- Entries: `3856`
- Net: `$26739.30`
- PF: `12.396126`
- Terminal liquidations: `76`

Key H1 overlay results:

| overlay | accepted | net | PF | terminals kept | terminals removed |
|---|---:|---:|---:|---:|---:|
| Center reversion side | 606 | 4862.51 | 33.744175 | 6 | 70 |
| Triangle v1 directionless | 68 | 515.73 | 235.422727 | 0 | 76 |
| Triangle v2 geometry | 254 | 2078.46 | 945.754545 | 0 | 76 |
| Triangle v2.1 floorpin/surplus | 243 | 2001.75 | 910.886364 | 0 | 76 |

Read:

H1 Triangle overlays remove terminal-risk clusters but are too restrictive as
hard entry filters. They are evidence for risk scoring, not an entry
replacement.

### Gate 94: Movement-Candle Type 3 Diagnostic

Report:
`docs/research/gates/gate94/GATE94_LIMNIHEDGE_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_2026-07-04.md`

Command:

```powershell
npm run engine:gate94:limnihedge-type3-movement-candles
```

Verdict:
`PASS_GATE94_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_NO_PROMOTION`

Validation failures: `0`

Question tested:

Do saved Type 3 entries still look like Type 3 entries when projected onto our
custom ADR movement candles instead of time candles?

Source:

- Gate 92 saved Type 3 outcomes
- Gate 74B canonical M1-derived directed-ADR warehouse
- Price bundle:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- H1 bars used for movement-candle classification: `0`

Movement surfaces:

- `0.025 ADR`
- `0.05 ADR`
- `0.075 ADR`
- `0.10 ADR`

Covered Type 3 baseline:

- Type 3 rows: `3826`
- Covered baseline net: `$25613.45`
- Baseline PF: `18.228855`
- Baseline terminal liquidations: `51`

Exact movement-candle Type 3 hard-match results:

| movement surface | exact matches | exact pct | net | PF | terminals kept | terminals removed |
|---|---:|---:|---:|---:|---:|---:|
| 0.025 ADR | 93 | 2.641295% | 774.67 | 21.499338 | 2 | 49 |
| 0.05 ADR | 98 | 2.783300% | 746.14 | 319.863248 | 0 | 51 |
| 0.075 ADR | 103 | 2.925305% | 804.57 | 53.655105 | 1 | 50 |
| 0.10 ADR | 157 | 4.458961% | 898.35 | null/no losses | 0 | 51 |

Read:

Movement candles do identify terminal-risk clusters. But exact movement-candle
Type 3 hard matches keep only about `2.6%` to `4.5%` of covered Type 3 entries
and destroy too much harvest. This is not a hard entry replacement.

Potential signal:

- Movement-candle buckets may be useful as risk overlays.
- Hard exact Type 3 matching is too sparse.
- The next valid step is a full movement-candle Type 3 replay, not another
  projection, if the reviewer thinks the structure is worth pursuing.

## Prior Triangle / Grid Context

Gate 90 and Gate 91 explored ADR-event clocks, Triangle grid geometry,
formulaic Q, floor-pin/surplus geometry, add throttles, and lifecycle protection
ideas.

Relevant context for reviewer:

- ADR-event movement bars already exist in the repo research runner.
- Gate 91 floor-pin/surplus improved exposure shape but did not become a
  standalone keeper.
- Gate 91F showed pure add-throttle tuning was near its standalone ceiling.
- Candidate B exists as a locked directional bias source from prior gates and
  should be tested as an input, not redesigned in this review.
- The current Type 3 work is not trying to promote the old Triangle grid. It is
  asking whether Type 3 plus movement candles plus direction can produce a
  consistent 28-pair system.

## Current Hypotheses

1. Legacy Type 3 works because it harvests stale David regime state plus
   counter-displacement.
2. Its disease is unresolved inventory: long holds, terminal liquidations, and
   hidden open-risk concentration.
3. Movement candles can detect some terminal-risk structure, but exact
   movement-candle Type 3 matching is too sparse.
4. Candidate B may improve the direction side if used as a bias overlay rather
   than as a broad redesign.
5. A no-direction/both-side baseline is mandatory so we can tell whether any
   directional bias is adding value.

## Proposed Next Research Goal

Find a consistently profitable Type 3-derived system in the repo engine.

The next phase should test all `28` pairs with:

- legacy Type 3 behavior as the parity baseline
- movement-candle Type 3 variants
- Candidate B directional bias
- no-direction / both-side activation
- movement-candle risk buckets
- yearly and OOS stability
- terminal/open-inventory risk

## Requested Outside Review

Please review the evidence above and answer these questions.

1. Is Gate 92 parity sufficient to stop using MT5 as the research driver for
   Type 3 discovery?
2. Are Gate 93 and Gate 94 enough to reject hard Triangle/movement-candle
   filters as direct entry replacements?
3. Should movement candles be tested next as:
   - the primary Type 3 candle stream,
   - a risk/protection overlay,
   - a direction/quality score,
   - or discarded for now?
4. What is the smallest high-signal 28-pair test matrix that can answer whether
   Type 3 can become consistently profitable?
5. How should Candidate B be tested:
   - follow Candidate B side only,
   - fade Candidate B side,
   - allow Type 3 only when Candidate B agrees,
   - allow both sides but size/filter by Candidate B,
   - or use Candidate B only as reporting context?
6. What is the correct no-direction control:
   - both-side Type 3,
   - raw Type 3 per pair,
   - separate long-only / short-only legs,
   - or another baseline?
7. What metrics should be promotion-blocking?
   Suggested minimum: yearly net, PF, max equity DD, balance DD, terminal count,
   open inventory, average/max hold, pair concentration, trade count, return/DD,
   OOS pass rate, and swap/commission drag.
8. What is the right first pass over movement candles:
   - fixed ADR bricks (`0.025`, `0.05`, `0.075`, `0.10`),
   - formulaic Q / LRMG radius,
   - ATR-style adaptive candles,
   - or a two-stage sweep?
9. Should the next replay preserve legacy trailing/stop semantics exactly, or
   profile Type 3 entries first without lifecycle changes?
10. What failure conditions should stop the next phase early?

## Proposed Review Output Format

Please return:

1. A concise verdict on the current evidence.
2. The highest-risk assumptions or mistakes in the current framing.
3. A recommended next-gate test matrix with exact variants.
4. The minimal artifacts/receipts that must be emitted.
5. Promotion and rejection criteria.
6. Any alternate hypothesis that should be tested before broad 28-pair work.

## Candidate Next Gate

Suggested slug:
`Gate 95: limnihedge-type3-28pair-repo-discovery`

Suggested first-pass matrix:

- Universe: all `28` Gate 74B pairs.
- Date surface: Gate 74B canonical M1 warehouse first, with explicit coverage
  report.
- Baselines:
  - legacy Type 3 time/H1 reference where available
  - repo Type 3 both-side/no-direction
  - repo Type 3 Candidate B-follow
  - repo Type 3 Candidate B-fade
  - repo Type 3 Candidate B-agreement-only
- Candle surfaces:
  - time/reference where needed for parity
  - fixed ADR movement candles: `0.025`, `0.05`, `0.075`, `0.10`
  - formulaic Q / LRMG radius only if reviewer agrees it belongs in first pass
- Risk read:
  - no hard filter first
  - classify movement buckets and terminal-risk buckets
  - test hard filters only after bucket evidence shows retained harvest

## Hard Stop

Do not proceed to broad optimization or MT5 mutation until the outside review is
read and converted into a bounded Gate 95 plan.
