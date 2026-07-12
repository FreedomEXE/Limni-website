# Limni MT5 EA Version and Build Governance

Status: permanent repository rule
Owner: Limni/Poseidon maintainers
Canonical build: `automation/mt5/tools/Compile-Sync-LimniPortfolioEA-Canonical.ps1`

## Rule

Every Limni EA source under `automation/mt5/Experts/**/*.mq5` has exactly one
visible `#property version` value. The active build target is
`Limni\LimniPortfolioEA.ex5`; its runtime version is defined once in
`Include/Core/BuildInfo.mqh` as `LP_EA_VERSION` and must equal the EA
`#property version`.

Any change to the active EA's canonical source/include closure is a compiled
logic change for governance purposes and must increment `LP_EA_VERSION` before
the canonical build can pass. Documentation-only changes outside that closure
do not require a version increment. The last successful version and source
bundle are persisted in the tracked
`automation/mt5/tools/canonical-compile-state.json` file.

Archived EAs are not active build targets, but they remain in the version
inventory. Reactivating one requires an explicit terminal-manifest entry and
the same source-bundle, version, compile, and EX5-parity contract before it is
compiled or installed.

## Build identity

The source bundle is the SHA-256 identity of the sorted canonical local include
closure computed by `Test-Gate108SourceBundle.ps1`. The full identity is stored
in `LP_EA_SOURCE_BUNDLE_ID`; the first 12 hexadecimal characters are the short
identity. The short identity is displayed in the EA description and runtime
display name.

The EA must expose its version and short source-bundle identity in all of these
surfaces:

- MT5 `#property version` and `#property description`;
- the startup Journal line and operator display name;
- `run_manifest.csv`;
- `completion.csv`.

## Canonical build gates

The canonical compile script fails closed unless all of the following pass:

1. Every EA has one valid visible version.
2. The active source bundle matches `BuildInfo.mqh`.
3. The active version is greater than the last successful version whenever the
   source bundle changed. An unchanged source bundle may keep its version.
4. MetaEditor reports exactly `0 errors, 0 warnings`.
5. The freshly compiled EX5 is copied into the repository and then copied to
   the configured active terminal.
6. Repository and active-terminal EX5 files have identical byte counts and
   identical SHA-256 hashes.
7. The successful build state and a durable compile receipt record the version,
   full/short source bundle, compiler result, and both EX5 hashes.

The local MetaEditor may return process exit code `1` for a clean compile. The
compiler log's `Result: 0 errors, 0 warnings` line is authoritative; any error
or warning result fails the build.

This workflow compiles and synchronizes code only. It does not run Strategy
Tester, optimization, benchmarks, backtests, or trading tests.

## Required workflow

Use the canonical script for every active EA build. Do not manually copy EX5
files or bypass the version/source-bundle state check. If an EA is added or
reactivated, first add its manifest entry and version, then extend the
canonical build contract before compiling it.
