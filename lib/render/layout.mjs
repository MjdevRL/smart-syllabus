import { esc, withBase } from './util.mjs';

/** Header menu built from the page tree plus built-in sections. */
export function renderMenu(menu, extras, currentPath, base) {
  const isCur = (p) => currentPath === p;
  const inSec = (p) => currentPath && currentPath.startsWith(p);
  const items = menu.map(({ node, children }) => {
    const url = withBase(base, node.path);
    if (!children.length) return `<a href="${esc(url)}"${isCur(node.path) ? ' aria-current="page"' : ''}>${esc(node.title)}</a>`;
    return `<details class="${inSec(node.path) ? 'current' : ''}"><summary>${esc(node.title)}</summary><div class="drop"><a href="${esc(url)}"${isCur(node.path) ? ' aria-current="page"' : ''}>${esc(node.title)} (overview)</a>${children.map((c) => `<a href="${esc(withBase(base, c.path))}"${isCur(c.path) ? ' aria-current="page"' : ''}>${esc(c.title)}</a>`).join('')}</div></details>`;
  });
  for (const x of extras) items.push(`<a href="${esc(withBase(base, x.path))}"${inSec(x.path) ? ' aria-current="page"' : ''}>${esc(x.title)}</a>`);
  return items.join('');
}

/** Sidebar listing every page. The branch containing the current page is open. */
export function renderSidebar(tree, currentPath, base, extraTop = []) {
  const li = (t) => {
    const url = esc(withBase(base, t.node.path));
    const cur = t.node.path === currentPath ? ' aria-current="page"' : '';
    if (!t.children.length) return `<li><a href="${url}"${cur}>${esc(t.node.title)}</a></li>`;
    const open = currentPath && currentPath.startsWith(t.node.path) ? ' open' : '';
    return `<li><details${open}><summary><a href="${url}"${cur}>${esc(t.node.title)}</a></summary><ul>${t.children.map(li).join('')}</ul></details></li>`;
  };
  const top = extraTop.map((x) => `<li><a href="${esc(withBase(base, x.path))}"${x.path === currentPath ? ' aria-current="page"' : ''}>${esc(x.title)}</a></li>`).join('');
  return `<aside class="side" id="sidebar" aria-label="Pages"><div class="card"><div class="card-head">Pages</div><ul>${top}${tree.map(li).join('')}</ul>${tree.length ? '' : '<p class="side-empty">No pages yet.</p>'}</div></aside>`;
}

export function renderLayout({ title, description, base, siteName, menuHtml, sidebar = '', main, footer, canonical, noindex }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#191919">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="stylesheet" href="${withBase(base, 'assets/fonts/fonts.css')}">
<link rel="stylesheet" href="${withBase(base, 'assets/reference.css')}">
<link rel="stylesheet" href="${withBase(base, 'assets/site.css')}">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<div class="app">
<header><a class="brand" href="${withBase(base, '')}">${esc(siteName)}</a><button class="menu-toggle" aria-expanded="false" aria-controls="sidebar">Pages</button>${menuHtml ? `<nav class="menu" aria-label="Links">${menuHtml}</nav>` : ''}</header>
<main class="site" id="content"><div class="layout has-side">${sidebar}${main}</div></main>
<footer class="site-footer"><div class="inner"><span>${footer || ''}</span></div></footer>
</div>
<script src="${withBase(base, 'assets/site.js')}" defer></script>
</body>
</html>`;
}
