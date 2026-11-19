// Browser check: node tools/io-cards/test/e2e.js   (repo root served by python)
const { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..', '..'), PORT = 8768, OUT = process.env.SHOTS || path.join(__dirname, 'shots'), URL = `http://127.0.0.1:${PORT}/tools/io-cards/`;
(async () => {
  const srv = spawn(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800)); fs.mkdirSync(OUT, { recursive: true });
  let ok = true; const check = (n, c, i) => { console.log((c ? 'OK   ' : 'FAIL ') + n + (i ? '  ' + i : '')); ok = ok && c; };
  const b = await chromium.launch(), errs = [];
  try {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await pg.goto(URL); await pg.click('[data-act="sample"]');
    const t1 = await pg.textContent('#app');
    check('sample: 84 signals, 17 groups', t1.includes('84 signals') && t1.includes('17 duty/standby groups'));
    await pg.click('button[data-step="2"]'); await pg.click('[data-act="solve"]'); await pg.waitForSelector('.save', { timeout: 120000 });
    const t = await pg.textContent('#app');
    check('saving 850 SAR (= Python)', t.includes('850 SAR (11.0 %)'));
    check('optimal + 0 clashes shown', t.includes('OPTIMAL') && /Duty and standby on one card\s*0/.test(t));
    await pg.screenshot({ path: path.join(OUT, 'io_result.png'), fullPage: true });
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-act="dl"]')]);
    const rows = fs.readFileSync(await dl.path(), 'utf8').trim().split(/\r?\n/);
    check('channel CSV: every signal once + spares', rows.filter(r => !/,SPARE,/.test(r)).length - 1 === 84 && rows.some(r => /,SPARE,/.test(r)));
    await pg.click('button[data-step="1"]'); await pg.setInputFiles('#file', path.join(__dirname, 'fixtures', 'io_list.xlsx')); await pg.waitForTimeout(500);
    check('xlsx with DQ/AQ types: 84 signals', (await pg.textContent('#app')).includes('84 signals'));
    const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' }); ph.on('pageerror', e => errs.push(e.message));
    await ph.goto(URL); await ph.click('[data-act="sample"]'); await ph.click('button[data-step="2"]'); await ph.click('[data-act="solve"]'); await ph.waitForSelector('.save', { timeout: 120000 });
    check('phone (Arabic): rtl, no horizontal scroll', (await ph.getAttribute('html', 'dir')) === 'rtl' && await ph.evaluate(() => document.documentElement.scrollWidth) <= 390);
    await ph.screenshot({ path: path.join(OUT, 'io_phone_ar.png'), fullPage: true });
    check('no page errors', errs.length === 0, errs.join(' | '));
  } finally { await b.close(); srv.kill(); }
  console.log(ok ? 'ALL OK' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
