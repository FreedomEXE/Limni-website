from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import json
import matplotlib.pyplot as plt
try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - runtime dependency
    pd = None

from .config import AccountConfig, ExecutionConfig, RiskConfig, SpreadConfig, SentimentConfig
from .execution import TradeResult


@dataclass
class StatsSummary:
    net_r: float
    profit_factor: float
    max_drawdown_r: float
    win_rate: float
    avg_r: float
    trades: int
    max_consecutive_losses: int


def trades_to_df(trades: list[TradeResult]) -> pd.DataFrame:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if not trades:
        return pd.DataFrame()
    rows = []
    for t in trades:
        rows.append(
            {
                "pair": t.pair,
                "direction": t.direction,
                "entry_time": t.entry_time,
                "entry_price_raw": t.entry_price_raw,
                "entry_price": t.entry_price,
                "stop": t.stop_price,
                "tp": t.tp_price,
                "exit_time": t.exit_time,
                "exit_price_raw": t.exit_price_raw,
                "exit_price": t.exit_price,
                "pnl_pips": t.pnl_pips,
                "pnl_r": t.pnl_r,
                "reason_exit": t.reason,
                "spread": t.spread_pips,
                "slippage": t.slippage_pips,
                "session_ref_high": t.ref_high,
                "session_ref_low": t.ref_low,
            }
        )
    df = pd.DataFrame(rows)
    df = df.sort_values("entry_time").reset_index(drop=True)
    return df


def compute_equity_curve(df: pd.DataFrame, account: AccountConfig) -> pd.DataFrame:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if df.empty:
        return pd.DataFrame()
    equity = account.starting_equity
    curve = []
    for _, row in df.iterrows():
        risk_amount = equity * (account.risk_per_trade_pct / 100.0)
        pnl = row["pnl_r"] * risk_amount
        equity += pnl
        curve.append({"time": row["exit_time"], "equity": equity, "pnl": pnl, "pnl_r": row["pnl_r"]})
    return pd.DataFrame(curve)


def compute_drawdown(curve: pd.DataFrame) -> pd.DataFrame:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if curve.empty:
        return pd.DataFrame()
    peak = curve["equity"].expanding().max()
    drawdown = curve["equity"] - peak
    dd = pd.DataFrame({"time": curve["time"], "drawdown": drawdown})
    return dd


def compute_stats(df: pd.DataFrame) -> StatsSummary:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if df.empty:
        return StatsSummary(0.0, 0.0, 0.0, 0.0, 0.0, 0, 0)

    wins = df[df["pnl_r"] > 0]
    losses = df[df["pnl_r"] < 0]
    gross_win = wins["pnl_r"].sum()
    gross_loss = losses["pnl_r"].sum()
    profit_factor = abs(gross_win / gross_loss) if gross_loss != 0 else float("inf")

    streak = 0
    max_streak = 0
    for _, row in df.iterrows():
        if row["pnl_r"] < 0:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0

    net_r = df["pnl_r"].sum()
    win_rate = len(wins) / len(df) * 100.0
    avg_r = df["pnl_r"].mean()

    curve = df["pnl_r"].cumsum()
    peak = curve.cummax()
    max_dd = (curve - peak).min()

    return StatsSummary(
        net_r=float(net_r),
        profit_factor=float(profit_factor),
        max_drawdown_r=float(max_dd),
        win_rate=float(win_rate),
        avg_r=float(avg_r),
        trades=len(df),
        max_consecutive_losses=max_streak,
    )


