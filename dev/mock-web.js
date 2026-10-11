// Stands in for the Python module nosig.web during local design work.
// ?run=square replays a square-only IonQ job; ?run=fail a run that fails after submission;
// ?boot=local poses as the built-in simulator (the visibility slider then drives Play).
const get = async (f) => (await fetch(f)).text();
const fn = (impl) => ({ callPromising: impl, callPromisingKwargs: impl });
const params = new URLSearchParams(location.search);
const RUN = params.get('run') ? `./run-${params.get('run')}.json` : './run.json';
export const boot = fn(async () => {
  if (params.get('boot') === 'fail') throw new Error('mock boot failure');
  const b = JSON.parse(await get('./boot.json'));
  if (params.get('boot') === 'local') b.profile = { ...b.profile, family: 'ideal', model: 'ideal', label: 'Built-in simulator', one_circuit: false, cap: 24 };
  try { b.atlas = JSON.parse(await get('../data/atlas.json')); } catch (e) {}
  if (!b.atlas || !b.atlas.runs || !b.atlas.runs.length) {
    const r = JSON.parse(await get('./run.json')); r.recorded = true; b.atlas = { runs: [r] };
  }
  return JSON.stringify(b);
});
export const play = fn(async (backend, angles, ghz, shots, options) => {
  await new Promise((r) => setTimeout(r, Number(params.get('delay') || 2000)));
  if (params.get('run') === 'fail') return JSON.stringify({ ok: false, error: 'failed', message: 'mock failure after submission', submitted: true });
  const opts = options ? JSON.parse(options) : {};
  if (params.get('boot') !== 'local' && !opts.visibility) return await get(RUN);
  // pose as a local run; with a visibility, shrink the wins the way the model does
  const r = JSON.parse(await get('./run.json')), v = opts.visibility;
  r.profile = { ...r.profile, family: 'ideal', model: 'ideal', label: 'Built-in simulator', one_circuit: false, cap: 24 };
  if (v) {
    r.visibility = v;
    for (const [k, g] of Object.entries(r.games)) {
      const f = k === 'ms' ? (4 * (1 + v) + 5 * (1 + v * v)) / 18 : null;
      g.win = f ? g.win * f : 0.5 + (g.win - 0.5) * v;
      g.lo = g.win - 0.01; g.hi = g.win + 0.01; g.sigma = (g.win - g.classical) / g.se_null;
    }
  }
  return JSON.stringify(r);
});
// nosig.web.pool, enough for the page: pooled counts and the same statistics
// as nosig.play.summarize (null-SE margin, Wilson interval).
export const pool = fn(async (game, a, b) => {
  const per = new Map();
  for (const src of [a, b]) for (const c of JSON.parse(src || '[]')) {
    const k = c.cards.join(), t = per.get(k) || { cards: c.cards, wins: 0, rounds: 0 };
    t.wins += c.wins; t.rounds += c.rounds; per.set(k, t);
  }
  const cards = [...per.values()].sort((x, y) => x.cards.join().localeCompare(y.cards.join()));
  const n = cards.reduce((s, c) => s + c.rounds, 0), k = cards.reduce((s, c) => s + c.wins, 0);
  const w = cards.reduce((s, c) => s + c.wins / c.rounds, 0) / cards.length;
  const cl = { chsh: 0.75, ghz: 0.75, ms: 8 / 9 }[game], z = 1.959963984540054, p = k / n;
  const den = 1 + z * z / n, mid = (p + z * z / (2 * n)) / den, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  const se0 = Math.sqrt(cl * (1 - cl) / n);
  return JSON.stringify({ game, rounds: n, win: w, lo: Math.min(mid - half, w), hi: Math.max(mid + half, w), se_null: se0,
    classical: cl, quantum: game === 'chsh' ? Math.cos(Math.PI / 8) ** 2 : 1, sigma: (w - cl) / se0,
    cards: cards.map((c) => ({ ...c, rate: c.wins / c.rounds })), covered: cards.length });
});
