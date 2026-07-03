# Gate 90D Triangle Reversion Grid Proposal

Generated: 2026-07-02

## Status

`PROPOSAL_ONLY_NO_RUNNER_CHANGE_NO_PROMOTION_NO_FULL_HANDSHAKE`

Outsider-review amendment incorporated on 2026-07-02:

- lock behavior is split into default entry/add lockout versus optional
  explicit profit-stop;
- Candidate B is required for v0 replay starts, with centerline-only reversion
  retained as diagnostic only;
- David evidence must be derived from independent David MA state, not the LTRG
  adaptive centerline;
- grid quantum includes a structural cost floor;
- low path efficiency must be paired with an ADR-normalized range condition so
  dead chop is not misclassified as harvestable chop;
- feature ledgers should include session-level geometry receipts, not only
  pair-week aggregates;
- replay requires a frozen, hashed formula/config receipt.

This proposal answers Freedom's objection to a weekly profile selector:
selecting among `candidate_b`, `david_contra`, conflict, confirm, ADR brick,
MA period, and spacing profiles is still too much option rotation. It is likely
to overfit and would be hard to trust in walk-forward.

The proposed Gate 90D direction is to collapse the grid architecture into one
mathematical engine with three clean legs:

```text
direction layer -> one reversion-side evidence formula
grid geometry layer -> one ADR-normalized path-efficiency formula
katarakti layer -> session sweep trigger, grid-unit locks, optional context receipts
```

## TRIANGLE Architecture

Freedom's forward structure for the final algorithm:

```text
TRIANGLE
1. Directional Algo
2. Grid Geometry
3. Katarakti Trigger / Locks
```

### 1. Directional Algo

The directional leg answers:

```text
Should this pair express long, short, or no side right now?
```

It should be formulaic, not a menu of named variants. Candidate B and
inverted-David are evidence inputs inside the formula, not separate final
algorithms.

### 2. Grid Geometry

The geometry leg answers:

```text
If direction is allowed, how should the grid breathe?
```

It owns ADR event brick size, adaptive centerline smoothing, spacing, minimum
start distance, adverse add distance, and mean-reversion target.

### 3. Katarakti Trigger / Locks

The third leg answers:

```text
When is the allowed side timed well enough to start, and how should open profit
be protected once the grid has movement?
```

Gate 90D should use Katarakti as the timing/protection layer, not as the
direction engine:

- session range sweep beyond a known high/low;
- rejection back inside the range;
- displacement in the reversion direction;
- optional confluence receipts such as BB touch or currency-family context;
- grid-unit stepped locks / trailing once basket MFE appears.

The full seven-pair currency-family handshake is deferred. It is too heavy for
the first Gate 90D proof pass. If cheap to compute, it should be emitted as a
context receipt only and must not gate entry in v0.

Frozen areas remain frozen: MT5 EA refactor, red-news blackout implementation,
broad COT/Candidate B redesign, app/live integration, promotion/live-readiness,
and the full matrix rerun.

## Manual Trader Version

This is the plain-English version of LTRG v0. A human should be able to read
this and understand what the robot is trying to do.

### Market Setup

First, draw the current session box. The first v0 research box is the same
Katarakti-style box:

- mark the session high and low from the completed range window;
- do not guess the high or low before the box is complete;
- after the box is complete, watch only the entry window.

The M1 candles are only the microscope used to see highs, lows, closes, sweep,
rejection, and displacement. They are not the strategy timeframe. Direction and
grid geometry should come from ADR-normalized movement, not arbitrary M1, M5,
M15, or H1 settings.

### Decide If The Box Is Worth Trading

Before taking a trade, ask:

- Is the box big enough to pay for a grid?
- Has price been moving back and forth, rather than marching cleanly one way?
- Is the box large enough after costs?

If the box is tiny, do nothing. Tiny chop is not harvest. It is cost churn.

If the box is wide enough and price movement is inefficient/choppy, the market
is a harvestable geometry candidate.

Plain rule:

```text
wide enough box + choppy movement = possible grid
small box = skip
clean one-way move = skip or require much wider protection
```

### Pick Grid Spacing

Do not choose spacing from a weekly menu.

Use the current pair's completed session box:

```text
spacing = session box size / target grid slots
```

