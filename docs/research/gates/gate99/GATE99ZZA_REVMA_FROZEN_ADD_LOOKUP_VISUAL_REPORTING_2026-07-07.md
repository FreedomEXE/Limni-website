# Gate 99ZZA - Revma Frozen Birth Add Lookup Repair + Visual Reporting Hardening

Date: 2026-07-07
Status: PASS

## Verdict

Gate 99ZZA passes for one-pair Revma visual Strategy Tester mechanics proof.

This pass is limited to AUDCHF.i visual mechanics, frozen add lookup repair, receipt hardening, readable comment proof, and EA-owned visual reporting. It makes no all-28 claim, no optimization claim, no performance or profitability claim, and no live-readiness claim.

## Scope

Allowed:
- One pair only: AUDCHF.i.
- Visual Strategy Tester mechanics proof.
- Frozen birth/grid identity lookup for open Revma grids.
- Birth/add receipts and active-grid/current-signal reporting.
- English-readable MT5 trade comments.

Frozen:
- No all-28 run.
- No optimization.
- No Revma strategy promotion.
- No live-readiness claim.
- No Katarakti.
- No q-state semantics change.
- No exposure guard/grid cap testing.
- No indicator redesign. The user clarified that Strategy Tester speed itself is fine and the slow path appears when indicator templates are added. This gate therefore moved the visual dashboard into the EA and did not change indicator math or indicator defaults.

## Code Changes

Frozen add lookup:
- `LP_GridBook::FindSymbolLaneGrid()` now finds an open grid by frozen symbol/lane grid identity instead of requiring the current signal variant/direction.
- Revma add evaluation now derives add direction, sleeve, variant, and add policy from the frozen birth snapshot/open grid.
- Adds use frozen `variant_id`, frozen `direction`, and frozen `add_policy`.
- Birth fields are remembered and re-emitted in add receipts: direction, sleeve/setup_type, add policy, q profile, q at entry, anchor, price, formula IDs/hashes, and source M1 time.

Receipts:
- Added `revma_grid_add_skip`.
- Strategy-level add skip reasons are explicit:
  - `add_skip_no_active_grid_found`
  - `add_skip_spacing_not_reached`
  - `add_skip_other_reason`
- Exposure/order/manual/tester safety decisions remain in the existing downstream `risk_decision`, `order_request`, and `order_result` receipts rather than being duplicated in Revma strategy receipts.

Visual reporting:
- Added an EA-owned Revma dashboard using the same Revma signal, birth snapshot, and grid inventory data path.
- Dashboard distinguishes:
  - `CURRENT SIGNAL`
  - `ACTIVE GRID`
  - `LAST DIVERGENT ADD`
- Dashboard updates are throttled by `RevmaDashboardRefreshSeconds`.
- Dashboard chart objects are reused instead of rebuilt from scratch each tick.
- Added `RevmaDashboardScreenshotOnDivergentAdd` for proof runs.
- MT5 returned `ChartScreenShot(...)=true` in tester, but did not preserve that PNG after tester shutdown. Durable visual proof therefore uses the EA-written dashboard text snapshot from Common Files rendered into a PNG artifact by the proof wrapper.

Comments:
- MT5 trade comments are now readable first:
  - `RevmaTrend BUY/SELL SYMBOL Cxxxx`
  - `RevmaMeanRev BUY/SELL SYMBOL Cxxxx`
- Machine identifiers remain available through magic/config IDs and receipt metadata.

## Compile Proof

Repo source compile:
- `docs/research/gates/gate99/artifacts/gate99zza-revma-frozen-add-lookup-visual-reporting-2026-07-07/repo-LimniPortfolioEA-compile-log-dashboard-snapshot.txt`
- Result: `0 errors, 0 warnings`

Active terminal source compile:
- `docs/research/gates/gate99/artifacts/gate99zza-revma-frozen-add-lookup-visual-reporting-2026-07-07/active-terminal-LimniPortfolioEA-compile-log-dashboard-snapshot.txt`
- Result: `0 errors, 0 warnings`

