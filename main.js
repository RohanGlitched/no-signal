// No Signal: page logic. Circuits and scoring live in nosig/ (Python); this
// file draws the arcade and calls it with the backend picked in Qollab's dialog.
import * as web from 'nosig.web';
import { chshSandbox, ghzSandbox, magicGrid } from './ui/sandbox.js';
import { chshDials, ghzBases, pauliSquare } from './ui/controls.js';
import { renderBoards, renderResult, renderNoSignal, renderAtlas, staticWall, isRecorded } from './ui/results.js';
import { noiseBudget } from './ui/noise.js';
import { duel } from './ui/duel.js';
import { reduceMotion, pct } from './ui/svg.js';

const $ = (id) => document.getElementById(id);
const BEST_ANGLES = { a0: 0, a1: 45, b0: 22.5, b1: -22.5 };
const BEST_GHZ = { p0: ['X', 'Y'], p1: ['X', 'Y'], p2: ['X', 'Y'] };
const CLASSICAL = { chsh: 0.75, ghz: 0.75, ms: 8 / 9 };
const ALL_PAIRS = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]];
const ONE_JOB = 'IonQ machines take one job per run. Press Stop, then Run, to play again.';
const state = {
  info: null, run: null, live: false, sentJob: false, busy: false, visibility: 1,
  angles: { ...BEST_ANGLES },
  ghz: { p0: [...BEST_GHZ.p0], p1: [...BEST_GHZ.p1], p2: [...BEST_GHZ.p2] },
};

console.log('No Signal: loading the arcade…');

// Qollab's host page can ask for the status (or press Play) with postMessage;
// that is how the page is tested end to end inside the sandboxed frame.
globalThis.addEventListener('message', (e) => {
  if (!e.data || typeof e.data.ns !== 'string') return;
  if (e.origin !== 'https://qollab.xyz' && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(e.origin)) return;
  if (e.data.ns === 'run') play(e.data.shots, e.data.opts);
  if (e.data.ns === 'dump' && state.run) {
    (e.source || window.parent).postMessage({ ns: 'dump', run: JSON.stringify(state.run) }, '*');
    return;
  }
  const g = state.run && state.run.games;
  (e.source || window.parent).postMessage({
    ns: 'state', status: $('status').textContent, provenance: $('prov').textContent, live: state.live,
    ready: !!state.info, machine: state.info && state.info.profile.label,
    atlas: state.info && state.info.atlas ? state.info.atlas.runs.length : 0,
    games: g ? Object.fromEntries(Object.entries(g).map(([k, v]) => [k, [v.win, v.rounds, v.S, v.covered]])) : null,
  }, '*');
});

// Until the machine is read, Play stays off and the boards show only the limits.
$('go').disabled = true;
setStatus('Loading the arcade…');
renderBoards($('boards'), null, CLASSICAL, 'reading the machine…');

staticWall($('static'));
heroLoop();
chshSandbox($('chsh-sandbox'));
ghzSandbox($('ghz-sandbox'));
magicGrid($('ms-grid'));
const redrawDials = chshDials($('chsh-dials'), state, settingsChanged);
const redrawBases = ghzBases($('ghz-bases'), state, settingsChanged);
pauliSquare($('ms-pauli'));
const theDuel = duel($('duel'), () => (state.run && state.run.rounds && state.run.rounds.chsh && state.run.rounds.chsh.length ? state.run : null));
$('chsh-best').addEventListener('click', () => { state.angles = { ...BEST_ANGLES }; redrawDials(); settingsChanged(); });
$('ghz-best').addEventListener('click', () => { state.ghz = { p0: [...BEST_GHZ.p0], p1: [...BEST_GHZ.p1], p2: [...BEST_GHZ.p2] }; redrawBases(); settingsChanged(); });
$('go').addEventListener('click', () => play());
$('what').addEventListener('change', () => { if (!state.busy) $('go').textContent = goLabel(); });

function goLabel() {
  return $('what').value === 'ms' ? 'Play the magic square' : 'Play all three games';
}

const isBest = () => JSON.stringify(state.angles) === JSON.stringify(BEST_ANGLES) && JSON.stringify(state.ghz) === JSON.stringify(BEST_GHZ);