Start v0 with `3` target slots.

Then apply rails:

- spacing must not be smaller than the cost floor;
- spacing must not be smaller than the structural minimum;
- spacing must not be larger than the structural maximum.

Initial v0 grid-spacing rails:

```text
minimum spacing = 0.20 ADR
maximum spacing = 0.30 ADR
signal brick = spacing / 4
```

Plain rule:

```text
Cut the box into about 3 useful chunks.
Do not trade chunks smaller than costs.
Do not let spacing become stupid tiny or stupid huge.
```

Example:

```text
session box = 0.636 ADR
target slots = 3
spacing = 0.636 / 3 = 0.212 ADR
manual rounded read = about 0.20 ADR
```

If the box is only `0.35 ADR`, do not force a tight grid. The box is too small,
so skip.

### Wait For The Katarakti Trigger

Do not start just because the box is good.

For a long:

- price must sweep below the session low;
- price must reject back above the session low;
- price must then show a bullish displacement candle;
- direction evidence must allow long.

For a short:

- price must sweep above the session high;
- price must reject back below the session high;
- price must then show a bearish displacement candle;
- direction evidence must allow short.

Plain rule:

```text
Let price raid the box edge first.
Only trade after the raid fails.
```

### Direction

The strategy is reversion first:

- buy when price is meaningfully low versus the adaptive mean;
- sell when price is meaningfully high versus the adaptive mean;
- close when price returns to the mean.

Candidate B and inverted-David should not be separate strategy choices. They
are evidence checks:

- if they support the reversion side, the trade is cleaner;
- if they fight the reversion side, skip in v0;
- if they are missing or unclear, log it but do not fall back to raw both.

Plain rule:

```text
Buy low, sell high, close at the mean.
Candidate B and David are witnesses, not separate systems.
```

### Manage The Open Grid

Once a side starts:

- add only when price moves against the cycle by the stored spacing;
- if market pressure gets worse, future adds may widen;
- never tighten an active cycle just because conditions calm down later;
- close at adaptive mean reversion;
- use lockout receipts to stop adding after the cycle has already earned MFE;
- forced profit-stop closes are a separate explicit mode, not the default.

Plain rule:

```text
Start after the failed raid.
Add only into adverse movement.
Stop feeding the grid after it already earned a real move.
Close at the mean.
```

### What We Can Know Beforehand

Before the trade, we can know:

- the completed session box high and low;
- the current ADR-normalized box size;
- the spacing implied by that box;
- whether the box is large enough after costs;
- whether movement so far is choppy or one-way;
- whether a sweep, rejection, and displacement already happened;
- whether Candidate B and David support or fight the side.

Before the trade, we cannot know:

- whether the trade will win;
- whether session flatten will hurt;
- whether a future news shock will change the path;
- whether a later candle will make the box look better or worse.

So `harvestable` does not mean guaranteed profit. It means the market has the
right pre-entry shape for this grid to be allowed.

## Core Thesis

ADR normalization solved cross-pair scale. It did not solve path shape.

The missing variable is **path efficiency**: how much net displacement the
market made per unit of total movement. A grid wants inefficient movement: lots
of path, limited one-way displacement, enough range to pay costs, and not so
much directional efficiency that adverse inventory stacks into session flatten.

Low path efficiency is not sufficient by itself. It can mean either harvestable
back-and-forth movement or tiny dead chop. LTRG must require:

```text
low path efficiency + enough ADR-normalized range + cost-safe quantum
= harvestable geometry candidate
```

This suggests a single direction-agnostic geometry score:

```text
grid quantum = f(ADR scale, path efficiency, range expansion, heat)
```

That quantum then drives:

- ADR event brick size;
- adaptive MA centerline smoothing;
- grid spacing;
- minimum start distance;
- adverse add distance;
- reversion target.

If this works, ADR brick, MA period, spacing, and start threshold stop being
independent knobs.

## External Research Anchors

Kaufman's Adaptive Moving Average uses an Efficiency Ratio:

```text
ER = signal / noise
signal = abs(price_now - price_n_periods_ago)
noise = sum(abs(price_i - price_i_minus_1), n)
```

