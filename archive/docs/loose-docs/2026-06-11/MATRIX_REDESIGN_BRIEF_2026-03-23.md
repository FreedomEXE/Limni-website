/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MATRIX_REDESIGN_BRIEF_2026-03-23.md
 *
 * Description:
 * Current matrix redesign brief captured from user direction before
 * implementation, intended for review by Nyx and later execution.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# Matrix Redesign Brief — 2026-03-23

Project:
`c:\Users\User\Documents\GitHub\limni-website`

Purpose:
- capture the current redesign direction before implementation
- give Nyx a clean review target
- preserve the exact route and UX decisions clarified in discussion

## Core Route / Navigation Decision

Important correction:
- the route is **not** `/flagship`
- the route stays **`/matrix`**

Navigation target:
- eliminate the current Matrix-side subnav entirely
- when the user enters `Matrix`, the sidebar should remain in the root navigation view
- the page itself should use top pills/tabs for:
  - `CFD`
  - `Crypto`
  - `Flagship`

Intent:
- `Matrix` becomes one consolidated execution surface
- no separate left-side `Swing` / `Intraday` subsections

## High-Level Product Goal

The goal is to consolidate the intraday execution logic into the existing matrix surface so the dashboard becomes easier to scan and more useful for live manual trading.

Target outcomes:
- fewer surfaces
- less duplication
- only a small number of pairs worth watching per session
- clearer hierarchy
- expansion used for secondary detail instead of showing everything in the main row

## CFD Target Design

The CFD board should be the main consolidated manual-trading matrix.

### Main columns

The CFD table should use these columns:
- `Pair`
- `Core Bias`
- `Gamma`
- `Trigger`
- `Sizing`

### Pair column

`Pair` should show:
- symbol
- asset class
- current daily percent up/down

### Core Bias column

Current issue:
- the existing board shows bias + dealer + commercial + sentiment directly in the table

Target:
- simplify `Core Bias` to only show `Long` or `Short`
- it should reflect what is actually being forward-tested now, meaning the `Tiered V3` logic currently represented in the intraday board
- dealer / commercial / sentiment details should move into the expanded row

Clarified implementation rule:
- keep the current data source / weekly qualified directional call
- simplify the display only
- do **not** invent a new Core Bias source as part of this redesign

### Gamma column

Current `Context` should be replaced with `Gamma`.

`Gamma` is the combined context bucket built from:
- COT gating
- MenthorQ gamma report
- strength

Interpretation:
- if 2 of 3 agree, mark `Confirm`
- otherwise use `Mixed` or `Conflict` as appropriate

Current preferred state set:
- `Confirm`
- `Mixed`
- `Conflict`

Purpose:
- this is contextual guidance, not the primary directional signal

Clarified CFD gamma boolean logic:
- `COT gating agrees` = the current weekly gated decision supports the displayed Core Bias
- `MenthorQ agrees` = the overlay direction matches the displayed Core Bias
- `Strength agrees` = the `1h` strength direction matches the displayed Core Bias

Output:
- `Confirm` = 3/3 or 2/3 agree
- `Mixed` = 1/3 agree
- `Conflict` = 0/3 agree

### Trigger column

`Trigger` should use the ADR logic currently shown in the intraday board.

Behavior:
- this is the intraday trigger folded into the CFD matrix
- if `1.0 ADR` is hit, the trigger chip lights up / flashes
- only the trigger chip flashes
- the whole row should **not** flash
- ADR-hit pairs get pushed to the top

### Qualified vs neutral rows

Main board behavior:
- show current-week qualified pairs first
- show all remaining instruments underneath as neutral

Ordering behavior:
- ADR-hit qualified pairs at the top
- otherwise qualified pairs alphabetical
- neutrals underneath

Exact CFD ordering rule:
1. ADR-hit qualified pairs, alphabetical
2. non-hit qualified pairs, alphabetical
3. neutral / non-qualified pairs, alphabetical

Fallback rule:
- a qualified pair with missing ADR data stays in the non-hit qualified bucket
- it does not fall into neutral/non-qualified

### Intraday consolidation outcome

The separate intraday section/tab should be removed conceptually by folding its ADR trigger behavior into CFD Matrix.

Result:
- CFD Matrix becomes the live execution board layered on top of the weekly bias

### Sizing

`Sizing` should remain present as a placeholder area for now.

Later direction:
- sizing will require a custom integration where a user can enter account size and instrument leverage/details
- only then should the system generate pair-specific size guidance

