# Gate 60C Query/Rebuild Receipt

Generated: 2026-06-27T09:29:11.661Z

## Command

```powershell
npm run engine:gate60c:regime-source-atom-fill
```

## Runtime

- Git commit: `627b4a746e7ccf5149225e5217934350934c3d39`
- Dirty tree status at script start: `dirty`
- Dirty files: `23`

## Source Datasets Included

| Dataset | Snapshot state | Dataset status | Promotion manifest | Contract manifest hash |
|---|---|---|---|---|
| 01a3b789-2928-4886-a627-eaf5ae689790 | SEALED | complete | 1a807cdbbd79a9cc1ffc1df9b038843eacfd2eb80c3b068da9ce0c92b339f46f | 5bdac882577d4f7cbacd1934b968f9e30464760e6144797c52528237e451e5c5 |
| 220fd5fd-d017-4db2-bdde-524a3c664c72 | ACTIVE | complete | 5f0049dc6dac1470c55309caf922996171b2250f3ee35df2be21cd84b1599def | 8b168a89bf2f1e812ab4f4b1d60ab9cc06af93802d37d7ed191829bee7d4ace4 |
| 37b4081b-880e-4ae6-8d53-20ba900dff07 | SEALED | complete | b0b4f8e1c42139791447e4c7413e48f20de1e738fcd5d051ed06acf57f4c286c | 1a0e94ec8229b4ce169a95b8c4e3a4c0a401f87cb3502f269b312376bc0bf440 |
| 97266ab2-6feb-4962-936b-a47d73c06684 | BUILDING | complete | - | - |
| dcdc850a-80a2-4178-8d08-dd759be6afb8 | SEALED | complete | 12f04bd4bec599e37fdfdf926d0d39bd73902319654993baa71ce879bb8eecb5 | 92f93545c05b067bc204678e17283607207d59d212783eb913292ac5eef52556 |

## Probe/Rebuild Counts

- Source observations read: `10414`
- Source artifacts read: `357`
- Availability events read: `8990`
- Source registry hash: `DADCE5C3036B676236EF8B1B2DB9E64928DF5C087F016553433BB419452ABB08`
- Source content invariant hash: `82EA24665706EEB6D13773E59EF68411924588F8730732B529F55D12B092FA57`
- Currency atom ledger hash: `603C225C4919C7D4F3BC38BBD25C2CB5D24A83938142632CF2D16A8046150F27`
- Pair join ledger hash: `167C13FA309FFE74A7C074DFEE4FA97A3AEFBBFDFEF73EDD13A5287925EC6DBD`

## Boundary

Read-only database probe and non-mutating source atom fill against the frozen Gate 59 Alpha v1 denominator. No Regime side, macro LONG/SHORT decisions, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation was run.
