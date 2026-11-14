import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { Miniflare } from 'miniflare';
import worker from '../src/index.js';

const ORIGIN = 'https://www.myanimalroom.com';
const API = 'https://feedback-api.myanimalroom.com';
let mf;
let db;
let usedTokens = new Set();
let verifyCalls = 0;

function runtime(bindings = {}, rateOverrides = {}) {
  return new Miniflare({
    modules: true,
    scriptPath: new URL('../src/index.js', import.meta.url).pathname,
    compatibilityDate: '2026-08-01',
    bindings: { ENVIRONMENT: 'production', TURNSTILE_SECRET: 'integration-test-only', ...bindings },
    d1Databases: ['DB'],
    ratelimits: {
      API_RATE_LIMITER: { namespace_id: '1001', simple: { limit: 600, period: 60 } },
      VISITOR_RATE_LIMITER: { namespace_id: '1002', simple: { limit: 60, period: 60 } },
      HIT_RATE_LIMITER: { namespace_id: '1003', simple: { limit: 100000, period: 60 } },
      HIT_TOTAL_LIMITER: { namespace_id: '1004', simple: { limit: 100000, period: 60 } },
      ...rateOverrides,
    },
    outboundService: async (request) => {
      assert.equal(request.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      const data = await request.json();
      verifyCalls++;
      const token = data.response;
      if (token === 'service-down') return new Response('unavailable', { status: 503 });
      if (token === 'invalid' || usedTokens.has(token)) return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
      usedTokens.add(token);
      if (token === 'dummy') return Response.json({ success: true, hostname: 'example.com', metadata: { result_with_testing_key: true } });
      return Response.json({ success: true, hostname: token === 'bad-host' ? 'evil.example' : 'www.myanimalroom.com', action: token === 'bad-action' ? 'another-action' : 'feedback' });
    },
  });
}
async function migrate(database) {
  const directory = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(file, directory), 'utf8');
    for (const part of sql.split(';').map(s => s.trim()).filter(Boolean)) await database.prepare(part).run();
  }
}
before(async () => { mf = runtime(); db = await mf.getD1Database('DB'); await migrate(db); });
after(async () => { await mf?.dispose(); });
beforeEach(async () => {
  usedTokens = new Set(); verifyCalls = 0;
  await db.batch(['votes', 'comments', 'ideas', 'visitors', 'site_stats'].map((table) => db.prepare(`DELETE FROM ${table}`)));
});
async function req(path, { method = 'GET', data, cookie, origin = ORIGIN, headers = {}, target = mf, rawBody } = {}) {
  const init = { method, headers: { 'CF-Connecting-IP': '203.0.113.8', ...(origin === null ? {} : { Origin: origin }), ...(cookie ? { Cookie: cookie } : {}), ...headers } };
  if (data !== undefined || rawBody !== undefined) {
    init.headers['Content-Type'] ??= 'application/json';
    init.body = rawBody ?? JSON.stringify(data);
  }
  const response = await target.dispatchFetch(`${API}${path}`, init);
  const json = response.status === 204 ? null : await response.json();
  return { response, status: response.status, json, cookie: response.headers.get('Set-Cookie')?.split(';')[0] };
}
async function visitor(target = mf, origin = ORIGIN) {
  const result = await req('/v1/visitor', { method: 'POST', data: { turnstile_token: randomUUID() }, target, origin });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  return result.cookie;
}
function payload(body = 'A feature', nickname) { return { body, ...(nickname === undefined ? {} : { nickname }), client_request_id: randomUUID() }; }
async function idea(cookie, data = payload()) {
  const result = await req('/v1/ideas', { method: 'POST', data, cookie });
  assert.equal(result.status, 201, JSON.stringify(result.json));
  return result.json.idea;
}
async function visitorId(cookie) {
  const hash = createHash('sha256').update(cookie.split('=')[1]).digest('hex');
  return (await db.prepare('SELECT id FROM visitors WHERE token_hash=?').bind(hash).first()).id;
}
const count = async (table) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;
const vote = (id, cookie, voted) => req(`/v1/ideas/${id}/vote`, { method: 'PUT', cookie, data: { voted } });

test('public reads create no visitor or cookie; errors are structured and uncached', async () => {
  const result = await req('/v1/ideas', { origin: null });
  assert.deepEqual(result.json, { ideas: [], next_cursor: null, counts: { all: 0, open: 0, reviewing: 0, planned: 0, completed: 0 } });
  assert.equal(result.response.headers.get('Set-Cookie'), null);
  assert.equal(result.response.headers.get('Cache-Control'), 'no-store');
  assert.equal(await count('visitors'), 0);
  assert.equal((await req('/v1/ideas?sort=body')).status, 400);
  assert.equal((await req('/v1/ideas?cursor=not-a-cursor')).status, 400);
  const unauthorized = await req('/v1/ideas', { method: 'POST', data: payload() });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.json.error.code, 'visitor_required');
  assert.equal(unauthorized.cookie, undefined);
});

