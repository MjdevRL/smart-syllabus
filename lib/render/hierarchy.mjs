// Page hierarchy: turns the flat list of "Page" entries from the dashboard into a tree,
// works out each page's address, decides what is public, finds problems and builds redirects.
// Pure functions only, so the same code runs in the build, the tests and the dashboard preview.

import { slugify } from './util.mjs';

/** Top-level addresses used by built-in parts of the site. Pages may not use them. */
export const RESERVED_SLUGS = ['admin', 'assets', 'uploads', 'universities', 'search', 'my-plan', 'feedback-form', '404', 'index'];

const PUBLIC_STATUS = 'published';

/**
 * @param {Array<{id:string,title?:string,slug?:string,parent?:string,order?:number,status?:string,show_in?:string}>} rawPages
 * @param {{history?:object, extraRedirects?:Array}} opts
 */
export function resolveSite(rawPages, opts = {}) {
  const history = opts.history || {};
  const errors = [];
  const warnings = [];
  const byId = new Map();

  for (const p of rawPages) {
    const title = (p.title || '').trim() || '(untitled page)';
    const typed = (p.slug || '').trim();
    const slug = typed ? slugify(typed) : slugify(title);
    if (typed && slug !== typed) warnings.push(`"${title}": the URL name "${typed}" was tidied to "${slug}" (only lowercase letters, numbers and hyphens are allowed).`);
    byId.set(p.id, {
      id: p.id,
      title,
      slug,
      parentId: (p.parent || '').trim() || null,
      order: Number.isFinite(Number(p.order)) && p.order !== '' && p.order != null ? Number(p.order) : 10,
      status: p.status || 'draft',
      showIn: p.show_in || 'auto',
      data: p,
      children: [],
      parent: null,
      path: null,
      depth: 0,
      public: false,
    });
  }

  // 1. Parents must exist and must not be the page itself.
  for (const n of byId.values()) {
    if (!n.parentId) continue;
    if (n.parentId === n.id) {
      errors.push(`"${n.title}" is set as its own parent page. Open it in the dashboard and choose a different parent (or "None").`);
      n.parentId = null;
    } else if (!byId.has(n.parentId)) {
      errors.push(`"${n.title}" sits under a parent page that no longer exists (it may have been deleted). Open "${n.title}" and choose a new parent page, or "None" to make it a top-level page.`);
      n.parentId = null;
    }
  }

  // 2. No loops (A inside B inside A).
  const reported = new Set();
  for (const start of byId.values()) {
    const seen = [];
    let cur = start;
    while (cur && cur.parentId) {
      if (seen.includes(cur.id)) {
        const loop = seen.slice(seen.indexOf(cur.id)).map((id) => byId.get(id));
        const key = loop.map((x) => x.id).sort().join('|');
        if (!reported.has(key)) {
          reported.add(key);
          errors.push(`These pages are inside each other in a loop: ${loop.map((x) => `"${x.title}"`).join(' → ')} → back to the start. Change the parent of one of them.`);
        }
        for (const x of loop) x.parentId = null; // break the loop so the rest can still be checked
        break;
      }
      seen.push(cur.id);
      cur = byId.get(cur.parentId);
    }
  }

  // 3. Link up the tree.
  for (const n of byId.values()) {
    if (n.parentId) {
      n.parent = byId.get(n.parentId);
      n.parent.children.push(n);
    }
  }
  const sortKids = (arr) => arr.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  for (const n of byId.values()) sortKids(n.children);
  const roots = sortKids([...byId.values()].filter((n) => !n.parent));

  // 4. Addresses and visibility, from the top down.
  const walk = (n, parent) => {
    n.depth = parent ? parent.depth + 1 : 0;
    n.path = (parent ? parent.path : '/') + n.slug + '/';
    n.public = n.status === PUBLIC_STATUS && (!parent || parent.public);
    if (n.status === PUBLIC_STATUS && parent && !parent.public) {
      warnings.push(`"${n.title}" is published but will stay hidden until the page above it ("${topHidden(n).title}") is published.`);
    }
    n.children.forEach((c) => walk(c, n));
  };
  roots.forEach((r) => walk(r, null));

  for (const r of roots) {
    if (RESERVED_SLUGS.includes(r.slug)) {
      errors.push(`"${r.title}" uses the address "/${r.slug}/", which is reserved for a built-in part of the site. Change its URL name (for example "${r.slug}-guide").`);
    }
  }

  // 5. Duplicate addresses.
  const byPath = new Map();
  for (const n of byId.values()) {
    if (!byPath.has(n.path)) byPath.set(n.path, []);
    byPath.get(n.path).push(n);
  }
  for (const [path, list] of byPath) {
    if (list.length < 2) continue;
    const names = list.map((x) => `"${x.title}"`).join(' and ');
    const pub = list.filter((x) => x.public);
    if (pub.length > 1) errors.push(`${names} would both have the address ${path}. Give one of them a different URL name or a different parent.`);
    else warnings.push(`${names} share the address ${path}. That's fine while only one is published, but publishing both will be blocked. Consider changing one URL name now.`);
  }

  // 6. Redirects for old addresses.
  const publicPaths = new Set([...byId.values()].filter((n) => n.public).map((n) => n.path));
  const redirects = [];
  const seenFrom = new Set();
  const nearestPublic = (id, hops = 0) => {
    if (!id || hops > 50) return '/';
    const n = byId.get(id);
    if (n && n.public) return n.path;
    const parentId = n ? n.parentId : history[id]?.parent;
    return nearestPublic(parentId, hops + 1);
  };
  for (const [id, h] of Object.entries(history)) {
    for (const from of h.urls || []) {
      if (publicPaths.has(from) || seenFrom.has(from)) continue;
      const n = byId.get(id);
      let to; let reason;
      if (n && n.public) { to = n.path; reason = 'moved'; }
      else { to = nearestPublic(n ? n.parentId : h.parent); reason = n ? 'unpublished' : 'deleted'; }
      if (to === from) continue;
      seenFrom.add(from);
      redirects.push({ from, to, reason, title: n ? n.title : h.title });
    }
  }
  for (const r of opts.extraRedirects || []) {
    const from = normalizePath(r.from);
    if (!from || publicPaths.has(from) || seenFrom.has(from)) continue;
    let to = '';
    if (r.to_page) {
      const n = byId.get(r.to_page);
      if (!n || !n.public) { warnings.push(`The manual redirect from ${from} points to a page that isn't published, so it was skipped.`); continue; }
      to = n.path;
    } else to = (r.to_url || '').trim();
    if (!to) continue;
    seenFrom.add(from);
    redirects.push({ from, to, reason: 'manual' });
  }

  return { errors, warnings, byId, roots, redirects, publicPaths };
}

