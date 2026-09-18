// Isolated student journeys using five real entries, never the user's profile.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = process.argv[2] || 'http://127.0.0.1:8123';
const source = JSON.parse(fs.readFileSync(path.join(root, 'vocab.json')));
const unit = 'P1-U01';
const words = source.data[unit].slice(0, 5);
const fixture = { types: [{ type: 'Book Units', groupLabel: 'Book', groups: [{ name: 'Prepare Level 1', units: [{ id: unit, label: 'Unit 1' }] }] }], data: { [unit]: words } };
const key = w => `${unit}|${w.w.trim().toLowerCase()}|${(w.p || '').trim().toLowerCase()}`;
const byKey = Object.fromEntries(words.map(w => [key(w), w]));
const guidedKey = `ie.guided.${unit}`;
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [width, height, lang] of [[390, 844, 'en'], [834, 1194, 'zh'], [1440, 1000, 'en']]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
      await context.addInitScript(lang => {
        localStorage.setItem('vd.profile.v1', JSON.stringify({ name: 'Learning QA', lang, onboarded: true }));
        localStorage.setItem('ie.tutorial.1.10.1', 'done');
        localStorage.setItem('ie.releaseNotice.1.10.1', 'seen');
        localStorage.setItem('ie.releaseNotice.1.10.2-preview', 'seen');
        Object.defineProperty(navigator, 'standalone', { value: true });
      }, lang);
      await context.route('**/content/manifest.json*', route => route.abort());
      await context.route('**/vocab.json', route => route.fulfill({ json: fixture }));
      let page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-09-18T04:00:00Z'));
      const errors = [];
      const watch = p => p.on('pageerror', e => errors.push(String(e)));
      watch(page);
      const t = (en, zh) => lang === 'zh' ? zh : en;
      const button = name => page.getByRole('button', { name, exact: true });
      const read = k => page.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
      let navigation = 0;
      const go = mode => page.goto(`${base}/?learningQA=${++navigation}#/u/${unit}/${mode}`, { waitUntil: 'networkidle' });
      await go('guided');
      const local = await page.evaluate(() => {
        const deadline = new Date(); deadline.setHours(23, 59, 59, 0);
        return new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      });
      await page.locator('#class-deadline').fill(local);
      await page.locator('#study-minutes').fill('60');
      await button(t('Create my plan', '生成学习计划')).click();
      let state = await read(guidedKey);
      assert.equal(state.plan.days.length, 1);
      assert.equal(state.plan.reviewOnlyLastDay, false);
      await page.getByRole('button', { name: t(/Start today/, /开始今天/) }).click();
      // Full-storage fault must block advancement, preserve memory, then retry.
      await page.evaluate(() => {
        window.qaSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k.startsWith('ie.guided.')) throw new DOMException('QA quota', 'QuotaExceededError');
          return window.qaSetItem.call(this, k, v);
        };
      });
      await button(t('Listen', '听发音')).click();
      assert.equal(await page.locator('#learning-storage-warning').count(), 1);
      await button(t('Retry saving progress', '重试保存进度')).waitFor();
      await page.screenshot({ path: path.join(root, `.impeccable/review/learning-recovery-${width}.png`), fullPage: true });
      await page.evaluate(() => { Storage.prototype.setItem = window.qaSetItem; });
      await button(t('Retry saving progress', '重试保存进度')).click();
      assert.equal((await read(guidedKey)).session.listened, true);
      // Actual tab close/reopen, not a synthetic call to the screen renderer.
      await page.close(); page = await context.newPage(); watch(page);
      await page.clock.setFixedTime(new Date('2026-09-18T04:00:00Z'));
      await go('guided');
      await button(t('Resume this block', '继续本组学习')).click();
      let hinted = false;
      for (let safety = 0; safety < 70; safety++) {
        state = await read(guidedKey);
        const s = state.session;
        if (!s) break;
        const item = s.queue[s.pos];
        if (item.kind === 'intro') {
          if (!s.listened) await button(t('Listen', '听发音')).click();
          await button(t('I said it aloud once', '我已跟读一遍')).click();
          if (s.pos === 0) await page.screenshot({ path: path.join(root, `.impeccable/review/learning-intro-${width}.png`), fullPage: true });
          await button(t('Continue', '继续')).click();
        } else if (s.feedback) {
          await button(t('Continue', '继续')).click();
        } else {
          if (!hinted) { await button(t('Show a hint', '查看提示')).click(); hinted = true; }
          const q = (await read(guidedKey)).session.question;
          if (q.type === 'SPELLING') {
            await page.locator('#guided-answer').fill(byKey[item.key].w);
            await page.locator('#guided-answer').press('Enter');
          } else await page.locator('#app .stack button').nth(q.correctIndex).click();
        }
      }
      state = await read(guidedKey);
      assert.equal(state.session, null);
      assert.equal(Object.values(state.progress).filter(p => p.complete).length, 5);
      assert(Object.values(state.progress).every(p => new Set(p.completedKinds).size === 4));
      assert.equal(await page.evaluate(async k => {
        const { validState } = await import('./js/guided-plan.js');
        return validState(JSON.parse(localStorage.getItem(k)));
      }, guidedKey), true);
      assert.equal(Object.values(state.progress).reduce((n, p) => n + p.wrong, 0), 1, 'Hint must require an unaided retry');
      await page.getByRole('heading', { name: t('Block complete', '本组完成') }).waitFor();

      // Full-list spelling test: answers private until completion; draft persists.
      await go('test');
      await page.getByRole('button', { name: t(/Fill in the blank/, /填空题/) }).click();
      const testKey = `vd.session.test.${unit}`;
      for (let i = 0; i < words.length; i++) {
        const s = await read(testKey), q = s.questions[s.pos];
        const input = page.locator('#spelling-answer');
        await input.fill(byKey[q.entryKey].w);
        assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), String((i + 1) * 20));
        if (!i) {
          await page.reload({ waitUntil: 'networkidle' });
          await button(t('Resume', '继续')).click();
          assert.equal(await page.locator('#spelling-answer').inputValue(), byKey[q.entryKey].w);
        }
        assert.equal(await page.locator('.right,.wrong,.grade').count(), 0);
        await page.locator('.test-nav button').last().click();
      }
      await page.waitForFunction(() => !localStorage.getItem('vd.session.test.P1-U01'));
      assert.match(await page.locator('#app').innerText(), /100%/);

      for (const format of ['mcq', 'mixed']) {
        await go('test');
        await page.getByRole('button', { name: format === 'mcq' ? t(/Multiple Choice/, /选择题/) : t(/Mixed/, /混合题/) }).click();
        for (let i = 0; i < words.length; i++) {
          const s = await read(testKey), q = s.questions[s.pos];
          if (q.type === 'SPELLING') await page.locator('#spelling-answer').fill(byKey[q.entryKey].w);
          else await page.locator('button.opt').nth(q.correctIndex).click();
          await page.locator('.test-nav button').last().click();
        }
        await page.waitForFunction(() => !localStorage.getItem('vd.session.test.P1-U01'));
        assert.match(await page.locator('#app').innerText(), /100%/);
        // Debounced store writes are flushed on navigation; query live history.
        const last = await page.evaluate(async () => (await import('./js/store.js')).unitStat('P1-U01').tests.at(-1));
        assert.equal(last.format, format);
        assert.equal(last.total, 5);
        if (format === 'mixed') assert.deepEqual(last.breakdown.map(b => b.total), [2, 3]);
      }

      // Spelling practice offers a five-word checkpoint before finishing.
      await go('spelling');
      const practiceKey = `vd.session.spelling.${unit}`;
      for (let i = 0; i < words.length; i++) {
        const s = await read(practiceKey);
        await page.locator('#spelling-answer').fill(byKey[s.question.entryKey].w);
        await page.locator('#spelling-answer').press('Enter');
        await button(t('Continue', '继续')).click();
      }
      assert.equal((await read(practiceKey)).phase, 'checkpoint');
      assert.equal(await page.locator('.marks i.y').count(), 5);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(root, `.impeccable/review/learning-checkpoint-${width}.png`), fullPage: true });

      // Invalid local plan remains untouched and presents a recovery path.
      await page.evaluate(k => localStorage.setItem(k, '{broken'), guidedKey);
      await go('guided');
      await button(t('Retry opening plan', '重试打开计划')).waitFor();
      assert.equal(await page.evaluate(k => localStorage.getItem(k), guidedKey), '{broken');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${lang}: one-day guided block, hint retry, four retrievals, quota recovery, tab reopen, all three full-list test formats, five-word checkpoint, corrupt-plan protection.`);
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