def plot_equity(curve: pd.DataFrame, out_path: Path) -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if curve.empty:
        return
    plt.figure(figsize=(10, 4))
    plt.plot(curve["time"], curve["equity"], color="#0b5b7f")
    plt.title("Equity Curve")
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def plot_drawdown(dd: pd.DataFrame, out_path: Path) -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if dd.empty:
        return
    plt.figure(figsize=(10, 4))
    plt.plot(dd["time"], dd["drawdown"], color="#a83333")
    plt.title("Drawdown (Equity)")
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def plot_r_hist(df: pd.DataFrame, out_path: Path) -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if df.empty:
        return
    plt.figure(figsize=(6, 4))
    plt.hist(df["pnl_r"], bins=30, color="#4b9c65", alpha=0.8)
    plt.title("R Distribution")
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def write_summary(
    df: pd.DataFrame,
    account: AccountConfig,
    execution: ExecutionConfig,
    spread: SpreadConfig,
    risk: RiskConfig,
    sentiment: SentimentConfig,
    out_path: Path,
) -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    stats = compute_stats(df)
    if df.empty:
        by_pair = pd.DataFrame(columns=["pair", "count", "sum", "mean"])
        month_stats = pd.DataFrame(columns=["month", "count", "sum", "mean"])
    else:
        by_pair = df.groupby("pair")["pnl_r"].agg(["count", "sum", "mean"]).reset_index()
        by_month = df.copy()
        by_month["month"] = df["entry_time"].dt.to_period("M").astype(str)
        month_stats = by_month.groupby("month")["pnl_r"].agg(["count", "sum", "mean"]).reset_index()

    lines = []
    lines.append("# Limni Scalp Bot Backtest Report")
    lines.append("")
    lines.append("## Assumptions")
    lines.append(f"- Spread model: default {spread.default_spread_pips:.2f} pips (per-pair overrides applied if present)")
    lines.append(f"- Slippage: {execution.slippage_pips:.2f} pips per side")
    lines.append(f"- Time stop: {risk.time_stop_session}")
    lines.append(f"- Sentiment missing policy: {sentiment.missing_policy}")
    lines.append("")
    lines.append("## Overall stats")
    lines.append(f"- Trades: {stats.trades}")
    lines.append(f"- Net R: {stats.net_r:.2f}")
    lines.append(f"- Profit factor: {stats.profit_factor:.2f}")
    lines.append(f"- Max drawdown (R): {stats.max_drawdown_r:.2f}")
    lines.append(f"- Win rate: {stats.win_rate:.1f}%")
    lines.append(f"- Avg R/trade: {stats.avg_r:.2f}")
    lines.append(f"- Max consecutive losses: {stats.max_consecutive_losses}")
    lines.append("")
    lines.append("## Stats by pair")
    lines.append(by_pair.to_markdown(index=False))
    lines.append("")
    lines.append("## Stats by month")
    lines.append(month_stats.to_markdown(index=False))
    lines.append("")
    lines.append("## Notes")
    lines.append("- Dollar PnL uses dynamic risk sizing based on account equity and R multiples.")

    out_path.write_text("\n".join(lines), encoding="utf-8")


def write_summary_json(df: pd.DataFrame, out_path: Path) -> None:
    stats = compute_stats(df)
    if df.empty:
        by_pair = pd.DataFrame(columns=["pair", "count", "sum", "mean"])
        month_stats = pd.DataFrame(columns=["month", "count", "sum", "mean"])
    else:
        by_pair = df.groupby("pair")["pnl_r"].agg(["count", "sum", "mean"]).reset_index()
        by_month = df.copy()
        by_month["month"] = df["entry_time"].dt.to_period("M").astype(str)
        month_stats = by_month.groupby("month")["pnl_r"].agg(["count", "sum", "mean"]).reset_index()

    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "overall": {
            "trades": stats.trades,
            "net_r": stats.net_r,
            "profit_factor": stats.profit_factor,
            "max_drawdown_r": stats.max_drawdown_r,
            "win_rate": stats.win_rate,
            "avg_r": stats.avg_r,
            "max_consecutive_losses": stats.max_consecutive_losses,
        },
        "by_pair": by_pair.to_dict(orient="records"),
        "by_month": month_stats.to_dict(orient="records"),
    }

    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_outputs(
    trades: list[TradeResult],
    account: AccountConfig,
    execution: ExecutionConfig,
    spread: SpreadConfig,
    risk: RiskConfig,
    sentiment: SentimentConfig,
    out_dir: Path,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    df = trades_to_df(trades)
    if df.empty:
        df = pd.DataFrame(
            columns=[
                "pair",
                "direction",
                "entry_time",
                "entry_price_raw",
                "entry_price",
                "stop",
                "tp",
                "exit_time",
                "exit_price_raw",
                "exit_price",
                "pnl_pips",
                "pnl_r",
                "reason_exit",
                "spread",
                "slippage",
                "session_ref_high",
                "session_ref_low",
            ]
        )
    df.to_csv(out_dir / "trade_list.csv", index=False)
    curve = compute_equity_curve(df, account)
    dd = compute_drawdown(curve)

    write_summary(df, account, execution, spread, risk, sentiment, out_dir / "summary_report.md")
    write_summary_json(df, out_dir / "summary.json")
    plot_equity(curve, out_dir / "equity_curve.png")
    plot_drawdown(dd, out_dir / "drawdown_curve.png")
    plot_r_hist(df, out_dir / "r_histogram.png")
