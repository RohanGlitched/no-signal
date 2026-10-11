![No Signal: three games no team can win without talking, won with entangled qubits on IonQ](https://raw.githubusercontent.com/RohanGlitched/no-signal/main/docs/cover.png)

# No Signal

**[Play it on Qollab](https://qollab.xyz/u/master/no-signal)** · **[Demo video, 2:41, captioned](https://youtu.be/HS_ywKyfT8k)** · **[Source on GitHub](https://github.com/RohanGlitched/no-signal)** · **[How it works](#one-job-every-game)** · **[Results](#results)** · MIT

**Three games no team can win without talking, unless the players share entangled qubits.** Pick a machine in Qollab's runner, tune the players' strategies, and beat the classical limit on IonQ's trapped-ion noise models, IBM's superconducting noise models or an ideal simulator. Then drag the noise up and watch the games fall back to their classical limits, one at a time, in the order the theory predicts.

**On IonQ Forte Enterprise 1 (noise model):** one 28-qubit job gave Telepathy 83.4% (S = 2.67 ± 0.09, 12 standard errors above the classical 75%) and Three of a kind 97.2% (classical 75%). The magic square, over all nine row and column pairs (two jobs), won 96.9% against a classical 8 in 9. Fourteen machines are recorded in the [results](#results).

This effort is supported by Qollab & IonQ.

## Play it in 30 seconds

1. Sign in to Qollab (JS projects need it), open the project and press **Run**.
2. In **Select QPU**, pick **Built-in simulator**. The arcade loads above the console with a run recorded on that machine.
3. Play twenty rounds of Telepathy as Alice, then press **Play all three games**. The built-in simulator answers in seconds; IonQ's noise models take two to three minutes and allow one job per Run (press **Stop**, then **Run**, to play again).

## For a judge with three minutes

- **Your turn.** Twenty rounds as Alice against a fixed plan with Bob. You see only your own card. The quantum team plays the same deals from real recorded rounds and usually wins more.
- **The sandboxes.** Flip the players' answers for every card. No table of answers beats 75%, 75% and 8 in 9; the page brute-forces every strategy to prove it.
- **Press Play all three games.** One job plays every game on the machine you picked. Each scoreboard shows the win rate, its 95% interval and how many standard errors it sits above the classical wall.
- **The noise slider.** On a local simulator it changes the next run: the shared states are mixed with noise at the visibility you set, and the measured points land on the predicted curves. The magic square falls first, Telepathy second, Three of a kind last.

## What you will learn

- why no team that cannot talk beats 75% at Telepathy, and why a shared plan or shared coins do not help;
- what the Bell parameter S is, why classical teams stop at 2 and quantum teams at 2√2 (Tsirelson's bound);
- how a GHZ state wins Three of a kind every time, and how two Bell pairs fill the Mermin–Peres square;
- why entanglement correlates answers without carrying a message;
- how much noise each game can take before it is no better than classical, and why the magic square is the most fragile.

## The games

In every game a referee hands each player a card. The players can't talk. They win if their answers fit a rule that links all the cards.

| Game | Players | Rule | Best without talking | With entanglement |
|---|---|---|---|---|
| **Telepathy** (CHSH) | 2 | answers match, unless both cards are 1, then they differ | 75% | 85.4% (Tsirelson's bound) |
| **Three of a kind** (GHZ) | 3 | the cards always hold an even number of 1s; the number of 1s answered must be even if all cards are 0, odd otherwise | 75% | 100% |
| **Magic square** (Mermin–Peres) | 2 | Alice fills her row (even 1s), Bob his column (odd 1s); they must agree where they cross | 8 in 9 | 100% |

Each classical limit holds for every strategy, including shared random coins, which only pick between strategies. The lab checks this by brute force: 16 strategies for Telepathy, 64 for Three of a kind, and 4,096 grid pairs for the square.

## How to play

1. Press **Run** and pick a machine in **Select QPU**. The IonQ noise models are free and run on IonQ's cloud. The IBM noise models and the ideal simulators run in your browser.
2. **Your turn:** play twenty rounds of Telepathy as Alice. You see only your own card, and Bob follows the plan you agreed beforehand. A quantum team plays the same deals with real rounds from the recorded run, and the page keeps score and your streak.
3. Try the classical sandboxes. Flip the players' answers and watch every strategy hit the wall.
4. Tune the quantum strategy:
   - **Telepathy:** four dials, one measurement angle per player per card, with the predicted win rate updating live. The best angles are 0°, 45°, 22.5° and −22.5°.
   - **Three of a kind:** choose X or Y for each player's card.
5. Press **Play all three games**. One job runs every game; the page shows:
   - each game's win rate with a 95% interval;
   - its margin over the classical limit, in standard errors;
   - for Telepathy, the Bell parameter S;
   - a replay that races your quantum team against a best classical team on the same cards.
6. On IonQ a 29-qubit job fits only two magic-square rounds beside the other games, and the 8-in-9 limit only holds over all nine pairs. Choose **The whole magic square** under Play: the job asks the seven pairs the recorded job on that machine did not, and the page pools the two jobs into all nine, labelled as such.
7. **Noise, live.** On a local simulator, drag the visibility slider under the noise-budget figure and press Play: the next run prepares each shared state as a mixture, clean with probability v and scrambled otherwise, and the measured win rates are drawn on the predicted curves. On IonQ the slider moves the model only.
8. IonQ machines take one job per run. Press **Stop**, then **Run**, to play again.

## One job, every game

IonQ's runners on Qollab accept one job of one circuit, so No Signal packs the games side by side in one circuit. On a 29-qubit Forte noise model that is 28 logical qubits, laid out across the machine's 29 after transpiling:
- four Bell pairs for Telepathy, one per card pair (8 qubits);
- four GHZ states for Three of a kind (12 qubits);
- two magic-square rounds of two Bell pairs each (8 qubits).

Every shot plays every group, so each card set gets the same number of rounds. Local simulators run each card set as its own small circuit and cover all nine magic-square pairs. IonQ's Aria models have 25 qubits; the lab caps them at 21, because full-width jobs stalled on their remote simulator, which leaves no room for the square beside the other games.

**How each player measures:**
- **Telepathy:** each player measures their half of $|\Phi^+\rangle$ along an angle, via $RY(-2\theta)$ and then Z. The answers match with probability $\cos^2(\theta_A - \theta_B)$.
- **Three of a kind:** $|GHZ\rangle = (|000\rangle + |111\rangle)/\sqrt2$. Each player measures X (with H) or Y (with S† then H). $\langle XXX\rangle = +1$ and $\langle XYY\rangle = -1$, so X on card 0 and Y on card 1 always wins.
- **Magic square:** Alice and Bob share two Bell pairs. Each player measures a row or column of the Mermin–Peres square on their two qubits.
  - Alice's rows: XI, IX, XX; IZ, ZI, ZZ; −XZ, −ZX, YY.
  - Each row is measured with H gates, nothing, or CZ then H.
  - Bob's third column uses a Bell-basis measurement.
  - Rows multiply to +1 and columns to −1, so the parity rules hold every time and the shared square agrees.

**Scoring:**
- **Win rate:** the average over card sets, as if the referee dealt at random.
- **Bell parameter (Telepathy):** $S = E_{00} + E_{01} + E_{10} - E_{11} = 8w - 4$ for win rate $w$. Classical teams reach at most 2; quantum mechanics allows up to $2\sqrt2 \approx 2.83$.
- **Margin:** standard errors above the classical limit $c$, using the spread a team winning exactly $c$ would show, $\sqrt{c(1-c)/n}$ over $n$ rounds. The 95% intervals use the observed rate.
- **Consistency check:** from the same shots, Bob's answer rate for each of his cards is compared across Alice's two cards. On these machines each card pair runs on its own qubits, so this is a readout-consistency check rather than a test of signalling; a real no-signalling test needs the same qubit asked different questions, far apart.

## How much noise can entanglement take?

Noise washes the shared state toward random bits. The page models it with one number, the visibility $v$: each Bell pair becomes $v\,|\Phi^+\rangle\langle\Phi^+| + (1 - v)\,I/4$, and the GHZ state likewise with $I/8$. Then:

| Game | Best quantum win rate at visibility v | Falls to the classical limit at |
|---|---|---|
| Three of a kind | $\tfrac12 + \tfrac v2$ | v = 50% |
| Telepathy | $\tfrac12 + \left(\cos^2\tfrac{\pi}{8} - \tfrac12\right)v$ | v = 1/√2 ≈ 71% |
| Magic square | $\dfrac{4(1 + v) + 5(1 + v^2)}{18}$ | v ≈ 85% |

The magic square is the most fragile. Four of its nine cells depend on one Bell pair and five on both, so noise hits it twice. A slider on the page drags v down and shows the three games falling to their limits in turn, and on a local simulator it drives the next run, so the curves can be checked against measurements at any v. Each recorded machine is placed at the visibility its Telepathy score implies (clamped at 1 where a score lands above Tsirelson's bound by chance), which turns the other two curves into predictions the measurements can miss. The implied visibility carries about ±1.6 points of shot noise from Telepathy's 4,000 rounds, so a GHZ prediction carries about ±0.8. On the IonQ Forte models the GHZ prediction lands within 0.1 points of the measurement; on the Aria models it misses by 1.0 and 1.7 points; on IBM's models GHZ falls 0.2 to 3.3 points below it, since a GHZ state needs two entangling gates where a Bell pair needs one. The tests check all three curves against Qiskit Aer, with the mixture prepared the way the page prepares it.

## Results

Recorded with the best strategies on Qollab's machines (see the page's atlas):

| Machine | Telepathy (75%) | S (≤ 2 classical) | Three of a kind (75%) | Magic square (88.9%) |
|---|---|---|---|---|
| IonQ Forte Enterprise 1 noise model | 83.4% (12 SE) | 2.67 ± 0.09 | 97.2% (32 SE) | 96.9% (24 SE) |
| IonQ Forte 1 noise model | 84.1% (13 SE) | 2.73 ± 0.09 | 98.2% (34 SE) | 97.7% (27 SE) |
| IonQ Aria 1 noise model | 85.5% (15 SE) | 2.84 ± 0.09 | 98.6% (35 SE) | — |
| IonQ Aria 2 noise model | 84.8% (14 SE) | 2.78 ± 0.09 | 98.2% (34 SE) | — |
| IBM Aachen noise model | 83.6% (13 SE) | 2.69 ± 0.09 | 97.4% (33 SE) | 97.3% (26 SE) |
| IBM Berlin noise model | 83.6% (13 SE) | 2.69 ± 0.09 | 95.4% (30 SE) | 95.5% (20 SE) |
| IBM Boston noise model | 85.8% (16 SE) | 2.86 ± 0.09 | 97.6% (33 SE) | 98.2% (28 SE) |
| IBM Fez noise model | 84.6% (14 SE) | 2.77 ± 0.09 | 98.4% (34 SE) | 98.0% (28 SE) |
| IBM Kingston noise model | 83.9% (13 SE) | 2.71 ± 0.09 | 97.1% (32 SE) | 96.7% (24 SE) |
| IBM Marrakesh noise model | 85.0% (15 SE) | 2.80 ± 0.09 | 98.6% (35 SE) | 98.4% (29 SE) |
| IBM Miami noise model | 83.7% (13 SE) | 2.69 ± 0.09 | 94.3% (28 SE) | 94.9% (18 SE) |
| IBM Pittsburgh noise model | 84.9% (14 SE) | 2.79 ± 0.09 | 97.8% (33 SE) | 97.6% (26 SE) |
| AWS Braket local simulator | 85.6% (15 SE) | 2.85 ± 0.09 | 100.0% (37 SE) | 100.0% (34 SE) |
| Built-in simulator | 85.0% (15 SE) | 2.80 ± 0.09 | 100.0% (37 SE) | 100.0% (34 SE) |
| *ideal (theory)* | 85.4% | 2.83 | 100% | 100% |

SE: standard errors above the classical limit c, using the spread a team winning exactly c would show, √(c(1−c)/n) over n rounds. S is shown with its 95% interval. On the IonQ Forte models the magic square pools two jobs, so it covers all nine row and column pairs. The Aria models are capped at 21 qubits here, which leaves no room for the square beside the other games. The demo video quotes the margins as they were first computed, from the observed rate (14 standard errors for Telepathy); the stricter null-rate spread above gives 12.

## Why this is more than the textbook CHSH game

The CHSH game is a standard first lesson in entanglement. What is new here: three nonlocal games packed into one IonQ job so every shot plays every game; the classical limits proved on the page by brute force rather than quoted; a visibility model that turns one game's score into a prediction for the other two, checked on fourteen machines and on Aer; a noise slider that drives real runs, not just a curve; playing as Alice against rounds a real machine produced; and a magic square completed across two jobs when a machine cannot hold all nine pairs at once.

## Glossary

| Term | Meaning here |
|---|---|
| Bell pair | two qubits in the state (|00⟩ + |11⟩)/√2; each player holds one |
| GHZ state | three qubits in (|000⟩ + |111⟩)/√2 |
| Measurement basis | the question asked of a qubit: an angle for Telepathy, X or Y for Three of a kind |
| Bell parameter S | a sum of four correlations; at most 2 for any classical team, up to 2√2 with entanglement |
| Tsirelson's bound | the quantum maximum for Telepathy, cos²(π/8) ≈ 85.4% |
| Visibility v | how much of the clean state survives the noise; 1 is perfect, 0 is random bits |
| Standard error | the spread the referee would see from luck alone over n rounds |
| No-signalling | a player's own answers do not depend on the other player's card |

## Troubleshooting

- **Run sent me to the sign-in page.** JS projects on Qollab need an account; sign in and press Run again.
- **Play is grey after one run on IonQ.** IonQ's runners take one job per Run. Press Stop, then Run.
- **The magic square says "not a test on its own".** On IonQ one job holds two of the nine pairs. Choose *The whole magic square* under Play; the page pools it with the recorded job on that machine.
- **No magic square on Aria.** The 21-qubit cap leaves no room for it beside the other games; pick a Forte model or a local simulator.
- **The IBM models are slow with noise on.** The visibility mixture runs several circuits per card set, every shot in your browser; use fewer shots or the built-in simulator.
- **A Telepathy score above 85.4%.** Luck over 1,000 rounds per card pair; the interval still covers the bound.

## What didn't work, and what we did about it

- **IBM layouts.** IBM noise models at transpiler level 1 kept the trivial layout. On Kingston, qubits 0 and 1 flip 17% of Bell outcomes, which pushed Telepathy below the classical limit. Level 3 places each game on well-calibrated qubits and restores 84%.
- **The magic square on IonQ.** A 29-qubit circuit holds only two magic-square rounds next to the other games. The first IonQ runs covered 2 of the 9 pairs, which is not a test of the 8-in-9 limit: a classical team can win any two pairs every time. The square-only mode fills a job with seven rounds, the page pools the jobs, and any run with fewer than nine pairs is marked as not a test.
- **Two statistics bugs caught in review before submission.** The Bell parameter's error bar was half its true size (S = 8·win − 4, so its error is 8× the win rate's), and the margins used the observed rate's spread, which shrinks near 100% and made perfect scores look absurdly significant. Both are fixed; the margins now use the classical rate's spread.
- **A blocked IonQ queue.** A queued hardware job for the team's other entry blocked all IonQ runs on the account, noise models included, for about two hours.

## What this shows, and what it doesn't

- **Not a loophole-free Bell test.** A real one separates the players far enough that no signal could pass, and detects every particle, as Hensen et al. did in 2015. The 2022 Nobel Prize went to Aspect, Clauser and Zeilinger for this line of experiments. Here every qubit sits in one machine or one simulation. The games show quantum correlations, not a proof that nature is nonlocal.
- **Models, not hardware.** On a noise-model simulator, the numbers come from IonQ's or IBM's model of their machines.
- **Packed circuits.** On IonQ, all games share one circuit, so crosstalk on real hardware would count as noise.

## Files

```
index.html, main.css, main.js   the page (Qollab JS project)
ui/                              Your turn game, sandboxes, angle dials and bases, results, race, noise budget, atlas
nosig/games.py                   the three games as circuits, scoring rules, brute-force classical bounds, the visibility mixture
nosig/play.py                    one job on the chosen machine; win rates, S, margins, the consistency check
nosig/web.py                     what the page calls, including pooling two jobs' magic squares
data/atlas.json                  runs recorded on Qollab's machines (data/runs/*.json, merged by tools/atlas.py)
tests/                           14 checks against Qiskit Aer
```

Tests (local Python, `pip install -r requirements-dev.txt`): `python -m pytest tests -q`. They check the classical bounds by brute force, the ideal quantum wins, every magic-square pair, the parity rules, that bad strategies lose, that the packing fits each machine, the end-to-end run with the consistency check, the null-rate margins and pooling, and the noise-budget curves against the mixture on Aer.

## Built for the Qollab × IonQ hackathon

Theme: **Quantum Playground**, a game where quantum effects are essential. Without entanglement, no strategy reaches the scores the page shows. Everything here was written during the build window (October 10–11, 2026, IST), alongside the team's other entry, [Below threshold](https://qollab.xyz/u/master/below-threshold), which measures error correction on the same machines.

## References

1. Clauser, Horne, Shimony & Holt, *PRL* 23, 880 (1969). Tsirelson, *Lett. Math. Phys.* 4, 93 (1980).
2. Greenberger, Horne, Shimony & Zeilinger, *Am. J. Phys.* 58, 1131 (1990). Mermin, *Physics Today* 43(6), 9 (1990).
3. Mermin, *PRL* 65, 3373 (1990). Peres, *Phys. Lett. A* 151, 107 (1990). Aravind, *Am. J. Phys.* 72, 1303 (2004).
4. Hensen et al., "Loophole-free Bell inequality violation using electron spins separated by 1.3 kilometres", *Nature* 526, 682 (2015).

MIT licence.