MetaEditor returned exit code `1` while the compile logs show clean results. This matches prior MT5 compile behavior in this repo; the compile verdict is based on the log result line.

## Visual Proof Run

Runner:
- `docs/research/gates/gate99/artifacts/gate99zza-revma-frozen-add-lookup-visual-reporting-2026-07-07/run-visual-divergent-case.ps1`

Configuration:
- Symbol: `AUDCHF.i`
- Period: `M1`
- Date range: `2025-03-01` to `2025-03-11`
- Visual: `1`
- Optimization: `0`
- ExecutionMode: `LP_EXECUTION_TESTER_ONLY`
- RevmaGridSpacingQ: `0.1`
- RevmaQProfile: `MEDIUM_50000`

Result:
- `add_detected=True`
- `divergent_add_detected=True`
- `dashboard_text_png=docs/research/gates/gate99/artifacts/gate99zza-revma-frozen-add-lookup-visual-reporting-2026-07-07/visual-dashboard/long_below_reversion_divergent_add_lower-dashboard.png`

## Key Evidence

Compact extracts:
- `divergent-add-proof.csv`
- `receipt-type-counts.csv`
- `add-skip-status-counts.csv`
- `dashboard-evidence-proof.csv`
- `readable-comment-proof.csv`

First divergent add proof:
- Event: `3585`
- Server time: `2025.03.03 21:54:00`
- Existing grid: `1031113005`
- Locked setup: `REVERSION`
- Locked add policy: `reversion_add_lower`
- Frozen direction/sleeve/variant: `LONG / REVERSION / V11`
- Current direction/sleeve/variant: `SHORT / CONTINUATION / V10`
- `current_matches_birth_identity=false`
- Birth q profile: `MEDIUM_50000`
- Birth q: `0.00095596`
- Birth anchor/price: `0.56512 / 0.56020`
- Current anchor/price: `0.56416 / 0.55840`
- Next add level: `0.55883`
- Open positions at add: `75`

This proves the add lookup did not silently stop when the current signal classification changed. The open grid remained frozen as LONG/REVERSION and the add followed frozen `reversion_add_lower`.

Skip receipt counts:
- `add_skip_no_active_grid_found`: `4`
- `add_skip_spacing_not_reached`: `8455`

Receipt type counts:
- `revma_grid_birth`: `4`
- `revma_grid_add`: `121` including the dashboard evidence receipt
- `revma_grid_add_skip`: `8459`
- `risk_decision`: `124`
- `trade_plan`: `124`
- `order_result`: `124`

Readable comment proof:
- `comment=RevmaMeanRev BUY AUDCHF C1461`

Dashboard visual proof:
- PNG: `visual-dashboard/long_below_reversion_divergent_add_lower-dashboard.png`
- Text source: `visual-dashboard/long_below_reversion_divergent_add_lower-dashboard.txt`

The dashboard image explicitly shows:
- Current signal: `SHORT / CONTINUATION / V10`
- Active grid: birth direction `LONG`, frozen sleeve `REVERSION`, frozen add `reversion_add_lower`
- `matches birth: false`
- Last divergent add: frozen `LONG / REVERSION / V11`, current `SHORT / CONTINUATION / V10`

## Caveats

The external terminal screenshot captured the main terminal chart rather than the visual tester chart. It is not used as pass evidence.

`ChartScreenShot()` returned `ok=true` and wrote a receipt with the tester agent path, but the tester did not preserve the PNG after shutdown. This report therefore uses the durable EA dashboard snapshot text, rendered into a PNG by the proof wrapper, as the visual artifact. The text snapshot is written by the EA at the same divergent-add event and comes from the same dashboard text displayed by the EA.

Indicator speed remains a separate future task. This gate did not optimize indicators and did not change indicator strategy truth.

## Final Decision

PASS for Gate 99ZZA:
- Frozen birth add lookup repaired.
- Adds continue from frozen grid identity when current classification changes.
- Birth fields remain locked and visible in receipts.
- Current fields remain visible and distinct from frozen grid truth.
- Add skip receipts are explicit for strategy-level add non-events.
- Visual reporting clearly distinguishes current signal from active grid.
- English-readable trade comments are present.
