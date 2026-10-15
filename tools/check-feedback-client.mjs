import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FeedbackError, normalizeText, validateDraft, createDraftRequest, createClient,
} from '../docs/assets/feedback/client.mjs';

const baseUrl = 'http://127.0.0.1:8789';
const featurePath = '/v1/ideas';
const response = (value, status = 200, headers) => Response.json(value, {status, headers});
const visitorRequired = () => response({error: {code: 'visitor_required'}}, 401);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const errorMatches = (code, status, field) => error => {
  assert.ok(error instanceof FeedbackError);
  assert.equal(error.code, code);
  assert.equal(error.status, status);
  if (field !== undefined) assert.equal(error.field, field);
  return true;
};

test('text normalization composes NFC, normalizes newlines, trims only outside', () => {
  assert.equal(normalizeText(' \r\ne\u0301\r\nA\rB  C\tD \n'), 'é\nA\nB  C\tD');
  assert.deepEqual(validateDraft({body: '\t  e\u0301  ', nickname: ' 🐾 '}, 2000), {body: 'é', nickname: '🐾'});
  assert.deepEqual(validateDraft({body: 'Idea'}, 2000), {body: 'Idea', nickname: ''});
  // Content remains plaintext; the DOM renderer is responsible for textContent.
  const html = '<script>alert(1)</script> &amp; <svg onload="alert(2)">';
  assert.equal(validateDraft({body: html}, 2000).body, html);
});

test('nickname, feature and comment limits count Unicode codepoints after normalization', () => {
  const nickname = '🐾'.repeat(24);
  for (const limit of [1000, 2000]) {
    assert.equal([...validateDraft({nickname, body: '🐾'.repeat(limit)}, limit).body].length, limit);
    assert.equal([...validateDraft({body: 'e\u0301'.repeat(limit)}, limit).body].length, limit);
    assert.throws(() => validateDraft({body: '🐾'.repeat(limit + 1)}, limit), errorMatches('body_length', 400, 'body'));
  }
  assert.throws(() => validateDraft({nickname: nickname + '🐾', body: 'Idea'}, 2000), errorMatches('nickname_length', 400, 'nickname'));
  for (const body of ['', ' \t\r\n\u2003 ']) assert.throws(() => validateDraft({body}, 2000), errorMatches('body_length', 400, 'body'));
  assert.equal(validateDraft({body: 'e\u0301'}, 1).body, 'é');
});

test('normalized same-content retries retain UUID; editing body or nickname issues a new UUID', () => {
  let serial = 0;
  const makeRequest = createDraftRequest(() => `request-${++serial}`);
  const normalized = raw => makeRequest(validateDraft(raw, 2000));
  const first = normalized({nickname: ' e\u0301 ', body: ' First\r\nidea '});
  const retry = normalized({nickname: 'é', body: 'First\nidea'});
  assert.equal(first.client_request_id, 'request-1');
  assert.deepEqual(retry, first);
  const bodyEdit = normalized({nickname: 'é', body: 'Second idea'});
  assert.equal(bodyEdit.client_request_id, 'request-2');
  const nicknameEdit = normalized({nickname: 'Other', body: 'Second idea'});
  assert.equal(nicknameEdit.client_request_id, 'request-3');
  const reverted = normalized({nickname: 'é', body: 'First\nidea'});
  assert.equal(reverted.client_request_id, 'request-4');
  assert.equal(first.body, 'First\nidea');
  assert.equal(first.client_request_id, 'request-1');
  assert.equal(serial, 4);
});

