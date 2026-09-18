import { APP_VERSION } from './data.js';
import * as P from './profile.js';
import { h, clear, button, paperHeader } from './ui.js';

const KEY = 'ie.releasePolicy.v1';
const INTERVAL = 5 * 60 * 1000;
export const platform = location.hostname === 'app.local' || navigator.userAgent.includes('InspiredEnglishAndroid') ? 'android' : 'pwa';
// Android's virtual asset origin cannot host remotely editable policy.
const ENDPOINT = platform === 'android' ? 'https://inspiredvocab.netlify.app/release-policy.json' : new URL('release-policy.json', location.href).href;
const version = value => typeof value === 'string' && /^\d{1,4}\.\d{1,4}(?:\.\d{1,4})?$/.test(value);
export function compare(a, b) {
  const aa = a.split('.').map(Number), bb = b.split('.').map(Number);
  for (let i=0;i<3;i++) { const d=(aa[i]||0)-(bb[i]||0); if(d) return Math.sign(d); }
  return 0;
}
function validRule(rule) {
  if (!rule || !version(rule.minimumVersion) || !Array.isArray(rule.blockedVersions) || !rule.blockedVersions.every(version)) return false;
  try { const url = new URL(rule.updateUrl); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export const disallows = (rule, current = APP_VERSION) => validRule(rule) && (compare(current, rule.minimumVersion) < 0 || rule.blockedVersions.some(v => compare(v,current) === 0));
let retired = null;
try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); if (validRule(saved[platform])) retired = saved[platform]; } catch (_) {}
export const locked = () => disallows(retired);
let checking = null, notify = () => {};

export function check() {
  if (checking) return checking;
  checking = (async () => {
    const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 3000);
    try {
      const response = await fetch(ENDPOINT, {cache:'no-store', credentials:'omit', redirect:'error', signal:abort.signal});
      if (!response.ok) return;
      const text = await response.text(); if (text.length > 20000) return;
      const policy = JSON.parse(text);
      if (policy.schemaVersion !== 1 || policy.enabled !== true) return;
      const rule = policy.platforms?.[platform];
      if (!validRule(rule)) return;
      // A remote off switch or lower minimum never re-enables a retired build.
      // A newer build is allowed once it satisfies the latched minimum/list.
      if (disallows(rule) || locked()) {
        retired = {
          minimumVersion: retired && compare(retired.minimumVersion,rule.minimumVersion)>0 ? retired.minimumVersion : rule.minimumVersion,
          blockedVersions: [...new Set([...(retired?.blockedVersions || []),...rule.blockedVersions])],
          updateUrl: rule.updateUrl,
        };
        try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); localStorage.setItem(KEY,JSON.stringify({...saved,[platform]:retired})); } catch (_) {}
      }
    } catch (_) { /* First-time offline use remains available; a latched lock does not. */ }
    finally { clearTimeout(timer); if (locked()) notify(); }
  })().finally(() => { checking = null; });
  return checking;
}

export function start(onLock) {
  notify = onLock;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', check);
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, INTERVAL);
  // Also stop a media fetch that finishes after the lock has appeared.
  document.addEventListener('play', event => { if (locked() && typeof event.target.pause === 'function') event.target.pause(); }, true);
  return check();
}

export function render(root) {
  clear(root);
  const zh = P.get().lang === 'zh';
  const status = h('p.note', {role:'status'});
  const update = button(zh ? '获取最新版本' : 'Get the latest version', {variant:'ruled',wide:true,onClick:async () => {
    if (platform === 'android') { location.href = retired.updateUrl; return; }
    update.disabled = true; status.textContent = zh ? '正在检查更新…' : 'Checking for the update…';
    try {
      const registration = await navigator.serviceWorker.register('sw.js');
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {once:true});
      await registration.update();
      const worker = registration.waiting || registration.installing;
      if (worker) {
        const activate = () => { if (worker.state === 'installed') worker.postMessage({type:'SKIP_WAITING'}); };
        worker.addEventListener('statechange',activate); activate();
      } else { status.textContent = zh ? '新版本暂未就绪，请稍后重试或联系老师。' : 'The new version is not ready yet. Try again later or contact your teacher.'; }
    } catch (_) { status.textContent = zh ? '无法下载更新，请检查网络或联系老师。' : 'Could not download the update. Check your connection or contact your teacher.'; }
    finally { update.disabled = false; }
  }});
  root.append(h('section.update-required', null,
    paperHeader({title:zh?'请更新应用':'Update required',left:'Inspired English · '+APP_VERSION}),
    h('p', null, zh ? '此版本已停止使用。请安装最新版本后继续学习。已有学习记录未被删除。' : 'This version is no longer available. Update to the latest version to continue learning. Your saved progress has not been deleted.'),
    update,status,
    h('p',null,zh?'如需帮助，请联系老师。请勿卸载应用或清除存储，以免丢失本机学习记录。':'Contact your teacher if you need help. Do not uninstall or clear app storage: that can erase your local progress.')));
}
