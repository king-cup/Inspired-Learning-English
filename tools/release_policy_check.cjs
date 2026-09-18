// Isolated browser contexts only. Never changes or publishes the real policy.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE=process.argv[2]||'http://127.0.0.1:8123';
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {for(const platform of ['pwa','android']){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',userAgent:platform==='android'?'Mozilla/5.0 InspiredEnglishAndroid/1.10.1':undefined});
  await context.addInitScript(()=>{
   if(!localStorage.getItem('vd.profile.v1'))localStorage.setItem('vd.profile.v1',JSON.stringify({name:'KeepMyProgress',lang:'en',onboarded:true}));
   localStorage.setItem('ie.tutorial.1.10.1','done');localStorage.setItem('ie.releaseNotice.1.10.1','seen');
   Object.defineProperty(navigator,'standalone',{value:true});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let offline=false;
  let policy={schemaVersion:1,enabled:false,platforms:{[platform]:{minimumVersion:'99.0.0',blockedVersions:[],updateUrl:'https://inspiredvocab.netlify.app/'}}};
  await context.route('**/release-policy.json',route=>offline?route.abort():route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(policy)}));
  await page.goto(BASE+'/#/vocab',{waitUntil:'networkidle'});await page.locator('.lib-cols').waitFor();
  assert.equal(await page.locator('.update-required').count(),0,'disabled stays off even with a higher minimum');
  const compatibility=await page.evaluate(async()=>{const R=await import('./js/release-policy.js');const rule={minimumVersion:'1.10.2',blockedVersions:['1.11.0'],updateUrl:'https://inspiredvocab.netlify.app/'};return [R.compare('1.10','1.9.9'),R.disallows(rule,'1.10.1'),R.disallows(rule,'1.10.2'),R.disallows(rule,'1.11.0'),R.disallows(rule,'2.0.0')];});
  assert.deepEqual(compatibility,[1,true,false,true,false]);
  policy.enabled=true;policy.platforms[platform].updateUrl='javascript:alert(1)';
  await page.evaluate(async()=>(await import('./js/release-policy.js')).check());assert.equal(await page.locator('.update-required').count(),0,'invalid command ignored');
  policy.platforms[platform].updateUrl='https://inspiredvocab.netlify.app/';policy.platforms[platform].minimumVersion='1.10.2';
  await page.evaluate(async()=>(await import('./js/release-policy.js')).check());await page.locator('.update-required').waitFor();
  assert.equal(await page.locator('.lib-cols,.home-choices,.passage-term').count(),0);
  assert.equal(await page.locator('main button').count(),1);
  await page.evaluate(()=>{location.hash='#/u/P1-U01/test';});await page.waitForTimeout(100);assert.equal(await page.locator('.update-required').count(),1,'route cannot bypass');
  policy.enabled=false;await page.reload({waitUntil:'networkidle'});await page.locator('.update-required').waitFor();
  offline=true;await page.reload({waitUntil:'networkidle'});await page.locator('.update-required').waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd.profile.v1')).name),'KeepMyProgress');
  // The latched floor allows the permitted upgrade, not the retired release.
  const cached=await page.evaluate(async p=>{const rule=JSON.parse(localStorage.getItem('ie.releasePolicy.v1'))[p];const R=await import('./js/release-policy.js');return [R.disallows(rule,'1.10.1'),R.disallows(rule,'1.10.2')];},platform);assert.deepEqual(cached,[true,false]);
  await page.screenshot({path:'.impeccable/review/policy-'+platform+'.png'});
  assert.deepEqual(errors,[]);console.log('PASS '+platform+': manual-only, disabled default, validation, live lock, restart/offline-policy latch, route guard, data retention, upgrade compatibility');
  await context.close();
 }}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
