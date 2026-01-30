import argparse
import json
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from pathlib import Path

import pandas as pd

from .data_sources import build_bias_store, load_ohlcv, localize_df, load_spread_config
from .pairs import load_all_pairs_from_ts
from .utils import pip_size
from .execution import apply_spread_slippage


ET_TZ = "America/Toronto"


@dataclass(frozen=True)
class DailyBiasConfig:
    entry_time: time = time(18, 0)
    exit_time: time = time(16, 45)
    timezone: str = ET_TZ
    default_spread_pips: float = 1.2
    slippage_pips: float = 0.15
    mode: str = "hourly"


@dataclass(frozen=True)
class DailyTrade:
    pair: str
    direction: str
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    entry_price_raw: float
    exit_price_raw: float
    pnl_pips: float
    spread_pips: float
    slippage_pips: float
    entry_count: int


def _is_weekday(value: datetime.date) -> bool:
    return value.weekday() <= 4


def _find_bar(df: pd.DataFrame, target: datetime, how: str) -> pd.Series | None:
    if df.empty:
        return None
    if how == "entry":
        window = df[df["time"] >= target]
        return window.iloc[0] if not window.empty else None
    window = df[df["time"] <= target]
    return window.iloc[-1] if not window.empty else None


def run_daily_bias(
    start: datetime.date,
    end: datetime.date,
    data_root: str,
    ohlc_root: str,
    cot_path: str,
    cot_dir: str,
    pairs_source: str,
    spread_path: str,
    cfg: DailyBiasConfig,
) -> list[DailyTrade]:
    store = build_bias_store(cot_path, cot_dir, "data/sentiment_aggregates.json", "data/sentiment_snapshots.json")
    pairs = load_all_pairs_from_ts(pairs_source)
    spread_map = load_spread_config(spread_path)

    trades: list[DailyTrade] = []

    for pair_def in pairs:
        pair = pair_def.pair
        try:
            df = load_ohlcv(pair, "M5", ohlc_root, data_root)
        except (FileNotFoundError, ValueError):
            continue
        df = localize_df(df, cfg.timezone)

        if df.empty:
            continue

        price_df = df[["time", "open", "close"]].sort_values("time")
        spread_pips = spread_map.get(pair, cfg.default_spread_pips)
        pip = pip_size(pair)

        if cfg.mode in ("single", "hourly"):
            days = [d for d in pd.date_range(start=start, end=end, freq="D").date if _is_weekday(d)]
            if not days:
                continue

            entry_rows = []
            exit_rows = []
            for day in days:
                entry_start = pd.Timestamp(datetime.combine(day - timedelta(days=1), cfg.entry_time), tz=cfg.timezone)
                if entry_start.weekday() == 5:
                    continue
                exit_rows.append({"day": day, "exit_time": pd.Timestamp(datetime.combine(day, cfg.exit_time), tz=cfg.timezone)})

                if cfg.mode == "single":
                    entry_rows.append({"day": day, "entry_time": entry_start})
                else:
                    entry_end = pd.Timestamp(datetime.combine(day, time(16, 0)), tz=cfg.timezone)
                    hourly_times = pd.date_range(start=entry_start, end=entry_end, freq="h")
                    for t in hourly_times:
                        entry_rows.append({"day": day, "entry_time": t})

            if not entry_rows or not exit_rows:
                continue

            entry_df = pd.DataFrame(entry_rows).sort_values("entry_time")
            exit_df = pd.DataFrame(exit_rows).sort_values("exit_time")

            entry_fills = pd.merge_asof(
                entry_df,
                price_df.rename(columns={"time": "entry_time", "open": "entry_open"}),
                on="entry_time",
                direction="forward",
            )
            exit_fills = pd.merge_asof(
                exit_df,
                price_df.rename(columns={"time": "exit_time", "close": "exit_close"}),
                on="exit_time",
                direction="backward",
            )

            entry_fills = entry_fills.dropna(subset=["entry_open"])
            exit_fills = exit_fills.dropna(subset=["exit_close"])
            if entry_fills.empty or exit_fills.empty:
                continue

            entry_fills["entry_open"] = entry_fills["entry_open"].astype(float)
            entry_group = entry_fills.groupby("day")["entry_open"].agg(["mean", "count"]).reset_index()
            entry_group = entry_group.rename(columns={"mean": "entry_open_avg", "count": "entry_count"})

            exit_fills["exit_close"] = exit_fills["exit_close"].astype(float)
            exit_group = exit_fills.groupby("day")["exit_close"].last().reset_index()

            day_df = entry_group.merge(exit_group, on="day", how="inner")
            if day_df.empty:
                continue

            for _, row in day_df.iterrows():
                day = row["day"]
                cot_dir = store.cot_direction_on(pair, day)
                if cot_dir is None:
                    continue
                direction = "long" if cot_dir == "LONG" else "short"

                entry_raw_avg = float(row["entry_open_avg"])
                exit_raw = float(row["exit_close"])
                entry_price = apply_spread_slippage(entry_raw_avg, direction, spread_pips, pip, cfg.slippage_pips, "entry")
                exit_price = apply_spread_slippage(exit_raw, direction, spread_pips, pip, cfg.slippage_pips, "exit")

                pnl_pips = (exit_price - entry_price) / pip
                if direction == "short":
                    pnl_pips = -pnl_pips

                trades.append(
                    DailyTrade(
                        pair=pair,
                        direction=direction,
                        entry_time=pd.Timestamp(datetime.combine(day - timedelta(days=1), cfg.entry_time), tz=cfg.timezone).to_pydatetime(),
                        exit_time=pd.Timestamp(datetime.combine(day, cfg.exit_time), tz=cfg.timezone).to_pydatetime(),
                        entry_price=entry_price,
                        exit_price=exit_price,
                        entry_price_raw=entry_raw_avg,
                        exit_price_raw=exit_raw,
                        pnl_pips=float(pnl_pips),
                        spread_pips=spread_pips,
                        slippage_pips=cfg.slippage_pips,
                        entry_count=int(row["entry_count"]),
                    )
                )
        elif cfg.mode == "weekly":
            sundays = [d for d in pd.date_range(start=start, end=end, freq="W-SUN").date]
            if not sundays:
                continue
            week_rows = []
            for sunday in sundays:
                entry_time = pd.Timestamp(datetime.combine(sunday, cfg.entry_time), tz=cfg.timezone)
                exit_day = sunday + timedelta(days=5)
                if exit_day > end:
                    continue
                exit_time = pd.Timestamp(datetime.combine(exit_day, cfg.exit_time), tz=cfg.timezone)
                week_rows.append({"week": exit_day, "entry_time": entry_time, "exit_time": exit_time})

            if not week_rows:
                continue

            week_df = pd.DataFrame(week_rows).sort_values("entry_time")
            entry_fills = pd.merge_asof(
                week_df[["week", "entry_time"]],
                price_df.rename(columns={"time": "entry_time", "open": "entry_open"}),
                on="entry_time",
                direction="forward",
            )
            exit_fills = pd.merge_asof(
                week_df[["week", "exit_time"]],
                price_df.rename(columns={"time": "exit_time", "close": "exit_close"}),
                on="exit_time",
                direction="backward",
            )
            entry_fills = entry_fills.dropna(subset=["entry_open"])
            exit_fills = exit_fills.dropna(subset=["exit_close"])
            if entry_fills.empty or exit_fills.empty:
                continue

            week_merged = entry_fills.merge(exit_fills, on="week", how="inner")
            for _, row in week_merged.iterrows():
                week_end = row["week"]
                cot_dir = store.cot_direction_on(pair, week_end)
                if cot_dir is None:
                    continue
                direction = "long" if cot_dir == "LONG" else "short"
                entry_raw = float(row["entry_open"])
                exit_raw = float(row["exit_close"])
                entry_price = apply_spread_slippage(entry_raw, direction, spread_pips, pip, cfg.slippage_pips, "entry")
                exit_price = apply_spread_slippage(exit_raw, direction, spread_pips, pip, cfg.slippage_pips, "exit")

                pnl_pips = (exit_price - entry_price) / pip
                if direction == "short":
                    pnl_pips = -pnl_pips

                trades.append(
                    DailyTrade(
                        pair=pair,
                        direction=direction,
                        entry_time=row["entry_time"].to_pydatetime(),
                        exit_time=row["exit_time"].to_pydatetime(),
                        entry_price=entry_price,
                        exit_price=exit_price,
                        entry_price_raw=entry_raw,
                        exit_price_raw=exit_raw,
                        pnl_pips=float(pnl_pips),
                        spread_pips=spread_pips,
                        slippage_pips=cfg.slippage_pips,
                        entry_count=1,
                    )
                )

    return trades


