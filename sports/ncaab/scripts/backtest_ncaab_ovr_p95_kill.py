#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import importlib.util
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "sports" / "ncaab" / "backtests" / "ncaab_ovr_v1"


def load_v1_module():
    mod_path = ROOT / "sports" / "ncaab" / "scripts" / "backtest_ncaab_ovr_v1.py"
    spec = importlib.util.spec_from_file_location("backtest_ncaab_ovr_v1", mod_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load backtest_ncaab_ovr_v1 module.")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    return mod


def build_base_dataframe(v1) -> pd.DataFrame:
    snapshots = sorted(v1.load_snapshot_index(), key=lambda s: s.timestamp)
    if not snapshots:
        raise RuntimeError("No snapshots loaded.")

    all_days: set[dt.date] = set()
    for _, (start, end) in v1.TOURNEY_WINDOWS.items():
        d = start
        while d <= end:
            all_days.add(d)
            d += dt.timedelta(days=1)

    season_cutoff = dt.date(2025, 4, 10)
    for snap in snapshots:
        start = snap.timestamp.date()
        if start > season_cutoff:
            continue
        if start.month not in [11, 12, 1, 2, 3, 4]:
            continue
        end = min(start + dt.timedelta(days=7), season_cutoff)
        d = start
        while d <= end:
            all_days.add(d)
            d += dt.timedelta(days=1)

    games = []
    for day in sorted(all_days):
        games.extend(v1.fetch_sbr_day(day))

    rows = []
    for g in games:
        game_dt = dt.datetime.fromisoformat(g["startDate"].replace("Z", "+00:00")).astimezone(dt.timezone.utc)
        valid = [s for s in snapshots if s.timestamp <= game_dt]
        if not valid:
            continue
        snap = valid[-1]

        game_date = dt.date.fromisoformat(g["date"])
        tournament_flag = v1.is_tourney_flag(game_date, neutral_guess=True)
        neutral = 1 if tournament_flag else 0
        site = 0 if neutral == 1 else 1

        proj = v1.hm_project_total(snap, home_team=g["home"], away_team=g["away"], site=site)
        if proj is None:
            continue
        hm_home, hm_away = proj
        hm_total = hm_home + hm_away

        rows.append(
            {
                "date": g["date"],
                "teams": f'{g["away"]} @ {g["home"]}',
                "neutral": neutral,
                "tournament_flag": int(tournament_flag),
                "hm_variant": v1.HM_VARIANT,
                "HM_total": hm_total,
                "Book_total_source": v1.BOOK_TOTAL_SOURCE,
                "Book_total": float(g["book_total"]),
                "odds": float(g["over_odds"]) if g["over_odds"] is not None else float(v1.DEFAULT_ODDS),
                "final_total": float(g["away_score"]) + float(g["home_score"]),
                "season": v1.season_from_date(game_date),
            }
        )

    df = pd.DataFrame(rows)
    if df.empty:
        raise RuntimeError("No matched games.")
    return df


def settle_ovr(row: pd.Series, v1):
    if row["final_total"] > row["Book_total"]:
        return ("W", v1.american_to_decimal(float(row["odds"])) - 1.0)
    if row["final_total"] < row["Book_total"]:
        return ("L", -1.0)
    return ("P", 0.0)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    v1 = load_v1_module()
    df = build_base_dataframe(v1)

    p95 = df.groupby("season")["HM_total"].quantile(0.95).rename("season_P95")
    df = df.merge(p95, on="season", how="left")
    df["edge"] = df["HM_total"] - df["Book_total"]

    bets = df[(df["HM_total"] >= df["season_P95"]) & (df["edge"] >= 5.0)].copy()
    settled = bets.apply(lambda r: settle_ovr(r, v1), axis=1, result_type="expand")
    bets["result"] = settled[0]
    bets["profit_units"] = settled[1]
    bets = bets.sort_values(["date", "teams"]).reset_index(drop=True)

    out_csv = OUT_DIR / "bets_p95_ovr_kill.csv"
    bets.to_csv(out_csv, index=False)

    eq = bets["profit_units"].cumsum().tolist() if len(bets) else []
    plt.figure(figsize=(10, 5))
    plt.plot(eq)
    plt.title("NCAAB OVR P95 Kill-Test Singles Equity (Units)")
    plt.xlabel("Bet #")
    plt.ylabel("Cumulative Units")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    eq_path = OUT_DIR / "equity_singles_p95_ovr_kill.png"
    plt.savefig(eq_path, dpi=140)
    plt.close()

    bet_count = len(bets)
    win_pct = (bets["result"] == "W").mean() if bet_count else 0.0
    roi = bets["profit_units"].sum() / bet_count if bet_count else 0.0
    net_units = bets["profit_units"].sum() if bet_count else 0.0
    post_2021 = bets[bets["season"] >= 2022]
    post_2023 = bets[bets["season"] >= 2024]
    post_2021_roi = post_2021["profit_units"].sum() / len(post_2021) if len(post_2021) else 0.0
    post_2023_roi = post_2023["profit_units"].sum() / len(post_2023) if len(post_2023) else 0.0
    max_dd = v1.max_drawdown(eq) if eq else 0.0

    edge_stats = {}
    if bet_count:
        e = bets["edge"]
        edge_stats = {
            "mean": float(e.mean()),
            "median": float(e.median()),
            "std": float(e.std(ddof=0)),
            "min": float(e.min()),
            "p25": float(e.quantile(0.25)),
            "p75": float(e.quantile(0.75)),
            "max": float(e.max()),
        }
    avg_hm_total = float(bets["HM_total"].mean()) if bet_count else 0.0

    split = (
        bets.groupby("tournament_flag")
        .agg(bets=("result", "size"), wins=("result", lambda s: (s == "W").sum()), units=("profit_units", "sum"))
        .reset_index()
        if bet_count
        else pd.DataFrame(columns=["tournament_flag", "bets", "wins", "units"])
    )
    if len(split):
        split["win_pct"] = split["wins"] / split["bets"]
        split["roi"] = split["units"] / split["bets"]

    lines = [
        "# NCAAB OVR P95 Kill-Test",
        "",
        "- Rules:",
        "  - HM_total >= season_P95",
        "  - HM_total - Book_total >= 5.0",
        "  - OVR only",
        "",
        f"- Bet count: **{bet_count}**",
        f"- Win%: **{win_pct:.2%}**",
        f"- ROI: **{roi:.2%}**",
        f"- Net units: **{net_units:.2f}u**",
        f"- Post-2021 ROI: **{post_2021_roi:.2%}**",
        f"- Post-2023 ROI: **{post_2023_roi:.2%}**",
        f"- Max drawdown: **{max_dd:.2f}u**",
        "",
        "## Operational Diagnostics",
        f"- Average edge: **{edge_stats.get('mean', 0.0):.2f}**",
        f"- Average HM_total: **{avg_hm_total:.2f}**",
        f"- Edge distribution (min / p25 / median / p75 / max): **{edge_stats.get('min', 0.0):.2f} / {edge_stats.get('p25', 0.0):.2f} / {edge_stats.get('median', 0.0):.2f} / {edge_stats.get('p75', 0.0):.2f} / {edge_stats.get('max', 0.0):.2f}**",
    ]

    lines.append("")
    lines.append("## Tournament vs Regular (Singles)")
    if len(split):
        for _, r in split.sort_values("tournament_flag", ascending=False).iterrows():
            lbl = "Tournament window" if int(r["tournament_flag"]) == 1 else "Regular/Other"
            lines.append(
                f"- {lbl}: bets={int(r['bets'])}, win%={r['win_pct']:.2%}, ROI={r['roi']:.2%}, units={r['units']:.2f}"
            )
    else:
        lines.append("- No bets.")

    out_md = OUT_DIR / "summary_p95_ovr_kill.md"
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote: {out_csv}")
    print(f"Wrote: {out_md}")
    print(f"Wrote: {eq_path}")


if __name__ == "__main__":
    main()
