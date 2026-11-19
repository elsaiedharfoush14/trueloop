/* Shared helpers for the Optimise tools (io-cards, blend; cable-drums has its own copy): table text parsing,
   file reading (.xlsx via assets/xlsx-lite.js), the shared HiGHS worker, CSV download, number formatting. */
(function (root) {
  'use strict';
  var O = {};
  O.parseText = function (txt) {
    var lines = txt.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var d = ['\t', ';', ','].filter(function (c) { return lines[0].indexOf(c) > -1; })[0] || ',';
    return lines.map(function (l) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < l.length; i++) {
        var ch = l[i];
        if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"') q = true; else if (ch === d) { out.push(cur.trim()); cur = ''; } else cur += ch;
      }
      out.push(cur.trim()); return out;
    });
  };
  O.readFile = function (file) {
    return /\.xlsx$/i.test(file.name) ? file.arrayBuffer().then(root.readXlsx) : file.text().then(O.parseText);
  };
  O.num = function (v) { var y = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '').replace(/[^\d.\-]/g, '')); return isFinite(y) ? y : NaN; };
  O.f0 = function (n) { return Math.round(n).toLocaleString('en-US'); };
  O.fx = function (n, d) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var worker = null, id = 0, pending = {};
  O.solveLP = function (lp, timeLimit) {
    if (!worker) {
      worker = new Worker((root.TL && TL.root ? TL.root : '../../') + 'assets/highs/worker.js');
      worker.onmessage = function (e) { var p = pending[e.data.id]; delete pending[e.data.id]; if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data); };
    }
    var n = ++id;
    return new Promise(function (res, rej) { pending[n] = { resolve: res, reject: rej }; worker.postMessage({ id: n, lp: lp, timeLimit: timeLimit || 20 }); });
  };
  O.download = function (name, rows) {
    var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };
  O.findCol = function (header, re, not) {
    return header.findIndex(function (h, i) { return re.test(String(h)) && (not || []).indexOf(i) < 0; });
  };
  root.TLO = O;
})(this);
