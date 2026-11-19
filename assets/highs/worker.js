/* Shared HiGHS worker for the Optimise tools (new Worker('../../assets/highs/worker.js')). Runs HiGHS off the main thread. Message {id, lp, timeLimit} -> {id, status, cols} or {id, error}. */
importScripts('highs.js');
let solver = null;
const load = () => (solver = Module({ locateFile: f => f }));
load();
onmessage = async e => {
  const { id, lp, timeLimit } = e.data;
  try {
    const h = await solver;
    const r = h.solve(lp, { time_limit: timeLimit || 20, mip_rel_gap: 0 });
    const cols = {};
    for (const [k, v] of Object.entries(r.Columns)) cols[k] = v.Primal;
    postMessage({ id, status: r.Status, cols });
  } catch (err) {
    load();   // HiGHS can be left broken after an abort: start a fresh instance for the next call
    postMessage({ id, error: String(err && err.message || err) });
  }
};
