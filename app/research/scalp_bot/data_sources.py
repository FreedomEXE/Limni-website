from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - runtime dependency
    pd = None

from .utils import to_zone


@dataclass(frozen=True)
class CotPairBias:
    direction: str
    report_date: date


@dataclass(frozen=True)
class SentimentPoint:
    symbol: str
    timestamp: datetime
    long_pct: float | None
    short_pct: float | None


class BiasStore:
    def __init__(self, cot_map: dict[str, list[CotPairBias]], sentiment_map: dict[str, list[SentimentPoint]]):
        self.cot_map = cot_map
        self.sentiment_map = sentiment_map

    def cot_direction_on(self, pair: str, on_date: date) -> str | None:
        entries = self.cot_map.get(pair, [])
        if not entries:
            return None
        best = None
        for entry in entries:
            if entry.report_date <= on_date:
                if best is None or entry.report_date > best.report_date:
                    best = entry
        return best.direction if best else None

    def sentiment_at(self, pair: str, ts: datetime) -> SentimentPoint | None:
        entries = self.sentiment_map.get(pair, [])
        if not entries:
            return None
        best = None
        for entry in entries:
            if entry.timestamp <= ts:
                if best is None or entry.timestamp > best.timestamp:
                    best = entry
        return best


def _parse_timestamp(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        if pd is None:
            raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
        return pd.to_datetime(value, utc=True).to_pydatetime()


def load_ohlcv(pair: str, timeframe: str, ohlc_root: str, data_root: str) -> pd.DataFrame:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    candidates = [
        Path(ohlc_root) / timeframe / f"{pair}.csv",
        Path(ohlc_root) / timeframe / f"{pair}.parquet",
        Path(ohlc_root) / pair / f"{timeframe}.csv",
        Path(ohlc_root) / f"{pair}_{timeframe}.csv",
        Path(ohlc_root) / pair / f"{timeframe}.parquet",
        Path(ohlc_root) / f"{pair}_{timeframe}.parquet",
        Path(data_root) / f"{pair}_{timeframe}.csv",
        Path(data_root) / f"{pair}_{timeframe}.parquet",
    ]
    path = next((c for c in candidates if c.exists()), None)
    if path is None:
        raise FileNotFoundError(f"No OHLC file found for {pair} {timeframe}. Searched: {', '.join(str(c) for c in candidates)}")

    if path.suffix == ".parquet":
        df = pd.read_parquet(path)
    else:
        df = pd.read_csv(path)

    df = _normalize_ohlcv(df)
    return df


def _normalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    columns = {c.lower(): c for c in df.columns}
    time_col = None
    for candidate in ("time", "timestamp", "date", "datetime"):
        if candidate in columns:
            time_col = columns[candidate]
            break
    if time_col is None:
        raise ValueError("OHLC data missing time column (time/timestamp/date/datetime)")

    df = df.copy()
    series = df[time_col]
    if pd.api.types.is_numeric_dtype(series):
        values = series.astype("int64")
        max_val = values.max()
        if max_val > 10**17:
            df["time"] = pd.to_datetime(values, utc=True, unit="ns", errors="coerce")
        elif max_val > 10**14:
            df["time"] = pd.to_datetime(values, utc=True, unit="us", errors="coerce")
        elif max_val > 10**11:
            df["time"] = pd.to_datetime(values, utc=True, unit="ms", errors="coerce")
        else:
            df["time"] = pd.to_datetime(values, utc=True, unit="s", errors="coerce")
    else:
        df["time"] = pd.to_datetime(series, utc=True, errors="coerce")
    if df["time"].isna().any():
        raise ValueError("Failed to parse one or more timestamps in OHLC data")

    rename = {}
    for col in ("open", "high", "low", "close", "volume"):
        if col in columns:
            rename[columns[col]] = col
    df = df.rename(columns=rename)

    for col in ("open", "high", "low", "close"):
        if col not in df.columns:
            raise ValueError(f"OHLC data missing {col} column")

    df = df.sort_values("time").reset_index(drop=True)
    return df


def load_cot_bias(cot_path: str, cot_dir: str) -> dict[str, list[CotPairBias]]:
    snapshots: list[dict] = []
    dir_path = Path(cot_dir)
    if dir_path.exists():
        for file in sorted(dir_path.glob("*.json")):
            snapshots.append(json.loads(file.read_text(encoding="utf-8")))
    path = Path(cot_path)
    if path.exists():
        snapshots.append(json.loads(path.read_text(encoding="utf-8")))

    cot_map: dict[str, list[CotPairBias]] = {}
    for snap in snapshots:
        report_date = datetime.fromisoformat(snap["report_date"]).date()
        pairs = snap.get("pairs", {})
        for pair, info in pairs.items():
            direction = info.get("direction")
            if direction is None:
                continue
            cot_map.setdefault(pair, []).append(CotPairBias(direction=direction, report_date=report_date))

    for pair in cot_map:
        cot_map[pair] = sorted(cot_map[pair], key=lambda x: x.report_date)
    return cot_map


def load_sentiment(sentiment_aggregates_path: str, sentiment_snapshots_path: str) -> dict[str, list[SentimentPoint]]:
    entries: list[dict] = []
    for path_str in (sentiment_aggregates_path, sentiment_snapshots_path):
        path = Path(path_str)
        if path.exists():
            try:
                entries.extend(json.loads(path.read_text(encoding="utf-8")))
            except json.JSONDecodeError:
                continue

    sentiment_map: dict[str, list[SentimentPoint]] = {}
    for item in entries:
        symbol = item.get("symbol")
        ts_raw = item.get("timestamp_utc")
        if not symbol or not ts_raw:
            continue
        ts = _parse_timestamp(ts_raw)
        sentiment_map.setdefault(symbol, []).append(
            SentimentPoint(
                symbol=symbol,
                timestamp=ts,
                long_pct=float(item.get("agg_long_pct") or item.get("long_pct") or 0),
                short_pct=float(item.get("agg_short_pct") or item.get("short_pct") or 0),
            )
        )

    for symbol in sentiment_map:
        sentiment_map[symbol] = sorted(sentiment_map[symbol], key=lambda x: x.timestamp)
    return sentiment_map


def build_bias_store(cot_path: str, cot_dir: str, sentiment_aggregates_path: str, sentiment_snapshots_path: str) -> BiasStore:
    return BiasStore(
        load_cot_bias(cot_path, cot_dir),
        load_sentiment(sentiment_aggregates_path, sentiment_snapshots_path),
    )


def load_spread_config(path: str) -> dict[str, float]:
    spread_path = Path(path)
    if not spread_path.exists():
        return {}
    try:
        payload = json.loads(spread_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {k.upper(): float(v) for k, v in payload.items()}


def localize_df(df: pd.DataFrame, tz: str) -> pd.DataFrame:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    df = df.copy()
    df["time"] = df["time"].dt.tz_convert(tz)
    return df
