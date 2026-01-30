from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import replace
from datetime import date, datetime
from pathlib import Path

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - runtime dependency
    pd = None

from .audit import run_audit
from .backtest import run_backtest
from .config import BacktestConfig, DataConfig, GridConfig, SentimentConfig, SpreadConfig
from .data_sources import build_bias_store, load_spread_config
from .pairs import filter_pairs, load_all_pairs_from_ts
from .report import trades_to_df, write_outputs, write_summary, compute_stats
from .data_sources import load_ohlcv


def parse_date(value: str):
    return datetime.fromisoformat(value).date()


def build_config(args) -> tuple[BacktestConfig, DataConfig]:
    sentiment = SentimentConfig(mode=args.mode, threshold_long_pct=args.sentiment_threshold, threshold_short_pct=args.sentiment_threshold)
    spread_path = Path(args.spread_path)
    if not spread_path.exists():
        alt = Path("research/scalp_bot/spread_config.json")
        if alt.exists():
            spread_path = alt
    spread_map = load_spread_config(str(spread_path))
    spread = SpreadConfig(default_spread_pips=args.default_spread, per_pair_pips=spread_map)

    cfg = BacktestConfig(
        timeframe=args.tf,
        session=args.session,
        allow_second_window=args.allow_second_window,
        use_prior_day_ref=args.use_prior_day_ref,
        sentiment=sentiment,
        spread=spread,
    )
    cfg = replace(
        cfg,
        entry=replace(
            cfg.entry,
            model=args.entry_model,
            adr_lookback_days=args.adr_lookback_days,
            adr_pullback_pct=args.adr_pullback_pct,
        ),
    )

    data_cfg = DataConfig(
        data_root=args.data_root,
        ohlc_root=args.ohlc_root,
        cot_path=args.cot_path,
        cot_dir=args.cot_dir,
        sentiment_aggregates_path=args.sentiment_aggregates_path,
        sentiment_snapshots_path=args.sentiment_snapshots_path,
        pairs_source=args.pairs_source,
        spread_path=str(spread_path),
    )
    return cfg, data_cfg


def run_scenarios(pairs, bias_store, data_cfg, cfg, start, end, out_dir: Path) -> None:
    scenarios = [
        ("base", cfg.spread.default_spread_pips, cfg.execution.slippage_pips),
        ("tight", max(cfg.spread.default_spread_pips - 0.5, 0.0), max(cfg.execution.slippage_pips - 0.1, 0.0)),
        ("wide", cfg.spread.default_spread_pips + 0.5, cfg.execution.slippage_pips + 0.1),
    ]
    lines = []
    lines.append("\n## Spread/slippage sensitivity")
    for name, spread_pips, slippage_pips in scenarios:
        scenario_cfg = replace(
            cfg,
            spread=replace(cfg.spread, default_spread_pips=spread_pips),
            execution=replace(cfg.execution, slippage_pips=slippage_pips),
        )
        result = run_backtest(pairs, bias_store, data_cfg, scenario_cfg, start, end)
        df = trades_to_df(result.trades)
        stats = compute_stats(df)
        lines.append(
            f"- {name}: trades={stats.trades}, net_r={stats.net_r:.2f}, profit_factor={stats.profit_factor:.2f}, max_dd_r={stats.max_drawdown_r:.2f}"
        )
    summary_path = out_dir / "summary_report.md"
    summary_path.write_text(summary_path.read_text(encoding="utf-8") + "\n" + "\n".join(lines), encoding="utf-8")


def run_grid(pairs, bias_store, data_cfg, cfg, start, end, out_dir: Path) -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    grid = GridConfig()
    dates = pd.date_range(start=start, end=end, freq="D")
    if len(dates) < 10:
        return
    split_idx = int(len(dates) * 0.7)
    train_end = dates[split_idx - 1].date()
    test_start = dates[split_idx].date()

    best = None
    for sweep in grid.sweep_buffer_pips:
        for disp in grid.displacement_min_body_pips:
            for max_stop in grid.max_stop_pips:
                for tp in grid.tp_pips:
                    for threshold in grid.sentiment_threshold:
                        for be in grid.be_trigger_pips:
                            iter_cfg = replace(
                                cfg,
                                entry=replace(cfg.entry, sweep_buffer_pips=sweep, displacement_min_body_pips=disp),
                                risk=replace(cfg.risk, max_stop_pips=max_stop, tp_pips=tp, be_trigger_pips=be),
                                sentiment=replace(cfg.sentiment, threshold_long_pct=threshold, threshold_short_pct=threshold),
                            )
                            result = run_backtest(pairs, bias_store, data_cfg, iter_cfg, start, train_end)
                            df = trades_to_df(result.trades)
                            stats = compute_stats(df)
                            if best is None or stats.net_r > best[0]:
                                best = (stats.net_r, iter_cfg)

    if best is None:
        return

    best_cfg = best[1]
    best_params = {
        "sweep_buffer_pips": best_cfg.entry.sweep_buffer_pips,
        "displacement_min_body_pips": best_cfg.entry.displacement_min_body_pips,
        "max_stop_pips": best_cfg.risk.max_stop_pips,
        "tp_pips": best_cfg.risk.tp_pips,
        "sentiment_threshold": best_cfg.sentiment.threshold_long_pct,
        "be_trigger_pips": best_cfg.risk.be_trigger_pips,
    }

    (out_dir / "best_params.json").write_text(json.dumps(best_params, indent=2), encoding="utf-8")
    result = run_backtest(pairs, bias_store, data_cfg, best_cfg, test_start, end)
    df = trades_to_df(result.trades)
    write_summary(df, best_cfg.account, best_cfg.execution, best_cfg.spread, best_cfg.risk, best_cfg.sentiment, out_dir / "holdout_summary.md")


