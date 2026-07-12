# Gate 108 Phase 4R - Institutional Foundation Hardening

Date: 2026-07-10
Scope: adversarial source-integrity repair before R/Engine activation
Runtime authority: none; Freedom retains every MT5 runtime test

## Decision boundary

Phase 4R is a source/static checkpoint. It repairs defects that could compile
cleanly while corrupting Gate 108 research evidence. It does not activate the R
execution envelope, schedule discovery from Engine, synchronize a terminal
copy, execute MT5, prove mechanics, speed, parity or economics, accept Gate
108A, or make a promotion, live-readiness or funding claim.

Requested outside-review decision:

```text
GATE108_PHASE4R_ACCEPTED_FOR_PHASE5
```

Acceptance would authorize only the explicitly blocked Phase 5 integration
work below. It would not authorize runtime testing by Codex.

## Code-impact map

| Area | Source ownership | Phase 4R effect |
| --- | --- | --- |
| Capital and formula identity | `RevmaDiscoveryTypes.mqh` | Freezes `CapitalBudgetFraction = 1/10 = 0.10`, source bundle, schema v12, cycle identity and evidence semantics in the profile/formula identity |
| Compiled source identity | `BuildInfo.mqh`, `Config.mqh`, `Test-Gate108SourceBundle.ps1` | Removes operator source-revision authority and binds the canonical local include closure at compile time |
| U/C aggregate books | `RevmaShadowPortfolio.mqh` | Checked reservation, projected equity/margin, branch-local post-divergence allocation, add classification, close/re-entry and terminal internal state |
| C signed-center authority | `RevmaCenterSupportPolicy.mqh` | Recomputed C-only policy, frozen birth support, permanent adverse-add latch and no inventory mutation |
| Path arithmetic | `RevmaPathGeometry.mqh` | Tick-quantized mesh plus checked path, reversal, frontier and jump arithmetic |
| Dedicated evidence | `RevmaDiscoveryTelemetry.mqh` | Fixed buffered v12 transition/summary/manifest artifacts, candidate sealing, lifecycle linkage, failure lineage and checked rollups |
| Fatal propagation | `IntentBus.mqh`, `Engine.mqh`, guard/sleeve/registry call sites | Resource or invariant failure is fatal rather than silently becoming an ordinary no-intent result |
| Build entrypoint | `LimniPortfolioEA.mq5`, `BuildInfo.mqh` | Build identity `0.1.29-gate108-phase4r-institutional-foundation` / `1.029` with the sealed source bundle |

## Institutional invariant table

| Invariant | Enforcement | Failure boundary |
| --- | --- | --- |
| Capital authority is exactly 10% | Compile-frozen numerator `1`, denominator `10`, decimal `0.10`; each branch cycle freezes `E_ref` and checked minor-unit `B` | Discovery/shadow initialization or later book/telemetry validation fails |
| Source identity is immutable | Strict UTF-8/LF canonical 54-file local include closure, ordinal paths and normalized BuildInfo self field | Verifier mismatch blocks compilation evidence |
| Completed-M1 cadence is explicit | Every source-M1 time is positive, exactly 60-second aligned and strictly ordered where required | Transition/book invalidates |
| Shadows have no broker authority | U/C contain no router, order, position, ticket, history, account or broker-call dependency | Static review fails |
| Fixed shadow topology | One U and one C grid slot per canonical FX28 symbol; depth is arithmetic and count-uncapped | Resource/count overflow invalidates; depth is never silently capped |
| Deterministic admission | Build all, reservation-first sort, canonical symbol/identity tie-break, allocate, then commit | Order, identity or replay disagreement invalidates |
| Branch independence after divergence | Post-divergence validation and allocation seal only the selected U or C branch | Cross-branch dependency or invalid branch argument fails closed |
| Harvest precedes adds | Every active grid proves same-M1 mark and local-harvest evaluation before batch admission begins | Skipped eligible harvest invalidates the branch |
| Add type is formula-owned | Decision price is tick-compared with executed-entry extrema plus the frozen cell; stress, decision and fill prices are distinct and snapshot-hashed | Missing threshold or adverse/favorable misclassification invalidates |
| C policy cannot be caller-forged | Book recomputes the full center-support state, flags and reason; latched C adverse adds can only emit the canonical blocked outcome | Branch/telemetry invalidates on mismatch |
| One terminal candidate decision | One branch/grid/completed-M1 candidate may admit, reject or C-block exactly once | Contradictory or duplicate decision invalidates |
| R rejection stages stay separate | Canonical pre-route capacity/two-atom rejection is valid evidence; post-route broker/no-money rejection remains formula-invalid | Phase 5 must bind the actual router stage; failure cannot be relabelled as capacity |
| Exact current/prospective grid money | Checked multiplication proves R two-atom reservation, U/C `max(2, atoms)` reservation, q-cash, prospective reservation/q-cash, frozen A-g and overrun | Row or lifecycle disagreement invalidates |
| U/C first divergence is narrow | U admits and C blocks the same adverse candidate under an applicable permanent latch | Reverse or unrelated mismatch invalidates both branches |
| Infeasibility lineage is writer-owned | Canonical rejection is committed first; the one-shot marker must match its complete identity; first/latest values flow unchanged through aggregate summaries | Missing or mismatched linkage invalidates |
| Origin reason is immutable | Grid origin terminal reason is separate from event reason and active close owner | Grid summary/terminal reconciliation fails on overwrite |
| Cycle identity cannot be reused | Branch and account cycle IDs start at `1`, advance exactly `+1`, and require a flat, summarized, reconciled prior cycle | Reuse, skip, overflow or premature restart invalidates |
| Summary integrity is transitive | Cycle latches shortfall, contamination, formula and reconciliation state; reconciliation/run must match exactly | Summary append or finalization fails |
| Output cannot silently truncate | Header-seeded chains, fixed buffers, guarded lines, batched writes, row/byte/file/hash checks and two-phase manifest | Affected run invalidates |

