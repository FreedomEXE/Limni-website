# Gate 56F Gate 54 COT Restatement Manifest Build

Generated: 2026-06-26T02:13:02.955Z

## Result

- Gate: Gate 56F: gate54-cot-restatement-through-engine
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Manifest: `docs/research/gates/gate56/manifests/gate56f-locked-gate54-clp-cot-restatement.manifest.json`
- Manifest hash: `563B4142312DD7B84541C3378AF68402E06BC68AEBF00D3F289E936B58005781`
- Manifest file SHA-256: `B18B09D4FC4C596D82638F57A5546F39D06FF8EF936DC329431060C20C98E523`
- Config hash: `BE94F3417E3043758B0F450877BD50C9F5C4C604D45B966449F9EC01F2BAB383`
- Source summary hash: `56D144A60FC986C1C1F155CF71C20A4F3820A5250C32FC76477B0D0CCCD1B52A`
- Run-time git commit: `157dc2e195137415dfa19cff36639cfd8b7195dc`
- Working tree status: `clean`

## Shape Validation

- Passed: true
- Rows: 10864/10864
- Weeks: 388/388
- First week: 2019-01-07T00:00:00.000Z
- Last week: 2026-06-07T23:00:00.000Z
- Long rows: 5443
- Short rows: 5421
- Duplicate week/symbol rows: 0
- Non-full weeks: 0

## Source

- Matrix dataset: 479624d1-f6a2-4928-82f1-981137762bdc / cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
- COT report dates: 546
- COT date range: 2016-01-05 -> 2026-06-16
- CLP lifecycle lookback reports: 156
- First lifecycle report date: 2018-12-24
- Missing metric windows: 0
- Tie rows: 71
- Carry-previous tie rows: 71

## Dirty Tree Files

- none

## Command

`npm run engine:gate54:cot-manifest -- --expected-weeks=388 --expected-rows=10864`

Generated local command:

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\generate-gate54-cot-restatement-manifest.ts --expected-weeks=388 --expected-rows=10864`

## Boundary

This command emits and validates a frozen COT decision manifest only. It does not score results, retune COT, change CLP carry-forward or tie-fill policy, create a COT-specific evaluator, run Strength buckets, run regime filters, combine COT+Strength, optimize execution, add risk overlays, or promote live/MT5 work.

Runtime seconds: 7.2

Receipt hash: `B04EA91950B2771EBB23F73D7422F43E17ADB87FD0AA39F1241A49D8661DE985`