MT5 documents the same idea: ER tends toward `1` in strong trend and toward
`0` when directed movement is weak. It then uses ER to compute an adaptive
EMA smoothing constant. Reference:
`https://www.metatrader5.com/en/terminal/help/indicators/trend_indicators/ama`.

FRAMA uses fractal dimension to adapt smoothing. MT5 documents the advantage
as following strong trends while slowing during consolidation. This is useful
confirmation that adaptive smoothing should respond to path geometry, not a
manually selected MA period. Reference:
`https://www.metatrader5.com/en/terminal/help/indicators/trend_indicators/fama`.

ATR/ADR is still the correct volatility scale. MT5 documents ATR as true range
smoothed over time. It measures movement size, not whether the path is
grid-harvestable. Reference:
`https://www.metatrader5.com/en/terminal/help/indicators/oscillators/atr`.

QuantPedia's grid primer uses previous volatility to set grid distance and
shows the same structural issue Gate 90C exposed: more grid levels create more
small closed gains, but unresolved adverse loss grows when price does not flip.
Reference:
`https://quantpedia.com/a-primer-on-grid-trading-strategy/`.

Local Katarakti evidence is useful but must be interpreted narrowly:

- `docs/bots/UNIFIED_KATARAKTI_GATED_SWEEP_RESULTS_2026-03-22.md` found the
  sweep + rejection + displacement entry family stronger than the MA+BB control
  on average week return in an 8-week CFD sample, with small trade counts.
- `docs/bots/KATARAKTI_8WEEK_NORMALIZATION_RESULTS_2026-03-22.md` says the
  old normalized CFD core failed and should not be revived as a full strategy.
- `docs/research/KATARAKTI_HANDSHAKE_SPEC.md` preserves the useful trigger
  shape: hold a sweep signal until confirming structure appears in the same
  session window.

Gate 90D therefore borrows the Katarakti trigger and lock mechanics only. It
does not borrow old CFD weekly bias, position sizing, old fixed percent stops,
or a full correlated-pair entry group.

## Proposed Name

`Limni Triangle Reversion Grid v0`

Short name:

```text
LTRG v0
```

## Direction Contract

Do not keep `candidate_b`, `david_contra`, confirm, and conflict as build
choices.

The direction layer also needs a formula. Candidate B cannot be the only side
source. David MA also should not be discarded: recent Gate 90C 26-week evidence
showed `david_contra` leading Candidate B on the tested execution surface, and
Freedom's visual read of the inverted David MA was directionally promising.

The clean direction idea is:

```text
buy low, sell high, close at mean reversion
```

That means side should come first from price displacement around the adaptive
centerline, not from a named signal family:

```text
price below adaptive mean -> candidate long reversion side
price above adaptive mean -> candidate short reversion side
```

Candidate B and inverted-David then become independent evidence checks against
that reversion side.

Use side encoding:

```text
LONG  = +1
SHORT = -1
NONE  = 0
```

### Reversion Side

```text
distance_to_center_adr =
  (centerline_price - current_price) / current_pair_adr_price

reversion_side =
  +1 if distance_to_center_adr >= grid_quantum_adr
  -1 if distance_to_center_adr <= -grid_quantum_adr
   0 otherwise
```

Interpretation:

- price below the adaptive mean by at least one quantum: buy low;
- price above the adaptive mean by at least one quantum: sell high;
- inside the quantum band: no new side.

### Candidate B Evidence

```text
candidate_b_score =
  +1 if candidate_b_side == LONG
  -1 if candidate_b_side == SHORT
   0 if missing or neutral
```

### Inverted-David Evidence

This keeps the useful David MA idea, but removes it as a separately optimized
activation variant.

David evidence must stay independent from the LTRG adaptive centerline. The
adaptive centerline is the reversion anchor and target surface; it must not also
be counted as David confirmation.

Use the existing David MA state as the David receipt:

```text
david_ma_slope_adr =
  (david_ma_now - david_ma_previous) / current_pair_adr_price

david_reversion_score =
  -1 if david_ma_slope_adr >= slope_floor_adr
  +1 if david_ma_slope_adr <= -slope_floor_adr
   0 otherwise
```

This is the same conceptual inversion as the current `david_contra` family:
when the MA state is up, the reversion side is short; when the MA state is down,
the reversion side is long.

