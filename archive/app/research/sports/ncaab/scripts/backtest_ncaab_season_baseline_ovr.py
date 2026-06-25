#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import importlib.util
import json
import re
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "sports" / "ncaab" / "backtests" / "ncaab_ovr_v1"
SEASON_END_CUTOFF = dt.date(2025, 4, 10)
SBR_SPREAD_CACHE = OUT_DIR / "cache" / "sbr_spreads"


def load_v1_module():
    mod_path = ROOT / "sports" / "ncaab" / "scripts" / "backtest_ncaab_ovr_v1.py"
    spec = importlib.util.spec_from_file_location("backtest_ncaab_ovr_v1", mod_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load backtest_ncaab_ovr_v1 module.")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    return mod


def season_days(season: int) -> list[dt.date]:
    start = dt.date(season - 1, 11, 1)
    end = min(dt.date(season, 4, 10), SEASON_END_CUTOFF)
    days = []
    d = start
    while d <= end:
        days.append(d)
        d += dt.timedelta(days=1)
    return days


def settle_ovr(final_total: float, book_total: float, odds: float, v1) -> tuple[str, float]:
    if final_total > book_total:
        return ("W", v1.american_to_decimal(odds) - 1.0)
    if final_total < book_total:
        return ("L", -1.0)
    return ("P", 0.0)


def fetch_day_with_retry(day: dt.date, v1, retries: int = 8) -> list[dict]:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            return v1.fetch_sbr_day(day)
        except Exception as err:
            last_err = err
            time.sleep(min(2 ** attempt, 30))
    if last_err is not None:
        raise last_err
    return []


def fetch_sbr_spread_day(day: dt.date, retries: int = 8) -> list[dict]:
    SBR_SPREAD_CACHE.mkdir(parents=True, exist_ok=True)
    cache_file = SBR_SPREAD_CACHE / f"{day.isoformat()}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    last_err: Exception | None = None
    url = f"https://www.sportsbookreview.com/betting-odds/ncaa-basketball/?date={day.isoformat()}"
    for attempt in range(retries):
        try:
            req = Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; LimniResearchBot/1.0)",
                    "Accept": "*/*",
                },
            )
            with urlopen(req, timeout=60) as resp:
                html = resp.read().decode("utf-8", "ignore")
            m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
            if not m:
                cache_file.write_text("[]", encoding="utf-8")
                return []
            payload = json.loads(m.group(1))
            odds_tables = payload.get("props", {}).get("pageProps", {}).get("oddsTables", [])
            if not odds_tables:
                cache_file.write_text("[]", encoding="utf-8")
                return []
            rows = odds_tables[0].get("oddsTableModel", {}).get("gameRows", [])

            out = []
            for row in rows:
                gv = row.get("gameView", {})
                away = gv.get("awayTeam", {}).get("name")
                home = gv.get("homeTeam", {}).get("name")
                if not away or not home:
                    continue
                home_spreads = []
                away_spreads = []
                for ov in row.get("oddsViews", []):
                    cl = ov.get("currentLine", {}) if ov else {}
                    hs = cl.get("homeSpread")
                    aw = cl.get("awaySpread")
                    if hs is not None:
                        home_spreads.append(float(hs))
                    if aw is not None:
                        away_spreads.append(float(aw))
                if not home_spreads and not away_spreads:
                    continue
                home_spread_consensus = (
                    float(pd.Series(home_spreads).median()) if home_spreads else float("nan")
                )
                away_spread_consensus = (
                    float(pd.Series(away_spreads).median()) if away_spreads else float("nan")
                )
                out.append(
                    {
                        "date": day.isoformat(),
                        "away": away,
                        "home": home,
                        "home_spread_consensus": home_spread_consensus,
                        "away_spread_consensus": away_spread_consensus,
                        "home_favorite": bool(home_spread_consensus < 0.0) if not pd.isna(home_spread_consensus) else False,
                    }
                )

            cache_file.write_text(json.dumps(out), encoding="utf-8")
            return out
        except Exception as err:
            last_err = err
            time.sleep(min(2 ** attempt, 30))

    if last_err is not None:
        raise last_err
    return []


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    v1 = load_v1_module()
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
        raw_games.extend(fetch_day_with_retry(day, v1))
        spread_rows.extend(fetch_sbr_spread_day(day))
    if not raw_games:
        raise RuntimeError("No SBR games loaded.")
    spread_df = pd.DataFrame(spread_rows)
    spread_map: dict[tuple[str, str, str], dict] = {}
    if not spread_df.empty:
        for r in spread_df.to_dict("records"):
            spread_map[(r["date"], r["away"], r["home"])] = r

    season_totals_rows: list[dict] = []
    for g in raw_games:
        game_date = dt.date.fromisoformat(g["date"])
        season = v1.season_from_date(game_date)
        final_total = float(g["away_score"]) + float(g["home_score"])
        season_totals_rows.append({"season": season, "final_total": final_total})
    season_totals_df = pd.DataFrame(season_totals_rows)
    season_avg_total = (
        season_totals_df.groupby("season")["final_total"].mean().rename("season_avg_total").to_dict()
    )

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

        game_date = dt.date.fromisoformat(g["date"])
        season = v1.season_from_date(game_date)
        tournament_flag = v1.is_tourney_flag(game_date, neutral_guess=True)
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
        odds = float(g["over_odds"]) if g.get("over_odds") is not None else float(v1.DEFAULT_ODDS)
        spread_info = spread_map.get((g["date"], g["away"], g["home"]), {})
        home_spread_consensus = spread_info.get("home_spread_consensus")
        home_favorite = bool(spread_info.get("home_favorite", False))

        rows.append(
            {
                "date": g["date"],
                "teams": f'{g["away"]} @ {g["home"]}',
                "season": season,
                "HM_total": hm_total,
                "Book_total": book_total,
                "season_avg_total": avg_total,
                "edge_points": edge_points,
                "final_total": final_total,
                "odds": odds,
                "home_spread_consensus": home_spread_consensus,
                "home_favorite": home_favorite,
            }
        )

    df = pd.DataFrame(rows)
    if df.empty:
        raise RuntimeError("No games matched snapshots for projection.")

    bets = df[
        (df["Book_total"] < df["season_avg_total"])
        & (df["edge_points"] >= 5.0)
        & (df["home_favorite"] == True)
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
        "final_total",
        "result",
        "profit_units",
    ]
    out_csv = OUT_DIR / "bets_season_baseline_ovr_home_fav.csv"
    bets[out_cols].to_csv(out_csv, index=False)

    bet_count = int(len(bets))
    wins = int((bets["result"] == "W").sum()) if bet_count else 0
    win_pct = (wins / bet_count) if bet_count else 0.0
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

    avg_edge = float(bets["edge_points"].mean()) if bet_count else 0.0
    avg_book_total = float(bets["Book_total"].mean()) if bet_count else 0.0
    avg_season_avg_total = float(bets["season_avg_total"].mean()) if bet_count else 0.0

    season_counts = bets.groupby("season").size().to_dict() if bet_count else {}
    avg_bets_per_season = float(bets.groupby("season").size().mean()) if bet_count else 0.0

    viable = (
        bet_count >= 50
        and roi > 0
        and post_2021_roi > 0
        and post_2023_roi > 0
        and max_drawdown > -20.0
    )
    strategy_status = "ROBUST" if viable else "NON-ROBUST (archive)"

    lines = [
        "# NCAA Season Baseline Gated OVR Backtest",
        "",
        f"- Total bet count: **{bet_count}**",
        f"- Win%: **{win_pct:.2%}**",
        f"- ROI: **{roi:.2%}**",
        f"- Net units: **{net_units:.2f}u**",
        f"- Post-2021 ROI: **{post_2021_roi:.2%}**",
        f"- Post-2023 ROI: **{post_2023_roi:.2%}**",
        f"- Max drawdown: **{max_drawdown:.2f}u**",
        f"- Average edge_points: **{avg_edge:.3f}**",
        f"- Average Book_total: **{avg_book_total:.3f}**",
        f"- Average season_avg_total: **{avg_season_avg_total:.3f}**",
        f"- Average bets per season: **{avg_bets_per_season:.2f}**",
        "",
        "## Bet Count Per Season",
    ]

    if season_counts:
        for season in sorted(season_counts.keys()):
            lines.append(f"- {season}: **{int(season_counts[season])}**")
    else:
        lines.append("- No bets.")

    lines.extend(
        [
            "",
            "## Viability Check",
            f"- Minimum 50 bets: **{'PASS' if bet_count >= 50 else 'FAIL'}**",
            f"- Positive overall ROI: **{'PASS' if roi > 0 else 'FAIL'}**",
            f"- Positive post-2021 ROI: **{'PASS' if post_2021_roi > 0 else 'FAIL'}**",
            f"- Positive post-2023 ROI: **{'PASS' if post_2023_roi > 0 else 'FAIL'}**",
            f"- No catastrophic DD (> -20u): **{'PASS' if max_drawdown > -20.0 else 'FAIL'}**",
            f"- Strategy status: **{strategy_status}**",
        ]
    )

    out_md = OUT_DIR / "summary_season_baseline_ovr_home_fav.md"
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote: {out_csv}")
    print(f"Wrote: {out_md}")


if __name__ == "__main__":
    main()
