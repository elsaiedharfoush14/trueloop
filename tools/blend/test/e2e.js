// Browser check: node tools/blend/test/e2e.js   (repo root served by python)
const { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..', '..'), PORT = 8769, OUT = process.env.SHOTS || path.join(__dirname, 'shots'), URL = `http://127.0.0.1:${PORT}/tools/blend/`;
(async () => {
  const srv = spawn(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800)); fs.mkdirSync(OUT, { recursive: true });
  let ok = true; const check = (n, c, i) => { console.log((c ? 'OK   ' : 'FAIL ') + n + (i ? '  ' + i : '')); ok = ok && c; };
  const b = await chromium.launch(), errs = [];
  try {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await pg.goto(URL); await pg.waitForTimeout(400);
    check('opens with the sample sheet', await pg.locator('.sheet input').count() > 30);
    await pg.click('[data-act="solve"]'); await pg.waitForSelector('.save', { timeout: 60000 });
    let t = await pg.textContent('#app');
    check('1.377 SAR/m3 optimised, 9.0 % (= Python)', t.includes('1.377 SAR/m³') && t.includes('9.0 %'));
    check('905 m3/h permeate + 95 groundwater', /905/.test(t) && /95/.test(t));
    await pg.screenshot({ path: path.join(OUT, 'blend_result.png'), fullPage: true });
    await pg.fill('[data-p="M"]', '0'); await pg.click('[data-act="solve"]'); await pg.waitForSelector('.save');
    t = await pg.textContent('#app');
    check('margin 0 % -> 1.332 SAR/m3 (Python, no margin)', t.includes('1.332 SAR/m³'));
    await pg.fill('[data-p="hi.0"]', '200'); await pg.click('[data-act="solve"]'); await pg.waitForTimeout(800);
    check('impossible spec -> clear message', (await pg.textContent('#app')).includes('No blend meets the spec'));
    const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' }); ph.on('pageerror', e => errs.push(e.message));
    await ph.goto(URL); await ph.click('[data-act="solve"]'); await ph.waitForSelector('.save', { timeout: 60000 });
    check('phone (Arabic): rtl, no horizontal page scroll', (await ph.getAttribute('html', 'dir')) === 'rtl' && await ph.evaluate(() => document.documentElement.scrollWidth) <= 390);
    await ph.screenshot({ path: path.join(OUT, 'blend_phone_ar.png'), fullPage: true });
    check('no page errors', errs.length === 0, errs.join(' | '));
  } finally { await b.close(); srv.kill(); }
  console.log(ok ? 'ALL OK' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
