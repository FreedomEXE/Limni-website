#!/usr/bin/env python3
from __future__ import annotations

import csv
import datetime as dt
import json
import math
import re
import statistics
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import brotli
import matplotlib.pyplot as plt
import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "sports" / "ncaab" / "backtests" / "ncaab_ovr_v1"
CACHE_DIR = OUT_DIR / "cache"
HASLA_CACHE = CACHE_DIR / "haslametrics"
SBR_CACHE = CACHE_DIR / "sbr_totals"
OUT_DIR.mkdir(parents=True, exist_ok=True)
HASLA_CACHE.mkdir(parents=True, exist_ok=True)
SBR_CACHE.mkdir(parents=True, exist_ok=True)

RATE_LIMIT_SECONDS = 0.30
HM_VARIANT = "TD_ratings.xml_wayback_snapshot_formula"
BOOK_TOTAL_SOURCE = "CONSENSUS_PROXY"
DEFAULT_ODDS = -110.0

TOURNEY_WINDOWS = {
    2022: (dt.date(2022, 3, 15), dt.date(2022, 4, 4)),
    2023: (dt.date(2023, 3, 14), dt.date(2023, 4, 3)),
    2024: (dt.date(2024, 3, 19), dt.date(2024, 4, 8)),
    2025: (dt.date(2025, 3, 18), dt.date(2025, 4, 7)),
}


def http_get(url: str) -> tuple[bytes, dict[str, str]]:
    last_err: Exception | None = None
    for attempt in range(6):
        try:
            req = Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; LimniResearchBot/1.0)",
                    "Accept": "*/*",
                },
            )
            with urlopen(req, timeout=60) as resp:
                data = resp.read()
                headers = {k.lower(): v for k, v in resp.getheaders()}
            time.sleep(RATE_LIMIT_SECONDS)
            return data, headers
        except HTTPError as e:
            last_err = e
            if e.code not in (429, 500, 502, 503, 504):
                raise
        except URLError as e:
            last_err = e
        time.sleep(min(2 ** attempt, 30))
    if last_err is not None:
        raise last_err
    raise RuntimeError(f"Failed request: {url}")


def maybe_decode_brotli(raw: bytes, headers: dict[str, str]) -> bytes:
    encoding = headers.get("content-encoding", "").lower()
    if "br" in encoding:
        return brotli.decompress(raw)
    if raw.startswith(b"<?xml") or raw.startswith(b"<!DOCTYPE"):
        return raw
    try:
        return brotli.decompress(raw)
    except Exception:
        return raw


def normalize_team(name: str) -> str:
    x = name.lower()
    x = x.replace("&", " and ")
    x = x.replace("st.", "state")
    x = x.replace("st ", "state ")
    x = x.replace("saint", "stateint")
    x = re.sub(r"[^a-z0-9]+", "", x)
    x = x.replace("stateint", "saint")
    aliases = {
        "mississippistate": "msstate",
        "michiganstate": "michiganstate",
        "brighamyoung": "byu",
        "connecticut": "uconn",
        "ncarolina": "northcarolina",
        "sflorida": "southflorida",
        "uncwilmington": "uncw",
        "calstatefullerton": "csufullerton",
        "calstatebakersfield": "csub",
        "loyolachicago": "loyolachi",
        "miamifl": "miamiflorida",
        "miamioh": "miamiohio",
    }
    return aliases.get(x, x)


def season_from_date(d: dt.date) -> int:
    return d.year + 1 if d.month >= 11 else d.year


def is_tourney_flag(game_date: dt.date, neutral_guess: bool) -> bool:
    season = season_from_date(game_date)
    if season not in TOURNEY_WINDOWS:
        return False
    start, end = TOURNEY_WINDOWS[season]
    return start <= game_date <= end and neutral_guess


def american_to_decimal(odds: float) -> float:
    if odds > 0:
        return 1.0 + (odds / 100.0)
    return 1.0 + (100.0 / abs(odds))


@dataclass
class Snapshot:
    timestamp: dt.datetime
    xml_path: Path
    av: dict[str, float]
    ha: dict[str, float]
    teams: dict[str, dict[str, float]]
    season: int


