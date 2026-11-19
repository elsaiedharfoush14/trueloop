/* TrueLoop Optimise - cable drum engine (browser + Node). Same model as tools/cable_drums.py:
   a run is never spliced, store remnants cost 0, exact bin packing with several drum lengths, solved by HiGHS.
   The manual baseline = first-fit decreasing on the biggest drum, each drum then shortened to the cheapest length
   that holds its cuts (a careful storekeeper). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(this, function () {
  'use strict';

  const need = (run, c) => Math.ceil(run.length_m * (1 + (c.spare_pct || 0) / 100) + 2 * (c.allowance_m || 0));
  const drumCost = d => d.length_m * d.price_per_m + (d.drum_fee || 0);

  function manual(runs, types, stock) {
    const big = types.reduce((a, d) => (d.length_m > a.length_m ? d : a));
    const bins = stock.map(s => ({ kind: 'stock', id: s.id, cap: s.length_m, cost: 0, runs: [] }));
    const used = b => b.runs.reduce((t, r) => t + r.need, 0);
    for (const r of [...runs].sort((a, b) => b.need - a.need)) {
      const b = bins.find(b => b.cap - used(b) >= r.need);
      if (b) { b.runs.push(r); continue; }
      if (r.need > big.length_m) throw new Error(`run ${r.tag} needs ${r.need} m > biggest drum ${big.length_m} m`);
      bins.push({ kind: 'new', id: big.length_m + 'm', cap: big.length_m, cost: drumCost(big), runs: [r] });
    }
    for (const b of bins) {
      if (b.kind !== 'new') continue;
      const u = used(b);
      let best = null;
      for (const d of types) if (d.length_m >= u && (!best || drumCost(d) < drumCost(best))) best = d;
      Object.assign(b, { id: best.length_m + 'm', cap: best.length_m, cost: drumCost(best) });
    }
    return bins.filter(b => b.runs.length || b.kind === 'new');
  }

  function candidates(runs, types, stock) {
    const cand = stock.map(s => ({ kind: 'stock', id: s.id, cap: s.length_m, cost: 0 }));
    for (const d of types) {
      const fit = runs.filter(r => r.need <= d.length_m);
      const n = Math.min(fit.length, Math.ceil(fit.reduce((t, r) => t + r.need, 0) / d.length_m) + 2);
      for (let k = 0; k < n; k++) cand.push({ kind: 'new', id: d.length_m + 'm', cap: d.length_m, cost: drumCost(d) });
    }
    return cand;
  }

  /* CPLEX LP text for HiGHS. x_i_j = run i on drum j, u_j = drum j used. */
  function buildLP(runs, cand) {
    const lines = ['Minimize', ' obj:'];
    const push = (terms, out) => { for (let k = 0; k < terms.length; k += 8) out.push('  ' + terms.slice(k, k + 8).join(' ')); };
    push(cand.map((b, j) => `+ ${Math.round(b.cost * 100) + 1} u${j}`), lines);
    lines.push('Subject To');
    const fits = runs.map(r => cand.map((b, j) => (r.need <= b.cap ? j : -1)).filter(j => j >= 0));
    runs.forEach((r, i) => {
      if (!fits[i].length) throw new Error(`run ${r.tag} needs ${r.need} m > every drum`);
      lines.push(` a${i}:`); push(fits[i].map(j => `+ x${i}_${j}`), lines); lines.push('  = 1');
    });
    cand.forEach((b, j) => {
      const terms = runs.map((r, i) => (fits[i].includes(j) ? `+ ${r.need} x${i}_${j}` : null)).filter(Boolean);
      if (!terms.length) return;
      lines.push(` c${j}:`); push(terms, lines); lines.push(`  - ${b.cap} u${j} <= 0`);
    });
    for (let j = 1; j < cand.length; j++)
      if (cand[j].kind === 'new' && cand[j - 1].kind === 'new' && cand[j].id === cand[j - 1].id)
        lines.push(` s${j}: u${j} - u${j - 1} <= 0`);
    lines.push('Binary');
    const vars = cand.map((b, j) => `u${j}`);
    runs.forEach((r, i) => fits[i].forEach(j => vars.push(`x${i}_${j}`)));
    push(vars, lines);
    lines.push('End');
    return { lp: lines.join('\n'), fits };
  }

  function readSolution(runs, cand, fits, cols) {
    const v = n => (cols[n] || 0) > 0.5;
    const bins = [];
    cand.forEach((b, j) => {
      if (!v(`u${j}`)) return;
      const rs = runs.filter((r, i) => fits[i].includes(j) && v(`x${i}_${j}`));
      if (rs.length || b.kind === 'new') bins.push({ ...b, runs: rs });
    });
    return bins;
  }

  function summary(bins) {
    const neu = bins.filter(b => b.kind === 'new');
    return {
      cost: bins.reduce((t, b) => t + b.cost, 0),
      waste: neu.reduce((t, b) => t + b.cap - b.runs.reduce((s, r) => s + r.need, 0), 0),
      drums: neu.length,
    };
  }

  /* solve(model, solveLP) - solveLP(lpText) -> Promise<{status, cols}>; one LP per cable size. */
  async function solve(model, solveLP, onProgress) {
    const runs = model.runs.map(r => ({ ...r, need: need(r, model) }));
    const sizes = [...new Set(runs.map(r => r.size))].sort();
    const out = { sizes: [], total: { manual: 0, opt: 0, wasteManual: 0, wasteOpt: 0 }, order: {} };
    for (const [k, size] of sizes.entries()) {
      if (onProgress) onProgress(k, sizes.length, size);
      const rs = runs.filter(r => r.size === size);
      const types = model.drums[size];
      if (!types || !types.length) throw new Error(`no drum types for ${size}`);
      const stock = (model.stock || []).filter(s => s.size === size);
      const mb = manual(rs, types, stock);
      const cand = candidates(rs, types, stock);
      const { lp, fits } = buildLP(rs, cand);
      const res = await solveLP(lp);
      if (!/optimal|limit/i.test(res.status) || !Object.keys(res.cols || {}).length)
        throw new Error(`no plan for ${size}: ${res.status}`);
      const ob = readSolution(rs, cand, fits, res.cols);
      const m = summary(mb), o = summary(ob);
      const plan = [...ob].sort((a, b) => (a.kind !== 'stock') - (b.kind !== 'stock') || b.cap - a.cap).map((b, i) => {
        let left = b.cap;
        const cuts = [...b.runs].sort((a, c) => c.need - a.need).map(r => { left -= r.need; return { tag: r.tag, route: r.length_m, cut: r.need, left }; });
        return { n: i + 1, kind: b.kind, id: b.id, cap: b.cap, cuts, left };
      });
      for (const b of ob) if (b.kind === 'new') out.order[`${size}|${b.id}`] = (out.order[`${size}|${b.id}`] || 0) + 1;
      out.sizes.push({ size, runs: rs.length, need: rs.reduce((t, r) => t + r.need, 0), manual: m, opt: o,
        status: /optimal/i.test(res.status) ? 'OPTIMAL' : 'FEASIBLE (time limit)', plan });
      out.total.manual += m.cost; out.total.opt += o.cost; out.total.wasteManual += m.waste; out.total.wasteOpt += o.waste;
    }
    return out;
  }

  return { need, drumCost, manual, candidates, buildLP, readSolution, summary, solve };
});
