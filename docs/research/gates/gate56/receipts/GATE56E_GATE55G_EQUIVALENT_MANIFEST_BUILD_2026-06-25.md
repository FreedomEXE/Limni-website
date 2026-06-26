# Gate 56E Gate 55G Equivalent Manifest Build

Generated: 2026-06-25T22:54:01.459Z

## Result

- Gate: Gate 56E: gate55g-equivalent-manifest-parity
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Selected manifest: `docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-selected-equivalent.manifest.json`
- Fade manifest: `docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-fade-equivalent.manifest.json`
- Selected manifest file SHA-256: `AEDB9BF5C368C8A14739EA4CCCEDEEDB5E91A7CADC5790258DF269AEA6D11E19`
- Fade manifest file SHA-256: `95008C22FAD2B1D816637F32272F3081DEEB37C3726B44C6C2F8B1AB6977066D`
- Source summary hash: `294F0317506C26E433FDB31A09CCCAC6EFC141334272C71D7C10061FD4257FE0`

## Coverage

- Weeks: 387
- Expected rows: 10836
- Selected source rows: 10836
- Full source weeks: 387
- Non-full source weeks: 0
- Snapshot times: 2895
- Snapshot rows: 115800
- Complete snapshot rows: 114880
- Incomplete snapshot rows: 920
- Source coverage range: 0% to 100%

## Manifest Rows

| Manifest | Rows | Long | Short | Manifest hash |
|---|---:|---:|---:|---|
| selected | 10836 | 5612 | 5224 | `33DB04595F371AF4943E2E83E0E40EBEF8C51F7AE89CF96ACF17FF0B71E53ADE` |
| fade | 10836 | 5224 | 5612 | `BB3142AF507A5CEBE6467E8055467C1B2003126BACA896F3827206DB0755ED28` |

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\generate-gate55g-equivalent-strength-manifests.ts --batch-weeks=8`

## Boundary

This command emits frozen equivalent selected/fade decision manifests only. It does not score results, run Strength buckets, run regime filters, restate COT, combine COT+Strength, optimize execution, add risk overlays, create a new backtest engine, or promote live/MT5 work.

Receipt hash: `A3AAC44FE81F648C5A0878E84BCC3D3438B460F065A8F064700ACE17E3B67C66`
