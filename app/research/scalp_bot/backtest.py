from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Iterable

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - runtime dependency
    pd = None

from .config import BacktestConfig, DataConfig
from .data_sources import BiasStore, load_ohlcv, localize_df
from .execution import TradeResult, simulate_trade
from .signals import detect_sweep_signal, detect_adr_pullback_signal, detect_bollinger_signal
from .utils import SessionRef, pip_size, session_bounds


@dataclass
class BacktestResult:
    trades: list[TradeResult]
    pair_days: int = 0
    missing_cot_days: int = 0
    missing_sentiment_days: int = 0


def _sentiment_allows(direction: str, long_pct: float, short_pct: float, cfg) -> bool:
    if cfg.mode == "contrarian":
        if direction == "short":
            return long_pct >= cfg.threshold_long_pct
        return short_pct >= cfg.threshold_short_pct
    if direction == "short":
        return short_pct >= cfg.threshold_short_pct
    return long_pct >= cfg.threshold_long_pct


def _choose_direction(cot_direction: str | None) -> str | None:
    if cot_direction == "LONG":
        return "long"
    if cot_direction == "SHORT":
        return "short"
    return None


def _iter_days(start: date, end: date) -> Iterable[date]:
    current = start
    while current <= end:
        yield current
        current = current + timedelta(days=1)


def _session_window(cfg: BacktestConfig, session_name: str, day: date) -> tuple[datetime, datetime]:
    session = getattr(cfg.sessions, session_name)
    return session_bounds(session.start, session.end, day, cfg.sessions.timezone)


def _time_stop(cfg: BacktestConfig, day: date) -> datetime | None:
    if cfg.risk.time_stop_session == "none":
        return None
    session_end = _session_window(cfg, cfg.risk.time_stop_session, day)[1]
    return session_end


