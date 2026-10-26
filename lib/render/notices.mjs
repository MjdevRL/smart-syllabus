import { md } from './markdown.mjs';
import { esc, formatDate, webUrl } from './util.mjs';

export const NOTICE_STYLES = {
  subtle: { label: 'Note', icon: '✎' },
  warning: { label: 'Please check', icon: '⚠' },
  info: { label: 'Good to know', icon: 'ℹ' },
  source: { label: 'Source check', icon: '✓' },
};

/** Resolve a notice attachment (saved or one-off) into the text to show, or null. */
export function resolveNotice(att, ctx, where = '') {
  if (!att) return null;
  if (att.type === 'saved') {
    const n = ctx.notices?.get(att.notice);
    if (!n) { ctx.warn?.(`${where}: a saved notice it uses no longer exists, so it was left out. Remove it or pick another notice.`); return null; }
    ctx.onNoticeUsed?.(att.notice, where);
    if (n.status === 'retired') return null;
    return { ...n, placement: att.placement };
  }
  if (!att.title && !att.body) return null;
  return att;
}

export function renderNotice(n) {
  if (!n) return '';
  const style = NOTICE_STYLES[n.style] ? n.style : 'info';
  const s = NOTICE_STYLES[style];
  const label = esc((n.label || '').trim() || s.label);
  const body = md(n.body);
  const meta = [];
  if (n.source_url) meta.push(`<span>Source: <a href="${esc(webUrl(n.source_url))}" target="_blank" rel="noopener">${esc(n.source_label || n.source_url)}</a></span>`);
  else if (n.source_label) meta.push(`<span>Source: ${esc(n.source_label)}</span>`);
  if (n.last_verified) meta.push(`<span>Last verified: ${formatDate(n.last_verified)}</span>`);
  if (n.updated) meta.push(`<span>Notice updated: ${formatDate(n.updated)}</span>`);
  const head = style === 'source'
    ? `<span class="stamp">${s.icon} ${label}</span>`
    : `<span class="n-label" aria-hidden="true">${s.icon} ${label}</span>`;
  return `<aside class="notice ${style}" role="note" aria-label="${label}">${style === 'warning' ? '<div class="tape"></div>' : ''}${head}${n.title ? `<div class="n-title">${esc(n.title)}</div>` : ''}<div class="prose">${body}</div>${meta.length ? `<div class="n-meta">${meta.join('')}</div>` : ''}</aside>`;
}

/** Split a list of attachments by where they should appear. */
export function groupNotices(list, ctx, where, defaultPlacement = 'after') {
  const out = { before: [], after: [], section_end: [], page_end: [], page_top: [] };
  for (const att of list || []) {
    const n = resolveNotice(att, ctx, where);
    if (!n) continue;
    const p = out[att.placement] ? att.placement : defaultPlacement;
    out[p].push(renderNotice(n));
  }
  return out;
}

export const stack = (arr) => (arr.length ? `<div class="notice-stack">${arr.join('')}</div>` : '');
