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
        final_total = float(g["away_score"]) + float(g["home_score"])

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
                "final_total": final_total,
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

    # Per spec: HM_error and season standard deviation of error
    df["HM_error"] = df["final_total"] - df["HM_total"]
    sd_err = df.groupby("season")["HM_error"].std(ddof=0).rename("season_sd_error")
    p90 = df.groupby("season")["HM_total"].quantile(0.90).rename("season_P90")
    df = df.merge(sd_err, on="season", how="left").merge(p90, on="season", how="left")
    df = df[df["season_sd_error"] > 0].copy()

    # Per spec: standardized edge and entry
    df["z_edge"] = (df["HM_total"] - df["Book_total"]) / df["season_sd_error"]
    bets = df[(df["HM_total"] >= df["season_P90"]) & (df["z_edge"] >= 1.0)].copy()

    if len(bets):
        settled = bets.apply(lambda r: settle_ovr(r, v1), axis=1, result_type="expand")
        bets["result"] = settled[0]
        bets["profit_units"] = settled[1]
    else:
        bets["result"] = pd.Series(dtype=str)
        bets["profit_units"] = pd.Series(dtype=float)
    bets = bets.sort_values(["date", "teams"]).reset_index(drop=True)

    out_csv = OUT_DIR / "bets_normedge_ovr_final.csv"
    bets.to_csv(out_csv, index=False)

    eq = bets["profit_units"].cumsum().tolist() if len(bets) else []
    plt.figure(figsize=(10, 5))
    plt.plot(eq)
    plt.title("NCAAB OVR Normalized Edge Final-Test Singles Equity (Units)")
    plt.xlabel("Bet #")
    plt.ylabel("Cumulative Units")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    eq_path = OUT_DIR / "equity_singles_normedge_ovr_final.png"
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
    avg_z = float(bets["z_edge"].mean()) if bet_count else 0.0

    z = bets["z_edge"] if bet_count else pd.Series(dtype=float)
    z_dist = {
        "min": float(z.min()) if bet_count else 0.0,
        "p25": float(z.quantile(0.25)) if bet_count else 0.0,
        "median": float(z.median()) if bet_count else 0.0,
        "p75": float(z.quantile(0.75)) if bet_count else 0.0,
        "max": float(z.max()) if bet_count else 0.0,
    }

    operationally_thin = bet_count < 50
    catastrophic_dd = max_dd <= -20.0
    pass_rules = (
        (bet_count >= 50)
        and (roi > 0)
        and (post_2021_roi > 0)
        and (post_2023_roi > 0)
        and (not catastrophic_dd)
    )

    lines = [
        "# NCAAB OVR Final Test - Normalized Edge",
        "",
        "- Rules:",
        "  - HM_error = actual_total - HM_total",
        "  - season_sd_error = std(HM_error) by season",
        "  - z_edge = (HM_total - Book_total) / season_sd_error",
        "  - Entry: HM_total >= season_P90 and z_edge >= 1.0",
        "  - OVR only, singles only",
        "",
        f"- Bet count: **{bet_count}**",
        f"- Win%: **{win_pct:.2%}**",
        f"- ROI: **{roi:.2%}**",
        f"- Net units: **{net_units:.2f}u**",
        f"- Post-2021 ROI: **{post_2021_roi:.2%}**",
        f"- Post-2023 ROI: **{post_2023_roi:.2%}**",
        f"- Max drawdown: **{max_dd:.2f}u**",
        f"- Average z_edge: **{avg_z:.3f}**",
        f"- z_edge distribution (min / p25 / median / p75 / max): **{z_dist['min']:.3f} / {z_dist['p25']:.3f} / {z_dist['median']:.3f} / {z_dist['p75']:.3f} / {z_dist['max']:.3f}**",
        "",
        f"- Operational thin flag (<50 bets): **{'YES' if operationally_thin else 'NO'}**",
        f"- Catastrophic DD flag (<= -20u): **{'YES' if catastrophic_dd else 'NO'}**",
        f"- Success criteria result: **{'PASS' if pass_rules else 'FAIL'}**",
    ]

    out_md = OUT_DIR / "summary_normedge_ovr_final.md"
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote: {out_csv}")
    print(f"Wrote: {out_md}")
    print(f"Wrote: {eq_path}")


if __name__ == "__main__":
    main()
