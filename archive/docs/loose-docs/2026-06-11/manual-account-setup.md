# Manual MT5 Account Setup (Telemetry EA)

Use `mt5/Experts/LimniTelemetryEA.mq5` for accounts you trade manually.

## Steps
1. Compile `LimniTelemetryEA.mq5` in MetaEditor.
2. Attach it to any chart on the target account.
3. Configure:
   - `PushUrl`
   - `PushToken`
   - `LicenseKey` (required for client accounts when licensing is enabled)
   - `AccountLabel`
   - `PushIntervalSeconds` (default `300`)
4. Ensure MT5 `WebRequest` allows your API domain.

## Safety
- Telemetry EA is `TELEMETRY_ONLY`.
- It does not place orders.
- It only reads account state and pushes telemetry.

## Licensing (Client Accounts Only)
- Server-side flag: `MT5_ENFORCE_CLIENT_LICENSES=true`
- Owner account bypass list: `MT5_OWNER_ACCOUNT_IDS=12345678,87654321`
- Create a license key: `POST /api/mt5/licenses` with header `x-admin-token`.
- Give each client a unique `LicenseKey`; first valid push binds it to that MT5 login/server.

## Reconnect Reconstruction
- If terminal was offline longer than `ReconstructIfOfflineMinutes`,
  EA attempts historical reconstruction and pushes `data_source=reconstructed`.
- Realtime pushes resume after the first reconstructed push.