For now:
- do not treat sizing as part of this redesign phase

## Flagship Target Design

Current `Swing` should be renamed to `Flagship`.

Within `/matrix`, the third pill should be:
- `Flagship`

Intent:
- preserve the weekly / flagship surface
- rename it to better match the actual product language
- keep it as part of the same top-pill matrix system rather than a separate side-nav destination

Implementation note:
- the `Flagship` pill should render the current `SwingForwardBoard` inline inside the `/matrix` page
- do not keep it as a separate route-driven page surface for the main UX
- no internal redesign of `SwingForwardBoard` is required in this phase

Data-loading note:
- keep the current server-side pattern used by `weekly-hold/page.tsx`
- fetch the canonical weekly flagship metadata on the server in the `/matrix` page
- pass that server-fetched result down to the `Flagship` pill content
- do **not** replace this with a new client-side fetch

## Crypto Target Design

The crypto board should be simplified so it follows the same mental model as CFD.

### Main columns

Crypto should also move toward:
- `Pair`
- `Core Bias`
- `Gamma`
- `Trigger`
- `Sizing`

### BTC / ETH cards

BTC and ETH should remain showcased in the two top summary cards.

Important rule:
- remove BTC and ETH from the main crypto list/table
- keeping them in both places is redundant

Clarified placement:
- BTC and ETH cards are for the `Crypto` pill only
- they remain at the top and are not repeated in the main table

### Core Bias column

Current issue:
- crypto splits `Core Bias` and directional handshake sections too aggressively in the main surface

Target:
- consolidate `Core Bias` and `Direction` into one `Core Bias` column
- remove the need for separate BTC / ETH / ALT handshake columns in the main table
- if users want more detail, they expand the row

### Gamma column

Crypto context should also be consolidated into the same `Gamma` style logic.

Current underlying inputs:
- liquidations
- open interest
- funding

Output state should be:
- `Confirm`
- `Mixed`
- `Conflict`

Intent:
- align crypto with CFD so both surfaces share the same reading model

### Trigger column

Crypto should also use ADR trigger logic.

Behavior:
- ADR hit is the trigger
- when ADR is hit, the trigger indicator lights up

### Sorting

For crypto, after BTC and ETH are removed:
- remaining pairs should stay sorted by highest to lowest percentage against the bias
- this is already the current logic and should be preserved

## Session Filter

The CFD board should keep the session filter.

Decision:
- do **not** remove Asia / London / NY filtering from CFD
- session pills remain part of the CFD surface for manual scanning

Interpretation:
- the intraday board is being removed as a separate surface
- the session filter still remains useful as an operator-level scan filter inside CFD Matrix

## Visual / UX Principles Locked In

The user wants the redesign to stay:
- concise
- clean
- not overloaded
- easy to scan at a glance
- directionally obvious
- focused on surfacing only the pairs that matter right now

Additional guidance:
- important rows should bubble up
- the matrix board should remain the visual anchor
- expansion should carry secondary detail instead of bloating the main table

## Summary of Structural Outcome

Target end state:

1. `Matrix` remains a top-level route/section at `/matrix`
2. Matrix-side subnav is removed
3. Sidebar stays in root navigation mode
4. Top pills inside `/matrix` become:
   - `CFD`
   - `Crypto`
   - `Flagship`
5. `Intraday` is eliminated as a separate surface by folding ADR trigger logic into CFD Matrix
6. `Swing` is renamed to `Flagship`
7. Crypto is simplified to the same table language as CFD

## Routing / Redirect Handling

Implementation should account for the current live routes still being under `/flagship`.

Target behavior:
- primary matrix nav target becomes `/matrix`
- `/flagship` should redirect to `/matrix`
- `/flagship/weekly-hold` should redirect to `/matrix?tab=flagship`
- `/flagship/intraday` should redirect to `/matrix?tab=cfd`

Layout change:
- update `DashboardLayout` so the top-level Matrix nav points to `/matrix`
- remove the Matrix-specific subnav items entirely

## Review Request For Nyx

Please review:

1. whether this consolidation is the right UX simplification for live manual trading
2. whether the proposed column model is the clearest structure for both CFD and Crypto
3. whether the ADR trigger behavior is the correct mechanism for folding intraday into CFD
4. whether any ambiguity remains around:
   - qualified vs neutral ordering
   - gamma state definitions
   - what belongs in expansion vs main row
5. whether the root-nav-only Matrix layout introduces any usability or consistency concerns
