const PRODUCTION_ORIGIN = 'https://www.myanimalroom.com';
const LOCAL_ORIGINS = new Set(['http://127.0.0.1:8765']);
const TEST_SECRET = '1x0000000000000000000000000000000AA';
const MAX_BODY = 16 * 1024;
const DAY = 86_400_000;
const VISITOR_LIFETIME = 90 * DAY;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = '[0-9a-f-]{36}';

class ApiError extends Error {
  constructor(status, code, message, field, retryAfter) {
    super(message);
    Object.assign(this, { status, code, field, retryAfter });
  }
}
const invalid = (message, field) => new ApiError(400, 'invalid_request', message, field);
const missing = () => new ApiError(404, 'not_found', 'This item is unavailable.');
const limited = (seconds) => new ApiError(429, 'rate_limited', 'Please try again later.', undefined, Math.max(1, Math.ceil(seconds)));
const isDev = (env) => env.ENVIRONMENT === 'development';
const cookieName = (env) => isDev(env) ? 'feedback_dev' : '__Host-feedback';
const statement = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);

function publicIdea(row) {
  return {
    id: row.id, nickname: row.nickname, body: row.body, status: row.status,
    created_at: new Date(row.created_at).toISOString(),
    vote_count: row.vote_count, comment_count: row.comment_count, voted: !!row.voted,
  };
}
function publicComment(row) {
  return {
    id: row.id, idea_id: row.idea_id, nickname: row.nickname, body: row.body,
    created_at: new Date(row.created_at).toISOString(), is_operator: !!row.is_operator,
  };
}
const IDEA_SELECT = `SELECT i.id,i.nickname,i.body,i.created_at,i.status,
  (SELECT COUNT(*) FROM votes v WHERE v.idea_id=i.id) AS vote_count,
  (SELECT COUNT(*) FROM comments c WHERE c.idea_id=i.id AND c.hidden=0) AS comment_count,
  EXISTS(SELECT 1 FROM votes v WHERE v.idea_id=i.id AND v.visitor_id=?) AS voted
  FROM ideas i WHERE i.hidden=0`;

async function getIdea(env, id, visitorId) {
  const row = await statement(env, `${IDEA_SELECT} AND i.id=?`, visitorId || '', id).first();
  if (!row) throw missing();
  return publicIdea(row);
}

