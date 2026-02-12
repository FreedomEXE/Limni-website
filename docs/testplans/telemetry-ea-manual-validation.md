# Telemetry EA Manual Account Validation

## Goal
Validate `LimniTelemetryEA.mq5` on manual-trading accounts.

## Steps
1. Attach Telemetry EA to a manual MT5 account.
2. Open/close manual trades.
3. Verify account page updates within push interval.
4. Restart terminal after an offline gap; confirm reconstruction metadata appears.

## Pass Criteria
- No trades are placed by EA.
- Open positions, closed positions, P/L, balance/equity are pushed correctly.
- Reconnect payload marks reconstructed status when applicable.

