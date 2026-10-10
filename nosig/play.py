"""One play: build the circuits for the machine picked in Qollab's dialog, send
one job, and score every round of every game. Returns JSON for the page."""

from __future__ import annotations

import json
import math
import random
import time

from .games import (CHSH_CARDS, GHZ_CARDS, MS_CARDS, CLASSICAL, QUANTUM, BEST_ANGLES, BEST_GHZ,
                    SIZES, plan, circuits, score, bits_of)

Z95 = 1.959963984540054


def profile(backend) -> dict:
    name = str(getattr(backend, "name", "") or "")
    low = name.lower()
    cls = type(backend).__name__
    try:
        nq = int(getattr(backend, "num_qubits", None) or 0) or None
    except Exception:
        nq = None
    nm = ""
    try:
        nm = str(getattr(backend.options, "noise_model", "") or "")
    except Exception:
        pass
    p = {"name": name, "noise_model": nm.splitlines()[0][:80] if nm else ""}
    if "ionq" in low or "ionq" in cls.lower():
        hardware = "qpu" in low
        key = next((k for k in ("forte-enterprise-1", "forte-1", "aria-2", "aria-1") if k in nm.lower() or k in low), "ideal")
        label = {"forte-enterprise-1": "IonQ Forte Enterprise 1", "forte-1": "IonQ Forte 1", "aria-1": "IonQ Aria 1",
                 "aria-2": "IonQ Aria 2"}.get(key, "IonQ simulator")
        label += " (hardware)" if hardware else (" noise model" if key != "ideal" else "")
        cap = nq or (29 if "forte" in key else 25)
        if key.startswith("aria"):
            cap = min(cap, 21)   # full-width circuits stall on the Aria models
        p.update(family="ionq", model=key, label=label, hardware=hardware, one_circuit=True, cap=cap)
    elif "fake" in low:
        dev = low.replace("fake_", "").replace("fake", "")
        p.update(family="ibm", model="ibm_" + dev, label=f"IBM {dev.title()} noise model", hardware=False,
                 one_circuit=False, cap=25)
    elif "braket" in low or "braket" in cls.lower() or name == "default":
        p.update(family="ideal", model="ideal", label="AWS Braket local simulator", hardware=False, one_circuit=False, cap=25)
    else:
        p.update(family="ideal", model="ideal", label="Built-in simulator", hardware=False, one_circuit=False, cap=24)
    return p


def wilson(k, n, z=Z95):
    if n <= 0:
        return (0.0, 0.0, 1.0)
    p = k / n
    den = 1 + z * z / n
    mid = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (p, max(0.0, mid - half), min(1.0, mid + half))


# Best classical strategies, to race against on the same cards.
def classical_win(game, cards):
    if game == "chsh":
        return int(cards != (1, 1))                 # everyone answers 0
    if game == "ghz":
        return int(cards != (0, 0, 0))              # everyone answers 1: parity 1
    return int(cards != (2, 2))                     # the best table misses one cell


def summarize(game, per_card):
    """per_card: {cards: [wins, rounds]}. Uniform over the cards played."""
    cards = sorted(per_card)
    rates = [per_card[c][0] / max(per_card[c][1], 1) for c in cards]
    n_tot = sum(per_card[c][1] for c in cards)
    w = sum(rates) / len(rates)
    # variance of an equal-weight mean of independent binomials; each rate is
    # smoothed as (k+1)/(n+2) so a perfect score keeps an honest, nonzero error
    sm = [(per_card[c][0] + 1) / (per_card[c][1] + 2) for c in cards]
    var = sum(r * (1 - r) / max(per_card[c][1], 1) for r, c in zip(sm, cards)) / len(rates) ** 2
    se = math.sqrt(var)
    # 95% interval: Wilson on the pooled rounds (cards get equal rounds)
    _, lo, hi = wilson(sum(per_card[c][0] for c in cards), n_tot)
    c = CLASSICAL[game]
    out = {
        "game": game, "rounds": n_tot, "win": w, "lo": min(lo, w), "hi": max(hi, w),
        "se": se, "classical": c, "quantum": QUANTUM[game], "sigma": (w - c) / se if se > 0 else None,
        "cards": [{"cards": list(cc), "wins": per_card[cc][0], "rounds": per_card[cc][1],
                   "rate": per_card[cc][0] / max(per_card[cc][1], 1)} for cc in cards],
        "covered": len(cards),
    }
    if game == "chsh" and len(cards) == 4:
        # Bell parameter S = E00 + E01 + E10 - E11, with E = 2 P(win) - 1 (sign folded in)
        S = sum(2 * r - 1 for r in rates)
        out["S"] = S
        out["S_se"] = 4 * se
    return out


