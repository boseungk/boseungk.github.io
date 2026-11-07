// Service worker QA (PORT-PLAN §2.4, package B2). Drives the already-running Chrome on CDP 9333; never launches one.
// Every check runs in its own isolated browser context (Target.createBrowserContext), so no worker is ever
// registered in the profile other agents share; each context and its targets are disposed at the end.
//
//   node tools/qa/sw-qa.mjs [--site http://127.0.0.1:8765] [--update-root DIR --update-port 8792]
//
// Checks on --site (default http://127.0.0.1:8765, serving docs/):
//   1. without ?sw=1 nothing registers on 127.0.0.1 (home, feedback, news);
//   2. /?sw=1: the first visit has no fromServiceWorker; the worker then controls the page;
//   3. after a reload the font, CSS, art and an opened room's files come from the worker (and, one reload later,
//      from Cache Storage); the HTML never does;
//   4. /feedback/?sw=1: requests to the feedback API (127.0.0.1:8789) and other origins never go through the worker;
//   5. /?sw=off empties caches.keys() and unregisters.
// With --update-root (a scratch COPY of the repository, never the real tree): the copy's docs/ is served on
// --update-port, one CSS file is changed, the copy is rebuilt with its own build-locales.py --draft, and the new
// sw.js must activate and prune the stale entry.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';
import { sleep, parseArgs } from './cdp.mjs';

const { f } = parseArgs(process.argv.slice(2));
const SITE = String(f.site || 'http://127.0.0.1:8765').replace(/\/$/, '');
const CDP = `http://${process.env.CDP_HOST || '127.0.0.1'}:${process.env.CDP_PORT || 9333}`;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const API = 'http://127.0.0.1:8789';
const CACHE = 'mar-immutable-v1';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

// ---- minimal CDP over one browser socket (flattened sessions) ----------------------------------------------------
async function browser() {
  const { webSocketDebuggerUrl } = await (await fetch(`${CDP}/json/version`)).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('CDP connect failed')); });
  let id = 0; const pending = new Map(); const listeners = new Set();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.no(new Error(m.error.message)) : p.ok(m.result); }
    else if (m.method) for (const l of listeners) l(m);
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => { const i = ++id; pending.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  return { send, on: (fn) => (listeners.add(fn), () => listeners.delete(fn)), close: () => ws.close() };
}

async function isolatedPage(b) {
  const { browserContextId } = await b.send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => b.send(method, params, sessionId);
  const requests = new Map();
  const off = b.on((m) => {
    if (m.sessionId !== sessionId) return;
    const P = m.params;
    if (m.method === 'Network.requestWillBeSent') requests.set(P.requestId, { url: P.request.url, method: P.request.method, type: P.type });
    if (m.method === 'Network.responseReceived') Object.assign(requests.get(P.requestId) || (requests.set(P.requestId, {}), requests.get(P.requestId)),
      { url: P.response.url, type: P.type, status: P.response.status, fromSW: !!P.response.fromServiceWorker, source: P.response.serviceWorkerResponseSource || '' });
  });
  await Promise.all(['Page', 'Network', 'Runtime'].map((d) => send(d + '.enable')));
  await send('Network.setCacheDisabled', { cacheDisabled: true });   // no memory/HTTP cache: only the worker can serve
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const page = {
    requests,
    async goto(url, settle = 1500) {
      requests.clear();
      await send('Page.bringToFront').catch(() => {});
      const loaded = new Promise((r) => { const o = b.on((m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { o(); r(); } }); });
      const nav = await send('Page.navigate', { url });
      if (nav.errorText) throw new Error(`navigate ${url}: ${nav.errorText}`);
      await Promise.race([loaded, sleep(20000)]);
      await sleep(settle);
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async until(expression, ms = 20000) {
      for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) if (await page.eval(expression).catch(() => false)) return true;
      return false;
    },
    list: () => [...requests.values()].filter((r) => r.url && r.status),
    async close() { off(); await b.send('Target.closeTarget', { targetId }).catch(() => {}); await b.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {}); },
  };
  return page;
}

const REGS = 'navigator.serviceWorker.getRegistrations().then(r => r.length)';
const CONTROLLED = '!!navigator.serviceWorker.controller';
const CACHED = `caches.has('${CACHE}').then(h => h ? caches.open('${CACHE}').then(c => c.keys()).then(k => k.map(r => r.url)) : [])`;
const short = (u) => u.replace(/^https?:\/\/[^/]+/, '');
const kinds = {
  html: (r) => r.type === 'Document',
  font: (r) => /\/assets\/fonts\/.+\.[0-9a-f]{10}\.(otf|ttf|woff2)$/.test(r.url),
  css: (r) => /\.css\?v=[0-9a-f]{10}$/.test(r.url),
  art: (r) => /\/assets\/art\/.+\.[0-9a-f]{10}\.webp$/.test(r.url),
};
const sameOrigin = (site) => (r) => r.url.startsWith(site + '/');

