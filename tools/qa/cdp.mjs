// Shared Chrome QA harness: drives the already-running Chrome (CDP, default port 9333).
// Never launches a browser. Every page() creates its own target and closes it in close().
//
// Library:
//   import { openPage, withPage, PROBES } from './cdp.mjs';
//   await withPage({ width: 390, height: 844, mobile: true, reducedMotion: true }, async (p) => {
//     await p.goto(url); const m = await p.eval('document.title'); await p.shot('/tmp/a.png');
//   });
// CLI:
//   node tools/qa/cdp.mjs shot  <url> <out.png> [--w 1440 --h 900 --dpr 1 --mobile --reduced --rtl --nojs --full]
//   node tools/qa/cdp.mjs frames <url> <outDir> [--n 12 --every 250 --w .. --h .. --scroll 0]
//   node tools/qa/cdp.mjs probe <url> [--w .. --h ..]       (console/4xx/overflow summary as JSON)
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PORT = Number(process.env.CDP_PORT || 9333);
export const HOST = process.env.CDP_HOST || '127.0.0.1';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = `http://${HOST}:${PORT}`;

export const VIEWS = {
  desktop: { width: 1440, height: 900, mobile: false, dpr: 1 },
  laptop: { width: 1024, height: 768, mobile: false, dpr: 1 },
  tablet: { width: 768, height: 1024, mobile: true, dpr: 2 },
  phone: { width: 390, height: 844, mobile: true, dpr: 2 },
  small: { width: 320, height: 640, mobile: true, dpr: 2 },
};

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const pending = new Map(); const listeners = new Set();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message || JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) for (const l of listeners) l(msg);
    };
    ws.onclose = () => { for (const { rej } of pending.values()) rej(new Error('CDP socket closed')); pending.clear(); };
    ws.onerror = () => reject(new Error('CDP connect failed: ' + wsUrl));
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }),
      on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      close: () => ws.close(),
    });
  });
}

