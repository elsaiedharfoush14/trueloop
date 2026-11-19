module.exports = async (r, E, check, S, ENG, solveLP) => {
  check('manual = Python (cost / modules / group clashes)', r.manual.s.cost === E.manual.cost && r.manual.s.modules === E.manual.modules && r.manual.s.clash === E.manual.clash, JSON.stringify(r.manual.s));
  check('optimised cost + modules = Python', r.opt.s.cost === E.opt.cost && r.opt.s.modules === E.opt.modules, `js=${r.opt.s.cost}/${r.opt.s.modules} py=${E.opt.cost}/${E.opt.modules}`);
  check('optimised: 0 group clashes, within max modules', r.opt.s.clash === 0 && r.opt.s.modules <= S.max_modules);
  const placed = r.opt.cards.flatMap(c => c.sig.map(s => s.tag));
  check('every signal placed exactly once (incl. RTD)', placed.length === S.signals.length && new Set(placed).size === S.signals.length);
  check('no card over its channels', r.opt.cards.every(c => Object.keys(c.ch).every(t => c.sig.filter(s => s.type === t).length <= c.ch[t])));
  const inst = t => r.opt.cards.reduce((a, c) => a + (c.ch[t] || 0), 0);
  check('spare per type met', Object.keys(r.need).every(t => inst(t) >= r.need[t]));
  check('RTD signals only on RTD channels', r.opt.cards.every(c => c.sig.filter(s => s.type === 'RTD').length <= (c.ch.RTD || 0)));
  const r2 = await ENG.solve(Object.assign({}, S, { separate_groups: false }), solveLP);
  check('separate_groups off = Python (cost)', r2.opt.s.cost === E.no_groups.opt.cost && r2.manual.s.clash === 0, `${r2.opt.s.cost}`);
};
