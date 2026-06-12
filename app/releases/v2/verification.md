# v2 Verification

Documented: 2026-06-03
Updated: 2026-06-09

This file records the verification state for the v2.0.3 live release.

## Current v2.0.3 Gate - Institutional Seed

The current v2.0.3 release is the institutional-seed runtime, not the earlier
TradingView/data-verification lane.

Recorded final gate result:

- active baseline id: `v2.0.3-institutional-seed`
- closed active weeks: `15`
- latest closed active week: `2026-05-31T23:00:00.000Z` / displayed Jun 01 2026
- current live week: `2026-06-07T23:00:00.000Z` / displayed Jun 08 2026
- source-freeze receipts: `15/15`
- canonical and execution weekly returns: `1080/1080`
- strategy week shards: `180/180`
- Data route readiness: `15/15`
- Performance route readiness: `15/15`

Evidence:

- `screenshots/weekly-rollover-active-baseline-2026-06-09/status-cron-lifecycle-final.png`
- `screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-june8-freeze-ledger-ready.png`
- `screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-freeze-ledger-live-overlay.png`
- `screenshots/weekly-rollover-active-baseline-2026-06-09/cron-source-freeze-current-final-evidence.json`
- `screenshots/weekly-rollover-active-baseline-2026-06-09/cron-active-baseline-certification-final-evidence.json`
- `screenshots/weekly-rollover-active-baseline-2026-06-09/current-week-api-loss-count-aligned-evidence.json`

Final cleanup must rerun the gate from the staged tree before commit or push.

## Automated Checks

Focused tests passed:

```powershell
npm test -- --run src/lib/__tests__/engineAdapter.test.ts src/lib/__tests__/strategySelectionBootstrap.test.ts src/lib/__tests__/strategyConfigSelectionNormalization.test.ts src/lib/__tests__/weekAnchor.test.ts src/lib/__tests__/strategyPayloadCompleteness.test.ts
```

Result:

- 5 test files passed.
- 20 tests passed.

Production build passed:

```powershell
npm run build
```

Notes:

- Build passed.
- Existing unrelated Turbopack broad-pattern warnings remain in performance/gated setup and file-reading routes.

## Playwright Browser Verification

Server:

- Fresh production server on `http://localhost:3111`
- Built from local workspace after v2.0.3 release changes.

Flow tested:

1. Load Performance with Tandem / ADR Grid / Pair Fill Cap.
2. Wait for global app gate release.
3. Navigate Performance to Data by sidebar.
4. Navigate Data to Accounts by sidebar.
5. Navigate Accounts to Performance by sidebar.
6. Switch strategy to Tiered / ADR Grid / None.
7. Switch strategy back to Tandem / ADR Grid / Pair Fill Cap.

Observed timings:

- Initial Performance gate release: `14.989s`
- Performance to Data: `16.943s`
- Data to Accounts: `1.645s`
- Accounts to Performance: `5.118s`
- Tiered ADR Grid no-cap switch: `1.902s`
- Tandem ADR Grid Pair Fill Cap switch: `10.734s`

Result:

- Passed.
- No global preloader appeared during page switches after first release.
- No global preloader appeared during strategy switches after first release.
- Risk Overlay `None` remained selectable for ADR Grid.
- Pair Fill Cap remained selectable and worked when switching back to Tandem.

Screenshots promoted to app-visible release archive:

- `screenshots/performance/v2.0.2-live-tandem-adr-grid-pair-fill-cap-summary.png`
- `screenshots/performance/v2.0.3-local-tandem-adr-grid-pair-fill-cap-summary.png`
- `screenshots/performance/v2.0.2-live-tandem-adr-grid-pair-fill-cap-simulation.png`
- `screenshots/performance/v2.0.3-local-tandem-adr-grid-pair-fill-cap-simulation.png`

Status update after ADR Grid P/L unit review:

- The v2.0.3 local screenshots above are now classified as earlier local evidence.
- They predate the ADR Grid P/L unit fix and the planned drawdown/MAE contract.
- Keep them as historical weekly-anchor/preloader evidence, and replace them in the next release package if those corrected surfaces are promoted.
- Replacement screenshots must include corrected ADR Grid P/L, unified drawdown labels, and expanded basket evidence.
- Replacement screenshots are not complete until they are both saved in the release screenshot archive and listed in the selected release manifest's `screenshots` array for Documents-page rendering.

