# Gate 60B Query/Rebuild Receipt

Generated: 2026-06-27T08:00:38.413Z

## Command

```powershell
npm run engine:gate60b:regime-source-foundation
```

## Runtime

- Git commit: `f8f04fc606cc39b873f4f045e9e0dbe87de16866`
- Dirty tree status at script start: `dirty`
- Dirty files: `3`

## Source Datasets Included

| Dataset | Snapshot state | Dataset status | Promotion manifest | Contract manifest hash |
|---|---|---|---|---|
| 01a3b789-2928-4886-a627-eaf5ae689790 | SEALED | complete | 1a807cdbbd79a9cc1ffc1df9b038843eacfd2eb80c3b068da9ce0c92b339f46f | 5bdac882577d4f7cbacd1934b968f9e30464760e6144797c52528237e451e5c5 |
| 220fd5fd-d017-4db2-bdde-524a3c664c72 | ACTIVE | complete | 5f0049dc6dac1470c55309caf922996171b2250f3ee35df2be21cd84b1599def | 8b168a89bf2f1e812ab4f4b1d60ab9cc06af93802d37d7ed191829bee7d4ace4 |
| 37b4081b-880e-4ae6-8d53-20ba900dff07 | SEALED | complete | b0b4f8e1c42139791447e4c7413e48f20de1e738fcd5d051ed06acf57f4c286c | 1a0e94ec8229b4ce169a95b8c4e3a4c0a401f87cb3502f269b312376bc0bf440 |
| 97266ab2-6feb-4962-936b-a47d73c06684 | BUILDING | complete | - | - |
| dcdc850a-80a2-4178-8d08-dd759be6afb8 | SEALED | complete | 12f04bd4bec599e37fdfdf926d0d39bd73902319654993baa71ce879bb8eecb5 | 92f93545c05b067bc204678e17283607207d59d212783eb913292ac5eef52556 |

## Probe/Rebuild Counts

- Source manifest rows read: `1868`
- Source observations read: `5154`
- Source weekly snapshot rows read: `39200`
- Source registry hash: `9EC1D0877E03A4CAD753015E4A3F2E944F22E6A73F1E6FF008B7786C99D583D8`
- Source content invariant hash: `E40E207E27FB3461C66DCE07F30601010DB4CA01AC342AE3EA1530EA91695458`
- Join-map hash: `AB85E93DCC62CC900ED48751ACD627DDBC142BB695DD92130BF2E566BE308554`

## Boundary

Read-only database probe and non-mutating Alpha-week shadow rebuild. No macro source rows, Gate 59 rows, COT, Strength, Alpha v1, app runtime, Regime side, P&L, risk, execution, MT5/live, or Alpha v2 work was run.
