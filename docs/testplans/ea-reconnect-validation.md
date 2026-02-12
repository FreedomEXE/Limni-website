# EA Reconnect Validation

## Goal
Validate reconstruction behavior after MT5/EA offline periods.

## Scenarios
1. Offline 1 hour, restart.
2. Offline 1 day, restart.
3. Offline 1 week, restart.
4. Offline across week boundary (Sunday 19:00 ET anchor).

## Checks
- Push payload includes:
  - `data_source`
  - `reconstruction_status`
  - reconstruction window fields
- `max_drawdown_pct` and weekly trade stats are updated after reconnect.
- First push after reconnect is marked reconstructed, later pushes revert to realtime.