def append_data_coverage(
    pairs: list[str],
    data_cfg: DataConfig,
    cfg: BacktestConfig,
    start: date,
    end: date,
    result,
    trades_df,
    out_path: Path,
) -> None:
    if pd is None:
        return
    coverage_rows = []
    found_pairs = 0
    for pair in pairs:
        try:
            df = load_ohlcv(pair, cfg.timeframe, data_cfg.ohlc_root, data_cfg.data_root)
        except (FileNotFoundError, ValueError):
            continue
        found_pairs += 1
        df = df[(df["time"].dt.date >= start) & (df["time"].dt.date <= end)]
        if df.empty:
            continue
        first = df["time"].iloc[0]
        last = df["time"].iloc[-1]
        trades_count = int((trades_df["pair"] == pair).sum()) if not trades_df.empty else 0
        coverage_rows.append(
            {
                "pair": pair,
                "bars": int(len(df)),
                "start": first.date().isoformat(),
                "end": last.date().isoformat(),
                "trades": trades_count,
            }
        )

    lines = []
    lines.append("")
    lines.append("## Data Coverage")
    lines.append(f"- Pairs requested: {len(pairs)}")
    lines.append(f"- Pairs found: {found_pairs}")
    if result.pair_days > 0:
        missing_cot_pct = result.missing_cot_days / result.pair_days * 100.0
        missing_sent_pct = result.missing_sentiment_days / result.pair_days * 100.0
        lines.append(f"- % days skipped due to missing COT: {missing_cot_pct:.2f}%")
        lines.append(f"- % days skipped due to missing sentiment: {missing_sent_pct:.2f}%")
    if coverage_rows:
        coverage_df = pd.DataFrame(coverage_rows)
        lines.append("")
        lines.append("### Coverage by pair")
        lines.append(coverage_df.to_markdown(index=False))

    out_path.write_text(out_path.read_text(encoding="utf-8") + "\n" + "\n".join(lines), encoding="utf-8")


def main() -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    parser = argparse.ArgumentParser(description="Limni Scalp Bot research backtest")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--tf", default="M5")
    parser.add_argument("--session", default="london", choices=["london", "ny"])
    parser.add_argument("--mode", default="contrarian", choices=["contrarian", "trend"])
    parser.add_argument("--sentiment-threshold", type=float, default=55.0)
    parser.add_argument("--allow-second-window", action="store_true")
    parser.add_argument("--use-prior-day-ref", action="store_true")
    parser.add_argument("--entry-model", default="sweep", choices=["sweep", "adr_pullback"])
    parser.add_argument("--adr-lookback-days", type=int, default=20)
    parser.add_argument("--adr-pullback-pct", type=float, default=0.35)
    parser.add_argument("--output-dir", default="research/scalp_bot/output")
    parser.add_argument("--data-root", default="data")
    parser.add_argument("--ohlc-root", default="data/ohlc")
    parser.add_argument("--cot-path", default="data/cot_snapshot.json")
    parser.add_argument("--cot-dir", default="data/cot_snapshots")
    parser.add_argument("--sentiment-aggregates-path", default="data/sentiment_aggregates.json")
    parser.add_argument("--sentiment-snapshots-path", default="data/sentiment_snapshots.json")
    parser.add_argument("--pairs-source", default="src/lib/cotPairs.ts")
    parser.add_argument("--spread-path", default="data/spread_config.json")
    parser.add_argument("--default-spread", type=float, default=1.5)
    parser.add_argument("--pairs", default="")
    parser.add_argument("--grid", action="store_true")
    parser.add_argument("--audit-samples", type=int, default=20)
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--publish-dir", default="public/scalp-bot")

    args = parser.parse_args()
    start = parse_date(args.start)
    end = parse_date(args.end)

    cfg, data_cfg = build_config(args)
    all_pairs = load_all_pairs_from_ts(data_cfg.pairs_source)
    selected = [p.strip().upper() for p in args.pairs.split(",") if p.strip()] or None
    pairs = [p.pair for p in filter_pairs(all_pairs, selected)]

    bias_store = build_bias_store(
        data_cfg.cot_path,
        data_cfg.cot_dir,
        data_cfg.sentiment_aggregates_path,
        data_cfg.sentiment_snapshots_path,
    )

    out_dir = Path(args.output_dir)
    result = run_backtest(pairs, bias_store, data_cfg, cfg, start, end)
    write_outputs(result.trades, cfg.account, cfg.execution, cfg.spread, cfg.risk, cfg.sentiment, out_dir)

    df = trades_to_df(result.trades)
    run_audit(df, data_cfg, cfg, args.audit_samples, out_dir / "audit")
    run_scenarios(pairs, bias_store, data_cfg, cfg, start, end, out_dir)
    append_data_coverage(pairs, data_cfg, cfg, start, end, result, df, out_dir / "summary_report.md")

    if args.grid:
        run_grid(pairs, bias_store, data_cfg, cfg, start, end, out_dir)

    if args.publish:
        publish_dir = Path(args.publish_dir)
        publish_dir.mkdir(parents=True, exist_ok=True)
        for name in ["summary.json", "summary_report.md", "equity_curve.png", "drawdown_curve.png", "r_histogram.png"]:
            src = out_dir / name
            if src.exists():
                shutil.copy2(src, publish_dir / name)


if __name__ == "__main__":
    main()
