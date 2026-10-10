"""Three nonlocal games, as circuits and as scoring rules.

In each game a referee hands every player a card, the players may not talk,
and they win if their answers satisfy a rule that links all the cards. Without
talking, no strategy (even with shared random coins) wins more often than the
classical bound. Sharing entangled qubits beats it: that excess is a Bell
violation, the reason the 2022 Nobel Prize in Physics was awarded.

  Telepathy (CHSH)      2 players, cards x, y in {0, 1}; win if a xor b = x and y.
                        Classical 3/4. Quantum cos^2(pi/8) = 85.4%.
  Three of a kind (GHZ) 3 players, cards with x xor y xor z = 0; win if
                        a xor b xor c = x or y or z. Classical 3/4. Quantum 1.
  Magic square          Alice gets a row, Bob a column of a 3x3 grid; Alice
                        fills her row with an even number of 1s, Bob his column
                        with an odd number; win if they agree on the shared
                        cell. Classical 8/9. Quantum 1 (two Bell pairs).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from qiskit import QuantumCircuit

CHSH_CARDS = [(0, 0), (0, 1), (1, 0), (1, 1)]
GHZ_CARDS = [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 0)]
MS_CARDS = [(r, c) for r in range(3) for c in range(3)]

CLASSICAL = {"chsh": 0.75, "ghz": 0.75, "ms": 8 / 9}
QUANTUM = {"chsh": math.cos(math.pi / 8) ** 2, "ghz": 1.0, "ms": 1.0}

# The angles that reach Tsirelson's bound, in degrees.
BEST_ANGLES = {"a0": 0.0, "a1": 45.0, "b0": 22.5, "b1": -22.5}
# GHZ: measure X on card 0 and Y on card 1, for every player.
BEST_GHZ = {"p0": ("X", "Y"), "p1": ("X", "Y"), "p2": ("X", "Y")}


@dataclass
class Group:
    game: str              # "chsh", "ghz" or "ms"
    cards: tuple           # the referee's cards for this group
    qubits: list           # qubits in the circuit, in player order
    meta: dict = field(default_factory=dict)


# ---------------------------------------------------------------- builders

def add_chsh(qc: QuantumCircuit, q, cards, angles):
    """A Bell pair; each player measures at the angle chosen for their card."""
    a, b = q
    x, y = cards
    qc.h(a)
    qc.cx(a, b)
    ta = math.radians(angles["a1"] if x else angles["a0"])
    tb = math.radians(angles["b1"] if y else angles["b0"])
    # measuring along cos t |0> + sin t |1>  ==  RY(-2t), then Z
    if ta:
        qc.ry(-2 * ta, a)
    if tb:
        qc.ry(-2 * tb, b)


def add_ghz(qc: QuantumCircuit, q, cards, strategy):
    """A GHZ state; each player measures X or Y depending on their card."""
    qc.h(q[0])
    qc.cx(q[0], q[1])
    qc.cx(q[1], q[2])
    for k, (qq, card) in enumerate(zip(q, cards)):
        basis = strategy[f"p{k}"][card]
        if basis == "Y":
            qc.sdg(qq)
        qc.h(qq)


def add_ms(qc: QuantumCircuit, q, cards):
    """Two Bell pairs (a1, b1) and (a2, b2); Alice measures her row of the
    Mermin-Peres square on (a1, a2), Bob his column on (b1, b2)."""
    a1, a2, b1, b2 = q
    r, c = cards
    for x, y in ((a1, b1), (a2, b2)):
        qc.h(x)
        qc.cx(x, y)
    # Alice, row r
    if r == 0:            # X1, X2, X1X2
        qc.h(a1)
        qc.h(a2)
    elif r == 2:          # -X1Z2, -Z1X2, Y1Y2: CZ maps X1 -> X1Z2, X2 -> Z1X2
        qc.cz(a1, a2)
        qc.h(a1)
        qc.h(a2)
    # Bob, column c
    if c == 0:            # X1, Z2, -X1Z2
        qc.h(b1)
    elif c == 1:          # X2, Z1, -Z1X2
        qc.h(b2)
    else:                 # X1X2, Z1Z2, Y1Y2 (Bell-basis measurement)
        qc.cx(b1, b2)
        qc.h(b1)


# ----------------------------------------------------------------- scoring

def ms_row(r, m1, m2):
    """Alice's three bits for row r from her two measured bits (even parity)."""
    if r == 0:
        return [m1, m2, m1 ^ m2]
    if r == 1:
        return [m2, m1, m1 ^ m2]            # entries I(x)Z, Z(x)I, Z(x)Z
    return [1 ^ m1, 1 ^ m2, m1 ^ m2]        # -XZ, -ZX, YY


