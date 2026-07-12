# Gate 57D FRS15 Compressed-Go Remainder-Fade Manifest Build

Generated: 2026-06-27T00:50:11.408Z

## Result

- Gate: Gate 57D: frs15-compressed-go-remainder-fade-rule
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Lookback weeks: `15`
- Friday close lookup: latest 1m bar close at or before Friday freeze within `2880` minutes
- Run-time git commit: `69efd13bacbaface8fd545eff018e44f71ec2989`
- Working tree status: `dirty`
- Ignored summary JSON: `engine/reports/gate57d-frs15-compressed-remainder-fade/manifest-summary.json`
- Source summary hash: `A29595D3F184A9B87C941833B975154FBBFA69ADB1DE1305FA12869728B17BBE`

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
| parent_selected | 10444 | 373 | 5393 | 5051 | `A78CF038B4A68059715A719FC66079BDAF31DEFCCD671AAB55074D41F86B1F01` | `F6D301E99973E512AF15C0980EE7315ABADFEE9B43BC7FCD0B86AE8BC1F14277` | `engine/reports/gate57d-frs15-compressed-remainder-fade/manifests/gate57d-frs15-compressed-remainder-fade-parent_selected.manifest.json` |
| parent_fade | 10444 | 373 | 5051 | 5393 | `90820405FA8708B6A657A618F1219DC7CB245CFF403AACEA8A98984DBF10FC90` | `A5BA13E8DF0FACBBA61927A5E47429742CDDA4CE00DADB6204B63E6A775B9660` | `engine/reports/gate57d-frs15-compressed-remainder-fade/manifests/gate57d-frs15-compressed-remainder-fade-parent_fade.manifest.json` |
| binary_lifecycle_selected_else_extreme_fade | 10444 | 373 | 5096 | 5348 | `8FAB570A5901E26C84EDC903E09031ACDB99C1315C7CB6C93924A6122C021599` | `4849A548EA109F99341FDA54C2A893AC4DACB8C76DBC0FB168F92BB94967C4D3` | `engine/reports/gate57d-frs15-compressed-remainder-fade/manifests/gate57d-frs15-compressed-remainder-fade-binary_lifecycle_selected_else_extreme_fade.manifest.json` |
| compressed_selected_remainder_fade | 10444 | 373 | 4980 | 5464 | `AAB42479A02155CC55D96340890CDAB5390DBEBA02FF3ACC1867D988BA348399` | `2DA121655B6F0C02CC2FB0E4FE7F2E7EFFA3C3A949292F9293907012E24AF0B3` | `engine/reports/gate57d-frs15-compressed-remainder-fade/manifests/gate57d-frs15-compressed-remainder-fade-compressed_selected_remainder_fade.manifest.json` |
| compressed_selected_middle_fade_extreme_selected | 10444 | 373 | 5277 | 5167 | `90AA71FD06B870EBC3CC1AE92F7FD12FF2580D85FD13627B1941FADE94EE4FD7` | `1D9472C31F3E71CB52092BA6C3B17FE5DF745FC7097BC225DCC200D66256BBA6` | `engine/reports/gate57d-frs15-compressed-remainder-fade/manifests/gate57d-frs15-compressed-remainder-fade-compressed_selected_middle_fade_extreme_selected.manifest.json` |

## Boundary

This command emits Friday-only 15-week relative Strength manifests. It does not use market-open confirmation, run raw M1 ADR Grid simulation, score results, retune COT, combine COT+Strength, run regimes, optimize execution, add risk overlays, or promote live/MT5 work.

## Dirty Tree Files

- M engine/scripts/verification/generate-gate57b-friday-strength15w-manifests.ts
-  M engine/src/signals/strength/fridayRelativeStrength15wManifest.ts
-  M package.json

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\generate-gate57b-friday-strength15w-manifests.ts --preset=gate57d`

Runtime seconds: 36.5

Receipt hash: `A387EAD0862E9B824E8756EAB868E9FA0469D454F0B056EA45C636CABDDD171B`
