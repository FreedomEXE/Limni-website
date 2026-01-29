from __future__ import annotations

import argparse
import csv
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from .pairs import filter_pairs, load_fx_pairs_from_ts


PRACTICE_URL = "https://api-fxpractice.oanda.com"
LIVE_URL = "https://api-fxtrade.oanda.com"

OANDA_OVERRIDES: dict[str, str] = {
    "SPXUSD": "SPX500_USD",
    "NDXUSD": "NAS100_USD",
    "NIKKEIUSD": "JP225_USD",
    "BTCUSD": "BTC_USD",
    "ETHUSD": "ETH_USD",
    "XAUUSD": "XAU_USD",
    "XAGUSD": "XAG_USD",
    "WTIUSD": "WTICO_USD",
}


@dataclass(frozen=True)
class Candle:
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


def _base_url(env: str) -> str:
    return LIVE_URL if env == "live" else PRACTICE_URL


def _map_instrument(symbol: str) -> str:
    if symbol in OANDA_OVERRIDES:
        return OANDA_OVERRIDES[symbol]
    if "/" in symbol:
        return symbol.replace("/", "_")
    if len(symbol) == 6:
        return f"{symbol[:3]}_{symbol[3:]}"
    return symbol


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def fetch_candles(
    api_key: str,
    instrument: str,
    granularity: str,
    start: datetime,
    end: datetime,
    base_url: str,
    count: int = 5000,
) -> list[Candle]:
    params = {
        "price": "M",
        "granularity": granularity,
        "from": start.isoformat().replace("+00:00", "Z"),
        "count": str(count),
    }
    url = f"{base_url}/v3/instruments/{instrument}/candles?{urlencode(params)}"
    req = Request(url, headers={"Authorization": f"Bearer {api_key}"})
    try:
        with urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else ""
        raise RuntimeError(f"OANDA fetch failed {exc.code}: {detail}") from exc

    candles = []
    for item in payload.get("candles", []) or []:
        if not item.get("complete"):
            continue
        mid = item.get("mid")
        if not mid:
            continue
        candle = Candle(
            time=_parse_time(item["time"]),
            open=float(mid["o"]),
            high=float(mid["h"]),
            low=float(mid["l"]),
            close=float(mid["c"]),
            volume=int(item.get("volume", 0)),
        )
        if candle.time <= end:
            candles.append(candle)
    return candles


def download_pair(
    api_key: str,
    pair: str,
    granularity: str,
    start: datetime,
    end: datetime,
    base_url: str,
    out_dir: Path,
    sleep_sec: float,
    overwrite: bool,
) -> Path:
    instrument = _map_instrument(pair)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{pair}.csv"
    if out_path.exists() and out_path.stat().st_size > 0 and not overwrite:
        return out_path

    all_candles: list[Candle] = []
    cursor = start
    while cursor < end:
        batch = fetch_candles(api_key, instrument, granularity, cursor, end, base_url)
        if not batch:
            break
        all_candles.extend(batch)
        last_time = batch[-1].time
        if last_time <= cursor:
            break
        cursor = last_time + timedelta(seconds=1)
        if last_time >= end:
            break
        if sleep_sec > 0:
            time.sleep(sleep_sec)

    if not all_candles:
        return out_path

    seen = set()
    unique = []
    for c in all_candles:
        if c.time in seen:
            continue
        seen.add(c.time)
        unique.append(c)

    unique.sort(key=lambda c: c.time)
    with out_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["time", "open", "high", "low", "close", "volume"])
        for c in unique:
            writer.writerow([c.time.isoformat().replace("+00:00", "Z"), c.open, c.high, c.low, c.close, c.volume])

    return out_path


def parse_date(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)




def main() -> None:
    parser = argparse.ArgumentParser(description="Download OANDA OHLCV data for backtests")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--tf", default="M5")
    parser.add_argument("--pairs", default="")
    parser.add_argument("--pairs-source", default="src/lib/cotPairs.ts")
    parser.add_argument("--out", default="data/ohlc")
    parser.add_argument("--env", default="practice", choices=["practice", "live"])
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--api-key", default="")
    parser.add_argument("--overwrite", action="store_true")

    args = parser.parse_args()
    api_key = args.api_key or os.environ.get("OANDA_API_KEY", "")
    if not api_key and Path(".env").exists():
        for line in Path(".env").read_text(encoding="utf-8").splitlines():
            if line.startswith("OANDA_API_KEY="):
                api_key = line.split("=", 1)[1].strip()
                break
    if not api_key:
        raise RuntimeError("OANDA_API_KEY is required (set in .env or pass --api-key).")

    start = parse_date(args.start)
    end = parse_date(args.end)

    all_pairs = load_fx_pairs_from_ts(args.pairs_source)
    selected = [p.strip().upper() for p in args.pairs.split(",") if p.strip()] or None
    pairs = [p.pair for p in filter_pairs(all_pairs, selected)]

    out_dir = Path(args.out) / args.tf
    base_url = _base_url(args.env)

    for pair in pairs:
        download_pair(api_key, pair, args.tf, start, end, base_url, out_dir, args.sleep, args.overwrite)


if __name__ == "__main__":
    main()
