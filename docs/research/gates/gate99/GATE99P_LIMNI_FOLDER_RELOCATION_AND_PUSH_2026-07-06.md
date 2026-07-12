# Gate 99P - Limni Folder Relocation And Review Push

Date: 2026-07-06

## Scope

Freedom requested the active portfolio EA live under the custom Limni EA folder,
matching the custom indicator layout:

- Indicators: `automation/mt5/Indicators/Limni/`
- EA: `automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`

No strategy logic was added.

## Source Layout

`automation/mt5/Experts/` root now keeps:

- `Archived/`
- `Include/`
- `Limni/`

`automation/mt5/Experts/Limni/` keeps:

- `LimniPortfolioEA.mq5`
- `LimniPortfolioEA.ex5`

The EA include path was adjusted from root-relative `Include/Core/Engine.mqh`
to `../Include/Core/Engine.mqh`.

## Active Terminal Layout

Active terminal:

`C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Experts/`

now keeps the active EA under:

`MQL5/Experts/Limni/LimniPortfolioEA.mq5`

The terminal root no longer keeps root-level `LimniPortfolioEA.mq5` or
`LimniPortfolioEA.ex5`.

## Verification

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99p-limni-folder-relocation-push-2026-07-06/`

Compile logs:

- `repo-LimniPortfolioEA-limni-folder-compile-log.txt`
- `active-LimniPortfolioEA-limni-folder-compile-log.txt`

Both logs report:

```text
Result: 0 errors, 0 warnings
```

MetaEditor returned process exit code `1` while writing clean logs, matching the
known local MT5 compile pattern in this repo.

Repo and active-terminal source hash:

```text
2B91A8ADB3194FF2033EF2770A95F6A5D1B71B08B9D3959F5A7FE0DD89F5252C
```

## Review Status

This gate is the pushed review surface for ChatGPT/CodexPro architecture review.
The product EA remains a zero-trading institutional skeleton until strategy
contracts are approved.
