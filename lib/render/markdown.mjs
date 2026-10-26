// The one place page text is turned into HTML. Raw HTML typed into a page is shown as text
// and script-style links (javascript:, data:) are dropped, so a page can never run code for visitors.
import { Marked } from 'marked';
import { esc } from './util.mjs';

const BAD_URL = /^\s*(javascript|vbscript|data):/i;
const safe = new Marked({
  renderer: {
    html: ({ text }) => esc(text),
    link(t) { return BAD_URL.test(t.href) ? this.parser.parseInline(t.tokens) : false; },
    image(t) { return BAD_URL.test(t.href) ? esc(t.text) : false; },
  },
});

export const md = (s) => (s ? safe.parse(String(s)) : '');
