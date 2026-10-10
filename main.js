// No Signal: page logic. Circuits and scoring live in nosig/ (Python); this
// file draws the arcade and calls it with the backend picked in Qollab's dialog.
import * as web from 'nosig.web';
import { chshSandbox, ghzSandbox, magicGrid } from './ui/sandbox.js';
import { chshDials, ghzBases, pauliSquare } from './ui/controls.js';
import { renderBoards, renderResult, renderNoSignal, renderAtlas, staticWall } from './ui/results.js';
import { noiseBudget } from './ui/noise.js';
import { duel } from './ui/duel.js';

const $ = (id) => document.getElementById(id);
const state = {
  info: null, run: null, live: false, sentJob: false,
  angles: { a0: 0, a1: 45, b0: 22.5, b1: -22.5 },
  ghz: { p0: ['X', 'Y'], p1: ['X', 'Y'], p2: ['X', 'Y'] },
};

console.log('No Signal: loading the arcade…');

// Qollab's host page can ask for the status (or press Play) with postMessage;
// that is how the page is tested end to end inside the sandboxed frame.
globalThis.addEventListener('message', (e) => {
  if (!e.data || typeof e.data.bt !== 'string') return;
  if (e.data.bt === 'run') play(e.data.shots, e.data.opts);
  if (e.data.bt === 'dump' && state.run) {
    (e.source || window.parent).postMessage({ bt: 'dump', run: JSON.stringify(state.run) }, '*');
    return;
  }
  const g = state.run && state.run.games;
  (e.source || window.parent).postMessage({
    bt: 'state', status: $('status').textContent, live: state.live,
    machine: state.info && state.info.profile.label,
    atlas: state.info && state.info.atlas ? state.info.atlas.runs.length : 0,
    games: g ? Object.fromEntries(Object.entries(g).map(([k, v]) => [k, [v.win, v.rounds, v.S]])) : null,
  }, '*');
});

staticWall($('static'));
heroLoop();
chshSandbox($('chsh-sandbox'));
ghzSandbox($('ghz-sandbox'));
magicGrid($('ms-grid'));
const redrawDials = chshDials($('chsh-dials'), state, settingsChanged);
const redrawBases = ghzBases($('ghz-bases'), state, settingsChanged);
pauliSquare($('ms-pauli'));
const theDuel = duel($('duel'), () => (state.run && state.run.rounds && state.run.rounds.chsh && state.run.rounds.chsh.length ? state.run : null));
$('chsh-best').addEventListener('click', () => { state.angles = { a0: 0, a1: 45, b0: 22.5, b1: -22.5 }; redrawDials(); settingsChanged(); });
$('ghz-best').addEventListener('click', () => { state.ghz = { p0: ['X', 'Y'], p1: ['X', 'Y'], p2: ['X', 'Y'] }; redrawBases(); settingsChanged(); });
$('go').addEventListener('click', () => play());
$('what').addEventListener('change', () => { $('go').textContent = goLabel(); });

function goLabel() {
  return $('what').value === 'ms' ? 'Play the magic square' : 'Play all three games';
}

// The whole square: every one of the 9 row and column pairs. A one-circuit
// machine fits 7 rounds per job, so it starts with the pairs played least.
function squareOptions() {
  const all = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]];
  const seen = new Map();
  const ms = state.run && state.run.games && state.run.games.ms;
  if (ms && state.run.profile.label === state.info.profile.label) for (const c of ms.cards) seen.set(c.cards.join(), c.rounds);
  all.sort((a, b) => (seen.get(a.join()) || 0) - (seen.get(b.join()) || 0));
  return { games: ['ms'], ms_cards: all };
}

try {
  await boot();
} catch (err) {
  console.error(err);
  setStatus('The arcade could not start: ' + (err && err.message ? err.message : String(err)), 'err');
}
// Keep the run alive so the page can call Python again. Press Stop to end it.
await new Promise(() => {});

async function boot() {
  state.info = JSON.parse(await web.boot.callPromising(backend));
  const p = state.info.profile;
  $('m-name').textContent = p.label.replace(' noise model', '');
  $('m-dot').className = 'dot ' + (p.family === 'ionq' ? '' : p.family);
  const f = state.info.fits;
  $('m-meta').textContent = p.one_circuit
    ? `${p.family === 'ionq' ? 'Trapped ions' : ''} · one job of one circuit, up to ${p.cap} qubits: ${f.chsh ? 'Telepathy' : ''}${f.ghz ? ', Three of a kind' : ''}${f.ms ? `, ${f.ms} magic-square rounds` : ''}`
    : `${p.family === 'ibm' ? 'Superconducting · runs in your browser' : 'No noise of its own · runs in your browser'} · every card set of all three games`;
  state.run = pickRecorded();
  renderAll();
  setStatus(state.run ? `Showing a run recorded on ${state.run.profile.label.replace(' noise model', '')}. Play to measure your own.` : 'Press Play to run all three games.');
  console.log(`No Signal is ready on ${p.label} (${p.family}).`);
}

function pickRecorded() {
  const runs = (state.info.atlas && state.info.atlas.runs) || [];
  const p = state.info.profile;
  return runs.find((r) => r.profile.label === p.label)
    || runs.find((r) => r.profile.model === p.model)
    || runs.find((r) => r.profile.model === 'forte-enterprise-1') || runs[0] || null;
}

