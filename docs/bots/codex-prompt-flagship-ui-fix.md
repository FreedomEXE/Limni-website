# Codex Prompt — FlagshipBoard Bug Fixes

## Objective
Fix 6 bugs in `src/components/flagship/FlagshipBoard.tsx`. Do NOT rewrite the file — make targeted edits only.

## Context
- The project is a Next.js app at `C:/Users/User/Documents/GitHub/limni-website`
- `src/components/flagship/FlagshipBoard.tsx` was just created and has bugs
- The existing design system uses CSS variables: `var(--panel)`, `var(--panel-border)`, `var(--foreground)`, `var(--muted)`, `var(--accent)`, `var(--accent-strong)`
- Dark mode is already supported via these CSS variables. Hard-coded Tailwind color classes like `bg-emerald-50` or `bg-white` break in dark mode.

## File to modify: `src/components/flagship/FlagshipBoard.tsx`

### Fix 1: Add indices to tradable universe filter

**Problem:** `isTradableBitget()` (line ~106-114) only handles `fx`, `commodities`, and `crypto`. Indices (SPXUSD, NDXUSD, NIKKEIUSD) are silently filtered out.

**Fix:** Add an `indices` case to `isTradableBitget()`:
```typescript
const ALLOWED_INDICES = new Set(["SPXUSD", "NDXUSD", "NIKKEIUSD"]);
```
Then in `isTradableBitget()`:
```typescript
if (asset === "indices") return ALLOWED_INDICES.has(pair);
```

Also fix `getMaxLeverage()` (line ~116-122) to return `100` for `indices`:
```typescript
if (asset === "indices") return 100;
```

### Fix 2: Replace session eligibility with spec-correct rules

**Problem:** `sessionTagsForSignal()` (line ~132-145) uses a currency-pair heuristic (checking for JPY, AUD, EUR, etc.) instead of the correct rules. This is completely wrong.

**Replace the entire `sessionTagsForSignal()` function with:**
```typescript
function sessionTagsForSignal(signal: GatedSetupSignal): SessionName[] {
  const asset = normalizeAsset(signal.assetClass);
  const pair = toUpper(signal.pair);

  // Crypto: eligible in all sessions (trades 24/7, no session concept)
  if (asset === "crypto") return ["ASIA", "LONDON", "NY"];

  // FX: eligible in all sessions (forex trades 24/5)
  if (asset === "fx") return ["ASIA", "LONDON", "NY"];

  // Commodities: London and NY only (metals less liquid in Asia)
  if (asset === "commodities") return ["LONDON", "NY"];

  // Indices: pair-specific
  if (asset === "indices") {
    if (pair === "NIKKEIUSD") return ["ASIA", "LONDON"];
    // SPXUSD, NDXUSD: NY only
    return ["NY"];
  }

  // Default fallback
  return ["LONDON", "NY"];
}
```

### Fix 3: Add "Markets closed" banner during off-hours

**Problem:** During off-hours (21-0 UTC), there is no banner indicating markets are closed.

**Fix:** Add a banner right after the session timeline bar (after the `SESSION_BLOCKS` grid, around line ~376), inside the `<header>` block:

```tsx
{currentSession === "OFF" ? (
  <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-center text-sm font-semibold text-[color:var(--muted)]">
    Markets closed — off-hours (21:00–00:00 UTC). Showing all signals for preview.
  </div>
) : null}
```

### Fix 4: Suppress TOP PICK during off-hours

**Problem:** The top pick card shows during off-hours. The spec says "No TOP PICK designation during off-hours."

**Fix:** Change the condition on the top pick article (around line ~416) from:
```tsx
{!loading && !error && topPick ? (
```
to:
```tsx
{!loading && !error && topPick && currentSession !== "OFF" ? (
```

### Fix 5: Fix dark mode — replace hard-coded colors with CSS variables

**Problem:** Multiple places use hard-coded Tailwind colors that break in dark mode:
- `border-emerald-300 bg-emerald-50 text-emerald-700` (PASS pill)
- `border-rose-300 bg-rose-50 text-rose-700` (SKIP pill)
- `border-amber-300 bg-amber-50 text-amber-800` (no-trade state)
- `bg-white` (dropped signals table)
- `bg-amber-100/70`, `text-amber-900` (table header)
- Various other hard-coded amber, emerald, rose colors

**Fix:** Replace the `decisionPillClass()` function:
```typescript
function decisionPillClass(decision: "PASS" | "SKIP") {
  return decision === "PASS"
    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
    : "border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-400";
}
```

Replace the no-trade state container (around line ~443-468). Change:
- `border-amber-300 bg-amber-50` → `border-[var(--panel-border)] bg-[var(--panel)]/60`
- `text-amber-800` → `text-[color:var(--muted)]`
- `bg-white` → `bg-[var(--panel)]`
- `border-amber-200` → `border-[var(--panel-border)]`
- `bg-amber-100/70` → `bg-[var(--panel)]/70`
- `text-amber-900` → `text-[var(--foreground)]`
- `text-amber-800` → `text-[var(--foreground)]/80`
- `border-amber-100` → `border-[var(--panel-border)]`

Also in the error state (line ~411): change `border-rose-300 bg-rose-50 text-rose-700` to `border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-400`.

Direction colors in `directionClass()` are acceptable as-is (emerald-600/rose-600 work in both themes).

### Fix 6: Add gate reason tags to board view table

**Problem:** The board view table does not show gate reason codes. The spec requires "Gate reason codes (as tags)" per signal row.

**Fix:** Add a "Reasons" column to the board table. In the `<thead>` row, add after the "Gate" column:
```tsx
<th className="px-3 py-2">Reasons</th>
```

In the `<tbody>` row, add after the Gate `<td>`:
```tsx
<td className="max-w-[200px] px-3 py-2">
  <div className="flex flex-wrap gap-1">
    {row.effectiveReasons.map((reason) => (
      <span
        key={reason}
        className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-1.5 py-0.5 text-[9px] text-[var(--foreground)]/70"
      >
        {reason}
      </span>
    ))}
  </div>
</td>
```

## Do NOT
- Do not rewrite the entire file — make targeted edits only
- Do not modify any other files
- Do not add npm dependencies
- Do not modify `DashboardLayout.tsx`
- Do not change the scoring logic, data fetching, or strict overlay enforcement — those are correct
- Do not create README or documentation files
