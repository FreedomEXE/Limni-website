# UI Surfaces

## Performance

- Route: [`src/app/performance/page.tsx`](../../src/app/performance/page.tsx)
- Main client component: [`src/components/performance/PerformanceStrategyViewSection.tsx`](../../src/components/performance/PerformanceStrategyViewSection.tsx)
- Core surface component: [`src/components/performance/PerformanceViewSection.tsx`](../../src/components/performance/PerformanceViewSection.tsx)

Active tabs/cards:

- Summary
- Simulation
- Basket
- Research
- Notes

ViewMode:

- Anchor locked to execution for Performance display.
- Normalization toggles between ADR-normalized and raw.
- Disclosure label is provided by [`src/components/common/AnchorDisclosureLabel.tsx`](../../src/components/common/AnchorDisclosureLabel.tsx).

Current Basket state:

- Basket v3 hierarchy UI is contained behind a placeholder.
- The rejected data layer remains preserved for v2/canon rebuild.
- Basket will be rebuilt on v2 canon using [`src/components/common/trade-list/TradeList.tsx`](../../src/components/common/trade-list/TradeList.tsx).

## Dashboard / Data

- Route: [`src/app/dashboard/page.tsx`](../../src/app/dashboard/page.tsx)
- Main component: [`src/components/dashboard/DashboardViewSection.tsx`](../../src/components/dashboard/DashboardViewSection.tsx)

Dashboard presents market-intelligence, COT/sentiment views, and heatmap/list modes. Data-like surfaces use execution/raw defaults and can support both ViewMode axes where wired.

## Research / Automation Research

- Route: [`src/app/automation/research/page.tsx`](../../src/app/automation/research/page.tsx)
- Lab route: [`src/app/automation/research/lab/page.tsx`](../../src/app/automation/research/lab/page.tsx)
- Main lab component: [`src/components/research/ResearchLabClient.tsx`](../../src/components/research/ResearchLabClient.tsx)

Research surfaces remain active but are not part of the v2 canon/Basket rebuild except as consumers of shared future primitives.

## Accounts

- Routes:
  - [`src/app/accounts/page.tsx`](../../src/app/accounts/page.tsx)
  - [`src/app/accounts/[accountId]/page.tsx`](../../src/app/accounts/%5BaccountId%5D/page.tsx)
  - [`src/app/accounts/connected/[accountKey]/page.tsx`](../../src/app/accounts/connected/%5BaccountKey%5D/page.tsx)
- Shared account UI includes [`src/components/accounts/CollapsibleSection.tsx`](../../src/components/accounts/CollapsibleSection.tsx), now using shared disclosure atoms.

Accounts remains active. Future account trade-list migration should use `TradeList` in a separate single-track workstream.

## Matrix

- Route: [`src/app/matrix/page.tsx`](../../src/app/matrix/page.tsx)
- Components: [`src/components/matrix`](../../src/components/matrix)

Matrix code exists at v1 baseline but is targeted for v2 active-flow quarantine. It should not be expanded during v2.

## Shared UI

- [`src/components/common/ViewModeControls.tsx`](../../src/components/common/ViewModeControls.tsx)
- [`src/components/common/SegmentedToggle.tsx`](../../src/components/common/SegmentedToggle.tsx)
- [`src/components/common/trade-list`](../../src/components/common/trade-list)
- [`src/components/common/trades`](../../src/components/common/trades)
- [`src/components/common/disclosure`](../../src/components/common/disclosure)

The modular UI rule is active: new list-based trade displays should migrate toward `TradeList`, not create another one-off expandable/list pattern.