export async function openPage(opts = {}) {
  const o = { width: 1440, height: 900, dpr: 1, mobile: false, reducedMotion: false, colorScheme: null, jsOff: false, cacheOff: true, ...opts };
  if (o.view && VIEWS[o.view]) Object.assign(o, VIEWS[o.view], opts.dpr ? { dpr: opts.dpr } : {});
  const target = await (await fetch(`${ROOT}/json/new?about:blank`, { method: 'PUT' })).json();
  const c = await connect(target.webSocketDebuggerUrl);
  const log = { console: [], exceptions: [], http4xx: [], failed: [], requests: new Map() };
  const reqs = log.requests;
  c.on((m) => {
    const P = m.params;
    switch (m.method) {
      case 'Network.requestWillBeSent': reqs.set(P.requestId, { ...(reqs.get(P.requestId) || {}), url: P.request.url, type: P.type }); break;
      case 'Network.responseReceived': {
        const r = reqs.get(P.requestId) || {}; Object.assign(r, { url: P.response.url, status: P.response.status, mime: P.response.mimeType, type: P.type }); reqs.set(P.requestId, r);
        if (P.response.status >= 400) log.http4xx.push(`${P.response.status} ${P.response.url}`);
        break;
      }
      case 'Network.loadingFinished': { const r = reqs.get(P.requestId) || {}; r.bytes = P.encodedDataLength; reqs.set(P.requestId, r); break; }
      case 'Network.loadingFailed': { const r = reqs.get(P.requestId) || {}; if (!P.canceled) log.failed.push(`${P.errorText} ${r.url || ''}`); break; }
      case 'Runtime.consoleAPICalled':
        if (['error', 'warning'].includes(P.type)) log.console.push(`${P.type}: ` + P.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
        break;
      case 'Log.entryAdded':
        if (['error', 'warning'].includes(P.entry.level) && !/Failed to load resource/.test(P.entry.text)) log.console.push(`log-${P.entry.level}: ${P.entry.text.slice(0, 300)} ${P.entry.url || ''}`);
        break;
      case 'Runtime.exceptionThrown': log.exceptions.push((P.exceptionDetails.exception?.description || P.exceptionDetails.text).slice(0, 300)); break;
    }
  });
  await Promise.all(['Page', 'Network', 'Runtime', 'Log'].map((d) => c.send(d + '.enable')));
  // Chrome hides a target whenever another target in the same browser is fronted, and a hidden page pauses the
  // site's demos (document.hidden): front ours, and again on every goto().
  await c.send('Page.bringToFront').catch(() => {});
  if (o.cacheOff) await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  const page = {
    c, log, opts: o, targetId: target.id, closed: false,
    async viewport(w = o.width, h = o.height, extra = {}) {
      o.width = w; o.height = h;
      await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: extra.dpr ?? o.dpr, mobile: extra.mobile ?? o.mobile });
      await c.send('Emulation.setTouchEmulationEnabled', { enabled: !!(extra.mobile ?? o.mobile) });
    },
    async media({ reducedMotion = o.reducedMotion, colorScheme = o.colorScheme } = {}) {
      const features = [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }];
      if (colorScheme) features.push({ name: 'prefers-color-scheme', value: colorScheme });
      await c.send('Emulation.setEmulatedMedia', { features });
    },
    async jsOff(off = true) { await c.send('Emulation.setScriptExecutionDisabled', { value: off }); },
    // Force RTL on the document after load (use for ar/he pages that already set dir, or to stress-test LTR pages).
    async rtl(on = true) { await page.eval(`document.documentElement.dir=${JSON.stringify(on ? 'rtl' : 'ltr')}`); },
    async goto(url, { settle = 1200, timeout = 20000, wait = 'load' } = {}) {
      const loaded = new Promise((r) => { const off = c.on((m) => { if (m.method === (wait === 'dom' ? 'Page.domContentEventFired' : 'Page.loadEventFired')) { off(); r(); } }); });
      const t0 = Date.now();
      await c.send('Page.bringToFront').catch(() => {});
      const nav = await c.send('Page.navigate', { url });
      if (nav.errorText) throw new Error('navigate ' + url + ': ' + nav.errorText);
      await Promise.race([loaded, sleep(timeout)]);
      page.loadMs = Date.now() - t0;
      if (settle) await sleep(settle);
      return page;
    },
    async eval(expression, { awaitPromise = true } = {}) {
      const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async scrollTo(y) { await page.eval(`scrollTo(0,${Math.round(y)})`); },
    async scrollThrough({ step = 0.6, delay = 350, max = 60 } = {}) {
      const H = await page.eval('document.documentElement.scrollHeight');
      for (let i = 0, y = 0; i < max && y < H; i++) { y += o.height * step; await page.scrollTo(y); await sleep(delay); }
      await sleep(600);
      return H;
    },
    async shot(path, { full = false, format, quality = 80, clip } = {}) {
      format ||= /\.jpe?g$/i.test(path) ? 'jpeg' : 'png';
      const p = { format, captureBeyondViewport: full };
      if (format === 'jpeg') p.quality = quality;
      if (full) { const [w, h] = await page.eval('[document.documentElement.scrollWidth, document.documentElement.scrollHeight]'); p.clip = { x: 0, y: 0, width: w, height: Math.min(h, 16000), scale: 1 }; }
      if (clip) p.clip = { scale: 1, ...clip };
      const s = await c.send('Page.captureScreenshot', p);
      mkdirSync(new URL('.', pathToFileURL(path)).pathname, { recursive: true });
      writeFileSync(path, Buffer.from(s.data, 'base64'));
      return path;
    },
    // Frame capture: n screenshots every `every` ms (animation checks). Optional per-frame hook.
    async frames(dir, { n = 12, every = 250, format = 'jpeg', quality = 70, hook } = {}) {
      mkdirSync(dir, { recursive: true });
      const out = [];
      for (let i = 0; i < n; i++) {
        if (hook) await hook(i);
        const f = `${dir}/f${String(i).padStart(3, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`;
        await page.shot(f, { format, quality });
        out.push(f);
        await sleep(every);
      }
      return out;
    },
    // Request interception. rules: [{ match: RegExp|string, fail: 'Failed'|... } | { match, status, body, headers }]
    async intercept(rules) {
      await c.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      c.on(async (m) => {
        if (m.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = m.params;
        const hit = rules.find((r) => (r.match instanceof RegExp ? r.match.test(request.url) : request.url.includes(r.match)));
        try {
          if (!hit) await c.send('Fetch.continueRequest', { requestId });
          else if (hit.fail) await c.send('Fetch.failRequest', { requestId, errorReason: hit.fail === true ? 'Failed' : hit.fail });
          else await c.send('Fetch.fulfillRequest', { requestId, responseCode: hit.status || 200, responseHeaders: Object.entries(hit.headers || { 'content-type': 'text/plain' }).map(([name, value]) => ({ name, value })), body: Buffer.from(hit.body ?? '').toString('base64') });
        } catch {}
      });
    },
    async key(key, code = key, vk = 0) {
      await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
      await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
    },
    async tab(n = 1) { for (let i = 0; i < n; i++) { await page.key('Tab', 'Tab', 9); await sleep(120); } },
    async click(x, y) { for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); },
    resetLog() { log.console.length = log.exceptions.length = log.http4xx.length = log.failed.length = 0; reqs.clear(); },
    async close() {
      if (page.closed) return; page.closed = true;
      try { c.close(); } catch {}
      try { await fetch(`${ROOT}/json/close/${target.id}`); } catch {}
    },
  };
  await page.viewport(o.width, o.height);
  await page.media();
  if (o.jsOff) await page.jsOff(true);
  return page;
}

