# Gate 56E Evidence Hardening Amendment

Generated: 2026-06-26

## Verdict

Gate 56E remains accepted.

This amendment records the evidence caveats raised during external review of
commit `aa8a82d6081a14d776b89e02840b7f78252954c4`. It does not rerun parity,
rebuild manifests, change evaluator logic, open COT restatement, open Strength
buckets, open regimes, combine COT and Strength, optimize execution, add risk
overlays, or promote MT5/live work.

## Commit Evidence Boundary

- Artifact commit under review:
  `aa8a82d6081a14d776b89e02840b7f78252954c4`
- Registry run-time git commit:
  `f9b57fcd7be88d3bf887207e4d6ed01447612407`
- Selected run ID:
  `gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260625T225526Z-33DB0459`
- Fade run ID:
  `gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260625T234135Z-BB3142AF`

The registry rows correctly record `f9b57fcd` because the selected/fade
evaluator runs were executed before the final Gate 56E artifact commit was
created. The final reviewed commit `aa8a82d` then committed the engine changes,
result JSONs, hash JSONs, receipts, registry rows, and durable parity receipt.

This is acceptable for the Gate 56E parity claim because the tracked artifacts
under review contain the selected/fade results, hash files, receipts, and
registry rows that reproduce the accepted Gate 55G metrics exactly. It is not
the preferred institutional receipt shape for future runs.

## Working Tree State

The working tree status during manifest generation and evaluator execution was
not recorded by the Gate 56E commands. Treat it as `unknown`.

Because the registry run-time commit predates the final artifact commit, the
runtime tree should not be claimed clean from the durable evidence. Future
engine receipts must record dirty-tree status directly.

## Durable Commands

The generated build receipt captured the full local Node invocation with
absolute Windows paths. The durable repo-relative command for the manifest build
is:

```powershell
npm run engine:gate55g:manifests -- --batch-weeks=8
```

The durable selected/fade scoring command remains:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --artifact-gate=gate56 --out-dir=docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity --docs-receipt-dir=docs/research/gates/gate56/receipts --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --log-progress --clear-runtime-cache-between-weeks
```

## Large Manifest Policy

Full normalized decision-manifest JSON files may remain ignored and
reproducible when all of the following are tracked or recorded:

- manifest hash,
- manifest file SHA-256,
- exact regeneration command,
- source bundle and source-context IDs,
- result JSON,
- receipt/hash JSON,
- append-only registry row.

Gate 56E satisfies this standard.

## Future Receipt Rule

Future engine manifest-build and evaluator receipts must record:

- run-time git commit,
- artifact commit under review when different,
- working-tree status as `clean`, `dirty`, or `unknown`,
- dirty file list or a pointer to a status receipt when dirty,
- durable repo-relative command,
- generated local command only as secondary diagnostic detail.

## No Rerun

Do not rerun the full Gate 56E selected/fade parity proof unless a tracked hash,
result, or receipt fails verification.

Next authorized research gate, if Freedom accepts this amendment: re-score the
locked Gate 54 COT decisions through the canonical engine by emitting a
`ResearchDecisionManifest` and using `npm run engine:research-manifest:evaluate`.
