import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSite, updateHistory, mainMenu, sectionTree, siteTree, ancestors } from '../lib/render/hierarchy.mjs';

const P = (id, title, extra = {}) => ({ id, title, status: 'published', ...extra });

test('builds nested addresses from parents and slugs', () => {
  const s = resolveSite([P('a', 'SAT Preparation'), P('b', 'Maths', { parent: 'a' }), P('c', 'Algebra & Functions', { parent: 'b', slug: 'algebra' })]);
  assert.deepEqual(s.errors, []);
  assert.equal(s.byId.get('a').path, '/sat-preparation/');
  assert.equal(s.byId.get('b').path, '/sat-preparation/maths/');
  assert.equal(s.byId.get('c').path, '/sat-preparation/maths/algebra/');
  assert.deepEqual(ancestors(s.byId.get('c')).map((n) => n.id), ['a', 'b']);
});

test('publishing a parent never exposes draft subpages', () => {
  const s = resolveSite([P('a', 'Parent'), P('b', 'Draft child', { parent: 'a', status: 'draft' }), P('c', 'Grandchild', { parent: 'b' })]);
  assert.equal(s.byId.get('a').public, true);
  assert.equal(s.byId.get('b').public, false);
  assert.equal(s.byId.get('c').public, false, 'published page under a draft stays hidden');
  assert.ok(s.warnings.some((w) => w.includes('Grandchild')));
});

test('hidden and archived pages are not public', () => {
  const s = resolveSite([P('a', 'A', { status: 'hidden' }), P('b', 'B', { status: 'archived' })]);
  assert.equal(s.publicPaths.size, 0);
});

test('detects missing parents, self-parents and loops', () => {
  const s = resolveSite([P('a', 'A', { parent: 'gone' }), P('b', 'B', { parent: 'b' }), P('c', 'C', { parent: 'd' }), P('d', 'D', { parent: 'c' })]);
  assert.equal(s.errors.length, 3);
  assert.ok(s.errors.some((e) => e.includes('no longer exists')));
  assert.ok(s.errors.some((e) => e.includes('its own parent')));
  assert.ok(s.errors.some((e) => e.includes('loop')));
});

test('duplicate addresses: error only when both are public', () => {
  const both = resolveSite([P('a', 'Maths'), P('b', 'Maths')]);
  assert.equal(both.errors.length, 1);
  const one = resolveSite([P('a', 'Maths'), P('b', 'Maths', { status: 'draft' })]);
  assert.equal(one.errors.length, 0);
  assert.equal(one.warnings.length, 1);
  const siblingsDifferentParents = resolveSite([P('x', 'SAT'), P('y', 'ACT'), P('a', 'Maths', { parent: 'x' }), P('b', 'Maths', { parent: 'y' })]);
  assert.equal(siblingsDifferentParents.errors.length, 0);
});

test('reserved top-level addresses are blocked', () => {
  const s = resolveSite([P('a', 'Admin')]);
  assert.equal(s.errors.length, 1);
  const nested = resolveSite([P('x', 'Guides'), P('a', 'Admin', { parent: 'x' })]);
  assert.equal(nested.errors.length, 0, 'reserved names are fine below the top level');
});

test('ordering by order number then title', () => {
  const s = resolveSite([P('r', 'Root'), P('b', 'Bravo', { parent: 'r', order: 2 }), P('a', 'Alpha', { parent: 'r', order: 2 }), P('z', 'Zulu', { parent: 'r', order: 1 })]);
  assert.deepEqual(s.byId.get('r').children.map((c) => c.title), ['Zulu', 'Alpha', 'Bravo']);
});

test('moving a page creates a redirect from its old address; children follow', () => {
  let pages = [P('sat', 'SAT Preparation'), P('act', 'ACT Preparation'), P('m', 'Maths', { parent: 'sat' }), P('alg', 'Algebra', { parent: 'm' })];
  let s = resolveSite(pages);
  let history = updateHistory({}, s);
  // Move Maths from SAT to ACT
  pages = pages.map((p) => (p.id === 'm' ? { ...p, parent: 'act' } : p));
  s = resolveSite(pages, { history });
  assert.equal(s.byId.get('m').path, '/act-preparation/maths/');
  assert.equal(s.byId.get('alg').path, '/act-preparation/maths/algebra/');
  const map = Object.fromEntries(s.redirects.map((r) => [r.from, r.to]));
  assert.equal(map['/sat-preparation/maths/'], '/act-preparation/maths/');
  assert.equal(map['/sat-preparation/maths/algebra/'], '/act-preparation/maths/algebra/');
  // Rename after move: both earlier addresses still lead to the newest one
  history = updateHistory(history, s);
  pages = pages.map((p) => (p.id === 'm' ? { ...p, slug: 'math' } : p));
  s = resolveSite(pages, { history });
  const map2 = Object.fromEntries(s.redirects.map((r) => [r.from, r.to]));
  assert.equal(map2['/sat-preparation/maths/'], '/act-preparation/math/');
  assert.equal(map2['/act-preparation/maths/'], '/act-preparation/math/');
});

test('deleted or unpublished pages redirect to the nearest public parent', () => {
  let pages = [P('a', 'Guides'), P('b', 'UK', { parent: 'a' }), P('c', 'UCAS', { parent: 'b' })];
  const history = updateHistory({}, resolveSite(pages));
  pages = pages.filter((p) => p.id !== 'c').map((p) => (p.id === 'b' ? { ...p, status: 'draft' } : p));
  const s = resolveSite(pages, { history });
  const map = Object.fromEntries(s.redirects.map((r) => [r.from, r.to]));
  assert.equal(map['/guides/uk/ucas/'], '/guides/');
  assert.equal(map['/guides/uk/'], '/guides/');
});

test('an old address now used by another page is not redirected', () => {
  let pages = [P('a', 'Maths')];
  const history = updateHistory({}, resolveSite(pages));
  pages = [P('a', 'Maths', { slug: 'maths-old' }), P('b', 'Maths')];
  const s = resolveSite(pages, { history });
  assert.ok(!s.redirects.some((r) => r.from === '/maths/'));
});

test('menus: main menu, one dropdown level, links-only pages excluded', () => {
  const s = resolveSite([
    P('a', 'A'), P('a1', 'A1', { parent: 'a' }), P('a2', 'A2', { parent: 'a', show_in: 'links' }),
    P('a11', 'A11', { parent: 'a1' }), P('b', 'B', { show_in: 'sidebar' }),
  ]);
  const menu = mainMenu(s);
  assert.deepEqual(menu.map((m) => m.node.id), ['a']);
  assert.deepEqual(menu[0].children.map((c) => c.id), ['a1']);
  const tree = sectionTree(s.byId.get('a11'));
  assert.equal(tree.node.id, 'a');
  assert.deepEqual(tree.children.map((c) => c.node.id), ['a1']);
  assert.deepEqual(tree.children[0].children.map((c) => c.node.id), ['a11']);
});

test('sidebar tree lists every published page, nested, without hidden ones', () => {
  const s = resolveSite([P('a', 'A'), P('a1', 'A1', { parent: 'a' }), P('a2', 'A2', { parent: 'a', status: 'draft' }), P('b', 'B', { show_in: 'links' }), P('c', 'C', { order: 1 })]);
  const t = siteTree(s);
  assert.deepEqual(t.map((x) => x.node.id), ['c', 'a']);
  assert.deepEqual(t[1].children.map((x) => x.node.id), ['a1']);
});
