"""Build data/atlas.json from the runs recorded on Qollab (data/runs/*.json).

Runs are saved compact (per-card counts, a few rounds as arrays); this expands
them and recomputes every statistic from the counts with nosig.play.summarize,
so the atlas and a live run use the same numbers."""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from nosig.play import summarize, classical_win  # noqa: E402

ORDER = ["forte-enterprise-1", "forte-1", "aria-1", "aria-2", "ibm", "braket", "ideal"]


def bits(v, n):
    return [(v >> (n - 1 - k)) & 1 for k in range(n)]


def won(game, cards, ans):
    """The referee's rule, from the cards and the answers alone."""
    if game == "chsh":
        return int((ans[0] ^ ans[1]) == (cards[0] & cards[1]))
    if game == "ghz":
        return int(sum(ans) % 2 == (0 if not any(cards) else 1))
    r, c = cards
    alice, bob = ans
    return int(alice[c] == bob[r] and sum(alice) % 2 == 0 and sum(bob) % 2 == 1)


def decode(game, s):
    """Rounds packed by the page's recorder: one hex digit per Telepathy round
    (cards, answers), two base-36 digits per Three of a kind or Magic square round."""
    out = []
    if game == "chsh":
        for ch in s:
            v = int(ch, 16)
            cards, ans = bits(v >> 2, 2), bits(v & 3, 2)
            out.append([cards, ans])
    else:
        for i in range(0, len(s), 2):
            v = int(s[i:i + 2], 36)
            if game == "ghz":
                out.append([bits(v >> 3, 3), bits(v & 7, 3)])
            else:
                k = v >> 6
                out.append([[k // 3, k % 3], [bits((v >> 3) & 7, 3), bits(v & 7, 3)]])
    return [[c, a, won(game, c, a), classical_win(game, tuple(c))] for c, a in out]


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
        if isinstance(rs, str):
            rs = decode(g, rs)
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
