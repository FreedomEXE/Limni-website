#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re

import pandas as pd


def norm_team(s: str) -> str:
    if pd.isna(s):
        return ""
    return str(s).strip().lower().replace("&", "and").replace(".", "").replace("'", "")


def split_teams_col(series: pd.Series) -> tuple[pd.Series, pd.Series]:
    left = []
    right = []
    for val in series.fillna("").astype(str):
        parts = re.split(r"\s+@\s+", val, maxsplit=1)
        if len(parts) == 2:
            left.append(parts[0].strip())
            right.append(parts[1].strip())
        else:
            left.append(val.strip())
            right.append("")
    return pd.Series(left, index=series.index), pd.Series(right, index=series.index)


def build_key(df: pd.DataFrame, date_col: str, team_a_col: str, team_b_col: str) -> pd.Series:
    a = df[team_a_col].map(norm_team)
    b = df[team_b_col].map(norm_team)
    lo = a.where(a <= b, b)
    hi = b.where(a <= b, a)
    d = pd.to_datetime(df[date_col], errors="coerce").dt.date.astype(str)
    return d + "|" + lo + "|" + hi


def ensure_team_cols(df: pd.DataFrame, team_a_col: str, team_b_col: str, teams_fallback_col: str) -> tuple[pd.DataFrame, str, str]:
    out = df.copy()
    if team_a_col in out.columns and team_b_col in out.columns:
        return out, team_a_col, team_b_col
    if teams_fallback_col not in out.columns:
        raise ValueError(f"Missing team columns: ({team_a_col}, {team_b_col}) and fallback ({teams_fallback_col}) not found.")
    a, b = split_teams_col(out[teams_fallback_col])
    out["_team_a"] = a
    out["_team_b"] = b
    return out, "_team_a", "_team_b"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bets", required=True, help="sports/ncaab/backtests/ncaab_ovr_v1/bets.csv")
    ap.add_argument("--olg", required=True, help="Your exported OLG bets CSV")
    ap.add_argument("--out", default="sports/ncaab/backtests/ncaab_ovr_v1/olg_join.csv")

    ap.add_argument("--bets_date", default="date")
    ap.add_argument("--bets_team_a", default="team_a")
    ap.add_argument("--bets_team_b", default="team_b")
    ap.add_argument("--bets_teams_col", default="teams")
    ap.add_argument("--bets_total", default="Book_total")

    ap.add_argument("--olg_date", default="date")
    ap.add_argument("--olg_team_a", default="team_a")
    ap.add_argument("--olg_team_b", default="team_b")
    ap.add_argument("--olg_teams_col", default="teams")
    ap.add_argument("--olg_total", default="book_total")
    args = ap.parse_args()

    bets = pd.read_csv(args.bets)
    olg = pd.read_csv(args.olg)

    bets, bets_team_a_col, bets_team_b_col = ensure_team_cols(
        bets, args.bets_team_a, args.bets_team_b, args.bets_teams_col
    )
    olg, olg_team_a_col, olg_team_b_col = ensure_team_cols(
        olg, args.olg_team_a, args.olg_team_b, args.olg_teams_col
    )

    bets["match_key"] = build_key(bets, args.bets_date, bets_team_a_col, bets_team_b_col)
    olg["match_key"] = build_key(olg, args.olg_date, olg_team_a_col, olg_team_b_col)

    olg = olg.sort_values(by=[args.olg_date]).drop_duplicates("match_key", keep="last")

    merged = bets.merge(olg[["match_key", args.olg_total]], on="match_key", how="left", suffixes=("", "_OLG"))

    merged["olg_missing"] = merged[args.olg_total].isna()
    merged["olg_minus_proxy"] = merged[args.olg_total] - merged[args.bets_total]

    drift = merged.loc[~merged["olg_missing"], "olg_minus_proxy"]
    stats = {
        "n_joined": int(drift.shape[0]),
        "n_missing": int(merged["olg_missing"].sum()),
        "mean_drift": float(drift.mean()) if drift.shape[0] else None,
        "median_drift": float(drift.median()) if drift.shape[0] else None,
        "p25": float(drift.quantile(0.25)) if drift.shape[0] else None,
        "p75": float(drift.quantile(0.75)) if drift.shape[0] else None,
    }

    print("OLG vs Proxy drift stats:", stats)
    merged.to_csv(args.out, index=False)
    print("Wrote:", args.out)


if __name__ == "__main__":
    main()
