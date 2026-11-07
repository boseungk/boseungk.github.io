/* Feature suggestions board (/feedback/): plain-text rendering, serialized writes, draft-preserving list updates.
   - Copy: the page's inline <script id="page-copy"> (site/text.mjs). Keys are the Korean text, passed to t as a
     single-quoted literal so the build finds them.
   - #news-links (news entries that mention an idea) and #feedback-config (Turnstile language) are written by
     tools/sitebuild/community.py. URLs of local files come from stamped data-* attributes, never from strings here.
   - Status filter and counts appear only when the API sends counts (an older API ignores ?status).
   - Motion is in motion.mjs: one-shot, and none under reduced motion or in a hidden tab. */
import {createClient, createDraftRequest, validateDraft, normalizeText, FeedbackError, SORTS, STATUSES, ideasPath, createViewCache, relativeDate, absoluteDate, newsLinkSegments} from './client.mjs';
import {feedbackConfig} from './config.js';
import {readCopy, createText} from '../site/text.mjs';
import * as motion from './motion.mjs';

const {meta, copy} = readCopy();
const t = createText(copy, meta.locale);
const locale = meta.locale;
const number = new Intl.NumberFormat(locale);
const $ = selector => document.querySelector(selector);
function pageData(id) {
  try { return JSON.parse(document.getElementById(id)?.textContent || '{}') || {}; } catch { return {}; }
}
const newsLinks = pageData('news-links');
const turnstileLanguage = pageData('feedback-config').turnstile || 'en';
const board = $('#ideas');
const operatorIcon = board.dataset.operatorIcon || '';
const api = createClient({baseUrl: feedbackConfig.api, verify: verifyVisitor});
const ideaList = $('#idea-list');
const compose = $('#new-idea');
const filter = $('.feedback-filter');
const filterButtons = [...filter.querySelectorAll('[data-status]')];
const sortButtons = [...document.querySelectorAll('[data-sort]')];
const STATUS_LABELS = {reviewing: t('검토 중'), planned: t('준비 중'), completed: t('반영 완료')};
const DRAFT_KEY = 'mar-feedback-draft-v1';
const rendered = new Map();
const views = createViewCache({ttl: 60000});
const resizeWatch = 'ResizeObserver' in window ? new ResizeObserver(entries => entries.forEach(entry => entry.target.measureClamp?.())) : null;

const query = new URLSearchParams(location.search);
let sort = SORTS.includes(query.get('sort')) ? query.get('sort') : 'popular';
let status = STATUSES.includes(query.get('status')) ? query.get('status') : '';
const sharedId = /^[a-zA-Z0-9-]{1,80}$/.test(query.get('idea') || '') ? query.get('idea') : null;
let counts = null;
let cursor = null, loadSequence = 0, loading = false, failedAppend = false, lastFailed = false, onlineRetried = false;
let lastLoadAt = 0, readController = null, firstRender = true;
let activeWrites = 0, dataRevision = 0;
const writeWaiters = [];
let turnstileScript;

