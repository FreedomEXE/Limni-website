# Codex Prompt — Flagship UI Implementation

## Objective
Create a new `/flagship` route that serves as the primary manual trading decision page. Migrate gated setup presentation out of Performance. Update navigation.

## Context
- The project is a Next.js app at `C:/Users/User/Documents/GitHub/limni-website`
- An existing gated setup component exists at `src/components/performance/PerformanceGatedSetups.tsx` — it fetches from `/api/performance/gated-setups` and renders a filterable table of PASS/SKIP/NO_DATA signals
- The API route at `src/app/api/performance/gated-setups/route.ts` already returns the full payload with dynamic overlays (crypto liquidation + MenthorQ gamma)
- A daily trade selector script exists at `scripts/select-daily-max-conviction-trade.ts` with a `scoreSignal()` function and Bitget MT5 profile filtering
- Session windows are already defined in `src/lib/bitgetBotSignals.ts` (lines 88-101): Asia 0-8 UTC, London 8-13 UTC, NY 13-21 UTC
- Display timezone is ET (Eastern Time), defined in `src/lib/time.ts`

## File header standard
Every new code file must include this header (adapt description per file):
```
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: <filename>
 *
 * Description:
 * <high-level description>
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
```

## Tasks

### 1. Navigation update — ALREADY DONE
**File:** `src/components/DashboardLayout.tsx` — **No changes needed. These are already applied:**
- `TOP_LEVEL` array has Flagship entry (line 41): `{ key: "flagship", href: "/flagship", label: "Flagship", letter: "I" }`
- `SECTION_LABELS` includes `flagship: "Flagship"` (line 50)
- `resolveSection()` handles `/flagship` (line 61)
- Flagship subnav with Board + Research tabs (lines 164-169)
- Status moved under News subnav (line 161)
- Nav order: Data, Performance, Automation, Accounts, Flagship, News

**Do NOT modify `DashboardLayout.tsx`.**

### 2. Move Status to secondary access — ALREADY DONE
- Status is now a subnav item under News (line 161 in DashboardLayout.tsx)
- Status page at `src/app/status/page.tsx` remains as-is, accessible via direct URL `/status`
- No code changes needed.

### 3. Create Flagship route
**Create:** `src/app/flagship/page.tsx`

This is a server component page that renders inside `DashboardLayout`. Structure:

```typescript
import DashboardLayout from "@/components/DashboardLayout";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";

export const dynamic = "force-dynamic";

export default function FlagshipPage() {
  return (
    <DashboardLayout>
      <FlagshipBoard />
    </DashboardLayout>
  );
}
```

### 4. Create FlagshipBoard component
**Create:** `src/components/flagship/FlagshipBoard.tsx`

This is a `"use client"` component. It is the core of the Flagship page.

**Data source:** Fetch from `/api/performance/gated-setups` (same API the existing `PerformanceGatedSetups` uses).

**Tradable universe filter (includes indices for prop accounts):**
- FX: all pairs allowed
- Commodities: only XAUUSD, XAGUSD
- Crypto: only BTCUSD, ETHUSD
- Indices: SPXUSD, NDXUSD, NIKKEIUSD allowed

**Gate decisions shown:** PASS and SKIP only. If the API returns NO_DATA, display it as SKIP with a note "(no data)".

**Session awareness:**
- Detect current UTC hour and classify into session: Asia (0-8), London (8-13), NY (13-21), or Off-hours (21-0)
- Display the active session prominently at the top
- Show a session timeline bar (horizontal) with Asia/London/NY blocks, current session highlighted
- Filter signals by session eligibility:
  - **FX pairs**: Eligible in all sessions (forex trades 24/5)
  - **XAUUSD, XAGUSD**: Eligible in London and NY sessions only (metals less liquid in Asia)
  - **BTCUSD, ETHUSD**: Eligible in all sessions (crypto trades 24/7, no session concept)
  - **NIKKEIUSD**: Eligible in Asia and London sessions only
  - **SPXUSD, NDXUSD**: Eligible in NY session only (US equity index hours)
- During Off-hours (21-0 UTC): show all signals but display a "Markets closed" banner. No TOP PICK designation during off-hours.

**Conviction scoring:**
- Port the `scoreSignal()` logic from `scripts/select-daily-max-conviction-trade.ts` (lines 182-224) into a shared utility or inline it
- Rank PASS signals by score descending
- Highlight the top pick with a distinct visual treatment (border accent, "TOP PICK" badge)

**Per-signal card/row display:**
- Pair name
- Direction (LONG/SHORT) with color coding (green/red)
- Asset class
- Tier (HIGH/MEDIUM)
- Gate decision (PASS badge green, SKIP badge red)
- Gate reason codes (as tags)
- Gate source (WEEKLY_BOARD, CRYPTO_LIQUIDATION_LIVE, MENTHORQ_GAMMA_DAILY, etc.)
- Conviction score (numeric)
- Max leverage for this asset class (FX: 500x, Metals: 100x, Crypto: 75x, Indices: 100x)
- Consistency 8w (percentage)
- Timestamp / freshness indicator (gate as-of UTC, formatted in ET)

**Strict overlay enforcement:**
- Crypto signals require `gateDecisionSource === "CRYPTO_LIQUIDATION_LIVE"` to show as PASS
- Non-crypto signals require `gateDecisionSource` to include "MENTHORQ" to show as PASS
- Signals failing strict overlay are shown as SKIP with reason "incomplete overlay data"

**No-trade state:**
- If zero PASS signals survive filtering, display a clear "No actionable setups this session" message
- List dropped signals with reasons (similar to what `select-daily-max-conviction-trade.ts` does with `droppedByStrictOverlay`)

**Strategy selector:**
- Add an environment variable `FLAGSHIP_STRATEGY` (default: `universal_v1_gated`)
- Display the active strategy name in the header
- This is read-only for now — the API already serves signals for the active strategy. No UI toggle needed yet.

### 5. Remove gated setups from Performance
**File:** `src/components/performance/PerformanceViewSection.tsx`

- Remove the `view === "setups"` conditional block (around line 271-273)
- Remove the import of `PerformanceGatedSetups` (line 11)
- Do NOT delete `src/components/performance/PerformanceGatedSetups.tsx` — keep it as reference. The new `FlagshipBoard` replaces it functionally.

### 6. Styling requirements
- Use the existing design system: `var(--panel)`, `var(--panel-border)`, `var(--foreground)`, `var(--muted)`, `var(--accent)`, `var(--accent-strong)`
- Match the visual density and typography of existing components (see `PerformanceGatedSetups.tsx` for reference)
- Responsive: must work on both desktop and mobile
- Use existing Tailwind classes — do NOT add new CSS files
- Dark mode support via existing CSS variables (the theme toggle is already in the layout)

## Do NOT
- Do not create new API routes — use the existing `/api/performance/gated-setups`
- Do not modify the gated-setups API route
- Do not create wrapper components or abstraction layers — inline the logic
- Do not add npm dependencies
- Do not touch any backtest scripts
- Do not create README or documentation files
