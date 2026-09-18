import * as S from './curriculum-store.js';
import * as A from './audio.js';
import * as P from './profile.js';
import { h, button, cn, announce } from './ui.js';
const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
let glossary;
export async function loadGlossary() {
  if (!glossary) glossary = fetch('passage-glossary.json').then(r => { if (!r.ok) throw new Error('Glossary unavailable'); return r.json(); }).catch(e => { glossary = null; throw e; });
  return glossary;
}
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The controller is shared by passage text and question options. Test mode
// returns plain text without fetching definitions or adding interactive nodes.
export async function vocabulary(article, enabled = true) {
  if (!enabled) return { text: value => document.createTextNode(value), tools: null };
  let data;
  try { data = await loadGlossary(); } catch { data = { entries: {}, passages: {} }; }
  const terms = data.passages[article.id] || {};
  const pattern = Object.keys(terms).length ? new RegExp('(' + Object.keys(terms).sort((a,b) => b.length-a.length).map(escaped).join('|') + ')(?![A-Za-z])', 'gi') : null;
  const tools = h('div.passage-tools');
  const undo = button(tr('Undo highlight', '撤销标记'), { variant: 'thin', size: 'sm' });
  tools.append(h('span', null, tr('Study: double-tap dotted words for meanings. Tap a saved highlight once to open or close.', '学习模式：双击点状下划线词查看释义；单击已标记词展开或收起。')), undo);
  const refs = [];
  let active = null, lastTap = { key: null, at: 0 };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function close(ref) {
    if (!ref?.panel) return;
    ref.panel.classList.remove('open'); ref.word.setAttribute('aria-expanded', 'false');
    ref.panel.inert = true;
    setTimeout(() => { if (!ref.panel.classList.contains('open')) ref.panel.hidden = true; }, reduced() ? 0 : 380);
    if (active === ref) active = null;
  }
  function refresh() {
    const marks = S.highlights(article.id);
    refs.forEach(ref => ref.word.classList.toggle('is-highlighted', !!marks[ref.key]));
    undo.disabled = !Object.keys(marks).length;
  }
  function activate(ref, ev) {
    ev.preventDefault(); ev.stopPropagation();
    const now = Date.now();
    if (!S.highlights(article.id)[ref.key]) {
      if (ev.detail !== 0 && !(lastTap.key === ref.key && now - lastTap.at < 450)) { lastTap = { key: ref.key, at: now }; return; }
      S.highlightWord(article, ref.key, ref.entry, ref.display, ref.context);
      getSelection()?.removeAllRanges(); refresh();
    }
    lastTap = { key: null, at: 0 };
    if (active === ref) { close(ref); return; }
    close(active);
    if (!ref.panel) {
      const entry = ref.entry;
      const detail = h('span.inline-definition', { role: 'note', 'aria-label': tr('Word meaning', '词语释义') },
        h('span.definition-heading', null, h('strong', null, cn(entry.w)), h('span', null, entry.p)),
        h('span.definition-meaning', null, cn(entry.c)));
      if (entry.e) detail.append(h('span.definition-example', null, cn(entry.e)));
      if (entry.s) detail.append(h('span.definition-example', null, tr('Related: ', '近义词：') + entry.s));
      detail.append(button(tr('Listen', '听发音'), { variant: 'thin', size: 'sm', onClick: ev => { ev.preventDefault(); ev.stopPropagation(); A.speak(entry.w); } }),
        button(tr('Close meaning', '收起释义'), { variant: 'thin', size: 'sm', onClick: ev => { ev.preventDefault(); ev.stopPropagation(); close(ref); ref.word.focus({preventScroll:true}); } }));
      ref.panel = h('span.cloze-fold.vocab-fold', { hidden: true }, h('span.cloze-fold-inner', null, detail));
      ref.word.after(ref.panel);
    }
    ref.panel.hidden = false; ref.panel.inert = false; active = ref;
    ref.word.setAttribute('aria-expanded', 'true');
    // Commit the folded frame before opening, including when reopening rapidly.
    void ref.panel.offsetHeight;
    requestAnimationFrame(() => { if (active === ref) ref.panel.classList.add('open'); });
  }
  function text(value, anchor = '0', offset = 0) {
    const fragment = document.createDocumentFragment(); let at = 0;
    if (pattern) for (const match of value.matchAll(pattern)) {
      if (match.index && /[A-Za-z]/.test(value[match.index - 1])) continue;
      const entry = data.entries[terms[match[0].toLowerCase()]];
      if (!entry) continue;
      fragment.append(document.createTextNode(value.slice(at, match.index)));
      const ref = { key: `${anchor}:${offset + match.index}:${match[0].toLowerCase()}`, entry, display: match[0], context: value };
      ref.word = h('button.passage-term', { type: 'button', 'data-anchor': ref.key, 'aria-expanded': 'false', 'aria-label': match[0] + tr(': meaning', '：释义'), onclick: ev => activate(ref, ev) }, match[0]);
      refs.push(ref); fragment.append(ref.word); at = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(value.slice(at))); refresh(); return fragment;
  }
  undo.onclick = () => { close(active); S.undoHighlight(article.id); refresh(); announce(tr('Highlight removed. Encounter history kept.', '已撤销标记，保留学习接触记录。')); };
  refresh(); return { text, tools };
}
export async function passage(article, paragraphs, enabled = true) {
  const vocab = await vocabulary(article, enabled);
  const wrap = h('section.passage');
  const body = h('article.reading-body.mt', { 'aria-label': article.title });
  if (vocab.tools) wrap.append(vocab.tools);
  paragraphs.forEach((text, index) => body.append(h('div.passage-paragraph', null, h('p', null, vocab.text(text, String(index))))));
  wrap.append(body); return wrap;
}
