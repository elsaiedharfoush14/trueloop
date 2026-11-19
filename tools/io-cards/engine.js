/* TrueLoop Optimise - I/O card engine (browser + Node). Same model as claude-kit design-optimizer/tools/io_cards.py:
   installed channels per type >= used x (1 + spare), one redundancy group never twice on a card, fixed items (CPU
   onboard I/O) always in, max signal modules, lowest card cost then fewest areas per card. Solved by HiGHS. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.IOEngine = factory();
})(this, function () {
  'use strict';
  var TYPES = ['DI', 'DO', 'AI', 'AO'];
  function typesOf(sigs) {   // DI, DO, AI, AO, then any other type (RTD, DI-230V ...) - same as io_cards.py types_of
    var extra = sigs.map(function (s) { return s.type; }).filter(function (t, i, a) { return TYPES.indexOf(t) < 0 && a.indexOf(t) === i; }).sort();
    return TYPES.concat(extra);
  }
  var GROUP_RE = /^(.*?\d+)([A-D])(\b|[-_./ ].*)$/;
  function normType(raw) {
    var t = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (/^(DI|DIN|DIGITALIN|DIGITALINPUT|BI)$/.test(t)) return 'DI';
    if (/^(DO|DQ|DOUT|DIGITALOUT|DIGITALOUTPUT|BO)$/.test(t)) return 'DO';
    if (/^(AI|AIN|ANALOGIN|ANALOGINPUT)$/.test(t)) return 'AI';
    if (/^(AO|AQ|AOUT|ANALOGOUT|ANALOGOUTPUT)$/.test(t)) return 'AO';
    return String(raw || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9\-]/g, '');   // RTD, DI-230V ... (needs a card with it)
  }
  function groupOf(s) {
    if (s.group) return s.group;
    var m = GROUP_RE.exec(s.tag);
    return m ? m[1] + '*' + m[3] + '|' + s.type : null;
  }
  function prep(signals, separate) {
    var sigs = signals.map(function (s) { return Object.assign({}, s, { type: s.type.toUpperCase(), area: s.area || '-' }); });
    var cnt = {};
    sigs.forEach(function (s) { s.grp = separate === false ? null : groupOf(s); if (s.grp) cnt[s.grp] = (cnt[s.grp] || 0) + 1; });
    sigs.forEach(function (s) { if (s.grp && cnt[s.grp] < 2) s.grp = null; });
    return sigs;
  }
  function need(sigs, c) {
    var sp = (c.spare_pct || 0) / 100, o = {};
    typesOf(sigs).forEach(function (t) { o[t] = Math.ceil(sigs.filter(function (s) { return s.type === t; }).length * (1 + sp) - 1e-9); });
    return o;
  }
  function fixedCards(cat) {
    var out = [];
    cat.filter(function (c) { return c.fixed; }).forEach(function (c) { for (var i = 0; i < c.fixed; i++) out.push({ name: c.name, ch: c.ch, price: c.price, fixed: true, sig: [] }); });
    return out;
  }
  function manual(sigs, c) {
    var cards = fixedCards(c.catalog), nt = need(sigs, c);
    typesOf(sigs).forEach(function (t) {
      var ts = sigs.filter(function (s) { return s.type === t; });
      if (!ts.length) return;
      var single = c.catalog.filter(function (k) { return !k.fixed && Object.keys(k.ch).length === 1 && k.ch[t]; });
      if (!single.length) throw new Error('no single-type card for ' + t + ' in the catalog');
      var std = single.slice().sort(function (a, b) { return a.price / a.ch[t] - b.price / b.ch[t] || b.ch[t] - a.ch[t]; })[0];
      var inst = cards.reduce(function (a, k) { return a + (k.ch[t] || 0); }, 0);
      while (inst < nt[t]) { cards.push({ name: std.name, ch: std.ch, price: std.price, fixed: false, sig: [] }); inst += std.ch[t]; }
      ts.forEach(function (s) {
        for (var i = 0; i < cards.length; i++) {
          var k = cards[i];
          if (k.sig.filter(function (x) { return x.type === t; }).length < (k.ch[t] || 0)) { k.sig.push(s); break; }
        }
      });
    });
    return cards;
  }
  function build(sigs, c) {
    var nt = need(sigs, c), cand = [];
    var groups = {}; sigs.forEach(function (s) { if (s.grp) groups[s.grp] = (groups[s.grp] || 0) + 1; });
    var gmax = Math.max.apply(null, [0].concat(Object.keys(groups).map(function (g) { return groups[g]; })));
    c.catalog.forEach(function (k) {
      if (k.fixed) { for (var i = 0; i < k.fixed; i++) cand.push(Object.assign({}, k, { fx: true })); return; }
      var n = Math.max.apply(null, [0].concat(Object.keys(k.ch).filter(function (t) { return nt[t]; }).map(function (t) { return Math.ceil(nt[t] / k.ch[t]); })));
      n = Math.min(Math.max(n, gmax), k.max_qty || 99);
      for (var j = 0; j < n; j++) cand.push(Object.assign({}, k, { fx: false }));
    });
    var areas = [], classes = [], cls = {};
    sigs.forEach(function (s) { if (areas.indexOf(s.area) < 0) areas.push(s.area); });
    sigs.forEach(function (s) { if (s.grp) return; var key = s.area + '|' + s.type; if (!cls[key]) { cls[key] = { a: areas.indexOf(s.area), t: s.type, list: [] }; classes.push(cls[key]); } cls[key].list.push(s); });
    var gs = sigs.filter(function (s) { return s.grp; });
    var L = [], obj = [], cons = [], bin = [], gen = [], bnd = [];
    var nv = [], zv = [], yv = {};
    cand.forEach(function (k, j) {
      obj.push('+ ' + (Math.round(k.price * 100)) + ' u' + j);
      if (k.fx) bnd.push(' u' + j + ' = 1'); else bin.push('u' + j);
      areas.forEach(function (a, ai) { var y = 'y' + ai + '_' + j; yv[ai + '_' + j] = y; bin.push(y); obj.push('+ 1 ' + y); });
      classes.forEach(function (q, qi) { if (k.ch[q.t]) { var v = 'n' + qi + '_' + j; nv.push({ v: v, q: qi, j: j }); gen.push(v); bnd.push(' 0 <= ' + v + ' <= ' + k.ch[q.t]); } });
      gs.forEach(function (s, i) { if (k.ch[s.type]) { var v = 'z' + i + '_' + j; zv.push({ v: v, i: i, j: j }); bin.push(v); } });
    });
    classes.forEach(function (q, qi) { cons.push(' cls' + qi + ': ' + nv.filter(function (x) { return x.q === qi; }).map(function (x) { return '+ ' + x.v; }).join(' ') + ' = ' + q.list.length); });
    gs.forEach(function (s, i) {
      var t = zv.filter(function (x) { return x.i === i; });
      if (!t.length) throw new Error('no card has type ' + s.type + ' for ' + s.tag);
      cons.push(' g' + i + ': ' + t.map(function (x) { return '+ ' + x.v; }).join(' ') + ' = 1');
    });
    cand.forEach(function (k, j) {
      Object.keys(k.ch).forEach(function (t) {
        var used = nv.filter(function (x) { return x.j === j && classes[x.q].t === t; }).map(function (x) { return '+ ' + x.v; })
          .concat(zv.filter(function (x) { return x.j === j && gs[x.i].type === t; }).map(function (x) { return '+ ' + x.v; }));
        if (used.length) cons.push(' cap' + j + t + ': ' + used.join(' ') + ' - ' + k.ch[t] + ' u' + j + ' <= 0');
      });
      var seen = {};
      gs.forEach(function (s, i) { (seen[s.grp] = seen[s.grp] || []).push(i); });
      Object.keys(seen).forEach(function (g, gi) {
        var m = seen[g].map(function (i) { return zv.filter(function (x) { return x.i === i && x.j === j; })[0]; }).filter(Boolean);
        if (m.length > 1) cons.push(' sep' + gi + '_' + j + ': ' + m.map(function (x) { return '+ ' + x.v; }).join(' ') + ' <= 1');
      });
      nv.filter(function (x) { return x.j === j; }).forEach(function (x) { cons.push(' ar' + x.v + ': ' + x.v + ' - ' + k.ch[classes[x.q].t] + ' ' + yv[classes[x.q].a + '_' + j] + ' <= 0'); });
      zv.filter(function (x) { return x.j === j; }).forEach(function (x) { cons.push(' az' + x.v + ': ' + x.v + ' - ' + yv[areas.indexOf(gs[x.i].area) + '_' + j] + ' <= 0'); });
      if (j && !k.fx && !cand[j - 1].fx && k.name === cand[j - 1].name) cons.push(' sym' + j + ': u' + j + ' - u' + (j - 1) + ' <= 0');
    });
    typesOf(sigs).forEach(function (t) {
      if (!nt[t]) return;
      var terms = cand.map(function (k, j) { return k.ch[t] ? '+ ' + k.ch[t] + ' u' + j : null; }).filter(Boolean);
      if (!terms.length) throw new Error('no card in the catalog has ' + t);
      cons.push(' need' + t + ': ' + terms.join(' ') + ' >= ' + nt[t]);
    });
    if (c.max_modules) cons.push(' rack: ' + cand.map(function (k, j) { return k.fx ? null : '+ u' + j; }).filter(Boolean).join(' ') + ' <= ' + c.max_modules);
    var wrap = function (a) { var o = []; for (var i = 0; i < a.length; i += 10) o.push('  ' + a.slice(i, i + 10).join(' ')); return o; };
    L.push('Minimize', ' obj:'); L = L.concat(wrap(obj)); L.push('Subject To');
    cons.forEach(function (s) { var p = s.split(' '); L.push(p.slice(0, 2).join(' ')); L = L.concat(wrap(p.slice(2))); });
    L.push('Bounds'); L = L.concat(bnd); L.push('General'); L = L.concat(wrap(gen)); L.push('Binary'); L = L.concat(wrap(bin)); L.push('End');
    return { lp: L.join('\n'), cand: cand, classes: classes, gs: gs, nv: nv, zv: zv };
  }
  function read(m, cols) {
    var val = function (n) { return cols[n] || 0; }, left = m.classes.map(function (q) { return q.list.slice(); }), cards = [];
    m.cand.forEach(function (k, j) {
      if (val('u' + j) < 0.5) return;
      var got = [];
      m.nv.filter(function (x) { return x.j === j; }).forEach(function (x) { var n = Math.round(val(x.v)); got = got.concat(left[x.q].splice(0, n)); });
      m.zv.filter(function (x) { return x.j === j && val(x.v) > 0.5; }).forEach(function (x) { got.push(m.gs[x.i]); });
      cards.push({ name: k.name, ch: k.ch, price: k.price, fixed: k.fx, sig: got });
    });
    return cards;
  }
  function stats(cards) {
    var clash = 0, mix = 0;
    cards.forEach(function (c) {
      var g = c.sig.map(function (s) { return s.grp; }).filter(Boolean), a = {};
      clash += g.length - g.filter(function (v, i) { return g.indexOf(v) === i; }).length;
      c.sig.forEach(function (s) { a[s.area] = 1; }); mix += Object.keys(a).length;
    });
    return { cost: cards.reduce(function (t, c) { return t + c.price; }, 0), modules: cards.filter(function (c) { return !c.fixed; }).length, clash: clash, mix: mix };
  }
  function assignRows(cards) {   // slot, card, type, channel, signal or SPARE
    var rows = [];
    cards.forEach(function (c, slot) {
      Object.keys(c.ch).forEach(function (t) {
        var ts = c.sig.filter(function (s) { return s.type === t; });
        for (var ch = 0; ch < c.ch[t]; ch++) { var s = ts[ch]; rows.push({ slot: slot, card: c.name, type: t, ch: ch, sig: s || null }); }
      });
    });
    return rows;
  }
  /* solve(case, solveLP) -> {manual, opt, status, ...}; solveLP(lp) -> Promise<{status, cols}> */
  function solve(c, solveLP) {
    var sigs = prep(c.signals, c.separate_groups), mc = manual(sigs, c), m = build(sigs, c);
    return solveLP(m.lp).then(function (r) {
      if (!/optimal|limit/i.test(r.status) || !Object.keys(r.cols || {}).length) throw new Error('no card mix meets the rules: ' + r.status + ' (max modules too low?)');
      var oc = read(m, r.cols);
      return { sigs: sigs, need: need(sigs, c), manual: { cards: mc, s: stats(mc) }, opt: { cards: oc, s: stats(oc) },
        status: /optimal/i.test(r.status) ? 'OPTIMAL' : 'FEASIBLE (time limit)', groups: sigs.filter(function (s) { return s.grp; }).map(function (s) { return s.grp; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length };
    });
  }
  return { TYPES: TYPES, typesOf: typesOf, normType: normType, prep: prep, need: need, manual: manual, build: build, read: read, stats: stats, assignRows: assignRows, solve: solve };
});
