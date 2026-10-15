import {createClient, createDraftRequest, validateDraft, normalizeText, FeedbackError} from './client.mjs';
import {feedbackConfig} from './config.js';
import {text as t} from './copy.mjs';

const $ = selector => document.querySelector(selector);
const english = document.documentElement.lang === 'en';
const locale = english ? 'en-US' : 'ko-KR';
const api = createClient({baseUrl: feedbackConfig.api, verify: verifyVisitor});
const ideaList = $('#idea-list');
const rendered = new Map();
let sort = 'popular', cursor = null, loadSequence = 0, loading = false, failedAppend = false;
let activeWrites = 0, dataRevision = 0;
const writeWaiters = [];
let turnstileScript;

function writeBusy(change) {
  activeWrites += change;
  if (change > 0) dataRevision++;
  document.querySelectorAll('[data-sort]').forEach(control => {control.disabled = activeWrites > 0;});
  $('#list-more').disabled = activeWrites > 0 || loading;
  $('#list-retry').disabled = activeWrites > 0;
  if (!activeWrites) writeWaiters.splice(0).forEach(resolve => resolve());
}
function writesSettled() {return activeWrites ? new Promise(resolve => writeWaiters.push(resolve)) : Promise.resolve();}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className = 'feedback-text-button') {
  const node = element('button', className, text); node.type = 'button'; return node;
}
function icon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const stroke = document.createElementNS(svg.namespaceURI, 'path');
  stroke.setAttribute('d', path); stroke.setAttribute('fill', 'none');
  stroke.setAttribute('stroke', 'currentColor'); stroke.setAttribute('stroke-width', '1.6');
  stroke.setAttribute('stroke-linecap', 'round'); stroke.setAttribute('stroke-linejoin', 'round');
  svg.append(stroke); return svg;
}
function status(node, value = '', success = false) {
  node.textContent = value; node.dataset.kind = success ? 'success' : 'error';
}
function errorMessage(error) {
  if (error.code === 'nickname_length') return t('닉네임은 24자까지 적을 수 있어요.');
  if (error.code === 'body_length') return t('내용을 입력하고 글자 수를 확인해 주세요.');
  if (error.code === 'verification_cancelled') return t('확인을 취소했어요. 작성한 내용은 그대로 있어요.');
  if (error.status === 429) return t('잠시 쉬었다가 다시 남겨 주세요. 약 {seconds}초 후에 시도할 수 있어요.', {seconds: error.retryAfter || 60});
  if (error.status === 401) return t('브라우저에서 쿠키를 허용한 뒤 다시 시도해 주세요.');
  if (error.code === 'not_found') return t('이 의견을 찾을 수 없어요. 삭제되었거나 숨겨졌을 수 있어요.');
  if (error.code === 'verification_failed' || error.code === 'verification_unavailable') return t('사람 확인을 마치지 못했어요. 다시 시도해 주세요.');
  if (error.status === 409) return t('내용이 변경되었어요. 내용을 확인하고 다시 남겨 주세요.');
  if (error.status === 400) return t('입력한 내용과 글자 수를 확인해 주세요.');
  return t('지금 연결하지 못했어요. 잠시 후 다시 시도해 주세요. 작성한 내용은 그대로 있어요.');
}

function loadTurnstile() {
  if (!turnstileScript) {
    turnstileScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const timer = setTimeout(() => {script.remove(); reject(new FeedbackError('verification_unavailable'));}, 15000);
      script.onload = () => {clearTimeout(timer); resolve();};
      script.onerror = () => {clearTimeout(timer); script.remove(); reject(new FeedbackError('verification_unavailable'));};
      document.head.append(script);
    }).catch(error => {turnstileScript = null; throw error;});
  }
  return turnstileScript;
}
async function verifyVisitor(host) {
  if (!feedbackConfig.siteKey) throw new FeedbackError('not_configured', 503);
  await loadTurnstile();
  return new Promise((resolve, reject) => {
    const box = element('div', 'feedback-challenge');
    const label = element('p', null, t('처음 참여할 때만 간단한 확인을 진행해요.'));
    const widget = element('div');
    const cancel = button(t('취소'));
    box.append(label, widget, cancel); host.append(box);
    let widgetId, settled = false;
    const timer = setTimeout(() => finish(new FeedbackError('verification_unavailable')), 120000);
    function finish(error, token) {
      if (settled) return; settled = true; clearTimeout(timer);
      if (widgetId !== undefined) window.turnstile.remove(widgetId);
      box.remove(); error ? reject(error) : resolve(token);
    }
    cancel.addEventListener('click', () => finish(new FeedbackError('verification_cancelled')));
    widgetId = window.turnstile.render(widget, {
      sitekey: feedbackConfig.siteKey, action: 'feedback', theme: 'light', size: 'flexible',
      language: english ? 'en' : 'ko', appearance: 'interaction-only',
      callback: token => finish(null, token),
      'error-callback': () => {finish(new FeedbackError('verification_failed')); return true;},
      'expired-callback': () => finish(new FeedbackError('verification_failed')),
      'timeout-callback': () => finish(new FeedbackError('verification_failed'))
    });
  });
}