Drawdown/P&L follow-up spec:

- `docs/data-verification/ADR_GRID_DRAWDOWN_UNIFICATION_SPEC_2026-06-03.md`

Implementation checkpoint after riskMatrix phase 1:

- `ClosedHistoryRow.riskMatrix` added as a backward-compatible optional field.
- Engine-derived ADR Grid closed-week delta rows now carry fill MAE and grid max-fill MAE.
- Basket grid detail no longer labels realized fill-return sequence DD as path DD.
- Basket detail now separates `Grid DD`, `Max fill MAE`, and fill/trade `MAE`.
- ADR Grid entry artifacts and global preload stamps are versioned for the new contract.

Verification run:

- `npx tsc --noEmit --pretty false`: passed.
- Focused Vitest suite: 9 files, 25 tests passed.
- `npx tsx scripts/verification/inspect-adr-grid-week.ts`: EURUSD selected week matched expected corrected P/L.

EURUSD selected-week inspector:

- Week: `2026-05-31T23:00:00.000Z`.
- Strategy: Tiered ADR Grid + Pair Fill Cap.
- EURUSD fills: 4.
- EURUSD raw P/L: `+0.351694%`.
- EURUSD ADR-normalized P/L: `+0.80%`.
- Worst EURUSD fill MAE: `0.178176%` raw, `0.405297` ADR-normalized.

## Kernel Performance Check

On a fresh `localhost:3111` process:

- First inventory request for `tandem-adr_grid-pair_fill_cap` built the missing `2026-05-24T23:00:00.000Z` closed-week delta because the current shipped v2 release baseline stops at `2026-05-17T23:00:00.000Z`.
- Second identical inventory request returned in `175ms`.

Interpretation:

- Slow first load is acceptable when a closed-week delta is genuinely missing from the release baseline.
- UI-only changes should not require all weeks to rebuild.
- When v2.0.3 materializes `2026-05-24T23:00:00.000Z` into the release baseline or bumps cache namespace intentionally, the kernel should skip dynamic delta building.

## ADR Grid Weekly Anchor Evidence

The ADR Grid weekly-anchor change was discovered by comparing the app's close-and-rearm ADR Grid behavior against the verifier path. The original grid implementation was measuring levels from the execution-open anchor, while the app's historical grid was intended to keep levels anchored to the weekly market open and only delay fills until execution open. Replaying Tandem / ADR Grid / Pair Fill Cap with both anchor policies showed that the weekly market anchor was the model-compatible path and materially improved the app result.

Research details are recorded in:

- `docs/research/ADR_GRID_WEEKLY_ANCHOR_AB_2026-06-02.md`

App-visible Tandem / ADR Grid / Pair Fill Cap screenshot result:

| Version / model | Anchor | Return | Path DD | Trades |
|---|---|---:|---:|---:|
| v2.0.2 behavior | Legacy execution anchor | +632.67% | 6.26% | 27,529 |
| v2.0.3 anchor run | Weekly market anchor | +866.33% | 5.82% | 32,270 |

Delta:

- Return: `+233.66%`
- Path DD: `-0.44` points
- Trades: `+4,741`

The release archive uses the live app screenshots as the approval evidence.

Plain-number weekly-anchor coverage from the research harness:

| System | Cap mode | Legacy anchor | Weekly market anchor | Delta |
|---|---|---:|---:|---:|
| Tandem | Pair Fill Cap | +632.67%, 6.26% DD, 27,529 trades | +877.42%, 5.82% DD, 32,710 trades | +244.75%, -0.44 DD, +5,181 trades |
| Tandem | No cap | +694.73%, 25.12% DD, 39,626 trades | +942.20%, 24.68% DD, 44,996 trades | +247.47%, -0.44 DD, +5,370 trades |
| Tiered | Pair Fill Cap | +104.77%, 2.33% DD, 3,667 trades | +154.68%, 2.16% DD, 4,738 trades | +49.90%, -0.16 DD, +1,071 trades |
| Tiered | No cap | +128.42%, 5.47% DD, 5,036 trades | +172.63%, 5.24% DD, 6,088 trades | +44.21%, -0.23 DD, +1,052 trades |