Initial structural constant:

```text
slope_floor_adr = 0.025 ADR per signal step
```

This is not a tuned direction setting. It is a deadband to avoid treating a flat
centerline as a directional statement.

The adaptive centerline slope may still be logged as its own diagnostic receipt:

```text
centerline_slope_reversion_score =
  -1 if centerline_slope_adr >= slope_floor_adr
  +1 if centerline_slope_adr <= -slope_floor_adr
   0 otherwise
```

Do not call that diagnostic David evidence, and do not let it replace the
independent David MA receipt in v0 replay.

### Direction Evidence Formula

Compare Candidate B and inverted-David against the reversion side:

```text
candidate_alignment =
  candidate_b_score * reversion_side

david_alignment =
  david_reversion_score * reversion_side

alignment_score =
  0.5 * candidate_alignment + 0.5 * david_alignment

candidate_b_present =
  candidate_b_score != 0

david_present =
  david_reversion_score != 0

evidence_count =
  count(candidate_b_present, david_present)
```

Values:

- `+1`: Candidate B and inverted-David both support the reversion side.
- `0`: mixed, neutral, or one-sided evidence.
- `-1`: both oppose the reversion side.

Use alignment to change the entry requirement, not to choose a separate
algorithm:

```text
required_distance_adr =
  grid_quantum_adr
  * (1 - 0.25 * max(0, alignment_score))
  * (1 + 0.75 * max(0, -alignment_score))

direction_allowed =
  reversion_side != 0
  and candidate_b_present
  and evidence_count >= 1
  and abs(distance_to_center_adr) >= required_distance_adr
  and alignment_score >= 0
```

Effect:

- both agree: start can occur slightly closer to the mean;
- mixed or neutral: require the normal quantum;
- both oppose: no start;
- no Candidate B fallback to raw both;
- no pure centerline-only fallback in v0 replay;
- no David-only variant tree;
- both signals are still visible and comparable in receipts.

Start rules:

```text
long allowed  = direction_allowed and reversion_side == +1
short allowed = direction_allowed and reversion_side == -1
otherwise no new side cycle
```

This keeps Candidate B and David MA in the system, but changes their job. They
are no longer selectable direction variants. They are evidence terms inside one
reversion-direction formula.

If Candidate B is missing or neutral, strong displacement around the centerline
may still produce a diagnostic reversion candidate, but it must be labeled as
diagnostic and blocked from v0 replay unless Gate 90D explicitly opens that
mode:

```text
diagnostic_reversion_only_allowed = false
```

The first proposed v0 replay should keep Candidate B present as a slow prior
and should not fall back to raw both.

## Geometry Inputs

All inputs are direction-agnostic and ADR-normalized.

Use only information available before the current decision point.

Point-in-time rule:

```text
All geometry inputs must be computed from prior completed sessions, or from the
current session state observed only up to the decision timestamp.
```

No feature may use the final range, final flatten result, final target-close
result, final heat, future ADR update, or future candle from the same session
when making an entry/add/lock decision.

### 1. Clean-Session Path Efficiency

Compute over recent clean-session price path, preferably ADR-event samples or M1
clean-window samples normalized by current pair ADR.

```text
path_efficiency =
  abs(price_now - price_lookback_start)
  / max(epsilon, sum(abs(price_i - price_i_minus_1)))
```

Range: `0..1`.

Interpretation:

- near `0`: inefficient/noisy/choppy path; good grid-harvest candidate if range
  exists;
- near `1`: efficient directional path; dangerous for adverse-only grid starts.

### 2. Range Expansion Ratio

```text
range_fast = EMA(clean_session_range_adr, 5 sessions)
range_slow = EMA(clean_session_range_adr, 20 sessions)

range_ratio = clamp(0.5, 2.0, range_fast / max(epsilon, range_slow))
```

Interpretation:

- below `1`: compressed range, tighten only if efficiency is low and costs are
  covered;
- above `1`: expansion, widen the grid and slow starts.

### 3. Heat

Heat uses prior realized pressure, not future outcomes.