function meta(item) {
  const row = element('div', 'feedback-meta');
  row.append(element('span', 'feedback-author', item.nickname || t('익명')));
  if (item.is_operator) row.append(element('span', 'feedback-operator', t('운영자')));
  const date = element('time', null, new Date(item.created_at).toLocaleDateString(locale, {year: 'numeric', month: 'short', day: 'numeric'}));
  date.dateTime = item.created_at; row.append(date); return row;
}

function wireForm(form, {limit, counter, message, challenge, endpoint, onSuccess, onBusy = () => {}}) {
  const nickname = form.elements.nickname, body = form.elements.body;
  const submit = form.querySelector('[type=submit]');
  let requestDraft = createDraftRequest();
  function count() {counter.textContent = `${[...normalizeText(body.value)].length.toLocaleString(locale)} / ${limit.toLocaleString(locale)}`;}
  body.addEventListener('input', () => {body.removeAttribute('aria-invalid'); count();});
  nickname.addEventListener('input', () => nickname.removeAttribute('aria-invalid'));
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled) return;
    status(message);
    let draft;
    try {draft = requestDraft(validateDraft({nickname: nickname.value, body: body.value}, limit));}
    catch (error) {
      const field = form.elements[error.field]; field?.setAttribute('aria-invalid', 'true');
      status(message, errorMessage(error)); field?.focus(); return;
    }
    const idleText = submit.textContent;
    writeBusy(1);
    onBusy(true);
    submit.disabled = true; submit.textContent = t('남기는 중…');
    // Freeze only this form while the exact payload is in flight. No draft can be lost to an old response.
    body.readOnly = true; nickname.readOnly = true;
    try {
      const result = await api.write(endpoint, 'POST', draft, challenge);
      dataRevision++;
      body.value = ''; requestDraft = createDraftRequest(); count();
      status(message, t('남겨 주셔서 고마워요.'), true);
      onSuccess(result);
    } catch (error) {status(message, errorMessage(error));}
    finally {submit.disabled = false; submit.textContent = idleText; body.readOnly = false; nickname.readOnly = false; onBusy(false); writeBusy(-1);}
  });
  count();
}

