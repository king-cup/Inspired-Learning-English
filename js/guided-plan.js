// Calendar arithmetic uses dates in the plan's original timezone, not 24-hour
// durations (which break over daylight-saving transitions).
export function dateKey(ms = Date.now(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms);
  const value = type => parts.find(p => p.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
const dayNumber = key => Date.parse(key + 'T12:00:00Z') / 86400000;
const dayKey = number => new Date(number * 86400000).toISOString().slice(0, 10);

export function schedule(keys, deadline, minutes = 20, now = Date.now(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, reviewKeys = []) {
  const end = Date.parse(deadline);
  if (!Number.isFinite(end) || end <= now) throw new Error('deadline');
  if (!Array.isArray(keys) || !Array.isArray(reviewKeys) || !(keys.length + reviewKeys.length) || !Number.isFinite(minutes) || minutes < 1) throw new Error('selection');
  if (new Set([...keys, ...reviewKeys]).size !== keys.length + reviewKeys.length) throw new Error('selection');
  const firstDay = dayNumber(dateKey(now, timeZone));
  const count = dayNumber(dateKey(end, timeZone)) - firstDay + 1;
  if (count < 1 || count > 366) throw new Error('deadline');
  const newDays = count > 1 ? count - 1 : 1;
  const days = Array.from({ length: count }, (_, i) => ({ date: dayKey(firstDay + i), keys: [] }));
  keys.forEach((key, i) => days[Math.floor(i * newDays / keys.length)].keys.push(key));
  return { timeZone, createdAt: new Date(now).toISOString(), deadline: new Date(end).toISOString(),
    days, reviewKeys: [...reviewKeys], reviewOnlyLastDay: count > 1 && keys.length > 0 };
}

export function due(plan, progress, now = Date.now()) {
  const today = dateKey(now, plan.timeZone);
  const newKeys = plan.days.filter(day => day.date <= today).flatMap(day => day.keys).filter(key => !progress[key]?.complete);
  const selected = new Set([...plan.days.flatMap(day => day.keys), ...(plan.reviewKeys || [])]);
  const reviewKeys = Object.entries(progress).filter(([key, item]) => selected.has(key) && item.complete && item.lastDate < today && item.reviewedDate !== today)
    .sort((a, b) => (b[1].wrong || 0) - (a[1].wrong || 0)).map(([key]) => key);
  return { today, newKeys, reviewKeys };
}

export function exercises(keys) {
  // Interleaved rounds prevent four immediate repetitions being mistaken for
  // retrieval. A one-word list necessarily has no other item to space with.
  return ['meaning', 'recall', 'meaning-review', 'recall-review'].flatMap(kind => keys.map(key => ({ key, kind })));
}

// Shared boundary for backups and local plan recovery. Corrupt input must not
// become a partially restored lesson or make the route crash.
export function validState(state) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(dayNumber(value)) && dayKey(dayNumber(value)) === value;
  const kinds = ['intro', 'meaning', 'context', 'spelling', 'recall', 'meaning-review', 'recall-review'];
  if (!object(state) || !object(state.progress) || !Array.isArray(state.history)) return false;
  if (!Object.values(state.progress).every(item => object(item) && strings(item.completedKinds)
    && item.completedKinds.every(kind => kinds.slice(1).includes(kind))
    && new Set(item.completedKinds).size === item.completedKinds.length
    && Number.isInteger(item.wrong) && item.wrong >= 0
    && (item.complete === undefined || typeof item.complete === 'boolean')
    && (!item.complete || (item.completedKinds.length === 4 && validDate(item.lastDate))))) return false;
  if (state.plan) {
    const p = state.plan;
    if (!object(p) || !Number.isFinite(Date.parse(p.deadline)) || !Array.isArray(p.days) || !p.days.length || p.days.length > 366
      || !p.days.every(day => object(day) && validDate(day.date) && strings(day.keys))
      || (p.reviewKeys !== undefined && !strings(p.reviewKeys))) return false;
    try { dateKey(Date.now(), p.timeZone); } catch (_) { return false; }
  }
  const s = state.session;
  if (s) {
    if (!state.plan || !object(s) || !strings(s.keys) || !s.keys.length || !Array.isArray(s.queue) || !s.queue.length
      || !Number.isInteger(s.pos) || s.pos < 0 || s.pos > s.queue.length
      || !s.queue.every(item => object(item) && s.keys.includes(item.key) && kinds.includes(item.kind))
      || (s.draft !== undefined && typeof s.draft !== 'string')
      || (s.feedback && (!object(s.feedback) || typeof s.feedback.unaided !== 'boolean' || typeof s.feedback.correct !== 'boolean'))
      || ((s.review || s.pos === s.queue.length) && !s.keys.every(key => object(state.progress[key])))) return false;
    if (s.question && (!object(s.question) || !['SPELLING','WORD_TO_MEANING','MEANING_TO_WORD','SENTENCE_GAP'].includes(s.question.type)
      || !strings(s.question.options) || typeof s.question.prompt !== 'string'
      || (s.question.type !== 'SPELLING' && (!Number.isInteger(s.question.correctIndex) || s.question.correctIndex < 0 || s.question.correctIndex >= s.question.options.length)))) return false;
  }
  return true;
}