// ---------------------------------------------------------------------------------------------
// small DOM helpers

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function labelled(tag, className, text) {
  const node = element(tag, className);
  const label = element('span', 'mar-choice-label', text);
  node.append(label);
  node.label = label;
  return node;
}
function button(text, className = 'feedback-text-button') {
  const node = labelled('button', className, text); node.type = 'button'; return node;
}
// Hairline chevron drawn the app way: a paper guard stroke under the ink stroke.
function chevron() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  for (const kind of ['guard', 'ink']) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M6.3 14.7C8.2 12.7 10.1 10.7 12 8.8C13.9 10.7 15.8 12.6 17.7 14.5');
    path.setAttribute('class', 'feedback-vote__' + kind);
    svg.append(path);
  }
  return svg;
}
function operatorMark() {
  const img = element('img', 'feedback-operator-icon');
  img.src = operatorIcon; img.alt = ''; img.width = 16; img.height = 16; img.decoding = 'async';
  return img;
}
function dateNode(iso) {
  const node = element('time', null, relativeDate(iso, locale));
  node.dateTime = iso;
  node.title = absoluteDate(iso, locale, {year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'});
  return node;
}
function mountWash(group, items) {
  window.MARSelection?.mount(group, items, () => null);
}
function say(node, value = '', success = false) {
  node.textContent = value; node.dataset.kind = success ? 'success' : 'error';
  if (value) motion.appear(node);
}
// context 'vote': a vote has no draft and no text to check, so only the waiting, cookie, missing-idea and
// verification sentences apply; anything else reads as a vote that did not go through.
function errorMessage(error, context = 'draft') {
  if (context === 'vote' && !(error.status === 429 || error.status === 401 || error.code === 'not_found' ||
      error.code === 'verification_failed' || error.code === 'verification_unavailable')) return t('공감을 반영하지 못했어요. 잠시 후 다시 눌러 주세요.');
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
// Reading failures never use the compose sentence about drafts.
function readErrorMessage(error) {
  if (error.code === 'not_found') return t('이 의견을 찾을 수 없어요. 삭제되었거나 숨겨졌을 수 있어요.');
  return t('의견을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
}

// Long text: clamped by CSS (.is-clamped), with a toggle that appears only when the text overflows.
function clampedText(text, className, {linkify = false} = {}) {
  const node = element('p', className);
  node.dir = 'auto';
  if (linkify) {
    for (const part of newsLinkSegments(text, meta.routes.news)) {
      if (!part.href) { node.append(part.text); continue; }
      const link = element('a', 'text-link', part.text); link.href = part.href;
      node.append(link);
    }
  } else node.textContent = text;
  node.classList.add('is-clamped');
  const toggle = button(t('더 보기'), 'feedback-text-button feedback-clamp-toggle');
  toggle.hidden = true; toggle.setAttribute('aria-expanded', 'false');
  let expanded = false;
  node.measureClamp = () => {
    if (expanded) return;
    toggle.hidden = node.scrollHeight <= node.clientHeight + 2;
    toggle.dispatchEvent(new Event('clampchange'));
  };
  toggle.addEventListener('click', () => {
    const from = node.getBoundingClientRect().height;
    expanded = !expanded;
    node.classList.toggle('is-clamped', !expanded);
    toggle.label.textContent = expanded ? t('접기') : t('더 보기');
    toggle.setAttribute('aria-expanded', String(expanded));
    motion.resize(node, from);
    if (!expanded) node.measureClamp();
  });
  resizeWatch?.observe(node);
  requestAnimationFrame(() => node.measureClamp());
  return {node, toggle};
}

// ---------------------------------------------------------------------------------------------
// writes are serialized against list reads

function writeBusy(change) {
  activeWrites += change;
  if (change > 0) dataRevision++;
  [...sortButtons, ...filterButtons].forEach(control => {control.disabled = activeWrites > 0;});
  $('#list-more').disabled = activeWrites > 0 || loading;
  $('#list-retry').disabled = activeWrites > 0;
  if (!activeWrites) writeWaiters.splice(0).forEach(resolve => resolve());
}
function writesSettled() {return activeWrites ? new Promise(resolve => writeWaiters.push(resolve)) : Promise.resolve();}

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
      language: turnstileLanguage, appearance: 'interaction-only',
      callback: token => finish(null, token),
      'error-callback': () => {finish(new FeedbackError('verification_failed')); return true;},
      'expired-callback': () => finish(new FeedbackError('verification_failed')),
      'timeout-callback': () => finish(new FeedbackError('verification_failed'))
    });
  });
}

// One form controller for the idea and comment forms: counter, Ctrl/⌘+Enter, exact-payload retries.
function wireForm(form, {limit, counter, live, message, challenge, endpoint, onSuccess, onBusy = () => {}, onInput = () => {}}) {
  const nickname = form.elements.nickname, body = form.elements.body;
  const submit = form.querySelector('[type=submit]');
  const submitLabel = submit.querySelector('.mar-choice-label') || submit;
  let requestDraft = createDraftRequest(), liveTimer = 0;
  function count() {
    const used = [...normalizeText(body.value)].length, near = used >= limit * .9;
    counter.textContent = `${number.format(used)} / ${number.format(limit)}`;
    counter.classList.toggle('is-near', near);
    // The remaining count is announced only near the limit, and not on every keystroke.
    clearTimeout(liveTimer);
    if (!near) live.textContent = '';
    else liveTimer = setTimeout(() => {live.textContent = t('{count}자 남았어요', {count: Math.max(0, limit - used)});}, 500);
  }
  body.addEventListener('input', () => {body.removeAttribute('aria-invalid'); count(); onInput();});
  nickname.addEventListener('input', () => {nickname.removeAttribute('aria-invalid'); onInput();});
  body.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing) {event.preventDefault(); form.requestSubmit();}
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled) return;
    say(message);
    let draft;
    try {draft = requestDraft(validateDraft({nickname: nickname.value, body: body.value}, limit));}
    catch (error) {
      const field = form.elements[error.field]; field?.setAttribute('aria-invalid', 'true');
      say(message, errorMessage(error)); field?.focus(); return;
    }
    const idleText = submitLabel.textContent;
    writeBusy(1);
    onBusy(true);
    submit.disabled = true; submitLabel.textContent = t('남기는 중…');
    // Freeze only this form while the exact payload is in flight. No draft can be lost to an old response.
    body.readOnly = true; nickname.readOnly = true;
    try {
      const result = await api.write(endpoint, 'POST', draft, challenge);
      dataRevision++; views.clear();   // cached first pages predate this write: never restore them over it
      body.value = ''; requestDraft = createDraftRequest(); count();
      say(message, t('남겨 주셔서 고마워요.'), true);
      onSuccess(result);
    } catch (error) {say(message, errorMessage(error));}
    finally {submit.disabled = false; submitLabel.textContent = idleText; body.readOnly = false; nickname.readOnly = false; onBusy(false); writeBusy(-1);}
  });
  count();
  return {count};
}

