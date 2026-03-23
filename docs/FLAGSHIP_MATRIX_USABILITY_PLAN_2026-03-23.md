/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: FLAGSHIP_MATRIX_USABILITY_PLAN_2026-03-23.md
 *
 * Description:
 * Saved checkpoint from Codex review before the next flagship
 * Matrix/Swing/Intraday redesign discussion.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# Flagship Matrix Usability Plan — 2026-03-23

Project:
`c:\Users\User\Documents\GitHub\limni-website`

Scope for the next pass:
- polish and simplify `Matrix`, `Swing`, and `Intraday`
- improve scanability and live-manual-trading usefulness
- preserve current logic unless explicitly requested otherwise

## Current Review Snapshot

Routes reviewed:
- `/flagship`
- `/flagship/weekly-hold`
- `/flagship/intraday`

Files inspected:
- `src/components/flagship/FlagshipBoard.tsx`
- `src/components/flagship/SwingForwardBoard.tsx`
- `src/components/flagship/IntradayForwardBoard.tsx`
- `src/components/DashboardLayout.tsx`
- `src/lib/flagship/matrixStyles.ts`

Browser verification:
- local dev run with `AUTH_BYPASS=true`
- live captures stored in `screenshots/codex-review/`

## Initial Usability Issues Seen

### Shared
- headers are taller than they need to be relative to the actual board content
- too much space goes to framing copy and badges before the user reaches the rows
- the three pages do not yet feel like one tightly related system

### Matrix
- table is information-rich but not yet priority-ranked for manual use
- `Trigger` and `Sizing` columns are placeholder noise right now
- important rows should likely bubble higher inside the selected session
- pair cell can carry more useful summary info so the scan path is shorter

### Swing
- current layout is readable but not sharp enough for fast monitoring
- `Status` is currently raw gate-reason text, which is not good live-trading language
- `Entry` is low-value because it is effectively always `Week Open`
- direction should be more visually dominant at row level

### Intraday
- this is the cleanest of the three, but it can still be tighter
- symbol, asset, direction, tier, and state still compete too evenly
- `FX / Non-FX` is less useful than counts tied to actual row state
- row-state communication can be clearer without changing the logic

## Draft Polish Plan

1. Compress the header treatment across all three surfaces so the board starts higher on the page.
2. Keep the matrix/session-board look as the shared visual anchor.
3. Remove or demote placeholder-only fields that do not help a live decision.
4. Strengthen row hierarchy so the first scan answers:
   - what pair
   - what direction
   - what state
   - why it matters now
5. Improve top-of-board summaries so they reflect actionable counts instead of decorative metrics.
6. Keep qualified / important rows bubbled to the top using existing logic where possible.
7. Re-verify in browser after each pass.

## Specific Candidate Changes Considered

These are not final decisions. They were the working draft before the user paused for more design input.

- Matrix:
  - remove or demote `Trigger` / `Sizing`
  - add compact summary counts for visible directional rows
  - make pair cell carry asset + move + gate/tier cues
  - consider ordering improvements within the selected session

- Swing:
  - reduce table to a tighter set of columns
  - replace raw status text with cleaner live-state language
  - strengthen long/short visual treatment
  - swap weak summary cards for more actionable counts

- Intraday:
  - merge low-value columns into tighter symbol/meta presentation
  - replace `FX / Non-FX` summary with `Hit / Close / Watching` emphasis
  - preserve current row ordering logic that bubbles 1.0 ADR hits to the top
  - keep bullish/bearish row tinting obvious

## Important Status Note

- partial WIP edits were started, then reverted when the redesign discussion was paused
- no flagship component code is intentionally left half-applied from this checkpoint
