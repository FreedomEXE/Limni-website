from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - runtime dependency
    pd = None

from .config import EntryConfig, SessionsConfig
from .utils import SessionRef, SweepSignal, clip_dt, session_bounds


@dataclass(frozen=True)
class DaySignal:
    signal: SweepSignal | None
    session_ref: SessionRef | None


def build_session_reference(
    df: pd.DataFrame,
    sessions: SessionsConfig,
    entry_date: date,
    use_prior_day_ref: bool,
) -> SessionRef | None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if df.empty:
        return None

    offset_days = 2 if use_prior_day_ref else 1
    asia_date = entry_date - timedelta(days=offset_days)
    asia_start, asia_end = session_bounds(sessions.asia.start, sessions.asia.end, asia_date, sessions.timezone)
    mask = (df["time"] >= asia_start) & (df["time"] <= asia_end)
    window = df.loc[mask]
    if window.empty:
        return None

    ref_high = float(window["high"].max())
    ref_low = float(window["low"].min())
    return SessionRef(ref_high=ref_high, ref_low=ref_low, start=asia_start, end=asia_end)


def _is_bearish_displacement(row: pd.Series, min_body: float, close_pct: float) -> bool:
    body = row["open"] - row["close"]
    if body <= 0:
        return False
    if body < min_body:
        return False
    rng = row["high"] - row["low"]
    if rng <= 0:
        return False
    return row["close"] <= row["low"] + rng * close_pct


def _is_bullish_displacement(row: pd.Series, min_body: float, close_pct: float) -> bool:
    body = row["close"] - row["open"]
    if body <= 0:
        return False
    if body < min_body:
        return False
    rng = row["high"] - row["low"]
    if rng <= 0:
        return False
    return row["close"] >= row["high"] - rng * close_pct


def _structure_break(window: pd.DataFrame, direction: str, lookback: int) -> bool:
    if len(window) < 2:
        return False
    recent = window.iloc[-lookback:]
    if direction == "short":
        swing_low = recent["low"].min()
        return window.iloc[-1]["close"] < swing_low
    swing_high = recent["high"].max()
    return window.iloc[-1]["close"] > swing_high


def detect_sweep_signal(
    df: pd.DataFrame,
    entry_start: datetime,
    entry_end: datetime,
    session_ref: SessionRef,
    entry_cfg: EntryConfig,
    pip_size: float,
    direction: str,
    prefiltered: bool = False,
) -> SweepSignal | None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    window = df if prefiltered else df[(df["time"] >= entry_start) & (df["time"] <= entry_end)].copy()
    if window.empty:
        return None

    buffer_price = entry_cfg.sweep_buffer_pips * pip_size
    min_body = entry_cfg.displacement_min_body_pips * pip_size
    close_pct = entry_cfg.displacement_close_pct

    sweep_index = None
    for idx, row in window.iterrows():
        if direction == "short":
            if row["high"] >= session_ref.ref_high + buffer_price:
                sweep_index = idx
                break
        else:
            if row["low"] <= session_ref.ref_low - buffer_price:
                sweep_index = idx
                break

    if sweep_index is None:
        return None

    sweep_row = window.loc[sweep_index]
    post = window.loc[window.index > sweep_index]
    if post.empty:
        return None

    # Require a return close back through the reference level after the sweep
    retest_index = None
    for idx, row in post.iterrows():
        if direction == "short":
            if row["close"] < session_ref.ref_high:
                retest_index = idx
                break
        else:
            if row["close"] > session_ref.ref_low:
                retest_index = idx
                break

    if retest_index is None:
        return None

    post = window.loc[window.index > retest_index]
    if post.empty:
        return None

    for idx, row in post.iterrows():
        if entry_cfg.confirmation == "displacement":
            if direction == "short":
                if not _is_bearish_displacement(row, min_body, close_pct):
                    continue
            else:
                if not _is_bullish_displacement(row, min_body, close_pct):
                    continue
        else:
            if not _structure_break(window.loc[:idx], direction, entry_cfg.swing_lookback_bars):
                continue

        return SweepSignal(
            direction=direction,
            sweep_time=sweep_row["time"].to_pydatetime(),
            sweep_high=float(window.loc[sweep_index:idx]["high"].max()),
            sweep_low=float(window.loc[sweep_index:idx]["low"].min()),
            confirm_time=row["time"].to_pydatetime(),
            confirm_index=int(idx),
        )

    return None


def detect_adr_pullback_signal(
    df: pd.DataFrame,
    entry_start: datetime,
    entry_end: datetime,
    day_open: float,
    adr_value: float,
    pullback_pct: float,
    direction: str,
    prefiltered: bool = False,
) -> SweepSignal | None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    window = df if prefiltered else df[(df["time"] >= entry_start) & (df["time"] <= entry_end)].copy()
    if window.empty:
        return None
    if adr_value <= 0:
        return None

    pullback_level = (
        day_open - adr_value * pullback_pct
        if direction == "long"
        else day_open + adr_value * pullback_pct
    )

    pullback_index = None
    for idx, row in window.iterrows():
        if direction == "long":
            if row["low"] <= pullback_level:
                pullback_index = idx
                break
        else:
            if row["high"] >= pullback_level:
                pullback_index = idx
                break

    if pullback_index is None:
        return None

    post = window.loc[window.index > pullback_index]
    if post.empty:
        return None

    confirm_index = None
    for idx, row in post.iterrows():
        if row["time"] < entry_start:
            continue
        if direction == "long":
            if row["close"] >= day_open:
                confirm_index = idx
                break
        else:
            if row["close"] <= day_open:
                confirm_index = idx
                break

    if confirm_index is None:
        return None

    window_slice = window.loc[pullback_index:confirm_index]
    return SweepSignal(
        direction=direction,
        sweep_time=window.loc[pullback_index, "time"].to_pydatetime(),
        sweep_high=float(window_slice["high"].max()),
        sweep_low=float(window_slice["low"].min()),
        confirm_time=window.loc[confirm_index, "time"].to_pydatetime(),
        confirm_index=int(confirm_index),
    )
