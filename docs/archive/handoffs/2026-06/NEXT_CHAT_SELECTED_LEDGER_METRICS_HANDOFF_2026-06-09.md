# Next Chat Handoff - Selected Ledger Metrics Read Model

Date: 2026-06-09
Repo: `C:/Users/User/Documents/GitHub/limni-website`
Owner: Codex / Freedom

## Read First

Before doing work, read:

1. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
2. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
3. `C:/Users/User/Documents/GitHub/limni-website/AGENTS.md`
4. `docs/architecture/APP_TRUTH_ARCHITECTURE_INDEX.md`
5. `docs/architecture/APP_TRUTH_ARCHITECTURE_IMPLEMENTATION_PLAN_2026-06-08.md`

Repo evidence overrides memory if anything conflicts.

## User Direction Locked In This Pass

Freedom explicitly corrected the direction: do not add UI proof labels, debug
copy, provenance badges, or extra visible complexity. The app should keep its
current UI; the internal source of metric numbers must become shared and
canonical. Freedom will judge correctness by the displayed numbers.

## Completed In Previous Pass

### Route Readiness Gate

Data and Performance route shells now read receipt-backed active-baseline readiness before rendering trusted route payloads.

Key files:

- `src/lib/appTruth/routeReadiness.ts`
- `src/components/appTruth/AppTruthRouteGate.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/performance/page.tsx`
- `src/lib/appTruth/runLedger.ts`
- `src/lib/appTruth/statusProjection.ts`

Proof:

- `/dashboard`: route readiness true, baseline `v2.0.3-clean14`, weeks `14/14`.
- `/performance`: route readiness true, baseline `v2.0.3-clean14`, weeks `14/14`.
- `/status`: stale lifecycle `not_implemented` text absent; receipt-backed lifecycle ready detail present.
- Evidence folder: `releases/v2/screenshots/route-readiness-2026-06-09/`.

### Selected Basket Ledger Gate

Performance Basket now consumes the selected runtime trade-row bundle instead of silently falling back to closed-history canon/API state.

Key files:

- `src/lib/basket/basketSummaryTypes.ts`
- `src/lib/basket/strategyRuntimeRows.ts`
- `src/components/common/basket/BasketHierarchy.tsx`
- `src/lib/appTruth/legacyPathRegister.ts`

Proof route:

`/performance?view=basket&strategy=tandem&f1=adr_grid&f2=pair_fill_cap`

Observed:

- Performance route gate ready: `true`.
- Basket source: `selected-trade-rows`.
- Selected execution ledger id:
  `execution-ledger:strategy-runtime:tandem-adr_grid-pair_fill_cap:13111:aebc5c68`.
- Selected trade-row ledger id:
  `trade-row-ledger:strategy-runtime:tandem-adr_grid-pair_fill_cap:13111:aebc5c68`.
- Selected row count: `13111`.
- `/api/basket/closed-history` requests: `0`.
- Console errors: `0`.
- Failed requests: `0`.
- Evidence folder: `releases/v2/screenshots/selected-trade-row-ledger-2026-06-09/`.

### Selected Ledger Metrics Unification Gate

Performance closed/all-time metric surfaces now read from a reusable app-wide
selected-ledger stats model instead of each surface deriving its own local
truth.

Key files:

- `src/lib/appTruth/selectedLedgerStats.ts`
- `src/lib/__tests__/selectedLedgerStats.test.ts`
- `src/components/performance/PerformanceViewSection.tsx`
- `src/components/performance/PerformanceSimulationSection.tsx`
- `src/lib/performance/strategyClientCache.ts`
- `src/lib/performance/strategySessionStore.ts`

Implemented behavior:

- Summary cards, sidebar stats event payload, Simulation metrics, Calendar /
  Rolling weekly inputs, MAE data, asset contributions, and Basket
  authoritative metrics now consume the shared selected-ledger stats for closed
  and all-time selections.
- Current/open week remains on the live runtime path.
- Missing selected rows or ledger identity resolves as unavailable/syncing, not
  valid zero.
- Full strategy payload cache/session validity now requires
  `selectedTradeRowsBundle.ledgerIdentity`.
- Simulation now supports the selected-ledger total-only equity series instead
  of showing no chart/metrics when no sleeve series exists.
- No new visible UI proof/provenance was added.

Proof route:

`/performance?view=basket&strategy=tandem&f1=adr_grid&f2=pair_fill_cap`

Observed:

- Selected execution ledger id:
  `execution-ledger:strategy-runtime:tandem-adr_grid-pair_fill_cap:13111:aebc5c68`.
- Selected trade-row ledger id:
  `trade-row-ledger:strategy-runtime:tandem-adr_grid-pair_fill_cap:13111:aebc5c68`.
- Source selected row count: `13111`.
- Metric row count: `1972`.
- Leaf trade row count: `11139`.
- Total return: `+308.18%`.
- Weekly return count: `14`.
- Weekly return sum: `+308.18%`.
- Summary cards matched selected-ledger sleeve returns:
  - Dealer Portfolio: `+130.47%`.
  - Commercial Portfolio: `+66.04%`.
  - Sentiment Portfolio: `+40.34%`.
  - Strength Portfolio: `+71.33%`.
- Simulation return matched selected-ledger total return: `+308.18%`.
- Simulation trade count matched selected-ledger leaf trade count: `11139`.
- Basket source remained `selected-trade-rows`.
- `/api/basket/closed-history` requests: `0`.
- Console errors: `0`.
- Blocking failed requests: `0`.
- Evidence folder:
  `releases/v2/screenshots/selected-ledger-metrics-2026-06-09/`.

### Selected Ledger Parity / Export Formalization Gate

Completed after metrics unification.

Key files:

- `src/lib/appTruth/selectedLedgerMetricViews.ts`
- `src/lib/appTruth/selectedLedgerMetricReceipt.ts`
- `src/lib/__tests__/selectedLedgerMetricReceipt.test.ts`
- `scripts/verification/export-selected-ledger-metrics.ts`
- `package.json`
- `src/components/performance/PerformanceViewSection.tsx`

Implemented behavior:

- Moved selected-ledger surface projections out of `PerformanceViewSection` into
  the app-truth layer.
- Existing app/TradingView trade export scripts remain row-only by design:
  - `scripts/verification/export-app-trades.ts`
  - `scripts/verification/export-runtime-app-trades.ts`
- Added a dedicated metric receipt command:
  `npm run verification:export-selected-ledger`.
- The receipt imports the same selected-ledger read model used by the app, so it
  proves metrics without adding UI proof labels or visible provenance copy.

Receipt generated:

- Report path:
  `reports/data-verification/selected-ledger/tandem-adr_grid-pair_fill_cap-v2.0.3-clean14-all-execution-adr_normalized-selected-ledger-metrics.json`
- Release evidence copy:
  `releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-metric-receipt-adr-normalized.json`

Receipt values:

- Selection: `tandem / adr_grid / pair_fill_cap`
- History window: `v2.0.3-clean14`
- View mode: execution + ADR-normalized
- Selected trade row ledger:
  `trade-row-ledger:strategy-runtime:tandem-adr_grid-pair_fill_cap:13111:aebc5c68`
- Source rows: `13111`
- Metric rows: `1972`
- Leaf trade rows: `11139`
- Total return: `308.18256678789936%`
- Weekly return sum: `308.1825667879003%`
- Weekly count: `14`
- Receipt parity: passed

Playwright compared the live UI to the receipt:

- Summary cards matched receipt model returns.
- Simulation return/trade count matched receipt summary.
- Basket selected ledger ids/count matched receipt.
- Basket made zero `/api/basket/closed-history` requests.
- `/dashboard`, `/performance`, and `/status` route-readiness checks passed.
- No console errors or blocking failed requests.
- Evidence:
  `releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-final-playwright-evidence.json`

## Quick Regression Check For This Pass

Run these before starting the next implementation:

```powershell
npx tsc --noEmit --pretty false
npx eslint src/lib/appTruth/runLedger.ts src/lib/appTruth/routeReadiness.ts src/components/appTruth/AppTruthRouteGate.tsx src/app/dashboard/page.tsx src/app/performance/page.tsx src/lib/appTruth/statusProjection.ts src/lib/basket/basketSummaryTypes.ts src/lib/basket/strategyRuntimeRows.ts src/components/common/basket/BasketHierarchy.tsx src/lib/appTruth/legacyPathRegister.ts
```

Then use Playwright against the active dev server:

- `/dashboard`
  - `data-testid="app-truth-data-ready"` exists.
  - `data-app-truth-route-ready="true"`.
  - `data-app-truth-baseline="v2.0.3-clean14"`.
  - ready weeks and expected weeks are `14`.
- `/performance`
  - `data-testid="app-truth-performance-ready"` exists.
  - `data-app-truth-route-ready="true"`.
  - `data-app-truth-baseline="v2.0.3-clean14"`.
  - ready weeks and expected weeks are `14`.