export async function withPage(opts, fn) {
  const p = await openPage(opts);
  try { return await fn(p); } finally { await p.close(); }
}

// In-page probes (strings, evaluated with page.eval). Each returns plain JSON.
export const PROBES = {
  overflow: `(() => { const de = document.documentElement; const vw = de.clientWidth;
    const over = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) { let a = el, clipped = false; while ((a = a.parentElement) && a !== document.body) { const s = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) { clipped = true; break; } } if (!clipped && getComputedStyle(el).position !== 'fixed') over.push((el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ')[0]).slice(0, 60) + ' r=' + Math.round(r.right) + ' l=' + Math.round(r.left)); } }
    return { scrollW: de.scrollWidth, clientW: vw, hOverflow: de.scrollWidth > vw + 1, offenders: over.slice(0, 8), offenderCount: over.length }; })()`,
  // Phones: one CSS .phone on the home (the hero), none elsewhere.
  phones: `(() => { const sel = '.phone, [data-phone]'; const els = [...document.querySelectorAll(sel)]; const top = els.filter((e) => !e.parentElement.closest(sel)); return { phoneCount: top.length, phoneClasses: top.map((e) => String(e.className).split(' ')[0]) }; })()`,
  // Computed banned styles. Allowed: box-shadow inside .phone; pill radius on the Dynamic Island (.phone__island).
  banned: `(() => { const out = { shadow: [], backdrop: [], blur: [], weight: [], pill: [], textShadow: [] };
    const tag = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className.baseVal ?? el.className).split(' ')[0]).slice(0, 50);
    for (const el of document.querySelectorAll('body, body *')) { const s = getComputedStyle(el); if (s.display === 'none') continue;
      const inPhone = !!el.closest('.phone, [data-phone]'); const island = !!el.closest('.phone__island');
      if (s.boxShadow !== 'none' && !inPhone) out.shadow.push(tag(el));
      if (s.backdropFilter && s.backdropFilter !== 'none') out.backdrop.push(tag(el));
      if (s.filter.includes('blur')) out.blur.push(tag(el));
      if (s.textShadow !== 'none') out.textShadow.push(tag(el));
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseInt(s.fontWeight) >= 500 && !el.closest('svg')) out.weight.push(tag(el) + ':' + s.fontWeight);
      const r = el.getBoundingClientRect(); const rad = parseFloat(s.borderTopLeftRadius);
      if (!island && rad >= 999 && r.width > 0 && !(el instanceof SVGElement)) out.pill.push(tag(el));
    }
    const cut = (a) => [...new Set(a)].slice(0, 6); const n = (a) => a.length;
    return { counts: { shadow: n(out.shadow), backdrop: n(out.backdrop), blur: n(out.blur), weight: n(out.weight), pill: n(out.pill), textShadow: n(out.textShadow) }, samples: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, cut(v)])) }; })()`,
  minFont: (min) => `(() => { const bad = []; for (const el of document.querySelectorAll('body *')) { if (!([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))) continue; const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || el.closest('svg, script, style, [aria-hidden=true]')) continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; const fs = parseFloat(s.fontSize); if (fs < ${min}) bad.push((el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]).slice(0, 40) + ':' + fs + ':' + el.textContent.trim().slice(0, 20)); } return { count: bad.length, samples: bad.slice(0, 6) }; })()`,
  // Banned strings in same-origin stylesheet text (catches rules that are not matched on this page/viewport).
  cssGrep: `(async () => { const urls = [...document.styleSheets].map((s) => s.href).filter((h) => h && new URL(h).origin === location.origin); const pats = { 'box-shadow': /box-shadow\\s*:\\s*(?!none)/g, 'backdrop-filter': /backdrop-filter\\s*:\\s*(?!none)/g, 'blur(': /blur\\(/g, 'font-weight:5-9': /font-weight\\s*:\\s*[5-9]00/g, 'border-radius:999': /border-radius\\s*:\\s*999/g }; const res = {}; for (const u of urls) { const t = await (await fetch(u)).text(); for (const [k, re] of Object.entries(pats)) { const m = t.match(re); if (m) (res[k] ||= {})[new URL(u).pathname] = m.length; } } return res; })()`,
  lang: `({ lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title, docH: document.documentElement.scrollHeight })`,
};