test('production Origin, JSON, and credentials CORS fail closed', async () => {
  for (const origin of [null, 'https://evil.example', 'http://127.0.0.1:8765', 'https://myanimalroom.com']) {
    const result = await req('/v1/visitor', { method: 'POST', data: { turnstile_token: randomUUID() }, origin });
    assert.equal(result.status, 403);
    assert.equal(result.response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(await count('visitors'), 0);
  const preflight = await req('/v1/ideas', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(preflight.response.headers.get('Access-Control-Allow-Credentials'), 'true');
  assert.equal(preflight.response.headers.get('Vary'), 'Origin');
  assert.equal(preflight.response.headers.get('Access-Control-Max-Age'), '7200');
  assert.equal((await req('/v1/ideas', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'DELETE' } })).status, 400);
  const cookie = await visitor();
  for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'text/json']) {
    assert.equal((await req('/v1/ideas', { method: 'POST', cookie, data: payload(), headers: { 'Content-Type': type } })).status, 400);
  }
  assert.equal((await req('/v1/ideas', { method: 'POST', cookie, rawBody: '{' })).json.error.code, 'invalid_json');
  assert.equal(await count('ideas'), 0);
});

test('Siteverify failure, reused token, hostname and action never create sessions', async () => {
  for (const token of ['invalid', 'bad-host', 'bad-action', 'dummy']) {
    const result = await req('/v1/visitor', { method: 'POST', data: { turnstile_token: token } });
    assert.equal(result.status, 403);
    assert.equal(result.cookie, undefined);
  }
  assert.equal(await count('visitors'), 0);
  assert.equal((await req('/v1/visitor', { method: 'POST', data: { turnstile_token: 'service-down' } })).status, 503);
  const data = { turnstile_token: 'one-use' };
  const created = await req('/v1/visitor', { method: 'POST', data });
  assert.equal(created.status, 200);
  const header = created.response.headers.get('Set-Cookie');
  for (const attribute of ['__Host-feedback=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=7776000']) assert.ok(header.includes(attribute));
  assert.ok(!header.includes('Domain='));
  assert.equal((await req('/v1/visitor', { method: 'POST', data })).status, 403);
  const calls = verifyCalls;
  const existing = await req('/v1/visitor', { method: 'POST', data: {}, cookie: created.cookie });
  assert.deepEqual(existing.json, { ready: true });
  assert.equal(existing.cookie, undefined);
  assert.equal(verifyCalls, calls);
  const stored = await db.prepare('SELECT * FROM visitors').first();
  assert.notEqual(stored.token_hash, created.cookie.split('=')[1]);
  assert.equal(await count('visitors'), 1);
});

test('official dummy exception only exists in explicit development configuration', async () => {
  const secret = '1x0000000000000000000000000000000AA';
  for (const mode of ['production', 'development']) {
    const local = runtime({ ENVIRONMENT: mode, TURNSTILE_SECRET: secret });
    try {
      await migrate(await local.getD1Database('DB'));
      const result = await req('/v1/visitor', { target: local, method: 'POST', data: { turnstile_token: 'dummy' }, origin: mode === 'development' ? 'http://127.0.0.1:8765' : ORIGIN });
      assert.equal(result.status, mode === 'development' ? 200 : 503);
      if (mode === 'development') {
        assert.ok(result.cookie.startsWith('feedback_dev='));
        assert.ok(!result.response.headers.get('Set-Cookie').includes('Secure'));
      }
    } finally { await local.dispose(); }
  }
});

test('forged and expired cookies cannot write or vote', async () => {
  const cookie = await visitor();
  const item = await idea(cookie);
  await db.prepare('UPDATE visitors SET expires_at=?').bind(Date.now() - 1).run();
  for (const badCookie of [cookie, '__Host-feedback=forged', `__Host-feedback=${'a'.repeat(64)}`]) {
    const result = await req('/v1/ideas', { method: 'POST', cookie: badCookie, data: payload() });
    assert.equal(result.status, 401);
    assert.equal(result.cookie, undefined);
    assert.equal((await vote(item.id, badCookie, true)).status, 401);
  }
  assert.equal(await count('ideas'), 1);
  assert.equal(await count('votes'), 0);
});

