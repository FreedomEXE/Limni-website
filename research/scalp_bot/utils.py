from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def pip_size(pair: str) -> float:
    return 0.01 if "JPY" in pair else 0.0001


def _get_zone(tz: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz)
    except ZoneInfoNotFoundError as exc:
        raise ZoneInfoNotFoundError(f"Timezone data missing for {tz}. Install tzdata.") from exc


def to_zone(dt: datetime, tz: str) -> datetime:
    zone = _get_zone(tz)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(zone)


def session_bounds(session_start: time, session_end: time, session_date: date, tz: str) -> tuple[datetime, datetime]:
    zone = _get_zone(tz)
    start_dt = datetime.combine(session_date, session_start, tzinfo=zone)
    end_dt = datetime.combine(session_date, session_end, tzinfo=zone)
    if end_dt <= start_dt:
        end_dt = end_dt + timedelta(days=1)
    return start_dt, end_dt


@dataclass(frozen=True)
class SessionRange:
    start: datetime
    end: datetime


@dataclass(frozen=True)
class SessionRef:
    ref_high: float
    ref_low: float
    start: datetime
    end: datetime


@dataclass(frozen=True)
class SweepSignal:
    direction: str
    sweep_time: datetime
    sweep_high: float
    sweep_low: float
    confirm_time: datetime
    confirm_index: int


def floor_date(dt: datetime) -> date:
    return dt.date()


def clip_dt(dt: datetime, start: datetime, end: datetime) -> bool:
    return start <= dt <= end