// The recorded main job (all three games) on exactly this machine, if it
// played magic-square pairs of its own: a square-only job pools with those.
function recordedMain() {
  const p = state.info && state.info.profile;
  const runs = (state.info && state.info.atlas && state.info.atlas.runs) || [];
  return (p && runs.find((r) => r.profile.label === p.label && r.ms_main && r.ms_main.length)) || null;
}

// The whole square: every one of the 9 row and column pairs. Local simulators
// ask all nine. A one-circuit machine fits 7 rounds per job beside nothing
// else, so it asks the 7 pairs the recorded main job on this machine did not
// play; with those two, all nine are covered. (2,2) goes first so it is asked
// even if a smaller machine fits fewer rounds.
function squareOptions() {
  if (!state.info.profile.one_circuit) return { games: ['ms'], ms_cards: ALL_PAIRS };
  const rec = recordedMain();
  const have = new Set(rec ? rec.ms_main_cards.map((c) => c.join()) : []);
  const rest = ALL_PAIRS.filter((c) => !have.has(c.join()));
  rest.sort((a, b) => (b.join() === '2,2') - (a.join() === '2,2'));
  return { games: ['ms'], ms_cards: rest };
}

try {
  await boot();
} catch (err) {
  console.error(err);
  $('m-name').textContent = 'Could not read the machine';
  $('m-meta').textContent = '';
  renderBoards($('boards'), null, CLASSICAL, 'no machine to play on');
  setStatus('The arcade could not start: ' + (err && err.message ? err.message : String(err)), 'err');
}
// Keep the run alive so the page can call Python again. Press Stop to end it.
await new Promise(() => {});

async function boot() {
  state.info = JSON.parse(await web.boot.callPromising(backend));
  const p = state.info.profile;
  $('m-name').textContent = p.label;
  $('m-dot').className = 'dot ' + (p.family === 'ionq' ? '' : p.family);
  const f = state.info.fits;
  $('m-meta').textContent = p.one_circuit
    ? `${p.family === 'ionq' ? 'Trapped ions · ' : ''}one job of one circuit, up to ${p.cap} qubits: ${f.chsh ? 'Telepathy' : ''}${f.ghz ? ', Three of a kind' : ''}${f.ms ? `, ${f.ms} magic-square rounds` : ''}`
    : `${p.family === 'ibm' ? 'Superconducting · runs in your browser' : 'No noise of its own · runs in your browser'} · every card set of all three games`;
  state.run = pickRecorded();
  renderAll();
  setStatus(state.run ? 'Showing a recorded run. Press Play to measure your own.' : 'Press Play to run all three games.');
  $('go').disabled = false;
  console.log(`No Signal is ready on ${p.label} (${p.family}).`);
}

function pickRecorded() {
  const runs = (state.info.atlas && state.info.atlas.runs) || [];
  const p = state.info.profile;
  return runs.find((r) => r.profile.label === p.label)
    || runs.find((r) => r.profile.model === p.model)
    || runs.find((r) => r.profile.model === 'forte-enterprise-1') || runs[0] || null;
}

// Where the numbers on the boards came from. Kept apart from the status line,
// which the dials and Play rewrite.
function provenance() {
  const run = state.run;
  if (!run) return 'No run recorded on this machine yet. Press Play to measure one.';
  const label = run.profile.label;
  const here = state.info && label === state.info.profile.label;
  const width = run.profile.one_circuit && run.logical_qubits
    ? ` · one circuit of ${run.logical_qubits} qubits${run.qubits && run.qubits !== run.logical_qubits ? ` (${run.qubits} after transpiling)` : ''}`
    : '';
  if (!state.live) {
    const pooled = run.ms_jobs ? ' · magic square pools a second, square-only job' : '';
    return `Recorded on ${label} · ${run.when}${width}${pooled}${here ? '' : ' · nothing recorded on your machine yet'}`;
  }
  if (run.kept && run.kept.length) {
    const ms = run.games.ms && run.games.ms.pooled;
    const what = ms ? `${ms.now} magic-square pairs measured just now, ${ms.recorded} from the recorded job of ${ms.when}` : 'Magic square measured just now';
    return `${label} · ${what} · the other games recorded ${run.recorded_when || ''}`.trim();
  }
  if (Number.isFinite(run.visibility)) return `Measured just now on ${label} at ${pct(run.visibility)} visibility: every shared state mixed with noise on purpose`;
  return `Measured just now on ${label}${width}`;
}