// ---------------------------------------------------------------------------------------------
// comments

function commentMeta(item) {
  const row = element('p', 'feedback-meta');
  if (item.is_operator) {
    const who = element('span', 'feedback-operator');
    who.append(operatorMark(), element('span', null, t('운영자')));
    row.append(who);
  } else row.append(element('bdi', 'feedback-author', item.nickname || t('익명')));
  row.append(dateNode(item.created_at));
  return row;
}

function commentsPanel(idea, updateCount, onBusy) {
  const panel = element('section', 'feedback-comments');
  panel.id = `comments-${idea.id}`; panel.inert = true;
  panel.setAttribute('aria-label', t('댓글'));
  const inner = element('div', 'feedback-comments__inner');
  const list = element('ul', 'feedback-comment-list');
  const message = element('p', 'feedback-status'); message.setAttribute('role', 'status'); message.tabIndex = -1;
  const load = button(t('댓글 더 보기')); load.hidden = true;
  const retry = button(t('다시 불러오기')); retry.hidden = true;
  const empty = element('p', 'feedback-note', t('첫 댓글을 남겨 주세요.')); empty.hidden = true;
  const form = element('form', 'feedback-comment-form'); form.noValidate = true;
  const nickLabel = element('label', null, t('닉네임 (선택)'));
  const nick = element('input'); nick.name = 'nickname'; nick.id = `comment-nick-${idea.id}`; nick.dir = 'auto';
  nick.autocomplete = 'nickname'; nick.placeholder = t('비워 두면 익명으로 표시돼요'); nickLabel.htmlFor = nick.id;
  const bodyLabel = element('label', null, t('댓글'));
  const body = element('textarea'); body.name = 'body'; body.id = `comment-body-${idea.id}`; body.dir = 'auto';
  body.rows = 3; body.setAttribute('aria-required', 'true'); bodyLabel.htmlFor = body.id;
  body.placeholder = t('이 의견에 대한 생각을 나눠 주세요.');
  const bottom = element('div', 'feedback-form-bottom');
  const counter = element('span', 'feedback-counter'); counter.id = `comment-counter-${idea.id}`;
  const live = element('span', 'sr-only'); live.setAttribute('aria-live', 'polite');
  const submit = button(t('댓글 남기기'), 'feedback-submit'); submit.type = 'submit';
  bottom.append(counter, live, submit);
  const challenge = element('div'); const formMessage = element('p', 'feedback-status');
  formMessage.id = `comment-status-${idea.id}`; formMessage.setAttribute('role', 'status');
  body.setAttribute('aria-describedby', `${counter.id} ${formMessage.id}`); nick.setAttribute('aria-describedby', formMessage.id);
  form.append(nickLabel, nick, bodyLabel, body, bottom, challenge, formMessage);
  inner.append(list, empty, message, retry, load, form);
  panel.append(inner);
  let loaded = false, busy = false, next = null, retryAppend = false, open = false, pending = null;
  const items = new Map();
  function add(item) {
    if (items.has(item.id)) return null;
    const li = element('li', 'feedback-comment');
    li.id = `comment-${item.id}`; li.tabIndex = -1;
    li.append(commentMeta(item), clampless(item.body));
    items.set(item.id, {item, li});
    const ordered = [...items.values()].sort((a, b) => a.item.created_at.localeCompare(b.item.created_at) || a.item.id.localeCompare(b.item.id));
    list.replaceChildren(...ordered.map(entry => entry.li));
    return li;
  }
  function clampless(text) {const node = element('p', 'feedback-body', text); node.dir = 'auto'; return node;}
  async function refresh(append = false) {
    if (busy) return pending; busy = true; retryAppend = append; load.disabled = true;
    say(message, t('댓글을 불러오는 중이에요.'), true);
    // Hiding a focused retry would drop keyboard focus to <body>: hold it on the status line meanwhile.
    const retrying = retry.contains(document.activeElement);
    if (retrying) message.focus({preventScroll: true});
    retry.hidden = true;
    const before = new Set(items.keys());
    pending = (async () => {
      try {
        const result = await api.request(`/v1/ideas/${encodeURIComponent(idea.id)}/comments${append && next ? '?cursor=' + encodeURIComponent(next) : ''}`);
        result.comments.forEach(add); next = result.next_cursor; loaded = true;
        empty.hidden = items.size !== 0; load.hidden = !next; say(message);
        if (retrying && document.activeElement === message) {
          const first = [...items.keys()].find(id => !before.has(id));
          (first ? items.get(first).li : body).focus({preventScroll: true});
        }
      } catch (error) {
        say(message, readErrorMessage(error)); retry.hidden = false;
        if (retrying && document.activeElement === message) retry.focus({preventScroll: true});
      }
      finally {busy = false; load.disabled = false;}
    })();
    return pending;
  }
  load.addEventListener('click', () => refresh(true)); retry.addEventListener('click', () => refresh(retryAppend));
  wireForm(form, {limit: 1000, counter, live, message: formMessage, challenge,
    endpoint: `/v1/ideas/${encodeURIComponent(idea.id)}/comments`,
    onBusy,
    onSuccess: result => {const li = add(result.comment); empty.hidden = true; updateCount(); if (li) motion.settle(li);}
  });
  function setOpen(value) {
    if (value === open) return;
    open = value;
    panel.inert = !open;
    panel.classList.toggle('is-open', open);
    motion.disclose(panel, open);
    if (open && !loaded) refresh();
  }
  // Opens the panel and focuses one comment, loading later pages until it appears (at most 10 pages).
  async function reveal(commentId) {
    setOpen(true);
    if (!loaded) await (pending || refresh());
    for (let page = 0; !items.has(commentId) && next && page < 10; page++) await refresh(true);
    const entry = items.get(commentId);
    if (entry) {entry.li.scrollIntoView({behavior: 'instant', block: 'nearest'}); entry.li.focus({preventScroll: true});}
  }
  return {panel, reveal, isOpen: () => open, toggle: () => setOpen(!open), open: () => setOpen(true),
    setVotePending: value => {submit.disabled = value;}, hasDraft: () => Boolean(body.value || nick.value || submit.disabled)};
}