function commentsPanel(idea, updateCount, onBusy) {
  const panel = element('section', 'feedback-comments');
  panel.id = `comments-${idea.id}`; panel.hidden = true;
  panel.setAttribute('aria-label', t('댓글'));
  const list = element('ul', 'feedback-comment-list');
  const message = element('p', 'feedback-status'); message.setAttribute('role', 'status');
  const load = button(t('댓글 더 보기')); load.hidden = true;
  const retry = button(t('다시 불러오기')); retry.hidden = true;
  const empty = element('p', 'feedback-note', t('첫 댓글을 남겨 주세요.')); empty.hidden = true;
  const form = element('form', 'feedback-comment-form'); form.noValidate = true;
  const nickLabel = element('label', null, t('닉네임 (선택)'));
  const nick = element('input'); nick.name = 'nickname'; nick.id = `comment-nick-${idea.id}`;
  nick.autocomplete = 'nickname'; nick.placeholder = t('비워 두면 익명으로 표시돼요'); nickLabel.htmlFor = nick.id;
  const bodyLabel = element('label', null, t('댓글'));
  const body = element('textarea'); body.name = 'body'; body.id = `comment-body-${idea.id}`;
  body.rows = 3; body.setAttribute('aria-required', 'true'); bodyLabel.htmlFor = body.id;
  body.placeholder = t('이 의견에 대한 생각을 나눠 주세요.');
  const bottom = element('div', 'feedback-compose-bottom');
  const counter = element('span', 'feedback-counter'); counter.id = `comment-counter-${idea.id}`;
  const submit = button(t('댓글 남기기'), 'feedback-submit'); submit.type = 'submit';
  bottom.append(counter, submit);
  const challenge = element('div'); const formMessage = element('p', 'feedback-status');
  formMessage.id = `comment-status-${idea.id}`; formMessage.setAttribute('role', 'status');
  body.setAttribute('aria-describedby', `${counter.id} ${formMessage.id}`); nick.setAttribute('aria-describedby', formMessage.id);
  form.append(nickLabel, nick, bodyLabel, body, bottom, challenge, formMessage);
  panel.append(list, empty, message, retry, load, form);
  let loaded = false, busy = false, next = null, retryAppend = false;
  const items = new Map();
  function add(item) {
    if (items.has(item.id)) return;
    const li = element('li', 'feedback-comment');
    li.append(meta(item), element('p', 'feedback-body', item.body));
    items.set(item.id, {item, li});
    const ordered = [...items.values()].sort((a, b) => a.item.created_at.localeCompare(b.item.created_at) || a.item.id.localeCompare(b.item.id));
    list.replaceChildren(...ordered.map(entry => entry.li));
  }
  async function refresh(append = false) {
    if (busy) return; busy = true; retryAppend = append; load.disabled = true;
    status(message, t('댓글을 불러오는 중이에요.'), true); retry.hidden = true;
    try {
      const result = await api.request(`/v1/ideas/${encodeURIComponent(idea.id)}/comments${append && next ? '?cursor=' + encodeURIComponent(next) : ''}`);
      result.comments.forEach(add); next = result.next_cursor; loaded = true;
      empty.hidden = items.size !== 0; load.hidden = !next; status(message);
    } catch (error) {status(message, errorMessage(error)); retry.hidden = false;}
    finally {busy = false; load.disabled = false;}
  }
  load.addEventListener('click', () => refresh(true)); retry.addEventListener('click', () => refresh(retryAppend));
  wireForm(form, {limit: 1000, counter, message: formMessage, challenge,
    endpoint: `/v1/ideas/${encodeURIComponent(idea.id)}/comments`,
    onBusy,
    onSuccess: result => {add(result.comment); empty.hidden = true; updateCount();}
  });
  return {panel, setVotePending: value => {submit.disabled = value;}, hasDraft: () => Boolean(body.value || nick.value || submit.disabled), open() {panel.hidden = !panel.hidden; if (!panel.hidden && !loaded) refresh();}};
}

function renderIdea(idea, prepend = false) {
  if (rendered.has(idea.id)) {
    const existing = rendered.get(idea.id); existing.update(idea);
    if (prepend) ideaList.prepend(existing.li);
    return existing.li;
  }
  const li = element('li', 'feedback-idea'); li.id = `idea-${idea.id}`; li.tabIndex = -1;
  const voteWrap = element('div', 'feedback-vote-wrap');
  const vote = button('', 'feedback-vote');
  const voteCount = element('span'); vote.append(icon('m6 14 6-6 6 6'), voteCount); voteWrap.append(vote);
  const content = element('div', 'feedback-idea-content');
  const actions = element('div', 'feedback-idea-actions');
  const commentToggle = button(''); commentToggle.setAttribute('aria-expanded', 'false');
  commentToggle.setAttribute('aria-controls', `comments-${idea.id}`);
  const share = element('a', 'feedback-share', t('링크'));
  share.href = `${english ? '/en' : ''}/feedback/?idea=${encodeURIComponent(idea.id)}#idea-${encodeURIComponent(idea.id)}`;
  share.setAttribute('aria-label', t('이 의견의 고유 링크'));
  const error = element('p', 'feedback-status'); error.setAttribute('role', 'status');
  const challenge = element('div');
  let state = idea;
  const comments = commentsPanel(idea, () => update({...state, comment_count: state.comment_count + 1}), busy => {vote.disabled = busy;});
  function update(next) {
    state = next; voteCount.textContent = String(state.vote_count);
    vote.setAttribute('aria-pressed', String(state.voted));
    vote.setAttribute('aria-label', t('나도 원해요, 공감 {count}개', {count: state.vote_count}));
    commentToggle.textContent = t('댓글 {count}개', {count: state.comment_count});
  }
  update(idea);
  vote.addEventListener('click', async () => {
    if (vote.disabled) return; vote.disabled = true; comments.setVotePending(true); status(error); writeBusy(1);
    try {const result = await api.write(`/v1/ideas/${encodeURIComponent(state.id)}/vote`, 'PUT', {voted: !state.voted}, challenge); dataRevision++; update(result.idea);}
    catch (failure) {status(error, errorMessage(failure));}
    finally {vote.disabled = false; comments.setVotePending(false); writeBusy(-1);}
  });
  commentToggle.addEventListener('click', () => {
    comments.open(); commentToggle.setAttribute('aria-expanded', String(!comments.panel.hidden));
  });
  actions.append(commentToggle, share);
  content.append(meta(idea), element('p', 'feedback-body', idea.body), actions, challenge, error, comments.panel);
  li.append(voteWrap, content); rendered.set(idea.id, {li, update, hasDraft: () => vote.disabled || comments.hasDraft(), newlyPosted: prepend});
  prepend ? ideaList.prepend(li) : ideaList.append(li); return li;
}

