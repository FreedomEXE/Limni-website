# Gate 55H Evaluator Parity Pending

Generated: 2026-06-25

## Status

PENDING_GATE55G_EQUIVALENT_MANIFEST_PARITY.

The Gate 55H manifest evaluator is a candidate shared evaluator. It is not yet
accepted as final shared architecture because no parity receipt has proven that
equivalent frozen manifests reproduce the Gate 55G selected/fade ADR Grid and
weekly-hold metrics.

## Required Parity Proof

Before the evaluator can be called accepted final architecture:

1. Generate one frozen manifest for Gate 55G Friday Strength selected decisions.
2. Generate one frozen manifest for Gate 55G Friday Strength fade decisions.
3. Use price bundle:
   `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`.
4. Score both manifests through:
   `npm run engine:research-manifest:evaluate -- --manifest=<manifest.json>`.
5. Prove the evaluator reproduces the frozen Gate 55G metrics:
   - Selected ADR Grid: `+1311.8526` ADR.
   - Fade ADR Grid: `+988.7181` ADR.
   - Selected weekly hold: `-315.1911` ADR.
   - Fade weekly hold: `+315.1911` ADR.
6. Store the parity receipt under
   `docs/research/gates/gate55/receipts/` with repo-relative artifact paths.

## Hard Boundary

This pending marker does not authorize COT restatement, Strength buckets, regime
filters, COT+Strength combination, risk overlays, execution optimization,
source reconstruction, or MT5/live work.
