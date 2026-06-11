#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import importlib.util
import sys
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "sports" / "ncaab" / "backtests" / "ncaab_ovr_v1"
SEASON_END_CUTOFF = dt.date(2025, 4, 10)
MAX_SNAPSHOT_AGE_DAYS = 14.0


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module at {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    return mod


def season_days(season: int) -> list[dt.date]:
    start = dt.date(season - 1, 11, 1)
    end = min(dt.date(season, 4, 10), SEASON_END_CUTOFF)
    out = []
    d = start
    while d <= end:
        out.append(d)
        d += dt.timedelta(days=1)
    return out


def settle_ovr(final_total: float, book_total: float, odds: float, v1) -> tuple[str, float]:
    if final_total > book_total:
        return ("W", v1.american_to_decimal(odds) - 1.0)
    if final_total < book_total:
        return ("L", -1.0)
    return ("P", 0.0)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    v1 = load_module(ROOT / "sports" / "ncaab" / "scripts" / "backtest_ncaab_ovr_v1.py", "ncaab_v1")
    sb = load_module(ROOT / "sports" / "ncaab" / "scripts" / "backtest_ncaab_season_baseline_ovr.py", "ncaab_sb")

    snapshots = sorted(v1.load_snapshot_index(), key=lambda s: s.timestamp)
    if not snapshots:
        raise RuntimeError("No Haslametrics snapshots loaded.")

    seasons = sorted(v1.TOURNEY_WINDOWS.keys())
    all_days: list[dt.date] = []
    for season in seasons:
        all_days.extend(season_days(season))
    all_days = sorted(set(all_days))

    raw_games: list[dict] = []
    spread_rows: list[dict] = []
    for day in all_days:
        raw_games.extend(sb.fetch_day_with_retry(day, v1))
        spread_rows.extend(sb.fetch_sbr_spread_day(day))
    if not raw_games:
        raise RuntimeError("No SBR games loaded.")
    spread_map = {(r["date"], r["away"], r["home"]): r for r in spread_rows}

    season_totals = []
    for g in raw_games:
        game_date = dt.date.fromisoformat(g["date"])
        season = v1.season_from_date(game_date)
        final_total = float(g["away_score"]) + float(g["home_score"])
        season_totals.append({"season": season, "final_total": final_total})
    season_avg_total = pd.DataFrame(season_totals).groupby("season")["final_total"].mean().to_dict()

    rows: list[dict] = []
    for g in raw_games:
        start_date = g.get("startDate")
        if not start_date:
            continue
        game_dt = dt.datetime.fromisoformat(start_date.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
        valid = [s for s in snapshots if s.timestamp <= game_dt]
        if not valid:
            continue
        snap = valid[-1]
        snapshot_age_days = (game_dt - snap.timestamp).total_seconds() / 86400.0

        game_date = dt.date.fromisoformat(g["date"])
        season = v1.season_from_date(game_date)
        tournament_flag = int(v1.is_tourney_flag(game_date, neutral_guess=True))
        site = 0 if tournament_flag else 1
        proj = v1.hm_project_total(snap, home_team=g["home"], away_team=g["away"], site=site)
        if proj is None:
            continue
        hm_home, hm_away = proj
        hm_total = float(hm_home + hm_away)

        book_total = float(g["book_total"])
        final_total = float(g["away_score"]) + float(g["home_score"])
        avg_total = float(season_avg_total.get(season, float("nan")))
        if pd.isna(avg_total):
            continue
        edge_points = hm_total - book_total

        spread_info = spread_map.get((g["date"], g["away"], g["home"]), {})
        home_spread = spread_info.get("home_spread_consensus")
        home_favorite = bool(spread_info.get("home_favorite", False))

        odds = float(g["over_odds"]) if g.get("over_odds") is not None else float(v1.DEFAULT_ODDS)

        rows.append(
            {
                "date": g["date"],
                "teams": f'{g["away"]} @ {g["home"]}',
                "season": season,
                "tournament_flag": tournament_flag,
                "HM_total": hm_total,
                "Book_total": book_total,
                "season_avg_total": avg_total,
                "edge_points": edge_points,
                "home_spread": home_spread,
                "home_favorite": home_favorite,
                "final_total": final_total,
                "odds": odds,
                "snapshot_age_days": snapshot_age_days,
            }
        )

    df = pd.DataFrame(rows)
    if df.empty:
        raise RuntimeError("No matched games after joins.")

    # Strategy v1:
    # - OVR only
    # - Book_total above season scoring baseline
    # - HM edge >= 5
    # - Home is not favorite (away favorite / pick context)
    # - Regular season only
    bets = df[
        (df["Book_total"] > df["season_avg_total"])
        & (df["edge_points"] >= 5.0)
        & (df["home_favorite"] == False)
        & (df["tournament_flag"] == 0)
        & (df["snapshot_age_days"] <= MAX_SNAPSHOT_AGE_DAYS)
    ].copy()

    if bets.empty:
        bets["result"] = pd.Series(dtype=str)
        bets["profit_units"] = pd.Series(dtype=float)
    else:
        settled = bets.apply(
            lambda r: settle_ovr(float(r["final_total"]), float(r["Book_total"]), float(r["odds"]), v1),
            axis=1,
            result_type="expand",
        )
        bets["result"] = settled[0]
        bets["profit_units"] = settled[1]
    bets = bets.sort_values(["date", "teams"]).reset_index(drop=True)

    out_cols = [
        "date",
        "teams",
        "season",
        "HM_total",
        "Book_total",
        "season_avg_total",
        "edge_points",
        "home_spread",
        "home_favorite",
        "snapshot_age_days",
        "final_total",
        "result",
        "profit_units",
    ]
    out_csv = OUT_DIR / "bets_road_fav_ovr_v1.csv"
    bets[out_cols].to_csv(out_csv, index=False)

    bet_count = int(len(bets))
    win_pct = float((bets["result"] == "W").mean()) if bet_count else 0.0
    net_units = float(bets["profit_units"].sum()) if bet_count else 0.0
    roi = (net_units / bet_count) if bet_count else 0.0

    post_2021 = bets[bets["season"] >= 2022]
    post_2023 = bets[bets["season"] >= 2024]
    post_2021_roi = (
        float(post_2021["profit_units"].sum()) / float(len(post_2021)) if len(post_2021) else 0.0
    )
    post_2023_roi = (
        float(post_2023["profit_units"].sum()) / float(len(post_2023)) if len(post_2023) else 0.0
    )
    equity = bets["profit_units"].cumsum().tolist() if bet_count else []
    max_drawdown = float(v1.max_drawdown(equity)) if equity else 0.0

    season_counts = bets.groupby("season").size().to_dict() if bet_count else {}
    avg_bets_per_season = float(bets.groupby("season").size().mean()) if bet_count else 0.0
    season_stats = (
        bets.groupby("season")
        .agg(
            bets=("result", "size"),
            wins=("result", lambda s: int((s == "W").sum())),
            units=("profit_units", "sum"),
        )
        .reset_index()
        if bet_count
        else pd.DataFrame(columns=["season", "bets", "wins", "units"])
    )
    if len(season_stats):
        season_stats["win_pct"] = season_stats["wins"] / season_stats["bets"]
        season_stats["roi"] = season_stats["units"] / season_stats["bets"]

    avg_home_spread = float(bets["home_spread"].mean()) if bet_count else 0.0
    spread_abs = float(bets["home_spread"].abs().mean()) if bet_count else 0.0
    snapshot_mean = float(bets["snapshot_age_days"].mean()) if bet_count else 0.0
    snapshot_median = float(bets["snapshot_age_days"].median()) if bet_count else 0.0
    snapshot_p95 = float(bets["snapshot_age_days"].quantile(0.95)) if bet_count else 0.0
    edge_q = {
        "min": float(bets["edge_points"].min()) if bet_count else 0.0,
        "p25": float(bets["edge_points"].quantile(0.25)) if bet_count else 0.0,
        "median": float(bets["edge_points"].median()) if bet_count else 0.0,
        "p75": float(bets["edge_points"].quantile(0.75)) if bet_count else 0.0,
        "max": float(bets["edge_points"].max()) if bet_count else 0.0,
    }

    lines = [
        "# NCAA Road-Favorite Context OVR v1 (Freshness-Gated)",
        "",
        "Rules:",
        "- Bet OVER when all are true:",
        "  - Book_total > season_avg_total",
        "  - edge_points = HM_total - Book_total >= 5.0",
        "  - home_favorite == False",
        "  - tournament_flag == 0",
        f"  - snapshot_age_days <= {MAX_SNAPSHOT_AGE_DAYS}",
        "",
        f"- Total bet count: **{bet_count}**",
        f"- Win%: **{win_pct:.2%}**",
        f"- ROI: **{roi:.2%}**",
        f"- Net units: **{net_units:.2f}u**",
        f"- Post-2021 ROI: **{post_2021_roi:.2%}**",
        f"- Post-2023 ROI: **{post_2023_roi:.2%}**",
        f"- Max drawdown: **{max_drawdown:.2f}u**",
        f"- Average edge_points: **{float(bets['edge_points'].mean()) if bet_count else 0.0:.3f}**",
        f"- edge_points distribution (min / p25 / median / p75 / max): **{edge_q['min']:.3f} / {edge_q['p25']:.3f} / {edge_q['median']:.3f} / {edge_q['p75']:.3f} / {edge_q['max']:.3f}**",
        f"- Average Book_total: **{float(bets['Book_total'].mean()) if bet_count else 0.0:.3f}**",
        f"- Average season_avg_total: **{float(bets['season_avg_total'].mean()) if bet_count else 0.0:.3f}**",
        f"- Average home_spread (home side): **{avg_home_spread:.3f}**",
        f"- Average abs(home_spread): **{spread_abs:.3f}**",
        f"- Snapshot age mean/median/p95 (days): **{snapshot_mean:.2f} / {snapshot_median:.2f} / {snapshot_p95:.2f}**",
        f"- Average bets per season: **{avg_bets_per_season:.2f}**",
        f"- Operationally thin (<50 bets): **{'YES' if bet_count < 50 else 'NO'}**",
        "",
        "## Bet Count Per Season",
    ]
    if season_counts:
        for season in sorted(season_counts.keys()):
            lines.append(f"- {season}: **{int(season_counts[season])}**")
    else:
        lines.append("- No bets.")

    lines.append("")
    lines.append("## Season-by-Season")
    if len(season_stats):
        for _, r in season_stats.sort_values("season").iterrows():
            lines.append(
                f"- {int(r['season'])}: bets={int(r['bets'])}, win%={r['win_pct']:.2%}, ROI={r['roi']:.2%}, units={r['units']:.2f}"
            )
    else:
        lines.append("- No bets.")

    out_md = OUT_DIR / "summary_road_fav_ovr_v1.md"
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote: {out_csv}")
    print(f"Wrote: {out_md}")


if __name__ == "__main__":
    main()
