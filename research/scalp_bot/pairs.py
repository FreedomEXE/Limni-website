from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class PairDefinition:
    pair: str
    base: str
    quote: str


PAIR_LINE = re.compile(
    r"\{\s*pair:\s*\"(?P<pair>[A-Z0-9]+)\"\s*,\s*base:\s*\"(?P<base>[A-Z0-9]+)\"\s*,\s*quote:\s*\"(?P<quote>[A-Z0-9]+)\"\s*\}"
)
ASSET_BLOCK = re.compile(r"(?P<asset>[a-zA-Z]+):\s*\[")


def load_fx_pairs_from_ts(path: str) -> list[PairDefinition]:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Pairs source not found: {path}")

    content = file_path.read_text(encoding="utf-8")
    asset_match = re.search(r"fx:\s*\[([\s\S]*?)\]\s*,", content)
    if not asset_match:
        raise ValueError("Failed to locate FX pair list in cotPairs.ts")

    block = asset_match.group(1)
    pairs: list[PairDefinition] = []
    for match in PAIR_LINE.finditer(block):
        pairs.append(PairDefinition(match.group("pair"), match.group("base"), match.group("quote")))

    if not pairs:
        raise ValueError("No FX pairs parsed from cotPairs.ts")
    return pairs


def load_all_pairs_from_ts(path: str) -> list[PairDefinition]:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Pairs source not found: {path}")
    content = file_path.read_text(encoding="utf-8")
    pairs: list[PairDefinition] = []
    for match in PAIR_LINE.finditer(content):
        pairs.append(PairDefinition(match.group("pair"), match.group("base"), match.group("quote")))
    if not pairs:
        raise ValueError("No pairs parsed from cotPairs.ts")
    return pairs


def load_pairs_for_asset(path: str, asset: str) -> list[PairDefinition]:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Pairs source not found: {path}")
    content = file_path.read_text(encoding="utf-8")
    asset_match = re.search(rf"{re.escape(asset)}:\s*\[([\s\S]*?)\]\s*,", content)
    if not asset_match:
        raise ValueError(f"Failed to locate {asset} pair list in cotPairs.ts")
    block = asset_match.group(1)
    pairs: list[PairDefinition] = []
    for match in PAIR_LINE.finditer(block):
        pairs.append(PairDefinition(match.group("pair"), match.group("base"), match.group("quote")))
    if not pairs:
        raise ValueError(f"No {asset} pairs parsed from cotPairs.ts")
    return pairs


def filter_pairs(pairs: Iterable[PairDefinition], allow: Iterable[str] | None = None) -> list[PairDefinition]:
    if allow is None:
        return list(pairs)
    allow_set = {p.upper() for p in allow}
    return [p for p in pairs if p.pair in allow_set]
