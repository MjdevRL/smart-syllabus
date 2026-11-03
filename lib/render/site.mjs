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
export function prepare(rows, base = '/', opts = {}) {
  const of = (k) => rows.filter((r) => r.kind === k).map((r) => ({ ...r.data, id: r.id, _updated: r.updated_at }));
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
  // "last updated" for the home page = the newest change to the home text or to any published page
  const stamps = rows.filter((r) => r.updated_at && (r.kind === 'setting' && r.id === 'home' || r.kind === 'page' && resolved.byId.get(r.id)?.public)).map((r) => r.updated_at);
  const latest = stamps.sort().pop();
  if (opts.db) extras.push({ title: 'Feedback', path: '/feedback/' });
  return { base, db: opts.db || null, latest, site, home, history, pages, resolved, ctx, tree: siteTree(resolved), extras, universities, showUnis };
}

const longDate = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); };
const updatedLine = (t) => longDate(t) ? `<p class="meta" style="margin:28px 0 0;font-size:13px;color:var(--muted)">Last updated: <time datetime="${esc(String(t).slice(0, 10))}">${longDate(t)}</time></p>` : '';

// put the date inside the page sheet (just before its closing tag) so it lines up with the content
const withUpdated = (main, t) => { const line = updatedLine(t), i = main.lastIndexOf('</article>'); return !line ? main : i < 0 ? main + line : main.slice(0, i) + line + main.slice(i); };

/** Anonymous visit counter (public site only). One tiny request per page view; skipped when the browser asks not to be tracked. */
const trackScript = (db) => `<script>(function(){try{if(navigator.doNotTrack==='1'||navigator.webdriver)return;var k='ss_vid',v=localStorage.getItem(k);if(!v){v=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Math.random()).slice(2)+Date.now();localStorage.setItem(k,v)}fetch(${JSON.stringify(db.url + '/rest/v1/rpc/track_visit')},{method:'POST',keepalive:true,headers:{apikey:${JSON.stringify(db.key)},'content-type':'application/json'},body:JSON.stringify({p_visitor:v,p_path:location.pathname})})}catch(e){}})()<\/script>`;

const frame = (m, path, { title, description, main, noindex, updated, track }) => {
  const html = renderLayout({
  title, description, base: m.base, siteName: m.site.site_name, noindex,
  menuHtml: m.site.feedback_url ? `<a href="${esc(webUrl(m.site.feedback_url))}" target="_blank" rel="noopener">${esc(m.site.feedback_label || 'Feedback')} ↗</a>` : '',
  sidebar: renderSidebar(m.tree, path, m.base, m.extras), main: withUpdated(main, updated), footer: esc(m.site.footer_text || ''),
  });
  return track && m.db ? html.replace('</body>', trackScript(m.db) + '</body>') : html;
};

const pageHtml = (m, n) => {
  const crumbs = [...ancestors(n).map((a) => ({ title: a.title, url: withBase(m.base, a.path) })), { title: n.title, url: withBase(m.base, n.path), current: true }];
  const subpages = n.children.filter((c) => c.public && c.showIn !== 'links').map((c) => ({ title: c.title, url: withBase(m.base, c.path), description: c.data.description }));
  const sheet = renderPageSheet({ ...n.data, show_subpages: n.data.show_subpages !== false }, m.ctx, { crumbs, subpages, where: `Page "${n.title}"` });
  return frame(m, n.path, { title: `${n.title} · ${m.site.site_name}`, description: n.data.description || m.site.description, main: sheet, updated: n.data._updated, track: !!m.db });
};

const homeHtml = (m, home = m.home) => {
  const featured = [...m.resolved.byId.values()].filter((n) => n.public && n.data.featured);
  const cards = featured.map((n) => `<div class="note"><a class="cover" href="${esc(withBase(m.base, n.path))}"><h3>${esc(n.title)}</h3>${n.data.description ? `<p>${esc(n.data.description)}</p>` : ''}<p><b>Open →</b></p></a></div>`).join('');
  const extra = renderBlocks(home.blocks, m.ctx, 'Home page');
  const sheet = `<article class="sheet">${home.eyebrow ? `<div class="eyebrow">${esc(home.eyebrow)}</div>` : ''}<h1>${esc(home.heading || m.site.site_name)}</h1><div class="prose">${md(home.intro)}</div>
${featured.length ? `<h2 class="section">${esc(home.featured_heading || 'Featured guides')}</h2><div class="grid">${cards}</div>` : ''}
<div style="margin-top:28px">${extra.html}</div></article>`;
  return frame(m, '/', { title: m.site.site_name, description: m.site.description, main: sheet, updated: m.latest, track: !!m.db });
};