function renderAll() {
  renderBoards($('boards'), state.run, state.info.classical);
  $('prov').textContent = provenance();
  for (const g of ['chsh', 'ghz', 'ms']) renderResult($(`${g}-result`), g, state.run);
  renderNoSignal($('nosig'), state.run);
  const runs = [...((state.info.atlas && state.info.atlas.runs) || [])];
  if (state.live && state.run && !state.run.custom) {
    const i = runs.findIndex((r) => r.profile.label === state.run.profile.label);
    if (i >= 0) runs.splice(i, 1);
    runs.unshift(state.run);
  }
  renderAtlas($('atlas'), runs, state.info.profile.label);
  noiseBudget($('noise'), runs, {
    v: state.visibility, drives: !state.info.profile.one_circuit,
    live: state.live && state.run && Number.isFinite(state.run.visibility) ? state.run : null,
    onChange: (v) => { state.visibility = v; settingsChanged(); },
  });
  theDuel.refresh();
  const hit = state.run && state.run.games && state.run.games.ms && state.run.games.ms.cards[0];
  pauliSquare($('ms-pauli'), hit ? hit.cards : null);
}

// Play mixes noise in on purpose when the noise figure's slider is below 100%
// (local simulators only; IonQ's one job uses the machine's own noise).
function mixing() { return !!state.info && !state.info.profile.one_circuit && state.visibility < 1; }

function settingsChanged() {
  if (state.sentJob || state.busy || !state.info) return;
  const vis = mixing() ? ` Visibility is set to ${pct(state.visibility)} in the noise figure, so Play mixes noise into every shared state.` : '';
  setStatus((isBest() ? 'Best strategies set. Press Play to run all three games.' : 'Your own strategy is set. Press Play to see how it does on this machine.') + vis);
}