def parse_float(attrs: dict[str, Any], key: str) -> float:
    try:
        return float(attrs.get(key, "0") or 0.0)
    except Exception:
        return 0.0


def parse_snapshot_xml(path: Path, timestamp: dt.datetime) -> Snapshot | None:
    root = ET.parse(path).getroot()
    av_el = root.find("av")
    ha_el = root.find("ha")
    if av_el is None or ha_el is None:
        return None

    dt_el = root.find("dt")
    season = timestamp.year
    if dt_el is not None and "md" in dt_el.attrib:
        try:
            md = dt.datetime.strptime(dt_el.attrib["md"], "%B %d, %Y").date()
            season = season_from_date(md)
        except Exception:
            pass

    teams: dict[str, dict[str, float]] = {}
    for mr in root.findall("mr"):
        attrs = mr.attrib
        t = attrs.get("t", "").strip()
        if not t:
            continue
        teams[normalize_team(t)] = dict(attrs)
        teams[normalize_team(attrs.get("a", t))] = teams[normalize_team(t)]

    return Snapshot(
        timestamp=timestamp,
        xml_path=path,
        av={k: float(v) for k, v in av_el.attrib.items()},
        ha={k: float(v) for k, v in ha_el.attrib.items()},
        teams=teams,
        season=season,
    )


