# Gate 108 Phase 4R repository compile evidence

Scope: repository-only MetaEditor compilation of the institutional foundation
hardening. No terminal source synchronization or MT5 runtime execution occurred.

## Authoritative receipt

The only source-sealed Phase 4R build evidence is:

- `metaeditor-repo-compile-attempt17-final-sealed.log`
- `SOURCE_BUNDLE_AND_COMPILE_RECEIPT.txt`

Result:

```text
source_bundle=sha256:985e930f89dfce55c88a026db42725210f6b189ef98c2d147bd77975babd2516
source_bundle_status=MATCH
compile=0 errors, 0 warnings, 198399 msec elapsed
EX5=635728 bytes
EX5_SHA256=7eac521d8fcc52d200abd59dc1ae459b7215f2ed1f53a8c0d5f5fb977e306b06
```

## Attempt history

- Initial compile: `32 errors, 0 warnings`; no accepted EX5.
- Attempt 2: `0 errors, 0 warnings, 200865 ms`.
- Attempt 3: `0 errors, 2 warnings, 206425 ms`; warnings were corrected, not waived.
- Attempts 4-5: clean compiler checkpoints at `207928 ms` and `207036 ms`.
- Attempt 6: `6 errors, 0 warnings`; summary-ledger field references were repaired.
- Attempts 7-14: clean intermediate compiler checkpoints between `196465 ms`
  and `244931 ms`.
- Attempts 15-16: clean v12 hardening checkpoints at `213365 ms` and
  `222948 ms`.
- Attempt 17: final post-audit, post-source-bundle-seal compile; authoritative.

Every attempt before 17 is superseded because source changed afterward or the
compile preceded the final source-bundle seal.

MetaEditor can return process exit code `1` for a clean compile in this
environment. The compiler `Result:` line, sealed source identity, output hash,
and receipt are the evidence boundary.

No Strategy Tester, smoke runner, shard runner, benchmark, optimization,
parameter ladder, or other backtest automation was run.
