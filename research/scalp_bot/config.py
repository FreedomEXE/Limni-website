from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time
from typing import Iterable, Literal


@dataclass(frozen=True)
class SessionWindow:
    name: str
    start: time
    end: time


@dataclass(frozen=True)
class SessionsConfig:
    timezone: str = "America/Toronto"
    asia: SessionWindow = SessionWindow("asia", time(19, 0), time(0, 0))
    london: SessionWindow = SessionWindow("london", time(3, 0), time(6, 0))
    ny: SessionWindow = SessionWindow("ny", time(8, 0), time(11, 0))


@dataclass(frozen=True)
class SentimentConfig:
    mode: Literal["contrarian", "trend"] = "contrarian"
    threshold_long_pct: float = 55.0
    threshold_short_pct: float = 55.0
    missing_policy: Literal["require", "allow"] = "allow"


@dataclass(frozen=True)
class EntryConfig:
    model: Literal["sweep", "adr_pullback", "bollinger"] = "sweep"
    sweep_buffer_pips: float = 1.0
    displacement_min_body_pips: float = 3.0
    displacement_close_pct: float = 0.30
    swing_lookback_bars: int = 20
    confirmation: Literal["displacement", "structure"] = "displacement"
    entry_timing: Literal["next_open", "confirm_close"] = "next_open"
    adr_lookback_days: int = 20
    adr_pullback_pct: float = 0.35
    adr_reclaim_pct: float = 0.10
    max_trade_weekday: int = 4
    bb_length: int = 20
    bb_std: float = 2.0


@dataclass(frozen=True)
class RiskConfig:
    stop_buffer_pips: float = 1.0
    max_stop_pips: float = 12.0
    fixed_stop_pips: float | None = None
    tp_pips: float = 40.0
    use_multi_target: bool = False
    tp1_r_multiple: float = 1.0
    tp1_pct: float = 0.5
    be_trigger_pips: float | None = 12.0
    time_stop_session: Literal["london", "ny", "none"] = "london"
    time_stop_hour: int = 12


@dataclass(frozen=True)
class ExecutionConfig:
    slippage_pips: float = 0.2
    conservative_sl_tp: bool = True


@dataclass(frozen=True)
class SpreadConfig:
    default_spread_pips: float = 1.5
    per_pair_pips: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class AccountConfig:
    starting_equity: float = 100000.0
    risk_per_trade_pct: float = 0.5
    fixed_lot: float = 1.0
    account_currency: str = "USD"


@dataclass(frozen=True)
class BacktestConfig:
    timeframe: str = "M5"
    session: Literal["london", "ny"] = "london"
    allow_second_window: bool = False
    use_prior_day_ref: bool = False
    sessions: SessionsConfig = SessionsConfig()
    sentiment: SentimentConfig = SentimentConfig()
    entry: EntryConfig = EntryConfig()
    risk: RiskConfig = RiskConfig()
    execution: ExecutionConfig = ExecutionConfig()
    spread: SpreadConfig = SpreadConfig()
    account: AccountConfig = AccountConfig()


@dataclass(frozen=True)
class GridConfig:
    sweep_buffer_pips: Iterable[float] = (0.5, 1.0, 2.0)
    displacement_min_body_pips: Iterable[float] = (2.0, 3.0, 4.0)
    max_stop_pips: Iterable[float] = (10.0, 12.0, 15.0)
    tp_pips: Iterable[float] = (30.0, 40.0, 50.0)
    sentiment_threshold: Iterable[float] = (55.0, 60.0, 65.0)
    be_trigger_pips: Iterable[float] = (10.0, 12.0, 15.0)


@dataclass(frozen=True)
class DataConfig:
    data_root: str = "data"
    ohlc_root: str = "data/ohlc"
    cot_path: str = "data/cot_snapshot.json"
    cot_dir: str = "data/cot_snapshots"
    sentiment_aggregates_path: str = "data/sentiment_aggregates.json"
    sentiment_snapshots_path: str = "data/sentiment_snapshots.json"
    pairs_source: str = "src/lib/cotPairs.ts"
    spread_path: str = "data/spread_config.json"
