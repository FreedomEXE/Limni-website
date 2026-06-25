# Gate 55D Institutional Price Truth Boundary Gap

Date: 2026-06-24

## Verdict

Status: `HIGH_SEVERITY_PRICE_TRUTH_BOUNDARY_GAP_ACKNOWLEDGED`

Gate 55 exposed a broader architecture issue:

```text
COT signal governance is currently ahead of price-outcome governance.
```

This does not invalidate Gate 54. It does block institutional Strength
judgment, COT-vs-Strength comparison, combined-system selection, and future
execution/risk gates until all price-derived artifacts share one audited price
truth lineage.

## Classification

Type:

```text
Architectural evidence-boundary gap
```

Severity:

```text
HIGH
```

Core issue:

```text
Different research layers can currently depend on different price paths,
storage layers, or derived artifacts.
```

Current fragmented state:

| Layer | Current source/path | Gate 55D read |
|---|---|---|
| COT signals | CFTC reports and frozen COT signal contract | Preserved. Not a price problem. |
| COT outcomes | Existing canonical price / outcome layer, including `canonical_price_bars`, `pair_period_returns`, ADR/path artifacts | Valid only under the then-current outcome price boundary. |
| Strength rebuild | Local SQLite M1 repair path because Postgres M1 coverage was insufficient | Useful staging path, not final institutional parity. |
| ADR Grid / weekly hold | Derived outcome artifacts and path bars from the existing price stack | Must eventually trace to the same audited price bundle as Strength. |
| Future MT5 parity | Not active in Gate 55 | Blocked from final parity claims until price lineage is unified. |

## Four Drift Risks

1. `Outcome drift`

COT metrics may change after price repair even if COT signal logic is
unchanged.

2. `Factor drift`

Strength may be derived from a better or different M1 path than the price path
used for outcome scoring.

3. `Execution drift`

ADR Grid, weekly hold, path bars, and pair-period returns may be generated from
different price assumptions.

4. `Parity drift`

Future MT5/execution work may not match Limni research if the price truth is
not bound by a shared lineage.

## Gate 54 Impact

Gate 54 is preserved with a caveat.

Correct wording:

```text
Gate 54 locked the COT raw Signal Model candidate baseline under the
then-current outcome price layer.
```

Incorrect wording:

```text
Gate 54 permanently locked all COT performance numbers across any future
price-bundle rebuild.
```

Gate 54 remains useful because it proved:

- COT signal mechanics.
- COT coverage and carry-forward behavior.
- Tie policy.
- Full-universe parent benchmark structure.
- Always-on COT baseline discipline under the price boundary available at the
  time.

If a unified price bundle is later promoted, COT metrics must be restated under
a new receipt:

```text
Same COT signal.
New audited price bundle.
New comparable outcome receipt.
```

That restatement would not be a contradiction.

## Gate 55 Impact

Gate 55 stays open.

Strength cannot be judged institutionally until both are true:

1. Strength source construction is valid.
2. Strength and COT outcomes are evaluated against the same audited price
   truth.

The local SQLite Strength repair remains useful as a staging and source-audit
path, but it is not final parity with the existing COT outcome layer.

## Price Truth Lineage Principle

Future research must adopt:

```text
One audited price truth lineage.
Many derived artifacts.
Shared bundle identity.
```

The final architecture does not require every consumer to read the same table
at runtime. It does require every derived artifact to trace to the same frozen
price bundle identity.

Required derived artifacts:

- Raw M1 bars.
- Derived H1 bars.
- Derived daily bars.
- Weekly bars or weekly returns.
- ADR maps.
- Path bars.
- Pair-period returns.
- Execution outcome bars.
- Future MT5 parity bars/logs.

## Immediate Gate 55 Governance

Allowed:

- Continue local staging audits to understand Strength math and source gaps.
- Build a `price_bundle_id` proposal.
- Audit OANDA/local/Postgres M1 price gaps.
- Define the canonical price bundle contract.
- Define restatement rules for COT after price-bundle promotion.

Not allowed:

- No COT+Strength combination.
- No institutional COT-vs-Strength comparison.
- No selected-vs-fade performance claim as final.
- No regime filters.
- No execution/risk overlay selection.
- No MT5/live parity claims.
- No final system selection.

If a local selected-vs-fade Strength diagnostic is later run before the unified
price bundle exists, it must be labeled:

```text
LOCAL_STAGING_DIAGNOSTIC_NOT_COMPARABLE_TO_GATE54_COT
```

It must not be used to choose a final system or compare against the Gate 54 COT
numbers.

## Required Next Architecture Receipt

Before any final strategy comparison, create a price-bundle architecture
receipt that defines:

1. `price_bundle_id`
2. Raw source identity and storage target.
3. Instrument universe.
4. Timeframe derivation chain: M1 -> H1 -> daily -> weekly.
5. ADR derivation.
6. Pair-period return derivation.
7. Path-bar derivation.
8. Coverage target, with institutional M1 requiring 100% of expected tradable
   session bars unless Freedom explicitly approves a named waiver.
9. Missing-bar behavior.
10. Hashes for raw and derived price artifacts.
11. Restatement policy for Gate 54 COT metrics.
12. Boundary labels for any local staging diagnostics.

The `price_bundle_id` is required evidence, not decoration. Any institutional
Strength, COT restatement, ADR Grid, Weekly Hold, regime, execution, risk, or
future MT5 parity receipt that uses prices must declare the exact
`price_bundle_id`. Results without a bundle identity are diagnostic-only and
not promotion-eligible.

## Current Gate Status

Gate 55 now has two active blockers before selected-vs-fade can become
institutional evidence:

1. `M1_PRICE_BAR_INTEGRITY`

The repaired local M1 warehouse still fails the institutional 100% pair-minute
coverage target near the first 2019 boundary.

2. `PRICE_TRUTH_BOUNDARY`

Strength staging currently uses local SQLite while Gate 54 COT outcomes were
scored on the existing canonical outcome layer.

Until both blockers are resolved, Gate 55 can continue source audits and local
logic checks only. It cannot produce final comparative performance evidence.

## Still Forbidden

- No COT+Strength combination.
- No final Friday Strength selected-vs-fade claim.
- No COT-vs-Strength ranking.
- No regime overlay.
- No BPR/RRP retest.
- No PPP/NEER/REER work.
- No execution optimization.
- No risk overlay.
- No MT5/live/bot work.
- No production/live claim.
- No final Signal Model selection.
