// Scoreboards, result cards, the race replay, the no-signal check and the atlas.
import { el, size, linear, reduceMotion } from './svg.js';
import { h, pct } from './sandbox.js';

export const GAME_NAME = { chsh: 'Telepathy', ghz: 'Three of a kind', ms: 'Magic square' };
const LIMIT_TXT = { chsh: '75%', ghz: '75%', ms: '8 in 9' };

function gauge(v, limit) {
  return h('div', { class: 'gauge' }, [
    h('i', { class: 'fill', style: `width:${Math.max(0, Math.min(1, v || 0)) * 100}%` }),
    h('span', { class: 'wallmark', style: `left:${limit * 100}%`, title: 'classical limit' }),
  ]);
}

export function renderBoards(host, run, classical) {
  host.innerHTML = '';
  for (const g of ['chsh', 'ghz', 'ms']) {
    const s = run && run.games && run.games[g];
    const v = s ? s.win : null;
    const partial = g === 'ms' && s && s.covered < 9;
    const over = s && !partial && s.lo > classical[g];
    host.append(h('div', { class: 'board' }, [
      h('span', { class: 'bname', text: GAME_NAME[g] }),
      h('span', { class: `bnum ${s ? (over ? 'over' : partial ? 'part' : 'under') : ''}`, text: s ? pct(v) : '—' }),
      gauge(v, classical[g]),
      h('span', { class: 'bsub', text: !s ? `not on this machine in one job` : partial ? `${s.covered} of 9 pairs: not a test on its own · ${s.rounds.toLocaleString()} rounds` : `classical limit ${LIMIT_TXT[g]} · ${s.rounds.toLocaleString()} rounds` }),
    ]));
  }
}

function cardBars(game, s) {
  const svg = el('svg', { role: 'img', 'aria-label': `${GAME_NAME[game]} win rate for each set of cards` });
  const rows = s.cards;
  const w = 560, rh = 34, top = 18, hgt = top + rows.length * rh + 26;
  size(svg, w, hgt);
  const x0 = 120, x1 = w - 60;
  const x = linear(0.5, 1, x0, x1);
  for (const t of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
    el('line', { x1: x(t), x2: x(t), y1: top - 6, y2: hgt - 22, stroke: 'var(--line)' }, svg);
    el('text', { x: x(t), y: hgt - 6, 'text-anchor': 'middle', text: `${Math.round(t * 100)}%` }, svg);
  }
  const lim = s.classical;
  el('line', { x1: x(lim), x2: x(lim), y1: top - 10, y2: hgt - 22, stroke: 'var(--limit)', 'stroke-width': 2 }, svg);
  el('text', { x: x(lim) + 4, y: top - 2, text: 'classical limit', fill: 'var(--limit)' }, svg);
  if (s.quantum < 1) {
    el('line', { x1: x(s.quantum), x2: x(s.quantum), y1: top - 10, y2: hgt - 22, stroke: 'var(--bob)', 'stroke-dasharray': '4 3' }, svg);
  }
  rows.forEach((c, i) => {
    const y = top + i * rh + 6;
    const label = game === 'ms' ? `row ${c.cards[0] + 1}, col ${c.cards[1] + 1}` : `cards ${c.cards.join('')}`;
    el('text', { x: 0, y: y + 15, text: label, fill: 'var(--ink-2)' }, svg);
    el('rect', { x: x0, y, width: Math.max(1, x(Math.max(0.5, c.rate)) - x0), height: 20, rx: 5, fill: c.rate > lim ? 'var(--alice)' : 'var(--lose)', opacity: 0.85 }, svg);
    el('text', { x: x(Math.max(0.5, c.rate)) + 6, y: y + 15, text: pct(c.rate), fill: 'var(--ink)', 'font-weight': 600 }, svg);
  });
  return svg;
}

