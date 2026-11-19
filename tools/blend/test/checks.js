module.exports = (r, E, check, S, ENG) => {
  check('current cost = Python', Math.abs(r.current.cost.total - E.current_cost_m3) < 1e-4, r.current.cost.total.toFixed(4));
  check('optimised cost = Python', r.opt && Math.abs(r.opt.cost.total - E.opt_cost_m3) < 1e-4, r.opt && r.opt.cost.total.toFixed(4));
  check('optimised flows = Python', Object.keys(E.opt_flows).every(k => Math.abs(r.opt.flows[k] - E.opt_flows[k]) < 0.2));
  check('optimised meets every spec limit', r.opt.bad.length === 0);
  check('flows add up to the product', Math.abs(Object.values(r.opt.flows).reduce((a, b) => a + b, 0) - S.product_m3h) < 1e-6);
};