test('Unicode normalization, codepoint limits, bounded body, plaintext and private fields', async () => {
  const cookie = await visitor();
  const result = await idea(cookie, payload(' \r\ne\u0301 <script>alert(1)</script> &amp;\r\n ', ' 🐾 '));
  assert.equal(result.body, 'é <script>alert(1)</script> &amp;');
  assert.equal(result.nickname, '🐾');
  assert.match(result.created_at, /^\d{4}-.*Z$/);
  assert.deepEqual(Object.keys(result).sort(), ['body', 'comment_count', 'created_at', 'id', 'nickname', 'operator_reply', 'status', 'vote_count', 'voted']);
  await idea(cookie, payload('🐾'.repeat(2000), '🐾'.repeat(24)));
  for (const data of [payload('🐾'.repeat(2001)), payload('body', '🐾'.repeat(25)), payload(' \n\t '), payload('\u0000'), payload('\uD800'), { ...payload(), hidden: false }, { ...payload(), is_operator: true }, { ...payload(), visitor_id: 'x' }, { ...payload(), vote_count: 100 }, { ...payload(), created_at: 1 }]) {
    assert.equal((await req('/v1/ideas', { method: 'POST', cookie, data })).status, 400);
  }
  const huge = await req('/v1/ideas', { method: 'POST', cookie, rawBody: JSON.stringify(payload('x'.repeat(17_000))) });
  assert.equal(huge.status, 400);
  assert.equal(huge.json.error.code, 'body_too_large');
  assert.equal(await count('ideas'), 2);
});

test('streamed body limits do not depend on Content-Length; invalid UTF-8 is rejected', async () => {
  const cookie = await visitor();
  const result = await mf.dispatchFetch(`${API}/v1/ideas`, {
    method: 'POST', headers: { Origin: ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
    body: new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"body":"'));
      controller.enqueue(new Uint8Array(16_385).fill(120));
      controller.close();
    } }), duplex: 'half',
  });
  assert.equal(result.status, 400);
  assert.equal((await result.json()).error.code, 'body_too_large');
  const badUtf8 = await mf.dispatchFetch(`${API}/v1/ideas`, {
    method: 'POST', headers: { Origin: ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' }, body: new Uint8Array([0xff]),
  });
  assert.equal(badUtf8.status, 400);
  assert.equal((await badUtf8.json()).error.code, 'invalid_json');
  assert.equal(await count('ideas'), 0);
});

test('idea retries are idempotent and atomic quota admissions stay at 3 per rolling day', async () => {
  const cookie = await visitor();
  const data = payload(' same ');
  const retries = await Promise.all(Array.from({ length: 10 }, () => req('/v1/ideas', { method: 'POST', cookie, data })));
  assert.deepEqual(retries.map((r) => r.status).sort(), [200, 200, 200, 200, 200, 200, 200, 200, 200, 201]);
  assert.equal(new Set(retries.map((r) => r.json.idea.id)).size, 1);
  assert.equal((await req('/v1/ideas', { method: 'POST', cookie, data: { ...data, body: 'different' } })).status, 409);
  await idea(cookie);
  const boundary = await Promise.all([1, 2].map(() => req('/v1/ideas', { method: 'POST', cookie, data: payload() })));
  assert.deepEqual(boundary.map((r) => r.status).sort(), [201, 429]);
  const rejected = boundary.find((r) => r.status === 429);
  assert.ok(Number(rejected.response.headers.get('Retry-After')) > 0);
  assert.equal(rejected.response.headers.get('Access-Control-Expose-Headers'), 'Retry-After');
  assert.equal(await count('ideas'), 3);
  // Existing same-content retry remains permitted at quota; hidden rows count too.
  assert.equal((await req('/v1/ideas', { method: 'POST', cookie, data })).status, 200);
  await db.prepare('UPDATE ideas SET hidden=1').run();
  assert.equal((await req('/v1/ideas', { method: 'POST', cookie, data: payload() })).status, 429);
  await db.prepare('UPDATE ideas SET created_at=?').bind(Date.now() - 86_400_001).run();
  assert.equal((await req('/v1/ideas', { method: 'POST', cookie, data: payload() })).status, 201);
});

test('comments are one level, idempotent across parents, limited atomically at 20', async () => {
  const cookie = await visitor();
  const first = await idea(cookie);
  const second = await idea(cookie);
  const path = `/v1/ideas/${first.id}/comments`;
  const data = payload('A comment');
  const retries = await Promise.all(Array.from({ length: 8 }, () => req(path, { method: 'POST', cookie, data })));
  assert.equal(retries.filter((r) => r.status === 201).length, 1);
  assert.equal(retries.filter((r) => r.status === 200).length, 7);
  assert.equal((await req(path, { method: 'POST', cookie, data: { ...data, body: 'conflict' } })).status, 409);
  assert.equal((await req(`/v1/ideas/${second.id}/comments`, { method: 'POST', cookie, data })).status, 409);
  for (const bad of [payload('x'.repeat(1001)), { ...payload(), parent_id: randomUUID() }, { ...payload(), is_operator: true }]) assert.equal((await req(path, { method: 'POST', cookie, data: bad })).status, 400);
  const visitorID = await visitorId(cookie);
  for (let n = 0; n < 18; n++) await db.prepare('INSERT INTO comments(id,idea_id,visitor_id,body,created_at,client_request_id) VALUES(?,?,?,?,?,?)').bind(randomUUID(), first.id, visitorID, 'seed quota', Date.now(), randomUUID()).run();
  const boundary = await Promise.all([1, 2].map(() => req(path, { method: 'POST', cookie, data: payload('last slot') })));
  assert.deepEqual(boundary.map((r) => r.status).sort(), [201, 429]);
  assert.equal(await count('comments'), 20);
  assert.equal((await req(path, { method: 'POST', cookie, data })).status, 200);
});

