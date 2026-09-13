import * as D from '../data.js';
import * as S from '../store.js';
import * as A from '../audio.js';
import * as P from '../profile.js';
import * as i18n from '../i18n.js';
import { h, clear, cn, press, paperHeader, barLabel, button, blockButton, ruleBar, tag, posTag, hrule, topBar, shuffled } from '../ui.js';

const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const FLIP_MS = REDUCED ? 0 : 160;
const THROW_RATIO = 0.28;

let guards = [];
let cardTimers = [];

function addGuards() {
  removeGuards();
  for (const side of ['l', 'r']) {
    const g = h('div.edge-guard.' + side);
    g.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    g.addEventListener('touchstart', (ev) => ev.preventDefault(), { passive: false });
    document.body.append(g);
    guards.push(g);
  }
}
function removeGuards() { guards.forEach((g) => g.remove()); guards = []; }

function later(fn, ms) {
  const id = setTimeout(() => { cardTimers = cardTimers.filter((t) => t !== id); fn(); }, ms);
  cardTimers.push(id);
  return id;
}
function clearTimers() { cardTimers.forEach((id) => clearTimeout(id)); cardTimers = []; }

/** Route cleanup: drop edge guards and any pending fling/flip timers so a
 *  commit can never fire after the student has navigated away (§9). */
export const teardown = () => { removeGuards(); clearTimers(); };