async function play(shotsOverride, optsOverride) {
  if (!state.info || state.busy) return;          // still booting, or already playing
  const p = state.info.profile;
  if (p.one_circuit && state.sentJob) {
    setStatus(ONE_JOB, 'err');
    return;
  }
  const shots = Number(shotsOverride) > 0 ? Number(shotsOverride) : Number($('shots').value);
  const go = $('go');
  state.busy = true;
  go.disabled = true;
  go.classList.add('busy');
  const t0 = performance.now();
  go.textContent = 'Playing… 0 s';
  const tick = setInterval(() => { go.textContent = `Playing… ${Math.round((performance.now() - t0) / 1000)} s`; }, 1000);
  let opts = optsOverride || ($('what').value === 'ms' ? squareOptions() : null);
  if (!optsOverride && mixing()) opts = { ...(opts || {}), visibility: state.visibility };
  const squareOnly = opts && opts.games && opts.games.length === 1 && opts.games[0] === 'ms';
  setStatus(p.hardware
    ? 'Real hardware: the job waits in IonQ’s queue, which can take minutes to hours. Keep this tab open.'
    : p.family === 'ionq'
      ? `Sending one circuit of up to ${p.cap} qubits, with ${squareOnly ? `${Math.min(opts.ms_cards.length, Math.floor(p.cap / 4))} magic-square rounds` : 'every game'} in it, to ${p.label}. IonQ simulates every shot: allow two to three minutes; explore the games meanwhile.`
      : `Running every card set of ${squareOnly ? 'the magic square' : 'all three games'}${p.family === 'ibm' ? ' on the IBM noise model in your browser' : ''}${opts && opts.visibility ? `, each as a mixture at ${pct(opts.visibility)} visibility (up to 16 versions per card set${p.family === 'ibm' ? ': allow a minute or two' : ''})` : ''}.`);
  console.log(`Playing on ${p.label}…`);
  try {
    const res = JSON.parse(await web.play.callPromising(backend, JSON.stringify(state.angles), JSON.stringify(state.ghz), shots, opts ? JSON.stringify(opts) : ''));
    // the run's one job is spent once IonQ has accepted it, even if scoring failed after
    if (p.one_circuit && (res.ok || res.error === 'one_job' || res.submitted)) state.sentJob = true;
    if (!res.ok) {
      setStatus(res.error === 'one_job' ? ONE_JOB : `The run failed: ${res.message || 'unknown error'}. The console below has the details.`, 'err');
      return;
    }
    res.custom = !isBest() || Number.isFinite(res.visibility);
    const prev = state.run;
    if (res.only && prev && prev.games && prev.profile.label === res.profile.label) {
      // a square-only run keeps the other games from the run already shown
      const kept = Object.keys(prev.games).filter((g) => !res.games[g] && isRecorded(prev, g));
      state.run = { ...prev, games: { ...prev.games, ...res.games }, rounds: { ...prev.rounds, ...res.rounds }, when: res.when,
        recorded: false, kept, recorded_when: prev.recorded ? prev.when : prev.recorded_when, custom: res.custom || prev.custom,
        circuits: res.circuits, logical_qubits: res.logical_qubits, qubits: res.qubits };
    } else state.run = res;
    // one circuit cannot ask all nine pairs: pool card by card with the two
    // the recorded main job on this machine asked
    const ms = res.games.ms, rec = p.one_circuit && ms && ms.covered < 9 ? recordedMain() : null;
    if (rec) {
      try {
        const pooled = JSON.parse(await web.pool.callPromising('ms', JSON.stringify(rec.ms_main), JSON.stringify(ms.cards)));
        if (pooled.covered > ms.covered) {
          pooled.pooled = { now: ms.covered, recorded: pooled.covered - ms.covered, when: rec.when };
          state.run.games = { ...state.run.games, ms: pooled };
        }
      } catch (err) {
        console.error(err);
      }
    }
    state.live = true;
    renderAll();
    const secs = Math.round((performance.now() - t0) / 1000);
    const g = state.run.games;
    const parts = [['chsh', 'Telepathy'], ['ghz', 'Three of a kind'], ['ms', 'Magic square']]
      .filter(([k]) => res.games[k]).map(([k, n]) => `${n} ${pct(g[k].win)}${g[k].pooled ? ` (${g[k].pooled.now} pairs measured now + ${g[k].pooled.recorded} from the recorded job on this machine)` : ''}`);
    setStatus(`Done in ${secs} s. ${parts.join(', ')}. Saved in the console as a JSON file.`, 'done');
    console.log(`Played in ${secs} s on ${p.label}: ` + Object.entries(res.games).map(([k, v]) => `${k} ${(v.win * 100).toFixed(1)}% of ${v.rounds}`).join(', '));
    $(res.games.chsh ? 'chsh-result' : 'ms-result').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    const text = String(err && err.message ? err.message : err);
    if (p.one_circuit && /one job/i.test(text)) state.sentJob = true;
    setStatus(/one job/i.test(text) ? ONE_JOB : `The run failed: ${text.slice(0, 200)}`, 'err');
  } finally {
    clearInterval(tick);
    state.busy = false;
    go.classList.remove('busy');
    go.textContent = goLabel();
    go.disabled = p.one_circuit && state.sentJob;
  }
}

function setStatus(text, kind = '') {
  const s = $('status');
  s.textContent = text;
  s.className = 'status' + (kind ? ' ' + kind : '');
}

// The booths deal cards in a loop, only while they are on screen.
function heroLoop() {
  if (reduceMotion()) return;
  const a = $('hero-card-a'), b = $('hero-card-b');
  let timer = 0;
  const deal = () => {
    for (const c of [a, b]) {
      c.classList.add('flip');
      setTimeout(() => { c.textContent = String(Math.random() < 0.5 ? 0 : 1); c.classList.remove('flip'); }, 350);
    }
  };
  const start = () => { if (!timer) timer = setInterval(deal, 2600); };
  const stop = () => { clearInterval(timer); timer = 0; };
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver((es) => { if (es[es.length - 1].isIntersecting) start(); else stop(); }).observe(a.closest('.booths') || a);
  } else start();
}