const timers = {};
function race(host, game, rounds) {
  clearInterval(timers[game]);
  const q = h('div', { class: 'race-row q' }, [h('span', { text: 'Quantum team' }), h('div', { class: 'bar' }, [h('i')]), h('span', { class: 'pct' })]);
  const c = h('div', { class: 'race-row c' }, [h('span', { text: 'Best classical' }), h('div', { class: 'bar' }, [h('i')]), h('span', { class: 'pct' })]);
  const feed = h('div', { class: 'race-feed', 'aria-hidden': 'true' });
  const replay = h('button', { type: 'button', class: 'ghost', text: 'Replay rounds' });
  host.append(h('p', { class: 'res-big' }, [h('span', { class: 'lbl', text: `Replay: ${rounds.length} real rounds from this run, the same cards dealt to a best classical team` })]), q, c, feed, replay);
  const run = () => {
    clearInterval(timers[game]);
    let i = 0, qw = 0, cw = 0;
    feed.innerHTML = '';
    const step = () => {
      if (i >= rounds.length) { clearInterval(timers[game]); return; }
      const r = rounds[i++];
      qw += r.win; cw += r.classical;
      q.querySelector('i').style.width = `${(qw / i) * 100}%`;
      c.querySelector('i').style.width = `${(cw / i) * 100}%`;
      q.querySelector('.pct').textContent = pct(qw / i);
      c.querySelector('.pct').textContent = pct(cw / i);
      const cards = game === 'ms' ? `r${r.cards[0] + 1}c${r.cards[1] + 1}` : r.cards.join('');
      feed.prepend(h('span', { class: r.win ? 'w' : 'l', text: `${cards} ${r.win ? '✓' : '✗'}` }));
      while (feed.children.length > 24) feed.lastChild.remove();
    };
    if (reduceMotion()) { while (i < rounds.length) step(); return; }
    timers[game] = setInterval(step, 70);
  };
  replay.addEventListener('click', run);
  // start when visible
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); run(); } }, { threshold: 0.3 });
    io.observe(host);
  } else run();
}

// How likely a classical team gets this far above its limit by luck alone (one-sided normal tail).
function luck(z) {
  if (!z || z < 2) return '';
  const log10p = (-z * z / 2 - Math.log(z * Math.sqrt(2 * Math.PI))) / Math.LN10;
  if (log10p < -12) return 'A classical team gets this lucky less than once in a trillion tries.';
  const n = Math.round(-log10p);
  return n >= 2 ? `A classical team gets this lucky about once in 10<sup>${n}</sup> tries.` : '';
}

export function renderResult(host, game, run) {
  host.innerHTML = '';
  const s = run && run.games && run.games[game];
  if (!s) {
    host.append(h('p', { class: 'res-empty', text: `This machine can't fit ${GAME_NAME[game]} into its one job alongside the other games. Pick IonQ Forte or a local simulator to play it.` }));
    return;
  }
  // the 8-in-9 limit holds over all nine pairs: a classical team can win any eight every time
  const partial = game === 'ms' && s.covered < 9;
  const over = !partial && s.lo > s.classical;
  const big = h('div', { class: 'res-big' }, [
    h('span', { class: 'lbl', text: `${run.recorded ? 'Recorded' : 'Measured'} on ${run.profile.label.replace(' noise model', '')}` }),
    h('span', { class: `val ${over ? 'over' : partial ? 'part' : 'under'}`, text: pct(s.win) }),
    h('span', { class: 'ci', text: `95% interval ${pct(s.lo)} – ${pct(s.hi)} · ${s.rounds.toLocaleString()} rounds` }),
  ]);
  let say = partial
    ? `This job asked ${s.covered} of the 9 row and column pairs, and the 8-in-9 limit only holds over all nine: a classical team can win any ${s.covered} pairs every time. So on its own this is not a test. Choose <b>The whole magic square</b> under Play to ask all nine.`
    : over
    ? `Above the classical limit of ${LIMIT_TXT[game]} by <b>${!s.sigma ? '—' : s.sigma >= 100 ? 'more than 100' : s.sigma.toFixed(0)} standard errors</b>${s.win === 1 ? `, without losing one of ${s.rounds.toLocaleString()} rounds` : ''}. ${luck(s.sigma)} No team without entanglement could do this.`
    : `Not above the classical limit of ${LIMIT_TXT[game]}${run.custom ? ': try other settings' : ''}.`;
  if (game === 'chsh' && s.S !== undefined) {
    say += ` Bell parameter S = <b>${s.S.toFixed(3)}</b> ± ${(s.S_se * 1.96).toFixed(3)} (95%); classical ≤ 2, quantum ≤ 2.828.`;
    if (s.S > 2 * Math.SQRT2 && s.S - 1.96 * s.S_se <= 2 * Math.SQRT2) say += ' Above 2.828 only by chance: the bound lies inside the error bar, as it should with a finite number of rounds.';
  }
  big.append(h('p', { class: 'say', html: say }));
  const chart = h('div', { class: 'res-chart' }, [cardBars(game, s)]);
  const raceHost = h('div', { class: 'race' });
  host.append(h('div', { class: 'res-card' }, [big, chart, raceHost]));
  if (!partial && run.rounds && run.rounds[game] && run.rounds[game].length) race(raceHost, game, run.rounds[game]);
}

