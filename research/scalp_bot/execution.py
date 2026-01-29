from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - runtime dependency
    pd = None

from .config import EntryConfig, ExecutionConfig, RiskConfig


@dataclass
class TradeResult:
    pair: str
    direction: str
    entry_time: datetime
    entry_price_raw: float
    entry_price: float
    stop_price: float
    tp_price: float
    exit_time: datetime
    exit_price_raw: float
    exit_price: float
    pnl_pips: float
    pnl_r: float
    reason: str
    spread_pips: float
    slippage_pips: float
    ref_high: float
    ref_low: float


@dataclass
class PositionState:
    size: float
    stop_price: float
    tp_price: float
    be_moved: bool


def apply_spread_slippage(price: float, direction: str, spread_pips: float, pip_size: float, slippage_pips: float, side: str) -> float:
    half = (spread_pips * pip_size) / 2.0
    slip = slippage_pips * pip_size
    if direction == "long":
        if side == "entry":
            return price + half + slip
        return price - half - slip
    if side == "entry":
        return price - half - slip
    return price + half + slip


def _hit_tp_sl(
    row: pd.Series,
    direction: str,
    stop_price: float,
    tp_price: float,
    spread_pips: float,
    pip_size: float,
) -> tuple[bool, bool]:
    half = (spread_pips * pip_size) / 2.0
    high = row["high"]
    low = row["low"]
    if direction == "long":
        sl_hit = low <= stop_price + half
        tp_hit = high >= tp_price + half
        return tp_hit, sl_hit
    sl_hit = high >= stop_price - half
    tp_hit = low <= tp_price - half
    return tp_hit, sl_hit


def simulate_trade(
    df: pd.DataFrame,
    entry_idx: int,
    pair: str,
    direction: str,
    entry_price: float,
    stop_price: float,
    tp_price: float,
    risk_cfg: RiskConfig,
    exec_cfg: ExecutionConfig,
    pip_size: float,
    spread_pips: float,
    ref_high: float,
    ref_low: float,
    entry_time: datetime,
    time_stop: datetime | None,
) -> TradeResult | None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if entry_idx >= len(df) - 1:
        return None

    entry_price_exec = apply_spread_slippage(entry_price, direction, spread_pips, pip_size, exec_cfg.slippage_pips, "entry")
    stop_price_exec = stop_price
    tp_price_exec = tp_price

    risk_pips = abs(entry_price_exec - stop_price_exec) / pip_size
    if risk_pips <= 0:
        return None

    state = PositionState(size=1.0, stop_price=stop_price_exec, tp_price=tp_price_exec, be_moved=False)
    remaining = state.size
    realized_pips = 0.0
    realized_r = 0.0
    tp1_price = None
    if risk_cfg.use_multi_target:
        tp1_price = entry_price_exec + (risk_cfg.tp1_r_multiple * risk_pips * pip_size) * (1 if direction == "long" else -1)

    for idx in range(entry_idx + 1, len(df)):
        row = df.iloc[idx]
        if time_stop is not None and row["time"].to_pydatetime() >= time_stop:
            exit_price = apply_spread_slippage(row["close"], direction, spread_pips, pip_size, exec_cfg.slippage_pips, "exit")
            pnl_pips = (exit_price - entry_price_exec) / pip_size
            pnl_r = pnl_pips / risk_pips
            realized_pips += pnl_pips * remaining
            realized_r += pnl_r * remaining
            return TradeResult(
                pair=pair,
                direction=direction,
                entry_time=entry_time,
                entry_price_raw=entry_price,
                entry_price=entry_price_exec,
                stop_price=stop_price_exec,
                tp_price=tp_price_exec,
                exit_time=row["time"].to_pydatetime(),
                exit_price_raw=row["close"],
                exit_price=exit_price,
                pnl_pips=realized_pips,
                pnl_r=realized_r,
                reason="time_stop",
                spread_pips=spread_pips,
                slippage_pips=exec_cfg.slippage_pips,
                ref_high=ref_high,
                ref_low=ref_low,
            )

        tp_hit, sl_hit = _hit_tp_sl(row, direction, state.stop_price, state.tp_price, spread_pips, pip_size)

        if tp_hit and sl_hit and exec_cfg.conservative_sl_tp:
            sl_hit = True
            tp_hit = False

        if tp1_price is not None:
            tp1_hit, _ = _hit_tp_sl(row, direction, state.stop_price, tp1_price, spread_pips, pip_size)
            if tp1_hit and remaining > 0 and remaining > (1 - risk_cfg.tp1_pct):
                exit_price = apply_spread_slippage(tp1_price, direction, spread_pips, pip_size, exec_cfg.slippage_pips, "exit")
                pnl_pips = (exit_price - entry_price_exec) / pip_size
                pnl_r = pnl_pips / risk_pips
                partial = risk_cfg.tp1_pct
                realized_pips += pnl_pips * partial
                realized_r += pnl_r * partial
                remaining -= partial
                state.stop_price = entry_price_exec
                state.be_moved = True

        if tp_hit and remaining > 0:
            exit_price = apply_spread_slippage(state.tp_price, direction, spread_pips, pip_size, exec_cfg.slippage_pips, "exit")
            pnl_pips = (exit_price - entry_price_exec) / pip_size
            pnl_r = pnl_pips / risk_pips
            realized_pips += pnl_pips * remaining
            realized_r += pnl_r * remaining
            return TradeResult(
                pair=pair,
                direction=direction,
                entry_time=entry_time,
                entry_price_raw=entry_price,
                entry_price=entry_price_exec,
                stop_price=stop_price_exec,
                tp_price=tp_price_exec,
                exit_time=row["time"].to_pydatetime(),
                exit_price_raw=state.tp_price,
                exit_price=exit_price,
                pnl_pips=realized_pips,
                pnl_r=realized_r,
                reason="tp",
                spread_pips=spread_pips,
                slippage_pips=exec_cfg.slippage_pips,
                ref_high=ref_high,
                ref_low=ref_low,
            )

        if sl_hit and remaining > 0:
            exit_price = apply_spread_slippage(state.stop_price, direction, spread_pips, pip_size, exec_cfg.slippage_pips, "exit")
            pnl_pips = (exit_price - entry_price_exec) / pip_size
            pnl_r = pnl_pips / risk_pips
            realized_pips += pnl_pips * remaining
            realized_r += pnl_r * remaining
            return TradeResult(
                pair=pair,
                direction=direction,
                entry_time=entry_time,
                entry_price_raw=entry_price,
                entry_price=entry_price_exec,
                stop_price=stop_price_exec,
                tp_price=tp_price_exec,
                exit_time=row["time"].to_pydatetime(),
                exit_price_raw=state.stop_price,
                exit_price=exit_price,
                pnl_pips=realized_pips,
                pnl_r=realized_r,
                reason="sl",
                spread_pips=spread_pips,
                slippage_pips=exec_cfg.slippage_pips,
                ref_high=ref_high,
                ref_low=ref_low,
            )

        if risk_cfg.be_trigger_pips is not None and not state.be_moved:
            if direction == "long":
                move = (row["high"] - entry_price_exec) / pip_size
            else:
                move = (entry_price_exec - row["low"]) / pip_size
            if move >= risk_cfg.be_trigger_pips:
                state.stop_price = entry_price_exec
                state.be_moved = True

    return None
