import * as D from '../data.js';
import * as P from '../profile.js';
import * as i18n from '../i18n.js';
import { h, clear, paperHeader, button, blockButton, leafMark } from '../ui.js';

// The product hub deliberately stays small: it is a doorway, not a dashboard.
// Vocabulary keeps its existing library behind #/vocab; the two future modes
// remain visible so students understand where the app is heading.
export function render(root) {
  clear(root);
  const name = P.displayName();

  root.append(h('div.home-tools', null,
    button('⚙  ' + i18n.t('lib.settings'), {
      variant: 'thin', size: 'sm', ariaLabel: i18n.t('a11y.settings'),
      onClick: () => { location.hash = '#/settings'; },
    })));

  const head = paperHeader({
    kicker: i18n.t('app.kicker'),
    title: i18n.t('app.title'),
    left: name ? i18n.f('lib.hello', name) : '',
    right: 'v' + D.APP_VERSION,
  });
  head.classList.add('home-header');
  head.append(leafMark(48));
  root.append(h('div.mt'), head);

  const choices = h('div.home-choices.mt2');
  choices.append(
    blockButton(i18n.t('home.vocabulary'), '', () => { location.hash = '#/vocab'; }),
    blockButton(i18n.t('home.cloze'), '', () => { location.hash = '#/cloze'; }),
    comingSoon(i18n.t('home.reading')),
    comingSoon(i18n.t('home.grammar')),
  );
  root.append(choices, h('div', { style: { height: '34px' } }));
}

function comingSoon(title) {
  const el = blockButton(title, '', () => {});
  el.disabled = true;
  el.classList.add('coming-soon');
  el.append(h('span.soon-tag', null, i18n.t('home.comingSoon')));
  return el;
}
