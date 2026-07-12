# Gate 60D BPR Query/Rebuild Receipt

Generated: 2026-06-27T12:49:37.860Z

## Command

```powershell
npm run engine:gate60d:bpr-source-eligibility
```

## Runtime

- Git commit: `a767c32231f0ebb18265452989cb296b58666ec7`
- Dirty tree status at script start: `dirty`
- Dirty files: `3`

## Source Dataset Included

| Dataset | Snapshot state | Dataset status | Promotion manifest | Contract manifest hash |
|---|---|---|---|---|
| 01a3b789-2928-4886-a627-eaf5ae689790 | SEALED | complete | 1a807cdbbd79a9cc1ffc1df9b038843eacfd2eb80c3b068da9ce0c92b339f46f | 5bdac882577d4f7cbacd1934b968f9e30464760e6144797c52528237e451e5c5 |

## Probe/Rebuild Counts

- BPR source observations read: `1472`
- BPR source artifacts read: `184`
- BPR availability events read: `1472`
- BPR source registry hash: `9226D3707F3EE4AA4B64587FCE3A68CD8A659F912C0C4C1116E59FA27D7F62AF`
- BPR source content invariant hash: `20F5A88FCA8B5901FC879C076E3DF21872E9126D87C1BD5419709A5203DE5894`
- BPR currency atom ledger hash: `7B1B809CCA1CBB6B60A1E1AFECB44A4F1B4E308244DB4F37611CFD46CD55DCC7`

## Boundary

Read-only database probe and non-mutating BPR source eligibility proof against the frozen Gate 59 Alpha v1 denominator. No Regime transform, matrix, LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation was run.
