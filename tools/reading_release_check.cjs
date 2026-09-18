// Verify every shipped reading in isolated student profiles; no source charts.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'reading-content.json')));
const base = process.argv[2] || 'http://127.0.0.1:8123';
async function main() {
  assert.equal(data.answerAuditVersion, 1);
  assert(!data.editorialDraft);
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const errors = [], verified = [];
  try {
    const profiles = [];
    for (const [width, height, lang] of [[390,844,'en'],[834,1194,'zh'],[1194,834,'en']]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
      await context.addInitScript(lang => {
        localStorage.setItem('vd.profile.v1', JSON.stringify({ name: 'Reading QA', lang, onboarded: true }));
        localStorage.setItem('ie.tutorial.1.10.2', 'done');
        localStorage.setItem('ie.releaseNotice.1.10.2', 'seen');
        Object.defineProperty(navigator, 'standalone', { value: true });
      }, lang);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      profiles.push({ context, page, width, lang });
    }
    for (const [i, article] of data.articles.entries()) {
      const { page, width, lang } = profiles[i % profiles.length];
      await page.goto(`${base}/#/reading/${article.id}/test`, { waitUntil: 'domcontentloaded' });
      await page.locator('.exercise-fields').waitFor();
      const questions = article.comprehension.questions;
      assert.equal(await page.locator('fieldset.question').count(), questions.length);
      assert.equal(await page.locator('textarea,.passage-term,.reading-figure').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, article.id);
      for (const q of questions) await page.locator(`input[name="${q.id}"][value="${q.answer}"]`).check();
      await page.locator('[data-section="comp"] button').click();
      assert.match(await page.locator('.article-results').innerText(), /100%/);
      assert.equal(await page.locator('.answer-explanation').count(), questions.length);
      if (i < 3) await page.screenshot({ path: path.join(root, `.impeccable/review/release-reading-${width}.png`), fullPage: true });
      verified.push({ id: article.id, questions: questions.length, width, lang });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(root, '.impeccable/review/reading-release-checks.json'), JSON.stringify(verified, null, 2));
    console.log(`PASS: ${verified.length} readings / ${verified.reduce((n,r)=>n+r.questions,0)} answers; 100% scoring, no charts, text inputs or test lookups; phone and tablet profiles.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