def write_outputs(trades: list[DailyTrade], out_dir: Path, mode: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for t in trades:
        rows.append(
            {
                "pair": t.pair,
                "direction": t.direction,
                "entry_time": t.entry_time,
                "exit_time": t.exit_time,
                "entry_price_raw": t.entry_price_raw,
                "exit_price_raw": t.exit_price_raw,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "pnl_pips": t.pnl_pips,
                "spread": t.spread_pips,
                "slippage": t.slippage_pips,
                "entry_count": t.entry_count,
            }
        )
    df = pd.DataFrame(rows)
    df.to_csv(out_dir / "daily_bias_trades.csv", index=False)

    if df.empty:
        summary = {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "mode": mode,
            "overall": {
                "trades": 0,
                "net_pips": 0.0,
                "avg_pips": 0.0,
                "win_rate": 0.0,
            },
            "daily": [],
            "by_pair": [],
            "by_month": [],
            "by_week": [],
        }
        (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return

    df["exit_time"] = pd.to_datetime(df["exit_time"], utc=True).dt.tz_convert(ET_TZ)
    df["day"] = df["exit_time"].dt.date
    if mode == "weekly":
        daily = pd.DataFrame(columns=["day", "pnl_pips"])
    else:
        daily = df.groupby("day")["pnl_pips"].sum().reset_index()
        daily["day"] = daily["day"].astype(str)

    by_pair = df.groupby("pair")["pnl_pips"].agg(["count", "sum", "mean"]).reset_index()
    if mode == "weekly":
        weekly = df.copy()
        weekly["week"] = pd.to_datetime(weekly["exit_time"]).dt.to_period("W-SUN").astype(str)
        by_week = weekly.groupby("week")["pnl_pips"].agg(["count", "sum", "mean"]).reset_index()
        by_month = weekly.copy()
        by_month["month"] = pd.to_datetime(by_month["exit_time"]).dt.to_period("M").astype(str)
        by_month = by_month.groupby("month")["pnl_pips"].agg(["count", "sum", "mean"]).reset_index()
    else:
        by_month = daily.copy()
        by_month["month"] = pd.to_datetime(by_month["day"]).dt.to_period("M").astype(str)
        by_month = by_month.groupby("month")["pnl_pips"].agg(["count", "sum", "mean"]).reset_index()
        by_week = daily.copy()
        by_week["week"] = pd.to_datetime(by_week["day"]).dt.to_period("W-SUN").astype(str)
        by_week = by_week.groupby("week")["pnl_pips"].agg(["count", "sum", "mean"]).reset_index()

    if mode == "weekly":
        wins = (by_week["sum"] > 0).sum() if not by_week.empty else 0
        win_rate = wins / len(by_week) * 100.0 if not by_week.empty else 0.0
        net_pips = float(by_week["sum"].sum()) if not by_week.empty else 0.0
        avg_pips = float(by_week["sum"].mean()) if not by_week.empty else 0.0
    else:
        wins = (daily["pnl_pips"] > 0).sum()
        win_rate = wins / len(daily) * 100.0 if len(daily) else 0.0
        net_pips = float(daily["pnl_pips"].sum()) if not daily.empty else 0.0
        avg_pips = float(daily["pnl_pips"].mean()) if not daily.empty else 0.0

    summary = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "mode": mode,
        "overall": {
            "trades": int(len(df)),
            "net_pips": net_pips,
            "avg_pips": avg_pips,
            "win_rate": float(win_rate),
        },
        "daily": daily.to_dict(orient="records"),
        "by_pair": by_pair.to_dict(orient="records"),
        "by_month": by_month.to_dict(orient="records"),
        "by_week": by_week.to_dict(orient="records"),
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Simple markdown report
    lines = []
    lines.append("# Daily Bias Backtest Report")
    lines.append("")
    lines.append("## Overall")
    lines.append(f"- Trades: {summary['overall']['trades']}")
    lines.append(f"- Net pips: {summary['overall']['net_pips']:.2f}")
    lines.append(f"- Avg pips/day: {summary['overall']['avg_pips']:.2f}")
    lines.append(f"- Win rate ({'weeks' if mode == 'weekly' else 'days'}): {summary['overall']['win_rate']:.1f}%")
    if mode == "hourly":
        lines.append("- Entry schedule: hourly adds from 18:00 ET to 16:00 ET, equal size")
    elif mode == "single":
        lines.append("- Entry schedule: single entry at 18:00 ET, exit 16:45 ET")
    else:
        lines.append("- Entry schedule: enter Sunday 18:00 ET, exit Friday 16:45 ET")
    lines.append("")
    lines.append("## By pair")
    lines.append(by_pair.to_markdown(index=False))
    lines.append("")
    lines.append("## By month")
    lines.append(by_month.to_markdown(index=False))
    lines.append("")
    lines.append("## By week")
    lines.append(by_week.to_markdown(index=False))

    (out_dir / "summary_report.md").write_text("\n".join(lines), encoding="utf-8")


def publish(out_dir: Path, publish_dir: Path) -> None:
    publish_dir.mkdir(parents=True, exist_ok=True)
    for name in ["summary.json", "summary_report.md", "daily_bias_trades.csv"]:
        src = out_dir / name
        if src.exists():
            import shutil
            shutil.copy2(src, publish_dir / name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Daily bias backtest (COT-only)")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--data-root", default="data")
    parser.add_argument("--ohlc-root", default="data/ohlc")
    parser.add_argument("--cot-path", default="data/cot_snapshot.json")
    parser.add_argument("--cot-dir", default="data/cot_snapshots")
    parser.add_argument("--pairs-source", default="src/lib/cotPairs.ts")
    parser.add_argument("--spread-path", default="data/spread_config.json")
    parser.add_argument("--default-spread", type=float, default=1.2)
    parser.add_argument("--slippage", type=float, default=0.15)
    parser.add_argument("--output-dir", default="research/scalp_bot/output_daily_bias")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--publish-dir", default="public/scalp-bot/daily_bias")
    parser.add_argument("--mode", default="hourly", choices=["single", "hourly", "weekly"])

    args = parser.parse_args()
    cfg = DailyBiasConfig(
        default_spread_pips=args.default_spread,
        slippage_pips=args.slippage,
        mode=args.mode,
    )

    trades = run_daily_bias(
        start=datetime.fromisoformat(args.start).date(),
        end=datetime.fromisoformat(args.end).date(),
        data_root=args.data_root,
        ohlc_root=args.ohlc_root,
        cot_path=args.cot_path,
        cot_dir=args.cot_dir,
        pairs_source=args.pairs_source,
        spread_path=args.spread_path,
        cfg=cfg,
    )

    out_dir = Path(args.output_dir)
    write_outputs(trades, out_dir, args.mode)

    if args.publish:
        publish(out_dir, Path(args.publish_dir))


if __name__ == "__main__":
    main()
