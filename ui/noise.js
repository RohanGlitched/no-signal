// How much noise can entanglement take? Each game's best quantum win rate as
// the shared state loses visibility v (the fraction of its ideal correlation
// that survives), the point where it falls to the classical limit, and where
// each recorded machine sits.
import { el, clear, linear } from './svg.js';

const Q = Math.cos(Math.PI / 8) ** 2;
export const GAMES = [
  // Werner pair: every correlator shrinks by v
  { key: 'chsh', name: 'Telepathy', color: 'var(--alice)', limit: 0.75, win: (v) => 0.5 + (Q - 0.5) * v,
    inv: (w) => (w - 0.5) / (Q - 0.5) },
  // GHZ state with visibility v
  { key: 'ghz', name: 'Three of a kind', color: 'var(--carol)', limit: 0.75, win: (v) => 0.5 + 0.5 * v,
    inv: (w) => 2 * w - 1 },
  // two Werner pairs: 4 cells use one pair (shrink by v), 5 use both (v squared)
  { key: 'ms', name: 'Magic square', color: 'var(--bob)', limit: 8 / 9, win: (v) => (4 * (1 + v) + 5 * (1 + v * v)) / 18,
    inv: (w) => (-4 + Math.sqrt(Math.max(0, 16 - 20 * (9 - 18 * w)))) / 10 },
];
// visibility where each game meets its classical limit
const cross = (g) => { let lo = 0, hi = 1; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (g.win(m) < g.limit) lo = m; else hi = m; } return hi; };
GAMES.forEach((g) => { g.cross = cross(g); });

const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';

export function noiseBudget(host, runs) {
  host.innerHTML = '';
  const W = 760, H = 380, m = { l: 54, r: 18, t: 18, b: 46 };
  const x = linear(0.4, 1, m.l, W - m.r);
  const y = linear(0.45, 1, H - m.b, m.t);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Win rate of each game against the visibility of the shared state', class: 'nb-svg' });
  const panel = document.createElement('div');
  panel.className = 'nb-panel';
  const slider = document.createElement('input');
  Object.assign(slider, { type: 'range', min: '40', max: '100', step: '0.5', value: '100' });
  slider.setAttribute('aria-label', 'Visibility of the shared entangled state, in percent');
  const read = document.createElement('div');
  read.className = 'nb-read';
  const label = document.createElement('label');
  label.className = 'nb-slider';
  label.innerHTML = '<span>Visibility of the shared state</span>';
  const vOut = document.createElement('b');
  label.append(vOut, slider);
  panel.append(label, read);
  host.append(svg, panel);

  // machines: placed at the Bell-pair visibility their Telepathy score implies,
  // then the other two games are a prediction the measurement can miss
  const pts = (runs || []).filter((r) => r.games && r.games.chsh && r.profile.family !== 'ideal').map((r) => ({
    label: r.profile.label.replace(' noise model', ''), games: r.games,
    v: Math.max(0.4, Math.min(1, GAMES[0].inv(r.games.chsh.win))),
  }));

  const draw = (v) => {
    clear(svg);
    for (let t = 0.5; t <= 1.0001; t += 0.1) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'nb-grid' }, svg);
      el('text', { x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'nb-tick', text: pct(t, 0) }, svg);
    }
    for (let t = 0.4; t <= 1.0001; t += 0.1) {
      el('text', { x: x(t), y: H - m.b + 18, 'text-anchor': 'middle', class: 'nb-tick', text: pct(t, 0) }, svg);
    }
    el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'nb-axis', text: 'visibility: how much of the ideal entanglement survives the noise' }, svg);
    // the part of the chart the slider has cut away
    el('rect', { x: x(0.4), y: m.t, width: Math.max(0, x(v) - x(0.4)), height: H - m.b - m.t, class: 'nb-shade' }, svg);
    for (const g of GAMES) {
      const lim = g.limit;
      el('line', { x1: m.l, x2: W - m.r, y1: y(lim), y2: y(lim), stroke: g.color, class: 'nb-limit' }, svg);
      let d = '';
      for (let k = 0; k <= 120; k++) { const vv = 0.4 + 0.6 * k / 120; d += `${k ? 'L' : 'M'}${x(vv).toFixed(1)},${y(g.win(vv)).toFixed(1)}`; }
      el('path', { d, stroke: g.color, class: 'nb-curve' }, svg);
      el('circle', { cx: x(g.cross), cy: y(lim), r: 5, fill: 'var(--card)', stroke: g.color, 'stroke-width': 2.5 }, svg);
      el('circle', { cx: x(v), cy: y(g.win(v)), r: 6.5, fill: g.color, class: 'nb-now' }, svg);
    }
    el('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b, class: 'nb-cursor' }, svg);
    // recorded machines: measured win rates, as diamonds
    for (const p of pts) {
      for (const g of GAMES) {
        const s = p.games[g.key];
        if (!s) continue;
        if (g.key === 'ms' && s.covered < 9) continue;
        const cx = x(p.v), cy = y(s.win);
        const dm = el('path', { d: `M${cx},${cy - 6}L${cx + 6},${cy}L${cx},${cy + 6}L${cx - 6},${cy}Z`, fill: g.color, class: 'nb-run' }, svg);
        el('title', { text: g.key === 'chsh'
          ? `${p.label}: Telepathy ${pct(s.win)}, so visibility ${pct(p.v)}`
          : `${p.label}: ${g.name} measured ${pct(s.win)}, the model predicts ${pct(g.win(p.v))} at visibility ${pct(p.v)}` }, dm);
      }
    }
    vOut.textContent = pct(v, 1);
    read.innerHTML = '';
    for (const g of GAMES) {
      const w = g.win(v), ok = w > g.limit + 1e-9;
      const c = document.createElement('div');
      c.className = `nb-card ${ok ? 'win' : 'lose'}`;
      c.style.setProperty('--g', g.color);
      c.innerHTML = `<span class="n">${g.name}</span><span class="w">${pct(w)}</span>`
        + `<span class="s">${ok ? 'beats' : 'no better than'} the classical ${g.key === 'ms' ? '8 in 9' : '75%'} · falls to it at ${pct(g.cross, 0)} visibility</span>`;
      read.append(c);
    }
  };
  slider.addEventListener('input', () => draw(Number(slider.value) / 100));
  draw(1);
}
