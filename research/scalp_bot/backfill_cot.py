from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from .pairs import load_fx_pairs_from_ts

CFTC_BASE = "https://publicreporting.cftc.gov/resource/gpe5-46if.json"

FX_MARKETS = {
    "AUD": ["AUSTRALIAN DOLLAR"],
    "CAD": ["CANADIAN DOLLAR"],
    "CHF": ["SWISS FRANC"],
    "EUR": ["EURO FX"],
    "GBP": ["BRITISH POUND"],
    "JPY": ["JAPANESE YEN"],
    "NZD": ["NZ DOLLAR"],
    "USD": ["USD INDEX"],
}


def _request_json(url: str, token: str | None) -> list[dict]:
    headers = {}
    if token:
        headers["X-App-Token"] = token
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else ""
        raise RuntimeError(f"CFTC fetch failed {exc.code}: {detail}") from exc


def list_report_dates(start: str, end: str, token: str | None) -> list[str]:
    where = (
        f"report_date_as_yyyy_mm_dd >= '{start}T00:00:00.000' AND "
        f"report_date_as_yyyy_mm_dd <= '{end}T00:00:00.000'"
    )
    params = {
        "$select": "report_date_as_yyyy_mm_dd",
        "$where": where,
        "$limit": "50000",
    }
    url = f"{CFTC_BASE}?{urlencode(params)}"
    rows = _request_json(url, token)
    dates = sorted({row["report_date_as_yyyy_mm_dd"].split("T")[0] for row in rows if row.get("report_date_as_yyyy_mm_dd")})
    return dates


def fetch_rows(report_date: str, variant: str, token: str | None) -> list[dict]:
    names = []
    for values in FX_MARKETS.values():
        names.extend(values)
    names_list = ", ".join([f"'{name.replace("'", "''")}'" for name in names])
    where = (
        f"report_date_as_yyyy_mm_dd='{report_date}T00:00:00.000' AND "
        f"futonly_or_combined='{variant}' AND contract_market_name in ({names_list})"
    )
    params = {
        "$select": "contract_market_name,report_date_as_yyyy_mm_dd,dealer_positions_long_all,dealer_positions_short_all,futonly_or_combined",
        "$where": where,
        "$limit": "500",
    }
    url = f"{CFTC_BASE}?{urlencode(params)}"
    return _request_json(url, token)


def build_snapshot(report_date: str, rows: list[dict], pair_defs) -> dict:
    markets = {}
    for currency, market_names in FX_MARKETS.items():
        row = next((r for r in rows if r.get("contract_market_name") in market_names), None)
        if not row:
            continue
        long_raw = row.get("dealer_positions_long_all")
        short_raw = row.get("dealer_positions_short_all")
        if long_raw is None or short_raw is None:
            continue
        dealer_long = int(float(long_raw))
        dealer_short = int(float(short_raw))
        dealer_net = dealer_short - dealer_long
        bias = "BULLISH" if dealer_net > 0 else "BEARISH" if dealer_net < 0 else "NEUTRAL"
        markets[currency] = {
            "dealer_long": dealer_long,
            "dealer_short": dealer_short,
            "net": dealer_net,
            "bias": bias,
        }

    pairs = {}
    for pair in pair_defs:
        base = markets.get(pair["base"])
        quote = markets.get(pair["quote"])
        if not base or not quote:
            continue
        if base["bias"] == "NEUTRAL" or quote["bias"] == "NEUTRAL":
            continue
        if base["bias"] == quote["bias"]:
            continue
        if base["bias"] == "BULLISH" and quote["bias"] == "BEARISH":
            pairs[pair["pair"]] = {
                "direction": "LONG",
                "base_bias": base["bias"],
                "quote_bias": quote["bias"],
            }
        elif base["bias"] == "BEARISH" and quote["bias"] == "BULLISH":
            pairs[pair["pair"]] = {
                "direction": "SHORT",
                "base_bias": base["bias"],
                "quote_bias": quote["bias"],
            }

    return {
        "report_date": report_date,
        "last_refresh_utc": datetime.utcnow().isoformat() + "Z",
        "currencies": markets,
        "pairs": pairs,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill COT snapshots from CFTC")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--variant", default=os.environ.get("COT_VARIANT", "FutOnly"))
    parser.add_argument("--pairs-source", default="src/lib/cotPairs.ts")
    parser.add_argument("--out-dir", default="data/cot_snapshots")
    parser.add_argument("--token", default=os.environ.get("CFTC_APP_TOKEN", ""))

    args = parser.parse_args()
    start = args.start
    end = args.end
    dates = list_report_dates(start, end, args.token or None)
    if not dates:
        raise RuntimeError("No COT report dates found for range")

    pair_defs = [
        {"pair": p.pair, "base": p.base, "quote": p.quote}
        for p in load_fx_pairs_from_ts(args.pairs_source)
    ]

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for report_date in dates:
        out_path = out_dir / f"{report_date}.json"
        if out_path.exists():
            continue
        rows = fetch_rows(report_date, args.variant, args.token or None)
        snapshot = build_snapshot(report_date, rows, pair_defs)
        out_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
