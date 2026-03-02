# EA Dashboard Overhaul — Implementation Spec

**Owner:** Freedom_EXE
**Date:** 2026-03-01
**File:** `mt5/Experts/LimniBasketEA.mq5`

---

## Overview

Overhaul the on-chart dashboard for `LimniBasketEA` to:
1. Add a **strategy header banner** identifying which strategy variant is running
2. Show the **weekly lot map in both compact and full modes** (currently hidden in compact)
3. **Group lot map symbols by sector** (Forex, Indices, Commodities, Crypto) with divider headers
4. **Remove the cutoff/overflow** — dynamically size the right panel to show ALL pairs

---

## Current State

| Feature | Current Behavior | Location |
|---------|-----------------|----------|
| Title | `"Limni Basket EA \| [user]"` | Line 6285-6288 |
| Right panel (compact) | Hidden — `mapLines = 0` | Line 5915 |
| Right panel (full) | Shows `SYMBOL class lot`, caps at `LotMapMaxLines` (default 22), truncates with `"... +N more"` | Lines 6385-6427 |
| Symbol order | API response order (unsorted) | Lines 898-913 |
| Strategy ID | `StrategyVariantId` input (default `"universal_v1"`) | Line 18 |
| Asset classes | `g_assetClasses[]` populated from API — values: `fx`, `crypto`, `commodities`, `indices` | Lines 898-913, 3259-3271 |

---

## Target State

### 1. Strategy Header Banner

A new prominent label above the existing title:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UNIVERSAL V1                                 │  ← NEW: strategy banner
│                   Limni Basket EA | freedom                         │  ← existing title
├─────────────────────────────────┬───────────────────────────────────┤
│ [left panel — status]           │ [right panel — lot map]           │
```

- **Source:** Derive display name from `StrategyVariantId` input
  - `"universal_v1"` → `"UNIVERSAL V1"`
  - Transform: replace underscores with spaces, uppercase
- **New input (optional):** `StrategyDisplayName` — override for the banner text. If empty, auto-derive from `StrategyVariantId`.
- **Font:** Same as title (`"Segoe UI Semibold"`) but larger (title size + 4)
- **Color:** Heading teal `C'15,118,110'`
- **Position:** Centered above the existing title label
- **Both modes:** Visible in compact AND full

### 2. Right Panel — Always Visible

Currently `mapLines = 0` in compact mode (line 5915). Change to:

```mql5
// Both modes get the right panel now
int symbolCount = ArraySize(g_brokerSymbols);
int sectorHeaders = 4;  // FOREX, INDICES, COMMODITIES, CRYPTO (+ blank spacers)
int mapLines = MathMax(6, symbolCount + sectorHeaders + 4);  // +4 for spacing buffer
```

**Column layout in compact mode** must also switch from single-column to two-column:
- Lines 5929-5934: Change compact to also compute `g_dashLeftWidth` / `g_dashRightWidth` with the column gap
- Use 50/50 split for compact (equal-width columns) instead of the full mode's 2/3+1/3 split

### 3. Sector-Grouped Lot Map

Replace the current flat list with grouped display:

```
WEEKLY LOT MAP                      ← title (was "LOT MAP")

── FOREX ────────────────
AUDUSD        0.12
EURUSD        0.15
GBPUSD        0.14
USDJPY        0.18
...

── INDICES ──────────────
JPN225        0.03
US500         0.08
US100         0.05

── COMMODITIES ──────────
XAUUSD        0.05
XAGUSD        0.12