async function loadIdeas(append = false) {
  if (append && loading) return;
  loading = true; failedAppend = append;
  const sequence = ++loadSequence;
  const revision = dataRevision;
  $('#list-loading').hidden = false; $('#list-more').disabled = true; $('#list-retry').hidden = true;
  $('#list-empty').hidden = true; status($('#list-status'));
  try {
    const result = await api.request(`/v1/ideas?sort=${sort}${append && cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    if (sequence !== loadSequence) return;
    if (activeWrites || revision !== dataRevision) {
      await writesSettled();
      if (sequence !== loadSequence) return;
      loading = false; return loadIdeas(append);
    }
    const nodes = result.ideas.map(item => renderIdea(item));
    if (append) nodes.forEach(node => ideaList.append(node));
    else {
      // Keep the same nodes (and typed comment drafts) when sorting. A just-posted
      // idea also stays visible if it falls beyond the first popularity page.
      const keep = [...rendered.values()].filter(entry => (entry.hasDraft() || entry.newlyPosted) && !nodes.includes(entry.li));
      ideaList.replaceChildren(...keep.map(entry => entry.li), ...nodes);
    }
    cursor = result.next_cursor;
    $('#list-more').hidden = !cursor; $('#list-empty').hidden = ideaList.children.length !== 0;
  } catch (error) {
    if (sequence !== loadSequence) return;
    status($('#list-status'), errorMessage(error)); $('#list-retry').hidden = false;
  } finally {
    if (sequence === loadSequence) {loading = false; $('#list-loading').hidden = true; $('#list-more').disabled = activeWrites > 0;}
  }
}

wireForm($('#idea-form'), {limit: 2000, counter: $('#idea-counter'), message: $('#idea-status'), challenge: $('#idea-challenge'), endpoint: '/v1/ideas',
  onSuccess: result => {
    const li = renderIdea(result.idea, true); $('#list-empty').hidden = true;
    li.focus({preventScroll: true});
  }
});
document.querySelectorAll('[data-sort]').forEach(control => control.addEventListener('click', () => {
  if (sort === control.dataset.sort) return;
  sort = control.dataset.sort;
  document.querySelectorAll('[data-sort]').forEach(item => item.setAttribute('aria-pressed', String(item === control)));
  loadIdeas();
}));
$('#list-retry').addEventListener('click', () => loadIdeas(failedAppend));
$('#list-more').addEventListener('click', () => loadIdeas(true));

// Language changes keep a shared idea, while both routes remain real static Pages paths.
const sharedId = new URLSearchParams(location.search).get('idea');
if (sharedId && /^[a-zA-Z0-9-]{1,80}$/.test(sharedId)) {
  document.querySelectorAll('.language-options a').forEach(link => {link.search = '?idea=' + encodeURIComponent(sharedId);});
}
await loadIdeas();
if (sharedId && /^[a-zA-Z0-9-]{1,80}$/.test(sharedId)) {
  try {
    let li = rendered.get(sharedId)?.li;
    if (!li) {
      const result = await api.request('/v1/ideas/' + encodeURIComponent(sharedId));
      // A concurrent list load may already have mounted this item and accepted
      // a write. Its live node takes precedence over this older detail response.
      li = rendered.get(sharedId)?.li || renderIdea(result.idea, true);
    }
    $('#list-empty').hidden = true;
    li.scrollIntoView({behavior: 'instant', block: 'center'}); li.focus({preventScroll: true});
  } catch (error) {status($('#list-status'), errorMessage(error));}
}
