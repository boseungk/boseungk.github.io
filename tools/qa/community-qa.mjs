// Community pages QA (owner D): 기능 제안 (/feedback/) and 새 소식 (/news/) against the local API.
//   N=<node-executable>
//   $N tools/qa/community-qa.mjs [--base http://127.0.0.1:8765] [--out <dir>] [--only matrix,filter,...] [--live-writes] [--json]
// Needs the static site on --base (docs/, built with --only feedback,news) and the API on 127.0.0.1:8789 with
// services/feedback/seed/local.sql loaded. Drives the Chrome already running on CDP :9333 (tools/qa/cdp.mjs);
// never launches one, and closes every target it opens.
// Writes (vote, new idea) are answered by request interception, so the seeded database is left as it was;
// --live-writes sends them to the API instead (Turnstile test key; leaves a visitor and toggles a vote back).
// Exit code 1 when any check fails. In draft builds /ar/ and /de/ show Korean fallbacks: repeat after translation.
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withPage, parseArgs, sleep, PROBES } from './cdp.mjs';

const { f } = parseArgs(process.argv.slice(2));
const BASE = (f.base || 'http://127.0.0.1:8765').replace(/\/$/, '');
const API = 'http://127.0.0.1:8789';
const OUT = f.out || join(tmpdir(), 'community-qa');
const ONLY = f.only ? String(f.only).split(',') : null;
const LIVE = !!f['live-writes'];
mkdirSync(OUT, { recursive: true });