test('20 simultaneous desired-state votes create one row; visitors remain independent', async () => {
  const cookie = await visitor();
  const item = await idea(cookie);
  const results = await Promise.all(Array.from({ length: 20 }, () => vote(item.id, cookie, true)));
  assert.ok(results.every((r) => r.status === 200 && r.json.idea.vote_count === 1 && r.json.idea.voted));
  assert.equal(await count('votes'), 1);
  const other = await visitor();
  assert.equal((await vote(item.id, other, true)).json.idea.vote_count, 2);
  assert.equal((await vote(item.id, cookie, false)).json.idea.vote_count, 1);
  assert.equal((await vote(item.id, cookie, false)).json.idea.vote_count, 1);
  const stored = await db.prepare('SELECT vote_request_count FROM visitors WHERE id=?').bind(await visitorId(cookie)).first();
  assert.equal(stored.vote_request_count, 22);
  assert.equal((await req(`/v1/ideas/${item.id}`, { cookie })).json.idea.voted, false);
  assert.equal((await req(`/v1/ideas/${item.id}`, { cookie: other })).json.idea.voted, true);
});

test('vote request 29→30 boundary admits exactly one, no-op retries count; reset happens once', async () => {
  const cookie = await visitor();
  const item = await idea(cookie);
  const visitorID = await visitorId(cookie);
  await db.prepare('UPDATE visitors SET vote_window_started_at=?,vote_request_count=29 WHERE id=?').bind(Date.now(), visitorID).run();
  const results = await Promise.all([vote(item.id, cookie, true), vote(item.id, cookie, false)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 429]);
  const accepted = results.find((r) => r.status === 200);
  const actual = (await req(`/v1/ideas/${item.id}`, { cookie })).json.idea;
  assert.equal(actual.voted, accepted.json.idea.voted);
  assert.equal(actual.vote_count, accepted.json.idea.vote_count);
  const denied = await vote(item.id, cookie, !actual.voted);
  assert.equal(denied.status, 429);
  assert.ok(Number(denied.response.headers.get('Retry-After')) <= 60);
  assert.equal((await req(`/v1/ideas/${item.id}`, { cookie })).json.idea.voted, actual.voted);
  await db.prepare('UPDATE visitors SET vote_window_started_at=? WHERE id=?').bind(Date.now() - 60_001, visitorID).run();
  const reset = await Promise.all([vote(item.id, cookie, false), vote(item.id, cookie, false)]);
  assert.ok(reset.every((r) => r.status === 200));
  const row = await db.prepare('SELECT vote_request_count,vote_window_started_at FROM visitors WHERE id=?').bind(visitorID).first();
  assert.equal(row.vote_request_count, 2);
  assert.ok(row.vote_window_started_at > Date.now() - 1000);
  assert.equal(await count('votes'), 0);
  const flood = await Promise.all(Array.from({ length: 31 }, () => vote(item.id, cookie, true)));
  assert.equal(flood.filter((r) => r.status === 200).length, 28);
  assert.equal(flood.filter((r) => r.status === 429).length, 3);
  assert.equal(await count('votes'), 1);
});

test('a failed vote mutation rolls back its admitted counter in the real D1 transaction', async () => {
  const cookie = await visitor();
  const item = await idea(cookie);
  await db.prepare("CREATE TRIGGER fail_vote BEFORE INSERT ON votes BEGIN SELECT RAISE(ABORT, 'injected private SQL detail'); END").run();
  try {
    const result = await vote(item.id, cookie, true);
    assert.equal(result.status, 500);
    assert.deepEqual(result.json, { error: { code: 'internal_error', message: 'Service is temporarily unavailable.' } });
    const row = await db.prepare('SELECT vote_request_count,vote_window_started_at FROM visitors').first();
    assert.equal(row.vote_request_count, 0);
    assert.equal(row.vote_window_started_at, 0);
    assert.equal(await count('votes'), 0);
  } finally { await db.prepare('DROP TRIGGER fail_vote').run(); }
});

