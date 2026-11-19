// Engine check: engine.js + shared HiGHS == the Python reference (test/expected.json) on the sample.
// Run from the repo root:  node tools/blend/test/engine.test.js
const path = require('path'), DIR = path.join(__dirname, '..'), H = path.join(DIR, '..', '..', 'assets', 'highs');
const HiGHS = require(path.join(H, 'highs.js')), EXP = require('./expected.json'), SAMPLE = require(path.join(DIR, 'sample.js'));
const ENGINE = require(path.join(DIR, 'engine.js'));
(async () => {
  let ok = true; const check = (n, c, i) => { console.log((c ? 'OK   ' : 'FAIL ') + n + (i ? '  ' + i : '')); ok = ok && c; };
  const h = await HiGHS({ locateFile: f => path.join(H, f) });
  const solveLP = async lp => { const r = h.solve(lp, { time_limit: 20, mip_rel_gap: 0 });
    return { status: r.Status, cols: Object.fromEntries(Object.entries(r.Columns).map(([k, v]) => [k, v.Primal])) }; };
  const t0 = Date.now(), r = await ENGINE.solve(SAMPLE, solveLP);
  console.log(`solved in ${Date.now() - t0} ms, ${r.status}`);
  await require('./checks.js')(r, EXP, check, SAMPLE, ENGINE, solveLP);
  console.log(ok ? 'ALL OK' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
