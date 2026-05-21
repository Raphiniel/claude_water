/** Production WaterWise API — same default as deploy.sh / mobile app. */
export const DEFAULT_WATERWISE_API = 'https://api.waterwise.loficode.tech';

export const SMS_INBOUND_PATH = '/api/sms/incoming/';

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

const LOCAL_HOST_RE = /localhost|127\.0\.0\.1/i;

/** True when the app is pointed at a local backend (not shown in production UI). */
export function isLocalApiHost() {
  return LOCAL_HOST_RE.test(API_BASE);
}

/** Host label safe to show operators (never localhost). */
export function getPublicApiLabel() {
  if (isLocalApiHost()) {
    try {
      return new URL(DEFAULT_WATERWISE_API).host;
    } catch {
      return 'api.waterwise.loficode.tech';
    }
  }
  try {
    return new URL(API_BASE).host;
  } catch {
    return 'WaterWise API';
  }
}

/** Webhook URL for SMS relay configuration (production URL when UI runs locally). */
export function getSmsWebhookUrl() {
  const base = isLocalApiHost() ? DEFAULT_WATERWISE_API : API_BASE;
  return `${base.replace(/\/+$/, '')}${SMS_INBOUND_PATH}`;
}
