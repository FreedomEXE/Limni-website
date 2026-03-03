"""
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: liq_sweep_backtest.py
 *
 * Description:
 * Phase-0 liquidation sweep signal backtest. Reuses the Katarakti
 * session/COT/data pipeline to count sweep signals and evaluate whether
 * liquidation-offset limit entries would have filled within a fixed
 * number of sessions.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from dataclasses import replace
from datetime import date
from datetime import datetime
from datetime import timedelta
from pathlib import Path

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - runtime dependency
    pd = None

from .config import BacktestConfig
from .config import DataConfig
from .data_sources import BiasStore
from .data_sources import load_cot_bias
from .data_sources import load_ohlcv
from .data_sources import localize_df
from .pairs import PairDefinition
from .pairs import filter_pairs
from .signals import build_session_reference
from .utils import session_bounds
from .utils import pip_size

CRYPTO_PAIRS = {"BTCUSD", "ETHUSD"}


@dataclass(frozen=True)
class LiqSweepConfig:
    liq_offset_pct: float = 0.05
    max_sessions_to_fill: int = 2


@dataclass(frozen=True)
class LiqSweepSignalResult:
    signal_time: datetime
    pair: str
    direction: str
    sweep_level: float
    limit_entry_price: float
    filled: bool
    fill_time: datetime | None
    max_excursion_pct: float
    sessions_elapsed: int
    time_to_fill_seconds: float | None


@dataclass(frozen=True)
class LiqSweepRunStats:
    processed_pairs: int
    missing_cot_days: int


@dataclass(frozen=True)
class LiqSweepSummary:
    signals: int
    fills: int
    unfilled: int
    fill_rate_pct: float
    avg_time_to_fill_seconds: float | None
    avg_max_excursion_pct: float


def parse_date(value: str) -> date:
    return datetime.fromisoformat(value).date()


def _iter_days(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current = current + timedelta(days=1)


def _choose_direction(cot_direction: str | None) -> str | None:
    if cot_direction == "LONG":
        return "long"
    if cot_direction == "SHORT":
        return "short"
    return None


def _session_window(cfg: BacktestConfig, session_name: str, day: date) -> tuple[datetime, datetime]:
    session = getattr(cfg.sessions, session_name)
    return session_bounds(session.start, session.end, day, cfg.sessions.timezone)


def _resolve_fill_expiry(cfg: BacktestConfig, signal_day: date, max_sessions_to_fill: int) -> datetime:
    final_session_day = signal_day + timedelta(days=max_sessions_to_fill - 1)
    _, session_end = _session_window(cfg, cfg.session, final_session_day)
    return session_end


def _sessions_elapsed(signal_day: date, event_day: date, max_sessions_to_fill: int) -> int:
    elapsed = (event_day - signal_day).days + 1
    if elapsed < 1:
        return 1
    return min(max_sessions_to_fill, elapsed)


def _discover_pairs(ohlc_root: str, timeframe: str) -> list[str]:
    root = Path(ohlc_root)
    pairs: set[str] = set()

    tf_dir = root / timeframe
    if tf_dir.exists():
        for suffix in ("*.csv", "*.parquet"):
            for file in tf_dir.glob(suffix):
                pairs.add(file.stem.upper())

    for suffix in ("csv", "parquet"):
        for file in root.glob(f"*_{timeframe}.{suffix}"):
            pair = file.stem[: -(len(timeframe) + 1)]
            if pair:
                pairs.add(pair.upper())

        for file in root.glob(f"*/{timeframe}.{suffix}"):
            pairs.add(file.parent.name.upper())

    return sorted(pairs)


def _find_sweep_breach(
    entry_window: pd.DataFrame,
    ref_high: float,
    ref_low: float,
    sweep_buffer_pips: float,
    pip: float,
    direction: str,
) -> tuple[int, datetime, float] | None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if entry_window.empty:
        return None

    buffer_price = sweep_buffer_pips * pip
    if direction == "short":
        breach_price = ref_high + buffer_price
        for idx, row in entry_window.iterrows():
            if row["high"] >= breach_price:
                return int(idx), row["time"].to_pydatetime(), ref_high
        return None

    breach_price = ref_low - buffer_price
    for idx, row in entry_window.iterrows():
        if row["low"] <= breach_price:
            return int(idx), row["time"].to_pydatetime(), ref_low
    return None


def _compute_limit_price(sweep_level: float, direction: str, liq_offset_pct: float) -> float:
    if direction == "short":
        return sweep_level * (1.0 + liq_offset_pct)
    return sweep_level * (1.0 - liq_offset_pct)


def _signal_to_row(signal: LiqSweepSignalResult) -> dict[str, object]:
    return {
        "date": signal.signal_time.isoformat(),
        "pair": signal.pair,
        "direction": signal.direction,
        "sweep_level": signal.sweep_level,
        "limit_entry_price": signal.limit_entry_price,
        "filled": signal.filled,
        "fill_time": signal.fill_time.isoformat() if signal.fill_time else "",
        "max_excursion_pct": signal.max_excursion_pct,
        "sessions_elapsed": signal.sessions_elapsed,
    }


def _format_seconds(seconds: float | None) -> str:
    if seconds is None:
        return "n/a"
    return str(timedelta(seconds=int(round(seconds))))


def _parse_offsets(raw_value: str) -> list[float]:
    offsets = []
    for part in raw_value.split(","):
        value = part.strip()
        if not value:
            continue
        offset = float(value)
        if not (0.0 < offset < 1.0):
            raise ValueError(f"Invalid offset {offset}. Each value must be between 0 and 1.")
        offsets.append(offset)
    if not offsets:
        raise ValueError("--sweep-offsets was set but no valid values were provided")
    return offsets


def _summarize_records(records: list[LiqSweepSignalResult]) -> LiqSweepSummary:
    total_signals = len(records)
    total_fills = sum(1 for row in records if row.filled)
    total_unfilled = total_signals - total_fills
    fill_rate = (total_fills / total_signals * 100.0) if total_signals else 0.0
    fill_times = [row.time_to_fill_seconds for row in records if row.time_to_fill_seconds is not None]
    avg_time_to_fill_seconds = (sum(fill_times) / len(fill_times)) if fill_times else None
    excursions = [row.max_excursion_pct for row in records if row.filled]
    avg_excursion = (sum(excursions) / len(excursions)) if excursions else 0.0
    return LiqSweepSummary(
        signals=total_signals,
        fills=total_fills,
        unfilled=total_unfilled,
        fill_rate_pct=fill_rate,
        avg_time_to_fill_seconds=avg_time_to_fill_seconds,
        avg_max_excursion_pct=avg_excursion,
    )


def run_liq_sweep_backtest(
    pairs: list[str],
    bias_store: BiasStore,
    data_cfg: DataConfig,
    base_cfg: BacktestConfig,
    liq_cfg: LiqSweepConfig,
    start: date,
    end: date,
) -> tuple[list[LiqSweepSignalResult], LiqSweepRunStats]:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")

    records: list[LiqSweepSignalResult] = []
    processed_pairs = 0
    missing_cot_days = 0

    for pair in pairs:
        try:
            df = load_ohlcv(pair, base_cfg.timeframe, data_cfg.ohlc_root, data_cfg.data_root)
        except (FileNotFoundError, ValueError):
            continue

        df = localize_df(df, base_cfg.sessions.timezone)
        df = df[(df["time"].dt.date >= start) & (df["time"].dt.date <= end)].reset_index(drop=True)
        if df.empty:
            continue

        processed_pairs += 1
        times_utc = (
            df["time"]
            .dt.tz_convert("UTC")
            .dt.tz_localize(None)
            .astype("datetime64[ns]")
            .astype("int64")
            .to_numpy()
        )
        pip = pip_size(pair)

        for day in _iter_days(start, end):
            cot_direction = bias_store.cot_direction_on(pair, day)
            direction = _choose_direction(cot_direction)
            if direction is None:
                missing_cot_days += 1
                continue

            session_ref = build_session_reference(df, base_cfg.sessions, day, base_cfg.use_prior_day_ref)
            if session_ref is None:
                continue

            entry_start, entry_end = _session_window(base_cfg, base_cfg.session, day)
            entry_start_ns = pd.Timestamp(entry_start).tz_convert("UTC").value
            entry_end_ns = pd.Timestamp(entry_end).tz_convert("UTC").value
            entry_start_idx = int(times_utc.searchsorted(entry_start_ns))
            entry_end_idx = int(times_utc.searchsorted(entry_end_ns, side="right"))
            entry_window = df.iloc[entry_start_idx:entry_end_idx]
            if entry_window.empty:
                continue

            sweep = _find_sweep_breach(
                entry_window=entry_window,
                ref_high=session_ref.ref_high,
                ref_low=session_ref.ref_low,
                sweep_buffer_pips=base_cfg.entry.sweep_buffer_pips,
                pip=pip,
                direction=direction,
            )
            if sweep is None:
                continue

            signal_idx, signal_time, sweep_level = sweep
            limit_entry_price = _compute_limit_price(sweep_level, direction, liq_cfg.liq_offset_pct)
            expiry_time = _resolve_fill_expiry(base_cfg, signal_time.date(), liq_cfg.max_sessions_to_fill)
            expiry_ns = pd.Timestamp(expiry_time).tz_convert("UTC").value
            expiry_idx = int(times_utc.searchsorted(expiry_ns, side="right"))
            fill_window = df.iloc[signal_idx:expiry_idx]
            if fill_window.empty:
                continue

            if direction == "short":
                fill_hits = fill_window["high"] >= limit_entry_price
                max_price = float(fill_window["high"].max())
                max_excursion_pct = max(0.0, ((max_price - limit_entry_price) / limit_entry_price) * 100.0)
            else:
                fill_hits = fill_window["low"] <= limit_entry_price
                min_price = float(fill_window["low"].min())
                max_excursion_pct = max(0.0, ((limit_entry_price - min_price) / limit_entry_price) * 100.0)

            filled = bool(fill_hits.any())
            fill_time = None
            time_to_fill_seconds = None

            if filled:
                first_fill_index = fill_hits[fill_hits].index[0]
                fill_time = df.loc[first_fill_index, "time"].to_pydatetime()
                time_to_fill_seconds = max(0.0, (fill_time - signal_time).total_seconds())

            event_time = fill_time if fill_time is not None else expiry_time
            sessions_elapsed = _sessions_elapsed(signal_time.date(), event_time.date(), liq_cfg.max_sessions_to_fill)

            records.append(
                LiqSweepSignalResult(
                    signal_time=signal_time,
                    pair=pair,
                    direction=direction,
                    sweep_level=float(sweep_level),
                    limit_entry_price=float(limit_entry_price),
                    filled=filled,
                    fill_time=fill_time,
                    max_excursion_pct=float(max_excursion_pct),
                    sessions_elapsed=sessions_elapsed,
                    time_to_fill_seconds=time_to_fill_seconds,
                )
            )

    return records, LiqSweepRunStats(processed_pairs=processed_pairs, missing_cot_days=missing_cot_days)


def write_signal_report(records: list[LiqSweepSignalResult], out_path: Path) -> pd.DataFrame:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame([_signal_to_row(record) for record in records])
    columns = [
        "date",
        "pair",
        "direction",
        "sweep_level",
        "limit_entry_price",
        "filled",
        "fill_time",
        "max_excursion_pct",
        "sessions_elapsed",
    ]
    if df.empty:
        df = pd.DataFrame(columns=columns)
    else:
        df = df[columns]
    df.to_csv(out_path, index=False)
    return df


def print_summary(records: list[LiqSweepSignalResult], stats: LiqSweepRunStats, out_path: Path) -> None:
    summary = _summarize_records(records)

    print(f"Report written: {out_path}")
    print(f"Processed pairs with OHLC data: {stats.processed_pairs}")
    print(f"Missing COT pair-days: {stats.missing_cot_days}")
    print(f"Total signals detected: {summary.signals}")
    print(f"Total fills vs unfilled: {summary.fills} / {summary.unfilled}")
    print(f"Fill rate %: {summary.fill_rate_pct:.2f}%")
    print(f"Average time to fill: {_format_seconds(summary.avg_time_to_fill_seconds)}")
    print(f"Average max excursion beyond entry: {summary.avg_max_excursion_pct:.4f}%")
    print(
        "OHLC input format: CSV/Parquet with time (or timestamp/date/datetime) and open/high/low/close columns."
    )


def print_multi_offset_summary(rows: list[tuple[float, LiqSweepSummary]]) -> None:
    print("| Offset | Signals | Fills | Fill Rate | Avg Time to Fill | Avg Max Excursion |")
    print("| --- | ---: | ---: | ---: | --- | ---: |")
    for offset, summary in rows:
        print(
            f"| {offset:.4f} | {summary.signals} | {summary.fills} | {summary.fill_rate_pct:.2f}% | "
            f"{_format_seconds(summary.avg_time_to_fill_seconds)} | {summary.avg_max_excursion_pct:.4f}% |"
        )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Liquidation sweep signal/fill backtest (Phase 0)")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--tf", default="M5")
    parser.add_argument("--session", default="london", choices=["london", "ny"])
    parser.add_argument("--crypto-only", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--use-prior-day-ref", action="store_true")
    parser.add_argument("--sweep-buffer-pips", type=float, default=1.0)
    parser.add_argument("--liq-offset-pct", type=float, default=0.05)
    parser.add_argument("--sweep-offsets", default="", help="Comma-separated offsets, e.g. 0.01,0.02,0.03")
    parser.add_argument("--max-sessions-to-fill", type=int, default=2)
    parser.add_argument("--pairs", default="", help="Comma-separated pair list. Default: all available in data/ohlc")
    parser.add_argument("--output-path", default="research/scalp_bot/output/liq_sweep_signals.csv")
    parser.add_argument("--multi-output-path", default="research/scalp_bot/output/liq_sweep_multi_offset.csv")
    parser.add_argument("--data-root", default="data")
    parser.add_argument("--ohlc-root", default="data/ohlc")
    parser.add_argument("--cot-path", default="data/cot_snapshot.json")
    parser.add_argument("--cot-dir", default="data/cot_snapshots")
    return parser


def main() -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")

    args = _build_parser().parse_args()
    start = parse_date(args.start)
    end = parse_date(args.end)
    timeframe = args.tf.upper()

    if args.max_sessions_to_fill < 1:
        raise ValueError("--max-sessions-to-fill must be >= 1")
    if not (0.0 < args.liq_offset_pct < 1.0):
        raise ValueError("--liq-offset-pct must be between 0 and 1")

    data_cfg = DataConfig(
        data_root=args.data_root,
        ohlc_root=args.ohlc_root,
        cot_path=args.cot_path,
        cot_dir=args.cot_dir,
    )

    base_cfg = BacktestConfig(timeframe=timeframe, session=args.session, use_prior_day_ref=args.use_prior_day_ref)
    base_cfg = replace(base_cfg, entry=replace(base_cfg.entry, sweep_buffer_pips=args.sweep_buffer_pips))

    liq_cfg = LiqSweepConfig(
        liq_offset_pct=args.liq_offset_pct,
        max_sessions_to_fill=args.max_sessions_to_fill,
    )

    available_pairs = _discover_pairs(data_cfg.ohlc_root, timeframe)
    if args.crypto_only:
        available_pairs = [pair for pair in available_pairs if pair in CRYPTO_PAIRS]
    selected = [pair.strip().upper() for pair in args.pairs.split(",") if pair.strip()] or None
    pair_defs = [PairDefinition(pair=pair, base="", quote="") for pair in available_pairs]
    pairs = [pair.pair for pair in filter_pairs(pair_defs, selected)]
    if not pairs:
        raise ValueError("No pairs available after filters. Check --tf, --pairs, and --crypto-only flags.")

    cot_map = load_cot_bias(data_cfg.cot_path, data_cfg.cot_dir)
    bias_store = BiasStore(cot_map=cot_map, sentiment_map={})

    if args.sweep_offsets.strip():
        offsets = _parse_offsets(args.sweep_offsets)
        combined_rows: list[dict[str, object]] = []
        summaries: list[tuple[float, LiqSweepSummary]] = []
        latest_stats: LiqSweepRunStats | None = None

        for offset in offsets:
            iter_liq_cfg = replace(liq_cfg, liq_offset_pct=offset)
            records, stats = run_liq_sweep_backtest(
                pairs=pairs,
                bias_store=bias_store,
                data_cfg=data_cfg,
                base_cfg=base_cfg,
                liq_cfg=iter_liq_cfg,
                start=start,
                end=end,
            )
            latest_stats = stats
            summaries.append((offset, _summarize_records(records)))
            for record in records:
                row = _signal_to_row(record)
                row["offset_pct"] = offset
                combined_rows.append(row)

        out_path = Path(args.multi_output_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        multi_df = pd.DataFrame(combined_rows)
        multi_columns = [
            "offset_pct",
            "date",
            "pair",
            "direction",
            "sweep_level",
            "limit_entry_price",
            "filled",
            "fill_time",
            "max_excursion_pct",
            "sessions_elapsed",
        ]
        if multi_df.empty:
            multi_df = pd.DataFrame(columns=multi_columns)
        else:
            multi_df = multi_df[multi_columns]
        multi_df.to_csv(out_path, index=False)

        print(f"Report written: {out_path}")
        if latest_stats is not None:
            print(f"Processed pairs with OHLC data: {latest_stats.processed_pairs}")
            print(f"Missing COT pair-days: {latest_stats.missing_cot_days}")
        print_multi_offset_summary(summaries)
        print(
            "OHLC input format: CSV/Parquet with time (or timestamp/date/datetime) and open/high/low/close columns."
        )
    else:
        records, stats = run_liq_sweep_backtest(
            pairs=pairs,
            bias_store=bias_store,
            data_cfg=data_cfg,
            base_cfg=base_cfg,
            liq_cfg=liq_cfg,
            start=start,
            end=end,
        )
        out_path = Path(args.output_path)
        write_signal_report(records, out_path)
        print_summary(records, stats, out_path)


if __name__ == "__main__":
    main()