// ---------------------------------------------------------------------------------------------
// idea rows

function renderIdea(idea) {
  const existing = rendered.get(idea.id);
  if (existing) {existing.update(idea); return existing;}
  const li = element('li', 'feedback-idea'); li.id = `idea-${idea.id}`; li.tabIndex = -1;
  const vote = element('button', 'feedback-vote'); vote.type = 'button';
  const voteCount = element('span', 'feedback-vote__count'); voteCount.setAttribute('aria-hidden', 'true');
  voteCount.append(element('span'));
  vote.append(chevron(), voteCount);
  const content = element('div', 'feedback-idea__content');
  const head = element('p', 'feedback-meta');
  const author = element('bdi', 'feedback-author');
  const time = element('time');
  const progress = element('span', 'feedback-progress hl');
  const shared = element('span', 'feedback-shared', t('공유된 의견')); shared.hidden = true;
  head.append(author, time, progress, shared);
  const text = clampedText(idea.body, 'feedback-body');
  // The vote button comes first in the row: its description is the idea it votes for.
  text.node.id = `idea-text-${idea.id}`; vote.setAttribute('aria-describedby', text.node.id);
  const reply = element('div', 'feedback-reply'); reply.hidden = true;
  const news = element('div', 'feedback-news'); news.hidden = true;
  const actions = element('div', 'feedback-actions');
  const commentToggle = button(''); commentToggle.setAttribute('aria-expanded', 'false');
  commentToggle.setAttribute('aria-controls', `comments-${idea.id}`);
  const share = labelled('a', 'feedback-text-button feedback-share', t('링크 복사'));
  share.href = `${meta.routes.feedback}?idea=${encodeURIComponent(idea.id)}#idea-${encodeURIComponent(idea.id)}`;
  const note = element('p', 'feedback-status'); note.setAttribute('role', 'status');
  const challenge = element('div');
  let state = idea, pinned = false, newlyPosted = false, noteTimer = 0, replyKey = '', replyText = null;
  const comments = commentsPanel(idea, () => update({...state, comment_count: state.comment_count + 1}), busy => {vote.disabled = busy;});

  function renderReply(value) {
    const key = value ? `${value.id}|${value.body}` : '';
    if (key === replyKey) return;
    replyKey = key;
    reply.hidden = !value;
    // The old wash and its observers go with the old children; the new button mounts afresh below.
    window.MARSelection?.destroy(reply);
    if (replyText) resizeWatch?.unobserve(replyText);
    reply.replaceChildren(); replyText = null;
    if (!value) return;
    const label = element('p', 'feedback-reply__label');
    label.append(operatorMark(), element('span', null, t('운영자 답변')), dateNode(value.created_at));
    const body = clampedText(value.body, 'feedback-reply__body', {linkify: true});
    const more = button(t('답변 전체 보기'), 'feedback-text-button feedback-reply__more');
    const refreshMore = () => {more.hidden = body.toggle.hidden && state.comment_count <= 1;};
    body.toggle.addEventListener('clampchange', refreshMore);
    body.toggle.remove();   // the full reply opens in the comments, at the reply
    more.addEventListener('click', () => {
      commentToggle.setAttribute('aria-expanded', 'true');
      comments.reveal(value.id);
    });
    reply.append(label, body.node, more);
    replyText = body.node;
    reply.refreshMore = refreshMore;
    refreshMore();
    mountWash(reply, [more]);   // a link inside the reply text keeps its underline and no wash (it can wrap across lines)
  }
  function renderNews() {
    const entries = Array.isArray(newsLinks[idea.id]) ? newsLinks[idea.id].filter(entry => entry && typeof entry.href === 'string' && typeof entry.title === 'string') : [];
    news.hidden = !entries.length;
    if (!entries.length) return;
    const label = element('span', 'feedback-news__label', t('관련 소식'));
    news.append(label);
    for (const entry of entries) {
      const link = labelled('a', 'text-link', entry.title); link.href = entry.href;
      news.append(link);
    }
    mountWash(news, [...news.querySelectorAll('a')]);
  }
  function update(next) {
    const before = state;
    state = next;
    li.dataset.status = next.status;
    author.textContent = next.nickname || t('익명');
    time.textContent = relativeDate(next.created_at, locale); time.dateTime = next.created_at;
    time.title = absoluteDate(next.created_at, locale, {year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'});
    progress.textContent = STATUS_LABELS[next.status] || '';
    progress.hidden = !progress.textContent;
    motion.swapCount(voteCount, number.format(next.vote_count));
    vote.setAttribute('aria-pressed', String(Boolean(next.voted)));
    vote.setAttribute('aria-label', t('나도 원해요, 공감 {count}개', {count: next.vote_count}));
    commentToggle.label.textContent = t('댓글 {count}개', {count: next.comment_count});
    // An API without operator_reply leaves the reply block out.
    renderReply(next.operator_reply || null);
    reply.refreshMore?.();
    return before;
  }
  update(idea);
  renderNews();
  vote.addEventListener('click', async () => {
    if (vote.disabled) return;
    const on = !state.voted;
    if (on) motion.swell(vote);
    vote.disabled = true; comments.setVotePending(true); say(note); writeBusy(1);
    try {const result = await api.write(`/v1/ideas/${encodeURIComponent(state.id)}/vote`, 'PUT', {voted: on}, challenge); dataRevision++; views.clear(); update(result.idea);}
    catch (failure) {say(note, errorMessage(failure, 'vote'));}
    finally {vote.disabled = false; comments.setVotePending(false); writeBusy(-1);}
  });
  commentToggle.addEventListener('click', () => {
    comments.toggle(); commentToggle.setAttribute('aria-expanded', String(comments.isOpen()));
  });
  share.addEventListener('click', async event => {
    if (!navigator.clipboard?.writeText) return;   // the link still works as a link
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(new URL(share.href, location.href).href);
      clearTimeout(noteTimer);
      say(note, t('링크를 복사했어요.'), true);
      noteTimer = setTimeout(() => say(note), 2500);
    } catch {
      // Clipboard refused: show the permanent link in the address bar instead (no reload).
      history.replaceState(history.state, '', share.href);
      li.scrollIntoView({behavior: 'instant', block: 'nearest'});
    }
  });
  actions.append(commentToggle, share);
  content.append(head, text.node, text.toggle, reply, news, actions, challenge, note, comments.panel);
  li.append(vote, content);
  mountWash(actions, [commentToggle, share]);
  mountWash(text.toggle, [text.toggle]);
  const entry = {
    li, update, comments,
    state: () => state,
    keep: () => pinned || newlyPosted || vote.disabled || comments.hasDraft(),
    pin(value = true) {pinned = value; shared.hidden = !value;},
    markPosted() {newlyPosted = true;},
    pinned: () => pinned,
    // A row that left the list for good: stop its washes and observers; a later view renders it afresh.
    destroy() {
      [actions, text.toggle, reply, news].forEach(group => window.MARSelection?.destroy(group));
      resizeWatch?.unobserve(text.node); if (replyText) resizeWatch?.unobserve(replyText);
      clearTimeout(noteTimer);
      if (rendered.get(idea.id) === entry) rendered.delete(idea.id);
    }
  };
  rendered.set(idea.id, entry);
  return entry;
}

// ---------------------------------------------------------------------------------------------
// list views: sort x status, URL state, counts, states

const viewKey = () => `${status}|${sort}`;
const matchesView = idea => !status || idea.status === status;

function syncLocation() {
  const next = new URLSearchParams();
  if (sharedId) next.set('idea', sharedId);
  if (status) next.set('status', status);
  if (sort !== 'popular') next.set('sort', sort);
  const search = next.toString() ? '?' + next : '';
  if (search !== location.search) history.replaceState(history.state, '', location.pathname + search + location.hash);
  // Language links keep the same view on the other locale's board.
  document.querySelectorAll('.language-options a').forEach(link => {link.setAttribute('href', link.pathname + search + link.hash);});
}
function syncPressed() {
  sortButtons.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.sort === sort)));
  filterButtons.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.status === status)));
}
// Real counts from the API's first page. Zero tabs stay hidden (except the selected one); no counts, no row.
function showCounts(value) {
  const usable = value && typeof value === 'object' && ['all', ...STATUSES].every(key => Number.isFinite(value[key]));
  if (!usable) {counts = null; filter.hidden = true; return false;}
  counts = value;
  filterButtons.forEach(item => {
    const key = item.dataset.status || 'all';
    item.querySelector('[data-count]').textContent = number.format(counts[key]);
    item.hidden = key !== 'all' && counts[key] === 0 && key !== status;
  });
  filter.hidden = !STATUSES.some(key => counts[key] > 0) && !status;
  return true;
}
function bumpCount(key, change) {
  if (!counts) return;
  showCounts({...counts, [key]: counts[key] + change, all: counts.all + change});
}

