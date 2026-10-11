// How much noise can entanglement take? Each game's best quantum win rate as
// the shared state loses visibility v (the fraction of its ideal correlation
// that survives), the point where it falls to the classical limit, and where
// each recorded machine sits.
import { el, clear, linear, pct } from './svg.js';

const Q = Math.cos(Math.PI / 8) ** 2;
export const GAMES = [
  // Werner pair: every correlator shrinks by v
  { key: 'chsh', name: 'Telepathy', color: 'var(--alice)', text: 'var(--alice-ink)', limit: 0.75, win: (v) => 0.5 + (Q - 0.5) * v,
    inv: (w) => (w - 0.5) / (Q - 0.5) },
  // GHZ state with visibility v
  { key: 'ghz', name: 'Three of a kind', color: 'var(--carol)', text: 'var(--carol-ink)', limit: 0.75, win: (v) => 0.5 + 0.5 * v,
    inv: (w) => 2 * w - 1 },
  // two Werner pairs: 4 cells use one pair (shrink by v), 5 use both (v squared)
  { key: 'ms', name: 'Magic square', color: 'var(--bob)', text: 'var(--bob)', limit: 8 / 9, win: (v) => (4 * (1 + v) + 5 * (1 + v * v)) / 18,
    inv: (w) => (-4 + Math.sqrt(Math.max(0, 16 - 20 * (9 - 18 * w)))) / 10 },
];
// visibility where each game meets its classical limit
const cross = (g) => { let lo = 0, hi = 1; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (g.win(m) < g.limit) lo = m; else hi = m; } return hi; };
GAMES.forEach((g) => { g.cross = cross(g); });

