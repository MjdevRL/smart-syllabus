import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, renderRoute, renderPreview } from '../lib/render/site.mjs';
import { loadContent } from '../lib/render/db.mjs';
import { respond } from '../api/site.js';

const page = (id, data) => ({ kind: 'page', id, data });
const rows = [
  { kind: 'setting', id: 'site', data: { site_name: 'My Guide', footer_text: 'Footer here', show_universities: false } },
  { kind: 'setting', id: 'home', data: { heading: 'Welcome home', intro: 'Hello **there**' } },
  page('a', { title: 'Subjects', status: 'published', blocks: [{ type: 'text', body: 'Pick *well*' }, { type: 'link', title: 'IB', url: 'https://ibo.org', description: 'official' }] }),
  page('b', { title: 'Maths', parent: 'a', status: 'published', blocks: [] }),
  page('c', { title: 'Secret', status: 'draft', blocks: [{ type: 'text', body: 'hidden' }] }),
  { kind: 'setting', id: 'url-history', data: { b: { title: 'Maths', parent: 'a', urls: ['/maths-old/', '/subjects/maths/'] } } },
];
const m = prepare(rows);

test('home page uses settings', () => {
  const r = renderRoute(m, '/');
  assert.equal(r.status, 200);
  assert.match(r.html, /Welcome home/);
  assert.match(r.html, /<strong>there<\/strong>/);
  assert.match(r.html, /Footer here/);
});
test('published page and nested page render', () => {
  assert.match(renderRoute(m, '/subjects/').html, /Pick <em>well<\/em>/);
  assert.match(renderRoute(m, '/subjects/').html, /ibo\.org/);
  assert.match(renderRoute(m, '/subjects/').html, /In this section/);
  assert.equal(renderRoute(m, '/subjects/maths').status, 200);
});
test('draft is a 404 and never leaks into the sidebar', () => {
  const r = renderRoute(m, '/secret/');
  assert.equal(r.status, 404);
  assert.doesNotMatch(renderRoute(m, '/').html, /Secret/);
});
test('old address redirects to the new one', () => {
  const r = renderRoute(m, '/maths-old/');
  assert.equal(r.status, 308);
  assert.equal(r.location, '/subjects/maths/');
});
test('unknown address is 404', () => assert.equal(renderRoute(m, '/nope/').status, 404));
test('universities hidden unless enabled and present', () => {
  assert.equal(renderRoute(m, '/universities/').status, 404);
  const u = [{ kind: 'university', id: 'x', data: { university: 'Uni X', course: 'EE', status: 'published' } }];
  const m2 = prepare([...rows.filter((r) => r.id !== 'site'), ...u, { kind: 'setting', id: 'site', data: { site_name: 'S', show_universities: true } }]);
  assert.equal(renderRoute(m2, '/universities/').status, 200);
});
test('raw html in a text block is escaped', () => {
  const m3 = prepare([page('x', { title: 'X', status: 'published', blocks: [{ type: 'text', body: '<script>alert(1)</script>' }] })]);
  assert.doesNotMatch(renderRoute(m3, '/x/').html, /<script>alert/);
});
test('preview shows an unsaved draft as published, under a base folder', () => {
  const html = renderPreview(rows, '/admin/', 'page', { id: 'c', title: 'Secret', status: 'draft', blocks: [{ type: 'text', body: 'now visible' }] });
  assert.match(html, /now visible/);
  assert.match(html, /\/admin\/assets\//);
});
test('preview of a brand new page', () => {
  assert.match(renderPreview(rows, '/', 'page', { title: 'Fresh', blocks: [] }), /Fresh/);
});
test('db reader sends only the apikey header and throws on failure', async () => {
  let seen;
  const ok = await loadContent({ url: 'https://x.test', key: 'K' }, async (u, o) => { seen = [u, o]; return { ok: true, json: async () => [1] }; });
  assert.deepEqual(ok, [1]);
  assert.equal(seen[0], 'https://x.test/rest/v1/content?select=kind,id,data');
  assert.deepEqual(seen[1].headers, { apikey: 'K' });
  await assert.rejects(loadContent({ url: 'u', key: 'k' }, async () => ({ ok: false, status: 401 })));
});
test('function: 200 with cache header, 308, 503 when database is down', async () => {
  const good = async () => ({ ok: true, json: async () => rows });
  const r = await respond('subjects', good);
  assert.equal(r.status, 200);
  assert.match(r.headers['cache-control'], /s-maxage=30/);
  assert.equal((await respond('maths-old', good)).status, 308);
  assert.equal((await respond('maths-old', good)).headers.location, '/subjects/maths/');
  const down = await respond('', async () => { throw new Error('x'); });
  assert.equal(down.status, 503);
  assert.equal(down.headers['cache-control'], 'no-store');
});
test('handler: works with a plain Node request/response', async () => {
  const { default: handler } = await import('../api/site.js');
  const orig = globalThis.fetch; globalThis.fetch = async () => ({ ok: true, json: async () => rows });
  const h = {}; let body, code;
  await handler({ url: '/api/site?path=subjects' }, { setHeader: (k, v) => { h[k] = v; }, end: (b) => { body = b; }, set statusCode(v) { code = v; } });
  globalThis.fetch = orig;
  assert.equal(code, 200); assert.match(body, /Pick/); assert.match(h['content-type'], /html/);
});