```text
fill_pressure =
  clamp01(recent_fills_per_pair_session / fill_pressure_reference)

depth_pressure =
  clamp01(recent_max_add_depth / depth_cap)

flatten_pressure =
  clamp01(abs(recent_session_flatten_net) / max(epsilon, recent_target_close_net))

heat =
  EMA(max(fill_pressure, depth_pressure, flatten_pressure), 5 sessions)
```

Interpretation:

- fill pressure catches overtrading;
- depth pressure catches runaway side cycles;
- flatten pressure catches the exact Gate 90C problem: gross target harvest
  being taken back by daily flatten.

## Grid Quantum Formula

The grid quantum is the one ADR-normalized unit that replaces static spacing,
ADR event brick, MA period choice, and minimum MA expansion threshold.

```text
trend_pressure = EMA(path_efficiency, 5 sessions)
noise_harvest  = 1 - trend_pressure
vol_pressure   = sqrt(range_ratio)
risk_pressure  = heat

raw_quantum =
  base_quantum
  * vol_pressure
  * (1 + 1.25 * trend_pressure)
  * (1 + 0.75 * risk_pressure)
  * (1 - 0.25 * noise_harvest)

bounded_quantum_adr =
  clamp(0.20, 0.30, raw_quantum)
```

Initial constant proposal:

```text
base_quantum = 0.20 ADR
min_quantum  = 0.20 ADR
max_quantum  = 0.30 ADR
```

Add a structural cost floor before any replay:

```text
all_in_cost_adr =
  (spread_cash + commission_cash + modeled_slippage_cash)
  / max(epsilon, cash_value_of_one_adr_move_for_one_base_lot)

cost_floor_multiple = 8

cost_floor_quantum_adr =
  cost_floor_multiple * all_in_cost_adr

tradability_pass =
  cost_floor_quantum_adr <= max_quantum

grid_quantum_adr =
  max(bounded_quantum_adr, cost_floor_quantum_adr)
```

If `tradability_pass` is false, no new starts are allowed for that pair/session
under LTRG v0. The cost floor is not an optimizer knob. It prevents the formula
from tightening into a grid quantum that is too close to spread, commission, and
modeled slippage to have structural edge.

These are not weekly optimizer values. They are structural bounds:

- `0.20 ADR` is the first live-shaped minimum grid spacing proposed here.
- `0.30 ADR` is the upper practical bound already explored in the 2019 band.
- `cost_floor_multiple = 8` is an initial fixed safety constant inside the
  outsider-review recommended `5..10` range.

## Derived Architecture Values

### ADR Event Brick

```text
signal_adr_brick = clamp(0.0125, 0.075, grid_quantum_adr / 4)
```

This makes the signal clock a child of spacing:

- `0.20` spacing -> `0.05` brick;
- `0.30` spacing -> `0.075` brick.

The runner should no longer choose ADR brick independently from spacing.

### Adaptive Centerline

Use Kaufman-style adaptive smoothing on ADR-event bars.

```text
fast_sc = 2 / (2 + 1)
slow_sc = 2 / (30 + 1)
scaled_sc = path_efficiency * (fast_sc - slow_sc) + slow_sc
alpha = scaled_sc * scaled_sc

centerline_now =
  centerline_previous + alpha * (price_now - centerline_previous)
```

This replaces David MA period selection as grid geometry.

The centerline is not a direction predictor. It is the dynamic fair/reversion
anchor used for entry distance and target closure.

### Minimum Start Distance

```text
min_start_distance_adr = grid_quantum_adr
```

Long reversion starts only below the centerline by the required direction
distance. Short reversion starts only above the centerline by the required
direction distance.

This replaces `min_ma_expansion_adr` as an independent parameter.

### Adverse Add Distance

New side cycles store the current quantum at start.

```text
cycle_quantum_adr = grid_quantum_adr_at_cycle_start
```

Adverse add levels:

```text
level_k_distance = k * cycle_quantum_adr
```

Stress rule:

```text
live_add_quantum = max(cycle_quantum_adr, current_grid_quantum_adr)
```

An active cycle may widen future add distance if market pressure rises. It may
not tighten an active cycle after entry.

### Target

Use adaptive centerline reversion as the target:

```text
long cycle target  = price >= centerline
short cycle target = price <= centerline
```

Optional guard for later, not in v0:

```text
close if basket net >= target_floor and centerline is within one quantum
```