// opts: v, the slider's starting visibility; onChange(v), called as it moves;
// drives, whether Play on this machine uses the slider (local simulators);
// live, a run played at a set visibility, drawn as measured points at that v.
export function noiseBudget(host, runs, opts = {}) {
  host.innerHTML = '';
  const v0 = Math.max(0.4, Math.min(1, Number(opts.v) || 1));
  // text sizes are in viewBox units (CSS .nb-tick 16, .nb-axis 17): the chart
  // draws at roughly 0.8 px per unit, so every label stays at 12 px or more
  const W = 760, H = 400, m = { l: 84, r: 18, t: 18, b: 60 };
  const x = linear(0.4, 1, m.l, W - m.r);
  const y = linear(0.45, 1, H - m.b, m.t);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Win rate of each game against the visibility of the shared state', class: 'nb-svg' });
  const panel = document.createElement('div');
  panel.className = 'nb-panel';
  const slider = document.createElement('input');
  Object.assign(slider, { type: 'range', min: '40', max: '100', step: '0.5', value: String(v0 * 100) });
  slider.setAttribute('aria-label', 'Visibility of the shared entangled state, in percent');
  slider.setAttribute('aria-valuetext', pct(v0));
  const read = document.createElement('div');
  read.className = 'nb-read';
  const label = document.createElement('label');
  label.className = 'nb-slider';
  label.innerHTML = '<span>Visibility of the shared state</span>';
  const vOut = document.createElement('b');
  label.append(vOut, slider);
  const note = document.createElement('p');
  note.className = 'nb-drive';
  note.id = 'nb-drive-note';
  slider.setAttribute('aria-describedby', note.id);
  panel.append(label, note, read);
  host.append(svg, panel);
  const live = opts.live && Number.isFinite(opts.live.visibility) ? opts.live : null;

  // machines: placed at the Bell-pair visibility their Telepathy score implies,
  // then the other two games are a prediction the measurement can miss
  const pts = (runs || []).filter((r) => r.games && r.games.chsh && r.profile.family !== 'ideal').map((r) => ({
    label: r.profile.label, games: r.games,
    v: Math.max(0.4, Math.min(1, GAMES[0].inv(r.games.chsh.win))),
  }));

  const draw = (v) => {
    clear(svg);
    for (let t = 0.5; t <= 1.0001; t += 0.1) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'nb-grid' }, svg);
      el('text', { x: m.l - 8, y: y(t) + 5, 'text-anchor': 'end', class: 'nb-tick', text: pct(t) }, svg);
    }
    for (let t = 0.4; t <= 1.0001; t += 0.1) {
      el('text', { x: x(t), y: H - m.b + 22, 'text-anchor': 'middle', class: 'nb-tick', text: pct(t) }, svg);
    }
    el('text', { x: 18, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'nb-axis', transform: `rotate(-90 18 ${(m.t + H - m.b) / 2})`, text: 'Win rate' }, svg);
    el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'nb-axis', text: 'visibility: how much of the ideal entanglement survives the noise' }, svg);
    // the part of the chart the slider has cut away
    el('rect', { x: x(0.4), y: m.t, width: Math.max(0, x(v) - x(0.4)), height: H - m.b - m.t, class: 'nb-shade' }, svg);
    for (const g of GAMES) {
      const lim = g.limit;
      el('line', { x1: m.l, x2: W - m.r, y1: y(lim), y2: y(lim), stroke: g.color, class: 'nb-limit' }, svg);
      // each dashed line says what it is: 75% is shared by two games (labelled
      // at the right, below the line, where no curve passes); 8 in 9 at the left
      if (g.key === 'chsh') el('text', { x: W - m.r - 4, y: y(lim) + 20, 'text-anchor': 'end', class: 'nb-lim-label', text: 'classical limit 75% · Telepathy, Three of a kind' }, svg);
      if (g.key === 'ms') el('text', { x: m.l + 8, y: y(lim) - 8, class: 'nb-lim-label', text: 'classical limit 8 in 9 · Magic square' }, svg);
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
    // measured at a set visibility: the same mixture played on this machine
    if (live) {
      const lx = x(Math.max(0.4, live.visibility));
      for (const g of GAMES) {
        const s = live.games && live.games[g.key];
        if (!s || (g.key === 'ms' && s.covered < 9)) continue;
        const cy = y(Math.max(0.45, s.win));
        const dm = el('path', { d: `M${lx},${cy - 9}L${lx + 9},${cy}L${lx},${cy + 9}L${lx - 9},${cy}Z`, fill: g.color, class: 'nb-live' }, svg);
        el('title', { text: `${live.profile.label}, played at ${pct(live.visibility)} visibility: ${g.name} measured ${pct(s.win)}, the model gives ${pct(g.win(live.visibility))}` }, dm);
      }
    }
    vOut.textContent = pct(v);
    note.textContent = opts.drives
      ? (v < 1 ? `Play uses this: every card set is played as this mixture of the clean state and noise, ${pct(v)} visibility, on top of the machine's own noise.${live ? ' Outlined diamonds: your measured run.' : ''}`
        : `Drag below 100% and Play mixes each shared state with that much noise, on top of the machine's own.${live ? ' Outlined diamonds: your measured run.' : ''}`)
      : 'On IonQ the machine’s own noise sets the visibility: the slider moves the model only.';
    slider.setAttribute('aria-valuetext', pct(v));
    read.innerHTML = '';
    for (const g of GAMES) {
      const w = g.win(v), ok = w > g.limit + 1e-9;
      const c = document.createElement('div');
      c.className = `nb-card ${ok ? 'win' : 'lose'}`;
      c.style.setProperty('--g', g.color);
      c.style.setProperty('--gt', g.text);
      c.innerHTML = `<span class="n">${g.name}</span><span class="w">${pct(w)}</span>`
        + `<span class="s">${ok ? 'beats' : 'no better than'} the classical ${g.key === 'ms' ? '8 in 9' : '75%'} · falls to it at ${pct(g.cross)} visibility</span>`;
      read.append(c);
    }
  };
  slider.addEventListener('input', () => {
    const v = Number(slider.value) / 100;
    draw(v);
    if (opts.onChange) opts.onChange(v);
  });
  draw(v0);
}