// ---- CLI ----
function parseArgs(argv) {
  const pos = []; const f = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) f[k] = true; else { f[k] = nx; i++; } } else pos.push(a);
  }
  return { pos, f };
}
export { parseArgs };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pos, f } = parseArgs(process.argv.slice(2));
  const [cmd, url, out] = pos;
  const opts = { width: +f.w || 1440, height: +f.h || 900, dpr: +f.dpr || 1, mobile: !!f.mobile, reducedMotion: !!f.reduced, jsOff: !!f.nojs };
  if (!cmd || !url) { console.error('usage: cdp.mjs shot|frames|probe <url> [out]'); process.exit(2); }
  await withPage(opts, async (p) => {
    await p.goto(url);
    if (f.rtl) await p.rtl(true);
    if (cmd === 'shot') { console.log(await p.shot(out || 'shot.png', { full: !!f.full })); }
    else if (cmd === 'frames') { if (f.scroll) await p.scrollTo(+f.scroll); console.log((await p.frames(out || 'frames', { n: +f.n || 12, every: +f.every || 250 })).length + ' frames -> ' + (out || 'frames')); }
    else if (cmd === 'probe') {
      const r = { url, loadMs: p.loadMs, overflow: await p.eval(PROBES.overflow), phones: await p.eval(PROBES.phones), ...p.log, requests: p.log.requests.size };
      delete r.requests; r.requestCount = p.log.requests.size;
      console.log(JSON.stringify(r, (k, v) => (v instanceof Map ? undefined : v), 1));
    } else { console.error('unknown command ' + cmd); process.exit(2); }
  });
}
