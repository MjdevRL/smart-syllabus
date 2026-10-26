// The public website. Vercel sends every address here (see vercel.json); the page is drawn from the database
// and cached for a short time, so edits show up within about a minute.
import { loadContent } from '../lib/render/db.mjs';
import { prepare, renderRoute } from '../lib/render/site.mjs';
import { SUPABASE } from '../lib/config.mjs';

const CACHE = 'public, s-maxage=30, stale-while-revalidate=600';
const HTML = 'text/html; charset=utf-8';

/** Pure part (tested): path in, { status, headers, body } out. */
export async function respond(path, fetchFn = fetch) {
  let rows;
  try { rows = await loadContent(SUPABASE, fetchFn); }
  catch {
    return { status: 503, headers: { 'content-type': HTML, 'cache-control': 'no-store' }, body: '<!doctype html><meta charset="utf-8"><title>Back soon</title><body style="font-family:system-ui;background:#191919;color:#ebebeb;padding:40px"><h1>Back in a moment</h1><p>The site could not load its pages. Please try again shortly.</p>' };
  }
  const out = renderRoute(prepare(rows, '/'), path || '/');
  if (out.location) return { status: out.status, headers: { location: out.location, 'cache-control': CACHE }, body: '' };
  return { status: out.status, headers: { 'content-type': HTML, 'cache-control': out.status === 200 ? CACHE : 'public, s-maxage=10' }, body: out.html };
}

/** Vercel entry point (classic Node handler). */
export default async function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').searchParams.get('path') || '/';
  const r = await respond(path);
  res.statusCode = r.status;
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.end(r.body);
}