const listParts = () => ({error: $('#list-error'), empty: $('#list-empty'), filtered: $('#list-empty-filtered'), loading: $('#list-loading'), note: $('#list-status')});
let retryFocus = false;
function hideListMessages() {
  const parts = listParts();
  // Hiding the error block would drop a focused "다시 불러오기" to <body>: hold focus on the board's title,
  // and give it back to the button if the error returns.
  if (!parts.error.hidden && parts.error.contains(document.activeElement)) {retryFocus = true; $('#ideas-title').focus({preventScroll: true});}
  parts.error.hidden = true; parts.empty.hidden = true; parts.filtered.hidden = true; say(parts.note);
}
// Rows that left the list and were not kept: their washes and observers stop (renderIdea's destroy).
function forgetDetached() {
  for (const entry of [...rendered.values()]) if (!entry.li.isConnected) entry.destroy();
}
function updateEmpty() {
  const {empty, filtered} = listParts();
  const none = ideaList.children.length === 0;
  empty.hidden = !(none && !status);
  filtered.hidden = !(none && status);
  filtered.querySelectorAll('[data-empty]').forEach(line => {line.hidden = line.dataset.empty !== status;});
}
function holdHeight() {ideaList.style.minHeight = ideaList.offsetHeight + 'px';}
function releaseHeight() {requestAnimationFrame(() => requestAnimationFrame(() => {ideaList.style.minHeight = '';}));}