This table is numeric research evidence, not screenshot evidence. Screenshot evidence currently covers Tandem / ADR Grid / Pair Fill Cap only. The centerline variants were tested separately and are not bundled into v2.0.3 because they added churn and did not produce a clean risk-adjusted win.

## TradingView Verifier Checkpoint

Weekly Hold EURUSD 3-week test, including current week:

```text
WEEKLY HOLD 3 WEEK TEST FOR EURUSD LAST 3 WEEKS INCLUDING CURRENT WEEK

Market Truth / Raw: PASSED, 100% parity
Market Truth / ADR Normalized: PASSED, 100% parity
Execution / Raw: PASSED, 100% parity
Execution / ADR Normalized: PASSED, 100% parity
```

ADR Grid checkpoint:

```text
ADR GRID 3 WEEK TEST FOR EURUSD LAST 3 WEEKS INCLUDING CURRENT WEEK

No Cap / ADR Normalized / Synthetic App Window 21:00 UTC / Confirmed 1H:
PASSED, 90%+ first-pass parity with canonical price-store/broker-feed caveat.
```

Current app screenshot captured by Freedom on 2026-06-03:

| App setting | Value |
|---|---|
| Surface | Performance -> Basket |
| System | Tiered / ADR Grid / Risk Overlay None |
| Metric | ADR-normalized |
| Week chip | `Jun 01 2026` |
| Scope | FX |
| EURUSD row | SHORT, `4 fills`, `4W / 0L`, `+0.80%` |
| Fill 1 | Entry `1.16441`, Exit/TP `1.16338`, ADR `0.44%`, MAE `0.18%`, Result `GRID_TP`, `+0.20%` |
| Fill 2 | Entry `1.16645`, Exit/TP `1.16543`, ADR `0.44%`, MAE `0.00%`, Result `GRID_TP`, `+0.20%` |
| Fill 3 | Entry `1.16645`, Exit/TP `1.16543`, ADR `0.44%`, MAE `0.00%`, Result `GRID_TP`, `+0.20%` |
| Fill 4 | Entry `1.16338`, Exit/TP `1.16236`, ADR `0.44%`, MAE `0.12%`, Result `GRID_TP`, `+0.20%` |

Known app UI note from the screenshot: individual fills show MAE, but the EURUSD grid row and higher tier headers do not yet show their DD/MAE beside return. Desired future behavior is modular and app-wide: tier headers show DD next to return, expanded grid rows show their individual DD, and child rows keep their own MAE/DD just like returns propagate through the hierarchy. Do not stop the parity test for this UI issue.

Preliminary side-by-side result from prior app query and TradingView screenshots:

| Week label | TradingView Pine result | App canonical result | Classification |
|---|---:|---:|---|
| May 31 2026 | `4 fills / 4 TP`, P/L `+0.8%`, Max DD `-0.41%`, ADR `50.5p / 0.44%` | `4 fills / 4 TP`, P/L `+0.8%`, Max DD `-0.4102%`, ADR `0.4396%` | Exact after rounding. |
| May 24 2026 | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-1.63%`, ADR `54.1p / 0.47%` | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-1.6813%`, ADR `0.4522%` | Exact fills/P&L; DD delta about `0.05`. |
| May 17 2026 | `11 fills / 11 TP`, P/L `+2.2%`, Max DD `-0.94%`, ADR `59.1p / 0.51%` | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-0.9963%`, ADR `0.4957%` | One-fill drift; accepted as broker/feed/canonical-store variance. |

Decision: no-cap ADR Grid is accepted for first-pass EURUSD parity. ADR-normalized was visually compared most directly; Raw is covered by the same close-and-rearm fill path and return math.

ADR Grid + Pair Fill Cap checkpoint:

```text
ADR GRID + Pair Fill Cap 3 WEEK TEST FOR EURUSD LAST 3 WEEKS INCLUDING CURRENT WEEK

TradingView Pine ADR-normalized side captured on 2026-06-03.