Do not add that guard until v0 behavior is visible.

## Katarakti Trigger Contract

The Katarakti trigger times the grid. It does not choose direction.

The Directional Algo must first produce an allowed side. Katarakti then decides
whether the market has produced a clean enough liquidity sweep and rejection to
start that side.

### Candle Source

LTRG v0 detects Katarakti sweep / rejection / displacement on canonical M1
clean-session candles. The accepted trigger timestamp is then mapped onto the
ADR-event signal state and grid geometry state.

ADR-event bars remain the preferred signal/geometry clock. They should not
replace M1 candles for the first trigger definition, because the trigger
contract depends on candle high/low, close location, and one-bar/two-bar
sequence structure.

### Session Range

Use fixed session boxes from the archived Katarakti sweep runner as the first
research contract. Do not optimize session boxes in v0.

```text
range_a: 00:00-13:00 UTC
entry_a: 13:00-21:00 UTC

range_b: 13:00-21:00 UTC
entry_b: next day 00:00-13:00 UTC
```

The live-shaped runner may still enforce the existing New York clean activity
window and session flatten lifecycle. The Katarakti boxes are only the trigger
range used to define the high/low sweep.

### Trigger Side

```text
downside sweep below session low  -> LONG trigger candidate
upside sweep above session high   -> SHORT trigger candidate
```

The trigger side must match `reversion_side`.

### Sweep Depth

Use ADR/grid units instead of the old fixed percent sweep settings.

```text
sweep_depth_adr =
  LONG:  (session_low - sweep_low) / current_pair_adr_price
  SHORT: (sweep_high - session_high) / current_pair_adr_price

sweep_required_adr =
  max(signal_adr_brick, 0.25 * grid_quantum_adr)

sweep_pass =
  sweep_depth_adr >= sweep_required_adr
```

### Rejection

The sweep must fail to continue beyond the range.

```text
LONG rejection:
  sweep candle close > session_low
  or next candle close > session_low

SHORT rejection:
  sweep candle close < session_high
  or next candle close < session_high
```

### Displacement

After rejection, require one candle of actual reversion pressure.

```text
displacement_body_adr =
  abs(displacement_close - displacement_open) / current_pair_adr_price

displacement_required_adr =
  max(signal_adr_brick, 0.25 * grid_quantum_adr)

LONG displacement:
  displacement_close > displacement_open
  and close is in the upper 30% of the candle range
  and displacement_body_adr >= displacement_required_adr

SHORT displacement:
  displacement_close < displacement_open
  and close is in the lower 30% of the candle range
  and displacement_body_adr >= displacement_required_adr
```

The old CFD sweep runner allowed one-bar or two-bar forms. LTRG v0 should keep
that:

```text
sweep -> rejection on same candle or next candle
rejection -> displacement on same candle or next candle
```

### Trigger Permission

```text
katarakti_trigger_pass =
  direction_allowed
  and trigger_side == reversion_side
  and sweep_pass
  and rejection_pass
  and displacement_pass
```

No new side cycle starts without `katarakti_trigger_pass`.

### BB And Family Context

The old 8-week CFD sweep report found BB-confluent sweep variants strongest,
but sample size was small. BB touch should be logged in v0, not required:

```text
bb_sweep_context =
  LONG:  sweep_low <= lower_bb
  SHORT: sweep_high >= upper_bb
```

Full currency-family handshake is also log-only in v0:

```text
currency_strength(currency) =
  average role-normalized recent return_adr across pairs containing currency

family_alignment_context =
  LONG target:  min(strength(base), -strength(quote))
  SHORT target: min(-strength(base), strength(quote))
```

This keeps the idea alive without requiring seven-pair simultaneous trigger
testing in the first pass.

## Lockout And Profit Protection Contract

Katarakti's stepped locks are useful, but old fixed percent values should not be
copied into the grid. Express protection in cycle quantum units.

Separate two concepts:

```text
lockout_ladder_v0:
  controls whether an active side cycle may add or restart exposure after a
  profit watermark.

profit_stop_ladder_v0:
  controls whether an active side cycle is forcibly closed after giving back
  protected MFE.
```

LTRG v0 should treat `lockout_ladder_v0` as the default behavior/receipt. A
forced close is a separate explicit mode and must not be implied by the word
"lock."

