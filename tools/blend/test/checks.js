module.exports = async (r, E, check, S, ENG, solveLP) => {
  check('current cost = Python', Math.abs(r.current.cost.total - E.current_cost_m3) < 1e-4, r.current.cost.total.toFixed(4));
  check('optimised cost = Python', r.opt && Math.abs(r.opt.cost.total - E.opt_cost_m3) < 1e-4, r.opt && r.opt.cost.total.toFixed(4));
  check('optimised flows = Python', Object.keys(E.opt_flows).every(k => Math.abs(r.opt.flows[k] - E.opt_flows[k]) < 0.2));
  check('optimised meets every spec limit', r.opt.bad.length === 0);
  check('flows add up to the product', Math.abs(Object.values(r.opt.flows).reduce((a, b) => a + b, 0) - S.product_m3h) < 1e-6);
  check('LSI + Larson = Python (current and optimised)', ['LSI', 'Larson'].every(k => Math.abs(r.current.ix[k] - E.current_ix[k]) < 2e-3 && Math.abs(r.opt.ix[k] - E.opt_ix[k]) < 2e-3),
    JSON.stringify({ cur: r.current.ix, opt: r.opt.ix }));
  const r2 = await ENG.solve(Object.assign({}, S, { larson_max: 2.33 }), solveLP);
  check('Larson limit 2.33 = Python (cost, ratio)', Math.abs(r2.opt.cost.total - E.larson_2_33.opt_cost_m3) < 1e-4 && r2.opt.ix.Larson <= 2.33 + 1e-6,
    `${r2.opt.cost.total.toFixed(4)} / ${r2.opt.ix.Larson.toFixed(3)}`);
};