async function openRoom(page) {
  await page.eval(`document.getElementById('rooms-host')?.scrollIntoView({block:'center'})`);
  if (!(await page.until(`!!document.querySelector('#rooms-host .tile__btn')`, 15000))) return null;
  const before = page.list().length;
  await page.eval(`document.querySelector('#rooms-host .tile__btn').click()`);
  await sleep(3500);
  return page.list().slice(before).filter((r) => /\/assets\/rooms\/[^/]+\/(?!thumb\.)/.test(r.url));
}

// ---- 1-5 on the real site ------------------------------------------------------------------------------------
async function mainChecks(b) {
  const p = await isolatedPage(b);
  try {
    for (const path of ['/', '/feedback/', '/news/']) await p.goto(SITE + path, 6500);   // past load + idle (5 s timeout)
    check('127.0.0.1 without ?sw=1 never registers', (await p.eval(REGS)) === 0 && !(await p.eval(CONTROLLED)), `registrations ${await p.eval(REGS)}`);

    await p.goto(SITE + '/?sw=1', 500);
    const first = p.list();
    check('first visit: no response from the worker', first.length > 5 && first.every((r) => !r.fromSW), `${first.length} responses, ${first.filter((r) => r.fromSW).length} fromServiceWorker`);
    const controlled = await p.until(CONTROLLED, 25000);
    check('worker registers and controls the page (clients.claim)', controlled, await p.eval(`navigator.serviceWorker.controller?.scriptURL || 'none'`));

    await p.goto(SITE + '/?sw=1', 2500);
    const second = p.list().filter(sameOrigin(SITE));
    const room2 = await openRoom(p) || [];
    await sleep(1500);
    for (const [kind, test] of Object.entries(kinds)) {
      const hits = second.filter(test);
      if (kind === 'html') check('reload: the HTML is not from the worker', hits.length === 1 && !hits[0].fromSW, hits.map((r) => `${short(r.url)} fromSW=${r.fromSW}`).join(', '));
      else check(`reload: ${kind} from the worker`, hits.length > 0 && hits.every((r) => r.fromSW), `${hits.filter((r) => r.fromSW).length}/${hits.length} e.g. ${hits[0] ? short(hits[0].url) : '-'}`);
    }
    check('reload: opened room files from the worker', room2.length > 2 && room2.every((r) => r.fromSW), `${room2.filter((r) => r.fromSW).length}/${room2.length} e.g. ${room2[0] ? short(room2[0].url) : '-'}`);

    await p.goto(SITE + '/?sw=1', 2500);
    const third = p.list().filter(sameOrigin(SITE));
    const room3 = await openRoom(p) || [];
    for (const [kind, test] of Object.entries(kinds)) {
      if (kind === 'html') continue;
      const hits = third.filter(test);
      check(`second reload: ${kind} from Cache Storage`, hits.length > 0 && hits.every((r) => r.source === 'cache-storage'), `${hits.filter((r) => r.source === 'cache-storage').length}/${hits.length}`);
    }
    const seen2 = new Set(room2.map((r) => r.url));
    const again = room3.filter((r) => seen2.has(r.url));
    check('second reload: the same room from Cache Storage', again.length > 2 && again.every((r) => r.source === 'cache-storage'), `${again.filter((r) => r.source === 'cache-storage').length}/${again.length}`);
    const htmlFromSW = third.filter(kinds.html).some((r) => r.fromSW);
    const cached = await p.eval(CACHED);
    check('cache holds only immutable URLs (no HTML, no sw.js, no keep list)', cached.length > 0 && !htmlFromSW && cached.every((u) => /\.[0-9a-f]{10}\.(webp|png|jpg|svg|otf|ttf|woff2|json)$|[?&]v=[0-9a-f]{10}$/.test(u) && !/cache-keep|\/sw\.js/.test(u)), `${cached.length} entries`);

    await p.goto(SITE + '/feedback/?sw=1', 5000);
    const api = p.list().filter((r) => r.url.startsWith(API));
    const foreign = p.list().filter((r) => !r.url.startsWith(SITE + '/') && /^https?:/.test(r.url));
    check('feedback: API requests never go through the worker', api.length > 0 && api.every((r) => !r.fromSW), `${api.length} API responses, ${api.filter((r) => r.fromSW).length} fromServiceWorker`);
    check('feedback: no cross-origin request goes through the worker', foreign.every((r) => !r.fromSW), `${foreign.length} cross-origin responses`);
    check('feedback: page still controlled (navigation passed through)', await p.eval(CONTROLLED));

    await p.goto(SITE + '/?sw=off', 3000);
    const keys = await p.eval('caches.keys()');
    const regs = await p.eval(REGS);
    check('?sw=off empties caches.keys() and unregisters', keys.length === 0 && regs === 0, `caches ${JSON.stringify(keys)}, registrations ${regs}`);
    await p.goto(SITE + '/', 6500);
    check('after ?sw=off the next visit is not controlled', !(await p.eval(CONTROLLED)) && (await p.eval(REGS)) === 0);
  } finally { await p.close(); }
}

