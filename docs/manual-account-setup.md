# Manual MT5 Account Setup (Telemetry EA)

Use `mt5/Experts/LimniTelemetryEA.mq5` for accounts you trade manually.

## Steps
1. Compile `LimniTelemetryEA.mq5` in MetaEditor.
2. Attach it to any chart on the target account.
3. Configure:
   - `PushUrl`
   - `PushToken`
   - `AccountLabel`
   - `PushIntervalSeconds` (default `300`)
4. Ensure MT5 `WebRequest` allows your API domain.

## Safety
- Telemetry EA is `TELEMETRY_ONLY`.
- It does not place orders.
- It only reads account state and pushes telemetry.

## Reconnect Reconstruction
- If terminal was offline longer than `ReconstructIfOfflineMinutes`,
  EA attempts historical reconstruction and pushes `data_source=reconstructed`.
- Realtime pushes resume after the first reconstructed push.