def hm_project_total(snapshot: Snapshot, home_team: str, away_team: str, site: int) -> tuple[float, float] | None:
    k1 = normalize_team(home_team)
    k2 = normalize_team(away_team)
    if k1 not in snapshot.teams or k2 not in snapshot.teams:
        return None
    t1 = snapshot.teams[k1]
    t2 = snapshot.teams[k2]
    av = snapshot.av
    ha = snapshot.ha

    def v(d: dict[str, float], key: str) -> float:
        return float(d.get(key, 0.0))

    # Team 1 (home/listed second in Hasla UI)
    upc1 = v(av, "u") + (v(t1, "ou") - v(av, "u")) + (v(t2, "du") - v(av, "u"))
    if site == 1:
        upc1 += v(ha, "u") / 2.0

    temp = (
        v(av, "tpmrb")
        + (v(t1, "otpmrb") - v(av, "tpmrb"))
        + (v(t2, "dtpmrb") - v(av, "tpmrb"))
        + v(av, "tpmrsc")
        + (v(t1, "otpmrsc") - v(av, "tpmrsc"))
        + (v(t2, "dtpmrsc") - v(av, "tpmrsc"))
        + v(av, "tpmrsd")
        + (v(t1, "otpmrsd") - v(av, "tpmrsd"))
        + (v(t2, "dtpmrsd") - v(av, "tpmrsd"))
    )
    if site == 1:
        temp += (v(ha, "tpmrb") + v(ha, "tpmrsc") + v(ha, "tpmrsd")) / 2.0
    temp = max(0.0, temp)
    ts = 3.0 * (upc1 * temp / 100.0)

    temp = (
        v(av, "npmrb")
        + (v(t1, "onpmrb") - v(av, "npmrb"))
        + (v(t2, "dnpmrb") - v(av, "npmrb"))
        + v(av, "npmrsc")
        + (v(t1, "onpmrsc") - v(av, "npmrsc"))
        + (v(t2, "dnpmrsc") - v(av, "npmrsc"))
        + v(av, "npmrsd")
        + (v(t1, "onpmrsd") - v(av, "npmrsd"))
        + (v(t2, "dnpmrsd") - v(av, "npmrsd"))
        + v(av, "fpmrb")
        + (v(t1, "ofpmrb") - v(av, "fpmrb"))
        + (v(t2, "dfpmrb") - v(av, "fpmrb"))
        + v(av, "fpmrsc")
        + (v(t1, "ofpmrsc") - v(av, "fpmrsc"))
        + (v(t2, "dfpmrsc") - v(av, "fpmrsc"))
        + v(av, "fpmrsd")
        + (v(t1, "ofpmrsd") - v(av, "fpmrsd"))
        + (v(t2, "dfpmrsd") - v(av, "fpmrsd"))
    )
    if site == 1:
        temp += (
            v(ha, "npmrb")
            + v(ha, "npmrsc")
            + v(ha, "npmrsd")
            + v(ha, "fpmrb")
            + v(ha, "fpmrsc")
            + v(ha, "fpmrsd")
        ) / 2.0
    temp = max(0.0, temp)
    ts += 2.0 * (upc1 * temp / 100.0)

    temp = (
        v(av, "ftarb")
        + (v(t1, "oftarb") - v(av, "ftarb"))
        + (v(t2, "dftarb") - v(av, "ftarb"))
        + v(av, "ftarsc")
        + (v(t1, "oftarsc") - v(av, "ftarsc"))
        + (v(t2, "dftarsc") - v(av, "ftarsc"))
        + v(av, "ftarsd")
        + (v(t1, "oftarsd") - v(av, "ftarsd"))
        + (v(t2, "dftarsd") - v(av, "ftarsd"))
    )
    if site == 1:
        temp += (v(ha, "ftarb") + v(ha, "ftarsc") + v(ha, "ftarsd")) / 2.0
    temp = max(0.0, temp)
    ts += (v(t1, "ftpct") / 100.0) * (upc1 * temp / 100.0)

    # Team 2 (away/listed first in Hasla UI)
    upc2 = v(av, "u") + (v(t2, "ou") - v(av, "u")) + (v(t1, "du") - v(av, "u"))
    if site == 1:
        upc2 -= v(ha, "u") / 2.0

    temp = (
        v(av, "tpmrb")
        + (v(t2, "otpmrb") - v(av, "tpmrb"))
        + (v(t1, "dtpmrb") - v(av, "tpmrb"))
        + v(av, "tpmrsc")
        + (v(t2, "otpmrsc") - v(av, "tpmrsc"))
        + (v(t1, "dtpmrsc") - v(av, "tpmrsc"))
        + v(av, "tpmrsd")
        + (v(t2, "otpmrsd") - v(av, "tpmrsd"))
        + (v(t1, "dtpmrsd") - v(av, "tpmrsd"))
    )
    if site == 1:
        temp -= (v(ha, "tpmrb") + v(ha, "tpmrsc") + v(ha, "tpmrsd")) / 2.0
    temp = max(0.0, temp)
    os = 3.0 * (upc2 * temp / 100.0)

    temp = (
        v(av, "npmrb")
        + (v(t2, "onpmrb") - v(av, "npmrb"))
        + (v(t1, "dnpmrb") - v(av, "npmrb"))
        + v(av, "npmrsc")
        + (v(t2, "onpmrsc") - v(av, "npmrsc"))
        + (v(t1, "dnpmrsc") - v(av, "npmrsc"))
        + v(av, "npmrsd")
        + (v(t2, "onpmrsd") - v(av, "npmrsd"))
        + (v(t1, "dnpmrsd") - v(av, "npmrsd"))
        + v(av, "fpmrb")
        + (v(t2, "ofpmrb") - v(av, "fpmrb"))
        + (v(t1, "dfpmrb") - v(av, "fpmrb"))
        + v(av, "fpmrsc")
        + (v(t2, "ofpmrsc") - v(av, "fpmrsc"))
        + (v(t1, "dfpmrsc") - v(av, "fpmrsc"))
        + v(av, "fpmrsd")
        + (v(t2, "ofpmrsd") - v(av, "fpmrsd"))
        + (v(t1, "dfpmrsd") - v(av, "fpmrsd"))
    )
    if site == 1:
        temp -= (
            v(ha, "npmrb")
            + v(ha, "npmrsc")
            + v(ha, "npmrsd")
            + v(ha, "fpmrb")
            + v(ha, "fpmrsc")
            + v(ha, "fpmrsd")
        ) / 2.0
    temp = max(0.0, temp)
    os += 2.0 * (upc2 * temp / 100.0)

    temp = (
        v(av, "ftarb")
        + (v(t2, "oftarb") - v(av, "ftarb"))
        + (v(t1, "dftarb") - v(av, "ftarb"))
        + v(av, "ftarsc")
        + (v(t2, "oftarsc") - v(av, "ftarsc"))
        + (v(t1, "dftarsc") - v(av, "ftarsc"))
        + v(av, "ftarsd")
        + (v(t2, "oftarsd") - v(av, "ftarsd"))
        + (v(t1, "dftarsd") - v(av, "ftarsd"))
    )
    if site == 1:
        temp -= (v(ha, "ftarb") + v(ha, "ftarsc") + v(ha, "ftarsd")) / 2.0
    temp = max(0.0, temp)
    os += (v(t2, "ftpct") / 100.0) * (upc2 * temp / 100.0)

    return (ts, os)