function topHidden(n) {
  let hidden = n.parent;
  for (let p = n.parent; p; p = p.parent) if (!p.public) hidden = p;
  return hidden;
}

export function normalizePath(p) {
  let s = String(p || '').trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (!s.endsWith('/') && !/\.[a-z0-9]+$/i.test(s)) s += '/';
  return s;
}

/** Record every public address each page currently has, so future moves can redirect. */
export function updateHistory(history, site) {
  const next = JSON.parse(JSON.stringify(history || {}));
  for (const n of site.byId.values()) {
    if (!n.public) {
      if (next[n.id]) { next[n.id].title = n.title; next[n.id].parent = n.parentId; }
      continue;
    }
    const h = next[n.id] || (next[n.id] = { title: n.title, urls: [] });
    h.title = n.title;
    h.parent = n.parentId;
    if (!h.urls.includes(n.path)) h.urls.push(n.path);
  }
  return next;
}

// ---------- Navigation helpers ----------

const inMenus = (n) => n.public && n.showIn !== 'links';

/** Top-level menu with one level of dropdown. Deeper pages live in the section sidebar. */
export function mainMenu(site) {
  return site.roots
    .filter((r) => r.public && (r.showIn === 'auto' || r.showIn === 'main'))
    .map((r) => ({ node: r, children: r.children.filter((c) => c.public && (c.showIn === 'auto' || c.showIn === 'main')) }));
}

export const ancestors = (n) => { const out = []; for (let p = n.parent; p; p = p.parent) out.unshift(p); return out; };
export const sectionRoot = (n) => { let r = n; while (r.parent) r = r.parent; return r; };

/** Tree for the "In this section" sidebar, or null if the section has no subpages. */
export function sectionTree(n) {
  const root = sectionRoot(n);
  const build = (x) => ({ node: x, children: x.children.filter(inMenus).map(build) });
  const tree = build(root);
  return tree.children.length ? tree : null;
}

/** The whole sidebar: every published page not marked "hidden from sidebar", nested by parent. */
export function siteTree(site) {
  const build = (x) => ({ node: x, children: x.children.filter(inMenus).map(build) });
  return site.roots.filter(inMenus).map(build);
}

/** Where a page will show up, in plain words (used by the site check and the preview). */
export function describePlacement(n) {
  if (!n.public) return 'Not on the public site';
  if (n.showIn === 'links') return 'Hidden from the sidebar (only reachable through links)';
  for (let p = n.parent; p; p = p.parent) if (p.showIn === 'links') return `Hidden from the sidebar because "${p.title}" is hidden from it`;
  return n.parent ? `Appears in the sidebar under "${n.parent.title}"` : 'Appears in the sidebar (top level)';
}
