import * as S from './curriculum-store.js';
import * as A from './audio.js';
import * as P from './profile.js';
import { h, clear, button, cn, announce } from './ui.js';
const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
let glossary;
export async function loadGlossary() {
  if (!glossary) glossary = fetch('passage-glossary.json').then(r => { if (!r.ok) throw new Error('Glossary unavailable'); return r.json(); }).catch(e => { glossary = null; throw e; });
  return glossary;
}
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A definition is a block between the selected text and its continuation.
 * Stable paragraph offsets preserve individual occurrences across reloads.
 * Listeners belong to this element and are released with the screen.
 */
export async function passage(article, paragraphs) {
  let data;
  try { data = await loadGlossary(); } catch (e) { data = { entries: {}, passages: {} }; }
  const terms = data.passages[article.id] || {};
  const wrap = h('section.passage');
  const body = h('article.reading-body.mt', { 'aria-label': article.title });
  const toolbar = h('div.passage-tools');
  const undo = button(tr('Undo highlight', '撤销标记'), { variant: 'thin', size: 'sm' });
  toolbar.append(h('span', null, tr('Double-tap dotted words for meanings.', '双击点状下划线词查看释义。')), undo);
  wrap.append(toolbar, body);
  let open = null;
  let lastTap = { key: null, at: 0 };
  // Avoid lookbehind: older iPad Safari can otherwise fail to open the reader.
  const pattern = Object.keys(terms).length ? new RegExp('(' + Object.keys(terms).sort((a,b) => b.length-a.length).map(escaped).join('|') + ')(?![A-Za-z])', 'gi') : null;
  const parts = paragraphs.map((text, paragraph) => {
    const rows = []; let start = 0;
    if (pattern) { pattern.lastIndex = 0; for (const match of text.matchAll(pattern)) {
      if (match.index && /[A-Za-z]/.test(text[match.index - 1])) continue;
      if (match.index > start) rows.push({ text: text.slice(start, match.index) });
      rows.push({ text: match[0], key: `${paragraph}:${match.index}:${match[0].toLowerCase()}`, entry: data.entries[terms[match[0].toLowerCase()]], context: text });
      start = match.index + match[0].length;
    } }
    if (start < text.length) rows.push({ text: text.slice(start) });
    return rows;
  });
  function activate(row, event) {
    const highlighted = S.highlights(article.id)[row.key];
    const now = Date.now();
    if (highlighted) open = open === row.key ? null : row.key;
    else if (event.detail === 0 || (lastTap.key === row.key && now-lastTap.at < 450)) {
      S.highlightWord(article, row.key, row.entry, row.text, row.context); open = row.key;
      getSelection()?.removeAllRanges();
    } else { lastTap = { key: row.key, at: now }; return; }
    lastTap = { key: null, at: 0 }; paint();
    const selected = [...body.querySelectorAll('.passage-term')].find(el => el.dataset.anchor === row.key);
    if (event.detail === 0) selected?.focus({ preventScroll: true });
  }
  function paint() {
    clear(body); const marks = S.highlights(article.id);
    undo.disabled = !Object.keys(marks).length;
    parts.forEach(rows => {
      const block = h('div.passage-paragraph'); let line = h('p'); block.append(line);
      rows.forEach(row => {
        if (!row.entry) { line.append(cn(row.text)); return; }
        const active = open === row.key;
        const word = h('button.passage-term' + (marks[row.key] ? '.is-highlighted' : ''), { type: 'button', 'data-anchor': row.key, 'aria-expanded': String(active), 'aria-label': row.text + tr(': meaning', '：释义'), onclick: ev => activate(row, ev) }, row.text);
        line.append(word);
        if (active) {
          const entry = row.entry;
          const detail = h('aside.inline-definition', { 'aria-label': tr('Word meaning', '词语释义') }, h('div.definition-heading', null, h('strong', null, cn(entry.w)), h('span', null, entry.p)), h('p.definition-meaning', null, cn(entry.c)));
          if (entry.e) detail.append(h('p', null, cn(entry.e)));
          if (entry.s) detail.append(h('p', null, tr('Related: ', '近义词：') + entry.s));
          detail.append(button(tr('Listen', '听发音'), { variant: 'thin', size: 'sm', onClick: () => A.speak(entry.w) }), button(tr('Close meaning', '收起释义'), { variant: 'thin', size: 'sm', onClick: () => { open = null; paint(); } }));
          block.append(detail); line = h('p.passage-continuation'); block.append(line);
        }
      });
      body.append(block);
    });
  }
  undo.onclick = () => { S.undoHighlight(article.id); open = null; paint(); announce(tr('Highlight removed. Encounter history kept.', '已撤销标记，保留学习接触记录。')); };
  paint(); return wrap;
}
