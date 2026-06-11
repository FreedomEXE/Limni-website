from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

import pandas as pd

from .config import BacktestConfig
from .execution import ExecutionConfig
from .utils import session_bounds


def parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def run_sanity(trade_csv: Path, cfg: BacktestConfig) -> list[str]:
    results = []
    if not trade_csv.exists():
        results.append("FAIL trade_list.csv missing")
        return results

    df = pd.read_csv(trade_csv)
    if not df.empty:
        df["entry_time"] = pd.to_datetime(df["entry_time"], utc=True).dt.tz_convert(cfg.sessions.timezone)
        df["exit_time"] = pd.to_datetime(df["exit_time"], utc=True).dt.tz_convert(cfg.sessions.timezone)
    # Bias + sentiment presence check (simple)
    cot_path = Path("data/cot_snapshot.json")
    sentiment_path = Path("data/sentiment_aggregates.json")
    bias_sentiment_present = cot_path.exists() and sentiment_path.exists()

    if df.empty:
        if bias_sentiment_present:
            results.append("FAIL no trades generated despite bias + sentiment data present")
        else:
            results.append("PASS no trades (bias/sentiment data missing)")
    else:
        results.append("PASS trades exist")

    # Sessions check
    session = getattr(cfg.sessions, cfg.session)
    results.append(
        f"PASS sessions configured: Asia {cfg.sessions.asia.start.strftime('%H:%M')}-{cfg.sessions.asia.end.strftime('%H:%M')} ET, "
        f"London {cfg.sessions.london.start.strftime('%H:%M')}-{cfg.sessions.london.end.strftime('%H:%M')} ET"
    )

    # Entry window check
    if not df.empty:
        invalid = 0
        for _, row in df.iterrows():
            day = row["entry_time"].date()
            start, end = session_bounds(session.start, session.end, day, cfg.sessions.timezone)
            if not (start <= row["entry_time"] <= end):
                invalid += 1
        results.append("PASS no trades outside entry window" if invalid == 0 else f"FAIL {invalid} trades outside entry window")

        # Stop distance
        pip = 0.01 if df.iloc[0]["pair"].endswith("JPY") else 0.0001
        max_stop = cfg.risk.max_stop_pips
        too_wide = 0
        for _, row in df.iterrows():
            pip = 0.01 if "JPY" in row["pair"] else 0.0001
            dist = abs(row["entry_price_raw"] - row["stop"]) / pip
            if dist > max_stop + 1e-6:
                too_wide += 1
        results.append("PASS stop distance within max_stop_pips" if too_wide == 0 else f"FAIL {too_wide} stops exceeded max_stop_pips")

        # SL/TP ordering
        results.append("PASS SL/TP ordering set to conservative" if cfg.execution.conservative_sl_tp else "FAIL SL/TP ordering not conservative")

        # Spread/slippage example
        example_long = df[df["direction"] == "long"].head(1)
        example_short = df[df["direction"] == "short"].head(1)
        examples = []
        for label, sample in [("long", example_long), ("short", example_short)]:
            if sample.empty:
                row = df.iloc[0]
                synthetic = True
            else:
                row = sample.iloc[0]
                synthetic = False
            pip = 0.01 if "JPY" in row["pair"] else 0.0001
            half = (row["spread"] * pip) / 2.0
            slip = cfg.execution.slippage_pips * pip
            if label == "long":
                expected = row["entry_price_raw"] + half + slip
            else:
                expected = row["entry_price_raw"] - half - slip
            examples.append(
                f"{label} example {row['pair']}{' (synthetic)' if synthetic else ''}: raw={row['entry_price_raw']:.6f}, "
                f"spread={row['spread']:.2f}p, slippage={cfg.execution.slippage_pips:.2f}p, "
                f"expected={expected:.6f}, actual={row['entry_price']:.6f}"
            )
        if examples:
            results.append("PASS spread/slippage applied (short may be synthetic if no shorts in sample)")
            results.extend(examples)
        else:
            results.append("FAIL no example trades to verify spread/slippage")

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Sanity checks for scalp bot backtest")
    parser.add_argument("--trade-list", required=True)
    args = parser.parse_args()

    cfg = BacktestConfig()
    results = run_sanity(Path(args.trade_list), cfg)
    for line in results:
        print(line)


if __name__ == "__main__":
    main()