For an active side cycle:

```text
after_cost_basket_cash_pnl =
  floating price PnL
  - spread cost
  - commission
  - modeled slippage
  - accrued swap if present in the research surface

cash_value_of_one_cycle_quantum_move_for_current_open_lot_stack =
  cash value of a favorable cycle_quantum_adr move across the current open
  lot stack

basket_net_units =
  after_cost_basket_cash_pnl
  / max(epsilon, cash_value_of_one_cycle_quantum_move_for_current_open_lot_stack)

basket_mfe_units =
  max favorable basket_net_units reached since cycle start
```

Initial v0 lockout ladder:

```text
if basket_mfe_units >= 1:
  lockout_state = earned_scratch
  block_new_adds_if basket_net_units <= 0

if basket_mfe_units >= 2:
  lockout_state = earned_partial
  block_all_new_adds_for_active_side_cycle = true

if basket_mfe_units >= 3:
  lockout_state = earned_trail_candidate
  block_all_new_adds_for_active_side_cycle = true
  block_same_side_restart_until_new_katarakti_trigger = true
```

This lockout mode does not close the basket. It only prevents the grid from
expanding after a cycle has already earned meaningful MFE.

Optional explicit profit-stop mode:

```text
if basket_mfe_units >= 1:
  profit_stop_floor_units = 0

if basket_mfe_units >= 2:
  profit_stop_floor_units = 0.5

if basket_mfe_units >= 3:
  profit_stop_floor_units =
    max(0.5, basket_mfe_units - 1)

profit_stop_close =
  profit_stop_mode_enabled
  and basket_net_units <= profit_stop_floor_units
```

The feature ledger should compute both lockout receipts and profit-stop
receipts, but v0 replay should not flatten from the profit-stop ladder unless
that mode is explicitly named in the replay rule.

Session flatten remains the hard daily lifecycle boundary. Lockout/protection is
not a substitute for red-news, margin, or portfolio risk controls.

## Execution State Machine

Per pair, per side:

```text
1. Update clean-session geometry features and session range boxes.
2. Compute grid_quantum_adr.
3. Compute signal_adr_brick from grid_quantum_adr.
4. Update adaptive centerline from ADR-event bars.
5. Compute reversion_side from price displacement around centerline.
6. Compute Candidate B and independent David MA evidence against reversion_side.
7. Log centerline slope as a separate diagnostic receipt if used.
8. Detect M1 Katarakti sweep / rejection / displacement trigger.
9. Map accepted trigger timestamp onto ADR-event geometry state.
10. If no active side cycle:
   - start only if direction_allowed and katarakti_trigger_pass are true.
   - require Candidate B present for v0 replay starts.
11. If active side cycle:
   - add adverse fills by stored quantum, widened only when current quantum is larger.
   - suppress new adds when the lockout ladder blocks further exposure.
   - close on adaptive centerline reversion.
   - close earlier from profit-stop ladder only in an explicitly named
     profit-stop mode.
12. Session flatten remains the hard daily lifecycle boundary.
```

## Why This Is Simpler

The current Gate 90C shape has too many degrees of freedom:

```text
direction rule x ADR brick x MA period x spacing x start threshold
```

LTRG v0 reduces it to:

```text
direction evidence formula x grid quantum formula x trigger contract x lock ladder
```

Everything else is derived or receipt-only.

## Why This Could Be The Breakthrough

The Gate 90C evidence shows the failure mode clearly:

- static return winners create large target harvest;
- daily flatten gives much of it back;
- wider settings reduce pressure but do not define one winner;
- `david_contra`, Candidate B, confirm, and conflict variants are mostly
  fighting over side and geometry at the same time.

LTRG v0 separates the problem:

- reversion displacement owns the buy-low/sell-high side;
- Candidate B owns slow directional prior evidence;
- inverted-David owns local reversion evidence;
- path efficiency owns whether current movement is grid-harvestable;
- ADR owns scale;
- heat owns self-protection;
- adaptive centerline owns reversion geometry.
- Katarakti owns start timing after sweep/rejection/displacement;
- grid-unit lockout/protection owns exposure expansion after MFE appears.

That is a cleaner mathematical contract than weekly tuple selection.