test('moderation hides IDs, children and counts, including idempotent replays', async () => {
  const cookie = await visitor();
  const data = payload();
  const item = await idea(cookie, data);
  const commentData = payload('public comment');
  const created = await req(`/v1/ideas/${item.id}/comments`, { method: 'POST', cookie, data: commentData });
  await db.prepare('UPDATE comments SET hidden=1 WHERE id=?').bind(created.json.comment.id).run();
  const opId = randomUUID();
  await db.prepare('INSERT INTO comments(id,idea_id,nickname,body,created_at,is_operator,client_request_id) VALUES(?,?,?,?,?,1,?)').bind(opId, item.id, 'MyAnimalRoom', 'Operator reply', Date.now(), randomUUID()).run();
  const list = await req(`/v1/ideas/${item.id}/comments`);
  assert.equal(list.json.comments.length, 1);
  assert.equal(list.json.comments[0].is_operator, true);
  assert.deepEqual(Object.keys(list.json.comments[0]).sort(), ['body', 'created_at', 'id', 'idea_id', 'is_operator', 'nickname']);
  assert.equal((await req(`/v1/ideas/${item.id}`)).json.idea.comment_count, 1);
  assert.equal((await req(`/v1/ideas/${item.id}`)).json.idea.operator_reply.body, 'Operator reply');
  assert.equal((await req(`/v1/ideas/${item.id}/comments`, { method: 'POST', cookie, data: commentData })).status, 404);
  await db.prepare('UPDATE ideas SET hidden=1 WHERE id=?').bind(item.id).run();
  assert.equal((await req('/v1/ideas')).json.ideas.length, 0);
  assert.equal((await req(`/v1/ideas/${item.id}`)).status, 404);
  assert.equal((await req(`/v1/ideas/${item.id}/comments`)).status, 404);
  assert.equal((await req(`/v1/ideas/${item.id}/comments`, { method: 'POST', cookie, data: payload() })).status, 404);
  assert.equal((await req('/v1/ideas', { method: 'POST', cookie, data })).status, 404);
  assert.equal((await vote(item.id, cookie, true)).status, 404);
  assert.equal(await count('votes'), 0);
  assert.equal(await count('comments'), 2);
});

test('keyset pagination for latest/popular/comments returns each of 23 rows exactly once', async () => {
  const cookie = await visitor();
  const visitorID = await visitorId(cookie);
  const ids = [];
  const timestamp = Date.now();
  for (let i = 0; i < 23; i++) {
    const id = randomUUID(); ids.push(id);
    await db.prepare('INSERT INTO ideas(id,visitor_id,body,created_at,client_request_id) VALUES(?,?,?,?,?)').bind(id, visitorID, `idea ${i}`, timestamp, randomUUID()).run();
    if (i < 3) await db.prepare('INSERT INTO votes(idea_id,visitor_id) VALUES(?,?)').bind(id, visitorID).run();
    await db.prepare('INSERT INTO comments(id,idea_id,visitor_id,body,created_at,client_request_id) VALUES(?,?,?,?,?,?)').bind(randomUUID(), ids[0], visitorID, `comment ${i}`, timestamp, randomUUID()).run();
  }
  for (const sort of ['popular', 'latest']) {
    const first = await req(`/v1/ideas?sort=${sort}`);
    assert.equal(first.json.ideas.length, 20);
    if (sort === 'popular') assert.ok(first.json.ideas.slice(0, 3).every((i) => i.vote_count === 1));
    const second = await req(`/v1/ideas?sort=${sort}&cursor=${encodeURIComponent(first.json.next_cursor)}`);
    assert.equal(second.json.ideas.length, 3);
    assert.equal(second.json.next_cursor, null);
    assert.equal(new Set([...first.json.ideas, ...second.json.ideas].map((i) => i.id)).size, 23);
    assert.equal((await req(`/v1/ideas?sort=${sort === 'popular' ? 'latest' : 'popular'}&cursor=${encodeURIComponent(first.json.next_cursor)}`)).status, 400);
  }
  const first = await req(`/v1/ideas/${ids[0]}/comments`);
  const second = await req(`/v1/ideas/${ids[0]}/comments?cursor=${encodeURIComponent(first.json.next_cursor)}`);
  assert.equal(first.json.comments.length, 20);
  assert.equal(second.json.comments.length, 3);
  assert.equal(new Set([...first.json.comments, ...second.json.comments].map((c) => c.id)).size, 23);
});

test('expired hash cleanup preserves votes; explicit visitor/idea deletion cascades correctly', async () => {
  const cookie = await visitor();
  const item = await idea(cookie);
  await req(`/v1/ideas/${item.id}/comments`, { method: 'POST', cookie, data: payload() });
  await vote(item.id, cookie, true);
  const visitorID = await visitorId(cookie);
  await db.prepare('UPDATE visitors SET expires_at=?,token_hash=NULL WHERE id=?').bind(Date.now() - 1, visitorID).run();
  assert.equal(await count('votes'), 1);
  assert.equal((await vote(item.id, cookie, false)).status, 401);
  await db.prepare('DELETE FROM visitors WHERE id=?').bind(visitorID).run();
  assert.equal(await count('ideas'), 1);
  assert.equal(await count('comments'), 1);
  assert.equal(await count('votes'), 0);
  assert.equal((await db.prepare('SELECT visitor_id FROM ideas').first()).visitor_id, null);
  await db.prepare('DELETE FROM ideas WHERE id=?').bind(item.id).run();
  assert.equal(await count('comments'), 0);
});


