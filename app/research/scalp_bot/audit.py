from __future__ import annotations

from pathlib import Path
import random

import matplotlib.pyplot as plt
try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - runtime dependency
    pd = None

from .config import BacktestConfig, DataConfig
from .data_sources import load_ohlcv, localize_df


def _plot_candles(df: pd.DataFrame, ref_high: float, ref_low: float, out_path: Path, title: str) -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    plt.figure(figsize=(10, 4))
    for idx, row in df.iterrows():
        color = "#2f7f5e" if row["close"] >= row["open"] else "#b23b3b"
        plt.plot([idx, idx], [row["low"], row["high"]], color=color, linewidth=1)
        plt.plot([idx, idx], [row["open"], row["close"]], color=color, linewidth=4)
    plt.axhline(ref_high, color="#1e5aa8", linestyle="--", linewidth=1)
    plt.axhline(ref_low, color="#1e5aa8", linestyle="--", linewidth=1)
    plt.title(title)
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def run_audit(
    trades_df: pd.DataFrame,
    data_cfg: DataConfig,
    cfg: BacktestConfig,
    sample_size: int,
    out_dir: Path,
) -> None:
    if pd is None:
        raise RuntimeError("pandas is required. Install research/scalp_bot/requirements.txt")
    if trades_df.empty:
        return

    out_dir.mkdir(parents=True, exist_ok=True)
    trades = trades_df.sample(min(sample_size, len(trades_df)), random_state=42)

    for idx, row in trades.iterrows():
        pair = row["pair"]
        try:
            df = load_ohlcv(pair, cfg.timeframe, data_cfg.ohlc_root, data_cfg.data_root)
        except (FileNotFoundError, ValueError):
            continue
        df = localize_df(df, cfg.sessions.timezone)
        entry_time = row["entry_time"]
        window = df[(df["time"] >= entry_time - pd.Timedelta(hours=6)) & (df["time"] <= entry_time + pd.Timedelta(hours=6))]
        if window.empty:
            continue
        title = f"{pair} {row['direction']} {entry_time}"
        _plot_candles(window.reset_index(drop=True), row["session_ref_high"], row["session_ref_low"], out_dir / f"audit_{pair}_{idx}.png", title)
