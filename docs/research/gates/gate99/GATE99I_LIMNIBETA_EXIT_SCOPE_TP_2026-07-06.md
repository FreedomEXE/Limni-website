# Gate 99I - LimniBeta Exit Scope TP

Date: 2026-07-06

## Scope

Freedom flagged that `LimniBeta` had no TP layer after the rename/input cleanup.
This gate adds the old EA-style exit scope control without changing entry logic.

## Changes

Updated:

- `automation/mt5/Experts/LimniBeta.mq5`

New inputs:

- `ExitScope`: `EXIT_GRID` or `EXIT_ACCOUNT`
- `TP`: one value whose unit depends on `ExitScope`

Exit units:

- `EXIT_GRID`: `TP` is measured in LRMG units, using the current grid q
  (`g_entryQ`) instead of ADR.
- `EXIT_ACCOUNT`: `TP` is measured as percent of account balance.

Grid TP behavior:

- A long grid closes when bar high reaches `avg_entry + g_entryQ * TP`.
- A short grid closes when bar low reaches `avg_entry - g_entryQ * TP`.
- The close reason is `grid_tp`.
- This follows the old archived EA shape where pair TP was a distance from the
  basket average entry; only the metric changed from ADR to LRMG q.

Account TP behavior:

- The scaffold remains chart-symbol only.
- Account TP currently measures open money from this chart symbol's
  `LimniBeta` magic positions against account balance.
- A grid closes when `100 * open_money / account_balance >= TP`.
- The close reason is `account_tp`.
- Future multi-symbol portfolio/account management should widen this into a
  true all-symbol account book with state-aware closes.

Boundary behavior:

- Gate 99G's week boundary guard still wins.
- No opens, closes, or grid adds occur during Sunday `17:00-17:59 EST` or
  Friday `16:00-16:59 EST`.

Not added in this gate:

- Signal-level SL.
- Pair/grid SL.
- Trailing stop.
- Multi-symbol portfolio/account close orchestration.

## Receipts

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99i-limnibeta-exit-scope-tp-2026-07-06/`

Compile logs:

- `repo-LimniBeta-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `active-LimniBeta-compile-log.txt`: `Result: 0 errors, 0 warnings`

MetaEditor returned process exit code `1` with clean logs, matching known MT5
compile behavior in this repo.

Repo and active-terminal source hashes matched after install:

- `LimniBeta.mq5`: `9CA9C91F460769EE7AD5EDE9C7A3A786F92D54A3EF761D3E267C6E7F0BCF6C40`

## Next Action

Run the same symbol/window in:

- `EntryMode=Strict`, `ExitScope=EXIT_GRID`, `TP=1.0`
- `EntryMode=Loose`, `ExitScope=EXIT_GRID`, `TP=1.0`
- Optional account-percent comparison: `ExitScope=EXIT_ACCOUNT`, `TP` set to
  the desired account-balance percent.

Compare closed-plus-terminal-marked Q, grid fill count, TP close count, ignored
signals, week-boundary blocked counts, and whether `Loose` overfeeds relative to
`Strict`.