function renderPage(result, {append, previous}) {
  const entries = result.ideas.map(item => renderIdea(item));
  const nodes = entries.map(entry => entry.li);
  if (append) {
    const fresh = nodes.filter(node => !previous.has(node) && node.parentNode !== ideaList);
    fresh.forEach(node => ideaList.append(node));
    motion.rise(fresh);
  } else {
    // Keep pinned, just posted and draft-bearing rows (and typed comment drafts) when the view changes.
    const keep = [...rendered.values()].filter(entry => entry.keep() && !nodes.includes(entry.li) && (entry.pinned() || matchesView(entry.state())));
    ideaList.replaceChildren(...keep.map(entry => entry.li), ...nodes);
    forgetDetached();
    const shown = [...ideaList.children];
    motion.dim(shown.filter(node => node.style.opacity), false);
    const fresh = shown.filter(node => !previous.has(node));
    if (firstRender) motion.rise(fresh); else motion.fade(fresh);
    firstRender = false;
  }
  cursor = result.next_cursor;
  $('#list-more').hidden = !cursor;
  updateEmpty();
}

async function loadIdeas({append = false, quiet = false, announce = false} = {}) {
  if (append && loading) return;
  if (!append) readController?.abort();
  const controller = readController = new AbortController();
  loading = true; failedAppend = append;
  const sequence = ++loadSequence, revision = dataRevision, key = viewKey();
  const previous = new Set(ideaList.children);
  const cached = !append && !quiet ? views.get(key) : null;
  const parts = listParts();
  hideListMessages();
  $('#list-more').disabled = true;
  if (!append) holdHeight();
  if (cached) renderPage(cached, {append: false, previous});
  ideaList.setAttribute('aria-busy', 'true');
  const loadingTimer = cached || quiet ? 0 : setTimeout(() => {
    // The first load's line is already in the page (.is-early, feedback.css): if its own delayed fade has begun,
    // leave it be; otherwise this timer takes it over.
    if (parts.loading.classList.contains('is-early')) {
      if (Number(getComputedStyle(parts.loading).opacity) > 0) return;
      parts.loading.classList.remove('is-early');
    }
    parts.loading.hidden = false; motion.appear(parts.loading, 220, 'cubic-bezier(.22,.61,.36,1)');
  }, 400);
  const dimTimer = !append && !cached && !quiet && previous.size ? setTimeout(() => motion.dim([...ideaList.children], true), 150) : 0;
  try {
    const result = await api.request(ideasPath({sort, status, cursor: append ? cursor : null}), {signal: controller.signal});
    if (sequence !== loadSequence) return;
    if (activeWrites || revision !== dataRevision) {
      await writesSettled();
      if (sequence !== loadSequence) return;
      loading = false; return loadIdeas({append, quiet});
    }
    if (!append) {
      if (!showCounts(result.counts) && status) {status = ''; syncPressed(); syncLocation();}
      views.set(viewKey(), result);
    }
    renderPage(result, {append, previous: cached ? new Set(ideaList.children) : previous});
    lastFailed = false; onlineRetried = false; lastLoadAt = Date.now(); retryFocus = false;
    // A new sort or filter changes the list without moving focus: say how many ideas it holds.
    if (announce) $('#list-live').textContent = t('의견 {count}개', {count: counts ? counts[status || 'all'] : result.ideas.length});
  } catch (error) {
    if (sequence !== loadSequence) return;
    if (error?.name === 'AbortError') {lastLoadAt = 0; return;}
    lastFailed = true;
    if (quiet) return;   // a quiet refresh keeps the rows of the last successful load
    if (!append) {
      // A cached or earlier view is never shown in place of a failed load; drafts stay.
      const keep = [...rendered.values()].filter(entry => entry.keep() && (entry.pinned() || matchesView(entry.state())));
      ideaList.replaceChildren(...keep.map(entry => entry.li));
      forgetDetached();
      motion.dim(keep.map(entry => entry.li), false);
      $('#list-more').hidden = true;
    }
    parts.error.hidden = false;
    motion.appear(parts.error);
    if (retryFocus) {retryFocus = false; $('#list-retry').focus({preventScroll: true});}
  } finally {
    clearTimeout(loadingTimer); clearTimeout(dimTimer);
    if (sequence === loadSequence) {
      loading = false; parts.loading.hidden = true; parts.loading.classList.remove('is-early');
      ideaList.removeAttribute('aria-busy');
      if (!append) releaseHeight();
      $('#list-more').disabled = activeWrites > 0;
    }
  }
}

