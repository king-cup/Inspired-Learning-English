// Run: NODE_PATH=<path containing playwright> node tools/release_smoke.cjs [URL]
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const BASE = process.argv[2] || 'http://127.0.0.1:8123';
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const capture = path.join(ROOT, '.impeccable/review');
fs.mkdirSync(capture, { recursive: true });
const checks = [];
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [name, width, height, lang, android] of [['phone',390,844,'en',false], ['tablet',834,1194,'zh',false], ['tablet-landscape',1194,834,'en',false], ['android-phone',412,915,'en',true]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 760, userAgent: android ? 'Mozilla/5.0 InspiredEnglishAndroid/1.10' : undefined });
      await context.addInitScript(({lang,android}) => {
        if (!localStorage.getItem('vd.profile.v1')) localStorage.setItem('vd.profile.v1', JSON.stringify({ name:'Student', lang, onboarded:true, inverted:false, cardsReversed:false }));
        localStorage.setItem('ie.tutorial.1.10','done');
        if (!android) Object.defineProperty(navigator, 'standalone', { value: true });
      }, {lang,android});
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(String(error)));
      page.on('dialog', dialog => dialog.accept());
      const go = async route => {
        console.log(name, route);
        await page.goto(BASE + '/' + route, {waitUntil:'networkidle'});
        await page.locator('main button').first().waitFor({state:'attached'});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + route + ': overflow');
        assert.equal(await page.locator('#tabwarn').isVisible(), false, 'install banner');
        assert.equal(await page.locator('.motion-stage:not(.motion-entered)').count(), 0);
      };
      await go('#/');
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).color), 'rgb(0, 0, 0)', 'original black ink');
      assert.match(await page.locator('.home-choices .block .t').first().evaluate(el => getComputedStyle(el).fontFamily), /Courier New/, 'original UI font');
      await page.screenshot({path:path.join(capture,name+'-home.png'),fullPage:true});
      const first = read('vocab.json').types[0].groups[0].units[0].id;
      const routes = ['#/vocab','#/u/'+first,'#/u/'+first+'/study','#/u/'+first+'/cards','#/u/'+first+'/practice','#/u/'+first+'/test','#/reading','#/reading/book/foundation','#/middle','#/middle/7','#/middle/8','#/middle/9','#/middle/7/mcq','#/cloze/7','#/cloze/study/7','#/high-school','#/memory','#/settings'];
      for (const route of routes) await go(route);
      await go('#/reading/book/foundation');
      assert.equal(await page.locator('select').count(),0);
      assert.equal(await page.locator('.unit-heading').count(),12);
      await page.screenshot({path:path.join(capture,name+'-books.png'),fullPage:true});
      await go('#/cloze/7'); assert.equal(await page.locator('.cloze-grade-tabs').count(),0);
      await go('#/cloze/study/7'); assert.equal(await page.locator('.cloze-grade-tabs').count(),0);
      await go('#/reading/rc-foundation-u01-a');
      assert.equal(await page.locator('[data-section=vocab],#personal-test,.lookup-manual,.lookup-panel').count(),0);
      const term = page.locator('.passage-term').filter({hasText:/^astronomers$/}).first();
      await term.dblclick();
      assert.equal(await page.locator('.inline-definition').count(),1);
      assert.equal(await term.getAttribute('aria-expanded'),'true');
      await term.click(); assert.equal(await page.locator('.inline-definition').count(),0);
      await term.click(); assert.equal(await page.locator('.inline-definition').count(),1);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ie.curriculum.v2')).encounters.length),1);
      await page.screenshot({path:path.join(capture,name+'-passage.png'),fullPage:true});
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.locator('.is-highlighted').count(),1);
      await page.locator('.passage-tools button').click();
      assert.equal(await page.locator('.is-highlighted').count(),0);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ie.curriculum.v2')).encounters.length),1);
      // Touch double tap must behave like the desktop gesture.
      await term.tap(); await term.tap(); assert.equal(await page.locator('.inline-definition').count(),1);
      // Submission, retry and next preserve progress and don't fabricate a key.
      await page.locator('[data-section=comp] > button').click();
      assert.equal(await page.locator('.article-results .note').count(),1);
      await page.locator('.article-results .btn.wide').click();
      await page.waitForURL('**/#/reading/rc-foundation-u01-b');
      await page.waitForFunction(() => localStorage.getItem('ie.lastRoute') === '#/reading/rc-foundation-u01-b');
      await page.getByRole('heading', {name:read('reading-content.json').articles[1].title,exact:true}).waitFor();
      await page.goto(BASE, {waitUntil:'networkidle'});
      assert.equal(new URL(page.url()).hash,'#/reading/rc-foundation-u01-b');
      // Every middle-school reading section and grade can open and submit.
      const middle = read('middle-school.json');
      if (name === 'phone') {
        for (const grade of ['7','8','9']) for (const section of ['mcq','reading-a','reading-b','reading-c','reading-d','reading-e']) {
          const rows = middle.grades[grade][section] || []; if (!rows.length) continue;
          await go(`#/middle/${grade}/${section}/test/${rows[0].id}`);
          assert.equal(await page.locator('.question-feedback').count(),0);
          await page.locator('form.middle-form + button').click();
          assert.ok(await page.locator('.question-feedback').count() > 0);
          if (rows.length > 1) { await page.locator('form.middle-form + button + div button').click(); await page.waitForURL('**/'+rows[1].id); }
        }
        const row = middle.grades['7']['reading-a'].find(row => row.questions.some(q => q.choices.length));
        await go(`#/middle/7/reading-a/study/${row.id}`);
        await page.locator('fieldset input').first().check();
        assert.equal(await page.locator('.question-feedback').count(),1);
        await page.locator('form.middle-form + button').click();
        assert.ok(await page.locator('form.middle-form + button + div button').count());
        // Cards, practice, a complete vocabulary test and due-word review.
        await go('#/u/'+first+'/cards');
        await page.getByRole('button',{name:/flip/i}).last().click();
        await page.waitForTimeout(250);
        await page.getByRole('button',{name:/I know it/i}).click();
        await page.waitForTimeout(300);
        await go('#/u/'+first+'/practice');
        await page.locator('.opt').first().click();
        assert.ok(await page.locator('.opt.right').count());
        await go('#/u/'+first+'/test');
        await page.locator('.stack .block').first().click();
        for (let i=0; i<10; i++) { await page.locator('.opt').first().click(); assert.equal(await page.locator('.opt.right,.opt.wrong').count(),0); await page.locator('.test-nav .navbtn').last().click(); }
        await page.locator('.grade-block,.grade,.score').first().waitFor({state:'attached'}).catch(()=>page.getByRole('button',{name:/done/i}).waitFor());
        await go('#/memory');
        await page.getByRole('button',{name:'Review due items',exact:true}).click();
        await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
        await page.getByRole('button',{name:'Correct',exact:true}).click();
        // Existing vocabulary scoring contracts and backup coverage.
        const saved = await page.evaluate(async () => {
          const S = await import('./js/store.js');
          const C = await import('./js/curriculum-store.js');
          const backup = S.exportBackup(); const count = C.get().encounters.length;
          return { valid:S.validateBackup(backup).ok, schema:JSON.parse(backup).schema, restored:S.importBackup(backup).ok, count, after:C.get().encounters.length, invalid:S.validateBackup('{"progress":{"words":{},"units":{}},"curriculum":[]}').ok };
        });
        assert.equal(saved.schema,2); assert.equal(saved.valid,true); assert.equal(saved.restored,true); assert.equal(saved.count,saved.after); assert.equal(saved.invalid,false);
      }
      assert.deepEqual(errors,[],name+' errors');
      checks.push(name+': routes, layout, definitions, undo/history, submissions, next article and restart passed');
      await context.close();
    }
    // Fresh student tutorial, keyboard demo, replay, and one-pack offline audio.
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage();
    await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
    await page.goto(BASE);
    await page.locator('input[type=text]').fill('New Student');
    await page.locator('button').filter({hasText:/start|begin|开始/i}).last().click();
    await page.getByRole('heading',{name:'Welcome to Inspired English'}).waitFor();
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await page.locator('.tutorial-demo .passage-term').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.tutorial-demo .inline-definition').isVisible(),true);
    await page.getByRole('button',{name:'Skip for now'}).click();
    await page.goto(BASE+'/#/vocab',{waitUntil:'networkidle'});
    const audioRequests=[]; page.on('request',req=>{if(req.url().includes('/audio/'))audioRequests.push(req.url());});
    const download = await page.evaluate(async()=>{const D=await import('./js/data.js'); const A=await import('./js/audio.js'); await A.clearCache(); return A.prefetch(D.allClipUrls(),{allInOne:true});});
    assert.equal(download.failed,0); assert.equal(download.done,read('audio-index.json').length);
    assert.equal(audioRequests.length,1); assert.ok(audioRequests[0].includes('all-vocabulary.pack'));
    await page.goto(BASE+'/#/reading/rc-foundation-u01-a',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Play',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.startsWith('blob:') && document.querySelector('audio').duration > 0);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'}); await page.locator('.reading-body').waitFor();
    await page.getByRole('button',{name:'Play',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.startsWith('blob:') && document.querySelector('audio').duration > 0);
    const count = await page.evaluate(async()=>{const D=await import('./js/data.js');const A=await import('./js/audio.js');return A.cachedCount(D.allClipUrls());});
    assert.equal(count,5364);
    checks.push('Fresh tutorial, keyboard demo, one HTTP vocabulary pack, full word cache and offline article/audio passed');
    await context.close();
    fs.writeFileSync(path.join(capture,'checks.json'),JSON.stringify(checks,null,2));
    console.log(checks.join('\n'));
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