test('first write verifies lazily after 401, prepares cookie, retries exact path/method/payload once', async () => {
  const events = [];
  const requests = [];
  const host = {id: 'active-composer'};
  const data = Object.freeze({nickname: '', body: 'Feature', client_request_id: 'fixed-request-uuid'});
  const client = createClient({
    baseUrl,
    verify: async challengeHost => { assert.strictEqual(challengeHost, host); events.push('verify'); return 'widget-token'; },
    fetcher: async (url, options) => {
      requests.push({url, options});
      if (url.endsWith('/visitor')) {
        events.push('prepare');
        assert.deepEqual(JSON.parse(options.body), {turnstile_token: 'widget-token'});
        assert.equal(options.method, 'POST');
        return response({ready: true});
      }
      events.push(requests.length === 1 ? 'first-write' : 'retry-write');
      return requests.length === 1 ? visitorRequired() : response({idea: {id: 'created'}}, 201);
    },
  });
  assert.deepEqual(events, []);
  assert.deepEqual(await client.write(featurePath, 'POST', data, host), {idea: {id: 'created'}});
  assert.deepEqual(events, ['first-write', 'verify', 'prepare', 'retry-write']);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, baseUrl + featurePath);
  assert.equal(requests[1].url, baseUrl + '/v1/visitor');
  assert.deepEqual(requests[2], requests[0]);
  for (const {options} of requests) {
    assert.equal(options.credentials, 'include');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers['Content-Type'], 'application/json');
  }
  assert.deepEqual(data, {nickname: '', body: 'Feature', client_request_id: 'fixed-request-uuid'});
});

test('existing visitor writes directly without loading verification or preparing a visitor', async () => {
  let calls = 0;
  const client = createClient({baseUrl,
    verify: async () => assert.fail('Existing visitor must not verify'),
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, baseUrl + '/v1/ideas/idea-id/vote');
      assert.equal(options.method, 'PUT');
      assert.deepEqual(JSON.parse(options.body), {voted: false});
      return response({idea: {voted: false, vote_count: 0}});
    },
  });
  assert.deepEqual(await client.write('/v1/ideas/idea-id/vote', 'PUT', {voted: false}), {idea: {voted: false, vote_count: 0}});
  assert.equal(calls, 1);
});

test('network uncertainty preserves caller draft/UUID for the next deliberate retry', async () => {
  const makeRequest = createDraftRequest(() => 'retained-uuid');
  const draft = Object.freeze(validateDraft({nickname: '', body: 'Keep my text'}, 2000));
  const data = Object.freeze(makeRequest(draft));
  const submittedBodies = [];
  const client = createClient({baseUrl,
    verify: async () => assert.fail('Network error must not trigger verification'),
    fetcher: async (_url, options) => {
      submittedBodies.push(options.body);
      if (submittedBodies.length === 1) throw new TypeError('Connection lost');
      return response({idea: {id: 'existing-from-first-attempt'}});
    },
  });
  await assert.rejects(client.write(featurePath, 'POST', data), errorMatches('network_error', 0));
  assert.deepEqual(draft, {nickname: '', body: 'Keep my text'});
  assert.deepEqual(makeRequest(draft), data);
  assert.deepEqual(await client.write(featurePath, 'POST', makeRequest(draft)), {idea: {id: 'existing-from-first-attempt'}});
  assert.equal(submittedBodies[0], submittedBodies[1]);
});

test('server errors preserve structured status, field and Retry-After without automatic submission', async () => {
  for (const status of [400, 409, 429, 500, 503]) {
    let calls = 0;
    const data = Object.freeze({body: 'Keep this', client_request_id: 'same-uuid'});
    const client = createClient({baseUrl,
      verify: async () => assert.fail(`Status ${status} must not trigger verification`),
      fetcher: async () => { calls++; return response({error: {code: 'specific_error', field: 'body'}}, status, {'Retry-After': '42'}); },
    });
    await assert.rejects(client.write(featurePath, 'POST', data), error => {
      errorMatches('specific_error', status, 'body')(error);
      assert.equal(error.retryAfter, 42);
      return true;
    });
    assert.equal(calls, 1);
    assert.deepEqual(data, {body: 'Keep this', client_request_id: 'same-uuid'});
  }
});

test('a rejected cookie retries 401 at most once and propagates the second failure', async () => {
  let writes = 0, preparations = 0, verifications = 0;
  const client = createClient({baseUrl,
    verify: async () => { verifications++; return 'token'; },
    fetcher: async url => {
      if (url.endsWith('/visitor')) { preparations++; return response({ready: true}); }
      writes++; return visitorRequired();
    },
  });
  await assert.rejects(client.write(featurePath, 'POST', {body: 'text', client_request_id: 'same'}), errorMatches('visitor_required', 401));
  assert.deepEqual({writes, preparations, verifications}, {writes: 2, preparations: 1, verifications: 1});
});

