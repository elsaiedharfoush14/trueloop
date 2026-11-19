// Browser check of the tool inside the site: node tools/cable-drums/test/e2e.js   (repo root served by python)
const { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..', '..'), PORT = 8766, OUT = process.env.SHOTS || path.join(__dirname, 'shots');
const URL = `http://127.0.0.1:${PORT}/tools/cable-drums/`;
(async () => {
  const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const srv = spawn(py, ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800)); fs.mkdirSync(OUT, { recursive: true });
  let ok = true; const check = (n, c, i) => { console.log((c ? 'OK   ' : 'FAIL ') + n + (i ? '  ' + i : '')); ok = ok && c; };
  const b = await chromium.launch(), errs = [];
  try {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await pg.goto(URL); await pg.waitForTimeout(500);
    check('TrueLoop logo mark present', await pg.locator('header.top svg use').count() > 0);
    await pg.click('[data-act="sample"]');
    check('sample: 92 runs, 6 sizes', (await pg.textContent('#app')).includes('92 runs, 6 sizes'));
    await pg.click('button[data-step="2"]'); await pg.screenshot({ path: path.join(OUT, 'site_2_drums.png'), fullPage: true });
    const t0 = Date.now(); await pg.click('[data-act="solve"]'); await pg.waitForSelector('.save', { timeout: 120000 });
    const txt = await pg.textContent('#app');
    check('saving 17,050 SAR (= Python)', txt.includes('17,050 SAR'), `${Date.now() - t0} ms`);
    check('all sizes proven optimal', txt.includes('OPTIMAL — proven best'));
    check('WhatsApp link to +966 56 086 1304', (await pg.getAttribute('a[href*="wa.me"]', 'href')).startsWith('https://wa.me/966560861304'));
    await pg.screenshot({ path: path.join(OUT, 'site_3_result.png'), fullPage: true });
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-act="dlc"]')]);
    check('cut plan CSV has 92 runs', fs.readFileSync(await dl.path(), 'utf8').trim().split(/\r?\n/).length === 93);
    await pg.click('button[data-step="1"]');
    await pg.setInputFiles('#file', path.join(__dirname, 'fixtures', 'cable_schedule.xlsx')); await pg.waitForTimeout(500);
    check('xlsx upload: header found, 92 runs', (await pg.textContent('#app')).includes('92 runs, 6 sizes'));
    await pg.click('#lnAr'); check('Arabic: dir=rtl', (await pg.getAttribute('html', 'dir')) === 'rtl');
    const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
    ph.on('pageerror', e => errs.push(e.message));
    await ph.goto(URL); await ph.click('[data-act="sample"]'); await ph.click('button[data-step="2"]');
    await ph.click('[data-act="solve"]'); await ph.waitForSelector('.save', { timeout: 120000 });
    const sw = await ph.evaluate(() => document.documentElement.scrollWidth);
    check('phone (Arabic): no horizontal scroll', sw <= 390, `scrollWidth=${sw}`);
    await ph.screenshot({ path: path.join(OUT, 'site_4_phone_ar.png'), fullPage: true });
    const hub = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
    hub.on('pageerror', e => errs.push(e.message));
    await hub.goto(`http://127.0.0.1:${PORT}/app/`); await hub.fill('#q', 'cable');
    check('hub app lists the tool', await hub.locator('a.tool[href*="cable-drums"]').count() === 1);
    check('no page errors', errs.length === 0, errs.join(' | '));
  } finally { await b.close(); srv.kill(); }
  console.log(ok ? 'ALL OK' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