export function renderNoSignal(host, run) {
  host.innerHTML = '';
  const ns = run && run.nosignal;
  if (!ns || !Object.keys(ns).length) {
    host.append(h('p', { class: 'res-empty', text: 'Play Telepathy to measure this.' }));
    return;
  }
  for (const y of [0, 1]) {
    const card = h('div', { class: 'ns-card' }, [h('h3', { text: `Bob holds card ${y}` })]);
    for (const x of [0, 1]) {
      const v = ns[`${y}${x}`];
      if (!v) continue;
      card.append(h('div', { class: 'ns-bar' }, [
        h('span', { text: `Alice holds card ${x}` }),
        h('div', { class: 'track' }, [h('i', { style: `width:${v.p_one * 100}%` }), h('b')]),
        h('span', { class: 'pct', text: pct(v.p_one) }),
      ]));
    }
    const a = ns[`${y}0`], b = ns[`${y}1`];
    if (a && b) {
      const pm = (a.p_one + b.p_one) / 2;
      const z = Math.abs(a.p_one - b.p_one) / Math.sqrt(Math.max(pm * (1 - pm), 1e-9) * (1 / a.rounds + 1 / b.rounds));
      card.append(h('p', { class: 'fine', text: `Bob answers 1 in ${pct(a.p_one)} vs ${pct(b.p_one)} of rounds: a gap of ${(Math.abs(a.p_one - b.p_one) * 100).toFixed(1)} points over ${(a.rounds + b.rounds).toLocaleString()} rounds, ${z.toFixed(1)} standard errors. ${z < 3 ? 'That is the size chance alone gives.' : 'Larger than chance alone usually gives: look for a bias in the machine.'}` }));
    }
    host.append(card);
  }
}

export function renderAtlas(host, runs, currentLabel) {
  host.innerHTML = '';
  if (!runs.length) {
    host.append(h('p', { class: 'res-empty', text: 'No recorded runs yet.' }));
    return;
  }
  const order = { ionq: 0, ibm: 1, braket: 2, ideal: 3 };
  const o = (r) => order[r.profile.family] ?? 4;
  runs = [...runs].sort((a, b) => (o(a) - o(b)) || ((b.games.chsh?.win || 0) - (a.games.chsh?.win || 0)));
  host.append(h('div', { class: 'arow head', role: 'row' }, [h('span', { text: 'Machine' }),
    h('span', { text: 'Telepathy (limit 75%)' }), h('span', { text: 'Three of a kind (75%)' }), h('span', { text: 'Magic square (88.9%)' })]));
  const fam = { ionq: 'Trapped ions', ibm: 'Superconducting', braket: 'Ideal · Amazon Braket', ideal: 'No noise' };
  for (const r of runs) {
    const you = r.profile.label === currentLabel;
    const cells = ['chsh', 'ghz', 'ms'].map((g) => {
      const s = r.games[g];
      if (!s) return h('span', { class: 'acell' }, [h('span', { class: 'v', text: '—' })]);
      const extra = g === 'chsh' && s.S !== undefined ? ` · S ${s.S.toFixed(2)}` : '';
      if (g === 'ms' && s.covered < 9) return h('span', { class: 'acell part' }, [h('span', { class: 'v', text: `${pct(s.win)} · ${s.covered} of 9 pairs` }), h('small', { text: 'not a test on its own' })]);
      return h('span', { class: 'acell' }, [h('span', { class: 'v', text: pct(s.win) + extra }), gauge(s.win, s.classical)]);
    });
    host.append(h('div', { class: `arow${you ? ' you' : ''}`, role: 'row' }, [
      h('span', { class: 'mname', html: `${r.profile.label.replace(' noise model', '')}<small>${fam[r.profile.family] || ''}${you ? ' · your machine' : ''}</small>` }),
      ...cells,
    ]));
  }
}

// TV static for the wall between the booths.
export function staticWall(canvas) {
  const ctx = canvas.getContext('2d');
  let raf = 0, last = 0;
  const draw = (t) => {
    raf = requestAnimationFrame(draw);
    if (t - last < 70) return;
    last = t;
    const w = canvas.width = canvas.clientWidth / 2 | 0, hh = canvas.height = canvas.clientHeight / 2 | 0;
    if (!w || !hh) return;
    const img = ctx.createImageData(w, hh);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  if (reduceMotion()) { draw(1000); cancelAnimationFrame(raf); return; }
  raf = requestAnimationFrame(draw);
}