Weekly Anchor + Execution / ADR Normalized: FAILED/OPEN on May 18 cap accounting
Weekly Anchor + Execution / Raw: paused until capped app path is reconciled
```

TradingView Pine capped ADR-normalized evidence:

| Week label | TradingView Pine result | Notes |
|---|---:|---|
| May 31 2026 | `4 fills / 4 TP`, P/L `+0.8%`, Max DD `-0.41%`, ADR `50.5p / 0.44%` | `Grid Cap Pair Fill Cap 3`, status `RESET CLOSED`, entry `1.16340`, TP `1.16239`. |
| May 24 2026 | `11 fills / 11 TP`, P/L `+2.2%`, Max DD about `-1.6%`, ADR `54.1p / 0.47%` | Screenshot DD text is partially obscured by chart labels; fill/TP/P&L are clear. |
| May 17 2026 | `11 fills / 11 TP`, P/L `+2.2%`, Max DD `-0.94%`, ADR `59.1p / 0.51%` | `Grid Cap Pair Fill Cap 3`, status `Completed`. |

App-side capped ADR-normalized screenshots from 2026-06-03:

| Week chip | App result | Classification |
|---|---:|---|
| Jun 01 2026 | EURUSD SHORT `4 fills`, `4W / 0L`, P/L `+0.80%`; fill entries/exits match the no-cap/current-week fill sequence. | Matches Pine on fills and P/L; DD display remains app hierarchy/sidebar-dependent. |
| May 25 2026 | Expanded capped grid shows `11` SHORT fills at `+0.20%` each, with header `MAX MAE -1.17%` and fill MAEs including `-0.05%`, `-0.31%`, `-0.82%`, `-0.02%`, `-0.62%`, `-0.22%`, and zeros. | Fill count/P&L aligns Pine `11 fills / +2.2%`; this screenshot also shows the desired MAE hierarchy behavior on week/grid/fill rows. |
| May 18 2026 | Screenshot-visible EURUSD child row shows `1 grid`, `5W / 1L`, P/L `+0.19%`; expanded window shows cap `2/3 max active`. `computeWeeklyHold()` returns EURUSD `12` fills and `+2.4%`. | Not passable as an app-vs-indicator checkpoint. The current canonical app executor enforces Pair Fill Cap as `active fills >= 3` and returns the larger fill set; the visible app row appears to be a different/stale UI artifact or rollup path. Reconcile visible Basket output, stored ledger rows, and `computeWeeklyHold()` before Raw or larger-period reporting can be trusted. |

Canonical app-script comparison:

| Week | App script command result | Pine comparison |
|---|---:|---|
| May 31 2026 | EURUSD `4` fills, raw `+0.351694%`, ADR-normalized `+0.8%` | Exact fills/P&L. |
| May 24 2026 | EURUSD `11` fills, raw `+0.99486%`, ADR-normalized `+2.2%` | Exact fills/P&L. |
| May 17 2026 | EURUSD `12` fills, raw `+1.189755%`, ADR-normalized `+2.4%` | Pine screenshot shows `11` fills / `+2.2%`, while the app screenshot row shows a different capped-grid rollup. Treat this as a visible app artifact/rollup discrepancy until stored ledger rows and `computeWeeklyHold()` are reconciled. |

Follow-up notes from capped app screenshots:

- The May 25 app screenshot shows the desired modular MAE behavior on the week/grid/fill hierarchy, but the behavior is not consistent on the other inspected weeks.
- Several fill rows show `0.00%` MAE; defer investigating whether those are true zero-adverse fills or display/rounding artifacts.
- Pine verifier fix: after a full ADR reset close, grid high/low tracking and the light red/green grid boxes now stop extending because `appGridCanTrack` is gated by `not appGridClosedForWeek`.

Next manual verification target:

- Pause Raw Pair Fill Cap screenshots until the May 18 visible app row is reconciled against canonical app output.
- Confirm stored ledger rows and Basket hierarchy composition for EURUSD May 18; determine whether the visible `2/3 max active` row is stale, filtered, grouped differently, or generated by a different engine path.
- Research Pair Fill Cap active-fill accounting only if stored ledger rows disagree with `computeWeeklyHold()`; the current canonical executor skips new fills when active fills are already `>= 3`.
- Document the 1H OHLC ordering assumption: both Pine and `computeWeeklyHold()` can open and TP a fill on the same confirmed hourly bar, which is deterministic but not true intrabar market sequencing.
- Fix modular MAE/DD display so week/tier/grid headers and fill rows consistently show MAE/DD; keep true `0.00%` distinct from missing/unknown MAE.
- Re-check the Pine verifier in TradingView after the reset-box patch so the light green/red cycle boxes stop at full reset.
- After app visible output is fixed or explicitly documented, re-run Pair Fill Cap ADR-normalized and then Raw for Weeks Back `0/1/2`.

## 2026-06-04 Data-Verification Baseline

The active app baseline is `reports/data-verification/app/visible-engine-stats-2026-06-04.json`, generated `2026-06-04 19:06:55`. Treat older corrected-path reports as historical/different-basis until reconciled. The current goal is to prove that the v2.0.3 numbers are real enough to freeze as an optimization baseline.

2026-06-05 source-readiness update: the active 19-week baseline is not yet source-trusted. `npm run source:completion:release` audits the full 2026-01-19 through 2026-05-24 window and fails strict mode with 4 untrusted Jan/Feb Sentiment rows. Strength was repaired on 2026-06-05 and now passes all 19 baseline weeks. `npm run source:completion:trusted12` passes the March-through-May subset, but it is not the active app baseline. Bare `npm run source:completion:check` is a latest-window probe only, not release approval. Run source-readiness gates serially; parallel DB-heavy audits can produce false Strength failures. Do not regenerate v33 canon until Jan/Feb Sentiment is repaired and the serial `npm run source:completion:release` gate reports all 76 rows trusted. Changing to a shorter release baseline is not allowed unless Freedom explicitly reverses the 19-week decision.

### 2026-06-04 May 18 Capped Grid Blocker Update

Freedom's FX-only screenshots for Tiered / ADR Grid / Pair Fill Cap, week chip `May 18 2026`, show the visible app has regressed in three separate ways:

- ADR-normalized child fill returns display `+0.04%` per TP. This is wrong: in ADR-normalized mode `1 ADR = 1.00%`, so a `0.20` ADR grid TP must display as `+0.20%`. Raw return display must also be rechecked in the same pass.
- Basket and Simulation disagree for the same selected week/scope. Basket shows week/grid-level positive output around `+0.50%` overall and EURUSD around `+0.19%`, while Simulation/sidebar shows selected-week return `-13.36%`, Monday daily return `-14.57%`, path DD `25.12%`, and `118` trades.
- Basket hierarchy diagnostics are incomplete on the broken row: `Grid DD`, `Max fill MAE`, and individual fill MAE/DD values show missing placeholders instead of usable values.

TradingView Pine evidence for the same EURUSD short week, manual ADR `0.6%`, confirmed 1H, Pair Fill Cap `3`, shows `6 fills / 6 TP`, P/L `+1.20%`, Max DD `-1.19%`, with level grouping:

| Level | Pine result |
|---|---:|
| `1.16527 -> 1.16387` | `3 fills / 3 TP / +0.60%` |
| `1.16387 -> 1.16248` | `1 fill / 1 TP / +0.20%` |
| `1.16109 -> 1.15969` | `2 fills / 2 TP / +0.40%` |

UI work to include in the next pass: Basket should group ADR Grid rows as `Grid -> Level -> Fills/Trades`, matching the Pine verifier level summary. That makes level-by-level audits possible and prevents the current fill-only list from hiding whether the return and cap accounting are grouped correctly.

Resolution order for this blocker:

1. Trace May 18 FX-only Tiered / ADR Grid / Pair Fill Cap through Basket, Simulation, sidebar, and canonical/script outputs.
2. Fix ADR-normalized TP return units so each closed grid TP displays and totals as `+0.20%`; verify Raw return math in the same code path.
3. Reconcile why Basket shows a small positive week while Simulation/sidebar shows `-13.36%`.
4. Restore `Grid DD`, `Max fill MAE`, and fill-level MAE/DD display, distinguishing true zero from missing.
5. Add Basket grid-level grouping and re-run ADR-normalized before Raw.

### 2026-06-04 May 18 Capped Grid Fix Update

The May 18 capped-grid return display regression has been corrected locally and is now part of the v2.0.3 verification record:

- ADR-normalized grid TP rows now use the stored ADR-normalized fill return, so a `0.20` ADR TP displays as `+0.20%` instead of the bad `+0.04%` raw-shaped value.
- Raw grid return remains price-return based and was rechecked in the same code path; raw mode is not flattened into ADR-normalized units.
- The May 18 correction shard for Tiered / ADR Grid / Pair Fill Cap now resolves from `strategy-artifact-correction` for closed-history composition instead of stale release-canon rows.
- Basket ADR Grid detail now groups as `Grid -> Level -> Fill`, with level rollups carrying fill counts, TP/loss/reset/active counts, P/L, `Grid DD`, `Max fill MAE`, cap state, and fill MAE.

Focused verification evidence:

- `npx tsx scripts/verification/inspect-adr-grid-week.ts --bias=tiered_4w --f1=adr_grid --f2=pair_fill_cap --week=2026-05-17T23:00:00.000Z --symbol=EURUSD`
- EURUSD returned `7` closed fills, each with `adrNormalizedReturnPct: 0.2`.
- EURUSD totals: raw `+0.6940235423%`, ADR-normalized `+1.4000000000%`, grid DD raw `0.4938782544%`, max fill MAE raw `0.2637717154%`, cap state `3/3`, cap not active at close.

Post-fix 12-system app-visible comparison:

| System | Execution | ADR norm P/L | Path DD | Raw P/L | Raw Path DD | Weekly win | Trades |
|---|---|---:|---:|---:|---:|---:|---:|
| Tandem | Weekly Hold | `+175.66%` | `45.57%` | `+133.38%` | `68.62%` | `63.16%` | `2,736` |
| Tandem | ADR Grid / Pair Fill Cap | `+822.44%` | `85.38%` | `+1255.84%` | `97.31%` | `73.68%` | `15,643` |
| Tandem | ADR Grid | `+1349.64%` | `177.47%` | `+2026.67%` | `225.42%` | `73.68%` | `25,880` |
| Tiered | Weekly Hold | `+75.95%` | `21.99%` | `+70.46%` | `30.75%` | `63.16%` | `349` |
| Tiered | ADR Grid / Pair Fill Cap | `+173.98%` | `20.75%` | `+189.38%` | `29.75%` | `89.47%` | `1,943` |
| Tiered | ADR Grid | `+293.35%` | `21.92%` | `+336.59%` | `32.15%` | `94.74%` | `3,045` |
| Agreement | Weekly Hold | `+34.30%` | `34.54%` | `+5.56%` | `59.52%` | `52.63%` | `519` |
| Agreement | ADR Grid / Pair Fill Cap | `+197.48%` | `23.19%` | `+211.58%` | `36.83%` | `84.21%` | `2,992` |
| Agreement | ADR Grid | `+333.97%` | `22.39%` | `+372.60%` | `36.27%` | `78.95%` | `4,774` |
| Selector | Weekly Hold | `-10.03%` | `63.40%` | `-6.30%` | `75.55%` | `57.89%` | `891` |
| Selector | ADR Grid / Pair Fill Cap | `+251.47%` | `33.91%` | `+258.63%` | `53.84%` | `73.68%` | `5,181` |
| Selector | ADR Grid | `+525.12%` | `63.95%` | `+625.89%` | `47.14%` | `78.95%` | `8,661` |

Comparison command:

- `npx tsx scripts/report-corrected-path-metrics.ts`

Browser verification should still be run after this local code change before closing the data-verification blocker, because the app surface must show the corrected grouped Basket rows and not just compute the corrected engine rows.

Browser verification result:

- Fresh local dev server: `http://127.0.0.1:3104/performance`
- Exact checked URL: `http://127.0.0.1:3104/performance?strategy=tiered_4w&f1=adr_grid&f2=pair_fill_cap&view=basket&week=2026-05-17T23%3A00%3A00.000Z&scope=fx`
- Playwright screenshot: `screenshots/codex-performance-3104-tiered-may18-fx-basket-expanded-clean-2026-06-04.png`
- Result: page reached ready state with no preload blocker, no console/page errors, and the expanded May 18 FX Basket showed EURUSD `1 grid`, `7W / 0L`, P/L `+1.40%`, `Grid DD -1.00%`, `Max fill MAE -0.53%`, cap `3/3 max active`, `0` violations.
- Level grouping was visible:
  - `1.16542 -> 1.16426`: `3 fills`, P/L `+0.60%`
  - `1.16426 -> 1.16311`: `3 fills`, P/L `+0.60%`
  - `1.16311 -> 1.16196`: `1 fill`, P/L `+0.20%`
