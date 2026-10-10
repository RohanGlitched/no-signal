// Stands in for the Python module nosig.web during local design work.
const get = async (f) => (await fetch(f)).text();
const fn = (impl) => ({ callPromising: impl, callPromisingKwargs: impl });
const params = new URLSearchParams(location.search);
const RUN = params.get('run') ? `./run-${params.get('run')}.json` : './run.json';
export const boot = fn(async () => {
  const b = JSON.parse(await get('./boot.json'));
  try { b.atlas = JSON.parse(await get('../data/atlas.json')); } catch (e) {}
  if (!b.atlas || !b.atlas.runs || !b.atlas.runs.length) {
    const r = JSON.parse(await get('./run.json')); r.recorded = true; b.atlas = { runs: [r] };
  }
  return JSON.stringify(b);
});
export const play = fn(async () => {
  await new Promise((r) => setTimeout(r, Number(params.get('delay') || 2000)));
  return await get(RUN);
});
