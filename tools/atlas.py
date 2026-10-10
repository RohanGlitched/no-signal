"""Build data/atlas.json from the runs recorded on Qollab (data/runs/*.json).

Runs are saved compact (per-card counts, a few rounds as arrays); this expands
them and recomputes every statistic from the counts with nosig.play.summarize,
so the atlas and a live run use the same numbers."""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from nosig.play import summarize  # noqa: E402

ORDER = ["forte-enterprise-1", "forte-1", "aria-1", "aria-2", "ibm", "braket", "ideal"]


def expand(run):
    games = {}
    for g, s in run["games"].items():
        cards = s["cards"]
        if cards and isinstance(cards[0], list) and len(cards[0]) == 3 and isinstance(cards[0][0], list):
            per = {tuple(c): [w, n] for c, w, n in cards}
        else:
            per = {tuple(c["cards"]): [c["wins"], c["rounds"]] for c in cards}
        out = summarize(g, per)
        assert abs(out["win"] - s["win"]) < 1e-9, (run["profile"]["label"], g, out["win"], s["win"])
        games[g] = out
    rounds = {}
    for g, rs in run.get("rounds", {}).items():
        rounds[g] = [r if isinstance(r, dict) else
                     {"cards": r[0], "answers": r[1], "win": r[2], "classical": r[3]} for r in rs]
    return {**run, "games": games, "rounds": rounds, "recorded": True}


def rank(run):
    p = run["profile"]
    key = p["model"] if p["model"] in ORDER else p["family"]
    return (ORDER.index(key) if key in ORDER else len(ORDER), p["label"])


def main():
    root = os.path.join(os.path.dirname(__file__), "..", "data")
    runs = [expand(json.load(open(f, encoding="utf-8"))) for f in sorted(glob.glob(os.path.join(root, "runs", "*.json")))]
    runs.sort(key=rank)
    with open(os.path.join(root, "atlas.json"), "w", encoding="utf-8") as f:
        json.dump({"runs": runs}, f, separators=(",", ":"))
    for r in runs:
        g = r["games"]
        print(f'{r["profile"]["label"]:<40}' + "  ".join(
            f'{k} {v["win"]*100:5.1f}% ({v["sigma"]:.0f} sd)' for k, v in g.items()))


if __name__ == "__main__":
    main()