function switchView() {
  syncPressed(); syncLocation();
  loadIdeas({announce: true});
}
sortButtons.forEach(control => control.addEventListener('click', () => {
  if (sort === control.dataset.sort || activeWrites) return;
  sort = control.dataset.sort; switchView();
}));
filterButtons.forEach(control => control.addEventListener('click', () => {
  if (status === control.dataset.status || activeWrites) return;
  status = control.dataset.status; switchView();
}));
$('#filter-reset').addEventListener('click', () => {
  status = ''; switchView(); filterButtons[0].focus();
});
$('#list-retry').addEventListener('click', () => loadIdeas({append: failedAppend}));
$('#list-more').addEventListener('click', () => loadIdeas({append: true}));
window.addEventListener('online', () => {
  if (lastFailed && !onlineRetried) {onlineRetried = true; loadIdeas({append: failedAppend});}
});
// Back/forward cache: abort reads on leave; refresh quietly when shown again after a minute.
window.addEventListener('pagehide', () => readController?.abort());
window.addEventListener('pageshow', event => {
  if (event.persisted && (lastFailed || Date.now() - lastLoadAt > 60000)) loadIdeas({quiet: !lastFailed && ideaList.children.length > 0});
});

// ---------------------------------------------------------------------------------------------
// compose: deep link, session draft, success

