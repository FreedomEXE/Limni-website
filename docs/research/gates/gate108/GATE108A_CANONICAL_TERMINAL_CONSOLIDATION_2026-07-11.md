# Gate108A Canonical Terminal Consolidation — 2026-07-11

Status: implementation proof complete; stopped before runtime testing and terminal removal.

## Canonical proof surface

- Data root: `C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB`
- MQL5 root: `...\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5`
- MetaEditor: `C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5\MetaEditor64.exe`
- Terminal: `C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5\terminal64.exe`
- Manifest: `automation/mt5/terminal-roots.json` contains exactly terminal ID `94497`.

## Obsolete references and inventory

The read-only inventory found obsolete terminal data roots `14275C4F9441C73E9E6547075C33FE6C` and `67E58C3BE56BAC51882B5F36F45E170E`, plus the installation `Five Percent Online MetaTrader 5 - alt`. Historical gate artifacts retain their original identifiers and are excluded from the active static audit. Active automation and Gate108 documents contain no obsolete target after the audit pass.

The 14275 root contained 25 Limni-related Expert files, 7 indicators, 6 profiles, no Limni Files/Libraries, and 2 tester entries. The 67E58 root contained only the historical `LimniBasketHedgeEAAlphaV3` source/executable pair. The canonical root already contained the current Gate108 closure, 14 historical Limni Files artifacts, 141 Limni-related profiles, and 440 historical tester entries.

Classification: repository-controlled source and the controlled Gate108 preset are rebuildable; historical receipts/artifacts remain archive evidence; tester caches, logs, and generated tester configuration are disposable and were not copied; broker/account configuration was intentionally excluded.

## Migration

The canonical-only synchronization copied exactly the 57-file Gate108 source closure, `Profiles/Tester/LimniPortfolioEA.set` (22 bytes, SHA256 `57A2AECDE64179F4363E66EC85242A31BADC5AB9EACD7A862CB65AF53F454F1C`), and the repository EX5 to the canonical terminal. No obsolete-terminal data was copied.

## Proof

Artifact: `docs/research/gates/gate108/artifacts/gate108a-canonical-consolidation-20260711-183200/`

- Source bundle: `sha256:73b802f48ded0eee9029e91fbf6235e49a8b2129da54dd79b385ed2c6b362141`.
- Controlled profile: PASS; `CapitalBudgetFraction=0.10` remains compile/profile identity.
- Repository and canonical receipts reused from the clean `0 errors, 0 warnings` compile artifact; no compile was repeated after receipt parsing changes.
- Final synchronized repository/canonical EX5: 904680 bytes, SHA256 `D1AC7BFFD7F14C6E9490FFEA9165D7E4BBC57277E7B7DB4BBB5556E4AF58D57C`.
- Canonical static audit: PASS, `obsolete_active_reference_count=0`.
- Strategy Tester, smoke, shard, benchmark, optimization, and backtest automation: not run.

## Manual removal list (Freedom only)

After independent review of this proof, Freedom may manually remove the obsolete installation and data roots:

- `C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5 - alt`
- `C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\14275C4F9441C73E9E6547075C33FE6C`
- `C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\67E58C3BE56BAC51882B5F36F45E170E`

Nothing in this list was uninstalled or deleted by Codex.
