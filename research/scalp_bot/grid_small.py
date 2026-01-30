from __future__ import annotations

import argparse
import json
from dataclasses import replace
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from .config import BacktestConfig, DataConfig, SentimentConfig, SpreadConfig
from .data_sources import build_bias_store, load_spread_config, load_ohlcv, localize_df
from .pairs import filter_pairs, load_all_pairs_from_ts
from .report import compute_stats, trades_to_df, write_summary
from .signals import detect_sweep_signal
from .utils import SessionRef, pip_size, session_bounds


SMALL_GRID = {
    "sweep_buffer_pips": [1.0, 2.0],
    "displacement_min_body_pips": [2.0, 3.0],
    "max_stop_pips": [10.0, 12.0],
    "tp_pips": [30.0, 40.0, 50.0],
    "sentiment_threshold": [55.0, 60.0],
}


def parse_date(value: str):
    return datetime.fromisoformat(value).date()


def build_cache(pairs, data_cfg, cfg, start, end):
    cache = {}
    for pair in pairs:
        try:
            df = load_ohlcv(pair, cfg.timeframe, data_cfg.ohlc_root, data_cfg.data_root)
        except (FileNotFoundError, ValueError):
            continue
        df = localize_df(df, cfg.sessions.timezone)
        df = df[(df["time"].dt.date >= start) & (df["time"].dt.date <= end)].reset_index(drop=True)
        if df.empty:
            continue
        times_utc = (
            df["time"]
            .dt.tz_convert("UTC")
            .dt.tz_localize(None)
            .astype("datetime64[ns]")
            .astype("int64")
            .to_numpy()
        )
        cache[pair] = (df, times_utc)
    return cache


def run_backtest_cached(pairs, cache, bias_store, cfg, start, end, day_step: int = 1):
    trades = []
    for pair in pairs:
        if pair not in cache:
            continue
        df, times_utc = cache[pair]
        pip = pip_size(pair)
        spread_pips = cfg.spread.per_pair_pips.get(pair, cfg.spread.default_spread_pips)
        current = start
        while current <= end:
            cot_dir = bias_store.cot_direction_on(pair, current)
            if cot_dir is None:
                current = current + timedelta(days=1)
                continue
            trade_dir = "long" if cot_dir == "LONG" else "short"

            entry_window_start, entry_window_end = session_bounds(cfg.sessions.london.start, cfg.sessions.london.end, current, cfg.sessions.timezone)

            asia_start, asia_end = session_bounds(cfg.sessions.asia.start, cfg.sessions.asia.end, current - timedelta(days=1), cfg.sessions.timezone)
            asia_start_ns = pd.Timestamp(asia_start).tz_convert("UTC").value
            asia_end_ns = pd.Timestamp(asia_end).tz_convert("UTC").value
            asia_window = df.iloc[times_utc.searchsorted(asia_start_ns):times_utc.searchsorted(asia_end_ns, side="right")]
            if asia_window.empty:
                current = current + timedelta(days=1)
                continue
            session_ref = SessionRef(
                ref_high=float(asia_window["high"].max()),
                ref_low=float(asia_window["low"].min()),
                start=asia_start,
                end=asia_end,
            )

            sentiment = bias_store.sentiment_at(pair, entry_window_start)
            if sentiment is not None:
                if cfg.sentiment.mode == "contrarian":
                    allow = sentiment.long_pct >= cfg.sentiment.threshold_long_pct if trade_dir == "short" else sentiment.short_pct >= cfg.sentiment.threshold_short_pct
                else:
                    allow = sentiment.short_pct >= cfg.sentiment.threshold_short_pct if trade_dir == "short" else sentiment.long_pct >= cfg.sentiment.threshold_long_pct
                if not allow:
                    current = current + timedelta(days=1)
                    continue
            elif cfg.sentiment.missing_policy == "require":
                current = current + timedelta(days=1)
                continue

            entry_start_ns = pd.Timestamp(entry_window_start).tz_convert("UTC").value
            entry_end_ns = pd.Timestamp(entry_window_end).tz_convert("UTC").value
            entry_window = df.iloc[times_utc.searchsorted(entry_start_ns):times_utc.searchsorted(entry_end_ns, side="right")]
            signal = detect_sweep_signal(entry_window, entry_window_start, entry_window_end, session_ref, cfg.entry, pip, trade_dir, prefiltered=True)
            if signal is None:
                current = current + timedelta(days=1)
                continue

            confirm_idx = signal.confirm_index
            entry_idx = confirm_idx + 1 if cfg.entry.entry_timing == "next_open" else confirm_idx
            if entry_idx >= len(df):
                current = current + timedelta(days=1)
                continue
            entry_row = df.iloc[entry_idx]
            entry_time = entry_row["time"].to_pydatetime()
            if not (entry_window_start <= entry_time <= entry_window_end):
                current = current + timedelta(days=1)
                continue
            entry_price = entry_row["open"] if cfg.entry.entry_timing == "next_open" else entry_row["close"]

            if trade_dir == "short":
                stop_price = signal.sweep_high + cfg.risk.stop_buffer_pips * pip
            else:
                stop_price = signal.sweep_low - cfg.risk.stop_buffer_pips * pip

            stop_pips = abs(entry_price - stop_price) / pip
            if stop_pips > cfg.risk.max_stop_pips:
                current = current + timedelta(days=1)
                continue

            tp_price = entry_price + cfg.risk.tp_pips * pip * (1 if trade_dir == "long" else -1)
            time_stop = entry_window_end

            from research.scalp_bot.execution import simulate_trade

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
            current = current + timedelta(days=day_step)
    return trades