def load_snapshot_index() -> list[Snapshot]:
    local_xml = sorted(HASLA_CACHE.glob("*.xml"))
    if local_xml:
        snapshots: list[Snapshot] = []
        for xml_path in local_xml:
            ts_txt = xml_path.stem
            if not re.fullmatch(r"\d{14}", ts_txt):
                continue
            ts_dt = dt.datetime.strptime(ts_txt, "%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc)
            parsed = parse_snapshot_xml(xml_path, ts_dt)
            if parsed is not None and parsed.teams:
                snapshots.append(parsed)
        if snapshots:
            return sorted(snapshots, key=lambda s: s.timestamp)

    cdx_url = (
        "https://web.archive.org/cdx/search/cdx?"
        "url=haslametrics.com/ratings.xml*&output=json&fl=timestamp,original,statuscode"
        "&filter=statuscode:200&from=20220101&to=20250415"
    )
    cdx_cache = HASLA_CACHE / "cdx_ratings_2022_2025.json"
    if cdx_cache.exists():
        rows = json.loads(cdx_cache.read_text(encoding="utf-8"))
    else:
        raw, _ = http_get(cdx_url)
        rows = json.loads(raw.decode("utf-8", "ignore"))[1:]
        cdx_cache.write_text(json.dumps(rows), encoding="utf-8")
    by_day: dict[str, tuple[str, str]] = {}
    for ts, original, _ in rows:
        by_day[ts[:8]] = (ts, original)
    dedup = sorted(by_day.values(), key=lambda x: x[0])

    snapshots: list[Snapshot] = []
    for ts, original in dedup:
        xml_path = HASLA_CACHE / f"{ts}.xml"
        if not xml_path.exists():
            memento_url = f"https://web.archive.org/web/{ts}id_/{quote(original, safe=':/?&=%')}"
            raw_xml, headers = http_get(memento_url)
            xml_bytes = maybe_decode_brotli(raw_xml, headers)
            if not xml_bytes.startswith(b"<?xml"):
                continue
            xml_path.write_bytes(xml_bytes)
        ts_dt = dt.datetime.strptime(ts, "%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc)
        parsed = parse_snapshot_xml(xml_path, ts_dt)
        if parsed is not None and parsed.teams:
            snapshots.append(parsed)
    return snapshots


def daterange(start: dt.date, end: dt.date):
    d = start
    while d <= end:
        yield d
        d += dt.timedelta(days=1)


def fetch_sbr_day(day: dt.date) -> list[dict[str, Any]]:
    cache_file = SBR_CACHE / f"{day.isoformat()}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    url = f"https://www.sportsbookreview.com/betting-odds/ncaa-basketball/totals/full-game/?date={day.isoformat()}"
    raw, _ = http_get(url)
    html = raw.decode("utf-8", "ignore")
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
    games: list[dict[str, Any]] = []

    for row in rows:
        gv = row.get("gameView", {})
        away = gv.get("awayTeam", {}).get("name")
        home = gv.get("homeTeam", {}).get("name")
        if not away or not home:
            continue
        scores_ok = gv.get("awayTeamScore") is not None and gv.get("homeTeamScore") is not None
        if not scores_ok:
            continue

        totals = []
        odds_rows = []
        for ov in row.get("oddsViews", []):
            if not ov:
                continue
            cl = ov.get("currentLine", {})
            total = cl.get("total")
            if total is None:
                continue
            over_odds = cl.get("overOdds")
            totals.append(float(total))
            odds_rows.append((float(total), float(over_odds) if over_odds is not None else None))
        if not totals:
            continue

        book_total = statistics.median(totals)
        closest = sorted(odds_rows, key=lambda x: abs(x[0] - book_total))
        over_odds = None
        for _, oo in closest:
            if oo is not None:
                over_odds = oo
                break

        games.append(
            {
                "date": day.isoformat(),
                "startDate": gv.get("startDate"),
                "away": away,
                "home": home,
                "away_score": float(gv.get("awayTeamScore", 0)),
                "home_score": float(gv.get("homeTeamScore", 0)),
                "book_total": float(book_total),
                "over_odds": over_odds,
                "venue": gv.get("venueName"),
                "city": gv.get("city"),
                "state": gv.get("state"),
            }
        )
    cache_file.write_text(json.dumps(games), encoding="utf-8")
    return games


def max_drawdown(equity: list[float]) -> float:
    peak = -10**9
    mdd = 0.0
    for x in equity:
        peak = max(peak, x)
        mdd = min(mdd, x - peak)
    return mdd


def write_equity(path: Path, title: str, y: list[float], x_label: str) -> None:
    plt.figure(figsize=(10, 5))
    plt.plot(y)
    plt.title(title)
    plt.xlabel(x_label)
    plt.ylabel("Cumulative Units")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(path, dpi=140)
    plt.close()


def settle_row(row: pd.Series) -> tuple[str, float]:
    side = row["bet_side"]
    final_total = float(row["final_total"])
    book_total = float(row["Book_total"])
    odds = float(row["odds"])

    if side == "OVR":
        if final_total > book_total:
            return ("W", american_to_decimal(odds) - 1.0)
        if final_total < book_total:
            return ("L", -1.0)
        return ("P", 0.0)

    if final_total < book_total:
        return ("W", american_to_decimal(odds) - 1.0)
    if final_total > book_total:
        return ("L", -1.0)
    return ("P", 0.0)


def mode_parlays(df_mode: pd.DataFrame) -> pd.DataFrame:
    if df_mode.empty:
        return pd.DataFrame(columns=["date", "legs", "profit_units", "hit"])
    parlay_rows = []
    for d, grp in df_mode.groupby("date"):
        legs = len(grp)
        if legs == 0:
            continue
        has_loss = (grp["result"] == "L").any()
        all_push = (grp["result"] == "P").all()
        if all_push:
            profit = 0.0
            hit = 0
        elif has_loss:
            profit = -1.0
            hit = 0
        else:
            decs = [american_to_decimal(float(x)) for x in grp.loc[grp["result"] != "P", "odds"].tolist()]
            profit = (math.prod(decs) - 1.0) if decs else 0.0
            hit = 1 if decs else 0
        parlay_rows.append({"date": d, "legs": legs, "profit_units": profit, "hit": hit})
    return pd.DataFrame(parlay_rows).sort_values("date").reset_index(drop=True)


def build_mode_summary(mode_name: str, df_mode: pd.DataFrame, parlay_df: pd.DataFrame) -> tuple[list[str], dict[str, float]]:
    singles_equity = df_mode["profit_units"].cumsum().tolist() if not df_mode.empty else []
    parlay_equity = parlay_df["profit_units"].cumsum().tolist() if not parlay_df.empty else []

    singles_win = (df_mode["result"] == "W").mean() if len(df_mode) else 0.0
    singles_roi = df_mode["profit_units"].sum() / len(df_mode) if len(df_mode) else 0.0
    singles_units = float(df_mode["profit_units"].sum()) if len(df_mode) else 0.0
    singles_mdd = max_drawdown(singles_equity) if singles_equity else 0.0

    parlay_roi = parlay_df["profit_units"].sum() / len(parlay_df) if len(parlay_df) else 0.0
    parlay_hit = parlay_df["hit"].mean() if len(parlay_df) else 0.0
    parlay_units = float(parlay_df["profit_units"].sum()) if len(parlay_df) else 0.0
    parlay_mdd = max_drawdown(parlay_equity) if parlay_equity else 0.0
    avg_legs = parlay_df["legs"].mean() if len(parlay_df) else 0.0
    longest_losing = 0
    run = 0
    for x in parlay_df["profit_units"].tolist():
        if x < 0:
            run += 1
            longest_losing = max(longest_losing, run)
        else:
            run = 0

    post_2021 = df_mode[df_mode["season"] >= 2022]
    post_2023 = df_mode[df_mode["season"] >= 2024]
    post_2021_roi = post_2021["profit_units"].sum() / len(post_2021) if len(post_2021) else 0.0
    post_2023_roi = post_2023["profit_units"].sum() / len(post_2023) if len(post_2023) else 0.0

    season_stats = (
        df_mode.groupby("season")
        .agg(bets=("result", "size"), wins=("result", lambda s: (s == "W").sum()), units=("profit_units", "sum"))
        .reset_index()
        if len(df_mode)
        else pd.DataFrame(columns=["season", "bets", "wins", "units"])
    )
    if len(season_stats):
        season_stats["win_pct"] = season_stats["wins"] / season_stats["bets"]
        season_stats["roi"] = season_stats["units"] / season_stats["bets"]

    split_stats = (
        df_mode.groupby("tournament_flag")
        .agg(bets=("result", "size"), wins=("result", lambda s: (s == "W").sum()), units=("profit_units", "sum"))
        .reset_index()
        if len(df_mode)
        else pd.DataFrame(columns=["tournament_flag", "bets", "wins", "units"])
    )
    if len(split_stats):
        split_stats["win_pct"] = split_stats["wins"] / split_stats["bets"]
        split_stats["roi"] = split_stats["units"] / split_stats["bets"]

    lines = [
        f"# NCAAB OVR/UNDR v1 - {mode_name}",
        "",
        f"- Bet count: **{len(df_mode)}**",
        "",
        "## Singles",
        f"- Win%: **{singles_win:.2%}**",
        f"- ROI: **{singles_roi:.2%}**",
        f"- Net units: **{singles_units:.2f}u**",
        f"- Post-2021 ROI: **{post_2021_roi:.2%}**",
        f"- Post-2023 ROI: **{post_2023_roi:.2%}**",
        f"- Max drawdown: **{singles_mdd:.2f}u**",
        "",
        "## Daily All-Legs Parlay",
        f"- Days with at least one leg: **{len(parlay_df)}**",
        f"- Average legs/day: **{avg_legs:.2f}**",
        f"- Parlay hit rate: **{parlay_hit:.2%}**",
        f"- ROI (1u/day): **{parlay_roi:.2%}**",
        f"- Net units (1u/day): **{parlay_units:.2f}u**",
        f"- Net dollars ($5/day): **${(parlay_units*5):.2f}**",
        f"- Longest parlay losing streak: **{longest_losing} days**",
        f"- Max drawdown: **{parlay_mdd:.2f}u**",
        "",
        "## Tournament vs Regular (Singles)",
    ]

    if len(split_stats):
        for _, r in split_stats.sort_values("tournament_flag", ascending=False).iterrows():
            lbl = "Tournament window" if int(r["tournament_flag"]) == 1 else "Regular/Other"
            lines.append(
                f"- {lbl}: bets={int(r['bets'])}, win%={r['win_pct']:.2%}, ROI={r['roi']:.2%}, units={r['units']:.2f}"
            )
    else:
        lines.append("- No bets.")

    lines.append("")
    lines.append("## Season-by-Season (Singles)")
    if len(season_stats):
        for _, r in season_stats.sort_values("season").iterrows():
            lines.append(
                f"- {int(r['season'])-1}-{str(int(r['season']))[-2:]}: bets={int(r['bets'])}, win%={r['win_pct']:.2%}, ROI={r['roi']:.2%}, units={r['units']:.2f}"
            )
    else:
        lines.append("- No bets.")

    metrics = {
        "bet_count": float(len(df_mode)),
        "singles_roi": float(singles_roi),
        "post_2021_roi": float(post_2021_roi),
        "post_2023_roi": float(post_2023_roi),
    }
    return lines, metrics


def main() -> None:
    snapshots = load_snapshot_index()
    if not snapshots:
        raise RuntimeError("No Haslametrics snapshots loaded from Wayback.")
    snapshots = sorted(snapshots, key=lambda s: s.timestamp)

    # Build candidate day universe:
    # 1) full NCAA Tournament windows (primary scope)
    # 2) 8-day windows after each snapshot in-season (secondary regular/conference sample)
    all_days: set[dt.date] = set()
    for _, (start, end) in TOURNEY_WINDOWS.items():
        for d in daterange(start, end):
            all_days.add(d)

    season_cutoff = dt.date(2025, 4, 10)
    for snap in snapshots:
        start = snap.timestamp.date()
        if start > season_cutoff:
            continue
        if start.month not in [11, 12, 1, 2, 3, 4]:
            continue
        end = min(start + dt.timedelta(days=7), season_cutoff)
        for d in daterange(start, end):
            all_days.add(d)

    games: list[dict[str, Any]] = []
    for day in sorted(all_days):
        games.extend(fetch_sbr_day(day))

    rows: list[dict[str, Any]] = []
    for g in games:
        game_dt = dt.datetime.fromisoformat(g["startDate"].replace("Z", "+00:00"))
        game_dt = game_dt.astimezone(dt.timezone.utc)
        valid = [s for s in snapshots if s.timestamp <= game_dt]
        if not valid:
            continue
        snap = valid[-1]

        neutral_guess = g["date"] >= "2022-03-01" and g["city"] is not None and g["state"] is not None and (g["date"][5:7] in ["03", "04"])
        game_date = dt.date.fromisoformat(g["date"])
        tournament_flag = is_tourney_flag(game_date, neutral_guess=True)
        neutral = 1 if tournament_flag else 0
        site = 0 if neutral == 1 else 1

        proj = hm_project_total(snap, home_team=g["home"], away_team=g["away"], site=site)
        if proj is None:
            continue
        hm_home, hm_away = proj
        hm_total = hm_home + hm_away
        final_total = g["away_score"] + g["home_score"]
        season = season_from_date(game_date)
        odds = g["over_odds"] if g["over_odds"] is not None else DEFAULT_ODDS

        rows.append(
            {
                "date": g["date"],
                "teams": f'{g["away"]} @ {g["home"]}',
                "neutral": neutral,
                "tournament_flag": int(tournament_flag),
                "hm_variant": HM_VARIANT,
                "HM_total": hm_total,
                "Book_total_source": BOOK_TOTAL_SOURCE,
                "Book_total": g["book_total"],
                "odds": odds,
                "final_total": final_total,
                "season": season,
            }
        )

    df = pd.DataFrame(rows)
    if df.empty:
        raise RuntimeError("No matched games after joining snapshots + SBR lines.")

    p90 = df.groupby("season")["HM_total"].quantile(0.90).rename("season_P90")
    p10 = df.groupby("season")["HM_total"].quantile(0.10).rename("season_P10")
    df = df.merge(p90, on="season", how="left").merge(p10, on="season", how="left")
    df["over_edge"] = df["HM_total"] - df["Book_total"]
    df["under_edge"] = df["Book_total"] - df["HM_total"]

    ovr_df = df[(df["HM_total"] >= df["season_P90"]) & (df["over_edge"] >= 5.0)].copy()
    ovr_df["bet_side"] = "OVR"
    ovr_df["edge"] = ovr_df["over_edge"]

    undr_df = df[(df["HM_total"] <= df["season_P10"]) & (df["under_edge"] >= 5.0)].copy()
    undr_df["bet_side"] = "UNDR"
    undr_df["edge"] = undr_df["under_edge"]

    qualified = pd.concat([ovr_df, undr_df], ignore_index=True)
    if qualified.empty:
        raise RuntimeError("No qualified bets for OVR/UNDR directional symmetry test.")

    settled = qualified.apply(settle_row, axis=1, result_type="expand")
    qualified["result"] = settled[0]
    qualified["profit_units"] = settled[1]
    qualified = qualified.sort_values(["date", "bet_side", "teams"]).reset_index(drop=True)

    bets_path = OUT_DIR / "bets.csv"
    cols = [
        "date",
        "teams",
        "bet_side",
        "neutral",
        "tournament_flag",
        "hm_variant",
        "HM_total",
        "season_P90",
        "season_P10",
        "Book_total",
        "edge",
        "odds",
        "result",
        "final_total",
        "profit_units",
        "Book_total_source",
        "season",
    ]
    qualified[cols].to_csv(bets_path, index=False, quoting=csv.QUOTE_MINIMAL)

    mode_frames = {
        "OVR": qualified[qualified["bet_side"] == "OVR"].copy(),
        "UNDR": qualified[qualified["bet_side"] == "UNDR"].copy(),
        "COMBINED": qualified.copy(),
    }

    mode_metrics: dict[str, dict[str, float]] = {}
    for mode, frame in mode_frames.items():
        parlay_df = mode_parlays(frame)
        singles_equity = frame["profit_units"].cumsum().tolist() if not frame.empty else []
        parlay_equity = parlay_df["profit_units"].cumsum().tolist() if not parlay_df.empty else []

        write_equity(
            OUT_DIR / f"equity_singles_{mode.lower()}.png",
            f"NCAAB OVR/UNDR v1 {mode} Singles Equity (Units)",
            singles_equity,
            "Bet #",
        )
        write_equity(
            OUT_DIR / f"equity_parlays_{mode.lower()}.png",
            f"NCAAB OVR/UNDR v1 {mode} Daily All-Legs Parlay Equity (Units)",
            parlay_equity,
            "Day #",
        )

        lines, metrics = build_mode_summary(mode, frame, parlay_df)
        mode_metrics[mode] = metrics
        (OUT_DIR / f"summary_{mode.lower()}.md").write_text("\n".join(lines), encoding="utf-8")

    ovr_persistent = (
        mode_metrics["OVR"]["singles_roi"] > 0
        and mode_metrics["OVR"]["post_2021_roi"] > 0
        and mode_metrics["OVR"]["post_2023_roi"] > 0
    )
    undr_persistent = (
        mode_metrics["UNDR"]["singles_roi"] > 0
        and mode_metrics["UNDR"]["post_2021_roi"] > 0
        and mode_metrics["UNDR"]["post_2023_roi"] > 0
    )

    if ovr_persistent or undr_persistent:
        verdict = "FLAG FOR REFINEMENT"
    else:
        verdict = "NON-ROBUST"

    master_lines = [
        "# NCAAB OVR/UNDR v1 - Directional Symmetry Test",
        "",
        f"- Total qualified bets (OVR + UNDR): **{len(qualified)}**",
        f"- OVR bet count: **{int(mode_metrics['OVR']['bet_count'])}**",
        f"- UNDR bet count: **{int(mode_metrics['UNDR']['bet_count'])}**",
        f"- Book total source: **{BOOK_TOTAL_SOURCE}**",
        f"- HM variant: **{HM_VARIANT}**",
        "",
        "## Success Criteria Check",
        f"- OVR persistent positive singles (post-2021 and post-2023): **{'YES' if ovr_persistent else 'NO'}**",
        f"- UNDR persistent positive singles (post-2021 and post-2023): **{'YES' if undr_persistent else 'NO'}**",
        f"- Strategy verdict: **{verdict}**",
        "",
        "## Mode Summaries",
        "- OVR-only: `sports/ncaab/backtests/ncaab_ovr_v1/summary_ovr.md`",
        "- UNDR-only: `sports/ncaab/backtests/ncaab_ovr_v1/summary_undr.md`",
        "- Combined (OVR + UNDR): `sports/ncaab/backtests/ncaab_ovr_v1/summary_combined.md`",
    ]
    (OUT_DIR / "summary.md").write_text("\n".join(master_lines), encoding="utf-8")

    print(f"Wrote: {bets_path}")
    print(f"Wrote: {OUT_DIR / 'summary.md'}")
    print(f"Wrote: {OUT_DIR / 'summary_ovr.md'}")
    print(f"Wrote: {OUT_DIR / 'summary_undr.md'}")
    print(f"Wrote: {OUT_DIR / 'summary_combined.md'}")
    print(f"Wrote: {OUT_DIR / 'equity_singles_ovr.png'}")
    print(f"Wrote: {OUT_DIR / 'equity_singles_undr.png'}")
    print(f"Wrote: {OUT_DIR / 'equity_singles_combined.png'}")
    print(f"Wrote: {OUT_DIR / 'equity_parlays_ovr.png'}")
    print(f"Wrote: {OUT_DIR / 'equity_parlays_undr.png'}")
    print(f"Wrote: {OUT_DIR / 'equity_parlays_combined.png'}")


if __name__ == "__main__":
    main()
