// Settings: name, language, invert colours, reverse cards, pronunciation +
// audio cache management (§9), and progress backup / restore / share (§7).
// Each change writes the profile and re-paints in place.

import { APP_VERSION, clipCount, activeVersion, lastCheck } from '../data.js';
import * as P from '../profile.js';
import * as A from '../audio.js';
import * as S from '../store.js';
import * as Activity from '../activity.js';
import * as i18n from '../i18n.js';
import { LANGS } from '../i18n.js';
import { applyTheme } from '../theme.js';
import { runUpdateCheck } from '../updates.js';
import { content as releaseLog } from '../release-notes.js';
import { h, clear, paperHeader, barLabel, button, toggleRow, topBar, openDialog, announce, leafMark } from '../ui.js';

const MAX_NAME = 24;
const mb = (bytes) => (bytes / 1048576).toFixed(1) + ' MB';
const fmtDate = (ms) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms));
const fmtDateTime = (ms) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));

export function render(root) {
  let editing = false;
  let draft = P.get().name;

  function paint() {
    const t = i18n.strings();
    const p = P.get();
    clear(root);

    root.append(topBar(t.get('common.back'), t.get('set.title'), () => { location.hash = '#/'; }));

    root.append(h('div.mt'), paperHeader({
      kicker: t.get('set.kicker'),
      title: t.get('set.title'),
      left: p.name,
      right: t.f('set.version', APP_VERSION),
    }));

    // --- name --------------------------------------------------------------
    const nameBox = h('div.box.mt');
    nameBox.append(barLabel(t.get('set.name')));
    const nameBody = h('div', { style: { padding: '13px' } });
    if (editing) {
      const input = h('input.txtfield', {
        type: 'text', value: draft, maxlength: String(MAX_NAME), 'aria-label': t.get('set.name'),
        autocapitalize: 'words', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done',
      });
      input.addEventListener('input', () => { draft = input.value.slice(0, MAX_NAME); if (input.value.length > MAX_NAME) input.value = draft; });
      const actions = h('div.row.mt', null,
        button(t.get('common.cancel'), { variant: 'thin', size: 'sm', onClick: () => { draft = p.name; editing = false; paint(); } }),
        button(t.get('common.save'), { variant: 'thin', size: 'sm', onClick: () => {
          if (draft.trim()) P.setName(draft);
          editing = false; paint();
        } }));
      actions.children[0].classList.add('grow');
      actions.children[1].classList.add('grow');
      nameBody.append(input, actions);
    } else {
      nameBody.append(h('div.name-static', null,
        h('div.val', null, p.name || '—'),
        button(t.get('set.nameChange'), { variant: 'thin', size: 'sm', onClick: () => { draft = p.name; editing = true; paint(); } })));
    }
    nameBox.append(nameBody);
    root.append(nameBox);

    // --- language ----------------------------------------------------------
    const langBox = h('div.box.mt');
    langBox.append(barLabel(t.get('set.language')));
    const row = h('div.lang-row');
    LANGS.forEach((opt) => {
      row.append(button(opt.label, {
        variant: 'ruled', on: opt.code === p.lang, ariaPressed: opt.code === p.lang,
        onClick: () => { P.setLang(opt.code); i18n.use(opt.code); paint(); },
      }));
    });
    langBox.append(h('div', { style: { padding: '13px' } }, row));
    root.append(langBox);

    // --- display (invert) --------------------------------------------------
    const dispBox = h('div.box.mt');
    dispBox.append(barLabel(t.get('set.display')));
    dispBox.append(toggleRow({
      title: t.get('set.invert'), help: t.get('set.invertHelp'),
      checked: p.inverted, onLabel: t.get('set.on'), offLabel: t.get('set.off'),
      onChange: (on) => { P.setInverted(on); applyTheme(on); paint(); },
    }));
    root.append(dispBox);
    const colors = h('div.box.mt', null, barLabel(p.lang === 'zh' ? '词汇标记颜色' : 'Vocabulary highlight colour'));
    const palette = h('div.highlight-palette', { role: 'group', 'aria-label': p.lang === 'zh' ? '标记颜色' : 'Highlight colour' });
    Object.entries(P.HIGHLIGHTS).forEach(([key, row]) => {
      const option = button(row[p.lang === 'zh' ? 1 : 0], { variant: 'thin', ariaPressed: key === p.highlightColor, onClick: () => { P.setHighlightColor(key); paint(); } });
      option.style.backgroundColor = row[2]; option.style.color = row[3]; option.dataset.highlightColor = key;
      palette.append(option);
    });
    colors.append(palette, h('p.note', null, p.lang === 'zh' ? '更改颜色会应用于所有已保存的标记，不会改变学习记录。' : 'Applies to all saved highlights without changing your learning history.'));
    root.append(colors);

    // --- cards (reverse) ---------------------------------------------------
    const cardsBox = h('div.box.mt');
    cardsBox.append(barLabel(t.get('set.cards')));
    cardsBox.append(toggleRow({
      title: t.get('set.reverse'), help: t.get('set.reverseHelp'),
      checked: p.cardsReversed, onLabel: t.get('set.on'), offLabel: t.get('set.off'),
      onChange: (on) => { P.setCardsReversed(on); paint(); },
    }));
    root.append(cardsBox);

    // --- pronunciation + cache (§9) ----------------------------------------
    root.append(audioBox(t));

    // --- vocabulary updates (v1.03 §4) -------------------------------------
    root.append(vocabBox(t));
    const log = h('details.box.mt.release-log', null, h('summary', { style: { padding: '14px', cursor: 'pointer', minHeight: '44px' } }, p.lang === 'zh' ? '更新与修复记录 · 1.04–1.10.1' : 'Updates & fixes · 1.04–1.10.1'));
    log.append(h('div', { style: { padding: '0 14px 14px' } }, releaseLog()));
    root.append(log);

    // --- progress & backup (§7) --------------------------------------------
    root.append(dataBox(t, p));

    // --- about + leaf mark (§10) -------------------------------------------
    const about = h('div.box.soft.mt');
    about.append(barLabel(t.get('set.about')));
    about.append(h('div.brandmark', { style: { padding: '13px' } },
      leafMark(40),
      h('div', null,
        h('div.k-11', null, t.get('app.title')),
        h('div.set-line', { style: { padding: '2px 0 0' } }, t.f('set.version', APP_VERSION)))));
    root.append(about);
    root.append(h('div.mt'), button(P.get().lang === 'zh' ? '重看使用指南' : 'Replay tutorial', { variant: 'thin', wide: true, onClick: () => { location.hash = '#/tutorial'; } }));

    root.append(h('div', { style: { height: '30px' } }));
  }

  // ---- pronunciation / cache section --------------------------------------
  function audioBox(t) {
    const box = h('div.box.mt');
    box.append(barLabel(t.get('set.audio')));
    const body = h('div', { style: { padding: '13px' } });

    // Source of the most recent playback (§9).
    const st = A.getStatus();
    const srcLabel = clipCount() > 0 ? t.get('audio.srcClip')
      : st === A.Status.VOICE ? t.get('audio.srcVoice')
      : st === A.Status.SILENT ? t.get('audio.srcNone') : t.get('audio.srcClip');
    body.append(h('div.k-11', null, srcLabel));

    const line = h('div.set-line', { style: { padding: '8px 0 0' } }, '…');
    body.append(line);

    const clear = button(t.get('audio.clear'), { variant: 'thin', size: 'sm', wide: true });
    clear.style.marginTop = '10px';
    body.append(clear);
    box.append(body);

    const refresh = async () => {
      const info = await A.cacheSizeInfo();
      line.textContent = info.count ? i18n.f('audio.cacheLine', info.count, mb(info.approxBytes)) : i18n.f('audio.cacheLine', 0, mb(0));
      clear.disabled = !info.count;
    };
    refresh();

    clear.addEventListener('click', () => {
      openDialog({
        title: t.get('audio.clearAsk'),
        body: t.get('audio.clearBody'),
        actions: [
          { label: t.get('common.cancel'), variant: 'thin' },
          { label: t.get('audio.clear'), variant: 'thin bad', onClick: async () => { await A.clearCache(); announce(t.get('audio.cleared')); refresh(); } },
        ],
      });
    });
    return box;
  }

  // ---- vocabulary updates section (v1.03 §4) ------------------------------
  function vocabBox(t) {
    const box = h('div.box.mt');
    box.append(barLabel(t.get('set.vocab')));
    const body = h('div', { style: { padding: '13px' } });

    const ver = activeVersion();
    body.append(h('div.k-11', null, ver ? t.f('set.contentVersion', ver) : t.get('set.contentBundled')));

    const lc = lastCheck();
    body.append(h('div.set-line', { style: { padding: '6px 0 10px' } },
      lc ? t.f('set.lastChecked', fmtDateTime(lc)) : t.get('set.neverChecked')));

    const btn = button(t.get('set.checkUpdates'), { variant: 'thin', size: 'sm', wide: true });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await runUpdateCheck({ manual: true });   // toasts the outcome
      paint();                                    // refresh version + last-checked lines
    });
    body.append(btn);
    box.append(body);
    return box;
  }

  // ---- progress & backup section ------------------------------------------
  function dataBox(t, p) {
    const box = h('div.box.mt');
    box.append(barLabel(t.get('set.data')));
    const body = h('div', { style: { padding: '13px' } });
    body.append(h('div.field-help', { style: { marginTop: '0' } }, t.get('set.dataHelp')));

    const last = S.getLastBackup();
    body.append(h('div.set-line', { style: { padding: '8px 0 12px' } },
      last ? t.f('set.lastBackup', fmtDate(last)) : t.get('set.neverBackedUp')));

    const backup = button(t.get('set.backup'), { variant: 'thin', size: 'sm', wide: true });
    const restore = button(t.get('set.restore'), { variant: 'thin', size: 'sm', wide: true });
    const share = button(t.get('set.shareReport'), { variant: 'thin', size: 'sm', wide: true });
    restore.style.marginTop = '8px';
    share.style.marginTop = '8px';
    body.append(backup, restore, share);
    const journal = button(p.lang === 'zh' ? '导出带时间戳的学习记录' : 'Export timestamped learning history', { variant: 'thin', wide: true, size: 'sm', onClick: async () => {
      journal.disabled = true;
      try { const data = await Activity.exportJournal(); await shareOrDownload(JSON.stringify(data, null, 2), `learning-history-${new Date().toISOString().slice(0,10)}.json`, 'application/json', p.lang === 'zh' ? '学习记录' : 'Learning history'); }
      catch (_) { flashError(p.lang === 'zh' ? '无法读取本地记录，请重试。' : 'Could not read local history. Please try again.'); }
      finally { journal.disabled = false; }
    } });
    body.append(h('div.mt'), journal, h('p.field-help', null, p.lang === 'zh'
      ? '学习活动与时间戳仅保存在本设备。不录音、不自动发送给老师。设备时间可以更改，因此记录不能作为防篡改的出勤证明。离开页面或闲置超过一分钟不计入有效学习时间。'
      : 'Activity and timestamps stay on this device. No microphone recording or automatic teacher upload. Device time can be changed, so this is not tamper-proof attendance. Hidden time and idle time beyond one minute are excluded.'));
    box.append(body);

    backup.addEventListener('click', async () => {
      try {
        const text = S.exportBackup();
        const name = `vocab-progress-${new Date().toISOString().slice(0, 10)}.json`;
        const ok = await shareOrDownload(text, name, 'application/json', t.get('backup.saved'));
        if (ok) { S.markBackup(); announce(t.get('backup.saved')); paint(); }
      } catch (_) {
        flashError(p.lang === 'zh' ? '无法读取完整进度，备份未生成。原有记录未更改，请勿清除应用数据。请重试，或联系老师协助恢复。' : 'A complete backup could not be read. Your saved data has not been changed. Do not clear app data; retry or ask your teacher for recovery help.');
      }
    });

    restore.addEventListener('click', () => pickFile('application/json,.json', (text) => {
      const v = S.validateBackup(text);
      if (!v.ok) { announce(t.get('backup.invalid'), true); flashError(t.get('backup.invalid')); return; }
      openDialog({
        title: t.get('backup.restoreAsk'),
        body: t.get('backup.restoreBody'),
        actions: [
          { label: t.get('common.cancel'), variant: 'thin' },
          { label: t.get('backup.replace'), variant: 'thin bad', onClick: () => {
            const r = S.importBackup(text);
            if (r.ok) { announce(t.get('backup.restored')); paint(); }
            else {
              const message = r.reason === 'storage'
                ? (p.lang === 'zh' ? '设备未能保存恢复的进度。请清理存储空间后重试，不要清除应用数据。' : 'This device could not save the restored progress. Free storage space and retry; do not clear app data.')
                : t.get('backup.invalid');
              announce(message, true); flashError(message);
            }
          } },
        ],
      });
    }, () => { announce(t.get('backup.readFail'), true); flashError(t.get('backup.readFail')); }));

    share.addEventListener('click', async () => {
      const text = buildReportText(t);
      const name = `progress-report-${new Date().toISOString().slice(0, 10)}.txt`;
      const ok = await shareOrDownload(text, name, 'text/plain', t.get('backup.shared'), true);
      if (ok) announce(t.get('backup.shared'));
    });

    return box;
  }

  function flashError(msg) {
    openDialog({ title: i18n.t('common.close'), body: msg, actions: [{ label: i18n.t('common.close'), variant: 'thin' }] });
  }

  function buildReportText(t) {
    const p = P.get();
    const a = S.aggregate();
    const L = [];
    L.push(t.f('report.for', p.name || '—'));
    L.push(t.f('report.generated', new Date().toLocaleString()));
    L.push('');
    L.push(`${t.get('report.unitsStarted')}: ${a.unitsStarted}`);
    L.push(`${t.get('report.unitsComplete')}: ${a.unitsComplete}`);
    L.push(`${t.get('report.wordsKnown')}: ${a.wordsKnown}`);
    if (a.bestScores.length) {
      L.push(''); L.push(t.get('report.bestScores') + ':');
      a.bestScores.forEach((b) => L.push(`  ${b.label} — ${b.bestPct}%`));
    }
    if (a.topMissed.length) {
      L.push(''); L.push(t.get('report.topMissed') + ':');
      a.topMissed.forEach((m) => L.push(`  ${m.w} — ${m.c}  (${t.f('unit.missedTimes', m.wrong)})`));
    }
    if (!a.unitsStarted && !a.wordsKnown) { L.push(''); L.push(t.get('report.none')); }
    return L.join('\n');
  }

  paint();
}

// ---- share / download / file helpers --------------------------------------

async function shareOrDownload(text, filename, mime, shareTitle, preferText) {
  try {
    if (navigator.share) {
      if (preferText) { await navigator.share({ title: shareTitle, text }); return true; }
      if (typeof File !== 'undefined') {
        const file = new File([text], filename, { type: mime });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return true; }
      }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;   // student dismissed the sheet
    // otherwise fall through to a plain download
  }
  return downloadText(filename, text, mime);
}

function downloadText(filename, text, mime) {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename, style: { display: 'none' } });
    document.body.append(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
    return true;
  } catch (e) { return false; }
}

function pickFile(accept, onText, onError) {
  const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
  document.body.append(inp);
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0];
    inp.remove();
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result || ''));
    reader.onerror = () => { if (onError) onError(); };
    reader.readAsText(f);
  });
  inp.click();
}
