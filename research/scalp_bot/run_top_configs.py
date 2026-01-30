from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import replace
from datetime import datetime
from pathlib import Path

from research.scalp_bot.backtest import run_backtest
from research.scalp_bot.config import BacktestConfig, DataConfig, SentimentConfig, SpreadConfig
from research.scalp_bot.data_sources import build_bias_store, load_spread_config
from research.scalp_bot.pairs import load_all_pairs_from_ts
from research.scalp_bot.report import compute_stats, trades_to_df, write_outputs


def parse_date(value: str):
    return datetime.fromisoformat(value).date()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run top grid configs on full universe")
    parser.add_argument("--top5", required=True)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--tf", default="M5")
    parser.add_argument("--session", default="london", choices=["london", "ny"])
    parser.add_argument("--mode", default="contrarian", choices=["contrarian", "trend"])
    parser.add_argument("--pairs-source", default="src/lib/cotPairs.ts")
    parser.add_argument("--data-root", default="data")
    parser.add_argument("--ohlc-root", default="data/ohlc")
    parser.add_argument("--cot-path", default="data/cot_snapshot.json")
    parser.add_argument("--cot-dir", default="data/cot_snapshots")
    parser.add_argument("--sentiment-aggregates-path", default="data/sentiment_aggregates.json")
    parser.add_argument("--sentiment-snapshots-path", default="data/sentiment_snapshots.json")
    parser.add_argument("--spread-path", default="data/spread_config.json")
    parser.add_argument("--default-spread", type=float, default=1.5)
    parser.add_argument("--output-dir", default="research/scalp_bot/output_stage3")
    parser.add_argument("--publish-best", action="store_true")
    parser.add_argument("--publish-dir", default="public/scalp-bot/stage3_best")

    args = parser.parse_args()

    top5 = json.loads(Path(args.top5).read_text(encoding="utf-8"))
    start = parse_date(args.start)
    end = parse_date(args.end)

    spread_map = load_spread_config(args.spread_path)
    cfg = BacktestConfig(
        timeframe=args.tf,
        session=args.session,
        sentiment=SentimentConfig(mode=args.mode, threshold_long_pct=55.0, threshold_short_pct=55.0),
    )
    cfg = replace(cfg, spread=SpreadConfig(default_spread_pips=args.default_spread, per_pair_pips=spread_map))

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

    pairs = [p.pair for p in load_all_pairs_from_ts(args.pairs_source)]
    bias_store = build_bias_store(
        data_cfg.cot_path,
        data_cfg.cot_dir,
        data_cfg.sentiment_aggregates_path,
        data_cfg.sentiment_snapshots_path,
    )

    results = []
    best = None
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    be_variants = {
        "base": replace(cfg.risk, be_trigger_pips=None, use_multi_target=False),
        "be_12pips": replace(cfg.risk, be_trigger_pips=12.0, use_multi_target=False),
        "be_1r_multi": replace(cfg.risk, be_trigger_pips=None, use_multi_target=True, tp1_r_multiple=1.0, tp1_pct=0.5),
    }

    for idx, params in enumerate(top5, start=1):
        base_cfg = replace(
            cfg,
            entry=replace(cfg.entry, sweep_buffer_pips=params["sweep_buffer_pips"], displacement_min_body_pips=params["displacement_min_body_pips"]),
            risk=replace(cfg.risk, max_stop_pips=params["max_stop_pips"], tp_pips=params["tp_pips"], be_trigger_pips=None, use_multi_target=False),
            sentiment=replace(cfg.sentiment, threshold_long_pct=params["sentiment_threshold"], threshold_short_pct=params["sentiment_threshold"]),
        )

        for name, risk_cfg in be_variants.items():
            iter_cfg = replace(base_cfg, risk=risk_cfg)
            result = run_backtest(pairs, bias_store, data_cfg, iter_cfg, start, end)
            df = trades_to_df(result.trades)
            stats = compute_stats(df)
            record = {
                "rank": idx,
                "variant": name,
                "net_r": stats.net_r,
                "profit_factor": stats.profit_factor,
                "trades": stats.trades,
                "params": params,
                "be_trigger_pips": iter_cfg.risk.be_trigger_pips,
                "multi_target": iter_cfg.risk.use_multi_target,
            }
            results.append(record)
            if best is None or (record["net_r"], record["profit_factor"]) > (best[0]["net_r"], best[0]["profit_factor"]):
                best = (record, iter_cfg)

    (out_dir / "stage3_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")

    if args.publish_best and best:
        best_record, best_cfg = best
        best_dir = out_dir / "best"
        write_outputs(best_cfg_trades(best_cfg, pairs, bias_store, data_cfg, start, end), best_cfg.account, best_cfg.execution, best_cfg.spread, best_cfg.risk, best_cfg.sentiment, best_dir)
        publish_dir = Path(args.publish_dir)
        publish_dir.mkdir(parents=True, exist_ok=True)
        for name in ["summary.json", "summary_report.md", "equity_curve.png", "drawdown_curve.png", "r_histogram.png", "trade_list.csv"]:
            src = best_dir / name
            if src.exists():
                shutil.copy2(src, publish_dir / name)


def best_cfg_trades(cfg, pairs, bias_store, data_cfg, start, end):
    result = run_backtest(pairs, bias_store, data_cfg, cfg, start, end)
    return result.trades


if __name__ == "__main__":
    main()
