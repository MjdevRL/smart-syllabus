// Renders the content blocks you add in the dashboard. Shared by the build and the preview.
import { md } from './markdown.mjs';
import { esc, withBase, webUrl, isExternal, fileKind, formatBytes, youtubeEmbed, formatDate, uploadRelPath } from './util.mjs';
import { groupNotices, stack } from './notices.mjs';

const COLOURS = ['yellow', 'pink', 'blue', 'green', 'purple'];
const colour = (c, i = 0) => (COLOURS.includes(c) ? c : COLOURS[i % COLOURS.length]);

/** Work out where a "page on this site or web address" pair should link to. */
export function resolveLink(item, ctx, where) {
  if (item.page) {
    const p = ctx.pageLink(item.page);
    if (p) return { href: p.url, external: false, pageTitle: p.title };
    ctx.warn?.(`${where}: links to a page that isn't published (or was deleted), so the link was turned off.`);
    return null;
  }
  let url = webUrl(item.url);
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(ctx.base)) url = withBase(ctx.base, url);
  return { href: url, external: isExternal(url) };
}

const linkAttrs = (l, newTab) => `href="${esc(l.href)}"${(newTab ?? l.external) ? ' target="_blank" rel="noopener"' : ''}`;

function heading(text, level = 3) {
  return text ? `<h${level}>${esc(text)}</h${level}>` : '';
}

