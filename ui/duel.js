// Your turn: play Telepathy as Alice against the clock. You see only your own
// card; Bob follows the plan you agreed before the game. The quantum team plays
// the same deals, answered by real rounds from the run on the page.
import { h, pct } from './sandbox.js';

const PLANS = [
  { id: 'zero', name: 'Bob always answers 0', bob: () => 0 },
  { id: 'one', name: 'Bob always answers 1', bob: () => 1 },
  { id: 'copy', name: 'Bob answers his card', bob: (y) => y },
  { id: 'flip', name: 'Bob answers the opposite of his card', bob: (y) => 1 - y },
];
const ROUNDS = 20;
const wins = (x, y, a, b) => ((a ^ b) === (x & y) ? 1 : 0);

export function duel(host, getRun) {
  let plan = PLANS[0], deals = [], i = 0, you = 0, quantum = 0, qn = 0, streak = 0, best = 0, log = [], pool = null, source = '', hasPool = false;

  const planRow = h('div', { class: 'duel-plans', role: 'group', 'aria-label': 'Bob’s plan' });
  const table = h('div', { class: 'duel-table' });
  // the score redraws every round; the round outcome is announced through say
  const score = h('div', { class: 'duel-score' });
  const feed = h('div', { class: 'duel-feed', 'aria-hidden': 'true' });
  const say = h('p', { class: 'duel-say', 'aria-live': 'polite' });
  host.append(h('p', { class: 'duel-step', text: 'Before the game, agree a plan with Bob. Once the cards are dealt you can’t talk.' }), planRow, table, score, say, feed);

  const drawPlans = () => {
    planRow.innerHTML = '';
    for (const p of PLANS) {
      const b = h('button', { type: 'button', 'aria-pressed': String(p === plan), class: `duel-plan${p === plan ? ' on' : ''}`, text: p.name });
      b.addEventListener('click', () => {
        if (i > 0 && i < ROUNDS) {
          say.textContent = `The cards are already dealt, so the plan stays fixed until round ${ROUNDS} (${plan.name}). You can change it when this game ends.`;
          return;
        }
        plan = p;
        drawPlans();
        start(true);
        planRow.querySelectorAll('button')[PLANS.indexOf(p)].focus();
      });
      planRow.append(b);
    }
  };

  // real rounds from the run on the page, grouped by the cards dealt
  const loadPool = () => {
    const run = getRun();
    pool = { '00': [], '01': [], '10': [], '11': [] };
    const rounds = (run && run.rounds && run.rounds.chsh) || [];
    for (const r of rounds) pool[r.cards.join('')].push(r);
    source = run ? run.profile.label : '';
    hasPool = rounds.length > 0;
    return hasPool;
  };
  const quantumAnswer = (x, y) => {
    const list = pool[`${x}${y}`];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  };

  // focusFirst: move keyboard focus to the first answer button (after a user
  // action, never on page load)
  function start(focusFirst = false) {
    deals = Array.from({ length: ROUNDS }, () => [Math.random() < 0.5 ? 0 : 1, Math.random() < 0.5 ? 0 : 1]);
    i = 0; you = 0; quantum = 0; qn = 0; streak = 0; log = [];
    loadPool();
    feed.innerHTML = '';
    say.textContent = '';
    drawRound(null, focusFirst);
  }

  function drawRound(reveal = null, focusFirst = false) {
    table.innerHTML = '';
    if (i >= ROUNDS && !reveal) return finish(focusFirst);
    const [x, y] = deals[Math.min(i, ROUNDS - 1)];
    const card = (who, v, hidden, cls) => h('div', { class: `duel-booth ${cls}` }, [
      h('span', { class: 'who', text: who }),
      h('span', { class: `duel-card${hidden ? ' back' : ''}`, text: hidden ? '?' : String(v) }),
    ]);
    const alice = card('You (Alice)', x, false, 'a');
    const bob = card('Bob', y, !reveal, 'b');
    if (reveal) {
      alice.append(h('span', { class: 'duel-ans', text: `answered ${reveal.a}` }));
      bob.append(h('span', { class: 'duel-ans', text: `answered ${reveal.b}` }));
    }
    const pick = h('div', { class: 'duel-pick' });
    if (!reveal) {
      pick.append(h('span', { text: `Round ${i + 1} of ${ROUNDS}. Your card is ${x}. Your answer:` }));
      for (const a of [0, 1]) {
        const b = h('button', { type: 'button', class: 'duel-btn', text: String(a), 'aria-label': `Answer ${a}` });
        b.addEventListener('click', () => answer(x, y, a));
        pick.append(b);
      }
      if (focusFirst) setTimeout(() => { const b = pick.querySelector('button'); if (b) b.focus(); }, 0);
    } else {
      const next = h('button', { type: 'button', class: 'duel-btn wide', text: i >= ROUNDS ? 'See the result' : 'Next round' });
      next.addEventListener('click', () => drawRound(null, true));
      pick.append(h('span', { class: reveal.won ? 'ok' : 'bad', text: reveal.won ? 'You won the round.' : (x & y ? 'Lost: both cards were 1, so the answers had to differ.' : 'Lost: the answers had to match.') }), next);
      setTimeout(() => next.focus(), 0);
    }
    table.append(alice, h('div', { class: 'duel-wall', text: 'no signal' }), bob, pick);
    drawScore();
  }

  function answer(x, y, a) {
    const b = plan.bob(y);
    const won = wins(x, y, a, b);
    const q = quantumAnswer(x, y);
    you += won;
    if (q) { quantum += q.win; qn += 1; }
    streak = won ? streak + 1 : 0;
    best = Math.max(best, streak);
    log.push({ x, y, won, q: q ? q.win : null });
    feed.prepend(h('span', { class: won ? 'w' : 'l', text: `${x}${y} you ${won ? '✓' : '✗'} · quantum ${q ? (q.win ? '✓' : '✗') : '–'}` }));
    i += 1;
    say.textContent = `Round ${i}: your card ${x}, you answered ${a}; Bob’s card ${y}, he answered ${b}. `
      + (won ? 'You won the round.' : (x & y ? 'Lost: both cards were 1, so the answers had to differ.' : 'Lost: the answers had to match.'))
      + (q ? ` The quantum team ${q.win ? 'won' : 'lost'} it.` : '')
      + ` Score: you ${you} of ${i}${hasPool ? `, quantum team ${quantum} of ${qn}` : ''}.`;
    drawRound({ a, b, won });
  }

  function drawScore() {
    const n = Math.max(i, 1);
    score.innerHTML = '';
    score.append(
      h('div', { class: 'duel-side you' }, [h('span', { text: 'You and Bob' }), h('b', { text: `${you} / ${i}` }), h('small', { text: i ? pct(you / n) : '' })]),
      // before the machine is read, or with no recorded rounds, there is no quantum team to score
      h('div', { class: 'duel-side q' }, [h('span', { text: `Quantum team${hasPool && source ? ` · ${source}` : ''}` }),
        h('b', { text: hasPool ? `${quantum} / ${qn}` : '—' }), h('small', { text: hasPool ? (qn ? pct(quantum / qn) : '') : 'no recorded rounds yet' })]),
      h('div', { class: 'duel-side s' }, [h('span', { text: 'Your streak' }), h('b', { text: String(streak) }), h('small', { text: `best ${best}` })]),
    );
  }

  function finish(focusAgain = false) {
    const p = you / ROUNDS;
    const lost = log.filter((r) => !r.won).length;
    say.innerHTML = `<b>${you} of ${ROUNDS}</b> for you and Bob${hasPool ? `, ${quantum} for the quantum team` : ''}. `
      + (p > 0.75
        ? `Above 75% this time: with ${ROUNDS} deals, luck can do that. Over many games no plan beats 75%, whatever Bob does.`
        : `Every plan you and Bob can agree on loses on at least one of the four card pairs, so over many games it wins 75% at best. You lost ${lost} round${lost === 1 ? '' : 's'}.`)
      + (hasPool ? ` The quantum team’s answers are real rounds from ${source || 'the machine above'}, dealt the same cards: shared entanglement wins about 85%.` : '');
    const again = h('button', { type: 'button', class: 'ghost', text: 'Play again' });
    again.addEventListener('click', () => start(true));
    table.append(h('div', { class: 'duel-pick' }, [again]));
    drawScore();
    if (focusAgain) setTimeout(() => again.focus(), 0);
  }

  drawPlans();
  start();
  return { refresh: () => { loadPool(); drawScore(); } };
}
