// Engine check: engine.js + vendored HiGHS == the Python reference (test/expected.json) on the sample.
// Run from the repo root:  node tools/cable-drums/test/engine.test.js
const path = require('path'), DIR = path.join(__dirname, '..');
const Engine = require(path.join(DIR, 'engine.js')), HiGHS = require(path.join(DIR, 'vendor', 'highs.js'));
const SAMPLE = require(path.join(DIR, 'sample.js')), EXP = require('./expected.json');
(async () => {
  let ok = true; const check = (n, c, i) => { console.log((c ? 'OK   ' : 'FAIL ') + n + (i ? '  ' + i : '')); ok = ok && c; };
  const h = await HiGHS({ locateFile: f => path.join(DIR, 'vendor', f) });
  const t0 = Date.now();
  const r = await Engine.solve(SAMPLE, async lp => {
    const s = h.solve(lp, { time_limit: 20, mip_rel_gap: 0 });
    return { status: s.Status, cols: Object.fromEntries(Object.entries(s.Columns).map(([k, v]) => [k, v.Primal])) };
  });
  console.log(`solved ${r.sizes.length} sizes in ${Date.now() - t0} ms`);
  for (const s of r.sizes) {
    const e = EXP.sizes[s.size];
    check(`${s.size}: runs / need / manual / optimised`, e && e.runs === s.runs && e.need === s.need &&
      e.manual === Math.round(s.manual.cost) && e.opt === Math.round(s.opt.cost), `expected ${e && e.opt}, got ${Math.round(s.opt.cost)} ${s.status}`);
    const cuts = s.plan.flatMap(b => b.cuts.map(c => c.tag));
    check(`${s.size}: each run once, no drum over length`, cuts.length === s.runs && new Set(cuts).size === s.runs && s.plan.every(b => b.left >= 0));
  }
  check('totals', Math.round(r.total.opt) === EXP.total_opt && Math.round(r.total.manual) === EXP.total_manual);
  console.log(ok ? 'ALL OK' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
