// The quantum controls: measurement angles for Telepathy, X/Y bases for Three
// of a kind, and the Mermin-Peres square.
import { el, size } from './svg.js';
import { h, pct } from './sandbox.js';

const CARDS = [[0, 0], [0, 1], [1, 0], [1, 1]];

export function predictChsh(ang) {
  const r = (d) => (d * Math.PI) / 180;
  return CARDS.map(([x, y]) => {
    const d = r(x ? ang.a1 : ang.a0) - r(y ? ang.b1 : ang.b0);
    return x && y ? Math.sin(d) ** 2 : Math.cos(d) ** 2;
  });
}

function polar(svg, color, angle) {
  // a measurement direction in the plane of the Bloch circle: |0> up, |1> down
  const w = 180, c = 90;
  size(svg, w, w);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  el('circle', { cx: c, cy: c, r: 70, fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 1.5 }, svg);
  el('line', { x1: c, y1: 14, x2: c, y2: w - 14, stroke: 'var(--line)', 'stroke-dasharray': '3 4' }, svg);
  el('text', { x: c + 6, y: 16, text: '|0⟩' }, svg);
  el('text', { x: c + 6, y: w - 6, text: '|1⟩' }, svg);
  // a qubit direction at angle t sits at 2t on the Bloch circle
  const t = (2 * angle * Math.PI) / 180;
  const x = c + 70 * Math.sin(t), y = c - 70 * Math.cos(t);
  el('line', { x1: c, y1: c, x2: x, y2: y, stroke: color, 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
  el('circle', { cx: x, cy: y, r: 7, fill: color }, svg);
  el('text', { x: c, y: c + 4, 'text-anchor': 'middle', text: `${angle.toFixed(1)}°`, fill: 'var(--ink)', 'font-weight': 700 }, svg);
}

export function chshDials(host, state, onChange) {
  const grid = h('div', { class: 'dial-grid' });
  const pred = h('div', { class: 'predict' });
  const specs = [['a0', 'Alice, card 0', 'a', 'var(--alice)'], ['a1', 'Alice, card 1', 'a', 'var(--alice)'],
    ['b0', 'Bob, card 0', 'b', 'var(--bob)'], ['b1', 'Bob, card 1', 'b', 'var(--bob)']];
  const views = {};
  for (const [k, label, cls, color] of specs) {
    const svg = el('svg', { role: 'img', 'aria-label': `${label} measurement angle` });
    const input = h('input', { type: 'range', min: '-90', max: '90', step: '0.5', value: String(state.angles[k]), class: cls, 'aria-label': `${label} angle in degrees` });
    input.addEventListener('input', () => { state.angles[k] = Number(input.value); render(); onChange(); });
    views[k] = { svg, input, color };
    grid.append(h('div', { class: 'dial' }, [h('span', { class: 'dlabel', text: label }), svg, input]));
  }
  const render = () => {
    for (const [k, v] of Object.entries(views)) {
      v.input.value = String(state.angles[k]);
      polar(v.svg, v.color, state.angles[k]);
    }
    const p = predictChsh(state.angles);
    pred.innerHTML = '';
    CARDS.forEach(([x, y], i) => pred.append(h('div', { class: `cell ${p[i] > 0.75 ? 'win' : p[i] < 0.75 ? 'lose' : ''}` }, [
      h('span', { class: 'cc', text: `cards ${x}${y}` }), h('span', { class: 'pct', text: pct(p[i]) })])));
    const avg = p.reduce((a, b) => a + b, 0) / 4;
    pred.append(h('div', { class: 'tot' }, [h('small', { text: 'predicted, ideal machine' }), h('span', { class: 'pct', text: pct(avg) }),
      h('small', { text: avg > 0.75 ? 'above the classical 75%' : 'no better than classical' })]));
  };
  host.append(grid, pred);
  render();
  return render;
}

export function ghzBases(host, state, onChange) {
  const names = ['Alice', 'Bob', 'Carol'], cls = ['a', 'b', 'c'];
  const out = h('div', { class: 'sbx-out' });
  const render = () => {
    out.innerHTML = '';
    let wins = 0;
    for (const cards of [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]]) {
      // <M1 M2 M3> on GHZ: XXX = +1, any two Ys and one X = -1, otherwise 0
      const bs = cards.map((c, p) => state.ghz[`p${p}`][c]);
      const ys = bs.filter((b) => b === 'Y').length;
      const exp = ys === 0 ? 1 : ys === 2 ? -1 : 0;
      const want = cards.some((c) => c) ? -1 : 1;           // parity 1 means product -1
      const p = (1 + want * exp) / 2;
      wins += p;
      out.append(h('div', { class: `cell ${p === 1 ? 'win' : p === 0 ? 'lose' : ''}` }, [
        h('span', { class: 'cc', text: `cards ${cards.join('')}` }), h('span', { text: `${bs.join('')} · ${pct(p)}` })]));
    }
    out.append();
    tot.innerHTML = `<span class="big">${pct(wins / 4)}</span><span class="note">predicted on an ideal machine</span>`;
  };
  const tot = h('div', { class: 'sbx-total' });
  const rows = names.map((n, p) => h('div', { class: 'prow' }, [
    h('span', { class: `pname ${cls[p]}`, text: n }),
    ...[0, 1].map((card) => {
      const b = h('button', { type: 'button', class: 'basis', 'aria-label': `${n}, card ${card}: measurement basis`, text: state.ghz[`p${p}`][card] });
      b.addEventListener('click', () => {
        state.ghz[`p${p}`][card] = state.ghz[`p${p}`][card] === 'X' ? 'Y' : 'X';
        b.textContent = state.ghz[`p${p}`][card];
        render(); onChange();
      });
      return h('label', { class: 'tog' }, [h('span', { text: `card ${card} →` }), b]);
    }),
  ]));
  host.append(h('div', { class: 'players' }, rows), out, tot);
  render();
  return () => {
    host.querySelectorAll('button.basis').forEach((b, i) => { b.textContent = state.ghz[`p${Math.floor(i / 2)}`][i % 2]; });
    render();
  };
}

export const SQUARE = [['X⊗I', 'I⊗X', 'X⊗X'], ['I⊗Z', 'Z⊗I', 'Z⊗Z'], ['−X⊗Z', '−Z⊗X', 'Y⊗Y']];

export function pauliSquare(host, hit) {
  host.innerHTML = '';
  const t = h('table');
  const head = h('tr', {}, [h('th'), ...[0, 1, 2].map((c) => h('th', { text: `Bob's col ${c + 1}` })), h('th', { text: 'product' })]);
  t.append(head);
  SQUARE.forEach((row, r) => {
    const tr = h('tr', {}, [h('th', { text: `Alice's row ${r + 1}` })]);
    row.forEach((v, c) => tr.append(h('td', { class: hit && hit[0] === r && hit[1] === c ? 'hit' : '', text: v })));
    tr.append(h('td', { text: '+1' }));
    t.append(tr);
  });
  t.append(h('tr', {}, [h('th', { text: 'product' }), ...[0, 1, 2].map(() => h('td', { text: '−1' })), h('td')]));
  host.append(t);
}