test('only operator-maintained status is exposed on list, detail and vote responses', async () => {
  const cookie = await visitor(), created = await idea(cookie);
  assert.equal(created.status, 'open');
  assert.equal((await req('/v1/ideas', {method:'POST',cookie,data:{...payload(),status:'completed'}})).status,400);
  for (const state of ['reviewing','planned','completed']) {
    await db.prepare('UPDATE ideas SET status=? WHERE id=?').bind(state,created.id).run();
    assert.equal((await req(`/v1/ideas/${created.id}`)).json.idea.status,state);
    assert.equal((await req('/v1/ideas')).json.ideas[0].status,state);
    assert.equal((await vote(created.id,cookie,true)).json.idea.status,state);
  }
  await assert.rejects(db.prepare("UPDATE ideas SET status='unknown' WHERE id=?").bind(created.id).run());
  assert.equal((await req(`/v1/ideas/${created.id}`,{method:'PATCH',cookie,data:{status:'open'}})).status,404);
});

test('status filter lists only the requested operator status, scopes cursors and reports public counts', async () => {
  const cookie = await visitor();
  const visitorID = await visitorId(cookie);
  const timestamp = Date.now();
  const insert = async (status, hidden, offset) => {
    const id = randomUUID();
    await db.prepare('INSERT INTO ideas(id,visitor_id,body,created_at,client_request_id,status,hidden) VALUES(?,?,?,?,?,?,?)')
      .bind(id, visitorID, `${status} ${offset}`, timestamp - offset, randomUUID(), status, hidden).run();
    return id;
  };
  for (let i = 0; i < 21; i++) await insert('completed', 0, i);
  const planned = await insert('planned', 0, 30);
  await insert('open', 0, 31);
  const hiddenId = await insert('completed', 1, 32);

  const first = await req('/v1/ideas?status=completed');
  assert.equal(first.status, 200);
  assert.equal(first.json.ideas.length, 20);
  assert.ok(first.json.ideas.every((i) => i.status === 'completed'));
  assert.ok(first.json.next_cursor);
  assert.deepEqual(first.json.counts, { all: 23, open: 1, reviewing: 0, planned: 1, completed: 21 });
  const second = await req(`/v1/ideas?status=completed&cursor=${encodeURIComponent(first.json.next_cursor)}`);
  assert.equal(second.status, 200);
  assert.equal(second.json.ideas.length, 1);
  assert.equal(second.json.next_cursor, null);
  assert.ok(!('counts' in second.json));
  const union = [...first.json.ideas, ...second.json.ideas].map((i) => i.id);
  assert.equal(new Set(union).size, 21);
  assert.ok(!union.includes(hiddenId));

  const latest = await req('/v1/ideas?status=planned&sort=latest');
  assert.deepEqual(latest.json.ideas.map((i) => i.id), [planned]);
  assert.equal(latest.json.counts.completed, 21);  // counts ignore the filter

  for (const query of ['status=unknown', 'status=', 'status=COMPLETED']) {
    const bad = await req(`/v1/ideas?${query}`);
    assert.equal(bad.status, 400, query);
    assert.equal(bad.json.error.field, 'status');
  }
  const cursor = encodeURIComponent(first.json.next_cursor);
  for (const query of [`cursor=${cursor}`, `status=planned&cursor=${cursor}`, `sort=latest&status=completed&cursor=${cursor}`]) {
    const bad = await req(`/v1/ideas?${query}`);
    assert.equal(bad.status, 400, query);
    assert.equal(bad.json.error.code, 'invalid_cursor');
  }
  // An unfiltered cursor is not valid under a filter, and still works unfiltered.
  const all = await req('/v1/ideas?sort=latest');
  assert.equal(all.json.ideas.length, 20);
  assert.equal((await req(`/v1/ideas?sort=latest&status=completed&cursor=${encodeURIComponent(all.json.next_cursor)}`)).json.error.code, 'invalid_cursor');
  const rest = await req(`/v1/ideas?sort=latest&cursor=${encodeURIComponent(all.json.next_cursor)}`);
  assert.equal(rest.status, 200);
  assert.equal(rest.json.ideas.length, 3);
});

