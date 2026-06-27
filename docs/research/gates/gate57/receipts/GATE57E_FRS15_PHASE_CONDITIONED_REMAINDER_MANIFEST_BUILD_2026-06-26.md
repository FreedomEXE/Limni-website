# Gate 57E FRS15 Phase-Conditioned Remainder Manifest Build

Generated: 2026-06-27T01:28:13.890Z

## Result

- Gate: Gate 57E: frs15-phase-conditioned-remainder-rule
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Lookback weeks: `15`
- Friday close lookup: latest 1m bar close at or before Friday freeze within `2880` minutes
- Run-time git commit: `49743886e769f2c7f28eeda864b05d8d33141c5e`
- Working tree status: `dirty`
- Ignored summary JSON: `engine/reports/gate57e-frs15-phase-conditioned-remainder/manifest-summary.json`
- Source summary hash: `57A1774E3845718E48357A98A9827F2D366896631E4709D9B95553D5CA5ABCFC`

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
| parent_selected | 10444 | 373 | 5393 | 5051 | `48D9644A123489D653435584FB1BA392CF496872146671CF9B3D21894A5A5480` | `7F3FFA99C5D9F60E6C13D0B407431DA732F674A3FE518F8915172A3085299A80` | `engine/reports/gate57e-frs15-phase-conditioned-remainder/manifests/gate57e-frs15-phase-conditioned-remainder-parent_selected.manifest.json` |
| binary_lifecycle_selected_else_extreme_fade | 10444 | 373 | 5096 | 5348 | `8682272623160F14BA299A4C506B248FAFEAE7CC5BBF4DC3F2427FACFA13666E` | `5A3F3A301B5044398A89408A6F500DCD3F152C93E475D8F37BE21E9803697984` | `engine/reports/gate57e-frs15-phase-conditioned-remainder/manifests/gate57e-frs15-phase-conditioned-remainder-binary_lifecycle_selected_else_extreme_fade.manifest.json` |
| compressed_selected_remainder_fade | 10444 | 373 | 4980 | 5464 | `BD686DD89AC65251C5F6BB40E54367934267207C9D251FE9C02F6DEC91E150D7` | `E299BB9D6D135ED9AC22DAAFC12D6F49950789ADC16AEB010B46DE11981852CC` | `engine/reports/gate57e-frs15-phase-conditioned-remainder/manifests/gate57e-frs15-phase-conditioned-remainder-compressed_selected_remainder_fade.manifest.json` |
| phase_conditioned_remainder | 10444 | 373 | 4993 | 5451 | `325AA226215ABAC5D722A8011209239A84DC24416EADBCF8C33EACF54E6E5D27` | `6A9C833D6A4FEA01C2ECBED53DC9DEBB45965D4EFB0E324ACA0FC2BA8E7280F4` | `engine/reports/gate57e-frs15-phase-conditioned-remainder/manifests/gate57e-frs15-phase-conditioned-remainder-phase_conditioned_remainder.manifest.json` |
| phase_conditioned_all28 | 10444 | 373 | 5056 | 5388 | `DC79B1345E1FE3E2FA506C0C2F353651B076C01175DA37B8D7B78A9C2D925235` | `E268BC1281946D355521D16E8A5C31E44D71A2822AB8D85C2BAB4F1AE417429B` | `engine/reports/gate57e-frs15-phase-conditioned-remainder/manifests/gate57e-frs15-phase-conditioned-remainder-phase_conditioned_all28.manifest.json` |

## Boundary

This command emits Friday-only 15-week relative Strength manifests. It does not use market-open confirmation, run raw M1 ADR Grid simulation, score results, retune COT, combine COT+Strength, run regimes, optimize execution, add risk overlays, or promote live/MT5 work.

## Dirty Tree Files

- M engine/scripts/verification/generate-gate57b-friday-strength15w-manifests.ts
-  M engine/src/signals/strength/fridayRelativeStrength15wManifest.ts
-  M package.json

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\generate-gate57b-friday-strength15w-manifests.ts --preset=gate57e`

Runtime seconds: 51.7

Receipt hash: `F6DD8C8493FC9B016EC6F15D2EC2402C7C22FACF5B6E52967F8DB286348C2223`
