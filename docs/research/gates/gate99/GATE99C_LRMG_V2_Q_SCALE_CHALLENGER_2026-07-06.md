# Gate 99C - LRMG Completed-Day Q Visual Stack

Date: 2026-07-06

## Scope

Gate 99C promotes the visually accepted LRMG completed-day q formula into the
main price-line indicator and adds the next three visual-only stack indicators.
This is still an indicator architecture gate, not an EA gate.

LRMG stands for:

`Limni Radial Movement Grid`

Freedom archived the prior original indicator externally. The active repo/source
name remains:

`automation/mt5/Indicators/LimniLRMGPriceLine.mq5`

The version remains in indicator metadata/code, not the active filename or chart
short name.

## Active Stack Files

Repo sources:

- `automation/mt5/Indicators/LimniLRMGPriceLine.mq5`
- `automation/mt5/Indicators/LimniLRMGStoch.mq5`
- `automation/mt5/Indicators/LimniLRMGMA.mq5`
- `automation/mt5/Indicators/LimniLRMGTrigger.mq5`
- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`

Active terminal copies:

- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/LimniLRMGPriceLine.mq5`
- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/LimniLRMGStoch.mq5`
- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/LimniLRMGMA.mq5`
- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/LimniLRMGTrigger.mq5`
- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/Include/LimniLRMGStackCore.mqh`

## Formula Contract

Source:

- fixed `PERIOD_M1`
- completed broker/server calendar days
- current incomplete day is not allowed to define its own q

Formula horizon:

`ScaleLookbackDays`

There is no fixed historical start date input. The indicators use terminal
available M1 history. If deeper M1 history is loaded later,
`ScaleLookbackDays=0` expands to the larger all-prior dataset.

Chart extension policy:

- finite horizons request the chart history range plus warmup before the chart
  start
- `ScaleLookbackDays=0` requests all available M1 history
- indicators do not fake values before source history exists
- all stack indicators use the same source policy through
  `LimniLRMGStackCore.mqh`

Rules:

- `1` = use prior completed day q
- `10` = median of prior 10 completed q-day values
- `20` = median of prior 20 completed q-day values
- `0` = expanding median of all prior completed q-day values

Per completed day:

`q_day = LRMG movement radius of that day's M1 close path`

For the next day:

`q_effective = median(q_day over the selected prior completed-day horizon)`

Phase policy:

- first valid q day seeds from that day's first source close until an LRMG event
  exists
- after at least one LRMG event exists, each q epoch starts from the last
  confirmed LRMG event price
- prior events are not rewritten when q updates

## Stack Grammar

`LimniLRMGPriceLine`:

- chart-window price line
- median of the last `55` closed LRMG event prices

`LimniLRMGStoch`:

- separate-window `0..100` oscillator
- position of current M1 close inside the high/low range of the last `55`
  closed LRMG event prices
- fixed visual levels at `20` and `80`

`LimniLRMGMA`:

- chart-window coloured LRMG event-price mean
- mean of the last `21` closed LRMG event prices
- green = rising, red = falling, silver = flat/unknown

`LimniLRMGTrigger`:

- chart-window arrows only
- buy arrow when LRMG Stoch re-enters above `20` and LRMG MA state is not
  falling
- sell arrow when LRMG Stoch re-enters below `80` and LRMG MA state is not
  rising

These trigger rules are visual grammar only. They are not promoted trading
logic.

## Speed Contract

The active stack was collapsed back to one version of each indicator after
Freedom flagged over-versioning and lag risk.

Current performance measures:

- `LimniLRMGStoch`, `LimniLRMGMA`, and `LimniLRMGTrigger` now use a cached
  shared LRMG stack loader.
- The stack rebuilds when symbol, `ScaleLookbackDays`, requested older history,
  point size, or latest closed M1 bar changes.
- The stack does not rebuild the full M1 event series on every indicator tick.
- Median/MA/range event metrics are recomputed only when a new LRMG event closes,
  not once per source bar.

## Visual Test Instructions

1. Refresh MT5 Navigator or restart MT5 if the new indicators do not appear.
2. Add `LimniLRMGPriceLine`.
3. Add `LimniLRMGStoch`.
4. Add `LimniLRMGMA`.
5. Add `LimniLRMGTrigger`.
6. Use the same `ScaleLookbackDays` value on all four indicators. Start with
   `20`; compare `1`, `10`, or `0` only if the visual grammar needs it.

No EA, backtest, PnL, or promotion conclusion should be inferred from this
visual stack.

## Compile Receipts

Compile artifact folder:

`docs/research/gates/gate99/artifacts/lrmg-stack-single-speed-2026-07-06/`

All repo and active-terminal compile logs report:

`Result: 0 errors, 0 warnings`

Source hash parity between repo and active terminal:

- `LimniLRMGPriceLine.mq5`:
  `C9427B0DFAFAF4FFC5956E9FE786C325AA5B84206E76B1DD88DF8925B061A709`
- `LimniLRMGStoch.mq5`:
  `0092B3C566077566B81178562874F09B594298A25F41C55B22587361D6E7CA2A`
- `LimniLRMGMA.mq5`:
  `D5CAD632EA630874F24C1E3B1EF936D0CA399245C1A27865A6969A8B833C3B56`
- `LimniLRMGTrigger.mq5`:
  `6598330E589580E50E53D25847A2BDD3255BD9C68B59E98BC8FC8F9CE67053EB`
- `LimniLRMGStackCore.mqh`:
  `5B29120238CE59056A485CCA282CE8759A58C8929814E7F010BEA80FFF06BF9C`

## Stop Lines

- No `LimniKataraktiEA.mq5` mutation.
- No `LimniHedge_V1.mq5` mutation.
- No `LimniTrendFollow.mq5` mutation.
- No live/app integration.
- No EA execution logic from this visual grammar.
- No PnL or promotion claim from this visual stack.
