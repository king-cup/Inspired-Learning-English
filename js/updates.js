// Vocabulary update-check orchestration (v1.03 §4). Shared by main.js
// (startup / foreground) and Settings (manual button) so the "download, decide
// whether it is safe to apply now, and give unobtrusive feedback" logic lives
// in exactly one place.

import * as D from './data.js';
import * as i18n from './i18n.js';
import { toast, showUpdateBar } from './ui.js';

/** A Cards/Practice/Test run is on screen: never swap the list under it. */
export const sessionActive = () =>
  /#\/u\/[^/]+\/(cards|practice|test)\b/.test(location.hash);

/**
 * Persistent bar for a vocabulary version that is downloaded and waiting. The
 * action reloads: on the next start, load() promotes the pending version before
 * anything renders. Ignoring the bar is equally safe -- it applies by itself on
 * the next navigation out of the session.
 */
export function showVocabUpdateBar() {
  showUpdateBar({
    kind: 'vocab',
    message: i18n.t('update.vocabReady'),
    actionLabel: i18n.t('update.reload'),
    onAction: () => location.reload(),
  });
}

/**
 * Check for a new published version.
 *   manual  = true when the student pressed the Settings button (always give
 *             feedback); false for background checks (stay quiet unless
 *             something actually happened).
 *   onApplied = called after the in-memory vocabulary was swapped, so the caller
 *             can re-render the current screen.
 */
export async function runUpdateCheck({ manual = false, onApplied } = {}) {
  const apply = !sessionActive();          // don't apply mid-session (§4)
  if (manual) toast(i18n.t('update.checking'));

  const r = await D.checkForUpdate({ apply });

  if (!r.ok) { if (manual) toast(i18n.t('update.failed')); return r; }
  if (r.upToDate) { if (manual) toast(i18n.t('update.upToDate')); return r; }
  if (r.updated) {
    if (r.appliedNow) {
      toast(i18n.t('update.updated'));
      if (onApplied) { try { onApplied(); } catch (e) {} }
    } else {
      // Downloaded mid-session: a transient toast is easy to miss, so also raise
      // the persistent bar. It applies on its own at the next safe navigation.
      toast(i18n.t('update.downloaded'));
      showVocabUpdateBar();
    }
    return r;
  }
  // ok, not up-to-date, but nothing installed -> the download failed.
  if (manual) toast(i18n.t('update.failed'));
  return r;
}