export function render(root, unitId, onlyKeys) {
  const unit = D.resolve(unitId);
  clear(root);
  teardown();
  if (!unit) { root.append(h('div.centre', null, h('div.k-11', null, i18n.t('unit.notFound')))); return; }

  const reversed = P.get().cardsReversed;

  const pool = onlyKeys ? unit.words.filter((e) => onlyKeys.includes(S.wordKey(unitId, e))) : unit.words;
  if (!pool.length) { root.append(h('div.centre', null, h('div.k-11', null, i18n.t('cards.empty')))); return; }

  // Restore an interrupted deck so an escaped edge-swipe-back costs nothing.
  let deck = shuffled(pool);
  let index = 0;
  const results = new Map();
  if (!onlyKeys) {
    const saved = S.loadSession(unitId, 'cards');
    if (saved && Array.isArray(saved.order) && saved.order.length === pool.length) {
      const byKey = new Map(pool.map((e) => [S.wordKey(unitId, e), e]));
      const restored = saved.order.map((k) => byKey.get(k)).filter(Boolean);
      if (restored.length === pool.length) {
        deck = restored;
        index = Math.min(saved.index || 0, deck.length);
        for (const [k, v] of saved.results || []) results.set(k, v);
      }
    }
  }

  const save = () => {
    if (onlyKeys) return;
    S.saveSession(unitId, 'cards', {
      order: deck.map((e) => S.wordKey(unitId, e)),
      index, results: [...results.entries()],
    });
  };
  const dropSave = () => { if (!onlyKeys) S.clearSession(unitId, 'cards'); };

  A.prefetch(D.clipUrlsFor(unitId));
  paint();

  // ------------------------------------------------------------------ paint
  function paint() {
    clear(root);
    removeGuards();
    clearTimers();
    if (index >= deck.length) { results_screen(); return; }
    addGuards();

    const entry = deck[index];
    const screen = h('div.cards-screen');
    screen.append(topBar(i18n.t('common.back'), onlyKeys ? i18n.t('cards.retry') : i18n.t('mode.cards'),
      () => { location.hash = '#/u/' + encodeURIComponent(unitId); }));

    const prog = h('div.row.mt', null,
      h('span.k-11', null, `${index + 1} / ${deck.length}`),
      ruleBar(index / deck.length, 'sm', { label: `${index + 1} / ${deck.length}` }));
    prog.lastChild.classList.add('grow');
    screen.append(prog);

    const wrap = h('div.deck-wrap.mt');
    const deckEl = h('div.deck');

    // Real next-card preview underneath (§1): shows the actual next front,
    // partially visible at rest and revealed as the top card is dragged away.
    // Non-interactive and hidden from assistive tech.
    let preview = null;
    if (index + 1 < deck.length) {
      preview = h('div.card.preview', { 'aria-hidden': 'true' });
      preview.append(frontFace(deck[index + 1]));
      try { preview.inert = true; } catch (e) {}
      deckEl.append(preview);
    }

    const card = h('div.card');
    let flipped = false;
    let busy = false;                 // one commit per card (§1)
    paintFace();
    deckEl.append(card);
    wrap.append(deckEl);
    screen.append(wrap);

    const stampGood = h('div.stamp.l', { 'aria-hidden': 'true', style: { opacity: '0' } }, 'Know');
    const stampBad = h('div.stamp.r', { 'aria-hidden': 'true', style: { opacity: '0' } }, 'Again');
    card.append(stampGood, stampBad);

    // ------------------------------------------------------------- gestures
    let dragging = false, startX = 0, dx = 0, moved = false;
    let lastX = 0, lastT = 0, velocity = 0;
    const width = () => card.getBoundingClientRect().width || 320;

    card.addEventListener('pointerdown', (ev) => {
      if (busy) return;
      dragging = true; moved = false; startX = ev.clientX; dx = 0;
      lastX = ev.clientX; lastT = performance.now(); velocity = 0;
      card.classList.add('dragging');
      card.classList.remove('settling');
      if (preview) preview.style.transition = 'none';
      try { card.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    card.addEventListener('pointermove', (ev) => {
      if (!dragging || busy) return;
      const now = performance.now();
      const elapsed = Math.max(8, now - lastT);
      const instant = (ev.clientX - lastX) / elapsed;
      velocity = velocity * .68 + instant * .32;
      lastX = ev.clientX; lastT = now;
      dx = ev.clientX - startX;
      if (Math.abs(dx) > 6) moved = true;
      apply(dx);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('dragging');
      if (preview) preview.style.transition = '';
      const t = width() * THROW_RATIO;
      // Project the release briefly forward. A short, decisive flick therefore
      // feels just as intentional as dragging all the way past the threshold.
      const projected = dx + velocity * 125;
      if (projected > t || velocity > 0.72) fling(true, velocity);
      else if (projected < -t || velocity < -0.72) fling(false, velocity);
      else { card.classList.add('settling'); apply(0); revealPreview(0); }
    };
    card.addEventListener('pointerup', () => { if (busy) return; const wasMoved = moved; end(); if (!wasMoved) flip(); });
    card.addEventListener('pointercancel', end);

    function apply(x) {
      const rotation = Math.max(-9, Math.min(9, x / 42));
      card.style.transform = `translateX(${x}px) rotate(${rotation}deg)`;
      const a = Math.min(1, Math.abs(x) / (width() * 0.3));
      stampGood.style.opacity = x > 20 ? String(a) : '0';
      stampBad.style.opacity = x < -20 ? String(a) : '0';
      card.classList.toggle('good', x > 20);
      card.classList.toggle('bad', x < -20);
      revealPreview(Math.min(1, Math.abs(x) / (width() * 0.6)));
    }

    function revealPreview(p) {
      if (!preview) return;
      if (REDUCED) { preview.style.transform = ''; return; }
      preview.style.transform = `scale(${(0.955 + 0.045 * p).toFixed(4)}) translateY(${((1 - p) * 9).toFixed(2)}px)`;
    }

    function fling(knew, releaseVelocity = 0) {
      if (busy) return;
      busy = true;
      setControls(true);
      card.classList.add('flinging');
      const momentum = Math.min(width() * .8, Math.abs(releaseVelocity) * 170);
      apply(knew ? width() * 1.55 + momentum : -width() * 1.55 - momentum);
      if (preview) { preview.style.transition = ''; preview.style.transform = 'scale(1) translateY(0)'; }
      later(() => commit(knew), REDUCED ? 0 : 240);
    }

    function commit(knew) {
      results.set(S.wordKey(unitId, entry), knew);
      S.markKnown(unitId, entry, knew);
      index += 1;
      save();
      paint();
    }

    // ----------------------------------------------------------------- flip
    function flip() {
      if (busy) return;
      if (FLIP_MS === 0) { flipped = !flipped; paintFace(); return; }
      card.classList.add('flipping');
      card.style.transform = 'rotateY(90deg)';
      later(() => {
        flipped = !flipped;
        paintFace();
        card.style.transition = 'none';
        card.style.transform = 'rotateY(-90deg)';
        void card.offsetWidth;
        card.style.transition = '';
        card.style.transform = 'rotateY(0deg)';
        later(() => { card.classList.remove('flipping'); card.style.transform = ''; }, FLIP_MS);
      }, FLIP_MS);
    }

    function paintFace() {
      [...card.querySelectorAll('.card-front, .card-back')].forEach((n) => n.remove());
      card.prepend(flipped ? backFace(entry) : frontFace(entry));
    }

    // ------------------------------------------------------------- controls
    const bad = button(i18n.t('cards.dontKnow'), { variant: 'ruled bad', onClick: () => fling(false) });
    const flipBtn = button(i18n.t('cards.flip'), { variant: 'ruled', onClick: () => flip() });
    const good = button(i18n.t('cards.know'), { variant: 'ruled good', onClick: () => fling(true) });
    const controls = h('div.row.mt', { style: { gap: '8px' } }, bad, flipBtn, good);
    bad.classList.add('grow'); good.classList.add('grow');
    function setControls(disabled) { [bad, flipBtn, good].forEach((b) => { b.disabled = disabled; }); }
    screen.append(controls);
    screen.append(h('div.k-8.dim', { style: { textAlign: 'center', marginTop: '7px' } }, i18n.t('cards.hint')));

    root.append(screen);
  }

  // The speak button, shared by faces. Stops propagation so tapping it does not
  // flip or drag the card.
  function sayButton(word, opts = {}) {
    return press(h('button.btn.thin' + (opts.small ? '.sm' : ''), {
      type: 'button', 'aria-label': i18n.t('a11y.playWord'),
      onclick: (ev) => { ev.stopPropagation(); A.speak(word); },
      onpointerdown: (ev) => ev.stopPropagation(),
      onpointerup: (ev) => ev.stopPropagation(),
    }, opts.glyphOnly ? '▶' : i18n.t('cards.sayIt')));
  }

  function frontFace(e) {
    if (reversed) {
      return h('div.card-front', null,
        h('div.k-8.dim', null, i18n.t('cards.tapToFlip')),
        h('div.w.cn', { lang: 'zh-Hans' }, e.c),
        posTag(e.p));
    }
    return h('div.card-front', null,
      h('div.k-8.dim', null, i18n.t('cards.tapToFlip')),
      h('div.w', null, e.w),
      posTag(e.p),
      sayButton(e.w));
  }

  function backFace(e) {
    if (reversed) {
      return h('div.card-back.centre', null, h('div.w', null, e.w), sayButton(e.w));
    }
    const head = h('div.cb-head', null,
      h('span.w', null, e.w), posTag(e.p),
      sayButton(e.w, { small: true, glyphOnly: true }));
    const mid = h('div.cb-mid', null, h('div.cn', { lang: 'zh-Hans' }, e.c));
    if (e.s || e.a) {
      const pair = h('div.cb-pair');
      if (e.s) pair.append(h('div.col', null, h('div.k-8', null, i18n.t('study.same')), h('div', { style: { fontFamily: 'var(--serif)', fontSize: '14px' } }, e.s)));
      if (e.a) pair.append(h('div.col', null, h('div.k-8', null, i18n.t('study.opposite')), h('div', { style: { fontFamily: 'var(--serif)', fontSize: '14px' } }, e.a)));
      mid.append(pair);
    }
    const back = h('div.card-back.fwd', null, head, h('div.hr', { style: { height: '2px', marginTop: '10px' } }), mid);
    if (e.e) {
      back.append(h('div.cb-foot', null,
        hrule(true),
        h('div.k-8', { style: { marginTop: '10px' } }, i18n.t('study.example')),
        h('div.ex', null, e.e)));
    }
    return back;
  }

  // ---------------------------------------------------------------- results
  function results_screen() {
    dropSave();
    S.finishCards(unitId);
    const knew = deck.filter((e) => results.get(S.wordKey(unitId, e)) === true).length;
    const missed = deck.filter((e) => results.get(S.wordKey(unitId, e)) === false);

    // Every card was committed exactly once (§1).
    console.assert(knew + missed.length === deck.length, '[cards] committed', knew + missed.length, 'of', deck.length);

    clear(root);
    let resultBusy = false;
    const once = (fn) => () => { if (resultBusy) return; resultBusy = true; fn(); };

    root.append(paperHeader({
      kicker: i18n.t('cards.finished'),
      title: unit.label,
      left: i18n.f('cards.knownOf', knew, deck.length),
      right: Math.round((knew * 100) / Math.max(1, deck.length)) + '%',
    }));

    if (missed.length) {
      const box = h('div.box.mt', { style: { borderColor: 'var(--wr-edge)' } });
      box.append(barLabel(i18n.t('cards.stillToLearn'), String(missed.length)));
      const body = h('div', { style: { background: 'var(--wr)', padding: '12px' } });
      missed.forEach((e) => body.append(h('div', { style: { fontFamily: 'var(--serif)', fontSize: '14px', padding: '2px 0' } }, e.w, '   —   ', cn(e.c))));
      box.append(body);
      root.append(box);
      root.append(h('div.mt'), blockButton(i18n.f('cards.drillMissed', missed.length), i18n.t('cards.drillMissedCaption'),
        once(() => render(root, unitId, missed.map((e) => S.wordKey(unitId, e))))));
    } else {
      root.append(h('div.note.good.mt', null, h('div.k-13', { style: { color: 'var(--rt-edge)' } }, i18n.t('cards.allKnown'))));
    }

    root.append(h('div.mt'), blockButton(i18n.t('cards.again'), i18n.t('cards.againCaption'), once(() => render(root, unitId, onlyKeys))));
    root.append(h('div.mt'), button(i18n.t('common.done'), { variant: 'ruled', size: 'lg', wide: true, onClick: once(() => { location.hash = '#/u/' + encodeURIComponent(unitId); }) }));
    root.append(h('div', { style: { height: '24px' } }));
  }
}
