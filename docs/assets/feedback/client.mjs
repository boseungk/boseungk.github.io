export class FeedbackError extends Error {
  constructor(code, status = 0, field = null, retryAfter = 0) {
    super(code);
    Object.assign(this, {code, status, field, retryAfter});
  }
}

export function normalizeText(value) {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

export function validateDraft({nickname = '', body}, limit) {
  const draft = {nickname: normalizeText(nickname), body: normalizeText(body)};
  if ([...draft.nickname].length > 24) throw new FeedbackError('nickname_length', 400, 'nickname');
  if (!draft.body || [...draft.body].length > limit) throw new FeedbackError('body_length', 400, 'body');
  return draft;
}

// Retain the same request id after an uncertain response; editing starts a new request.
export function createDraftRequest(makeId = () => crypto.randomUUID()) {
  let previous, id;
  return draft => {
    const content = JSON.stringify(draft);
    if (previous !== content) { previous = content; id = makeId(); }
    return {...draft, client_request_id: id};
  };
}

export function createClient({baseUrl, verify, fetcher = fetch}) {
  let visitorPreparation;
  async function request(path, {method = 'GET', data, signal} = {}) {
    // The 20 s timeout always applies; a caller's signal (a newer list view) aborts the same request.
    // No AbortSignal.any: older Safari lacks it.
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 20000);
    if (signal) {
      if (signal.aborted) timeout.abort();
      else signal.addEventListener('abort', () => timeout.abort(), {once: true});
    }
    let response;
    try {
      response = await fetcher(baseUrl + path, {
        method, credentials: 'include', cache: 'no-store', signal: timeout.signal,
        ...(data === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)})
      });
    } catch (error) {
      if (error.name === 'AbortError' && signal?.aborted) throw error;   // the caller cancelled: not a failure
      throw new FeedbackError('network_error');
    } finally {
      clearTimeout(timer);
    }
    let result;
    try { result = await response.json(); }
    catch { throw new FeedbackError('invalid_response', response.status); }
    if (!response.ok) throw new FeedbackError(result.error?.code || 'server_error', response.status,
      result.error?.field, Number(response.headers.get('Retry-After')) || 0);
    return result;
  }
  async function write(path, method, data, challengeHost) {
    try { return await request(path, {method, data}); }
    catch (error) {
      if (error.status !== 401 || error.code !== 'visitor_required') throw error;
    }
    if (!visitorPreparation) {
      visitorPreparation = (async () => {
        const token = await verify(challengeHost);
        await request('/v1/visitor', {method: 'POST', data: {turnstile_token: token}});
      })().finally(() => { visitorPreparation = null; });
    }
    await visitorPreparation;
    // Retry once only: a browser refusing cookies must not enter an endless challenge loop.
    return request(path, {method, data});
  }
  return {request, write};
}

// ---- list views, dates and operator-reply links (pure; tools/check-feedback-client.mjs) ----

export const SORTS = Object.freeze(['popular', 'latest']);
// Operator states a visitor can filter by. 'open' is the default state of every new idea, so it has no tab.
export const STATUSES = Object.freeze(['reviewing', 'planned', 'completed']);

export function ideasPath({sort = 'popular', status = '', cursor = null} = {}) {
  const params = new URLSearchParams({sort});
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  return '/v1/ideas?' + params;
}

// First pages per "status|sort", in memory only, for an instant tab switch before revalidating.
export function createViewCache({ttl = 60000, now = Date.now} = {}) {
  const views = new Map();
  return {
    get(key) {
      const entry = views.get(key);
      if (!entry) return null;
      if (now() - entry.at > ttl) { views.delete(key); return null; }
      return entry.value;
    },
    set(key, value) { views.set(key, {value, at: now()}); },
    clear() { views.clear(); }
  };
}

const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

export function absoluteDate(iso, locale, options = {year: 'numeric', month: 'short', day: 'numeric'}) {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString(locale, options) : '';
}

// Under 7 days: "3시간 전", "어제" (Intl.RelativeTimeFormat). Older, or without Intl support: the date.
// A time slightly in the future (clock skew) reads as now.
export function relativeDate(iso, locale, now = Date.now()) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  const age = Math.max(0, now - time);
  if (age >= 7 * DAY || typeof Intl.RelativeTimeFormat !== 'function') return absoluteDate(iso, locale);
  const format = new Intl.RelativeTimeFormat(locale, {numeric: 'auto'});
  if (age < MINUTE) return format.format(0, 'second');
  if (age < HOUR) return format.format(-Math.floor(age / MINUTE), 'minute');
  if (age < DAY) return format.format(-Math.floor(age / HOUR), 'hour');
  return format.format(-Math.floor(age / DAY), 'day');
}

// Operator replies may mention a news entry: "/news/#id", "/<lang>/news/#id" or the same on the public origin.
// Returns [{text} | {text, href}] so the caller builds text nodes and <a> elements (never HTML). The link goes
// to the current page's news route; trailing sentence punctuation stays outside the link.
const NEWS_LINK = /^(?:https:\/\/www\.myanimalroom\.com)?\/(?:[a-z-]+\/)?news\/#([a-z0-9-]{1,64})$/;
export function newsLinkSegments(text, newsRoute = '/news/') {
  const segments = [];
  const push = (value, href) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (!href && last && !last.href) last.text += value;
    else segments.push(href ? {text: value, href} : {text: value});
  };
  for (const part of String(text).split(/(\s+)/)) {
    const [, lead = '', core = part, tail = ''] = /^([(\[]*)(.*?)([.,!?;:)\]]*)$/su.exec(part) || [];
    const match = NEWS_LINK.exec(core);
    if (match) { push(lead); push(core, newsRoute + '#' + match[1]); push(tail); }
    else push(part);
  }
  return segments;
}