const listening = (port) => new Promise((ok) => { const s = connect(port, '127.0.0.1', () => { s.destroy(); ok(true); }); s.on('error', () => ok(false)); });

// ---- 6: a new keep list activates and prunes (scratch copy only) -----------------------------------------------------
async function updateCheck(b, root, port) {
  root = realpathSync(root);
  if (root === realpathSync(REPO) || !realpathSync(resolve(root, 'docs')).startsWith(root)) throw new Error('--update-root must be a scratch copy, never the real repository');
  const site = `http://127.0.0.1:${port}`;
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', resolve(root, 'docs')], { stdio: 'ignore' });
  process.once('exit', () => server.kill());   // also on a crash
  const p = await isolatedPage(b);
  try {
    for (let i = 0; i < 40 && !(await listening(port)); i++) await sleep(250);
    await p.goto(site + '/?sw=1', 500);
    check('update: worker controls the copy', await p.until(CONTROLLED, 25000));
    await p.goto(site + '/?sw=1', 3000);
    const cssUrl = p.list().map((r) => r.url).find((u) => /\/assets\/site\/base\.css\?v=[0-9a-f]{10}$/.test(u));
    const before = await p.eval(CACHED);
    const oldWorker = readFileSync(resolve(root, 'docs/sw.js'), 'utf8');
    check('update: the old CSS entry is cached', cssUrl && before.includes(cssUrl), cssUrl ? short(cssUrl) : 'base.css not requested');

    appendFileSync(resolve(root, 'docs/assets/site/base.css'), '\n/* sw-qa: forces a new ?v= */\n');
    const built = spawnSync('python3', [resolve(root, 'tools/build-locales.py'), '--draft'], { cwd: root, encoding: 'utf8' });
    const newWorker = readFileSync(resolve(root, 'docs/sw.js'), 'utf8');
    const keepOf = (s) => (s.match(/const KEEP = '([^']+)'/) || [])[1];
    check('update: the rebuild writes a new sw.js (new keep list)', built.status === 0 && keepOf(newWorker) !== keepOf(oldWorker), `${keepOf(oldWorker)} -> ${keepOf(newWorker)}${built.status ? ' build failed: ' + built.stderr.slice(-300) : ''}`);

    await p.goto(site + '/?sw=1', 1000);
    await p.eval('navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => 0)');
    const pruned = await p.until(`(${CACHED}).then(k => !k.includes(${JSON.stringify(cssUrl)}))`, 25000);
    const state = await p.eval(`navigator.serviceWorker.getRegistration().then(r => ({active: r.active && r.active.state, waiting: !!r.waiting, installing: !!r.installing}))`);
    const served = await p.eval(`fetch('/sw.js', {cache: 'no-store'}).then(r => r.text()).then(t => (t.match(/const KEEP = '([^']+)'/) || [])[1])`);
    check('update: the new worker activates', state.active === 'activated' && !state.waiting && !state.installing && served === keepOf(newWorker), JSON.stringify(state));
    check('update: the stale CSS entry is pruned', pruned, short(cssUrl || ''));
    await p.goto(site + '/?sw=1', 3000);
    const after = await p.eval(CACHED);
    const fresh = after.find((u) => /\/assets\/site\/base\.css\?v=/.test(u));
    check('update: the new CSS entry is cached, the old one is gone', fresh && fresh !== cssUrl && !after.includes(cssUrl), fresh ? short(fresh) : 'none');
    await p.goto(site + '/?sw=off', 2000);
  } finally { await p.close(); server.kill(); }
}

const b = await browser();
try {
  await mainChecks(b);
  if (f['update-root']) await updateCheck(b, String(f['update-root']), Number(f['update-port'] || 8792));
} finally { b.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`${failed.length ? 'FAIL' : 'PASS'} ${results.length - failed.length}/${results.length} service worker checks`);
process.exit(failed.length ? 1 : 0);
