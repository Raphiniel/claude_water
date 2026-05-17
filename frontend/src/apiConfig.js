/** Production WaterWise API — same default as deploy.sh / mobile app. */
export const DEFAULT_WATERWISE_API = 'https://api.waterwise.loficode.tech';

/** Backend origin (no trailing slash). Override at build time with VITE_API_BASE_URL. */
const raw = import.meta.env.VITE_API_BASE_URL;
const trimmed = raw != null && String(raw).trim() !== '' ? String(raw).trim().replace(/\/+$/, '') : '';
export const API_BASE =
  trimmed ||
  (import.meta.env.PROD ? DEFAULT_WATERWISE_API : 'http://localhost:8000');

/** Optional docs URL (e.g. wiki or Notion). If empty, sidebar "View documentation" opens in-app /help. */
const docsRaw = import.meta.env.VITE_DOCS_URL;
export const DOCS_URL =
  docsRaw != null && String(docsRaw).trim() !== '' ? String(docsRaw).trim() : '';
