import { test } from 'node:test';
import assert from 'node:assert/strict';
import { md } from '../lib/render/markdown.mjs';

test('normal markdown still works', () => {
  assert.match(md('**bold** and [a link](https://example.com)'), /<strong>bold<\/strong>.*<a href="https:\/\/example\.com">a link<\/a>/);
});
test('raw HTML is shown as text, never run', () => {
  const out = md('hi <script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.ok(!/<script|<img/i.test(out));
  assert.match(out, /&lt;script&gt;/);
});
test('script-style links and images are dropped', () => {
  for (const s of ['[x](javascript:alert(1))', '[x](JaVaScRiPt:alert(1))', '[x](data:text/html,hi)', '![x](javascript:alert(1))']) {
    assert.ok(!/href="\s*(javascript|data)|src="\s*(javascript|data)/i.test(md(s)), s);
  }
  assert.match(md('[x](javascript:alert(1))'), /x/);
});
test('empty input gives empty output', () => { assert.equal(md(''), ''); assert.equal(md(undefined), ''); });
