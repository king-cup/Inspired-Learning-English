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
  try { data = article.highlightOnly ? { entries: {}, passages: {} } : await loadGlossary(); } catch { data = { entries: {}, passages: {} }; }
  const terms = data.passages[article.id] || {};
  const known = Object.keys(terms).sort((a,b) => b.length-a.length).map(escaped);
  const pattern = new RegExp('(' + [...known, "[A-Za-z]+(?:[’'\\-][A-Za-z]+)*"].join('|') + ')(?![A-Za-z])', 'gi');
  const tools = h('div.passage-tools');
  const undo = button(tr('Undo highlight', '撤销标记'), { variant: 'thin', size: 'sm' });
  tools.append(h('span', null, tr('Double-tap any word to highlight it.', '双击任意单词即可标记。')), undo);
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
    if (article.highlightOnly) return;
    if (active === ref) { close(ref); return; }
    close(active);
    if (!ref.panel) {
      const entry = ref.entry;
      const detail = h('span.inline-definition', { role: 'note', 'aria-label': tr('Word meaning', '词语释义') },
        h('span.definition-heading', null, h('strong', null, cn(entry.w)), h('span', null, entry.p)),
        h('span.definition-meaning', null, cn(entry.c || tr('No saved meaning yet.', '暂无释义。'))));
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
      const entry = data.entries[terms[match[0].toLowerCase()]] || { w: match[0].toLowerCase(), p: '', c: '' };
      fragment.append(document.createTextNode(value.slice(at, match.index)));
      const ref = { key: `${anchor}:${offset + match.index}:${match[0].toLowerCase()}`, entry, display: match[0], context: value };
      ref.word = h('button.passage-term', { type: 'button', 'data-anchor': ref.key, 'aria-expanded': 'false', 'aria-label': match[0] + tr(': highlight', '：标记'), onclick: ev => activate(ref, ev) }, match[0]);
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
  let paragraphNumber = 0;
  paragraphs.forEach((text, index) => {
    const image = text.match(/^\[\[image:(high-school-figures\/[a-f0-9]+\.(?:png|jpe?g|gif|webp))]]$/);
    if (image) { body.append(h('img.exam-figure', { src: image[1], alt: tr('Figure from the exam paper', '试卷中的图片'), loading: 'lazy' })); return; }
    paragraphNumber += 1;
    body.append(h('div.passage-paragraph', null, h('span.paragraph-number', { 'aria-label': tr('Paragraph ', '第几段：') + paragraphNumber }, String(paragraphNumber)), h('p', null, vocab.text(text, String(index)))));
  });
  wrap.append(body); return wrap;
}
