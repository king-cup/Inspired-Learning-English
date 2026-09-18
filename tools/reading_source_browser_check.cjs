// Local editorial-preview checks; never writes the deployable content bundle.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const draftPath = path.join(root, '.impeccable/review/reading-content-draft.json');
const data = JSON.parse(fs.readFileSync(draftPath));
const base = process.argv[2] || 'http://127.0.0.1:8123';
async function main() {
  assert.equal(data.editorialDraft, true);
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [width, height, lang] of [[390, 844, 'en'], [834, 1194, 'zh'], [1440, 1000, 'en']]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
      await context.addInitScript(lang => {
        localStorage.setItem('vd.profile.v1', JSON.stringify({ name: 'Source QA', lang, onboarded: true }));
        localStorage.setItem('ie.tutorial.1.10.1', 'done');
        localStorage.setItem('ie.releaseNotice.1.10.1', 'seen');
        localStorage.setItem('ie.releaseNotice.1.10.2-preview', 'seen');
        Object.defineProperty(navigator, 'standalone', { value: true });
      }, lang);
      await context.route('**/reading-content.json', route => route.fulfill({ path: draftPath, contentType: 'application/json' }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('dialog', d => d.accept());
      for (const id of ['rc-level-3-u12-b', 'rc-level-5-u02-a', 'rc-level-5-u05-a']) {
        const article = data.articles.find(a => a.id === id);
        await page.goto(`${base}/?sourceQA=${id}#/reading/${id}/test`, { waitUntil: 'networkidle' });
        await page.locator('.exercise-fields').waitFor();
        assert.equal(await page.locator('fieldset.question').count(), article.comprehension.questions.length);
        assert.equal(await page.locator('textarea,.passage-term').count(), 0);
        for (const figure of article.figures) {
          assert.equal(await page.locator(`[data-figure="${figure.id}"] img`).evaluate(el => el.complete && el.naturalWidth > 0), true);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (id === 'rc-level-3-u12-b') {
          await page.evaluate(async () => {
            for (const img of document.querySelectorAll('.reading-figure img')) {
              await img.decode();
              img.scrollIntoView();
              await new Promise(requestAnimationFrame);
            }
            scrollTo(0, 0);
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
          });
          await page.screenshot({ path: path.join(root, `.impeccable/review/reading-source-${width}.png`), fullPage: true });
          await page.locator('.reading-figure').first().screenshot({ path: path.join(root, `.impeccable/review/reading-chart-${width}.png`) });
          await page.locator('.reading-figure button').first().click();
          assert.equal(await page.locator('.reading-figure-viewport').first().evaluate(el => el.scrollWidth > el.clientWidth), true);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
        for (const q of article.comprehension.questions) await page.locator(`input[name="${q.id}"][value="${q.answer}"]`).check();
        await page.locator('[data-section="comp"] button').click();
        assert.match(await page.locator('.article-results').innerText(), /100%/);
        assert.equal(await page.locator('.answer-explanation').count(), article.comprehension.questions.length);
      }
      // A failed chart must not permit submission; a successful retry unlocks it.
      let fail = true;
      await context.route('**/reading-figures/*.jpg', route => fail ? route.abort() : route.continue());
      await page.goto(`${base}/?sourceQA=retry#/reading/rc-level-3-u12-b/study`, { waitUntil: 'networkidle' });
      const submit = page.locator('[data-section="comp"] button');
      assert.equal(await submit.isDisabled(), true);
      fail = false;
      for (const figure of await page.locator('.reading-figure').all()) await figure.getByRole('button', { name: lang === 'zh' ? '重试加载图表' : 'Retry chart download', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('.reading-figure img')].every(el => el.complete && el.naturalWidth > 0));
      await page.waitForFunction(() => !document.querySelector('[data-section="comp"] button').disabled);
      assert.equal(await submit.isDisabled(), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${lang}: all three source restorations, keys, chart zoom/retry, no lookup or text inputs in Test, no page overflow.`);
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