async function sha256(token) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function visitorFor(request, env) {
  const token = request.headers.get('Cookie')?.split(';').map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName(env)}=`))?.split('=')[1];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  return statement(env, 'SELECT id FROM visitors WHERE token_hash=? AND expires_at>?', await sha256(token), Date.now()).first();
}

async function readJson(request, allowed) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get('Content-Type') || '')) {
    throw invalid('Use application/json.', 'content_type');
  }
  const declared = request.headers.get('Content-Length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY)) {
    throw new ApiError(400, 'body_too_large', 'Request body exceeds 16 KiB.');
  }
  const reader = request.body?.getReader();
  const chunks = [];
  let total = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) {
        await reader.cancel();
        throw new ApiError(400, 'body_too_large', 'Request body exceeds 16 KiB.');
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new ApiError(400, 'invalid_json', 'Provide valid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw invalid('Provide a JSON object.');
  for (const key of Object.keys(data)) if (!allowed.includes(key)) throw invalid('Unknown field.', key);
  return data;
}

function normalize(value, max, field, required = true) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') throw invalid('Provide text.', field);
  const text = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  // Reject lone UTF-16 surrogates and non-text controls; keep tab/newline as plain text.
  if (!text.isWellFormed() || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) throw invalid('Provide valid text.', field);
  const length = [...text].length;
  if ((required && length < 1) || length > max) throw invalid(`Use ${required ? '1–' : '0–'}${max} characters.`, field);
  return text;
}
function content(data, max) {
  if (typeof data.client_request_id !== 'string' || !UUID.test(data.client_request_id)) throw invalid('Provide a UUID.', 'client_request_id');
  return {
    nickname: normalize(data.nickname, 24, 'nickname', false),
    body: normalize(data.body, max, 'body'),
    key: data.client_request_id.toLowerCase(),
  };
}

function cursorFor(data) { return btoa(JSON.stringify(data)); }
function readCursor(url, kind) {
  const value = url.searchParams.get('cursor');
  if (!value) return null;
  try {
    if (value.length > 512) throw 0;
    const c = JSON.parse(atob(value));
    if (c.kind !== kind || !Number.isSafeInteger(c.time) || c.time < 0 || !UUID.test(c.id) ||
      (kind === 'popular' && (!Number.isSafeInteger(c.votes) || c.votes < 0))) throw 0;
    return c;
  } catch { throw new ApiError(400, 'invalid_cursor', 'Invalid page cursor.'); }
}

async function listIdeas(env, url, visitor) {
  const sort = url.searchParams.get('sort') || 'popular';
  if (!['popular', 'latest'].includes(sort)) throw invalid('Choose popular or latest.', 'sort');
  const cursor = readCursor(url, sort);
  const params = [visitor?.id || ''];
  let after = '';
  if (cursor) {
    after = sort === 'popular'
      ? 'WHERE vote_count < ? OR (vote_count = ? AND (created_at < ? OR (created_at = ? AND id < ?)))'
      : 'WHERE created_at < ? OR (created_at = ? AND id < ?)';
    if (sort === 'popular') params.push(cursor.votes, cursor.votes);
    params.push(cursor.time, cursor.time, cursor.id);
  }
  const order = sort === 'popular' ? 'vote_count DESC,created_at DESC,id DESC' : 'created_at DESC,id DESC';
  const { results } = await statement(env, `SELECT * FROM (${IDEA_SELECT}) ${after} ORDER BY ${order} LIMIT 21`, ...params).all();
  const page = results.slice(0, 20);
  const last = page.at(-1);
  return { ideas: page.map(publicIdea), next_cursor: results.length > 20 ? cursorFor({ kind: sort, time: last.created_at, id: last.id, ...(sort === 'popular' ? { votes: last.vote_count } : {}) }) : null };
}

async function listComments(env, url, id) {
  await getIdea(env, id);
  const cursor = readCursor(url, 'comments');
  const params = [id];
  let after = '';
  if (cursor) { after = 'AND (c.created_at>? OR (c.created_at=? AND c.id>?))'; params.push(cursor.time, cursor.time, cursor.id); }
  const { results } = await statement(env, `SELECT c.id,c.idea_id,c.nickname,c.body,c.created_at,c.is_operator
    FROM comments c JOIN ideas i ON i.id=c.idea_id
    WHERE c.idea_id=? AND c.hidden=0 AND i.hidden=0 ${after} ORDER BY c.created_at,c.id LIMIT 21`, ...params).all();
  const page = results.slice(0, 20);
  const last = page.at(-1);
  return { comments: page.map(publicComment), next_cursor: results.length > 20 ? cursorFor({ kind: 'comments', time: last.created_at, id: last.id }) : null };
}

async function prepareVisitor(request, env, data, existing) {
  if (existing) return { data: { ready: true } };
  if (!env.TURNSTILE_SECRET || (!isDev(env) && /^[123]x0+AA$/.test(env.TURNSTILE_SECRET))) throw new ApiError(503, 'not_configured', 'Writing is not available yet.');
  if (typeof data.turnstile_token !== 'string' || !data.turnstile_token || data.turnstile_token.length > 2048) throw invalid('Complete verification.', 'turnstile_token');
  let verified;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: data.turnstile_token }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw 0;
    verified = await response.json();
  } catch { throw new ApiError(503, 'verification_unavailable', 'Verification is temporarily unavailable.'); }
  // Official dummy validation currently has example.com and no action. This
  // exception requires development AND the exact public test secret AND the
  // testing marker. It is never accepted by the production environment.
  const dummyLocal = isDev(env) && env.TURNSTILE_SECRET === TEST_SECRET &&
    verified.metadata?.result_with_testing_key === true &&
    verified.hostname === 'example.com' && verified.action === undefined;
  const hostnameValid = verified.hostname === 'www.myanimalroom.com' || (isDev(env) && verified.hostname === '127.0.0.1');
  if (verified.success !== true || (!dummyLocal && (!hostnameValid || verified.action !== 'feedback'))) {
    throw new ApiError(403, 'verification_failed', 'Verification failed. Please try again.');
  }
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('');
  await statement(env, 'INSERT INTO visitors(id,token_hash,expires_at) VALUES(?,?,?)', crypto.randomUUID(), await sha256(token), Date.now() + VISITOR_LIFETIME).run();
  const cookie = `${cookieName(env)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${VISITOR_LIFETIME / 1000}${isDev(env) ? '' : '; Secure'}`;
  return { data: { ready: true }, cookie };
}

async function createContent(env, visitor, data, ideaId) {
  const entry = content(data, ideaId ? 1000 : 2000);
  const now = Date.now();
  const id = crypto.randomUUID();
  const table = ideaId ? 'comments' : 'ideas';
  const limit = ideaId ? 20 : 3;
  // A conditional INSERT and idempotency read share one D1 batch transaction.
  // Concurrent requests therefore cannot pass the same final quota slot.
  const extraFields = ideaId ? ',idea_id' : '';
  const extraSelect = ideaId ? ',?' : '';
  const params = [id, visitor.id, entry.nickname, entry.body, now, entry.key];
  if (ideaId) params.push(ideaId);
  params.push(visitor.id, now, visitor.id, now - DAY, limit);
  const publicParent = ideaId ? 'AND EXISTS(SELECT 1 FROM ideas WHERE id=? AND hidden=0)' : '';
  if (ideaId) params.push(ideaId);
  const batch = await env.DB.batch([
    statement(env, `INSERT INTO ${table}(id,visitor_id,nickname,body,created_at,client_request_id${extraFields})
      SELECT ?,?,?,?,?,?${extraSelect} WHERE EXISTS(SELECT 1 FROM visitors WHERE id=? AND expires_at>?)
      AND (SELECT COUNT(*) FROM ${table} WHERE visitor_id=? AND created_at>?) < ? ${publicParent}
      ON CONFLICT(visitor_id,client_request_id) DO NOTHING RETURNING id`, ...params),
    statement(env, `SELECT * FROM ${table} WHERE visitor_id=? AND client_request_id=?`, visitor.id, entry.key),
    statement(env, `SELECT MIN(created_at) AS oldest FROM ${table} WHERE visitor_id=? AND created_at>?`, visitor.id, now - DAY),
  ]);
  const stored = batch[1].results[0];
  if (ideaId) await getIdea(env, ideaId, visitor.id);
  if (!stored) throw limited(((batch[2].results[0]?.oldest || now) + DAY - now) / 1000);
  if (stored.body !== entry.body || stored.nickname !== entry.nickname || (ideaId && stored.idea_id !== ideaId)) {
    throw new ApiError(409, 'request_conflict', 'This request ID was already used for different content.', 'client_request_id');
  }
  // A moderation action must not be bypassed by replaying a creation request.
  if (stored.hidden) throw missing();
  return {
    status: batch[0].results.length ? 201 : 200,
    data: ideaId ? { comment: publicComment(stored) } : { idea: await getIdea(env, stored.id, visitor.id) },
  };
}

async function setVote(env, visitor, id, data) {
  if (typeof data.voted !== 'boolean') throw invalid('Provide true or false.', 'voted');
  const now = Date.now();
  // changes() belongs to the immediately preceding guarded UPDATE in this
  // same transaction. A denied request never changes its vote row.
  const mutation = data.voted
    ? 'INSERT OR IGNORE INTO votes(idea_id,visitor_id) SELECT ?,? WHERE changes()=1'
    : 'DELETE FROM votes WHERE idea_id=? AND visitor_id=? AND changes()=1';
  const batch = await env.DB.batch([
    statement(env, `UPDATE visitors SET
      vote_request_count=CASE WHEN vote_window_started_at<=? THEN 1 ELSE vote_request_count+1 END,
      vote_window_started_at=CASE WHEN vote_window_started_at<=? THEN ? ELSE vote_window_started_at END
      WHERE id=? AND expires_at>? AND (vote_window_started_at<=? OR vote_request_count<30)
      AND EXISTS(SELECT 1 FROM ideas WHERE id=? AND hidden=0)
      RETURNING vote_request_count,vote_window_started_at`, now - 60_000, now - 60_000, now, visitor.id, now, now - 60_000, id),
    statement(env, mutation, id, visitor.id),
    statement(env, 'SELECT vote_window_started_at FROM visitors WHERE id=?', visitor.id),
    statement(env, `${IDEA_SELECT} AND i.id=?`, visitor.id, id),
  ]);
  if (!batch[3].results[0]) throw missing();
  if (!batch[0].results.length) throw limited(((batch[2].results[0]?.vote_window_started_at || now) + 60_000 - now) / 1000);
  return { idea: publicIdea(batch[3].results[0]) };
}

async function route(request, env) {
  if (!['development', 'production'].includes(env.ENVIRONMENT) || !env.DB) throw new ApiError(503, 'not_configured', 'Service is not configured.');
  const url = new URL(request.url);
  const method = request.method;
  const visitor = await visitorFor(request, env);
  if (method === 'GET') {
    if (url.pathname === '/v1/ideas') return { data: await listIdeas(env, url, visitor) };
    const comments = url.pathname.match(new RegExp(`^/v1/ideas/(${ID})/comments$`));
    if (comments) return { data: await listComments(env, url, comments[1]) };
    const idea = url.pathname.match(new RegExp(`^/v1/ideas/(${ID})$`));
    if (idea) return { data: { idea: await getIdea(env, idea[1], visitor?.id) } };
    throw missing();
  }
  if (method === 'POST' && url.pathname === '/v1/visitor') {
    return prepareVisitor(request, env, await readJson(request, ['turnstile_token']), visitor);
  }
  const comments = url.pathname.match(new RegExp(`^/v1/ideas/(${ID})/comments$`));
  const vote = url.pathname.match(new RegExp(`^/v1/ideas/(${ID})/vote$`));
  const isCreate = method === 'POST' && (url.pathname === '/v1/ideas' || comments);
  if (!isCreate && !(method === 'PUT' && vote)) throw missing();
  const data = await readJson(request, vote ? ['voted'] : ['nickname', 'body', 'client_request_id']);
  if (!visitor) throw new ApiError(401, 'visitor_required', 'Prepare a visitor before writing.');
  if (vote) return { data: await setVote(env, visitor, vote[1], data) };
  return createContent(env, visitor, data, comments?.[1]);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const originAllowed = origin === PRODUCTION_ORIGIN || (isDev(env) && LOCAL_ORIGINS.has(origin));
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
    if (originAllowed) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Expose-Headers', 'Retry-After');
    }
    try {
      if ((origin && !originAllowed) || (!['GET', 'HEAD'].includes(request.method) && !originAllowed)) {
        throw new ApiError(403, 'origin_not_allowed', 'Origin is not allowed.');
      }
      if (request.method === 'OPTIONS') {
        const method = request.headers.get('Access-Control-Request-Method');
        const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
        if (!['GET', 'POST', 'PUT'].includes(method) || requestedHeaders.some((h) => h !== 'content-type')) throw invalid('Unsupported preflight.');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        return new Response(null, { status: 204, headers });
      }
      const result = await route(request, env);
      if (result.cookie) headers.set('Set-Cookie', result.cookie);
      return Response.json(result.data, { status: result.status || 200, headers });
    } catch (error) {
      const known = error instanceof ApiError;
      if (known && error.retryAfter) headers.set('Retry-After', String(error.retryAfter));
      return Response.json({ error: {
        code: known ? error.code : 'internal_error',
        message: known ? error.message : 'Service is temporarily unavailable.',
        ...(known && error.field ? { field: error.field } : {}),
      } }, { status: known ? error.status : 500, headers });
    }
  },
};
