# Gate 99D - LRMG Visual State Grammar Freeze

Date: 2026-07-06

## Scope

Gate 99D is a visual-only LRMG indicator architecture pass.

Accepted layers remain:

- `LimniLRMGPriceLine`: unchanged source; canonical cyan LRMG reference line.
- `LimniLRMGStoch`: unchanged source; LRMG exhaustion panel.

Unresolved layers were reshaped:

- `LimniLRMGMA`: no longer a 21-event mean slope colour line. The existing
  filename now draws a separate-window `LRMG David State` ribbon.
- `LimniLRMGTrigger`: no longer Stoch re-entry plus MA-state arrows. The
  existing filename now draws `LRMG Katarakti Events` structural markers.

This gate does not add EA execution logic, backtests, PnL, promotion language,
live/app integration, or trade labels.

## Files

Changed repo sources:

- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`
- `automation/mt5/Indicators/LimniLRMGMA.mq5`
- `automation/mt5/Indicators/LimniLRMGTrigger.mq5`

Recompiled repo binaries:

- `automation/mt5/Indicators/LimniLRMGPriceLine.ex5`
- `automation/mt5/Indicators/LimniLRMGStoch.ex5`
- `automation/mt5/Indicators/LimniLRMGMA.ex5`
- `automation/mt5/Indicators/LimniLRMGTrigger.ex5`

Note: `LimniLRMGPriceLine.mq5` and `LimniLRMGStoch.mq5` sources were not
changed. Their `.ex5` binaries were refreshed only because the full visual stack
was compiled for this receipt.

Active terminal sources updated:

- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/LimniLRMGMA.mq5`
- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/LimniLRMGTrigger.mq5`
- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/Include/LimniLRMGStackCore.mqh`

## Formula Contract

Source policy remains inherited from Gate 99C:

- fixed `PERIOD_M1`
- completed broker/server calendar days
- `ScaleLookbackDays` remains the only formula-facing horizon
- no chart timeframe dependence
- no `HistoryStartDate` or `EndDate` input

## David State Layer

`LimniLRMGMA` now displays a separate-window state ribbon:

- `+1`: LRMG event stream is confirmed above the LRMG reference line.
- `-1`: LRMG event stream is confirmed below the LRMG reference line.
- `0`: undefined / no confirmed state yet.

State is computed in LRMG-native units:

```text
z = (closed_lrmg_event_price - lrmg_price_line) / q
```

The state is sticky:

- confirm up when `z >= +1`
- confirm down when `z <= -1`
- otherwise retain the previous confirmed state

This removes the prior one-event slope-colour behaviour that flipped whenever
the 21-event mean wiggled.

## Katarakti Event Markers

`LimniLRMGTrigger` now displays structural markers only:

- up marker: lower structural sweep, reclaim, then upward displacement
- down marker: upper structural sweep, reclaim, then downward displacement

The structural range is built from the last `55` closed LRMG event prices before
the current event. The marker sequence is event-based and does not use ordinary
chart timeframe logic.

Display labels intentionally avoid `buy`, `sell`, `entry`, or EA language:

- `LRMG KTR Up`
- `LRMG KTR Down`

## Compile Proof

Artifact folder:

`docs/research/gates/gate99/artifacts/gate99d-lrmg-visual-state-grammar-2026-07-06/`

Repo compile logs:

- `LimniLRMGPriceLine-repo-compile-log.txt`
- `LimniLRMGStoch-repo-compile-log.txt`
- `LimniLRMGMA-repo-compile-log.txt`
- `LimniLRMGTrigger-repo-compile-log.txt`

Active-terminal compile logs:

- `LimniLRMGPriceLine-active-terminal-compile-log.txt`
- `LimniLRMGStoch-active-terminal-compile-log.txt`
- `LimniLRMGMA-active-terminal-compile-log.txt`
- `LimniLRMGTrigger-active-terminal-compile-log.txt`

All eight logs report:

`Result: 0 errors, 0 warnings`

MetaEditor returned exit code `1` for active-terminal compiles, but the logs
reported clean compilation. This matches the known MT5 behavior for this lane.

## Source Hash Parity

Repo and active-terminal source hashes matched after install:

- `LimniLRMGPriceLine.mq5`:
  `C9427B0DFAFAF4FFC5956E9FE786C325AA5B84206E76B1DD88DF8925B061A709`
- `LimniLRMGStoch.mq5`:
  `0092B3C566077566B81178562874F09B594298A25F41C55B22587361D6E7CA2A`
- `LimniLRMGMA.mq5`:
  `731186BA77335C4BA6536470DC2E3014C8AA74BD0AD526C4BC502E166D9CB59E`
- `LimniLRMGTrigger.mq5`:
  `2E9B2F3089634FC8EA238B010A154DFD7797E146D0D14BD79D072D993BB8F2FD`
- `LimniLRMGStackCore.mqh`:
  `B1448F8FF8AEB7C4ECB1CCC0CE96C7BED36B2EABFB7F478DDB79026D5011C919`

## Visual Test Instructions

Refresh MT5 Navigator or restart MT5 if needed, then attach:

1. `LimniLRMGPriceLine`
2. `LimniLRMGStoch`
3. `LimniLRMGMA`
4. `LimniLRMGTrigger`

Use the same `ScaleLookbackDays` on all four indicators. Start with `20`.

Expected read:

- Price line stays the clean visual reference.
- Stoch remains exhaustion context.
- MA pane now shows state, not a price-line MA.
- Trigger markers now represent Katarakti-style event structure, not Stoch
  re-entry.

## Stop Lines

- No `LimniTrendFollow.mq5` changes.
- No `LimniHedge_V1.mq5` changes.
- No `LimniKataraktiEA.mq5` mutation.
- No live/app integration.
- No EA execution logic.
- No backtest, PnL, or promotion claim.
