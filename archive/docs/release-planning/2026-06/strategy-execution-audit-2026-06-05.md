# Strategy Execution Audit - 2026-06-05

Audit against `strategy-execution-spec.md`, followed by the first surgical implementation pass.

## Scope

- App strategy engine: `src/lib/performance/weeklyHoldEngine.ts`
- Shared execution windows: `src/lib/executionPriceWindows.ts`
- Pine verifier parity: `scripts/pinescript/limni-adr-verifier.pine`
- Source readiness: COT, sentiment, strength
- Performance UI drilldowns and artifact invalidation
- Existing test coverage

## Findings At Audit Start

### ADR Grid Execution

- Level spacing and Favorable Gap mostly match the spec. The app builds levels from `i = 1`, so weekly open itself is not tradable and the first favorable/continuation levels sit at `open +/- 0.20 ADR`.
- Reset target uses the running cycle extreme, matching the spec:
  - Long reset from cycle low + 1 ADR.
  - Short reset from cycle high - 1 ADR.
- Reset behavior does not match the new spec. The app currently sets `entriesStoppedForWeek = true` when reset is hit, but it does not close active fills at the reset price.
- Reset-hit bars can still open entries before reset processing. Entry processing currently happens before reset handling, so the buffer filter can allow entries earlier in the same 1H bar that later hits reset.
- Active-fill TP is processed before reset. If a 1H bar can hit both TP and reset, the current app awards TP. The v2.0.3 spec defines this as a conservative reset close with an ambiguity flag.
- Same-bar TP/re-entry is currently omitted by the `levelRearmBarIndex >= barIndex` guard. That matches the conservative decision, but no ambiguity flag is persisted.
- Pair Fill Cap is active-fill based, which matches the spec.
- TP metadata is only stored when exit reason is `grid_tp`. Reset closes should also retain the original planned TP level for audit display.

### Crypto Windows

- Current shared execution window still gives crypto the same Friday 09:00 NY entry cutoff and Friday 11:00 NY forced close as non-crypto.
- Current tests explicitly assert that crypto uses the Friday safety cutoff.
- The new spec says crypto is 24/7 with a Sunday 20:00 NY week switch, no Friday stop, and reset wait until the next week.

### Pine Verifier Parity

- Pine uses the same cycle-extreme reset target and 0.20 ADR entry-to-reset buffer concept.
- Pine currently stops entries on reset but does not close active fills at reset.
- Pine currently allows reset-hit-bar entry evaluation before reset stop handling.
- Pine `gridCloseTs` uses Friday 11:00 NY even when `canonicalCloseTs` is Sunday 20:00 NY for crypto, so crypto parity needs a versioned fix.

### Source Readiness

- COT is persisted from CFTC rows and has refresh timestamps plus stale refresh logic, but strategy construction emits NEUTRAL when an expected report-date snapshot is missing. That prevents crashes but can silently change baskets unless readiness is surfaced as an incident.
- Sentiment weekly resolver uses `getAggregatesForWeekStartWithBackfill`. Missing week-start symbols are backfilled from latest locked aggregates. Source-health functions are TODO/no-op, so stale/provider-level sentiment health is not currently enforceable.
- Strength is internal/algo based but depends on locked weekly strength snapshots and price returns. If locked weekly strength is missing, it falls back to latest source rows; if exact prior returns are missing, it can fetch provider data. These fallback paths are not currently surfaced as readiness warnings.
- Active code has legitimate strategy tie-breaker concepts, including Agreement ties, selector Strength/Commercial tie branches, COT forced lean, and sentiment fallback tiers. These need to be documented per strategy version and kept separate from data-source fallback/backfill.
- The active source universe is 36 pairs. Sentiment and Strength currently complete every pair to LONG/SHORT when their input path succeeds. Dealer and Commercial use COT completion rules, but exact-zero or missing COT cases can still emit NEUTRAL/skipped rows. Forced-36 verification needs to report these as exceptions, not silently accept them.
- Source direction completion is now documented in `strategy-execution-spec.md` as `source_direction_completion-v1-current`.

### UI And Artifacts

- Existing strategy artifact versions must be bumped for any reset/crypto/ambiguity fix because per-week shard data and path simulation semantics change.
- Source fingerprints only include weekly price rows. They do not include strategy source readiness state, COT report freshness, sentiment aggregate freshness/backfill mode, strength lock state, or the ADR Grid execution rule version.
- Basket fill Result coloring is reason-based (`tp` = green, everything else = red). Reset closes can be positive, breakeven, or negative, so reset rows need return-based coloring and clear exit labels.
- Weekly Hold shares the execution window helper, so the crypto Sunday-to-Sunday correction must be verified for Weekly Hold as well as ADR Grid.

### Tests

Existing tests cover strategy selection normalization, execution window basics, adapter formatting, path/shard plumbing, and some basket UI routes. Missing coverage:

- Reset closes active wins/breakevens/losses at reset price.
- Reset-hit bar blocks new entries before entry evaluation.
- Same 1H bar TP+reset resolves to conservative reset with ambiguity flag.
- Same-bar TP/re-entry is omitted and flagged.
- Favorable Gap remains anchored around weekly open and never trades the open level.
- Crypto has Sunday 20:00 NY to Sunday 20:00 NY execution with no Friday stop.
- Pair Fill Cap remains active-fill based after TP and reset closes.
- Pine verifier parity for reset, crypto, and ambiguity rules.
- Source readiness and stale/backfill reporting for COT, sentiment, and strength.

## Required Changes

