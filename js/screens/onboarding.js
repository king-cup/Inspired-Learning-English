// One-time first-launch screen (6.2). Collects the two things every later
// screen depends on: what to call the student, and which language to speak to
// them in. Stored in the SEPARATE profile store so a unit reset never costs a
// student their name.
//
// The language buttons are labelled in their OWN language ("English" / "中文")
// so a student who cannot read the current one can still find theirs, and the
// whole screen re-translates live as they tap.

import { APP_VERSION } from '../data.js';
import { LANGS, stringsFor } from '../i18n.js';
import { h, clear, paperHeader, barLabel, button, blockButton, leafMark } from '../ui.js';

const MAX_NAME = 24;

export function render(root, onDone) {
  let name = '';
  let lang = 'en';
  let warn = false;

  function paint() {
    const t = stringsFor(lang);   // preview in the chosen language, live
    clear(root);

    // Inspire leaf mark, tastefully above the header (§10).
    root.append(h('div', { style: { height: '10px' } }));
    root.append(h('div', { style: { display: 'flex', justifyContent: 'center' } }, leafMark(56)));
    root.append(h('div', { style: { height: '10px' } }));
    root.append(paperHeader({
      kicker: t.get('onboard.kicker'),
      title: t.get('app.title'),
      left: t.get('onboard.title'),
      right: 'v' + APP_VERSION,
    }));

    // --- name --------------------------------------------------------------
    const nameBox = h('div.box.mt2');
    nameBox.append(barLabel(t.get('onboard.nameLabel')));
    const input = h('input.txtfield' + (warn && !name.trim() ? '.warn' : ''), {
      type: 'text', value: name, maxlength: String(MAX_NAME),
      placeholder: t.get('onboard.nameHint'), 'aria-label': t.get('onboard.nameLabel'),
      autocapitalize: 'words', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done',
    });
    input.addEventListener('input', () => {
      name = input.value.slice(0, MAX_NAME);
      if (input.value.length > MAX_NAME) input.value = name;
      if (warn && name.trim()) { warn = false; help.className = 'field-help'; input.classList.remove('warn'); }
    });
    const help = h('div.field-help' + (warn && !name.trim() ? '.warn' : ''), null,
      warn && !name.trim() ? t.get('onboard.needName') : t.get('onboard.nameHelp'));
    nameBox.append(h('div', { style: { padding: '13px' } }, input, help));
    root.append(nameBox);

    // --- language ----------------------------------------------------------
    const langBox = h('div.box.mt');
    langBox.append(barLabel(t.get('onboard.langLabel')));
    const row = h('div.lang-row');
    LANGS.forEach((opt) => {
      row.append(button(opt.label, {
        variant: 'ruled', on: opt.code === lang, ariaPressed: opt.code === lang,
        onClick: () => { lang = opt.code; paint(); },
      }));
    });
    langBox.append(h('div', { style: { padding: '13px' } }, row,
      h('div.field-help', null, t.get('onboard.langHelp'))));
    root.append(langBox);

    // --- begin -------------------------------------------------------------
    root.append(h('div.mt2'), blockButton(t.get('onboard.begin'), t.get('onboard.nameHelp'), () => {
      if (!name.trim()) { warn = true; paint(); return; }
      onDone(name.trim(), lang);
    }));
    root.append(h('div', { style: { height: '30px' } }));
  }

  paint();
}