- Fill grouping was visible, with individual fill rows displaying `+0.20%`; the bad `+0.04%` ADR-normalized TP display was not present.

Verification threshold:

- Minimum acceptable parity: `90%+` across entries, exits, fills, TP/reset/week-close classification, trade counts, P/L, and DD/MAE.
- Preferred parity: near `100%`, with remaining deltas explained by TradingView broker feed versus app canonical price-store differences.
- No strategy optimization, trailing-stop research, grid trailing/escape research, cap tuning, or automation notes should be treated as active until this parity gate closes.

First candidate systems:

| Rank | Candidate | Current visible result | Why verify now |
|---:|---|---|---|
| 1 | Agreement / ADR Grid | `+333.97%`, `22.39%` DD, `78.9%` weekly win, `4,774` trades | Strong return with less extreme visible DD. |
| 2 | Tiered / ADR Grid | `+293.35%`, `21.92%` DD, `94.7%` weekly win, `3,045` trades | Best visible weekly-win profile with low DD. |
| 3 | Tandem / ADR Grid / Pair Fill Cap | `+822.44%`, `85.38%` DD, `73.7%` weekly win, `15,643` trades | High-return capped candidate; still needs cap-path confidence. |
| 4 | Tandem / ADR Grid | `+1349.64%`, `177.47%` DD, `73.7%` weekly win, `25,880` trades | High-horsepower stress reference, not first automation candidate. |

