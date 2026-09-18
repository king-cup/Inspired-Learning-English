// Isolated in-memory storage: never reads or modifies student/browser progress.
import assert from 'node:assert/strict';
import { schedule, validState } from '../js/guided-plan.js';

class Storage {
  getItem(key) { return Object.hasOwn(this, key) ? this[key] : null; }
  setItem(key, value) { this[key] = String(value); }
  removeItem(key) { delete this[key]; }
  clear() { for (const key of Object.keys(this)) delete this[key]; }
}
globalThis.localStorage = new Storage();
globalThis.sessionStorage = new Storage();
const S = await import('../js/store.js');
const C = await import('../js/curriculum-store.js');
const Z = await import('../js/cloze-store.js');
const originalWarning = console.warn;
console.warn = () => {}; // Expected fault injection and unavailable IndexedDB.
const snapshot = () => JSON.stringify(Object.entries(localStorage).sort());
const now = Date.now();
const plan = {
  progress: {}, history: [], session: null,
  plan: schedule(['u|word|n'], new Date(now + 86400000).toISOString(), 20, now, 'Asia/Shanghai'),
};
assert(validState(plan));
for (const broken of [null, [], {}, { ...plan, progress: { a: null } },
  { ...plan, plan: { ...plan.plan, timeZone: 'not-a-zone' } },
  { ...plan, session: { keys: ['a'], queue: [{ key: 'b', kind: 'intro' }], pos: 0 } }]) {
  assert.equal(validState(broken), false);
}
localStorage.setItem('ie.guided.u', JSON.stringify(plan));
localStorage.setItem('unrelated', 'preserve');
S.init(); C.init(); Z.init();
const backup = S.exportBackup();
assert.equal(JSON.parse(backup).schema, 3);
assert.deepEqual(JSON.parse(backup).guided.u, plan);
assert.equal(S.getLastBackup(), 0, 'Export alone must not claim a successful download');
assert.equal(S.validateBackup(backup).ok, true);
S.saveSession('u', 'test', { phase: 'asking', draft: 'word' });
assert.deepEqual(S.loadSession('u', 'test'), { phase: 'asking', draft: 'word' });

const incoming = JSON.parse(backup);
incoming.progress.words.new = { known: true, right: 1, wrong: 0, seen: 1, lastMs: now };
incoming.guided = { other: plan };
const before = snapshot();
const beforeState = S.toJSON();
const set = Storage.prototype.setItem;
let writes = 0;
Storage.prototype.setItem = function (key, value) {
  if (++writes === 3) throw new DOMException('Injected full storage', 'QuotaExceededError');
  set.call(this, key, value);
};
assert.deepEqual(S.importBackup(JSON.stringify(incoming)), { ok: false, reason: 'storage' });
Storage.prototype.setItem = set;
assert.equal(snapshot(), before, 'Failed restore must roll back every changed key');
assert.equal(S.toJSON(), beforeState, 'Failed restore must preserve in-memory progress');
const malformed = structuredClone(incoming); malformed.guided.other.session = { pos: -1 };
assert.equal(S.importBackup(JSON.stringify(malformed)).ok, false);
assert.equal(snapshot(), before);
assert.deepEqual(S.importBackup(JSON.stringify(incoming)), { ok: true });
assert.equal(S.get().words.new.known, true);
assert.equal(localStorage.getItem('ie.guided.u'), null);
assert.deepEqual(JSON.parse(localStorage.getItem('ie.guided.other')), plan);
assert.equal(S.loadSession('u', 'test'), null);
assert.equal(localStorage.getItem('unrelated'), 'preserve');
assert.equal(S.importBackup('{"words":{},"units":{}}').ok, true);
assert(localStorage.getItem('ie.guided.other'), 'Legacy backup must preserve guided plans');
localStorage.setItem('ie.guided.bad', '{broken');
assert.throws(() => S.exportBackup());
localStorage.removeItem('ie.guided.bad');
S.recordTestAnswer('u', { w: 'word', p: 'n' }, true);
assert.equal(S.flush(), true);
assert.equal(JSON.parse(localStorage.getItem('vd.progress.v1')).words['u|word|n'].right, 1);
await new Promise(resolve => setTimeout(resolve, 10));
console.warn = originalWarning;
console.log('PASS: guided backup, malformed input rejection, quota rollback, legacy compatibility, persistent sessions, immediate progress flush.');