test('concurrent writes share one pending visitor preparation and retain independent payloads', async () => {
  const challenge = deferred();
  let verified = 0, prepared = 0;
  let sessionReady = false;
  const requests = [];
  const client = createClient({baseUrl,
    verify: async () => { verified++; return challenge.promise; },
    fetcher: async (url, options) => {
      requests.push({url, body: options.body});
      if (url.endsWith('/visitor')) {
        prepared++;
        assert.deepEqual(JSON.parse(options.body), {turnstile_token: 'shared-token'});
        sessionReady = true;
        return response({ready: true});
      }
      return sessionReady ? response({accepted: JSON.parse(options.body)}) : visitorRequired();
    },
  });
  const firstData = Object.freeze({body: 'First', client_request_id: 'first-uuid'});
  const secondData = Object.freeze({voted: true});
  const first = client.write(featurePath, 'POST', firstData, {id: 'first-host'});
  const second = client.write('/v1/ideas/idea-id/vote', 'PUT', secondData, {id: 'second-host'});
  await nextTurn();
  assert.equal(verified, 1);
  assert.equal(prepared, 0);
  challenge.resolve('shared-token');
  const results = await Promise.all([first, second]);
  assert.deepEqual(results, [{accepted: firstData}, {accepted: secondData}]);
  assert.equal(verified, 1);
  assert.equal(prepared, 1);
  assert.equal(requests.length, 5);
  for (const path of [featurePath, '/v1/ideas/idea-id/vote']) {
    const matching = requests.filter(r => r.url === baseUrl + path);
    assert.equal(matching.length, 2);
    assert.equal(matching[0].body, matching[1].body);
  }
});

test('failed shared verification clears preparation state so a later deliberate retry can recover', async () => {
  const challenge = deferred();
  const failure = new FeedbackError('verification_failed', 403);
  let verified = 0, prepared = 0;
  let sessionReady = false;
  const client = createClient({baseUrl,
    verify: async () => { verified++; return verified === 1 ? challenge.promise : 'fresh-token'; },
    fetcher: async url => {
      if (url.endsWith('/visitor')) { prepared++; sessionReady = true; return response({ready: true}); }
      return sessionReady ? response({saved: true}) : visitorRequired();
    },
  });
  const data = Object.freeze({body: 'Retained text', client_request_id: 'retained-uuid'});
  const first = client.write(featurePath, 'POST', data);
  const second = client.write(featurePath, 'POST', data);
  // Attach observers before rejecting the shared challenge to avoid unhandled rejection.
  const failures = Promise.allSettled([first, second]);
  await nextTurn();
  assert.equal(verified, 1);
  challenge.reject(failure);
  for (const result of await failures) {
    assert.equal(result.status, 'rejected');
    assert.strictEqual(result.reason, failure);
  }
  assert.equal(prepared, 0);
  assert.deepEqual(await client.write(featurePath, 'POST', data), {saved: true});
  assert.equal(verified, 2);
  assert.equal(prepared, 1);
  assert.equal(data.body, 'Retained text');
});

test('reads omit JSON body, support cancellation, and distinguish malformed responses', async () => {
  const controller = new AbortController();
  const aborted = new DOMException('Cancelled', 'AbortError');
  const client = createClient({baseUrl, verify: async () => assert.fail('Read must not verify'),
    fetcher: async (url, options) => {
      assert.equal(url, baseUrl + featurePath);
      assert.equal(options.method, 'GET');
      assert.equal(options.credentials, 'include');
      assert.equal(options.body, undefined);
      assert.equal(options.headers, undefined);
      assert.strictEqual(options.signal, controller.signal);
      throw aborted;
    },
  });
  await assert.rejects(client.request(featurePath, {signal: controller.signal}), error => error === aborted);
  const malformed = createClient({baseUrl, verify: async () => assert.fail('Malformed response must not verify'),
    fetcher: async () => new Response('upstream unavailable', {status: 502}),
  });
  await assert.rejects(malformed.request(featurePath), errorMatches('invalid_response', 502));
});