Initial instrument/week plan:

1. Reconcile EURUSD Pair Fill Cap week open `2026-05-17T23:00:00.000Z` first; this is the current May 18 capped-row blocker.
2. Continue the EURUSD three-week lane for Agreement / ADR Grid and Tiered / ADR Grid using week opens `2026-05-31T23:00:00.000Z`, `2026-05-24T23:00:00.000Z`, and `2026-05-17T23:00:00.000Z`.
3. Re-run Tandem / ADR Grid / Pair Fill Cap on the same EURUSD lane after the capped path is trusted.
4. Expand cross-asset coverage with one FX JPY pair, `XAUUSD`, `WTIUSD`, `JPN225` or `NDX100`, and `BTCUSD` or `ETHUSD`.
5. For each expansion instrument, verify alias normalization, pip size, weekly market-open hour, execution window, force-close behavior, and ADR denominator.

Confidence answer required before optimization: are the v2.0.3 numbers real enough to freeze as the baseline? If yes, proceed to focused improvement tests. If no, continue data repair.

## High-Level Stage Plan

Current stage:

- Found a configuration that works on paper.

Next stages:

1. Verify the data is correct.
2. Select one system to automate.
3. Create a bot to trade that system.

## Data Correctness Checks

Before promoting a system from paper configuration to automation candidate:

- Weekly Hold and ADR Grid no-cap EURUSD parity are accepted for first pass. ADR Grid + Pair Fill Cap is failed/open on the May 18 capped app behavior and must be fixed or documented before the EURUSD first pass closes.
- Validate spread, commission, swap, slippage, and missed-fill assumptions.
- Compare live/paper execution logs against app fills closely enough to catch broker execution drift.
- Stress correlated weeks where many pairs move together and active exposure stacks.
- Resolve or explicitly document missing canonical price rows for `2026-03-29T23:00:00.000Z`.
- Check broker-specific behavior for CFDs, crypto weekend sessions, metals, oil, and indices.
- Confirm the ADR Grid 100% weekly win rate is not an artifact of reset/close assumptions.

## Known Caveats

- Pine cannot be locally compiled by Codex; paste/compile in TradingView is required.
- Gate 28 removes the old pending-release badge state; runtime version UI now exposes only live and dev versions.
- Data first-load time is separate from the global release preloader.
- Existing local working tree contains unrelated dirty/untracked files. Do not treat all dirty files as part of v2.0.3.
