# v2.0.2 Handoff: Kernel Stabilization to Data Verification

## Status

v2.0.2 is the loading/cache/version kernel stabilization release. It keeps the v2 release canon immutable, adds a closed-week delta path, isolates the live week, and moves Performance away from the brittle broad preload/repair flow for active strategy data.

Do not tag or rewrite history unless Freedom explicitly asks.

## What v2.0.2 Covers

- Kernel architecture spec: `docs/architecture/KERNEL_DATA_ARCHITECTURE_SPEC.md`.
- Release canon + closed-week delta + live-week data model.
- Canon inventory and per-week shard APIs.
- Client IndexedDB v2 week shard stores and active-variant kernel hydration.
- Active Performance strategy payload now uses explicit kernel payload readiness.
- Status page shows the kernel data layer.
- Version badge shows exact v2.0.2 state and compact kernel diagnostics.
- Basket UI now shares drilldown counts across current week, closed weeks, and all time.
- Current-week Basket grids now retain grid/fill structure instead of flattening into asset rows.
- Fill display order is normalized by entry order with per-grid display numbering.

## Verification Completed Before Push

- `npx tsc --noEmit` passed.
- `npm test` passed: 53 files, 188 tests.
- `npm run build` passed with existing warnings only.
- `releases/v2/canon/` remained untouched.
- Playwright checked current-week Basket on local dev server:
  - Tiered / ADR Grid / Pair Fill Cap / Basket / current week.
  - Single-fill grid expanded as `Fill 1`.
  - Multi-fill grid expanded sequential fills with detail rows.
- Spot checks confirmed closed-week fill display order is by entry order while preserving source sequence context.

## Known Residuals

- Public v2.0.1 crash was reported by Freedom on the authenticated app. A public unauthenticated check redirected to `/login` without reproducing the crash. Re-check production after v2.0.2 deploy.
- Matrix remains provisional/degraded for v2.0.2 and is not part of the critical Performance path.
- `BasketHierarchyContainmentNotice` remains as preserved/quarantined unused code in `PerformanceViewSection.tsx`; do not delete without approval.

## Immediate Production Inspection Checklist

1. Confirm production shows exact `v2.0.2` in the version popover.
2. Confirm status page kernel cards show ready/degraded state clearly.
3. Confirm Performance loads without the old vague preload hang.
4. Confirm Basket views for Tiered and Tandem / ADR Grid / Pair Fill Cap:
   - Current week.
   - May 25 closed week.
   - All Time.
5. Confirm current week shows real grids and fills, not flattened asset-only rows.
6. Confirm the version popover is scrollable/bounded and does not show week arrows behind it.

## Next Stage

The next major stage is data verification against the TradingView indicator before automation work.

Roadmap:

1. Found a configuration that works on paper.
2. Verify the data is correct.
3. Select one system to automate.
4. Create a bot to trade that system.

## Data Verification Focus

- Upgrade the TradingView indicator to match the app execution rules.
- Compare app vs indicator trade-by-trade, system-by-system.
- Verify pair, direction, entry, exit, fill order, return, grid grouping, weekly totals, and all-time totals.
- Resolve discrepancies before selecting the first automation candidate.

## Data Verification Started Locally

Current working track:

- `v2.0.3 candidate - data verification`
- Runtime version/release manifest not bumped yet.
- `releases/v2/canon/` remains immutable and must stay untouched unless Freedom explicitly approves a canon rematerialization.

New verification docs:

- `docs/data-verification/APP_TRADINGVIEW_VERIFICATION_WORKFLOW.md`
- `docs/data-verification/APP_TRADINGVIEW_EXECUTION_MATRIX.md`

First manual result:

- Scenario `WH-FX-LIVE-MT-RAW-001`
- EURUSD Weekly Hold SHORT, current live week, Market Truth, Raw.
- TradingView realtime screenshot showed entry `1.16543`, exit near `1.16295`, P/L `+0.21%`, max DD `-0.09%`.
- App Data after local live-window patch showed Market Truth completed-H1 entry `1.16543`, exit `1.16315`, SHORT raw `+0.1956%`, max DD `-0.0901%`.
- Classification: pass with live-candle caveat. Entry/drawdown/rule direction hold; exit delta is realtime TradingView candle vs completed OANDA H1 candle.

Local app fix made during verification:

- Current-week Data-section canonical live rows now use `getCanonicalWeekWindow(...)` for Market Truth instead of opening from the display week key.
- This is app behavior change and should be treated as patch-candidate work, not as an undocumented v2.0.2 mutation.

Next manual test:

- Baseline matrix is 12 configurations: 3 mode/cap groups (`Weekly Hold`, `ADR Grid`, `ADR Grid + Pair Fill Cap`) times 4 anchor/basis combinations (`Market Truth Raw`, `Market Truth ADR Normalized`, `Execution Raw`, `Execution ADR Normalized`).
- EURUSD target is 3 weekly samples per configuration, so the first baseline pass is 36 EURUSD checks.
- Raw Market Truth has now passed for EURUSD Weekly Hold SHORT at `Weeks Back = 1` and `Weeks Back = 2`, plus one current-live caveat case.
- `CFG-WH-MT-RAW` is accepted as passed for rule parity; confirmed-only coverage is 2/3 if the stricter baseline requires three closed weeks.
- ADR-normalized Market Truth now has three EURUSD samples: `Weeks Back = 2` at 90% parity, `Weeks Back = 1` at 90% parity, and current week at 95% parity with live-candle caveat. Entry/exit/raw math agrees; remaining drift is ADR denominator/source. `CFG-WH-MT-ADR` is usable, confirmed-only coverage 2/3.
- First resolve or document ADR source policy before marking ADR-normalized configurations as passed.
- Then proceed to scenario `WH-FX-CLOSED-EXE-RAW-001`: EURUSD Weekly Hold SHORT, last closed week, Execution, Raw, `Live Bar = Confirmed`, `Weeks Back = 1`.
- This is the first clean Data-vs-Performance overlap because Performance is execution-anchored.