def run_backtest(
    pairs: Iterable[str],
    bias_store: BiasStore,
    data_cfg: DataConfig,
    cfg: BacktestConfig,
    start: date,
    end: date,
) -> BacktestResult:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    trades: list[TradeResult] = []
    pair_days = 0
    missing_cot_days = 0
    missing_sentiment_days = 0

    for pair in pairs:
        try:
            df = load_ohlcv(pair, cfg.timeframe, data_cfg.ohlc_root, data_cfg.data_root)
        except (FileNotFoundError, ValueError):
            continue
        df = localize_df(df, cfg.sessions.timezone)
        if df.empty:
            continue

        df = df[(df["time"].dt.date >= start) & (df["time"].dt.date <= end)].reset_index(drop=True)
        if df.empty:
            continue

        day_stats = None
        day_df = df.copy()
        day_df["day"] = day_df["time"].dt.date
        daily = (
            day_df.groupby("day")
            .agg(open=("open", "first"), high=("high", "max"), low=("low", "min"))
            .reset_index()
        )
        if not daily.empty:
            if cfg.entry.model == "adr_pullback":
                daily["range"] = daily["high"] - daily["low"]
                daily["adr"] = daily["range"].rolling(cfg.entry.adr_lookback_days).mean().shift(1)
            else:
                daily["adr"] = None
            day_stats = {
                row["day"]: {
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "adr": float(row["adr"]) if pd.notna(row["adr"]) else None,
                }
                for _, row in daily.iterrows()
            }

        if cfg.entry.model == "bollinger":
            close = df["close"].astype(float)
            ma = close.rolling(cfg.entry.bb_length).mean()
            std = close.rolling(cfg.entry.bb_length).std(ddof=0)
            df["bb_upper"] = ma + cfg.entry.bb_std * std
            df["bb_lower"] = ma - cfg.entry.bb_std * std
        times_utc = (
            df["time"]
            .dt.tz_convert("UTC")
            .dt.tz_localize(None)
            .astype("datetime64[ns]")
            .astype("int64")
            .to_numpy()
        )

        pip = pip_size(pair)
        spread_pips = cfg.spread.per_pair_pips.get(pair, cfg.spread.default_spread_pips)

        for day in _iter_days(start, end):
            pair_days += 1
            if day.weekday() > cfg.entry.max_trade_weekday:
                continue
            cot_dir = bias_store.cot_direction_on(pair, day)
            trade_dir = _choose_direction(cot_dir)
            if trade_dir is None:
                missing_cot_days += 1
                continue

            entry_window_start, entry_window_end = _session_window(cfg, cfg.session, day)
            if cfg.entry.model == "sweep":
                # Build Asia reference using indexed slices
                offset_days = 2 if cfg.use_prior_day_ref else 1
                asia_date = day - timedelta(days=offset_days)
                asia_start, asia_end = session_bounds(cfg.sessions.asia.start, cfg.sessions.asia.end, asia_date, cfg.sessions.timezone)
                asia_start_ns = pd.Timestamp(asia_start).tz_convert("UTC").value
                asia_end_ns = pd.Timestamp(asia_end).tz_convert("UTC").value
                asia_start_idx = times_utc.searchsorted(asia_start_ns)
                asia_end_idx = times_utc.searchsorted(asia_end_ns, side="right")
                asia_window = df.iloc[asia_start_idx:asia_end_idx]
                if asia_window.empty:
                    continue
                session_ref = SessionRef(
                    ref_high=float(asia_window["high"].max()),
                    ref_low=float(asia_window["low"].min()),
                    start=asia_start,
                    end=asia_end,
                )
            else:
                if not day_stats or day not in day_stats:
                    continue
                day_open = day_stats[day]["open"]
                adr_value = day_stats[day].get("adr")
                if cfg.entry.model == "adr_pullback" and adr_value is None:
                    continue
                session_ref = SessionRef(
                    ref_high=day_open,
                    ref_low=day_open,
                    start=entry_window_start,
                    end=entry_window_end,
                )

            sentiment = bias_store.sentiment_at(pair, entry_window_start)
            if sentiment is None:
                missing_sentiment_days += 1
                if cfg.sentiment.missing_policy == "require":
                    continue
            if sentiment is not None:
                if not _sentiment_allows(trade_dir, sentiment.long_pct or 0, sentiment.short_pct or 0, cfg.sentiment):
                    continue

            entry_start_ns = pd.Timestamp(entry_window_start).tz_convert("UTC").value
            entry_end_ns = pd.Timestamp(entry_window_end).tz_convert("UTC").value
            entry_start_idx = times_utc.searchsorted(entry_start_ns)
            entry_end_idx = times_utc.searchsorted(entry_end_ns, side="right")
            entry_window = df.iloc[entry_start_idx:entry_end_idx]
            if cfg.entry.model == "sweep":
                signal = detect_sweep_signal(entry_window, entry_window_start, entry_window_end, session_ref, cfg.entry, pip, trade_dir, prefiltered=True)
            else:
                if cfg.entry.model == "adr_pullback":
                    day_start = datetime.combine(day, time(0, 0), tzinfo=entry_window_start.tzinfo)
                    day_start_ns = pd.Timestamp(day_start).tz_convert("UTC").value
                    day_start_idx = times_utc.searchsorted(day_start_ns)
                    adr_window = df.iloc[day_start_idx:entry_end_idx]
                    signal = detect_adr_pullback_signal(
                        adr_window,
                        entry_window_start,
                        entry_window_end,
                        day_stats[day]["open"],
                        day_stats[day]["adr"],
                        cfg.entry.adr_pullback_pct,
                        cfg.entry.adr_reclaim_pct,
                        trade_dir,
                        prefiltered=True,
                    )
                else:
                    signal = detect_bollinger_signal(entry_window, entry_window_start, entry_window_end, trade_dir, prefiltered=True)
            if signal is None and cfg.allow_second_window:
                entry_window_start, entry_window_end = _session_window(cfg, "ny", day)
                entry_start_ns = pd.Timestamp(entry_window_start).tz_convert("UTC").value
                entry_end_ns = pd.Timestamp(entry_window_end).tz_convert("UTC").value
                entry_start_idx = times_utc.searchsorted(entry_start_ns)
                entry_end_idx = times_utc.searchsorted(entry_end_ns, side="right")
                entry_window = df.iloc[entry_start_idx:entry_end_idx]
                if cfg.entry.model == "sweep":
                    signal = detect_sweep_signal(entry_window, entry_window_start, entry_window_end, session_ref, cfg.entry, pip, trade_dir, prefiltered=True)
                else:
                    if cfg.entry.model == "adr_pullback":
                        signal = detect_adr_pullback_signal(
                            entry_window,
                            entry_window_start,
                            entry_window_end,
                            day_stats[day]["open"],
                            day_stats[day]["adr"],
                            cfg.entry.adr_pullback_pct,
                            cfg.entry.adr_reclaim_pct,
                            trade_dir,
                            prefiltered=True,
                        )
                    else:
                        signal = detect_bollinger_signal(entry_window, entry_window_start, entry_window_end, trade_dir, prefiltered=True)

            if signal is None:
                continue

            confirm_idx = signal.confirm_index
            entry_idx = confirm_idx + 1 if cfg.entry.entry_timing == "next_open" else confirm_idx
            if entry_idx >= len(df):
                continue
            entry_row = df.iloc[entry_idx]
            entry_price = entry_row["open"] if cfg.entry.entry_timing == "next_open" else entry_row["close"]
            entry_time = entry_row["time"].to_pydatetime()
            if not (entry_window_start <= entry_time <= entry_window_end):
                continue

            if cfg.entry.model == "bollinger":
                if trade_dir == "short":
                    tp_price = float(signal.lower)
                    stop_dist = abs(entry_price - tp_price) / 2.0
                    stop_price = entry_price + stop_dist
                else:
                    tp_price = float(signal.upper)
                    stop_dist = abs(tp_price - entry_price) / 2.0
                    stop_price = entry_price - stop_dist
            else:
                if trade_dir == "short":
                    base_stop = signal.sweep_high + cfg.risk.stop_buffer_pips * pip
                    if cfg.risk.fixed_stop_pips is not None:
                        stop_price = entry_price + cfg.risk.fixed_stop_pips * pip
                    else:
                        stop_price = base_stop
                else:
                    base_stop = signal.sweep_low - cfg.risk.stop_buffer_pips * pip
                    if cfg.risk.fixed_stop_pips is not None:
                        stop_price = entry_price - cfg.risk.fixed_stop_pips * pip
                    else:
                        stop_price = base_stop

            stop_pips = abs(entry_price - stop_price) / pip
            if cfg.entry.model != "bollinger":
                if cfg.risk.fixed_stop_pips is None and stop_pips > cfg.risk.max_stop_pips:
                    continue

            if cfg.entry.model != "bollinger":
                tp_price = entry_price + cfg.risk.tp_pips * pip * (1 if trade_dir == "long" else -1)
            time_stop = _time_stop(cfg, day)

            result = simulate_trade(
                df=df,
                entry_idx=entry_idx,
                pair=pair,
                direction=trade_dir,
                entry_price=entry_price,
                stop_price=stop_price,
                tp_price=tp_price,
                risk_cfg=cfg.risk,
                exec_cfg=cfg.execution,
                pip_size=pip,
                spread_pips=spread_pips,
                ref_high=session_ref.ref_high,
                ref_low=session_ref.ref_low,
                entry_time=entry_time,
                time_stop=time_stop,
            )
            if result:
                trades.append(result)

    return BacktestResult(
        trades=trades,
        pair_days=pair_days,
        missing_cot_days=missing_cot_days,
        missing_sentiment_days=missing_sentiment_days,
    )