def play(backend, angles=None, ghz=None, shots=1000, seed=None):
    t0 = time.time()
    angles = angles or dict(BEST_ANGLES)
    ghz = ghz or {k: tuple(v) for k, v in BEST_GHZ.items()}
    prof = profile(backend)
    seed = int(seed if seed is not None else time.time()) % 100000
    groups = plan(prof["cap"], prof["one_circuit"], angles, ghz, seed=seed)
    pairs = circuits(groups, prof["one_circuit"], angles, ghz)
    qcs = [qc for qc, _ in pairs]
    if prof["family"] == "ibm":
        from qiskit import transpile
        # level 3 places each game on the best-calibrated qubits; level 1 keeps
        # the trivial layout (qubits 0, 1, ...), which can be the noisiest pair
        qcs = transpile(qcs, backend=backend, optimization_level=3, seed_transpiler=7)
    elif prof["family"] == "ionq":
        try:
            from qiskit import transpile
            qcs = transpile(qcs, backend=backend, optimization_level=0)
        except Exception:
            pass
    swaps = sum(int(q.count_ops().get("swap", 0)) for q in qcs)
    twoq = sum(int(sum(v for k, v in q.count_ops().items() if k in ("cx", "cz", "ecr", "zz", "ms", "swap"))) for q in qcs)
    per = max(1, int(shots))
    t1 = time.time()
    job = backend.run(qcs[0] if len(qcs) == 1 else qcs, shots=per)
    res = job.result()
    t2 = time.time()

    tallies = {"chsh": {}, "ghz": {}, "ms": {}}
    bob = {}      # no-signalling check: Bob's answer rate by (his card, Alice's card)
    rounds = {"chsh": [], "ghz": [], "ms": []}
    pool = {"chsh": [], "ghz": [], "ms": []}
    rng = random.Random(seed)
    for i, (qc, gs) in enumerate(pairs):
        n = qc.num_qubits
        counts = res.get_counts(i)
        expanded = []
        for k, c in dict(counts).items():
            b = bits_of(str(k), n)
            for g in gs:
                answers, win = score(g, [b[q] for q in g.qubits])
                t = tallies[g.game].setdefault(tuple(g.cards), [0, 0])
                t[0] += win * c
                t[1] += c
                if g.game == "chsh":
                    x, y = g.cards
                    bb = bob.setdefault(f"{y}{x}", [0, 0])
                    bb[0] += answers[1] * c
                    bb[1] += c
                expanded.append((g, answers, win, c))
        for g, answers, win, c in expanded:
            pool[g.game].append((g, answers, win, c))
    # 120 rounds per game for the replay race, drawn uniformly from every round played
    for k, items in pool.items():
        total = sum(c for *_, c in items)
        picks = sorted(rng.sample(range(total), min(120, total))) if total else []
        at, j = 0, 0
        for g, answers, win, c in items:
            while j < len(picks) and picks[j] < at + c:
                rounds[k].append({"cards": list(g.cards), "answers": answers, "win": win,
                                  "classical": classical_win(g.game, tuple(g.cards))})
                j += 1
            at += c
        rng.shuffle(rounds[k])

    games = {g: summarize(g, tallies[g]) for g in tallies if tallies[g]}
    nosig = {}
    for key, (ones, n) in bob.items():
        y, x = key
        nosig[key] = {"bob_card": int(y), "alice_card": int(x), "p_one": ones / max(n, 1), "rounds": n}
    t3 = time.time()
    return json.dumps({
        "ok": True, "profile": prof, "angles": angles, "ghz": {k: list(v) for k, v in ghz.items()},
        "circuits": len(qcs), "qubits": max(q.num_qubits for q in qcs), "shots_per_circuit": per,
        "two_qubit_gates": twoq, "swaps": swaps, "seed": seed,
        "games": games, "nosignal": nosig, "rounds": rounds,
        "missing": [g for g in ("chsh", "ghz", "ms") if g not in games],
        "timing": {"build": t1 - t0, "run": t2 - t1, "score": t3 - t2},
        "when": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
    })