function renderAll() {
  renderBoards($('boards'), state.run, state.info.classical);
  for (const g of ['chsh', 'ghz', 'ms']) renderResult($(`${g === 'chsh' ? 'chsh' : g}-result`), g, state.run);
  renderNoSignal($('nosig'), state.run);
  const runs = [...((state.info.atlas && state.info.atlas.runs) || [])];
  if (state.live && state.run && !state.run.custom) {
    const i = runs.findIndex((r) => r.profile.label === state.run.profile.label);
    if (i >= 0) runs.splice(i, 1);
    runs.unshift(state.run);
  }
  renderAtlas($('atlas'), runs, state.info.profile.label);
  noiseBudget($('noise'), runs);
  theDuel.refresh();
  const hit = state.run && state.run.games && state.run.games.ms && state.run.games.ms.cards[0];
  pauliSquare($('ms-pauli'), hit ? hit.cards : null);
}

function settingsChanged() {
  const best = JSON.stringify(state.angles) === JSON.stringify({ a0: 0, a1: 45, b0: 22.5, b1: -22.5 })
    && JSON.stringify(state.ghz) === JSON.stringify({ p0: ['X', 'Y'], p1: ['X', 'Y'], p2: ['X', 'Y'] });
  if (!state.sentJob) setStatus(best ? 'Best strategies set. Press Play to run all three games.' : 'Your own strategy is set. Press Play to see how it does on this machine.');
}

async function play(shotsOverride, optsOverride) {
  const p = state.info.profile;
  if (p.one_circuit && state.sentJob) {
    setStatus('IonQ machines take one job per run. Press Stop, then Run, to play again.', 'err');
    return;
  }
  const shots = Number(shotsOverride) > 0 ? Number(shotsOverride) : Number($('shots').value);
  const go = $('go');
  go.disabled = true;
  const t0 = performance.now();
  const tick = setInterval(() => { go.textContent = `Playing… ${Math.round((performance.now() - t0) / 1000)} s`; }, 1000);
  setStatus(p.hardware
    ? 'Real hardware: the job waits in IonQ’s queue, which can take minutes to hours. Keep this tab open.'
    : p.family === 'ionq'
      ? `Sending one circuit of up to ${p.cap} qubits, with every game in it, to ${p.label.replace(' noise model', '')}. IonQ simulates every shot: allow a minute or two.`
      : `Running every card set of all three games${p.family === 'ibm' ? ' on the IBM noise model in your browser' : ''}.`);
  console.log(`Playing on ${p.label}…`);
  try {
    if (p.one_circuit) state.sentJob = true;
    const opts = optsOverride || ($('what').value === 'ms' ? squareOptions() : null);
    const res = JSON.parse(await web.play.callPromising(backend, JSON.stringify(state.angles), JSON.stringify(state.ghz), shots, opts ? JSON.stringify(opts) : ''));
    if (!res.ok) {
      setStatus(res.error === 'one_job' ? 'IonQ machines take one job per run. Press Stop, then Run, to play again.'
        : `The run failed: ${res.message || 'unknown error'}. The console below has the details.`, 'err');
      return;
    }
    const best = JSON.stringify(state.angles) === JSON.stringify({ a0: 0, a1: 45, b0: 22.5, b1: -22.5 })
      && JSON.stringify(state.ghz) === JSON.stringify({ p0: ['X', 'Y'], p1: ['X', 'Y'], p2: ['X', 'Y'] });
    res.custom = !best;
    const prev = state.run;
    if (res.only && prev && prev.games && prev.profile.label === res.profile.label) {
      // a square-only run keeps the other games from the run already shown
      state.run = { ...prev, games: { ...prev.games, ...res.games }, rounds: { ...prev.rounds, ...res.rounds }, when: res.when, recorded: false };
    } else state.run = res;
    state.live = true;
    renderAll();
    const g = res.games;
    const secs = Math.round((performance.now() - t0) / 1000);
    const parts = [['chsh', 'Telepathy'], ['ghz', 'Three of a kind'], ['ms', 'Magic square']]
      .filter(([k]) => res.games[k]).map(([k, n]) => `${n} ${(res.games[k].win * 100).toFixed(1)}%`);
    setStatus(`Done in ${secs} s. ${parts.join(', ')}. Saved in the console as a JSON file.`, 'done');
    console.log(`Played in ${secs} s on ${p.label}: ` + Object.entries(g).map(([k, v]) => `${k} ${(v.win * 100).toFixed(1)}% of ${v.rounds}`).join(', '));
    document.getElementById(res.games.chsh ? 'chsh-result' : 'ms-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    const text = String(err && err.message ? err.message : err);
    setStatus(/one job/i.test(text) ? 'IonQ machines take one job per run. Press Stop, then Run, to play again.' : `The run failed: ${text.slice(0, 200)}`, 'err');
  } finally {
    clearInterval(tick);
    go.textContent = goLabel();
    go.disabled = p.one_circuit && state.sentJob;
  }
}

function setStatus(text, kind = '') {
  const s = $('status');
  s.textContent = text;
  s.className = 'status' + (kind ? ' ' + kind : '');
}

// The booths deal cards in a loop.
function heroLoop() {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = $('hero-card-a'), b = $('hero-card-b');
  setInterval(() => {
    for (const c of [a, b]) {
      c.classList.add('flip');
      setTimeout(() => { c.textContent = String(Math.random() < 0.5 ? 0 : 1); c.classList.remove('flip'); }, 350);
    }
  }, 2600);
}