const ID = (n) => `5eed0000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const VIEWS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844, mobile: true, dpr: 2 }, small: { width: 375, height: 667, mobile: true, dpr: 2 } };
const results = [];
const check = (group, name, ok, detail) => results.push({ group, name, ok: !!ok, detail });
const $ = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
const rows = `[...document.querySelectorAll('#idea-list > li')]`;
const errorsOf = (p) => [...p.log.console.filter((l) => l.startsWith('error') || l.startsWith('log-error')), ...p.log.exceptions];

async function waitFor(p, expression, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await p.eval(expression).catch(() => false)) return true; await sleep(50); }
  return false;
}
async function enter(p, modifiers = 0) {
  await p.c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r', modifiers });
  await p.c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers });
}

// API interception. request(req) returns 'fail', {status, body} to answer, or nothing to pass through;
// response(json, url) rewrites API responses. Preflights always reach the real API.
const CORS = [['content-type', 'application/json'], ['access-control-allow-origin', BASE], ['access-control-allow-credentials', 'true'], ['cache-control', 'no-store']].map(([name, value]) => ({ name, value }));
async function route(p, { request, response } = {}) {
  const state = { request, response };
  const patterns = [{ urlPattern: API + '/*', requestStage: 'Request' }];
  if (response) patterns.push({ urlPattern: API + '/*', requestStage: 'Response' });
  await p.c.send('Fetch.enable', { patterns });
  p.c.on(async (m) => {
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId, request: req, responseStatusCode, responseHeaders } = m.params;
    try {
      if (responseStatusCode === undefined) {
        const act = req.method !== 'OPTIONS' && state.request?.(req);
        if (act === 'fail') return await p.c.send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
        if (act) return await p.c.send('Fetch.fulfillRequest', { requestId, responseCode: act.status || 200, responseHeaders: CORS, body: Buffer.from(JSON.stringify(act.body)).toString('base64') });
        return await p.c.send('Fetch.continueRequest', { requestId });
      }
      const raw = await p.c.send('Fetch.getResponseBody', { requestId });
      let text = raw.base64Encoded ? Buffer.from(raw.body, 'base64').toString() : raw.body;
      if (state.response) try { text = JSON.stringify(state.response(JSON.parse(text), req.url)); } catch {}
      await p.c.send('Fetch.fulfillRequest', { requestId, responseCode: responseStatusCode, responseHeaders, body: Buffer.from(text).toString('base64') });
    } catch { /* the target is closing */ }
  });
  return state;
}
async function apiIdea(id) {
  const res = await fetch(`${API}/v1/ideas/${id}`, { headers: { origin: BASE } });
  if (!res.ok) throw new Error(`API ${res.status} for idea ${id}: is the API on :8789 running and seeded?`);
  return (await res.json()).idea;
}

// ---- in-page probes -------------------------------------------------------------------------
const LAYOUT = `(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height } : null; };
  const hit = (a, b) => a && b && a.l < b.r - .5 && b.l < a.r - .5 && a.t < b.b - .5 && b.t < a.b - .5;
  const head = { wordmark: box(document.querySelector('.bar .wordmark')), store: box([...document.querySelectorAll('.bar a.store[href]')].find((a) => a.checkVisibility())), picker: box(document.querySelector('.bar .language-picker > summary')) };
  const overlaps = [['wordmark', 'store'], ['wordmark', 'picker'], ['store', 'picker']].filter(([a, b]) => hit(head[a], head[b])).map((x) => x.join('/'));
  const small = [];
  for (const el of document.querySelectorAll('a[href], button, summary, input, textarea, select')) {
    if (!el.checkVisibility({ visibilityProperty: true }) || el.closest('[inert], .sr-only')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'inline' || el.closest('.feedback-body, .feedback-reply__body')) continue;   // links inside running text
    if (el.classList.contains('skip-link') && el.getBoundingClientRect().bottom <= 0) continue;
    const r = el.getBoundingClientRect(); if (!r.width || r.height >= 43.5) continue;
    small.push((el.closest('.bar, .foot') ? 'chrome:' : '') + el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(r.height) + 'px "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 16) + '"');
  }
  // Band: the cat (art rows 310..431 of 524 at 2560 wide, x 1201..1346) is inside the band and above the sheet.
  const band = document.querySelector('.community-band'), img = band?.querySelector('img'), sheet = document.querySelector('.community-sheet');
  let cat = null;
  if (img && sheet) {
    const b = band.getBoundingClientRect(), sc = Math.max(b.width / 2560, b.height / 524), w = 2560 * sc, h = 524 * sc;
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(parseFloat);
    const x0 = b.left + (b.width - w) * (px / 100), y0 = b.top + py;
    cat = { top: Math.round(y0 + 310 * sc - b.top), paws: Math.round(y0 + 431 * sc), sheetTop: Math.round(sheet.getBoundingClientRect().top), left: Math.round(x0 + 1201 * sc), right: Math.round(x0 + 1346 * sc), width: Math.round(b.width), loaded: img.complete && img.naturalWidth > 0 };
    cat.ok = cat.loaded && cat.top >= -1 && cat.paws <= cat.sheetTop + 1 && cat.left >= 0 && cat.right <= cat.width;
  }
  return { bars: document.querySelectorAll('header.bar').length, foots: document.querySelectorAll('footer.foot').length, overlaps, small, cat, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
})()`;

// ---- scenarios ------------------------------------------------------------------------------
const scenarios = {
  async matrix() {
    const cells = [];
    for (const path of ['/feedback/', '/news/']) for (const view of Object.keys(VIEWS)) cells.push([path, view]);
    for (const path of ['/ar/feedback/', '/de/feedback/']) for (const view of ['phone', 'small']) cells.push([path, view]);
    for (const [path, view] of cells) {
      await withPage(VIEWS[view], async (p) => {
        await p.goto(BASE + path, { settle: 1500 });
        if (path.endsWith('/feedback/')) await waitFor(p, `${rows}.length > 0`);
        await p.scrollThrough({ step: 0.8, delay: 150, max: 30 }); await p.scrollTo(0); await sleep(300);
        const L = await p.eval(LAYOUT), banned = await p.eval(PROBES.banned);
        const name = `${path.replace(/\//g, '_').replace(/^_|_$/g, '') || 'root'}-${view}`;
        await p.shot(join(OUT, name + '.png'));
        await p.shot(join(OUT, name + '-full.jpg'), { full: true, quality: 70 });
        const where = `${path} ${view}`;
        check('matrix', `${where}: one header.bar and one footer.foot`, L.bars === 1 && L.foots === 1, `${L.bars}/${L.foots}`);
        check('matrix', `${where}: header boxes do not intersect`, !L.overlaps.length, L.overlaps.join(', ') || 'none');
        // The plan's header rule (44px targets) is stated for phone widths; desktop header targets belong to the chrome.
        const small = view === 'desktop' ? L.small.filter((x) => !x.startsWith('chrome:')) : L.small;
        check('matrix', `${where}: tap targets 44px or taller`, !small.length, small.join('; ') || 'all');
        check('matrix', `${where}: cat inside the band, above the sheet`, L.cat?.ok, JSON.stringify(L.cat));
        check('matrix', `${where}: no horizontal overflow`, !L.overflow);
        check('matrix', `${where}: no banned styles`, !Object.values(banned.counts).some(Boolean), JSON.stringify(banned.counts));
        check('matrix', `${where}: no console errors or 4xx`, !errorsOf(p).length && !p.log.http4xx.length && !p.log.failed.length, [...errorsOf(p), ...p.log.http4xx, ...p.log.failed].join(' | ') || 'clean');
        if (path === '/feedback/') {
          // Links inside running text (notes, reply text) wrap across lines, where a wash cannot follow: underline, no
          // wash label. The standalone 최근 소식 link keeps its wash.
          const k = await p.eval(`(() => { const inline = [...document.querySelectorAll('.feedback-note a, .feedback-reply__body a')]; const latest = document.querySelector('.feedback-latest a'); return { inline: inline.length, washed: inline.filter((a) => a.classList.contains('mar-choice-group') || a.querySelector('.mar-choice-label')).length, plain: inline.filter((a) => getComputedStyle(a).textDecorationLine !== 'underline').length, latest: !!latest && latest.classList.contains('mar-choice-group') && !!latest.querySelector('.mar-choice-label') }; })()`);
          check('matrix', `${where}: running-text links underlined without a wash; 최근 소식 link washed`, k.inline > 0 && !k.washed && !k.plain && k.latest, JSON.stringify(k));
        }
      });
    }
  },

  async motion() {
    await withPage(VIEWS.desktop, async (p) => {
      await p.goto(BASE + '/feedback/', { settle: 0 });
      await waitFor(p, `${rows}.length > 0`);
      const t0 = Date.now(); let anims = 0;
      while (Date.now() - t0 < 100 && !anims) anims = await p.eval('document.getAnimations().length');
      check('motion', 'first load: rows rise (animations within 100 ms of the list)', anims > 0, `${anims} animations`);
    });
    await withPage({ ...VIEWS.desktop, reducedMotion: true }, async (p) => {
      await p.goto(BASE + '/feedback/', { settle: 0 });
      await waitFor(p, `${rows}.length > 0`); await sleep(400);
      const r = await p.eval(`({ anims: document.getAnimations().length, minOpacity: Math.min(...${rows}.map((li) => +getComputedStyle(li).opacity)) })`);
      check('motion', 'reduced motion: no animations after load, every row at opacity 1', r.anims === 0 && r.minOpacity === 1, JSON.stringify(r));
      await p.eval(`${$('.feedback-filter [data-status=planned]')}.click()`); await sleep(700);
      await p.eval(`document.querySelector('#idea-list > li [aria-controls]').click()`); await sleep(100);
      const after = await p.eval(`({ anims: document.getAnimations().length, open: document.querySelector('#idea-list > li .feedback-comments').classList.contains('is-open') })`);
      check('motion', 'reduced motion: filter and comments open without animation', after.anims === 0 && after.open, JSON.stringify(after));
    });
    await withPage({ ...VIEWS.desktop, reducedMotion: true }, async (p) => {
      await p.goto(BASE + '/news/', { settle: 600 });
      const r = await p.eval(`({ rv: document.documentElement.classList.contains('rv'), anims: document.getAnimations().length, hidden: [...document.querySelectorAll('.reveal')].filter((e) => +getComputedStyle(e).opacity < 1).length })`);
      check('motion', 'news under reduced motion: entries shown as written', !r.rv && r.anims === 0 && r.hidden === 0, JSON.stringify(r));
    });
  },

  async filter() {
    await withPage(VIEWS.desktop, async (p) => {
      const gets = [];
      p.c.on((m) => { if (m.method === 'Network.requestWillBeSent' && m.params.request.method === 'GET' && m.params.request.url.startsWith(API + '/v1/ideas?')) gets.push(m.params.request.url.slice(API.length)); });
      await p.goto(BASE + '/feedback/', { settle: 0 });
      await waitFor(p, `${rows}.length > 0 && !${$('.feedback-filter')}.hidden`);
      const tabs = await p.eval(`[...document.querySelectorAll('.feedback-filter button')].filter((b) => !b.hidden).map((b) => b.textContent.replace(/\\s+/g, ' ').trim())`);
      check('filter', 'status tabs show real counts', tabs.length >= 2 && tabs.every((t) => /\d/.test(t)), tabs.join(' | '));
      await p.eval(`${$('.feedback-filter [data-status=completed]')}.click()`);
      await waitFor(p, `location.search.includes('status=completed') && ${rows}.length > 0 && ${rows}.every((li) => li.dataset.status === 'completed')`);
      const r = await p.eval(`({ search: location.search, statuses: [...new Set(${rows}.map((li) => li.dataset.status))], lang: ${$('.language-options a[lang=en]')}?.getAttribute('href') })`);
      check('filter', '반영 완료: every row completed, URL ?status=completed', r.search.includes('status=completed') && r.statuses.join() === 'completed', JSON.stringify(r));
      check('filter', 'language links keep the view', /status=completed/.test(r.lang || ''), r.lang);
      await p.eval(`${$('.feedback-controls')}.scrollIntoView({ block: 'start' }); scrollBy(0, -80)`); await sleep(400);
      await p.shot(join(OUT, 'filter-completed-1440.png'));
      const before = gets.length;
      const immediate = await p.eval(`(() => { ${$('.feedback-filter [data-status=""]')}.click(); return ${rows}.length; })()`);
      await sleep(1200);
      check('filter', '전체 again: renders at once from the view cache', immediate > 3, `${immediate} rows synchronously`);
      check('filter', '전체 again: exactly one revalidation request', gets.length - before === 1, gets.slice(before).join(', '));
    });
  },

  async vote() {
    const id = ID(5), base = await apiIdea(id);
    await withPage(VIEWS.desktop, async (p) => {
      if (!LIVE) await route(p, { request: (req) => req.method === 'PUT' && req.url.endsWith(`/v1/ideas/${id}/vote`) && (() => { const on = JSON.parse(req.postData || '{}').voted; return { body: { idea: { ...base, voted: on, vote_count: base.vote_count + (on ? 1 : 0) } } }; })() });
      await p.goto(BASE + '/feedback/', { settle: 0 });
      await waitFor(p, `!!document.getElementById('idea-${id}')`); await sleep(800);
      await p.eval(`document.getElementById('idea-${id}').scrollIntoView({ block: 'center' })`); await sleep(200);
      const count = `+document.querySelector('#idea-${id} .feedback-vote__count').textContent.trim()`;
      const swells = `document.getAnimations().filter((a) => a.effect?.target?.closest?.('#idea-${id} .feedback-vote') && JSON.stringify(a.effect.getKeyframes()).includes('scale')).length`;
      const c0 = await p.eval(count);
      await p.eval(`window.__swell = 0; (function watch() { window.__swell = Math.max(window.__swell, ${swells}); if (performance.now() < window.__until) requestAnimationFrame(watch); })(window.__until = performance.now() + 4000); document.querySelector('#idea-${id} .feedback-vote').click()`);
      await waitFor(p, `document.querySelector('#idea-${id} .feedback-vote').getAttribute('aria-pressed') === 'true'`, 15000); await sleep(500);
      const on = await p.eval(`({ pressed: document.querySelector('#idea-${id} .feedback-vote').getAttribute('aria-pressed'), count: ${count}, swell: window.__swell })`);
      check('vote', 'vote on: pressed, count +1, swell', on.pressed === 'true' && on.count === c0 + 1 && on.swell > 0, JSON.stringify({ from: c0, ...on }));
      await sleep(400);
      await p.eval(`window.__swell = 0; window.__until = performance.now() + 1500; (function watch() { window.__swell = Math.max(window.__swell, ${swells}); if (performance.now() < window.__until) requestAnimationFrame(watch); })(); document.querySelector('#idea-${id} .feedback-vote').click()`);
      await waitFor(p, `document.querySelector('#idea-${id} .feedback-vote').getAttribute('aria-pressed') === 'false'`, 10000); await sleep(1600);
      const off = await p.eval(`({ count: ${count}, swell: window.__swell })`);
      check('vote', 'vote off: count back, no swell', off.count === c0 && off.swell === 0, JSON.stringify(off));
      check('vote', 'no console errors', !errorsOf(p).length, errorsOf(p).join(' | ') || 'clean');
    });
  },

  async compose() {
    const body = '커뮤니티 QA: 방 꾸미기를 저장해 두고 다시 불러오면 좋겠어요.';
    const fresh = { id: 'c0ffee00-0000-4000-8000-000000000001', nickname: '', body, status: 'open', created_at: new Date().toISOString(), vote_count: 0, comment_count: 0, voted: false, operator_reply: null };
    await withPage(VIEWS.desktop, async (p) => {
      if (!LIVE) await route(p, { request: (req) => req.method === 'POST' && req.url === API + '/v1/ideas' ? { status: 201, body: { idea: fresh } } : null });
      await p.c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await p.goto(BASE + '/feedback/#new-idea', { settle: 0 });
      await waitFor(p, `document.activeElement?.id === 'idea-body'`, 6000);
      check('compose', '#new-idea opens the form and focuses the field', await p.eval(`${$('#new-idea')}.open && document.activeElement.id === 'idea-body'`));
      await p.c.send('Input.insertText', { text: body }); await sleep(600);
      await p.goto(BASE + '/feedback/', { settle: 0 });
      await waitFor(p, `${rows}.length > 0`);
      const restored = await p.eval(`({ open: ${$('#new-idea')}.open, same: ${$('#idea-body')}.value === ${JSON.stringify(body)} })`);
      check('compose', 'draft restored after reload (form open)', restored.open && restored.same, JSON.stringify(restored));
      await p.eval(`${$('#idea-body')}.focus()`);
      await enter(p, process.platform === 'darwin' ? 4 : 2);
      await waitFor(p, `!!document.activeElement?.matches?.('#idea-list > li:first-child')`, 15000);
      await sleep(120);
      const r = await p.eval(`({ first: document.querySelector('#idea-list > li')?.id, focused: document.activeElement?.matches?.('#idea-list > li:first-child'), wash: document.getAnimations().some((a) => a.effect?.target?.closest?.('#idea-list > li:first-child')), closed: !${$('#new-idea')}.open, draft: sessionStorage.getItem('mar-feedback-draft-v1') })`);
      check('compose', '⌘/Ctrl+Enter posts: new row first, focused, washed; form closed; draft cleared', r.focused && r.wash && r.closed && !r.draft && (LIVE || r.first === 'idea-' + fresh.id), JSON.stringify(r));
      check('compose', 'no console errors', !errorsOf(p).length, errorsOf(p).join(' | ') || 'clean');
    });
  },

  async comments() {
    await withPage(VIEWS.desktop, async (p) => {
      await p.c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await p.goto(BASE + '/feedback/?sort=latest', { settle: 0 });
      await waitFor(p, `${rows}.length > 0`);
      for (let i = 0; i < 3 && !(await p.eval(`!!document.getElementById('idea-${ID(1)}') && !!document.getElementById('idea-${ID(13)}')`)); i++) { await p.eval(`${$('#list-more')}.click()`); await sleep(900); }
      await p.eval(`document.querySelector('#idea-${ID(1)} [aria-controls]').click()`);
      await waitFor(p, `document.querySelectorAll('#comments-${ID(1)} .feedback-comment').length > 0`);
      const first = await p.eval(`document.querySelectorAll('#comments-${ID(1)} .feedback-comment').length`);
      await p.eval(`[...document.querySelectorAll('#comments-${ID(1)} button')].find((b) => b.textContent.includes('더 보기'))?.click()`);
      await waitFor(p, `document.querySelectorAll('#comments-${ID(1)} .feedback-comment').length > ${first}`);
      const all = await p.eval(`document.querySelectorAll('#comments-${ID(1)} .feedback-comment').length`);
      check('comments', 'comments open 20, then 23 after 더 보기', first === 20 && all === 23, `${first} → ${all}`);
      await p.eval(`document.getElementById('idea-${ID(1)}').scrollIntoView({ block: 'start' }); scrollBy(0, -90)`); await sleep(400);
      await p.shot(join(OUT, 'comments-open-1440.png'));
      const link = await p.eval(`document.querySelector('#idea-${ID(13)} .feedback-reply__body a')?.getAttribute('href') || null`);
      check('comments', 'operator reply links its news entry', /news\/#feedback-board$/.test(link || ''), link);
      await p.eval(`document.querySelector('#idea-${ID(13)} .feedback-reply__more').click()`);
      await waitFor(p, `document.activeElement?.id === 'comment-5eed0002-0000-4000-8000-000000000005'`);
      check('comments', '답변 전체 보기 focuses the latest reply', await p.eval(`document.activeElement.id`) === 'comment-5eed0002-0000-4000-8000-000000000005', await p.eval('document.activeElement.id'));
      await p.eval(`document.getElementById('idea-${ID(2)}').scrollIntoView({ block: 'start' }); scrollBy(0, -90)`); await sleep(300);
      await p.shot(join(OUT, 'operator-reply-1440.png'));
      // copy link
      await p.c.send('Browser.grantPermissions', { origin: BASE, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
      await p.eval(`document.querySelector('#idea-${ID(2)} .feedback-share').click()`); await sleep(400);
      const copied = await p.eval(`navigator.clipboard.readText().catch((e) => 'ERR ' + e.message)`);
      check('comments', 'copy link writes the idea URL', copied === `${BASE}/feedback/?idea=${ID(2)}#idea-${ID(2)}`, copied);
      check('comments', 'no console errors', !errorsOf(p).length, errorsOf(p).join(' | ') || 'clean');
    });
  },

  async keyboard() {
    await withPage(VIEWS.desktop, async (p) => {
      await p.c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await p.goto(BASE + '/feedback/', { settle: 0 });
      await waitFor(p, `${rows}.length > 0 && !${$('.feedback-filter')}.hidden`); await sleep(600);
      const stops = [];
      for (let i = 0; i < 24; i++) { await p.tab(); stops.push(await p.eval(`(() => { const a = document.activeElement, s = getComputedStyle(a); return { el: a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0], ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 }; })()`)); }
      const bare = stops.filter((s) => !s.ring).map((s) => s.el);
      check('keyboard', 'every Tab stop shows a focus ring', !bare.length, bare.join(', ') || `${stops.length} stops`);
      await p.eval(`${$('.feedback-filter [data-status=planned]')}.focus()`); await enter(p);
      await waitFor(p, `location.search.includes('status=planned') && ${rows}.length > 0 && ${rows}.every((li) => li.dataset.status === 'planned')`);
      check('keyboard', 'Enter on a status tab filters', await p.eval(`location.search.includes('status=planned') && document.activeElement.dataset.status === 'planned'`));
      await p.eval(`document.querySelector('#idea-list > li [aria-controls]').focus()`);
      await p.key(' ', 'Space', 32); await sleep(500);
      check('keyboard', 'Space opens comments; closed panels are inert', await p.eval(`(() => { const t = document.querySelector('#idea-list > li [aria-controls]'), panel = document.getElementById(t.getAttribute('aria-controls')); return t.getAttribute('aria-expanded') === 'true' && !panel.inert && [...document.querySelectorAll('.feedback-comments:not(.is-open)')].every((x) => x.inert); })()`));
      await p.eval(`${$('.feedback-compose-toggle')}.focus()`); await enter(p); await sleep(400);
      await p.eval(`${$('#idea-body')}.focus()`); await enter(p, 2); await sleep(300);
      const v = await p.eval(`({ open: ${$('#new-idea')}.open, invalid: ${$('#idea-body')}.getAttribute('aria-invalid'), message: ${$('#idea-status')}.textContent })`);
      check('keyboard', 'Enter opens the form; Ctrl+Enter on an empty form reports, sends nothing', v.open && v.invalid === 'true' && v.message, JSON.stringify(v));
      await p.goto(BASE + '/feedback/', { settle: 600 }); await p.tab(); await enter(p); await sleep(200);
      check('keyboard', 'skip link moves focus to main', await p.eval('document.activeElement.id') === 'main');
      await p.shot(join(OUT, 'keyboard-1440.png'));
    });
  },

  async states() {
    // filter with nothing in it, straight from the URL
    await withPage(VIEWS.desktop, async (p) => {
      await route(p, { request: (req) => req.method === 'GET' && req.url.includes('/v1/ideas?') ? { body: { ideas: [], next_cursor: null, counts: { all: 26, open: 16, reviewing: 4, planned: 3, completed: 0 } } } : null });
      await p.goto(BASE + '/feedback/?status=completed', { settle: 1500 });
      const r = await p.eval(`({ selectedShown: !${$('.feedback-filter [data-status=completed]')}.hidden, filtered: !${$('#list-empty-filtered')}.hidden, empty: !${$('#list-empty')}.hidden, error: !${$('#list-error')}.hidden })`);
      check('states', 'filter with 0: its tab stays, filtered empty line, no empty-board art', r.selectedShown && r.filtered && !r.empty && !r.error, JSON.stringify(r));
      await p.eval(`${$('.feedback-controls')}.scrollIntoView({ block: 'start' }); scrollBy(0, -120)`); await sleep(300);
      await p.shot(join(OUT, 'empty-filtered-1440.png'));
    });
    // an empty board
    await withPage(VIEWS.phone, async (p) => {
      await route(p, { request: (req) => req.method === 'GET' && req.url.includes('/v1/ideas?') ? { body: { ideas: [], next_cursor: null, counts: { all: 0, open: 0, reviewing: 0, planned: 0, completed: 0 } } } : null });
      await p.goto(BASE + '/feedback/', { settle: 1500 });
      const r = await p.eval(`({ filterHidden: ${$('.feedback-filter')}.hidden, empty: !${$('#list-empty')}.hidden })`);
      check('states', 'empty board: no filter row, empty state with its vignette', r.filterHidden && r.empty, JSON.stringify(r));
      await p.eval(`${$('#list-empty')}.scrollIntoView({ block: 'center' })`); await sleep(500);
      await p.shot(join(OUT, 'empty-all-390.png'));
    });
    // API down, then back
    await withPage(VIEWS.desktop, async (p) => {
      const r0 = await route(p, { request: () => 'fail' });
      await p.goto(BASE + '/feedback/', { settle: 1800 });
      const r = await p.eval(`({ error: !${$('#list-error')}.hidden, empty: !${$('#list-empty')}.hidden, emptyCta: !!${$('#empty-compose')}.checkVisibility(), rows: ${rows}.length })`);
      check('states', 'API down: list error, never the empty board or its call to write', r.error && !r.empty && !r.emptyCta && r.rows === 0, JSON.stringify(r));
      await p.eval(`${$('.feedback-controls')}.scrollIntoView({ block: 'start' }); scrollBy(0, -120)`); await sleep(300);
      await p.shot(join(OUT, 'error-1440.png'));
      r0.request = null;
      await p.eval(`window.dispatchEvent(new Event('online'))`);
      await waitFor(p, `${rows}.length > 0`);
      const back = await p.eval(`({ error: !${$('#list-error')}.hidden, rows: ${rows}.length })`);
      check('states', 'online retries once and shows the list', !back.error && back.rows > 0, JSON.stringify(back));
    });
    // Short boards on a tall screen (iPad Pro portrait): the sheet holds a screen, so the footer starts below the fold
    // and stays there when the list lets go (CLS).
    const seeded = await (await fetch(`${API}/v1/ideas?sort=popular`, { headers: { origin: BASE } })).json();
    const zero = { all: 0, open: 0, reviewing: 0, planned: 0, completed: 0 };
    for (const [name, answer] of [
      ['empty board', { body: { ideas: [], next_cursor: null, counts: zero } }],
      ['one idea', { body: { ideas: seeded.ideas.slice(0, 1), next_cursor: null, counts: { ...zero, all: 1, open: 1 } } }],
      ['API down', 'fail'],
    ]) {
      await withPage({ width: 1024, height: 1366 }, async (p) => {
        await p.c.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__cls=0;new PerformanceObserver((l)=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});` });
        await route(p, { request: (req) => req.method === 'GET' && req.url.includes('/v1/ideas?') ? answer : null });
        await p.goto(BASE + '/feedback/', { settle: 2200 });
        const r = await p.eval(`({ cls: +window.__cls.toFixed(4), footer: Math.round(document.querySelector('footer.foot').getBoundingClientRect().top), vh: innerHeight, rows: ${rows}.length })`);
        check('states', `${name} at 1024x1366: CLS < 0.05, footer below the fold`, r.cls < 0.05 && r.footer >= r.vh, JSON.stringify(r));
      });
    }
    // The module graph fails to load (client.mjs 404; the API is not reached): no loading line left up, no held screen,
    // no compose or toolbar that cannot work; the load error shows without its retry button.
    await withPage(VIEWS.desktop, async (p) => {
      await p.intercept([{ match: '/assets/feedback/client.mjs', status: 404, body: 'missing' }]);
      await p.goto(BASE + '/feedback/', { settle: 2000 });
      const r = await p.eval(`(() => { const shown = (s) => !!document.querySelector(s)?.checkVisibility(); return { off: document.documentElement.classList.contains('feedback-off'), loading: shown('#list-loading'), compose: shown('#new-idea'), controls: shown('.feedback-controls'), error: shown('#list-error'), retry: shown('#list-retry'), list: Math.round(document.querySelector('#idea-list').getBoundingClientRect().height) }; })()`);
      check('states', 'module load failure: load error, no loading line, compose, toolbar or held screen', r.off && r.error && !r.loading && !r.compose && !r.controls && !r.retry && r.list === 0, JSON.stringify(r));
      await p.shot(join(OUT, 'module-fail-1440.png'));
    });
    // the old API: no counts, no operator_reply
    await withPage(VIEWS.desktop, async (p) => {
      await route(p, { response: (json) => { delete json.counts; for (const idea of json.ideas || []) delete idea.operator_reply; if (json.idea) delete json.idea.operator_reply; return json; } });
      await p.goto(BASE + '/feedback/?status=completed', { settle: 0 });
      await waitFor(p, `${rows}.length > 0`); await sleep(600);
      const r = await p.eval(`({ filterHidden: ${$('.feedback-filter')}.hidden, replies: [...document.querySelectorAll('.feedback-reply')].filter((x) => x.checkVisibility()).length, status: new URLSearchParams(location.search).get('status') })`);
      check('states', 'old API: no filter row, no reply block, no errors', r.filterHidden && r.replies === 0 && !errorsOf(p).length, JSON.stringify({ ...r, errors: errorsOf(p) }));
    });
  },

  async news() {
    await withPage(VIEWS.desktop, async (p) => {
      await p.goto(BASE + '/news/', { settle: 800 });
      await p.scrollThrough({ step: 0.7, delay: 250, max: 20 });
      const r = await p.eval(`(() => { const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((x) => { try { return JSON.parse(x.textContent); } catch { return null; } }).find((x) => x?.['@type'] === 'ItemList'); const entries = [...document.querySelectorAll('.news-entry')];
        return { entries: entries.length, shown: entries.filter((e) => e.classList.contains('in')).length, ld: ld?.['@type'], items: ld?.itemListElement?.length, ids: entries.map((e) => e.id) }; })()`);
      check('news', 'entries revealed; ItemList JSON-LD lists every entry', r.entries > 0 && r.shown === r.entries && r.ld === 'ItemList' && r.items === r.entries, JSON.stringify(r));
    });
    await withPage(VIEWS.desktop, async (p) => {
      await p.goto(BASE + '/feedback/', { settle: 0 });
      await waitFor(p, `${rows}.length > 0`);
      const r = await p.eval(`(() => { const a = document.querySelector('.feedback-latest a'); return a ? { href: a.getAttribute('href'), text: a.textContent } : null; })()`);
      check('news', '최근 소식 links the newest entry', !!r && /\/news\/#[a-z0-9-]+$/.test(r.href), JSON.stringify(r));
    });
  },

  async weight() {
    const BUDGET = { '/feedback/': { total: 330, js: 30 }, '/news/': { total: 300 } };
    for (const [path, budget] of Object.entries(BUDGET)) {
      await withPage({ ...VIEWS.desktop, dpr: 2 }, async (p) => {
        await p.goto(BASE + path, { settle: 2500 });
        await p.scrollThrough({ step: 0.6, delay: 300, max: 40 }); await sleep(1500);
        let total = 0, js = 0; const urls = [];
        for (const r of p.log.requests.values()) {
          if (!r.url || r.bytes == null || r.url.startsWith('data:')) continue;
          urls.push(r.url);
          let size = r.bytes;
          // Pages and the API gzip text and fonts; the local servers do not, so measure the gzip size here.
          if (/^(Document|Stylesheet|Script|XHR|Fetch|Font)$/.test(r.type)) try { size = gzipSync(Buffer.from(await (await fetch(r.url, { headers: { origin: BASE } })).arrayBuffer()), { level: 9 }).length; } catch {}
          total += size; if (r.type === 'Script') js += size;
        }
        const kb = (n) => Math.round(n / 1024);
        check('weight', `${path} ko cold transfer ≤ ${budget.total} KB (gzip)`, kb(total) <= budget.total, `${kb(total)} KB, ${urls.length} requests`);
        if (budget.js) check('weight', `${path} JS ≤ ${budget.js} KB (gzip)`, kb(js) <= budget.js, `${kb(js)} KB`);
        check('weight', `${path} never requests copy.mjs`, !urls.some((u) => u.includes('/copy.')));
      });
    }
  },
};

// ---- run --------------------------------------------------------------------------------------
for (const [name, run] of Object.entries(scenarios)) {
  if (ONLY && !ONLY.includes(name)) continue;
  const t0 = Date.now();
  try { await run(); } catch (e) { check(name, 'scenario ran', false, String(e?.stack || e).split('\n').slice(0, 3).join(' ')); }
  if (!f.json) process.stdout.write(`${name.padEnd(9)} ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
}
const failed = results.filter((r) => !r.ok);
writeFileSync(join(OUT, 'community-qa.json'), JSON.stringify({ base: BASE, live: LIVE, results }, null, 1));
if (f.json) console.log(JSON.stringify({ failed: failed.length, results }, null, 1));
else {
  for (const r of results) if (!r.ok || f.verbose) console.log(`${r.ok ? 'ok  ' : 'FAIL'} [${r.group}] ${r.name}${r.detail != null ? ' — ' + r.detail : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} checks pass; screenshots and community-qa.json in ${OUT}`);
}
process.exit(failed.length ? 1 : 0);
