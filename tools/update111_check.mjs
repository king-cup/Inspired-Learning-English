import assert from 'node:assert/strict';
import { build, QType } from '../js/learn-engine.js';
import { schedule, exercises, validState } from '../js/guided-plan.js';
import { examTitle } from '../js/exam-source.js';
const pool = ['phone','photo','card','table'].map((w,i) => ({w,c:['电话','照片','卡片','桌子'][i],e:`Is that your ${w}?`}));
for(let i=0;i<100;i++) {
  const q=build(pool[i%4],pool);
  assert([QType.WORD_TO_MEANING,QType.MEANING_TO_WORD].includes(q.type));
  assert.equal(q.options.length,4);
}
assert.notEqual(build(pool[0],pool,{allowedTypes:[QType.SENTENCE_GAP]}).type,QType.SENTENCE_GAP);
const now=Date.parse('2026-09-19T01:00:00Z'), keys=['a','b','c','d','e','f'];
const plan=schedule(keys,'2026-09-23T12:00:00Z',20,now,'Asia/Shanghai');
assert.deepEqual(plan.days,schedule(keys,'2026-09-23T12:00:00Z',1,now,'Asia/Shanghai').days);
assert.equal(plan.days.at(-1).keys.length,0);
assert.deepEqual(plan.days.flatMap(d=>d.keys),keys);
assert.equal(schedule(keys,'2026-09-19T12:00:00Z',20,now,'Asia/Shanghai').days[0].keys.length,6);
assert(exercises(keys).every(x=>!['spelling','context'].includes(x.kind)));
assert(validState({plan,session:null,history:[],progress:{a:{wrong:0,complete:true,lastDate:'2026-09-19',completedKinds:['meaning','recall','meaning-review','recall-review']}}}));
assert.equal(examTitle({sources:['004_2023-2024_期中_海淀_解析.docx']}),'Package 004 · 期中 · 海淀 · 2023-2024');
console.log('1.11 logic: definition-only questions, daily allocation, recovery schema and source labels passed.');
