// Classical sandboxes: pick answers in advance and see the bound bite.

// exact values (75%, 100%) without decimals; measured ones always with one
const pct = (v) => (Math.abs(v * 100 - Math.round(v * 100)) < 1e-9 ? `${Math.round(v * 100)}%` : `${(v * 100).toFixed(1)}%`);
const h = (tag, attrs = {}, kids = []) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of [].concat(kids)) if (k) e.append(k);
  return e;
};
export { h, pct };

function toggle(label, get, set, render, cls = '') {
  const b = h('button', { type: 'button', class: cls, 'aria-label': label });
  const sync = () => { b.textContent = String(get()); };
  b.addEventListener('click', () => { set(); sync(); render(); });
  sync();
  return h('label', { class: 'tog' }, [h('span', { text: label.split(':')[1] || label }), b]);
}

// ------------------------------------------------------------ Telepathy (CHSH)
export function chshSandbox(host) {
  const s = { a: [0, 0], b: [0, 0] };
  const out = h('div', { class: 'sbx-out' });
  const total = h('div', { class: 'sbx-total' });
  const strats = h('div', { class: 'strats', hidden: '' });
  const render = () => {
    out.innerHTML = '';
    let wins = 0;
    for (const [x, y] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const a = s.a[x], b = s.b[y];
      const win = (a ^ b) === (x & y);
      wins += win;
      out.append(h('div', { class: `cell ${win ? 'win' : 'lose'}` }, [
        h('span', { class: 'cc', text: `cards ${x}${y}` }),
        h('span', { text: `answers ${a}${b} · ${win ? 'win' : 'lose'}` }),
      ]));
    }
    total.innerHTML = `<span class="big">${pct(wins / 4)}</span><span class="note">of rounds won, with cards dealt at random</span>`;
  };
  const players = h('div', { class: 'players' }, [
    h('div', { class: 'prow' }, [h('span', { class: 'pname a', text: 'Alice' }),
      toggle('Alice: card 0 →', () => s.a[0], () => { s.a[0] ^= 1; }, render),
      toggle('Alice: card 1 →', () => s.a[1], () => { s.a[1] ^= 1; }, render)]),
    h('div', { class: 'prow' }, [h('span', { class: 'pname b', text: 'Bob' }),
      toggle('Bob: card 0 →', () => s.b[0], () => { s.b[0] ^= 1; }, render),
      toggle('Bob: card 1 →', () => s.b[1], () => { s.b[1] ^= 1; }, render)]),
  ]);
  const all = h('button', { type: 'button', class: 'ghost allbtn', text: 'Try all 16 strategies',
    onclick: () => {
      strats.hidden = false;
      strats.innerHTML = '';
      for (let k = 0; k < 16; k++) {
        const a0 = k >> 3 & 1, a1 = k >> 2 & 1, b0 = k >> 1 & 1, b1 = k & 1;
        let w = 0;
        for (const [x, y] of [[0, 0], [0, 1], [1, 0], [1, 1]]) w += (([a0, a1][x] ^ [b0, b1][y]) === (x & y));
        strats.append(h('span', { class: w === 3 ? 'max' : '', title: `Alice ${a0}${a1}, Bob ${b0}${b1}`, text: pct(w / 4) }));
      }
    } });
  host.append(players, out, total, all, strats);
  render();
}

// ------------------------------------------------------- Three of a kind (GHZ)
const GHZ = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
export function ghzSandbox(host) {
  const s = [[0, 0], [0, 0], [0, 0]];
  const names = ['Alice', 'Bob', 'Carol'], cls = ['a', 'b', 'c'];
  const out = h('div', { class: 'sbx-out' });
  const total = h('div', { class: 'sbx-total' });
  const render = () => {
    out.innerHTML = '';
    let wins = 0;
    for (const cards of GHZ) {
      const ans = cards.map((c, p) => s[p][c]);
      const win = (ans[0] ^ ans[1] ^ ans[2]) === (cards[0] | cards[1] | cards[2]);
      wins += win;
      out.append(h('div', { class: `cell ${win ? 'win' : 'lose'}` }, [
        h('span', { class: 'cc', text: `cards ${cards.join('')}` }),
        h('span', { text: `answers ${ans.join('')} · ${win ? 'win' : 'lose'}` }),
      ]));
    }
    total.innerHTML = `<span class="big">${pct(wins / 4)}</span><span class="note">of rounds won. Every one of the 64 strategies tops out at 75%.</span>`;
  };
  const rows = names.map((n, p) => h('div', { class: 'prow' }, [
    h('span', { class: `pname ${cls[p]}`, text: n }),
    toggle(`${n}: card 0 →`, () => s[p][0], () => { s[p][0] ^= 1; }, render),
    toggle(`${n}: card 1 →`, () => s[p][1], () => { s[p][1] ^= 1; }, render),
  ]));
  host.append(h('div', { class: 'players' }, rows), out, total);
  render();
}

// ------------------------------------------------------------- Magic square
export function magicGrid(host) {
  const g = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const wrap = h('div', { class: 'msq' });
  const verdict = h('div', { class: 'sbx-total' });
  const render = () => {
    wrap.innerHTML = '';
    wrap.append(h('span'));
    for (let c = 0; c < 3; c++) wrap.append(h('span', { class: 'hd', text: `col ${c + 1}` }));
    wrap.append(h('span', { class: 'hd', text: 'row: even' }));
    let rowsOk = 0;
    for (let r = 0; r < 3; r++) {
      wrap.append(h('span', { class: 'hd', text: `row ${r + 1}` }));
      for (let c = 0; c < 3; c++) {
        const b = h('button', { type: 'button', class: g[r][c] ? 'one' : '', 'aria-label': `row ${r + 1} column ${c + 1}: ${g[r][c]}`, text: String(g[r][c]) });
        b.addEventListener('click', () => { g[r][c] ^= 1; render(); });
        wrap.append(b);
      }
      const ok = (g[r][0] + g[r][1] + g[r][2]) % 2 === 0;
      rowsOk += ok;
      wrap.append(h('span', { class: `tag ${ok ? 'ok' : 'bad'}`, text: ok ? 'even ✓' : 'odd ✗' }));
    }
    wrap.append(h('span', { class: 'hd', text: 'col: odd' }));
    let colsOk = 0;
    for (let c = 0; c < 3; c++) {
      const ok = (g[0][c] + g[1][c] + g[2][c]) % 2 === 1;
      colsOk += ok;
      wrap.append(h('span', { class: `tag ${ok ? 'ok' : 'bad'}`, text: ok ? 'odd ✓' : 'even ✗' }));
    }
    wrap.append(h('span'));
    const ones = g.flat().reduce((a, b) => a + b, 0);
    verdict.innerHTML = `<span class="big">${rowsOk + colsOk} of 6</span><span class="note">rules met. The grid holds ${ones} ones: rows want an even total, columns an odd one, so at most 5 of the 6 can hold. Wherever a rule breaks, the squares on it can lose.</span>`;
  };
  host.append(wrap, verdict);
  render();
}
