const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='http://127.0.0.1:8123';
const unit='P1-U01', words=JSON.parse(fs.readFileSync('vocab.json')).data[unit].slice(0,6);
const fixture={types:[{type:'Book Units',groupLabel:'Book',groups:[{name:'Prepare Level 1',units:[{id:unit,label:'Unit 1'}]}]}],data:{[unit]:words}};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 for(const width of [390,834]) {
 const ctx=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
 await ctx.addInitScript(()=>{
 localStorage.setItem('vd.profile.v1',JSON.stringify({name:'QA',lang:'en',onboarded:true}));
 for(const v of ['1.10.2','1.11']) { localStorage.setItem('ie.tutorial.'+v,'done');localStorage.setItem('ie.releaseNotice.'+v,'seen'); }
 Object.defineProperty(navigator,'standalone',{value:true});
 });
 await ctx.route('**/content/manifest.json*',r=>r.abort());
 await ctx.route('**/vocab.json',r=>r.fulfill({json:fixture}));
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 const go=route=>p.goto(base+'/#/'+route,{waitUntil:'networkidle'});
 const state=()=>p.evaluate(id=>JSON.parse(localStorage.getItem('ie.guided.'+id)),unit);
 await go('');assert.deepEqual(await p.locator('.home-choices .t').allTextContents(),['Vocabulary','Middle School English','High School English','Reading Comprehension','Memory Palace']);
 assert.equal(await p.locator('.block .c').count(),0);
 await go('u/'+unit+'/guided');
 assert.deepEqual(await p.locator('.block .t').allTextContents(),['Learn all words','Daily study plan']);
 await p.getByRole('button',{name:'Daily study plan',exact:true}).click();
 assert.equal(await p.locator('#study-minutes').count(),0);
 await p.getByRole('button',{name:'Create my plan',exact:true}).click();
 assert.equal((await state()).plan.days.length,5);
 await p.getByRole('button',{name:'Change my plan',exact:true}).click();
 await p.getByRole('button',{name:'Learn all words',exact:true}).click();
 let sawSecondBlock=false;
 for(let i=0;i<100;i++) {
 let st=await state();if(!st.session) break;
 const s=st.session,item=s.queue[s.pos];
 if(Object.values(st.progress).filter(x=>x.complete).length===5) sawSecondBlock=true;
 if(item.kind==='intro') {
 await p.getByRole('button',{name:'Listen',exact:true}).click();
 await p.getByRole('checkbox',{name:'I read it aloud'}).check();
 if(i===0) await p.screenshot({path:'/tmp/inspired111-guided-'+width+'.png',fullPage:true});
 await p.getByRole('button',{name:'Continue',exact:true}).click();
 } else if(s.feedback) await p.getByRole('button',{name:'Continue',exact:true}).click();
 else {
 assert(['WORD_TO_MEANING','MEANING_TO_WORD'].includes(s.question.type));
 await p.locator('.stack .block').nth(s.question.correctIndex).click();
 }
 }
 assert(sawSecondBlock,'all mode automatically advances beyond five words');
 assert.equal(Object.values((await state()).progress).filter(x=>x.complete).length,6);
 await go('u/'+unit+'/test');
 assert.equal(await p.getByRole('button',{name:/Spelling|Mixed/}).count(),0);
 await p.getByRole('button',{name:'Start the test',exact:true}).click();
 assert.equal(await p.locator('#spelling-answer').count(),0);
 await go('reading/book/foundation/study');
 await p.locator('.box .middle-row').first().waitFor();
 assert(await p.locator('.box .middle-row').count()>0);
 await p.screenshot({path:'/tmp/inspired111-reading-'+width+'.png',fullPage:true});
 await p.locator('.middle-row').first().click();await p.locator('.passage-term').first().waitFor();
 assert(await p.locator('.paragraph-number').count()>0);
 await p.locator('.passage-term').first().dblclick();assert.equal(await p.locator('.is-highlighted').count(),1);
 await p.getByRole('button',{name:'Undo highlight',exact:true}).click();assert.equal(await p.locator('.is-highlighted').count(),0);
 await go('middle/7/reading-a/study');
 await p.locator('.middle-row b').first().waitFor();
 assert.match(await p.locator('.middle-row b').first().textContent(),/^Package /);
 await p.locator('.middle-row').first().click();await p.locator('.paragraph-number').first().waitFor();
 assert(await p.locator('.paragraph-number').count()>2);
 // Unknown terms and high-school highlight-only must work without a glossary.
 await p.evaluate(async()=>{const {passage}=await import('./js/passage.js');document.querySelector('#app').replaceChildren(await passage({id:'qa-high',title:'QA',highlightOnly:true},['photosynthesis electrophysiology'],true));});
 await p.getByRole('button',{name:'electrophysiology: highlight',exact:true}).dblclick();
 assert.equal(await p.locator('.is-highlighted').count(),1);assert.equal(await p.locator('.inline-definition').count(),0);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);await ctx.close();console.log('PASS 1.11 browser '+width);
 }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