── CRYPTO ───────────────
BTCUSD        0.01
ETHUSD        0.03
```

**Implementation approach:**

1. **New helper function: `BuildSectorSortedLotMap()`**
   - Iterates `g_brokerSymbols[]` and `g_assetClasses[]` (parallel arrays)
   - Groups symbols into 4 buckets: `fx`, `indices`, `commodities`, `crypto`
   - Within each bucket, sort alphabetically by broker symbol name
   - Returns a structured array of display lines (sector headers + symbol rows)

2. **Sector header format:** `"── FOREX ────────────────"` (em-dash borders, uppercase label)
   - Sector order: FOREX → INDICES → COMMODITIES → CRYPTO
   - Skip empty sectors (if no symbols for a sector, don't show the header)
   - Add 1 blank line between sectors for visual spacing

3. **Symbol row format:** `"%-14s  %.2f"` — left-aligned symbol (14 chars), right-aligned lot with 2 decimals
   - Use `GetLotForSymbol(symbol, assetClass)` for the lot value (same as current)

4. **Sector color coding** (optional enhancement):
   - Sector headers: heading teal `C'15,118,110'`
   - Symbol rows: standard text color `C'15,23,42'`

### 4. Dynamic Panel Height — No Cutoff

The current overflow logic at lines 6394-6421 truncates with `"... +N more"`. Remove this entirely.

**New approach:**
- Calculate `mapLines` dynamically based on actual symbol count + sector headers
- In `InitDashboard()`: compute `mapLines` AFTER API data is available, or use a generous default and re-init when API data arrives
- Since `InitDashboard()` is called at startup (before API data), and `UpdateDashboard()` runs every tick:
  - Option A: Re-call `InitDashboard()` when API data first arrives (in `PollApiIfDue()` after successful parse)
  - Option B: Pre-allocate `mapLines` to `LotMapMaxLines` (default 22) which should be enough for most configs, but increase default to 40
- **Preferred: Option A** — re-init dashboard after first successful API parse so the panel perfectly fits

**Panel height recalculation:**
```mql5
int rows = MathMax(leftLineCount, mapLines);  // Already done at line 5924
int height = g_dashPadding * 2 + headerHeight + rows * g_dashLineHeight;
```
This already accounts for the taller of the two columns — just need `mapLines` to be correct.

---

## Detailed Code Changes

### A. New Input Parameter (near line 18)

```mql5
input string StrategyDisplayName = "";  // Override display name for dashboard header. If empty, derived from StrategyVariantId.
```

### B. New Helper: `FormatStrategyBanner()` (add near line 2038)

```mql5
string FormatStrategyBanner()
{
  if(StrategyDisplayName != "")
    return StrategyDisplayName;
  // Derive from StrategyVariantId: "universal_v1" → "UNIVERSAL V1"
  string banner = StrategyVariantId;
  StringReplace(banner, "_", " ");
  StringToUpper(banner);
  return banner;
}
```

### C. New Object: `DASH_BANNER` (add near line 346)

```mql5
string DASH_BANNER = "LimniDash_banner";
```

Create in `InitDashboard()` — positioned above `DASH_TITLE`, centered, larger font.

### D. Modified `InitDashboard()` (line 5896)

1. Compute `mapLines` dynamically for both modes (not 0 for compact)
2. Create `DASH_BANNER` label object
3. Shift all content down by one banner line height
4. Compute two-column layout for compact mode

### E. New Helper: `BuildSectorLotMap()` (add near line 6385)

Replaces the current flat lot map rendering (lines 6385-6427).

```
Pseudocode:
1. Create 4 arrays (one per sector)
2. Loop g_brokerSymbols[], classify each into sector bucket by g_assetClasses[]
3. Sort each bucket alphabetically
4. For each non-empty sector:
   a. Render sector header line: "── SECTOR ────────────────"
   b. Render each symbol: "SYMBOL        0.00"
   c. Render blank spacer line