const notFoundHtml = (m) => frame(m, '', {
  title: `Page not found · ${m.site.site_name}`, noindex: true,
  main: `<article class="sheet"><div class="eyebrow">404</div><h1 class="page-title">This page isn't here.</h1><p>It may have been moved or taken down, or the address may have a typo.</p><div class="actions"><a class="btn primary" href="${withBase(m.base, '')}">Go to the home page</a></div></article>`,
});

const universitiesHtml = (m) => frame(m, '/universities/', {
  title: `Universities · ${m.site.site_name}`, track: !!m.db,
  main: `<article class="sheet flat wide"><nav aria-label="Breadcrumb" class="eyebrow"><a href="${esc(withBase(m.base, ''))}">Home</a> → Universities</nav><h1 class="page-title">Universities</h1><p class="lede">${m.universities.length} courses from my research spreadsheet, in my personal ranking order.</p><div class="label-row"><span class="tag verify">Research entries · not yet verified</span><span class="tag">Personal ranking = opinion</span></div><div style="margin-top:22px">${renderUniversityList(m.universities, m.base)}</div></article>`,
});

const feedbackHtml = (m) => frame(m, '/feedback/', {
  title: `Feedback · ${m.site.site_name}`, track: true,
  main: `<article class="sheet"><div class="eyebrow">Feedback</div><h1 class="page-title">Tell me what you think</h1>
<p>Found a mistake, something out of date, or something missing? Write it here. Please don't include personal details: messages are not private.</p>
<form id="fb" style="margin-top:18px"><textarea name="message" required maxlength="2000" rows="6" aria-label="Your feedback" style="display:block;width:100%;padding:12px;background:var(--paper);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;font:400 15px/1.5 var(--ui)"></textarea>
<div class="actions" style="margin-top:14px"><button class="btn primary" type="submit">Send feedback</button></div><p id="fb-note" role="status" style="margin-top:12px"></p></form></article>
<script>document.getElementById('fb').addEventListener('submit',function(e){e.preventDefault();var f=e.target,n=document.getElementById('fb-note'),b=f.querySelector('button');var m=f.message.value.trim();if(!m)return;b.disabled=true;var from='';try{var u=new URL(document.referrer);if(u.origin===location.origin)from=u.pathname}catch(x){}
fetch(${JSON.stringify(m.db.url + '/rest/v1/feedback')},{method:'POST',headers:{apikey:${JSON.stringify(m.db.key)},'content-type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({message:m,page:from})}).then(function(r){if(!r.ok)throw 0;f.reset();n.textContent='Thank you! Your feedback was sent.'}).catch(function(){n.textContent='Sorry, that did not send. Please try again.'}).then(function(){b.disabled=false})});<\/script>`,
});

/** One request in, one answer out: { status, html } or { status: 308, location }. */
export function renderRoute(m, rawPath) {
  const p = normalizePath(rawPath) || '/';
  if (p === '/') return { status: 200, html: homeHtml(m) };
  for (const n of m.resolved.byId.values()) if (n.public && n.path === p) return { status: 200, html: pageHtml(m, n) };
  if (m.showUnis) {
    if (p === '/universities/') return { status: 200, html: universitiesHtml(m) };
    const u = m.universities.find((x) => uniPath(x) === p);
    if (u) return { status: 200, html: frame(m, p, { title: `${u.university} – ${u.course} · ${m.site.site_name}`, main: renderUniversity(u, m.ctx), updated: u._updated, track: !!m.db }) };
  }
  if (m.db && p === '/feedback/') return { status: 200, html: feedbackHtml(m) };
  const r = m.resolved.redirects.find((x) => x.from === p);
  if (r) return { status: 308, location: /^https?:/i.test(r.to) ? r.to : withBase(m.base, r.to) };
  return { status: 404, html: notFoundHtml(m) };
}

/** Editor preview: draw one unsaved page (always as if published) or the home page. Returns a full HTML document. */
export function renderPreview(rows, base, kind, entry) {
  if (kind === 'home') return homeHtml(prepare(rows, base), { ...entry, _updated: new Date().toISOString() });
  const id = entry.id || '__new__';
  const others = rows.filter((r) => !(r.kind === 'page' && r.id === id));
  const m = prepare([...others, { kind: 'page', id, data: { ...entry, status: 'published' }, updated_at: new Date().toISOString() }], base);
  const n = m.resolved.byId.get(id);
  return n && n.public ? pageHtml(m, n) : notFoundHtml(m);
}
