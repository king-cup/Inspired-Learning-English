import * as P from '../profile.js';
import { h, clear, topBar, paperHeader, button } from '../ui.js';

const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
export function render(root) {
  clear(root);
  root.append(topBar(tr('← Back', '← 返回'), tr('High School English', '高中英语'), () => { location.hash = '#/'; }));
  root.append(h('div.mt'), paperHeader({ kicker: tr('in preparation', '正在准备'), title: tr('High School English', '高中英语'), left: tr('Content coming soon', '内容即将推出'), right: 'v1.09' }));
  root.append(h('div.note.mt2', null, h('h2', null, tr('This section is being prepared', '本部分正在准备中')), h('p', null, tr('Real high-school content will be added here in a future release.', '真实的高中英语内容将在后续版本中加入。'))));
  root.append(h('p.note', null, tr('Upcoming sections will use Study (browse and word meanings) and Test (balanced random exercises, no lookup). HSE worksheet practice is currently under Vocabulary.', '未来题型统一提供学习（自由浏览和查词）与测试（均衡随机抽题，不可查词）。现有 HSE 练习位于词汇区。')),
    button(tr('Open Vocabulary', '打开词汇区'), { variant: 'ruled', wide: true, onClick: () => { location.hash = '#/vocab'; } }));
}
