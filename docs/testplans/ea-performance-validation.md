# EA Reconstruction Performance Validation

## Target
- Reconstruction completes in `< 30s` for up to 14-day offline window.
- No terminal freeze/crash.

## Stress Matrix
1. 14-day offline, 10 open positions.
2. Multi-symbol portfolio with uneven candle availability.
3. Weekend + holiday gaps.
4. DST transition week.

## Validate
- `reconstruction_status` becomes `partial` when timeout/limits hit.
- Market-closed gaps do not create synthetic drawdown spikes.
- Subsequent realtime pushes continue normally.

