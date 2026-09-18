import * as D from '../data.js';
import * as P from '../profile.js';
import * as i18n from '../i18n.js';
import { h, clear, paperHeader, button, blockButton, leafMark } from '../ui.js';

export function render(root) {
  clear(root);
  const name = P.displayName();

  root.append(h('div.home-tools', null,
    button(i18n.t('lib.settings'), {
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
    blockButton(i18n.t('home.middle'), '', () => { location.hash = '#/middle'; }),
    blockButton(i18n.t('home.high'), '', () => { location.hash = '#/high-school'; }),
    blockButton(i18n.t('home.reading'), '', () => { location.hash = '#/reading'; }),
    blockButton(i18n.t('home.memory'), '', () => { location.hash = '#/memory'; }),
  );
  root.append(choices, h('div', { style: { height: '34px' } }));
}