1. Add explicit ADR Grid execution version constants for reset semantics, ambiguity policy, crypto weekly window, and Favorable Gap.
2. Change app ADR Grid reset handling to close active fills at reset price, stop same-week entries, and set `exitReason = "grid_reset"`.
3. Evaluate reset before new entries on each 1H bar, or otherwise block all entries on reset-hit bars.
4. Persist original TP price for every fill, including reset and week-close exits.
5. Add ambiguity metadata for conservative 1H cases.
6. Update Pine verifier to mirror app behavior after the app engine is fixed.
7. Split crypto execution windows from non-crypto: Sunday 20:00 NY open, Sunday 20:00 NY close, no Friday cutoff/close.
8. Add readiness reporting for COT expected report date, sentiment week-start source/backfill state, and strength weekly lock/fallback state.
9. Bump shard, ADR Grid entry-engine, path simulation, source fingerprint, and assembly versions before regenerating artifacts.
10. Update tests before trusting performance numbers again.
11. Document all active strategy tie-breaker and fixed-size basket rules as named source-system versions.
12. Make P/L, not exit reason, drive profit/loss coloring in Basket drilldowns.
13. Add a source-completion audit that proves each source resolves 36/36 pairs per week or lists the exact unresolved/fallback rows.

## Open Follow-Up

- Decide whether sentiment/strength fallback should be allowed for live current-week display only, or whether it should also be allowed for finalized historical shards with explicit flags.
- Decide whether v2.0.3 should invalidate all historical ADR Grid shards immediately or ship under a new side-by-side variant until old/new deltas are audited.

## Implementation Pass 1

Completed after the audit:

- App ADR Grid reset now closes active fills and stops the pair/grid until next week.
- Reset-hit bars are processed before new entries, so they cannot open new fills in the 1H conservative executor.
- Original TP price is retained for TP, reset, and week-close exits.
- Reset-bar wins are capped at the fill's predetermined TP when the reset target is beyond TP.
- Ambiguity flags are persisted for reset-bar TP/reset cases.
- Crypto execution windows now run Sunday 20:00 NY to Sunday 20:00 NY for Weekly Hold and ADR Grid.
- Pine verifier reset and crypto windows were updated to mirror the app contract.
- Basket drilldown result color now follows return sign rather than exit reason.
- Runtime strategy versions, release manifests, and preload cache stamp are aligned to the v33/v8 reset/crypto candidate contract.
- Release manifests now explicitly mark existing canon bundles as `stale_pending_regeneration`: the checked-in canon files are still v2.0.2/v32-era artifacts and must not be treated as v33 release-valid until regenerated.
- Manifest execution derivation now tracks the code constant `v5_execution_ny_crypto_sun20` instead of a hardcoded release label.
- Stale canon status is enforced in API/client cache behavior: monolithic historical canon and baseline release-canon week shards are refused while stale, stale responses use `no-store`, and the client does not persist stale canon-derived shards to IndexedDB.
- Legacy monolithic IndexedDB canon reuse now requires stored meta to match the active manifest source hash, generated time, engine version, cache namespace, and every variant hash. Stale mode also avoids writing the candidate cache namespace, so a later `valid` flip cannot bless old v32 bundles.
- Kernel in-memory composed history is gated on `ready` status and active strategy variant, and all composed bundles are cleared on stale, degraded, or error transitions so a long-lived client session cannot keep serving stale cross-variant history after canon becomes untrusted.
- API regressions now lock stale route behavior: historical canon returns `409/no-store`, stale baseline week shards are refused, and transient strategy-artifact correction shards remain allowed without immutable caching.
- Added regression tests for version consistency, Pair Fill Cap active-fill capacity after closes, crypto Weekly Hold execution windows, and source-completion failure reporting.

Still required before trusting regenerated strategy numbers:

- Repair the Jan/Feb source-readiness gaps exposed by the full 19-week `v2.0.3` gate, then rerun `npm run source:completion:release` serially until all 76 rows are trusted.
- Canonical shard regeneration under the bumped artifact versions, followed by flipping manifest canon status from `stale_pending_regeneration` to `valid` only after shard metadata and hashes prove the regenerated contract.
- TradingView/app parity export after Pine compile validation in TradingView.

Initial source-completion audit command:

```bash
npm run source:completion:check -- --weeks=1
```

Initial local result:

- 2026-05-24 Dealer: 36/36 directional.
- 2026-05-24 Commercial: 36/36 directional.
- 2026-05-24 Sentiment: 36/36 directional.
- 2026-05-24 Strength: 36/36 directional.
- The DB layer emitted transient retry warnings on one run; the audit should be rerun across the full release window before artifact regeneration.

Source-readiness gate update, 2026-06-05:

- `source:completion:check` now verifies both `36/36` directional completion and source readiness for Dealer, Commercial, Sentiment, and Strength.
- Empty date windows fail instead of passing with `Rows: 0`.
- Bare `npm run source:completion:check` is a latest-window probe only, not release approval.
- `npm run source:completion:release` is pinned to the active 19-week app/reporting baseline (`2026-01-19` through `2026-05-24`) and fails strict mode with 4 untrusted Jan/Feb Sentiment rows. Strength was repaired on 2026-06-05 and now passes all 19 baseline weeks.
- `npm run source:completion:trusted12` passes the clean March-through-May subset (`48/48` rows), but this is not approval of the active 19-week baseline.
- Run source-readiness gates serially; parallel DB-heavy audits can produce false Strength failures.
- Changing to a shorter release baseline is not allowed unless Freedom explicitly reverses the 19-week decision.
