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
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 20000);
    let response;
    try {
      response = await fetcher(baseUrl + path, {
        method, credentials: 'include', cache: 'no-store', signal: signal || timeout.signal,
        ...(data === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)})
      });
    } catch (error) {
      if (error.name === 'AbortError' && !timeout.signal.aborted) throw error;
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
