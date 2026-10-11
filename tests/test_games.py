"""Checks for No Signal on Qiskit Aer: python -m pytest tests -q"""
import json
import math

import pytest
from qiskit import transpile
from qiskit_aer import AerSimulator

from nosig.games import (BEST_ANGLES, BEST_GHZ, CLASSICAL, QUANTUM, CHSH_CARDS, GHZ_CARDS, MS_CARDS,
                         best_classical, plan, circuits, score, bits_of, ms_row, ms_col)
from nosig import play, web


def run_groups(one, angles=BEST_ANGLES, ghz=BEST_GHZ, shots=3000, cap=29, seed=3):
    sim = AerSimulator(seed_simulator=seed)
    groups = plan(cap, one, angles, ghz, seed=seed)
    tally = {}
    for qc, gs in circuits(groups, one, angles, ghz):
        res = sim.run(transpile(qc, sim, optimization_level=0), shots=shots, seed_simulator=seed + len(tally)).result()
        for k, c in res.get_counts().items():
            b = bits_of(k, qc.num_qubits)
            for g in gs:
                _, w = score(g, [b[q] for q in g.qubits])
                t = tally.setdefault((g.game, g.cards), [0, 0])
                t[0] += w * c
                t[1] += c
    return tally


def test_classical_bounds_by_brute_force():
    assert best_classical("chsh") == 0.75
    assert best_classical("ghz") == 0.75
    assert abs(best_classical("ms") - 8 / 9) < 1e-12


@pytest.mark.parametrize("one", [True, False])
def test_ideal_quantum_wins(one):
    t = run_groups(one)
    for (game, cards), (w, n) in t.items():
        if game == "chsh":
            assert abs(w / n - QUANTUM["chsh"]) < 0.03, (cards, w / n)
        else:
            assert w == n, (game, cards)


def test_every_magic_square_pair_is_won_ideally():
    t = run_groups(False, shots=500)
    assert {cards for (g, cards) in t if g == "ms"} == set(MS_CARDS)


def test_parity_rules_hold_for_any_bits():
    for r in range(3):
        for c in range(3):
            for m1 in (0, 1):
                for m2 in (0, 1):
                    assert sum(ms_row(r, m1, m2)) % 2 == 0
                    assert sum(ms_col(c, m1, m2)) % 2 == 1


def test_bad_angles_lose():
    bad = {"a0": 0.0, "a1": 0.0, "b0": 0.0, "b1": 0.0}
    t = run_groups(False, angles=bad, shots=2000)
    rates = [w / n for (g, c), (w, n) in t.items() if g == "chsh"]
    assert abs(sum(rates) / 4 - 0.75) < 0.02           # all match: three of four card sets


def test_bad_bases_lose_ghz():
    bad = {"p0": ("X", "X"), "p1": ("X", "X"), "p2": ("X", "X")}
    t = run_groups(False, ghz=bad, shots=2000)
    rates = [w / n for (g, c), (w, n) in t.items() if g == "ghz"]
    assert abs(sum(rates) / 4 - 0.25) < 0.03           # XXX always even: wins only 000


def test_packing_fits_machines():
    for cap, expect in ((29, {"chsh": 4, "ghz": 4, "ms": 2}), (21, {"chsh": 4, "ghz": 4, "ms": 0}), (36, {"chsh": 4, "ghz": 4, "ms": 4})):
        gs = plan(cap, True, BEST_ANGLES, BEST_GHZ, seed=1)
        got = {g: sum(1 for x in gs if x.game == g) for g in ("chsh", "ghz", "ms")}
        assert got == expect, (cap, got)
        assert max(q for x in gs for q in x.qubits) < cap


def test_play_end_to_end_and_no_signal():
    out = json.loads(web.play(AerSimulator(seed_simulator=5), shots=1500))
    assert out["ok"] and set(out["games"]) == {"chsh", "ghz", "ms"}
    s = out["games"]["chsh"]
    assert s["S"] > 2.4 and s["sigma"] > 5
    for v in out["nosignal"].values():
        assert abs(v["p_one"] - 0.5) < 0.06
    assert out["rounds"]["chsh"] and out["games"]["ms"]["covered"] == 9


