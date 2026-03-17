# Codex Prompt — Session Backtest v2: Pair Lockout + Daily 7pm Variant

## Objective
Modify `scripts/backtest-session-top-pick.ts` to fix the pair-reselection problem and add a daily fixed-time variant. Two targeted changes, no rewrite.

## Context
- The project is a Next.js app at `C:/Users/User/Documents/GitHub/limni-website`
- The script exists at `scripts/backtest-session-top-pick.ts` and runs correctly
- Problem discovered: the scorer keeps picking the same top-scoring pair (e.g. EURCHF) in every session. The existing dedup (`openedTradesByWeek`) sets `contributionPnl = 0` for re-picks, resulting in 108/120 sessions being FLAT. The gate is fine (~6 pass candidates per session avg), but selection logic doesn't exclude already-opened pairs from the candidate pool.
- Session windows: Asia 0-8 UTC, London 8-13 UTC, NY 13-21 UTC
- 7pm ET = 23:00 UTC (EST) or 23:00 UTC (EDT). Use 23:00 UTC as the fixed daily entry time.

## Change 1: Pair lockout in session selection

**Current behavior (broken):** Already-opened pairs are still scored and selected, but get `contributionPnl = 0`. This wastes the session pick on a pair that can't contribute.

**New behavior:** Before scoring candidates for a session, filter out any pair already in `openedTradesByWeek`. This forces each session to pick a NEW pair that hasn't been traded yet this week.

### Implementation

In the main loop (around line 770-806), move the lockout check BEFORE scoring:

```typescript
for (const entry of weeklyCandidates) {
  const signal = entry.signal;
  if (!isSessionEligible(signal, session.name)) continue;

  // NEW: Skip pairs already opened this week (pair lockout)
  const pairWeekKey = `${weekOpenUtc}|${signal.pair}`;
  if (openedTradesByWeek.has(pairWeekKey)) continue;

  // ... rest of overlay evaluation, scoring, candidate push
}
```

Then in the selection block (lines 810-815), remove the `alreadyOpened` check since it's no longer possible — every selected pair is guaranteed to be new:

```typescript
for (const pick of selected) {
  const pairWeekKey = `${weekOpenUtc}|${pick.signal.pair}`;
  openedTradesByWeek.add(pairWeekKey);
  const contributionPnl = pick.pnlPct ?? 0;
  // ... rest stays the same but use contributionPnl directly (no alreadyOpened guard)
}
```

This means:
- Monday Asia picks the highest-scoring pair (e.g. EURCHF) → locked for the week
- Monday London picks the next-best eligible pair (e.g. GBPUSD) → locked
- Monday NY picks the next-best NY-eligible pair → locked
- Tuesday Asia picks from remaining unlocked pairs
- etc.

Sessions with zero remaining unlocked PASS candidates become genuine NO_TRADE sessions.

## Change 2: Add `--variant` CLI flag for daily 7pm mode

Add a new CLI flag:
```
--variant=VARIANT   "session" (default, current 3-sessions-per-day) or "daily-7pm" (one pick per day at 23:00 UTC)
```

### Implementation

Add `variant` to `CliConfig`:
```typescript
type BacktestVariant = "session" | "daily-7pm";

// In CliConfig:
variant: BacktestVariant;
```

Parse it in `parseArgs()`:
```typescript
const variantRaw = String(byKey.get("variant") ?? "session").trim().toLowerCase();
// In return:
variant: variantRaw === "daily-7pm" ? "daily-7pm" : "session",
```

In the main loop, replace the `for (const session of SESSION_DEFS)` block with a conditional:

```typescript
if (config.variant === "daily-7pm") {
  // Single pick at 23:00 UTC (7pm ET)
  const entryTime = day.set({ hour: 23, minute: 0, second: 0 });
  // Session end = next day 00:00 UTC (for concurrent trade tracking)
  const exitTime = day.plus({ days: 1 }).startOf("day");

  // All PASS candidates eligible (no session filter — 7pm is off-hours,
  // but this is the daily entry point, not a session-specific window)
  const candidates: ScoredCandidate[] = [];
  for (const entry of weeklyCandidates) {
    const signal = entry.signal;
    const pairWeekKey = `${weekOpenUtc}|${signal.pair}`;
    if (openedTradesByWeek.has(pairWeekKey)) continue;

    const overlay = signal.assetClass === "crypto"
      ? evaluateDailyCryptoOverlay(signal, entry.weekDecision, entry.weekReasons, entryTime, liqByPair.get(signal.pair) ?? [])
      : evaluateNonCryptoOverlay(entry.weekDecision, entry.weekReasons, config.strict);

    if (!shouldPassOverlay(signal, overlay, config.strict)) continue;

    const summary = pairSummaryCache.has(signal.pair)
      ? pairSummaryCache.get(signal.pair) ?? null
      : readPairSummary(signal.pair);
    if (!pairSummaryCache.has(signal.pair)) pairSummaryCache.set(signal.pair, summary);

    signal.actionable8w = summary?.pricedTrades ?? 0;
    signal.flips8w = 0;
    signal.consistency8w = summary ? Math.max(0, Math.min(1, summary.winRatePct / 100)) : 0.5;
    const scored = scoreSignal(signal, summary);
    const pnl = await computePickPnl(config.mode, signal, entryTime, exitTime, sessionPnlCache);

    candidates.push({
      signal,
      weekGateDecision: entry.weekDecision,
      weekGateReasons: entry.weekReasons,
      overlay,
      score: scored.score,
      notes: scored.notes,
      pnlPct: pnl.pnlPct,
      pnlSource: pnl.pnlSource,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.signal.pair.localeCompare(b.signal.pair));
  const selected = pickTopWithCorrelationCap(candidates, config.topN);

  // ... same contribution/outcome/sessionRow logic as session variant
  // Use session name "DAILY_7PM" for tracking (add to SessionName type)
  // sessionStartUtc = entryTime, sessionEndUtc = exitTime
}
```

Update the `SessionName` type:
```typescript
type SessionName = "ASIA" | "LONDON" | "NY" | "DAILY_7PM";
```

Update `perSessionCounts` and `perSessionReturns` initialization to handle the daily-7pm variant:
- When `variant === "daily-7pm"`, only create the `DAILY_7PM` entry
- When `variant === "session"`, create ASIA/LONDON/NY as before

Update `bySession` in the summary: when `variant === "daily-7pm"`, report a single `DAILY_7PM` key instead of three session keys.

Update `totalTradingSessions` calculation:
- `session` variant: `weeks × 5 × 3`
- `daily-7pm` variant: `weeks × 5 × 1`

Update console output header to show the variant.

## Change 3: Update console output

Add variant to the header:
```
=== Session-Level Top Pick Backtest ===
Profile: Bitget MT5
Mode: weekly-attr
Variant: session (pair lockout)
Top N: 1
Weeks: 8
```

## Change 4: Update JSON output metadata

Add `variant` to the config object in the JSON output. Add a note explaining pair lockout:
```typescript
notes: [
  ...,
  "Pair lockout: once a pair is selected in any session, it is excluded from all subsequent sessions that week.",
  "daily-7pm variant: single pick per day at 23:00 UTC (7pm ET), no session eligibility filter.",
]
```

## Do NOT
- Do not rewrite the entire file — make targeted edits only
- Do not modify any other files except `package.json` if a new npm script is needed
- Do not add npm dependencies
- Do not create README or documentation files
- Do not change the COT gate logic, scoring formula, or overlay evaluation
- Do not change session eligibility rules
- Do not modify the `weekly-attr` vs `session-pnl` P&L attribution logic
