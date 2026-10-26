import { esc, withBase } from './util.mjs';
import { renderBlocks } from './blocks.mjs';
import { groupNotices, stack } from './notices.mjs';

/** The sheet for one page: breadcrumbs, title, blocks, notices and subpage cards. */
export function renderPageSheet(page, ctx, { crumbs = [], subpages = [], where } = {}) {
  const w = where || `Page "${page.title || 'untitled'}"`;
  const top = groupNotices(page.page_notices, ctx, w, 'page_end');
  const { html, pageEnd } = renderBlocks(page.blocks, ctx, w);
  const crumbHtml = `<nav aria-label="Breadcrumb" class="eyebrow"><ol class="crumbs" style="list-style:none;padding:0">${[{ title: 'Home', url: withBase(ctx.base, '') }, ...crumbs]
    .map((c, i, a) => `<li>${i ? '<span aria-hidden="true">→ </span>' : ''}${i === a.length - 1 && c.current ? `<span aria-current="page">${esc(c.title)}</span>` : `<a href="${esc(c.url)}">${esc(c.title)}</a>`}</li>`).join('')}</ol></nav>`;
  const subs = page.show_subpages === true && subpages.length
    ? `<h2 class="section">In this section</h2><div class="grid">${subpages.map((s, i) => `<div class="note"><a class="cover" href="${esc(s.url)}"><h3>${esc(s.title)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ''}<p><b>Open →</b></p></a></div>`).join('')}</div>`
    : '';
  return `<article class="sheet${page.flat ? ' flat' : ''}"><div class="tape"></div>${crumbHtml}<h1 class="page-title">${esc(page.title || 'Untitled page')}</h1>${page.needs_verification ? '<p><span class="stamp">needs verification</span></p>' : ''}${page.subtitle ? `<p class="lede">${esc(page.subtitle)}</p>` : ''}${stack(top.page_top)}${html}${subs}${stack([...pageEnd, ...top.page_end, ...top.after, ...top.before, ...top.section_end])}</article>`;
}
