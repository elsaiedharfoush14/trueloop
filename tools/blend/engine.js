/* TrueLoop Optimise - product water blend engine (browser + Node). Same model as claude-kit design-optimizer/tools/blend.py:
   product quality = flow-weighted mix of the sources + chemical dose effects (linear); cheapest blend that stays
   margin % inside every spec limit. pH / LSI / CCPP are not linear: checked separately. Solved by HiGHS (LP). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.BlendEngine = factory();
})(this, function () {
  'use strict';
  function quality(c, flows, doses) {
    var q = c.sources.reduce(function (t, s) { return t + (flows[s.name] || 0); }, 0), out = {};
    c.params.forEach(function (p) {
      var v = q ? c.sources.reduce(function (t, s) { return t + (flows[s.name] || 0) * (s.q[p] || 0); }, 0) / q : 0;
      c.chemicals.forEach(function (k) { v += (doses[k.name] || 0) * (k.effect[p] || 0); });
      out[p] = v;
    });
    return out;
  }
  function cost(c, flows, doses) {
    var Q = c.product_m3h;
    var w = c.sources.reduce(function (t, s) { return t + (flows[s.name] || 0) * s.cost_m3; }, 0);
    var ch = c.chemicals.reduce(function (t, k) { return t + (doses[k.name] || 0) * Q / 1000 * k.cost_kg; }, 0);
    return { total: (w + ch) / Q, water: w / Q, chem: ch / Q };
  }
  function check(c, q) {
    var bad = [];
    Object.keys(c.spec).forEach(function (p) {
      var lo = c.spec[p][0], hi = c.spec[p][1];
      if (lo != null && q[p] < lo - 1e-6) bad.push({ p: p, v: q[p], lim: lo, dir: 'min' });
      if (hi != null && q[p] > hi + 1e-6) bad.push({ p: p, v: q[p], lim: hi, dir: 'max' });
    });
    return bad;
  }
  function buildLP(c) {
    var Q = c.product_m3h, m = (c.margin_pct == null ? 5 : c.margin_pct) / 100, L = ['Minimize', ' obj:'];
    var term = function (k, v) { return (k >= 0 ? '+ ' : '- ') + Math.abs(k) + ' ' + v; };
    c.sources.forEach(function (s, i) { L.push('  ' + term(s.cost_m3, 'f' + i)); });
    c.chemicals.forEach(function (k, j) { L.push('  ' + term(Q / 1000 * k.cost_kg, 'd' + j)); });
    L.push('Subject To', ' flow: ' + c.sources.map(function (s, i) { return '+ f' + i; }).join(' ') + ' = ' + Q);
    Object.keys(c.spec).forEach(function (p, pi) {
      var lhs = c.sources.map(function (s, i) { return term(s.q[p] || 0, 'f' + i); })
        .concat(c.chemicals.map(function (k, j) { return term(Q * (k.effect[p] || 0), 'd' + j); })).join(' ');
      var lo = c.spec[p][0], hi = c.spec[p][1];
      if (lo != null) L.push(' lo' + pi + ': ' + lhs + ' >= ' + (lo * (1 + m) * Q));
      if (hi != null) L.push(' hi' + pi + ': ' + lhs + ' <= ' + (hi * (1 - m) * Q));
    });
    L.push('Bounds');
    c.sources.forEach(function (s, i) { L.push(' ' + (s.min_m3h || 0) + ' <= f' + i + ' <= ' + (s.max_m3h == null ? Q : s.max_m3h)); });
    c.chemicals.forEach(function (k, j) { L.push(' ' + (k.min_mgL || 0) + ' <= d' + j + ' <= ' + (k.max_mgL == null ? 1000 : k.max_mgL)); });
    L.push('End');
    return L.join('\n');
  }
  function solve(c, solveLP) {
    var cur = { flows: c.current.flows, doses: c.current.doses };
    var cq = quality(c, cur.flows, cur.doses), cc = cost(c, cur.flows, cur.doses);
    return solveLP(buildLP(c)).then(function (r) {
      if (!/^optimal$/i.test(r.status)) return { current: { q: cq, cost: cc, bad: check(c, cq) }, opt: null, status: r.status };
      var flows = {}, doses = {};
      c.sources.forEach(function (s, i) { flows[s.name] = r.cols['f' + i] || 0; });
      c.chemicals.forEach(function (k, j) { doses[k.name] = r.cols['d' + j] || 0; });
      var oq = quality(c, flows, doses);
      return { current: { flows: cur.flows, doses: cur.doses, q: cq, cost: cc, bad: check(c, cq) },
        opt: { flows: flows, doses: doses, q: oq, cost: cost(c, flows, doses), bad: check(c, oq) }, status: 'OPTIMAL' };
    });
  }
  return { quality: quality, cost: cost, check: check, buildLP: buildLP, solve: solve };
});