@pytest.mark.parametrize("v", [0.9, 0.75])
def test_noise_budget_curves(v):
    """The page's visibility model: depolarize each prepared state to visibility v
    and compare the win rates with the curves drawn in ui/noise.js."""
    from qiskit import QuantumCircuit
    from qiskit_aer.noise import depolarizing_error
    from nosig.games import Group, add_chsh, add_ghz, add_ms
    sim = AerSimulator(seed_simulator=11)

    def noisy(n, add, cards, prep, chans, game, extra):
        qc = QuantumCircuit(n, n)
        add(qc, list(range(n)), cards, *extra)
        data = list(qc.data)
        qc.data.clear()
        for k, inst in enumerate(data):
            qc.append(inst)
            if k == prep - 1:
                for qs in chans:
                    qc.append(depolarizing_error(1 - v, len(qs)).to_instruction(), qs)
        qc.measure(range(n), range(n))
        counts = sim.run(qc, shots=20000).result().get_counts()
        g = Group(game, tuple(cards), list(range(n)))
        return sum(c * score(g, bits_of(k, n))[1] for k, c in counts.items()) / 20000

    q = math.cos(math.pi / 8) ** 2
    chsh = sum(noisy(2, add_chsh, c, 2, [[0, 1]], "chsh", (BEST_ANGLES,)) for c in CHSH_CARDS) / 4
    ghz = sum(noisy(3, add_ghz, c, 3, [[0, 1, 2]], "ghz", (BEST_GHZ,)) for c in GHZ_CARDS) / 4
    ms = sum(noisy(4, add_ms, c, 4, [[0, 2], [1, 3]], "ms", ()) for c in MS_CARDS) / 9
    assert abs(chsh - (0.5 + (q - 0.5) * v)) < 0.008, chsh
    assert abs(ghz - (0.5 + 0.5 * v)) < 0.008, ghz
    assert abs(ms - (4 * (1 + v) + 5 * (1 + v * v)) / 18) < 0.008, ms


def test_null_se_margin_and_pooling():
    """The margin uses the classical limit's own spread, and web.pool joins a
    square-only job to the main job's two pairs card by card."""
    s = play.summarize("chsh", {c: [850, 1000] for c in CHSH_CARDS})
    assert abs(s["sigma"] - (0.85 - 0.75) / math.sqrt(0.75 * 0.25 / 4000)) < 1e-9
    main = [{"cards": [0, 2], "wins": 959, "rounds": 1000}, {"cards": [1, 1], "wins": 989, "rounds": 1000}]
    rest = [{"cards": list(c), "wins": 950, "rounds": 1000} for c in MS_CARDS if c not in ((0, 2), (1, 1))]
    out = json.loads(web.pool("ms", json.dumps(main), json.dumps(rest)))
    assert out["covered"] == 9 and out["rounds"] == 9000
    assert abs(out["win"] - (959 + 989 + 7 * 950) / 9000) < 1e-12


@pytest.mark.parametrize("v", [0.8, 0.6])
def test_visibility_mixture_follows_the_curves(v):
    """Play at a set visibility on a local simulator: each card set becomes
    the clean preparation plus its bit-flipped versions with proportional
    shots, which is the noise figure's Werner state. The pooled win rates
    must land on the curves drawn in ui/noise.js, within shot noise."""
    out = json.loads(web.play(AerSimulator(seed_simulator=7), shots=4000, options_json=json.dumps({"visibility": v})))
    assert out["ok"] and out["visibility"] == v and out["circuits"] > 17
    g = out["games"]
    q = math.cos(math.pi / 8) ** 2
    assert all(s["rounds"] == 4000 * s["covered"] for s in g.values())
    assert abs(g["chsh"]["win"] - (0.5 + (q - 0.5) * v)) < 0.016, g["chsh"]["win"]
    assert abs(g["ghz"]["win"] - (0.5 + 0.5 * v)) < 0.016, g["ghz"]["win"]
    assert abs(g["ms"]["win"] - (4 * (1 + v) + 5 * (1 + v * v)) / 18) < 0.012, g["ms"]["win"]