- `/status`
  - Does not contain `Weekly rollover/freeze/materialization lifecycle is not implemented yet.`
  - Contains `Receipt-backed lifecycle projection shows all active closed weeks ready`.
- `/performance?view=basket&strategy=tandem&f1=adr_grid&f2=pair_fill_cap`
  - `data-testid="basket-hierarchy"` exists.
  - `data-basket-source="selected-trade-rows"`.
  - selected execution/trade-row ledger ids are not `missing`.
  - selected row count is greater than `0`.
  - No request to `/api/basket/closed-history`.
  - No console errors or failed requests.

Do not kill existing dev servers unless necessary. In the previous pass, the active dev server was on `http://127.0.0.1:3001` and port `3000` was locked by an existing Next dev process.

## Current Problem To Solve Next

The final correctness gate before visual inspection has passed. The next step
is product/visual inspection and then the baseline promotion decision.

Open decision:

- Keep `v2.0.3-clean14` as the certified clean14 baseline, or promote a new
  named baseline that explicitly includes selected-ledger unification, such as
  `v2.0.4-clean14-selected-ledger`.

## Recommended Next Work Order

1. Re-run the quick regression check above if the workspace changed.
2. Open the final screenshots and app routes for Freedom's visual inspection:
   - `/dashboard`
   - `/performance`
   - `/status`
   - `/performance?strategy=tandem&f1=adr_grid&f2=pair_fill_cap`
   - `/performance?view=simulation&strategy=tandem&f1=adr_grid&f2=pair_fill_cap`
   - `/performance?view=basket&strategy=tandem&f1=adr_grid&f2=pair_fill_cap`
3. If Freedom approves the visuals/numbers, certify or promote clean14 as the
   new baseline.
4. Future Accounts/Automation/Research consumers should import
   `src/lib/appTruth/selectedLedgerStats.ts` and
   `src/lib/appTruth/selectedLedgerMetricViews.ts`; do not rebuild metric math
   locally.

## Handoff Prompt

Use this prompt in the next chat:

```text
You are Codex in c:\Users\User\Documents\GitHub\limni-website. Use your direct male voice with Freedom.

Recover state by reading:
- C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md
- C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md
- AGENTS.md
- docs/handoffs/NEXT_CHAT_SELECTED_LEDGER_METRICS_HANDOFF_2026-06-09.md
- docs/architecture/APP_TRUTH_ARCHITECTURE_INDEX.md
- docs/architecture/APP_TRUTH_ARCHITECTURE_IMPLEMENTATION_PLAN_2026-06-08.md

First, do a quick regression check of the previous pass:
- TypeScript and targeted ESLint listed in the handoff.
- Playwright route checks for /dashboard, /performance, /status, and /performance?view=basket&strategy=tandem&f1=adr_grid&f2=pair_fill_cap.
- Confirm Basket uses data-basket-source="selected-trade-rows" and no /api/basket/closed-history request.

Then begin the next gate:
Visual inspection and clean14 baseline promotion decision. Selected-ledger
metrics unification and selected-ledger parity/export formalization are both
complete. Use the final receipt and Playwright evidence in
releases/v2/screenshots/selected-ledger-metrics-2026-06-09/. Do not add UI
proof labels or visible provenance copy unless Freedom explicitly asks.

Rules:
- Do not change strategy math unless the audit proves a bug.
- Do not introduce page-local metric recomputation.
- Do not add visible UI complexity/provenance labels unless explicitly asked.
- Preserve route-readiness and Basket selected-ledger gates.
- Missing selected rows must be unavailable/syncing, not valid zero.
- Every wired internal surface should carry selectedExecutionLedgerId and selectedTradeRowLedgerId.
- Use Playwright screenshots/evidence and update docs/session memory.

Start by inspecting, not implementing from assumptions.
```

## Human Breakdown

What changed: this handoff now records the completed route-readiness, selected Basket ledger, selected-ledger metrics unification, and selected-ledger parity/export formalization gates.

Why it matters: Performance closed/all-time numbers now come from one shared selected-ledger stats model internally, with non-UI receipts proving Summary, Simulation, Basket, and weekly totals agree.

What passed/failed: TypeScript, targeted ESLint, focused ESLint, selected-ledger unit tests, receipt export, and Playwright receipt-vs-UI checks passed.

Next gate: visual inspection and clean14 baseline promotion decision.