def main() -> None:
    parser = argparse.ArgumentParser(description="Small grid search for scalp bot")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--tf", default="M5")
    parser.add_argument("--session", default="london", choices=["london", "ny"])
    parser.add_argument("--mode", default="contrarian", choices=["contrarian", "trend"])
    parser.add_argument("--pairs", default="")
    parser.add_argument("--pairs-source", default="src/lib/cotPairs.ts")
    parser.add_argument("--data-root", default="data")
    parser.add_argument("--ohlc-root", default="data/ohlc")
    parser.add_argument("--cot-path", default="data/cot_snapshot.json")
    parser.add_argument("--cot-dir", default="data/cot_snapshots")
    parser.add_argument("--sentiment-aggregates-path", default="data/sentiment_aggregates.json")
    parser.add_argument("--sentiment-snapshots-path", default="data/sentiment_snapshots.json")
    parser.add_argument("--spread-path", default="data/spread_config.json")
    parser.add_argument("--default-spread", type=float, default=1.5)
    parser.add_argument("--output-dir", default="research/scalp_bot/output_grid_small")
    parser.add_argument("--day-step", type=int, default=1, help="Evaluate every Nth day to speed grid search")

    args = parser.parse_args()
    start = parse_date(args.start)
    end = parse_date(args.end)

    spread_map = load_spread_config(args.spread_path)
    cfg = BacktestConfig(
        timeframe=args.tf,
        session=args.session,
        sentiment=SentimentConfig(mode=args.mode, threshold_long_pct=55.0, threshold_short_pct=55.0),
    )
    cfg = replace(cfg, spread=SpreadConfig(default_spread_pips=args.default_spread, per_pair_pips=spread_map))
    cfg = replace(cfg, risk=replace(cfg.risk, be_trigger_pips=None, use_multi_target=False))

    data_cfg = DataConfig(
        data_root=args.data_root,
        ohlc_root=args.ohlc_root,
        cot_path=args.cot_path,
        cot_dir=args.cot_dir,
        sentiment_aggregates_path=args.sentiment_aggregates_path,
        sentiment_snapshots_path=args.sentiment_snapshots_path,
        pairs_source=args.pairs_source,
        spread_path=args.spread_path,
    )

    all_pairs = load_all_pairs_from_ts(args.pairs_source)
    selected = [p.strip().upper() for p in args.pairs.split(",") if p.strip()] or None
    pairs = [p.pair for p in filter_pairs(all_pairs, selected)]

    bias_store = build_bias_store(
        args.cot_path,
        args.cot_dir,
        args.sentiment_aggregates_path,
        args.sentiment_snapshots_path,
    )

    cache = build_cache(pairs, data_cfg, cfg, start, end)

    grid_results = []
    for sweep in SMALL_GRID["sweep_buffer_pips"]:
        for disp in SMALL_GRID["displacement_min_body_pips"]:
            for max_stop in SMALL_GRID["max_stop_pips"]:
                for tp in SMALL_GRID["tp_pips"]:
                    for threshold in SMALL_GRID["sentiment_threshold"]:
                        iter_cfg = replace(
                            cfg,
                            entry=replace(cfg.entry, sweep_buffer_pips=sweep, displacement_min_body_pips=disp),
                            risk=replace(cfg.risk, max_stop_pips=max_stop, tp_pips=tp, be_trigger_pips=None),
                            sentiment=replace(cfg.sentiment, threshold_long_pct=threshold, threshold_short_pct=threshold),
                        )
                        trades = run_backtest_cached(pairs, cache, bias_store, iter_cfg, start, end, day_step=args.day_step)
                        df = trades_to_df(trades)
                        stats = compute_stats(df)
                        grid_results.append(
                            {
                                "net_r": stats.net_r,
                                "profit_factor": stats.profit_factor,
                                "trades": stats.trades,
                                "sweep_buffer_pips": sweep,
                                "displacement_min_body_pips": disp,
                                "max_stop_pips": max_stop,
                                "tp_pips": tp,
                                "sentiment_threshold": threshold,
                            }
                        )

    grid_results.sort(key=lambda x: (x["net_r"], x["profit_factor"]), reverse=True)
    top5 = grid_results[:5]

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "top5.json").write_text(json.dumps(top5, indent=2), encoding="utf-8")

    # Re-run top configs with BE variations
    be_variants = [
        ("be_12pips", replace(cfg.risk, be_trigger_pips=12.0, use_multi_target=False)),
        ("be_1r_multi", replace(cfg.risk, be_trigger_pips=None, use_multi_target=True, tp1_r_multiple=1.0, tp1_pct=0.5)),
    ]

    for idx, params in enumerate(top5, start=1):
        base_cfg = replace(
            cfg,
            entry=replace(cfg.entry, sweep_buffer_pips=params["sweep_buffer_pips"], displacement_min_body_pips=params["displacement_min_body_pips"]),
            risk=replace(cfg.risk, max_stop_pips=params["max_stop_pips"], tp_pips=params["tp_pips"], be_trigger_pips=None, use_multi_target=False),
            sentiment=replace(cfg.sentiment, threshold_long_pct=params["sentiment_threshold"], threshold_short_pct=params["sentiment_threshold"]),
        )

        for name, risk_cfg in be_variants:
            iter_cfg = replace(base_cfg, risk=risk_cfg)
            trades = run_backtest_cached(pairs, cache, bias_store, iter_cfg, start, end, day_step=args.day_step)
            df = trades_to_df(trades)
            report_path = out_dir / f"top{idx}_{name}.md"
            write_summary(df, iter_cfg.account, iter_cfg.execution, iter_cfg.spread, iter_cfg.risk, iter_cfg.sentiment, report_path)


if __name__ == "__main__":
    main()
