# Codex Prompt: DCA Daily Layering Research

**Date:** 2026-04-02
**Author:** Nyx
**Priority:** HIGH — Final piece before live system decision
**Depends on:** `scripts/backtest-scaled-prop-consistency.ts` (read for data loading patterns)

---

## Context

We've identified **2-of-3 NoComm at 1/5 scale with trailing (TR 1/0.5)** as the best weekly hold system for prop accounts: 9/10 weeks hitting +1%, only 1 losing week, -1.76% max DD.

Now we want to test whether **entering the basket in daily layers** (DCA) instead of a single Monday entry improves or hurts consistency.

### The DCA idea

Instead of entering the full 1/5 position on Monday:
- Enter a **smaller layer** each day at that day's open price
- Keep adding layers until the basket hits the trailing activation level (+1% total account P&L)
- Once trailing activates → stop adding, trail by 0.5%
- Cap at a max number of layers (don't add on Thursday/Friday if we're already deep in a losing week)

**Why this might help:**
- On medium weeks, later layers enter at better averaged prices after a pullback
- On strong weeks, you bank early with fewer layers (less capital at risk)
- Natural position sizing adaption — strong moves get less capital, weak moves get more layers

**Why this might hurt:**
- On losing weeks, you're averaging into a losing position
- More layers = more exposure by mid-week on bad weeks
- Total return might drop because early layers are smaller than the 1/5 single entry

### What we're comparing against

The benchmark is the **single Monday entry** from the scaled research:
```
2-of-3 NoComm @ 1/5 scale, TR 1/0.5
Return: +30.68%, MaxDD: -1.76%, 9/10 weeks ≥ 1%, 1 losing week
```

---

## Task: `scripts/backtest-dca-layering.ts`

### Data Required

For each week, we need **daily open prices** for every pair in the basket. This is different from the previous scripts that only tracked daily close P&L.

- Use `canonical_price_bars` (timeframe='1d') to get daily opens within each week
- Each layer enters at that day's open price for all pairs in the basket
- The basket direction (LONG/SHORT per pair) is the same for all layers — it's determined by the strategy at week open. Only the entry price changes per layer.

### Core Mechanics

**Layer entry:**
```
Layer 1: Monday open   → enter all basket pairs at Monday's open price
Layer 2: Tuesday open  → enter same pairs at Tuesday's open price
Layer 3: Wednesday open → enter same pairs at Wednesday's open price
...etc
```

**Per-layer P&L at any point:**
```
layer_pnl = sum of each pair's: (current_price - layer_entry_price) / layer_entry_price * direction * adr_multiplier * layer_scale
```

**Total account P&L:**
```
total_pnl = sum of all active layers' P&L
```

**Trailing operates on total account P&L:**
- When `total_pnl >= activation_level` → trailing active, stop adding new layers
- Track peak total_pnl. If it drops by trail_distance → close ALL layers
- If trailing never activates → hold all layers to Friday close

**Layer addition stops when:**
1. Trailing activates (we hit the profit target)
2. Max layers reached
3. It's Thursday or later and basket is losing (optional safety rule — test with and without)

### DCA Configurations to Test

**For 2-of-3 NoComm only** (our winner):

```
Total target exposure: 1/5 of full size (same as the single-entry winner)

Layer configs:
  A) 2 layers:  1/10 each, Mon + Tue           (total = 1/5 if both enter)
  B) 3 layers:  1/15 each, Mon + Tue + Wed      (total = 1/5 if all enter)
  C) 4 layers:  1/20 each, Mon-Thu              (total = 1/5 if all enter)
  D) 5 layers:  1/25 each, Mon-Fri             (total = 1/5 if all enter)

  E) Front-loaded 3 layers: 1/8 Mon, 1/12 Tue, 1/24 Wed  (total ≈ 1/5)
  F) Front-loaded 2 layers: 1/7 Mon, 1/14 Tue             (total ≈ 1/5)
```

**Trailing configs** (apply to each DCA config):
```
TR 1/0.5      (our current winner — activate at +1%, trail 0.5%)
TR 0.75/0.5   (tighter activation)
TR 1.25/0.5   (looser activation)
```

**Safety rule variants:**
```
S0: No safety — add layers on schedule regardless of P&L
S1: Skip layer if current total_pnl < -1% (stop averaging into deep losers)
S2: Skip layer if current total_pnl < -0.5%
```

**Total test matrix:** 6 DCA configs × 3 trailing configs × 3 safety rules = **54 combos**

Plus the single-entry benchmark for direct comparison.

### Phase 1: DCA vs Single Entry (Core Question)

For each of the 54 combos, report:

| Metric | Description |
|--------|-------------|
| Total return (%) | Sum of all weekly returns |
| Max DD (%) | Equity curve peak-to-trough |
| R/DD | Return / abs(DD) |
| Weeks ≥ 1% | How many weeks hit the prop target |
| Losing weeks | Weeks with negative return |
| Worst week (%) | Single worst week |
| Worst EOD day proxy (%) | Worst single day across all weeks |
| Avg layers used | How many layers entered per week on average |
| Avg total exposure | Average position size deployed (may be < 1/5 if trail fires early) |
| Trail fires | How many weeks trailing activated |
| Avg day trail fires | Average day number when trail activates (D1=Monday) |

**Output:** Table sorted by consistency (weeks ≥ 1%), then R/DD. Top row should be highlighted as winner. Include the single-entry benchmark row for comparison.

### Phase 2: Week-by-Week for Top 5 + Benchmark

For the top 5 DCA configs plus the single-entry benchmark, show per-week:

```
Week       Return     Exit     Day    Layers   Exposure   Target   Daily total P&L path
```

Where:
- **Layers**: how many layers were actually entered (e.g., "2/3" = 2 of 3 possible)
- **Exposure**: total position size deployed as fraction (e.g., "2/15" if 2 of 3 layers entered at 1/15 each)
- **Target**: did we hit ≥ 1%?
- **Daily total P&L path**: account-level P&L at each day's close across all active layers

Also show for each week: **which day each layer entered** and **the layer's individual P&L at exit**.

### Phase 3: DCA Impact Analysis

Compare the top DCA config vs single-entry benchmark:

For each of the 10 weeks, show:
```
Week | Single-entry return | DCA return | Delta | Why different
```

Where "Why different" categorizes:
- **DCA better: averaged in** — later layers entered at better prices, improving P&L
- **DCA better: less exposed** — trail fired before all layers entered, less capital at risk
- **DCA worse: averaged into loser** — added layers to a losing week
- **DCA worse: less capital deployed** — missed upside because layers entered late
- **Same** — identical or negligible difference

---

## Implementation Notes

### Daily open prices
```typescript
// For each pair in the basket, load daily bars for the week
const bars = await getCanonicalBars(symbol, '1d', weekStart, weekEnd);

// Layer N enters at day N's open price
// Layer N's P&L at day D's close = (dayD_close - dayN_open) / dayN_open * direction * multiplier * layerScale
```

### P&L tracking across layers
```typescript
type Layer = {
  dayEntered: number;  // 0=Monday, 1=Tuesday, etc.
  scale: number;       // e.g., 1/15
  positions: Array<{
    symbol: string;
    direction: "LONG" | "SHORT";
    entryPrice: number;
    adrMultiplier: number;
  }>;
};

// At any day's close, total account P&L:
function totalPnl(layers: Layer[], dayIndex: number, dailyBars: Map<string, Bar[]>): number {
  let total = 0;
  for (const layer of layers) {
    for (const pos of layer.positions) {
      const bar = getDayBar(dailyBars, pos.symbol, dayIndex);
      if (!bar) continue;
      const raw = ((bar.closePrice - pos.entryPrice) / pos.entryPrice) * 100;
      const directed = pos.direction === "SHORT" ? -raw : raw;
      total += directed * pos.adrMultiplier * layer.scale;
    }
  }
  return total;
}
```

### Reuse from existing scripts
- Strategy direction resolution: same `computeWeeklyHold()` call to get the basket and directions
- ADR maps: same `loadWeeklyAdrMap()` + `getAdrPct()` for multipliers
- Daily bars: same `getCanonicalBars()` loading pattern
- Metric aggregation: same `computeMaxDrawdown()` and consistency scoring

### Strategy to test
**Only 2-of-3 NoComm** (`agree_2of3_nocomm`). This is not a multi-strategy sweep — it's a focused test on our winner to see if DCA layering improves or hurts its already-excellent profile.

---

## Output Format

```
╔══════════════════════════════════════════════════════════════════╗
║   DCA DAILY LAYERING RESEARCH                                   ║
║   2-of-3 NoComm — does daily re-entry beat single Monday entry? ║
║   Engine: f2=adr_normalized (app parity)                        ║
║   Target: 1-2% per week consistently                            ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Execution

```bash
npx tsx scripts/backtest-dca-layering.ts
```

Production DB, same as all research scripts.

---

## What NOT To Do

- Do NOT test other strategies — only 2-of-3 NoComm
- Do NOT modify production code
- Do NOT change ADR normalization logic — it stays at full size, DCA layer scale is on top
- Do NOT skip the single-entry benchmark row — that's the whole point of comparison
- Do NOT add SL to this research — DD is not the concern at these scales

---

## Success Criteria

1. Script runs clean
2. Single-entry benchmark matches: +30.68% return, -1.76% DD, 9/10 weeks (validates data loading)
3. All 54 DCA combos produce results
4. Phase 3 impact analysis clearly shows whether DCA helped or hurt per week
5. Output answers: **should Freedom enter once on Monday or layer in daily?**