def ms_col(c, m1, m2):
    """Bob's three bits for column c from his two measured bits (odd parity)."""
    if c == 0:
        return [m1, m2, 1 ^ m1 ^ m2]        # X(x)I, I(x)Z, -X(x)Z
    if c == 1:
        return [m2, m1, 1 ^ m1 ^ m2]        # I(x)X, Z(x)I, -Z(x)X
    return [m1, m2, 1 ^ m1 ^ m2]            # XX, ZZ, YY = -XX.ZZ


def score(group: Group, bits):
    """(answers, win) for one round, from the group's measured bits."""
    if group.game == "chsh":
        a, b = bits
        x, y = group.cards
        return (a, b), int((a ^ b) == (x & y))
    if group.game == "ghz":
        a, b, c = bits
        x, y, z = group.cards
        return (a, b, c), int((a ^ b ^ c) == (x | y | z))
    a1, a2, b1, b2 = bits
    r, c = group.cards
    row, col = ms_row(r, a1, a2), ms_col(c, b1, b2)
    return (tuple(row), tuple(col)), int(row[c] == col[r])


# ---------------------------------------------------------------- planning

SIZES = {"chsh": 2, "ghz": 3, "ms": 4}


def plan(cap: int, one_circuit: bool, angles, ghz_strategy, ms_cards=None, seed=0, games=("chsh", "ghz", "ms")):
    """Groups to play. One circuit (IonQ): pack what fits, in order CHSH,
    GHZ, then magic-square question pairs. Otherwise one small circuit per
    group, covering every question pair of every game."""
    import random
    rng = random.Random(seed)
    if not one_circuit:
        groups = [Group("chsh", c, [0, 1]) for c in CHSH_CARDS] if "chsh" in games else []
        groups += [Group("ghz", c, [0, 1, 2]) for c in GHZ_CARDS] if "ghz" in games else []
        groups += [Group("ms", c, [0, 1, 2, 3]) for c in (ms_cards or MS_CARDS)] if "ms" in games else []
        return groups
    groups, used = [], 0
    for game, cards in (("chsh", CHSH_CARDS), ("ghz", GHZ_CARDS)):
        if game in games and used + SIZES[game] * len(cards) <= cap:
            for c in cards:
                groups.append(Group(game, c, list(range(used, used + SIZES[game]))))
                used += SIZES[game]
    pool = list(ms_cards) if ms_cards else rng.sample(MS_CARDS, len(MS_CARDS))
    for c in pool if "ms" in games else []:
        if used + 4 > cap:
            break
        groups.append(Group("ms", c, list(range(used, used + 4))))
        used += 4
    return groups


def circuits(groups, one_circuit: bool, angles, ghz_strategy):
    """Returns [(QuantumCircuit, [groups in it])]."""
    def add(qc, g):
        if g.game == "chsh":
            add_chsh(qc, g.qubits, g.cards, angles)
        elif g.game == "ghz":
            add_ghz(qc, g.qubits, g.cards, ghz_strategy)
        else:
            add_ms(qc, g.qubits, g.cards)

    if one_circuit:
        n = max(q for g in groups for q in g.qubits) + 1
        qc = QuantumCircuit(n, n, name="no_signal")
        for g in groups:
            add(qc, g)
        qc.measure(range(n), range(n))
        return [(qc, groups)]
    out = []
    for g in groups:
        n = SIZES[g.game]
        qc = QuantumCircuit(n, n, name=f"{g.game}_{''.join(map(str, g.cards))}")
        add(qc, g)
        qc.measure(range(n), range(n))
        out.append((qc, [g]))
    return out


def bits_of(key: str, n: int):
    key = key.replace(" ", "")
    if key.startswith("0x"):
        v = int(key, 16)
        return [(v >> k) & 1 for k in range(n)]
    key = key.zfill(n)
    return [int(ch) for ch in reversed(key[-n:])]


# ------------------------------------------------------- classical baselines

def best_classical(game: str):
    """The best deterministic strategy's win rate, by brute force."""
    import itertools
    if game == "chsh":
        best = 0
        for a0, a1, b0, b1 in itertools.product((0, 1), repeat=4):
            w = sum(((a0, a1)[x] ^ (b0, b1)[y]) == (x & y) for x, y in CHSH_CARDS)
            best = max(best, w / 4)
        return best
    if game == "ghz":
        best = 0
        for t in itertools.product((0, 1), repeat=6):
            w = sum((t[x] ^ t[2 + y] ^ t[4 + z]) == (x | y | z) for x, y, z in GHZ_CARDS)
            best = max(best, w / 4)
        return best
    rows = [r for r in itertools.product((0, 1), repeat=3) if sum(r) % 2 == 0]
    cols = [c for c in itertools.product((0, 1), repeat=3) if sum(c) % 2 == 1]
    best = 0
    for R in itertools.product(rows, repeat=3):
        for C in itertools.product(cols, repeat=3):
            w = sum(R[r][c] == C[c][r] for r, c in MS_CARDS)
            best = max(best, w / 9)
    return best