## Formula Freeze Before Replay

Before any trading replay, Gate 90D must emit and hash a full formula/config
receipt. The hash must cover:

- structural constants: `base_quantum`, `min_quantum`, `max_quantum`,
  multiplier coefficients, EMA lengths, `slope_floor_adr`,
  `cost_floor_multiple`, sweep/displacement multipliers, and candle close
  location rules;
- data contracts: ADR source, cost source, canonical M1 source, ADR-event source,
  Candidate B source, David MA source, and session calendar/window source;
- point-in-time boundaries for path efficiency, range ratio, heat, centerline,
  trigger detection, and lockout/profit receipts;
- v0 gate switches: Candidate B required, BB log-only, family log-only,
  full handshake disabled, profit-stop disabled unless explicitly named.

If any of those values change after the feature ledger, the config hash must
change and the replay must say which formula was used.

## First Validation Gate

Do not run a long matrix first.

Gate 90D should begin with a feature/receipt pass, not a trading replay:

1. Compute `path_efficiency`, `range_ratio`, `heat`, `grid_quantum_adr`,
   cost floor, session range boxes, Katarakti trigger candidates, BB context,
   optional family context, independent Candidate B/David/centerline receipts,
   and lockout/profit-protection milestones from existing canonical price/path
   surfaces.
2. Emit a weekly/pair/session feature ledger only. Session-level geometry must
   classify at least these cases separately:
   - low efficiency + sufficient range: harvestable chop candidate;
   - low efficiency + low range: dead chop / cost churn;
   - high efficiency + expanding range: efficient tail risk;
   - high efficiency + low range: directional drift / low harvest.
3. Confirm the geometry formula produces plausible quanta:
   - tight enough in low-efficiency harvest paths;
   - wider during efficient one-way paths;
   - wider after flatten/depth/fill pressure;
   - above the cost-safe tradability floor;
   - no dependence on future close results.
4. Confirm the trigger formula behaves plausibly:
   - blocks entries before sweep/rejection/displacement;
   - allows entries after clean liquidity raids;
   - does not require full currency-family handshake;
   - logs BB and family context without gating.
5. Shadow-audit existing Gate 90C starts:
   - did bad timing / large flatten-loss cases lack the trigger?
   - did strong target-close winners have the trigger?
   - would lockout/profit-protection receipts have acted before session-flatten
     giveback?
6. Report trigger counts by pair, week, session box, side, Candidate B
   alignment, David alignment, and quantum bucket.
7. Only after that, run one replay rule:
   `triangle_v0_direction_geometry_katarakti_trigger_locks`.

The first replay should compare against two references only:

- recent 26-week `david_contra` balanced row;
- 2019 non-stoch `candidate_b_david_contra_conflict_candidate` balanced row.
- `raw_both` as benchmark only.

Do not reopen the full 150-command matrix.

## Open Design Questions

These should be answered by the feature ledger before trade replay:

- Should path efficiency be computed on M1 clean-session samples or on derived
  ADR-event samples?
- Should the first Katarakti range boxes stay on the archived UTC split
  (`00:00-13:00`, `13:00-21:00`) or be translated directly into the current
  NY-clean lifecycle clock?
- Should `path_efficiency` look back one clean session, five clean sessions, or
  a hybrid fast/slow EMA?
- Is heat best computed pair-local, account-global, or `max(pair, account)`?
- Should diagnostic centerline-only candidates be retained in the feature ledger
  as blocked opportunities, or omitted from the v0 replay ledger entirely?
- Should `alignment_score == 0` allow normal starts when Candidate B is present,
  or require an extra distance penalty? Start by logging both outcomes in the
  feature ledger; freeze one rule before replay.
- Should the first lockout ladder protect scratch at one quantum, or wait for
  two quanta to avoid choking small mean-reversion cycles?
- Should profit-stop mode remain receipt-only through the first replay, or get a
  separate explicit replay rule after lockout-only behavior is visible?

## Stop Line

This is a proposal artifact only. It does not implement a runner, run a backtest,
change the EA, promote a strategy, claim live-readiness, or open app/runtime
integration. It also does not implement a full seven-pair currency-family
handshake; family alignment is receipt-only until a later gate proves it is
worth the added test burden.
