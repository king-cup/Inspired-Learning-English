const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:8123';
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 834, height: 1194 } });
    await context.addInitScript(() => {
      localStorage.setItem('vd.profile.v1', JSON.stringify({ name: 'Offline QA', lang: 'en', onboarded: true }));
      localStorage.setItem('ie.tutorial.1.10.2', 'done');
      localStorage.setItem('ie.releaseNotice.1.10.2', 'seen');
      localStorage.setItem('ie.releaseNotice.1.10.2-preview', 'seen');
      Object.defineProperty(navigator, 'standalone', { value: true });
    });
    let page = await context.newPage();
    const errors = [];
    const watch = p => p.on('pageerror', e => errors.push(String(e)));
    watch(page);
    await page.goto(`${base}/#/u/P1-U01/guided`, { waitUntil: 'networkidle' });
    await page.locator('#class-deadline').waitFor();
    const shell = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const name = (await caches.keys()).find(k => k === 'vd-shell-v19');
      const cache = await caches.open(name);
      return { name, paths: (await cache.keys()).map(r => new URL(r.url).pathname) };
    });
    assert.equal(shell.name, 'vd-shell-v19');
    for (const file of ['js/activity.js', 'js/guided-plan.js', 'js/screens/guided.js']) assert(shell.paths.includes('/' + file));
    await context.setOffline(true);
    await page.close(); page = await context.newPage(); watch(page);
    for (const mode of ['guided', 'spelling', 'test']) {
      await page.goto(`${base}/#/u/P1-U01/${mode}`, { waitUntil: 'networkidle' });
      if (mode === 'guided') await page.locator('#class-deadline').waitFor();
      else if (mode === 'spelling') await page.locator('#spelling-answer').waitFor();
      else await page.getByRole('button', { name: /Mixed/ }).waitFor();
      assert.match(await page.locator('#app').innerText(), /Prepare Level 1/i);
    }
    const journal = await page.evaluate(async () => {
      const log = await import('./js/activity.js');
      const C = await import('./js/cloze-store.js');
      const M = await import('./js/curriculum-store.js');
      C.recordRun({ id: 'QA', grade: '7', mode: 'test', correct: 1, total: 1 });
      M.recordMiddle('QA', 'test', 2, 2, true);
      return log.exportJournal();
    });
    assert(journal.events.some(e => e.type === 'cloze-completed'));
    assert(journal.events.some(e => e.type === 'school-exercise-completed'));
    assert(journal.events.every(e => e.clock === 'device-unverified' && e.at && e.timeZone && Number.isFinite(e.activeMs)));
    assert.deepEqual(errors, []);
    console.log('PASS: fresh offline tab opens Guided, Spelling and Test from the installed cache; local timestamped journal exports without network. Chromium emulation, not physical iOS/Android.');
    await context.close();
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
