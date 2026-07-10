# Gate 107C-R - `R90662359` Negative-Evidence Audit

Date: 2026-07-10
Disposition: rejected as a controlled research run; retained as diagnostic evidence only

## Packet identity

- Run ID: `LPEA_2025_01_01_00_00_00_R90662359`
- Source revision: `c88bb16a682aebd078669a8b820c4b76ab8f0a16`
- EA build: `0.1.25-gate107c-research-integrity`
- Test window: `2025.01.01 00:00:00` through `2025.12.31 23:59:30`
- Receipt mode: `COMPACT_LONG_RUN`
- Saved packet: MT5 Common Files folder
  `LPEA_FX28_MEDIUM_50000_APct_RC_2025_01_01_00_00_00_R90662359`

Key packet hashes:

| File | Bytes | SHA-256 |
|---|---:|---|
| `LPEA_2025_01_01_00_00_00_R90662359_summary.csv` | 7,854 | `19FE793720110FA64D3C83BC08959F1379E59B2A7F98A6945818C93D60690CA1` |
| `LPEA_2025_01_01_00_00_00_R90662359_receipts.csv` | 211,716,401 | `B6F9EB60879D0D38DABCD3718A1A345555533EB82BA0BBE4B66D3E22731CEFF9` |
| `T00_R90662359_revma_reconciliation_summary.csv` | 275 | `13B7FB84C30961EC515A3E9C3E1A1C00702A04C21B5342276AB0220AFA73E700` |
| `T00_R90662359_revma_grid_outcomes.csv` | 534,851 | `77EF06DE7DC94AD6514B46C87F8E40090C7CB67CCEE2E01CFEB3FE833A95595F` |
| `T00_R90662359_revma_reconciliation_unmatched.csv` | 75 | `AAD193DA515F14CC70BA9DD4A7FDD91646500F362AC9EB80915D6C496C94A7F2` |

## What passed

- All required telemetry artifacts were present.
- `1365` grid rows were emitted and all grids ended flat.
- Terminal ownership counts were internally coherent: `245` `grid_tp` rows and
  `1120` `account_tp` rows.
- `19096` monetary deals matched recorded position identifiers.
- The unmatched-deal and unmatched-position counts were both zero.
- Lifecycle persistence failures, no-money failures, and end-open grids were zero.

These facts show that the broader lifecycle and position-identifier telemetry
worked. They do not make the packet acceptable because the independent
managed-magic ledger and broker-admission requirements failed.

## Exact reconciliation defect

The packet reported:

| Ledger | Net realized PnL |
|---|---:|
| Managed account magic ledger | `6712.06` |
| Grid-outcome position ledger | `7968.25` |
| Difference | `-1256.19` |

The difference is fully attributable:

| Close owner | Rows | PnL | Swap | Commission | Net |
|---|---:|---:|---:|---:|---:|
| `grid_close` | 245 | `7041.79` | `-33.07` | `-296.66` | `6712.06` |
| `account_tp` | 1120 | `1900.48` | `99.11` | `-743.40` | `1256.19` |
| Total | 1365 | `8942.27` | `66.04` | `-1040.06` | `7968.25` |

The managed-magic ledger equals the `grid_close` component exactly. The
account-level close path sent closes under magic `0`, so those exit deals were
valid position-ledger economics but failed the strict managed-magic ownership
test. This was an execution-attribution defect, not an unexplained economic
remainder.

## Exact broker contamination

The packet contained `173` failed order results, all
`TRADE_RETCODE_MARKET_CLOSED` (`10018`):

| Intent action | Meaning | Count |
|---:|---|---:|
| `1` | grid birth/open | 16 |
| `2` | grid add/open | 112 |
| `4` | grid close | 20 |
| `5` | account close | 25 |
| Total opens/adds | | 128 |
| Total closes | | 45 |

Every rejection occurred in the daily broker-rollover interval from `23:58:00`
through `00:03:30` server time. These were preventable submissions, so the run
is formula-unclean even though no-money failures were zero.

## Repair boundary

Source commit `42d2b15b5e1255657328e5bf844c65b107ebf9f9` repairs only
runtime integrity:

- each close request is stamped with the selected managed position's exact
  magic immediately before submission;
- reconciliation validates the deal magic against the exact expected grid
  magic as well as its position identifier;
- broker symbol sessions are checked before opens, closes, and broker-side TP
  modifications;
- closed-session work is deferred locally and remains retryable without being
  reported as a broker rejection;
- genuine post-admission broker failures, including modification failures,
  remain formula-contaminating;
- session blocks, deferrals, metadata failures, and their timestamps are
  included in final telemetry.

No Revma signal, q/state, birth/add, grid spacing, lot size, TP/SL, account
TP/HWM, Candidate B, Kyma, portfolio formula, or Gate 108 runtime logic changed.

## Acceptance consequence

`R90662359` must not be used for profitability interpretation or Gate 108
promotion. One Freedom-owned controlled rerun of the pinned repaired build is
required. It must reconcile within `0.01`, contain no ownership mismatches or
broker rejections, report no session-metadata failure, end with all grids flat,
and emit the complete runtime packet.