## Repaired high-risk defects

- Admission now projects immediate after-cost liability into branch equity before
  cumulative margin is compared, and commit independently replays the result.
- Modeled margin insolvency invalidates the branch without inventing a new
  hard-risk liquidation authority.
- Caller-supplied C policy can no longer admit a permanently latched adverse
  add; favorable candidates remain eligible but must link to one exact decision.
- Local harvest evaluation is proven before allocation inside the book rather
  than being trusted to future Engine call order.
- U/C allocation no longer requires both batches after an authorized
  divergence; the selected branch owns its capacity, cleanup, risk and re-entry.
- Decision, stress-reference and fill prices are separately bound, and add
  classification is recomputed from frozen geometry.
- R, U and C candidate outcomes are sealed per completed M1. A rejected birth
  can record first infeasibility without creating a fake lifecycle.
- `E_ref`, `B`, branch cycle ID and account cycle ID are frozen and propagated
  through transitions and summaries; `A -> B -> A` reuse is rejected.
- Current and prospective q-cash/reservation are distinct. Per-grid arithmetic
  cannot be hidden by equal-and-opposite portfolio totals.
- Grid origin reason survives cleanup-to-risk ownership escalation.
- Transition and summary hash chains begin from their exact header strings;
  same-length header corruption is no longer outside the chain boundary.

## Static and compile evidence

- Source-bundle algorithm:
  `sha256-canonical-local-include-closure-v1`.
- Source-bundle identity:
  `sha256:985e930f89dfce55c88a026db42725210f6b189ef98c2d147bd77975babd2516`.
- Bundle verifier: `status=MATCH` before and after final compilation.
- Active repo-local compile closure: `54` files.
- External compiler-library boundary: `Trade/Trade.mqh` only.
- Telemetry schema: `gate108-discovery-telemetry-v12`.
- Transition header/serializer: `133 / 133`.
- Summary header/serializer: `88 / 88`.
- Completion manifest: `35` fields.
- Shadow broker/router/order/position/history/account dependency scan: clean.
- Independent shadow static audit: pass.
- Independent telemetry static audit:
  `GATE108_PHASE4R_TELEMETRY_STATIC_PASS`.
- Independent identity audit:
  `GATE108_PHASE4R_IDENTITY_SEAL_STATIC_PASS`.
- Final sealed repository compile: `0 errors, 0 warnings, 198399 ms`.
- Final EX5: `635728` bytes,
  SHA-256 `7eac521d8fcc52d200abd59dc1ae459b7215f2ed1f53a8c0d5f5fb977e306b06`.
- `git diff --check`: pass; line-ending conversion notices only.

The detailed receipt is under
`artifacts/gate108-phase4r-repo-compile-20260710/`.
All compile attempts before attempt 17 are explicitly superseded.

## Deliberate Phase 5 pre-activation blockers

These are not deferred cleanup. Discovery must remain dormant until they are
implemented and statically reviewed:

1. Engine must construct one immutable completed-M1 signal snapshot and the
   book/telemetry must recompute or otherwise prove its exact signal identity.
2. A source-hashed deterministic valuation contract must own `A_g_candidate`,
   `A_g`, margin, immediate liquidation and close costs, including method/input
   provenance. Internally conserved caller numbers are not economic proof.
3. R must bind pre-route versus post-route state, enforce the one-birth/one-add
   `0.02` maximum, and route only through the existing real execution authority.
4. Terminal telemetry payload must be canonically equivalent to the internal
   grid state whose hash is committed. Dual hashes alone are not equivalence.
5. True concurrent portfolio peak liability, margin and concentration must be
   tracked and terminal-book-bound. Current concentration telemetry is
   deliberately fail-closed at zero; max-child fields are not claimed as
   simultaneous portfolio peaks.
6. Positive-liquidation-opportunity and run-global versus cycle-local summary
   scopes must be finalized before offline inventory claims.
7. Engine scheduling must preserve one shared observation, build-all ordering,
   one add per grid per completed M1, branch independence and buffered-only
   output.
8. The active Gate 108 profile/default must be compile-frozen. Legacy operator
   defaults intentionally fail discovery validation and must not be repaired by
   a manual `.set` ladder or weakened validation.

## Stop line

No terminal-copy synchronization, terminal-owned compile, Strategy Tester,
smoke/shard runner, benchmark, optimization, parameter ladder or backtest
automation occurred. No runtime, speed, parity, reconciliation, economic,
Gate 108A, promotion, live-readiness or funding claim is made.

Push and clean this source-sealed checkpoint for outside review. R/Engine
activation remains closed until the review accepts Phase 4R and the Phase 5
blockers are implemented.
