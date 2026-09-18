// Additional release checks: NODE_PATH=<bundled modules> node tools/release_1101.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname,'..');
const BASE = process.argv[2] || 'http://127.0.0.1:8123';
async function main() {
  const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    for (const [width,height,android,lang] of [[390,844,false,'en'],[834,1194,true,'zh']]) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:true,userAgent:android?'Mozilla/5.0 InspiredEnglishAndroid/1.10.1':undefined});
      await context.addInitScript(({lang})=>{
        if (!localStorage.getItem('vd.profile.v1')) localStorage.setItem('vd.profile.v1',JSON.stringify({name:'UpgradeStudent',lang,onboarded:true}));
        localStorage.setItem('ie.tutorial.1.10.2','done');
        Object.defineProperty(navigator,'standalone',{value:true});
      },{lang});
      const page=await context.newPage(); const errors=[];
      page.on('pageerror',e=>errors.push(String(e))); page.on('dialog',d=>d.accept());
      const go=async route=>{await page.goto(BASE+'/'+route,{waitUntil:'networkidle'});};
      await go('#/vocab');
      await page.getByRole('dialog').waitFor();
      await page.getByRole('button',{name:'中文',exact:true}).click();
      assert.match(await page.locator('.release-notes').innerText(),/高中词汇包标题保持不变/);
      await page.getByRole('button',{name:'English',exact:true}).click();
      assert.match(await page.locator('.release-notes').innerText(),/Narrator replacement was cancelled/);
      await page.screenshot({path:path.join(ROOT,'.impeccable/review',`notice-${width}.png`)});
      await page.getByRole('button',{name:'继续学习 · Continue learning'}).click();
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.getByRole('dialog').count(),0);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd.profile.v1')).name),'UpgradeStudent');
      await go('#/settings'); await page.locator('.release-log summary').click();
      assert.equal(await page.locator('.release-log h2').count(),8);
      for (const color of ['red','green','blue','yellow','purple','pink','brown','black','teal']) {
        await page.locator(`[data-highlight-color=${color}]`).click();
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd.profile.v1')).highlightColor),color);
      }
      await page.locator('[data-highlight-color=black]').click();
      await go('#/reading/rc-foundation-u01-a/study');
      const term=page.locator('.passage-term').first(); await term.dblclick();
      await page.locator('.vocab-fold.open').waitFor();
      assert.equal(await term.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
      assert.equal(await term.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
      await term.click(); await page.waitForTimeout(400); assert.equal(await page.locator('.vocab-fold:visible').count(),0);
      await term.click(); await page.waitForTimeout(400); assert.equal(await page.locator('.vocab-fold.open:visible').count(),1);
      await page.screenshot({path:path.join(ROOT,'.impeccable/review',`fold-${width}.png`)});
      await go('#/reading/rc-foundation-u01-a/test');
      assert.equal(await page.locator('.passage-term,.is-highlighted,.passage-tools').count(),0);
      // Every named book resolves to an unambiguous label, without changing HSE.
      const labels=await page.evaluate(async()=>{const D=await import('./js/data.js');return D.types().flatMap(t=>t.groups.flatMap(g=>g.units.map(u=>({book:g.name,raw:u.label,type:t.type,label:D.resolve(u.id).label}))));});
      for(const row of labels) assert.ok(row.type==='HSE Packages'?row.label===row.raw:row.label.includes(row.book),JSON.stringify(row));
      if (!android) {
        const books=JSON.parse(fs.readFileSync(path.join(ROOT,'vocab.json'))).types.find(t=>t.type==='Book Units').groups;
        for(const book of books) for(const mode of ['','study','cards','practice','test']) {
          await go('#/u/'+book.units[0].id+'/'+mode);
          // A resumed practice may ask whether to continue; dismiss by starting over.
          if(await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
          assert.ok((await page.locator('h1').allTextContents()).some(t=>t.includes(book.name)),book.name+'/'+mode);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,book.name+'/'+mode);
        }
        await go('#/middle/7/reading-a'); await page.locator('.home-choices .block').first().waitFor(); assert.equal(await page.locator('.home-choices .block').count(),2);
        await page.locator('.home-choices .block').last().click(); await page.waitForURL('**/test/*');
        assert.equal(await page.locator('.passage-term').count(),0);
        const tests=await page.evaluate(async()=>{
          const {chooseRandom}=await import('./js/random-pool.js');
          const pulls={}, draws=[];let last=null;
          for(let i=0;i<30;i++){const id=chooseRandom(['a','b','c'],pulls,last,()=>0);draws.push(id);pulls[id]=(pulls[id]||0)+1;last=id;}
          return {draws,pulls,empty:chooseRandom([],{},null),single:chooseRandom(['a'],{a:2},'a')};
        });
        assert.equal(new Set(tests.draws.slice(0,3)).size,3); assert.deepEqual(Object.values(tests.pulls),[10,10,10]);
        assert.ok(tests.draws.every((id,i)=>!i||tests.draws[i-1]!==id));assert.equal(tests.empty,null);assert.equal(tests.single,'a');
        const cloze=JSON.parse(fs.readFileSync(path.join(ROOT,'cloze.json')))[0];
        const grade=await page.evaluate(async p=>(await import('./js/cloze-data.js')).gradeOf(p.grade),cloze);
        await go(`#/cloze/study/${grade}/${cloze.id}`);
        await page.locator('.passage-term').first().waitFor();
        assert.ok(await page.locator('.passage-term').count()>0);
        await page.locator('.cloze-blank').first().click();
        const optionTerm=page.locator('.cloze-fold.open .cloze-option-study .passage-term').first();
        await optionTerm.dblclick();
        await page.locator('.vocab-fold.open').waitFor();
        assert.equal(await page.locator('.cloze-blank.answered,.cloze-blank.right,.cloze-blank.wrong').count(),0);
        assert.equal(await page.locator('.vocab-fold.open').count(),1);
        await page.locator('.cloze-fold.open .cloze-pick').first().click();
        assert.equal(await page.locator('.cloze-blank.right,.cloze-blank.wrong').count(),1);
        await go(`#/cloze/test/${grade}/${cloze.id}`);assert.equal(await page.locator('.passage-term,.is-highlighted,.passage-tools').count(),0);
        for(let i=0;i<cloze.blanks.length;i++) {await page.locator('.cloze-blank').nth(i).click();await page.locator('.cloze-fold.open .cloze-option').nth(cloze.blanks[i].key).click();await page.waitForTimeout(450);}
        const finish=page.locator('button').filter({hasText:/submit|finish/i}).last();await finish.click();
        await page.getByRole('button',{name:'Next exercise',exact:true}).click(); await page.waitForURL(url=>!url.hash.endsWith('/'+cloze.id));
        await page.emulateMedia({reducedMotion:'reduce'});await go('#/reading/rc-foundation-u01-a/study');await page.locator('.passage-term').first().click();
        assert.equal(await page.locator('.vocab-fold').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
      }
      assert.deepEqual(errors,[]);console.log(`PASS ${width}: bilingual once-only notice, Settings log, colours, Test restrictions, book titles`);
      await context.close();
    }
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
