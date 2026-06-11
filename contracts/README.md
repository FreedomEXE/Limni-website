# Contracts

Generated and source data contracts shared across app, MT5, and tooling.

## Contents

| Path | Purpose |
|---|---|
| `mt5_event_contract.json` | Source contract for MT5 event generation. |

## Rules

- Contract generation is checked by `.github/workflows/contract-artifacts-sync.yml`.
- Do not edit generated contract outputs without running and verifying
  `npx tsx scripts/generate-contracts.ts`.
- Future move target is `database/contracts/`, but that requires workflow,
  generator, MT5, and deploy-path updates in the same gate.
