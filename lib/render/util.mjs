// Small helpers shared by the website build (Node) and the dashboard preview (browser).
// Nothing in this file may use Node-only APIs.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function slugify(text) {
  const s = String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return s || 'page';
}

/** Join the site base path ("/" or "/repo-name/") with a site-relative path. */
export function withBase(base, path = '') {
  const b = base.endsWith('/') ? base : base + '/';
  return b + String(path).replace(/^\/+/, '');
}

/**
 * Turn whatever the dashboard stored for an uploaded file into a working URL.
 * Accepts "/uploads/x.pdf", "uploads/x.pdf" or "/old-base/uploads/x.pdf" so that
 * files keep working if the site later moves to a custom domain.
 */
export function mediaUrl(base, value) {
  if (!value) return '';
  const v = String(value).trim();
  if (/^(https?:)?\/\//i.test(v) || v.startsWith('data:') || v.startsWith('blob:')) return v;
  const m = v.match(/^\/?(?:[^/]+\/)?uploads\/(.+)$/);
  if (m) return withBase(base, 'uploads/' + m[1]);
  return v;
}

/** "uploads/x.pdf" style path relative to the uploads folder, or null for external links. */
export function uploadRelPath(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^\/?(?:[^/]+\/)?uploads\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Make a typed web address usable as a link ("www.x.ac.uk" -> "https://www.x.ac.uk"). */
export function webUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (v.startsWith('/') || v.startsWith('#')) return v;
  return 'https://' + v;
}

export const isExternal = (url) => /^(https?:)?\/\//i.test(url || '');

const KINDS = {
  pdf: ['pdf', 'PDF document', 'Opens in your browser'],
  png: ['image', 'Image'], jpg: ['image', 'Image'], jpeg: ['image', 'Image'], gif: ['image', 'Image'],
  webp: ['image', 'Image'], svg: ['image', 'Image'], avif: ['image', 'Image'],
  mp3: ['audio', 'Audio (MP3)'], m4a: ['audio', 'Audio (M4A)'], ogg: ['audio', 'Audio (OGG)'],
  oga: ['audio', 'Audio (OGG)'], wav: ['audio', 'Audio (WAV)'],
  mp4: ['video', 'Video (MP4)'], webm: ['video', 'Video (WebM)'], ogv: ['video', 'Video (OGG)'],
  txt: ['text', 'Text file', 'Opens in your browser'], csv: ['text', 'CSV spreadsheet', 'Opens in your browser or a spreadsheet app'],
  doc: ['office', 'Word document', 'Download and open in Word, Google Docs or similar'],
  docx: ['office', 'Word document', 'Download and open in Word, Google Docs or similar'],
  ppt: ['office', 'PowerPoint presentation', 'Download and open in PowerPoint, Google Slides or similar'],
  pptx: ['office', 'PowerPoint presentation', 'Download and open in PowerPoint, Google Slides or similar'],
  xls: ['office', 'Excel spreadsheet', 'Download and open in Excel, Google Sheets or similar'],
  xlsx: ['office', 'Excel spreadsheet', 'Download and open in Excel, Google Sheets or similar'],
  vtt: ['captions', 'Captions file'],
  zip: ['file', 'ZIP archive', 'Download and unzip'],
};

export function fileKind(nameOrUrl) {
  const clean = String(nameOrUrl || '').split(/[?#]/)[0];
  const ext = (clean.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
  const k = KINDS[ext];
  return {
    ext,
    kind: k ? k[0] : 'file',
    label: k ? k[1] : (ext ? ext.toUpperCase() + ' file' : 'File'),
    howToOpen: k?.[2] || (k && ['image', 'audio', 'video'].includes(k[0]) ? 'Plays or opens in your browser' : 'Download to open'),
  };
}

export function formatBytes(n) {
  if (n == null || isNaN(n)) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

/** Convert a YouTube watch/share link into the official privacy-enhanced embed URL. */
export function youtubeEmbed(url) {
  const u = String(url || '').trim();
  const m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? 'https://www.youtube-nocookie.com/embed/' + m[1] : '';
}

export function formatDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const dt = new Date(s + 'T00:00:00Z');
  if (isNaN(dt)) return esc(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
