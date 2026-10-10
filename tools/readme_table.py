"""Rewrite the README results table from data/atlas.json."""
import json
import math
import os
import re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
atlas = json.load(open(os.path.join(root, "data", "atlas.json"), encoding="utf-8"))
Q = math.cos(math.pi / 8) ** 2


def cell(s, sig=True):
    if not s:
        return "—"
    out = f'{s["win"] * 100:.1f}%'
    if sig and s["win"] < 1:
        out += f' ({s["sigma"]:.0f} SE)' if s["sigma"] < 100 else " (>100 SE)"
    return out


rows = ["| Machine | Telepathy (75%) | S (≤ 2 classical) | Three of a kind (75%) | Magic square (88.9%) |",
        "|---|---|---|---|---|"]
for r in atlas["runs"]:
    g = r["games"]
    c = g.get("chsh")
    ms = cell(g.get("ms"))
    if g.get("ms") and g["ms"]["covered"] < 9:
        ms += f' ({g["ms"]["covered"]} of 9 pairs)'
    rows.append(f'| {r["profile"]["label"]} | {cell(c)} | {c["S"]:.2f} ± {1.96 * c["S_se"]:.2f} | {cell(g.get("ghz"))} | {ms} |'
                if c else f'| {r["profile"]["label"]} | — | — | {cell(g.get("ghz"))} | {ms} |')
rows.append("| *ideal (theory)* | 85.4% | 2.83 | 100% | 100% |")
table = "\n".join(rows)
p = os.path.join(root, "README.md")
s = open(p, encoding="utf-8").read()
s = re.sub(r"\| Machine \| Telepathy.*?\n(?=\n)", table + "\n", s, count=1, flags=re.S)
open(p, "w", encoding="utf-8").write(s)
print(table)
