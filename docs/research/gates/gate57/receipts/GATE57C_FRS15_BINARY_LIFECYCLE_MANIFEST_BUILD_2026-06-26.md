# Gate 57C FRS15 Binary Lifecycle Manifest Build

Generated: 2026-06-26T21:11:16.784Z

## Result

- Gate: Gate 57C: frs15-binary-lifecycle-rule-test
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Lookback weeks: `15`
- Friday close lookup: latest 1m bar close at or before Friday freeze within `2880` minutes
- Run-time git commit: `c8ed8c785da5d1cf4c40a300cff10d5435736e66`
- Working tree status: `dirty`
- Ignored summary JSON: `engine/reports/gate57c-frs15-binary-lifecycle/manifest-summary.json`
- Source summary hash: `F772BEBABF90214062EC18812964B272880C70D40CD03FA0D8EC60E367BE62D5`

## Coverage

- Requested trade weeks: 387
- Supported trade weeks: 373
- Unsupported trade weeks: 14
- Parent selected weeks: 373
- Parent selected rows: 10444
- Parent non-full weeks: 0
- Price lookup requests: 11256
- Missing price lookups: 364
- First supported week: 2019-04-14T23:00:00.000Z
- Last supported week: 2026-05-31T23:00:00.000Z

## Manifests

| Signal | Rows | Weeks | Long | Short | Manifest hash | File SHA-256 | Path |
|---|---:|---:|---:|---:|---|---|---|
| compressed_selected | 2611 | 373 | 1270 | 1341 | `5B037322A6F8402990A31343DFFBCDC70E2452278F71DF0CBCCF813F5EECE2D1` | `52671C10A7CBCD3EBD3AA4F2930442CB3623D1974802FBD36D037AD8756F0755` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-compressed_selected.manifest.json` |
| middle_selected | 5222 | 373 | 2669 | 2553 | `DD0101D6E7779AC7C007E90DA6B5BEC90EE224E2A0959322354BFE8573DD9358` | `FF833DAC103BB7FF5EBBF2F329DDF30E4F4B9DB6692BDD19B5588AC54890CBAD` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-middle_selected.manifest.json` |
| extreme_selected | 2611 | 373 | 1454 | 1157 | `973AEEF5BA4910F5CEE6C54E70B06C2F53EE7DE659F97D72677DE340B8F127D4` | `40E2C09E837AE91C747A48BFDB29546FFE5BED49C2B2EC58F0C5EEA57554DAEF` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-extreme_selected.manifest.json` |
| compressed_fade | 2611 | 373 | 1341 | 1270 | `E9F525760E4F089C0B2E9251D7E49F06A7960A7D384456FABCB2466B9E5A7043` | `1F4A8865BB1F39CCB2E864D1AFFE7085061CEC277800EE33AB55D5F4576A04FE` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-compressed_fade.manifest.json` |
| middle_fade | 5222 | 373 | 2553 | 2669 | `6083349B67E5BFA4F5F1610F0E05DA406BB55F60F622F7DDB2FF76D1203A8CE2` | `2C1FE096F822AB58D0A762B1EB907DFC87516976137079EC2A558C2FBFD015D6` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-middle_fade.manifest.json` |
| extreme_fade | 2611 | 373 | 1157 | 1454 | `7DC98960CDE87BDD862F5C966E12849EBF93AE77F1F0796C9C5D5D0475BAE5FB` | `6E9F826FE5E648F57FEF6D10FE7441C6257E44E9DDEFF1A6D3D6A0E84611D083` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-extreme_fade.manifest.json` |
| binary_lifecycle_selected_else_extreme_fade | 10444 | 373 | 5096 | 5348 | `A8DBADAF16C5BB5B16508DA6DAC4BCDDCC81A53D2DD19A880F7BEF4DE37A5D32` | `4F0EAE03319482CDAD360E51E78FE1D4EA3C9CA3DFCE6529E331DF06BD91A7CD` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-binary_lifecycle_selected_else_extreme_fade.manifest.json` |
| parent_selected | 10444 | 373 | 5393 | 5051 | `B76955B5320E7AEAF2E2F33A0C56EA63104D130FE28EBD03790C311ACD34CC95` | `D90CA212CA3B665F26DF61A151AD80A13C7CE7957622612828C299E6FDC8CFC9` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-parent_selected.manifest.json` |
| parent_fade | 10444 | 373 | 5051 | 5393 | `01138ADF25F9069E9F0F12D93DFC7232BFD0B240660BD2C66940CE9D127868CB` | `4EA531E896E8D75B3BC3C27BA6F2D26D8DEA0AF7FABD12C26DA2EE74E6E16DBE` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-parent_fade.manifest.json` |
| no_extreme_selected | 7833 | 373 | 3939 | 3894 | `A189D4FA75C78AA20AC44BE2CD6FD6E9365DE3761638C815796865AADE241C26` | `9D58628B1B9A8A70A3BAC4DC71B4C2801464C6DB3433FD1FCC0FA739769A6F52` | `engine/reports/gate57c-frs15-binary-lifecycle/manifests/gate57c-frs15-binary-lifecycle-no_extreme_selected.manifest.json` |

## Boundary

This command emits Friday-only 15-week relative Strength manifests. It does not use market-open confirmation, run raw M1 ADR Grid simulation, score results, retune COT, combine COT+Strength, run regimes, optimize execution, add risk overlays, or promote live/MT5 work.

## Dirty Tree Files

- M engine/scripts/verification/generate-gate57b-friday-strength15w-manifests.ts
-  M engine/src/signals/strength/fridayRelativeStrength15wManifest.ts
-  M package.json
- ?? docs/research/gates/gate57/receipts/GATE57C_FRS15_BINARY_LIFECYCLE_MANIFEST_BUILD_2026-06-26.md

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\generate-gate57b-friday-strength15w-manifests.ts --preset=gate57c`

Runtime seconds: 38.1

Receipt hash: `D0657A1205621723B4FC448FF0678DEAF9FCB86FB7A1E27A6EE44C610D7B4391`
