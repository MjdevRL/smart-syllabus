// Your Supabase project. Both values are public by design: what visitors may do is decided by the
// rules in supabase-setup.sql, not by hiding these. Never put a secret / service_role key here.
export const SUPABASE = {
  url: process.env.SUPABASE_URL || 'https://jegpiwjrvzbidxeetsco.supabase.co',
  key: process.env.SUPABASE_KEY || 'sb_publishable_cxS17qqGnodP9KAkjUfyrw_uOZGjy0D',
};