const ideaForm = $('#idea-form');
const ideaBody = $('#idea-body'), ideaNickname = $('#idea-nickname');
function storage(action) {try {return action(sessionStorage);} catch {return null;}}
let draftTimer = 0;
function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => storage(store => {
    if (ideaBody.value || ideaNickname.value) store.setItem(DRAFT_KEY, JSON.stringify({nickname: ideaNickname.value, body: ideaBody.value}));
    else store.removeItem(DRAFT_KEY);
  }), 300);
}
const ideaCounter = wireForm(ideaForm, {limit: 2000, counter: $('#idea-counter'), live: $('#idea-live'), message: $('#idea-status'), challenge: $('#idea-challenge'), endpoint: '/v1/ideas',
  onInput: saveDraft,
  onSuccess: result => {
    clearTimeout(draftTimer); storage(store => store.removeItem(DRAFT_KEY));
    const entry = renderIdea(result.idea); entry.markPosted();
    // Close the form at once (no height transition), so the new row can be scrolled to and stays in view.
    compose.classList.add('is-instant'); compose.open = false; void compose.offsetHeight; compose.classList.remove('is-instant');
    if (location.hash === '#new-idea') history.replaceState(history.state, '', location.pathname + location.search);
    bumpCount(result.idea.status, 1);
    hideListMessages();
    ideaList.prepend(entry.li);
    entry.li.scrollIntoView({behavior: 'instant', block: 'center'}); entry.li.focus({preventScroll: true});
    motion.arrive(entry.li);
    views.clear();
    if (status && !matchesView(result.idea)) {status = ''; switchView();}
  }
});
const restored = storage(store => JSON.parse(store.getItem(DRAFT_KEY) || 'null'));
if (restored && typeof restored.body === 'string') {
  ideaBody.value = restored.body.slice(0, 4000);
  ideaNickname.value = typeof restored.nickname === 'string' ? restored.nickname.slice(0, 80) : '';
  ideaCounter.count();
  if (ideaBody.value) compose.open = true;
}
// Opened from a link or button: open at once (no height transition), so the field is rendered and takes focus now.
function showCompose() {
  compose.classList.add('is-instant'); compose.open = true; void compose.offsetHeight; compose.classList.remove('is-instant');
  compose.scrollIntoView({behavior: 'instant', block: 'start'}); ideaBody.focus({preventScroll: true});
}
function openCompose() {
  if (location.hash !== '#new-idea') return;
  showCompose();
  // On a fresh load the browser applies the fragment when loading completes, and clears focus because
  // <details> cannot take it: put the caret back unless the visitor has moved on.
  if (document.readyState !== 'complete') addEventListener('load', () => requestAnimationFrame(() => {
    if (compose.open && document.activeElement === document.body) ideaBody.focus({preventScroll: true});
  }), {once: true});
}
window.addEventListener('hashchange', openCompose);
// While the form is open its own submit is the one Oat button: the summary becomes the quiet "작성 닫기".
const composeToggle = compose.querySelector('summary');
function syncComposeToggle() {composeToggle.textContent = compose.open ? t('작성 닫기') : t('의견 남기기');}
compose.addEventListener('toggle', syncComposeToggle);
syncComposeToggle();
$('#empty-compose').addEventListener('click', event => {event.preventDefault(); showCompose();});

// ---------------------------------------------------------------------------------------------
// boot

syncPressed();
syncLocation();
openCompose();
await loadIdeas();
if (sharedId) {
  try {
    let entry = rendered.get(sharedId);
    if (!entry) {
      const result = await api.request('/v1/ideas/' + encodeURIComponent(sharedId));
      // A concurrent list load may already have mounted this item and accepted
      // a write. Its live node takes precedence over this older detail response.
      entry = rendered.get(sharedId) || renderIdea(result.idea);
    }
    entry.pin();
    hideListMessages();
    ideaList.prepend(entry.li);
    updateEmpty();
    entry.li.scrollIntoView({behavior: 'instant', block: 'center'}); entry.li.focus({preventScroll: true});
    // Measured before the comments open, so the wash keeps the row's shape instead of stretching over the panel;
    // held long enough to be seen while the page settles.
    motion.wash(entry.li, {hold: 1200, fade: 800, height: entry.li.getBoundingClientRect().height});
    if (entry.state().comment_count > 0) {entry.comments.open(); entry.li.querySelector('[aria-controls]')?.setAttribute('aria-expanded', 'true');}
  } catch (error) {
    // With the list already showing its error block, a second identical sentence adds nothing.
    if (error.code === 'not_found' || $('#list-error').hidden) say($('#list-status'), readErrorMessage(error));
  }
}
