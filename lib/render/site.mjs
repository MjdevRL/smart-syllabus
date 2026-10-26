// Turns database rows into pages. Used by the live website (main-site) and by the editor's preview (admin-site),
// so what you preview is exactly what visitors get. Pure functions: no Node-only or browser-only APIs.

import { resolveSite, siteTree, ancestors, normalizePath } from './hierarchy.mjs';
import { renderPageSheet } from './page.mjs';
import { renderSidebar, renderLayout } from './layout.mjs';
import { renderBlocks } from './blocks.mjs';
import { renderUniversity, renderUniversityList, uniPath } from './universities.mjs';
import { esc, withBase, mediaUrl, webUrl } from './util.mjs';
import { md } from './markdown.mjs';

/** rows -> everything needed to draw the site. `base` is the folder the site lives in ("/" on its own domain). */
export function prepare(rows, base = '/') {
  const of = (k) => rows.filter((r) => r.kind === k).map((r) => ({ ...r.data, id: r.id }));
  const setting = (id, fallback) => rows.find((r) => r.kind === 'setting' && r.id === id)?.data ?? fallback;
  const pages = of('page');
  const site = { site_name: 'Smart Syllabus', show_universities: true, universities_label: 'Universities', feedback_label: 'Feedback', ...setting('site', {}) };
  const home = setting('home', { heading: site.site_name });
  const history = setting('url-history', {});
  const resolved = resolveSite(pages, { history, extraRedirects: setting('redirects', { items: [] }).items || [] });
  const notices = new Map(of('notice').map((n) => [n.id, n]));
  const universities = of('university').filter((u) => u.status !== 'draft')
    .sort((a, b) => (a.personal_rank_number ?? 999) - (b.personal_rank_number ?? 999) || a.university.localeCompare(b.university));
  const pageLink = (id) => { const n = resolved.byId.get(id); return n && n.public ? { url: withBase(base, n.path), title: n.title } : null; };
  const ctx = { base, notices, pageLink, fileInfo: () => null, asset: (v) => mediaUrl(base, v), warn() {}, onNoticeUsed() {} };
  const extras = [{ title: 'Home', path: '/' }];
  const showUnis = site.show_universities !== false && universities.length > 0;
  if (showUnis) extras.push({ title: site.universities_label || 'Universities', path: '/universities/' });
  return { base, site, home, history, pages, resolved, ctx, tree: siteTree(resolved), extras, universities, showUnis };
}

const frame = (m, path, { title, description, main, noindex }) => renderLayout({
  title, description, base: m.base, siteName: m.site.site_name, noindex,
  menuHtml: m.site.feedback_url ? `<a href="${esc(webUrl(m.site.feedback_url))}" target="_blank" rel="noopener">${esc(m.site.feedback_label || 'Feedback')} ↗</a>` : '',
  sidebar: renderSidebar(m.tree, path, m.base, m.extras), main, footer: esc(m.site.footer_text || ''),
});

const pageHtml = (m, n) => {
  const crumbs = [...ancestors(n).map((a) => ({ title: a.title, url: withBase(m.base, a.path) })), { title: n.title, url: withBase(m.base, n.path), current: true }];
  const subpages = n.children.filter((c) => c.public && c.showIn !== 'links').map((c) => ({ title: c.title, url: withBase(m.base, c.path), description: c.data.description }));
  const sheet = renderPageSheet({ ...n.data, show_subpages: n.data.show_subpages !== false }, m.ctx, { crumbs, subpages, where: `Page "${n.title}"` });
  return frame(m, n.path, { title: `${n.title} · ${m.site.site_name}`, description: n.data.description || m.site.description, main: sheet });
};

const homeHtml = (m, home = m.home) => {
  const featured = [...m.resolved.byId.values()].filter((n) => n.public && n.data.featured);
  const cards = featured.map((n) => `<div class="note"><a class="cover" href="${esc(withBase(m.base, n.path))}"><h3>${esc(n.title)}</h3>${n.data.description ? `<p>${esc(n.data.description)}</p>` : ''}<p><b>Open →</b></p></a></div>`).join('');
  const extra = renderBlocks(home.blocks, m.ctx, 'Home page');
  const sheet = `<article class="sheet">${home.eyebrow ? `<div class="eyebrow">${esc(home.eyebrow)}</div>` : ''}<h1>${esc(home.heading || m.site.site_name)}</h1><div class="prose">${md(home.intro)}</div>
${featured.length ? `<h2 class="section">${esc(home.featured_heading || 'Featured guides')}</h2><div class="grid">${cards}</div>` : ''}
<div style="margin-top:28px">${extra.html}</div></article>`;
  return frame(m, '/', { title: m.site.site_name, description: m.site.description, main: sheet });
};

const notFoundHtml = (m) => frame(m, '', {
  title: `Page not found · ${m.site.site_name}`, noindex: true,
  main: `<article class="sheet"><div class="eyebrow">404</div><h1 class="page-title">This page isn't here.</h1><p>It may have been moved or taken down, or the address may have a typo.</p><div class="actions"><a class="btn primary" href="${withBase(m.base, '')}">Go to the home page</a></div></article>`,
});

const universitiesHtml = (m) => frame(m, '/universities/', {
  title: `Universities · ${m.site.site_name}`,
  main: `<article class="sheet flat wide"><nav aria-label="Breadcrumb" class="eyebrow"><a href="${esc(withBase(m.base, ''))}">Home</a> → Universities</nav><h1 class="page-title">Universities</h1><p class="lede">${m.universities.length} courses from my research spreadsheet, in my personal ranking order.</p><div class="label-row"><span class="tag verify">Research entries · not yet verified</span><span class="tag">Personal ranking = opinion</span></div><div style="margin-top:22px">${renderUniversityList(m.universities, m.base)}</div></article>`,
});

/** One request in, one answer out: { status, html } or { status: 308, location }. */
export function renderRoute(m, rawPath) {
  const p = normalizePath(rawPath) || '/';
  if (p === '/') return { status: 200, html: homeHtml(m) };
  for (const n of m.resolved.byId.values()) if (n.public && n.path === p) return { status: 200, html: pageHtml(m, n) };
  if (m.showUnis) {
    if (p === '/universities/') return { status: 200, html: universitiesHtml(m) };
    const u = m.universities.find((x) => uniPath(x) === p);
    if (u) return { status: 200, html: frame(m, p, { title: `${u.university} – ${u.course} · ${m.site.site_name}`, main: renderUniversity(u, m.ctx) }) };
  }
  const r = m.resolved.redirects.find((x) => x.from === p);
  if (r) return { status: 308, location: /^https?:/i.test(r.to) ? r.to : withBase(m.base, r.to) };
  return { status: 404, html: notFoundHtml(m) };
}

/** Editor preview: draw one unsaved page (always as if published) or the home page. Returns a full HTML document. */
export function renderPreview(rows, base, kind, entry) {
  if (kind === 'home') return homeHtml(prepare(rows, base), entry);
  const id = entry.id || '__new__';
  const others = rows.filter((r) => !(r.kind === 'page' && r.id === id));
  const m = prepare([...others, { kind: 'page', id, data: { ...entry, status: 'published' } }], base);
  const n = m.resolved.byId.get(id);
  return n && n.public ? pageHtml(m, n) : notFoundHtml(m);
}
