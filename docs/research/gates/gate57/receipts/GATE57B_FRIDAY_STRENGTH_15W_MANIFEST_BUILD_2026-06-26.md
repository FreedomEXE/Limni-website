# Gate 57B Friday Strength 15W Manifest Build

Generated: 2026-06-26T20:27:22.982Z

## Result

- Gate: Gate 57B: friday-strength-15w-relative-lifecycle
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Lookback weeks: `15`
- Friday close lookup: latest 1m bar close at or before Friday freeze within `2880` minutes
- Run-time git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Working tree status: `dirty`
- Ignored summary JSON: `engine/reports/gate57b-friday-strength15w/manifest-summary.json`
- Source summary hash: `4C77642B440789A6EE7C86FAC6A46AF8DF55A443FA876A032410825A6EDCA5BF`

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
| parent_selected | 10444 | 373 | 5393 | 5051 | `C78D99BD8252ACB6C38E33B9C78ABEF56771CD6311AEFE74188E1D86CC20043B` | `AB60C4BC1031DDB71741B84AF1943AE51EB6EAB09C0164521CDDB5C11A592913` | `engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-parent_selected.manifest.json` |
| parent_fade | 10444 | 373 | 5051 | 5393 | `B07E5A4D8D38532EBCA5C036887528F37889FE5F8F7B1F8386C2F8EE049EE2DF` | `AA00878D2F0FE612E1EEDAE414836A7D7E8C39CADBD06D3E3E99F197E8C7A8CB` | `engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-parent_fade.manifest.json` |
| compressed_selected | 2611 | 373 | 1270 | 1341 | `5F1C3DFFE70BC60C152170A840EED3FAC62A18E48CD55CD446698A7953767285` | `08A202280B06A79EC5B7D98E5B11664EFF13C944E0461E0DEA3639F8BB98D857` | `engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-compressed_selected.manifest.json` |
| middle_selected | 5222 | 373 | 2669 | 2553 | `A2D18FAFC62CB8D427DDBA2740582DCD38CFF5920E73444258C22BAF5D9C48D5` | `7990490E5BBE1C49A1BC0C3BBCD630065A7831E5D916CB9FF0B68F0CECE57F17` | `engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-middle_selected.manifest.json` |
| extreme_selected | 2611 | 373 | 1454 | 1157 | `D656F556467B4B696E1D2B46B2D879DFC6FCA1AE03659A7EAA498CC0F71FA1C9` | `C692ADC9F7C28D561C9F3D6EC043E18639B6631B6B3DB533750E3C8AAD71487D` | `engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-extreme_selected.manifest.json` |
| no_extreme_selected | 7833 | 373 | 3939 | 3894 | `79D46B5CE925611550811F5560AA52C991DC688528838CB4CA5458F278B64A4D` | `042D34167AD91713563B406FA04ABF39433D8896C503A26455C8F09CB9A0E349` | `engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-no_extreme_selected.manifest.json` |
| persistent_selected | 9117 | 372 | 4727 | 4390 | `D9771E1612960FAA8C524A65894508FA1770E861E4B9C2D93DD96631A2CBFC95` | `74F4206D0EC53E8216566CA103D9438D110FC5C672DF2BCE48FE6DE408BA326B` | `engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-persistent_selected.manifest.json` |
| flip_selected | 1299 | 352 | 647 | 652 | `42CAC91BF2482AE8A4AAB87A05FDEF0929F617CF702A4819B04033B8C46EFCC0` | `2EFB82762F7B3DE87F0533085EC8D40F7F46C943F9E9469D33819DCB595DB1C6` | `engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-flip_selected.manifest.json` |

## Boundary

This command emits Friday-only 15-week relative Strength manifests. It does not use market-open confirmation, run raw M1 ADR Grid simulation, score results, retune COT, combine COT+Strength, run regimes, optimize execution, add risk overlays, or promote live/MT5 work.

## Dirty Tree Files

- M docs/backlog/CURRENT_WORK.md
-  M package.json
- ?? docs/research/gates/gate57/GATE57A_STRENGTH_PREFLIGHT_ROLE_LOCK_2026-06-26.md
- ?? docs/research/gates/gate57/GATE57A_STRENGTH_WAREHOUSE_ROLE_EVALUATION_2026-06-26.md
- ?? docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/registry/research-run-registry.jsonl
- ?? docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/runs/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T193612Z-BB3142AF.receipt.md
- ?? docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/runs/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T193557Z-33DB0459.receipt.md
- ?? docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/runs/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-strongest-quartile-selected-20260626T193622Z-97A12B87.receipt.md
- ?? docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/runs/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-weakest-quartile-selected-20260626T193641Z-BD861B66.receipt.md
- ?? docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/runs/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-rolling-52w-context-selected-20260626T193658Z-A2FB501D.receipt.md
- ?? docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/runs/gate57-gate57a-strength-role-evaluation-control-gate57a-control-fade-same-window-rolling52-20260626T193756Z-7AF6C273.receipt.md
- ?? docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/runs/gate57-gate57a-strength-role-evaluation-control-gate57a-control-selected-same-window-rolling52-20260626T193715Z-C100B45F.receipt.md
- ?? docs/research/gates/gate57/receipts/GATE57B_FRIDAY_STRENGTH_15W_MANIFEST_BUILD_2026-06-26.md
- ?? docs/research/gates/gate57/receipts/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T193612Z-BB3142AF.md
- ?? docs/research/gates/gate57/receipts/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T193557Z-33DB0459.md
- ?? docs/research/gates/gate57/receipts/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-strongest-quartile-selected-20260626T193622Z-97A12B87.md
- ?? docs/research/gates/gate57/receipts/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-weakest-quartile-selected-20260626T193641Z-BD861B66.md
- ?? docs/research/gates/gate57/receipts/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-rolling-52w-context-selected-20260626T193658Z-A2FB501D.md
- ?? docs/research/gates/gate57/receipts/gate57-gate57a-strength-role-evaluation-control-gate57a-control-fade-same-window-rolling52-20260626T193756Z-7AF6C273.md
- ?? docs/research/gates/gate57/receipts/gate57-gate57a-strength-role-evaluation-control-gate57a-control-selected-same-window-rolling52-20260626T193715Z-C100B45F.md
- ?? engine/scripts/verification/generate-gate57b-friday-strength15w-manifests.ts
- ?? engine/src/signals/strength/fridayRelativeStrength15wManifest.ts

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\generate-gate57b-friday-strength15w-manifests.ts`

Runtime seconds: 24.8

Receipt hash: `8504E283157FE57B3D0BCDE86538C7DE66479855193704891D4D696D6E546CBC`