const R = {
  section: (b) => `<h2 class="section">${esc(b.heading || '')}</h2>${b.intro ? `<div class="prose">${md(b.intro)}</div>` : ''}`,

  text: (b) => `${heading(b.heading)}<div class="prose">${md(b.body)}</div>`,

  callout: (b, ctx, i) => `<div class="note ${colour(b.colour, i)}">${heading(b.title, 3)}<div class="prose">${md(b.body)}</div></div>`,

  cards: (b, ctx, i, where) => {
    const items = (b.items || []).map((c, j) => {
      const l = resolveLink(c, ctx, where);
      const inner = `${c.title ? `<h3>${esc(c.title)}</h3>` : ''}${c.text ? `<p>${esc(c.text)}</p>` : ''}${l ? '<p><b>Open →</b></p>' : ''}`;
      return `<div class="note ${colour(c.colour, j)}">${l ? `<a class="cover" ${linkAttrs(l)}>${inner}</a>` : inner}</div>`;
    });
    return `${heading(b.heading)}${items.length ? `<div class="grid">${items.join('')}</div>` : ''}`;
  },

  links: (b, ctx, i, where) => {
    const rows = (b.items || []).map((it, j) => {
      const w = `${where}, link "${it.title || j + 1}"`;
      const l = resolveLink(it, ctx, w);
      const g = groupNotices(it.notices, ctx, w);
      const title = esc(it.title || l?.pageTitle || it.url || 'Link');
      const tags = [
        it.official ? '<span class="tag official">✓ Official source</span>' : '',
        it.last_verified ? `<span class="tag">Checked ${formatDate(it.last_verified)}</span>` : '',
        ...(it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`),
      ].join('');
      return `<div class="link-row">${stack(g.before)}${l ? `<a class="title" ${linkAttrs(l, it.new_tab === 'same' ? false : it.new_tab === 'new' ? true : undefined)}>${title}${l.external ? ' ↗' : ''}</a>` : `<span class="title"><b>${title}</b> <span class="meta">(link unavailable)</span></span>`}${it.description ? `<p>${esc(it.description)}</p>` : ''}${tags ? `<div class="tags">${tags}</div>` : ''}${g.after.length ? `<div style="margin-top:10px">${stack(g.after)}</div>` : ''}</div>`;
    });
    return `<div class="card"><div class="card-head"><h3>${esc(b.heading || 'Links')}</h3><span class="status">${rows.length} link${rows.length === 1 ? '' : 's'}</span></div>${rows.join('') || '<div class="link-row meta">No links added yet.</div>'}</div>`;
  },

  file: (b, ctx, i, where) => {
    const src = b.source === 'link' ? webUrl(b.url) : ctx.asset(b.file);
    if (!src) { ctx.warn?.(`${where}: the document "${b.title || 'untitled'}" has no file or link yet.`); }
    const k = fileKind(b.source === 'link' ? b.url : b.file);
    const info = b.source === 'link' ? null : ctx.fileInfo?.(uploadRelPath(b.file));
    const viewable = ['pdf', 'image', 'text'].includes(k.kind);
    const rows = [
      ['Type', k.label + (k.ext ? ` (.${k.ext})` : '')],
      info?.size != null ? ['Size', formatBytes(info.size)] : null,
      ['How it opens', b.source === 'link' ? 'Opens on another website' : k.howToOpen],
      b.category ? ['Category', esc(b.category)] : null,
      b.last_reviewed ? ['Last reviewed', formatDate(b.last_reviewed)] : null,
    ].filter(Boolean);
    return `<div class="card"><div class="card-head" style="background:var(--blue)"><h3>${esc(b.title || 'Document')}</h3><span class="status">${esc(k.ext ? k.ext.toUpperCase() : 'file')}</span></div>${b.description ? `<div class="card-body"><p>${esc(b.description)}</p>${b.who_for ? `<p class="dim">${esc(b.who_for)}</p>` : ''}</div>` : b.who_for ? `<div class="card-body"><p class="dim">${esc(b.who_for)}</p></div>` : ''}${rows.map(([a, v]) => `<div class="kv"><span>${a}</span><b>${v}</b></div>`).join('')}${(b.tags || []).length ? `<div class="card-body tags">${b.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}${src ? `<div class="file-actions">${b.source === 'link' ? `<a class="btn primary" href="${esc(src)}" target="_blank" rel="noopener">Open link ↗</a>` : `${viewable ? `<a class="btn primary" href="${esc(src)}" target="_blank" rel="noopener">Open</a>` : ''}<a class="btn${viewable ? '' : ' primary'}" href="${esc(src)}" download>Download</a>`}</div>` : '<div class="file-actions"><span class="dim">File not added yet.</span></div>'}</div>`;
  },

  media: (b, ctx, i, where) => {
    let player = '';
    if (b.source === 'youtube') {
      const e = youtubeEmbed(b.url);
      player = e ? `<div class="embed"><iframe src="${esc(e)}" title="${esc(b.title || 'Video')}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : '';
      if (!e) ctx.warn?.(`${where}: "${b.title || 'video'}" doesn't have a valid YouTube link.`);
    } else {
      const src = b.source === 'link' ? webUrl(b.url) : ctx.asset(b.file);
      const k = fileKind(b.source === 'link' ? b.url : b.file);
      if (src && k.kind === 'audio') player = `<audio controls preload="metadata" src="${esc(src)}"></audio>`;
      else if (src && k.kind === 'video') player = `<video controls preload="metadata" playsinline src="${esc(src)}">${b.captions ? `<track kind="captions" src="${esc(ctx.asset(b.captions))}" srclang="${esc(b.captions_lang || 'en')}" label="Captions" default>` : ''}</video>`;
      else if (src) player = `<p>This format can't be played in every browser. <a href="${esc(src)}" ${b.source === 'link' ? 'target="_blank" rel="noopener"' : 'download'}>${b.source === 'link' ? 'Open the media link ↗' : 'Download the file'}</a></p>`;
      else ctx.warn?.(`${where}: "${b.title || 'media'}" has no file or link yet.`);
      if (src && (k.kind === 'audio' || k.kind === 'video')) player += `<p class="dim" style="font-size:13px">Not playing? <a href="${esc(src)}" ${b.source === 'link' ? 'target="_blank" rel="noopener"' : 'download'}>${b.source === 'link' ? 'Open it directly' : 'Download it'}</a>.</p>`;
    }
    return `<div class="card media"><div class="card-head" style="background:var(--purple)"><h3>${esc(b.title || 'Media')}</h3><span class="status">${b.source === 'youtube' ? 'YouTube' : esc(fileKind(b.source === 'link' ? b.url : b.file).label)}</span></div><div class="card-body">${b.description ? `<p>${esc(b.description)}</p>` : ''}${player || '<p class="dim">Media not added yet.</p>'}${b.transcript ? `<details style="margin-top:10px"><summary><b>Transcript</b></summary><div class="prose">${md(b.transcript)}</div></details>` : ''}</div></div>`;
  },

  image: (b, ctx) => (b.image ? `<figure><img src="${esc(ctx.asset(b.image))}" alt="${esc(b.alt || '')}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : ''),

  gallery: (b, ctx) => `${heading(b.heading)}<div class="gallery">${(b.images || []).filter((x) => x.image).map((x) => `<figure><img src="${esc(ctx.asset(x.image))}" alt="${esc(x.alt || '')}" loading="lazy">${x.caption ? `<figcaption>${esc(x.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`,

  table: (b) => {
    const rows = parseTable(b.data);
    if (!rows.length) return '';
    const head = b.has_header !== false ? rows.shift() : null;
    return `${heading(b.heading)}<div class="table-wrap"><table class="data">${b.caption ? `<caption>${esc(b.caption)}</caption>` : ''}${head ? `<thead><tr>${head.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },

  faq: (b) => `<div class="card faq"><div class="card-head"><h3>${esc(b.heading || 'Questions')}</h3></div>${(b.items || []).map((q) => `<details><summary>${esc(q.question)}</summary><div class="prose">${md(q.answer)}</div></details>`).join('')}</div>`,

  buttons: (b, ctx, i, where) => `<div class="actions">${(b.items || []).map((x) => { const l = resolveLink(x, ctx, `${where}, button "${x.label}"`); return l ? `<a class="btn${x.style === 'primary' ? ' primary' : ''}" ${linkAttrs(l)}>${esc(x.label || 'Open')}</a>` : ''; }).join('')}</div>`,

  link: (b) => {
    const url = webUrl(b.url);
    const ext = isExternal(url);
    return `<div class="card simple-link"><div class="link-row">${url ? `<a class="title" href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(b.title || b.url)}${ext ? ' ↗' : ''}</a>` : `<b>${esc(b.title || '')}</b>`}${b.description ? `<p>${esc(b.description)}</p>` : ''}</div></div>`;
  },

  notice: () => '', // a stand-alone notice block: its notices are rendered by the placement logic below
};

/** Spreadsheet text pasted from Excel/Google Sheets (tabs) or typed as CSV (commas). */
export function parseTable(text) {
  const t = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!t) return [];
  const lines = t.split('\n');
  const delim = lines[0].includes('\t') ? '\t' : lines[0].includes('|') ? '|' : ',';
  const rows = lines.map((l) => (delim === ',' ? splitCsv(l) : l.split(delim).map((c) => c.trim())));
  if (delim === '|') return rows.map((r) => r.filter((c, i, a) => !((i === 0 || i === a.length - 1) && c === ''))).filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
  return rows;
}
function splitCsv(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export const BLOCK_NAMES = {
  section: 'Section heading', text: 'Text', link: 'Link', callout: 'Callout', cards: 'Cards', links: 'Links',
  file: 'Document / download', media: 'Video or audio', image: 'Image', gallery: 'Image gallery',
  table: 'Table', faq: 'FAQ', buttons: 'Buttons', notice: 'Notice',
};

/**
 * Render a list of blocks, placing each block's notices before/after it,
 * at the end of its section, or collecting them for the bottom of the page.
 */
export function renderBlocks(blocks, ctx, where = 'Page') {
  const html = [];
  let sectionEnd = [];
  const pageEnd = [];
  (blocks || []).forEach((b, i) => {
    const w = `${where} → block ${i + 1} (${BLOCK_NAMES[b.type] || b.type})`;
    if (b.type === 'section' && sectionEnd.length) { html.push(stack(sectionEnd)); sectionEnd = []; }
    const g = groupNotices(b.notices, ctx, w);
    const fn = R[b.type];
    let body = '';
    try { body = fn ? fn(b, ctx, i, w) : ''; } catch (e) { ctx.warn?.(`${w}: couldn't be shown (${e.message}).`); }
    const parts = [stack(g.before), body, stack(g.after)].filter(Boolean).join('');
    if (parts) html.push(`<div class="block block-${esc(b.type)}">${parts}</div>`);
    sectionEnd.push(...g.section_end);
    pageEnd.push(...g.page_end);
  });
  if (sectionEnd.length) html.push(stack(sectionEnd));
  return { html: `<div class="blocks">${html.join('')}</div>`, pageEnd };
}
