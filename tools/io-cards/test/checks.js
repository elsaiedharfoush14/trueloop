module.exports = (r, E, check, S, ENG) => {
  check('manual = Python (cost / modules / group clashes)', r.manual.s.cost === E.manual.cost && r.manual.s.modules === E.manual.modules && r.manual.s.clash === E.manual.clash, JSON.stringify(r.manual.s));
  check('optimised cost = Python', r.opt.s.cost === E.opt.cost, `js=${r.opt.s.cost} py=${E.opt.cost}`);
  check('optimised: 0 group clashes, within max modules', r.opt.s.clash === 0 && r.opt.s.modules <= S.max_modules);
  const placed = r.opt.cards.flatMap(c => c.sig.map(s => s.tag));
  check('every signal placed exactly once', placed.length === S.signals.length && new Set(placed).size === S.signals.length);
  check('no card over its channels', r.opt.cards.every(c => Object.keys(c.ch).every(t => c.sig.filter(s => s.type === t).length <= c.ch[t])));
  const inst = t => r.opt.cards.reduce((a, c) => a + (c.ch[t] || 0), 0);
  check('spare per type met', ENG.TYPES.every(t => inst(t) >= r.need[t]));
};