test('idea responses carry only the latest public operator reply', async () => {
  const cookie = await visitor();
  const item = await idea(cookie);
  const replyOf = async () => (await req(`/v1/ideas/${item.id}`)).json.idea.operator_reply;
  assert.equal(item.operator_reply, null);
  assert.equal((await req('/v1/ideas')).json.ideas[0].operator_reply, null);
  assert.equal((await vote(item.id, cookie, true)).json.idea.operator_reply, null);
  assert.equal(await replyOf(), null);
  await req(`/v1/ideas/${item.id}/comments`, { method: 'POST', cookie, data: payload('visitor comment') });
  assert.equal(await replyOf(), null);

  const now = Date.now();
  const insertReply = async (body, at) => {
    const id = randomUUID();
    await db.prepare('INSERT INTO comments(id,idea_id,nickname,body,created_at,is_operator,client_request_id) VALUES(?,?,?,?,?,1,?)')
      .bind(id, item.id, 'Operator', body, at, randomUUID()).run();
    return id;
  };
  const a = await insertReply('Reply A', now);
  const b = await insertReply('Reply B', now + 1);
  assert.equal((await replyOf()).body, 'Reply B');
  assert.deepEqual(Object.keys(await replyOf()).sort(), ['body', 'created_at', 'id']);
  assert.match((await replyOf()).created_at, /^\d{4}-.*Z$/);
  for (const response of [(await req('/v1/ideas')).json.ideas[0], (await vote(item.id, cookie, false)).json.idea]) {
    assert.equal(response.operator_reply.id, b);
  }
  await db.prepare('UPDATE comments SET hidden=1 WHERE id=?').bind(b).run();
  assert.equal((await replyOf()).id, a);
  await db.prepare('UPDATE comments SET hidden=1 WHERE id=?').bind(a).run();
  assert.equal(await replyOf(), null);
  await db.prepare('UPDATE comments SET hidden=0 WHERE id=?').bind(a).run();
  await db.prepare('UPDATE ideas SET hidden=1 WHERE id=?').bind(item.id).run();
  assert.equal((await req(`/v1/ideas/${item.id}`)).status, 404);
  assert.equal((await req('/v1/ideas')).json.ideas.length, 0);
  assert.equal((await vote(item.id, cookie, true)).status, 404);
});

test('migration 0003 creates the status and operator reply indexes', async () => {
  const names = (await db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all()).results.map((r) => r.name);
  assert.ok(names.includes('ideas_public_status_created'));
  assert.ok(names.includes('comments_operator_latest'));
});