5. Fill remaining right-panel lines with " " (blank)
```

### F. Modified `UpdateDashboard()` (line 6125)

1. Set `DASH_BANNER` text via `FormatStrategyBanner()` — both modes
2. In compact mode: call `BuildSectorLotMap()` instead of blanking right panel
3. In full mode: call `BuildSectorLotMap()` instead of the current flat rendering
4. Rename `DASH_MAP_TITLE` from `"LOT MAP"` to `"WEEKLY LOT MAP"`

### G. Dashboard Re-init After API Parse

In `PollApiIfDue()` after successful `ParseApiResponse()` (around line 870):
```mql5
// Re-init dashboard to resize for actual symbol count
if(ShowDashboard && g_dashboardNeedsResize)
{
  InitDashboard();
  g_dashboardNeedsResize = false;
}
```

Add `bool g_dashboardNeedsResize = true;` as a global flag, set to `true` when symbol count changes.

### H. `DestroyDashboard()` — Cleanup

Add `ObjectDelete(0, DASH_BANNER);` alongside the existing cleanup.

---

## Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              UNIVERSAL V1                                               │
│                         Limni Basket EA | freedom                                       │
├──────────────────────────────────────────┬──────────────────────────────────────────────┤
│ STATUS                                   │ WEEKLY LOT MAP                               │
│ state=ACTIVE trading=allowed api=ok      │                                              │
│ Broker: TheFunders-Server                │ ── FOREX ──────────────────                  │
│ Server: ... | Exec: ...                  │ AUDUSD        0.12                           │
│ class=5ers profile=uv1 user=freedom      │ EURUSD        0.15                           │
│ basket_guard=... trail=...               │ GBPUSD        0.14                           │
├──────────────────────────────────────────┤ USDJPY        0.18                           │
│ SYNC                                     │ NZDUSD        0.09                           │
│ snapshot=week_2026-02-23 ready           │ USDCAD        0.11                           │
│ cache=fresh | poll=4m32s                 │ USDCHF        0.13                           │
│ report=2026-02-28                        │ EURJPY        0.16                           │
│ refresh=12:04:33                         │ GBPJPY        0.21                           │
├──────────────────────────────────────────┤ EURGBP        0.10                           │
│ ACCOUNT                                  │                                              │
│ Eq:$52,340  Bal:$50,000  Free:$48,200    │ ── INDICES ────────────────                  │
│ PnL: +4.68%  Locked: 1.2%  Trail: ON    │ JPN225        0.03                           │
│ Max DD: 2.1% | Peak: $53,100            │ US500         0.08                           │
├──────────────────────────────────────────┤ US100         0.05                           │
│ POSITIONS                                │ GER40         0.04                           │
│ Pos:8 Lots:1.24 OPM:0.3                 │                                              │
│ Planned: A12 B6 D3 C2 S1                │ ── COMMODITIES ────────────                  │
├──────────────────────────────────────────┤ XAUUSD        0.05                           │
│ CHECKS                                   │ XAGUSD        0.12                           │
│ Alerts: none | pairs=24/24 miss=none     │ USOIL         0.08                           │
│                                          │                                              │
│                                          │ ── CRYPTO ────────────────                   │
│                                          │ BTCUSD        0.01                           │
│                                          │ ETHUSD        0.03                           │
└──────────────────────────────────────────┴──────────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Strategy banner displays correctly with `StrategyVariantId = "universal_v1"` → shows "UNIVERSAL V1"
- [ ] Strategy banner displays correctly with custom `StrategyDisplayName` override
- [ ] Lot map visible in COMPACT mode (was previously hidden)
- [ ] Lot map visible in FULL mode (was already visible, verify no regression)
- [ ] Symbols grouped by sector: FOREX, INDICES, COMMODITIES, CRYPTO
- [ ] Empty sectors are not shown (no empty header)
- [ ] ALL symbols displayed — no cutoff, no "... +N more"
- [ ] Panel height auto-adjusts to fit all symbols
- [ ] Dashboard re-inits properly after API data arrives
- [ ] Lot values match `GetLotForSymbol()` output
- [ ] Symbols within each sector are alphabetically sorted
- [ ] Dashboard looks correct on first load (before API data — empty lot map is fine)
- [ ] `DestroyDashboard()` properly cleans up the new DASH_BANNER object
