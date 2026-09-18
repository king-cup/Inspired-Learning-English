const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const bank=JSON.parse(fs.readFileSync('high-school.json'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.addInitScript(()=>{localStorage.setItem('vd.profile.v1',JSON.stringify({name:'QA',lang:'en',onboarded:true}));localStorage.setItem('ie.tutorial.1.11','done');localStorage.setItem('ie.releaseNotice.1.11','seen');Object.defineProperty(navigator,'standalone',{value:true});});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 for(const section of ['mcq','cloze','word-form','reading-a','reading-e','reading-gap']) {
 const item=bank.grades['11'][section].find(x=>x.graded);
 await p.goto(`http://127.0.0.1:8123/#/high-school/11/${section}/test/${item.id}`,{waitUntil:'networkidle'});
 await p.locator('.question').first().waitFor();assert.equal(await p.locator('.question').count(),item.questions.length);
 if(section!=='mcq') assert.equal(await p.locator('.exercise-source').count(),0,'passage appears only once');
 assert.equal(await p.locator('.passage-term').count(),0,'test has no highlights');
 for(const q of item.questions) {
 const field=p.locator(`[data-id="${q.id}"]`);
 if(q.choices.length) await field.locator(`input[value="${q.answer}"]`).check();
 else await field.locator('input').fill(q.acceptedAnswers[0]);
 }
 assert.equal(await p.locator('.question-feedback').count(),0);
 await p.getByRole('button',{name:'Submit test',exact:true}).click();
 assert.equal(await p.locator('.question-feedback.good').count(),item.questions.length);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,section);
 }
 const item=bank.grades['11']['reading-a'].find(x=>x.content.includes('[[image:'));
 await p.goto(`http://127.0.0.1:8123/#/high-school/11/reading-a/study/${item.id}`,{waitUntil:'networkidle'});
 await p.locator('.passage-term').first().dblclick();assert.equal(await p.locator('.is-highlighted').count(),1);assert.equal(await p.locator('.inline-definition').count(),0);
 assert(await p.locator('.paragraph-number').count()>0);
 assert(await p.locator('.exam-figure').count()>0);
 for(const img of await p.locator('.exam-figure').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}
 assert(await p.locator('.exam-figure').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
 await p.screenshot({path:'/tmp/inspired111-high-school.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: high-school MCQ, cloze, word forms, reading, matching, sentence-choice grading; manual-only highlights and source figures.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