test('site hits: counted per day, page and source without cookies; bad values fold into other', async () => {
  const hit = (data, opts = {}) => req('/v1/hit', { method: 'POST', rawBody: JSON.stringify(data), headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, ...opts });
  assert.equal((await hit({ kind: 'visit', page: '/ko/', source: 'instagram', campaign: 'ig-bio' })).status, 200);
  assert.equal((await hit({ kind: 'visit', page: '/ko/', source: 'Instagram', campaign: 'ig-bio' })).status, 200);
  const click = await hit({ kind: 'store', store: 'play', page: '/ko/', source: 'instagram', campaign: 'ig-bio' });
  assert.equal(click.status, 200);
  assert.equal(click.cookie, undefined, 'no cookie');
  assert.equal((await hit({ kind: 'visit', page: '/<script>', source: 'a b' })).status, 200);
  const rows = (await db.prepare('SELECT kind, page, source, campaign, store, count FROM site_stats ORDER BY kind, page, source').all()).results;
  assert.deepEqual(rows.map(r => ({ ...r })), [
    { kind: 'store', page: '/ko/', source: 'instagram', campaign: 'ig-bio', store: 'play', count: 1 },
    { kind: 'visit', page: '/ko/', source: 'instagram', campaign: 'ig-bio', store: '', count: 2 },
    { kind: 'visit', page: 'other', source: 'other', campaign: '', store: '', count: 1 },
  ]);
  assert.equal((await hit({ kind: 'store', page: '/ko/' })).status, 400, 'store click needs a store');
  assert.equal((await hit({ kind: 'visit', store: 'app' })).status, 400, 'visit has no store');
  assert.equal((await hit({ kind: 'nope' })).status, 400);
  assert.equal((await hit({ kind: 'visit' }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await hit({ kind: 'visit' }, { origin: null })).status, 403);
  const defaults = (await db.prepare("SELECT source, campaign FROM site_stats WHERE page = 'other' AND source != 'other'").all()).results;
  assert.deepEqual(defaults, [], 'rejected hits write nothing');
});

test('site hit body is bounded by bytes, including streams and malformed UTF-8', async () => {
  for (const body of ['x'.repeat(1025), JSON.stringify({kind: 'visit', source: '한'.repeat(800)})]) {
    const result = await req('/v1/hit', {method: 'POST', rawBody: body, headers: {'Content-Type': 'text/plain'}});
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'body_too_large');
  }
  const streamed = await mf.dispatchFetch(`${API}/v1/hit`, {
    method: 'POST', headers: {Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.8', 'Content-Type': 'text/plain'},
    body: new ReadableStream({start(controller) {controller.enqueue(new Uint8Array(1025)); controller.close();}}), duplex: 'half',
  });
  assert.equal((await streamed.json()).error.code, 'body_too_large');
  const utf8 = await req('/v1/hit', {method: 'POST', rawBody: new Uint8Array([0xff])});
  assert.equal(utf8.json.error.code, 'invalid_json');
  const field = await req('/v1/hit', {method: 'POST', data: {kind: 'visit', arbitrary: 'value'}});
  assert.equal(field.status, 400);
  assert.equal(await count('site_stats'), 0);
});

test('stat routes are finite; daily row cap admits existing counters but no new dimensions', async () => {
  const hit = data => req('/v1/hit', {method: 'POST', data: {kind: 'visit', ...data}});
  for (const page of ['/ko/', '/pt-br/feedback/', '/zh-hant/news/', '/privacy/']) {
    assert.equal((await hit({page})).status, 200);
  }
  for (const page of ['/arbitrary-path/', '/ko/not-a-page/', '/new-language/feedback/']) await hit({page});
  assert.equal((await db.prepare("SELECT count FROM site_stats WHERE page='other'").first()).count, 3);
  const day = (await db.prepare('SELECT day FROM site_stats LIMIT 1').first()).day;
  // Seed locally in one SQL statement; no HTTP flood or production database involved.
  await db.prepare(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<1995)
    INSERT INTO site_stats(day,kind,page,source,campaign,store,count)
    SELECT ?, 'visit', '/ko/', 'fixture', 'campaign-'||i, '', 1 FROM n`).bind(day).run();
  assert.equal(await count('site_stats'), 2000);
  await hit({page: '/ko/', source: 'new-dimension'});
  assert.equal(await count('site_stats'), 2000);
  await hit({page: '/ko/'});
  assert.equal((await db.prepare("SELECT count FROM site_stats WHERE page='/ko/' AND source='direct'").first()).count, 2);
});

test('edge limit failures preserve the board; rejected analytics never touch D1', async () => {
  const neverDB = {prepare() {assert.fail('limited requests must not touch D1');}};
  const request = path => new Request(API + path, {method: 'POST', headers: {Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.8', 'Content-Type': 'application/json'}, body: JSON.stringify({kind: 'visit'})});
  for (const limiter of [undefined, {limit: async () => ({success: false})}, {limit: async () => {throw Error('unavailable');}}]) {
    const response = await worker.fetch(request('/v1/hit'), {ENVIRONMENT: 'production', DB: neverDB, HIT_RATE_LIMITER: limiter});
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {ok: true});
  }
  const limited = await worker.fetch(request('/v1/ideas'), {ENVIRONMENT: 'production', DB: neverDB, API_RATE_LIMITER: {limit: async () => ({success: false})}});
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  const unavailable = await worker.fetch(request('/v1/ideas'), {ENVIRONMENT: 'production', DB: neverDB, API_RATE_LIMITER: {limit: async () => {throw Error('unavailable');}}});
  assert.equal(unavailable.status, 400, 'normal input validation still runs when the edge limiter is unavailable');
});

test('edge keys never expose raw IP and preflight bypasses the limiter', async () => {
  const keys = [];
  const env = {ENVIRONMENT: 'production', DB: {}, API_RATE_LIMITER: {limit: async ({key}) => {keys.push(key); return {success: false};}}};
  const request = (method, ip) => new Request(API + '/v1/ideas', {method, headers: {Origin: ORIGIN, 'CF-Connecting-IP': ip, 'Access-Control-Request-Method': 'POST'}});
  assert.equal((await worker.fetch(request('OPTIONS', '203.0.113.8'), env)).status, 204);
  assert.equal(keys.length, 0);
  for (const ip of ['203.0.113.8', '203.0.113.8', '203.0.113.9']) assert.equal((await worker.fetch(request('GET', ip), env)).status, 429);
  keys.forEach(key => assert.match(key, /^[0-9a-f]{64}$/));
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[0], keys[2]);
});

test('real edge bindings enforce their budget while ordinary shared-network browsing has headroom', async () => {
  const local = runtime({}, {HIT_RATE_LIMITER: {namespace_id: '1003', simple: {limit: 2, period: 60}}});
  try {
    const database = await local.getD1Database('DB'); await migrate(database);
    const browsing = await Promise.all(Array.from({length: 50}, () => req('/v1/ideas', {target: local})));
    assert.ok(browsing.every(result => result.status === 200));
    const hit = () => req('/v1/hit', {target: local, method: 'POST', data: {kind: 'visit', page: '/ko/'}});
    assert.equal((await hit()).status, 200);
    assert.equal((await hit()).status, 200);
    assert.equal((await hit()).status, 202);
    assert.equal((await database.prepare('SELECT count FROM site_stats').first()).count, 2);
    assert.equal((await req('/v1/ideas', {target: local})).status, 200, 'analytics cannot block the board');
    assert.ok(await visitor(local), 'normal verification still works after a browsing burst');
  } finally {await local.dispose();}
  const restricted = runtime({}, {API_RATE_LIMITER: {namespace_id: '1001', simple: {limit: 2, period: 60}}});
  try {
    await migrate(await restricted.getD1Database('DB'));
    assert.equal((await req('/v1/ideas', {target: restricted})).status, 200);
    assert.equal((await req('/v1/ideas', {target: restricted})).status, 200);
    assert.equal((await req('/v1/ideas', {target: restricted})).status, 429);
    assert.equal((await req('/v1/ideas', {target: restricted, headers: {'CF-Connecting-IP': '203.0.113.9'}})).status, 200);
  } finally {await restricted.dispose();}
});
