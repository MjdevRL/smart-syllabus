// Reads everything the website needs from Supabase in one request.
// Rows look like { kind: 'page' | 'setting' | 'notice' | 'university', id, data }.
// The publishable key is meant to be public; what it may do is decided by the rules in supabase-setup.sql.

export async function loadContent({ url, key }, fetchFn = fetch) {
  const r = await fetchFn(`${url}/rest/v1/content?select=kind,id,data`, { headers: { apikey: key } });
  if (!r.ok) throw new Error(`Database answered ${r.status}`);
  return r.json();
}
