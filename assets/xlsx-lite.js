/* Minimal .xlsx reader (first sheet -> array of rows), no library: zip directory + DecompressionStream + DOMParser.
   Enough for a cable schedule (strings, numbers, inline strings). Formulas give their cached value. */
(function (root) {
  'use strict';
  async function unzip(buf) {
    const u = new Uint8Array(buf), dv = new DataView(buf), td = new TextDecoder();
    let e = u.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('not an .xlsx file');
    const files = {};
    let p = dv.getUint32(e + 16, true);
    for (let i = 0, n = dv.getUint16(e + 10, true); i < n; i++) {
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      files[td.decode(u.subarray(p + 46, p + 46 + nl))] =
        { comp: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
      p += 46 + nl + xl + cl;
    }
    return async name => {
      const f = files[name];
      if (!f) return null;
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      const data = u.subarray(start, start + f.size);
      if (f.comp === 0) return td.decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    };
  }
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

  async function readXlsx(buf) {
    const get = await unzip(buf);
    const wb = xml(await get('xl/workbook.xml'));
    const rels = xml(await get('xl/_rels/workbook.xml.rels'));
    const first = wb.getElementsByTagName('sheet')[0];
    const rid = first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid).getAttribute('Target');
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const ssText = await get('xl/sharedStrings.xml');
    const shared = ssText ? [...xml(ssText).getElementsByTagName('si')].map(si => si.textContent) : [];
    const sheet = xml(await get(target));
    const rows = [];
    for (const row of sheet.getElementsByTagName('row')) {
      const r = [];
      for (const c of row.getElementsByTagName('c')) {
        const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
        let val = '';
        if (t === 's') val = shared[+v.textContent] ?? '';
        else if (t === 'inlineStr') val = c.textContent;
        else if (v) val = t === 'str' || t === 'b' ? v.textContent : Number(v.textContent);
        const ref = c.getAttribute('r');
        r[ref ? colIndex(ref) : r.length] = val;
      }
      rows.push(Array.from(r, x => (x === undefined ? '' : x)));
    }
    return rows;
  }
  root.readXlsx = readXlsx;
})(this);
