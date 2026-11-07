// Home behaviour in a real browser (CDP on the Chrome that is already running; never launches one).
// Local QA only: it needs the static site on --base (default http://127.0.0.1:8765) and writes screenshots under --out.
//
//   node tools/qa/home-browser.mjs [--base http://127.0.0.1:8765] [--only layout,reduced,...] [--locales ko,en,ar]
//                                  [--views 1440x900,390x844,375x667,360x740] [--out dir]
//
// Scenarios (each opens its own tab and closes it):
//   layout    per locale and view: no horizontal overflow, no console error/exception/4xx, header items do not
//             intersect, every text >= 13 px, exactly one .phone, banned styles (computed), HUD text is DOM text
//   reduced   prefers-reduced-motion: final stills (day room, 00:14, decor on the lake, 0 running animations, no pause button)
//   hero      phases day 5600 / dusk 5000 / unlit 1500 / night 7600 ms, in order, looping
//   pause     #motion-toggle: no requestAnimationFrame for 2 s at the top and at three sections; phase frozen; resumes
//   hidden    a hidden tab freezes the hero cycle and it resumes with the remaining time
//   focus     the demo holds the prep sheet 3.2 s, presses start, shows the done card and never goes back
//   decor     the demo ends on the lake room (the hero stays garden)
//   nojs      JavaScript off: every section's copy shows, 12 room captions, no broken image
//   leak      mount() then destroy() of every section module leaves no timer, frame, listener or observer
//   fonts     each page loads only its language's faces (ko: latin+ko, en: jp-latin, ja, ar, zh-hant); a rare syllable adds the rare face on ko
//   rooms     request budget before dwell, one room on dwell, open/next/Esc of the room view, focus returns to the
//             room shown, rapid 다음 keeps the row with the view, no off-paper Tab stop, the page pause opens a still,
//             a failed rooms module or kicker icon falls back quietly
// Exit status 1 when any assertion fails.
import { mkdirSync } from 'node:fs';
import { openPage, PROBES, sleep, parseArgs } from './cdp.mjs';

const { f } = parseArgs(process.argv.slice(2));
const BASE = (f.base || 'http://127.0.0.1:8765').replace(/\/$/, '');
const OUT = f.out || '/tmp/home-browser';
const LOCALES = String(f.locales || 'ko,en,ar').split(',').filter(Boolean);
const VIEWS = String(f.views || '1440x900,390x844,375x667,360x740').split(',').map((v) => { const [w, h] = v.split('x').map(Number); return { width: w, height: h, mobile: w < 700, dpr: w < 700 ? 2 : 1, name: v }; });
const ALL = ['layout', 'reduced', 'hero', 'pause', 'hidden', 'focus', 'decor', 'nojs', 'leak', 'fonts', 'rooms'];
const ONLY = f.only ? String(f.only).split(',') : ALL;
mkdirSync(OUT, { recursive: true });

const results = [];
let failed = 0;
function check(scenario, name, ok, detail = '') {
  results.push({ scenario, name, ok });
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${scenario.padEnd(7)} ${name}${detail ? '  ' + detail : ''}`);
}
const urlOf = (loc) => BASE + (loc === 'ko' ? '/' : `/${loc}/`);
const DESKTOP = { width: 1440, height: 900, mobile: false, dpr: 1 };
const PHONE = { width: 390, height: 844, mobile: true, dpr: 2 };
const near = (value, target, tol) => Math.abs(value - target) <= tol;

// A rAF counter, installed before any page script runs.
const COUNT_RAF = `(() => { window.__raf = 0; const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { window.__raf++; cb(t); }); })()`;
async function before(p, source) { await p.c.send('Page.addScriptToEvaluateOnNewDocument', { source }); }
const scrollToSection = (p, sel, offset = 72) => p.eval(`scrollTo(0, document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect().top + scrollY - ${offset})`);
const roomPhase = (p) => p.eval(`document.getElementById('room').dataset.phase`);

// --------------------------------------------------------------------------------------------------------
async function layout() {
  for (const loc of LOCALES) for (const v of VIEWS) {
    const id = `${loc} ${v.name}`;
    const p = await openPage(v);
    try {
      await p.goto(urlOf(loc), { settle: 1500 });
      await p.scrollThrough({ step: 0.8, delay: 200, max: 30 });
      await p.scrollTo(0); await sleep(300);
      const ov = await p.eval(PROBES.overflow);
      check('layout', `${id} no horizontal overflow`, !ov.hOverflow, ov.hOverflow ? `scrollW ${ov.scrollW} > ${ov.clientW}: ${ov.offenders.join(' | ')}` : '');
      const bad = [...p.log.console, ...p.log.exceptions, ...p.log.http4xx, ...p.log.failed];
      check('layout', `${id} no console error, exception, 4xx`, !bad.length, bad.slice(0, 2).join(' | '));
      const phones = await p.eval(PROBES.phones);
      check('layout', `${id} one .phone`, phones.phoneCount === 1, `got ${phones.phoneCount}`);
      const min = await p.eval(PROBES.minFont(13));
      check('layout', `${id} text >= 13px`, !min.count, min.samples.join(' | '));
      const banned = await p.eval(PROBES.banned);
      const hit = Object.entries(banned.counts).filter(([, n]) => n);
      check('layout', `${id} no banned computed style`, !hit.length, hit.map(([k, n]) => `${k}=${n} ${banned.samples[k].slice(0, 2)}`).join('; '));
      const header = await p.eval(`(() => { const items = [...document.querySelectorAll('#bar > *, #bar nav a, #bar .stores a, #bar summary')]
        .map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.width && r.height); const clash = [];
        for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j];
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
          if (a.r.left < b.r.right - 1 && b.r.left < a.r.right - 1 && a.r.top < b.r.bottom - 1 && b.r.top < a.r.bottom - 1) clash.push(a.el.className + '|' + b.el.className); }
        return { n: items.length, clash }; })()`);
      check('layout', `${id} header items do not intersect`, header.n > 2 && !header.clash.length, header.clash.join(' ; '));
      const hud = await p.eval(`(() => { const e = document.getElementById('hud-time'); return e ? { text: e.textContent, size: parseFloat(getComputedStyle(e).fontSize), canvas: document.querySelectorAll('.phone canvas').length } : null; })()`);
      check('layout', `${id} HUD time is DOM text`, !!hud && /^\d\d:\d\d$/.test(hud.text) && hud.size >= 13 && hud.canvas === 0, JSON.stringify(hud));
      if (loc === 'ar') {
        const dir = await p.eval(`document.documentElement.dir`);
        check('layout', `${id} dir=rtl`, dir === 'rtl', dir);
      }
      if (f.shots) await p.shot(`${OUT}/layout-${loc}-${v.name}.jpg`, { quality: 60 });
    } catch (e) { check('layout', id, false, String(e.message)); }
    finally { await p.close(); }
  }
}

async function reduced() {
  for (const loc of LOCALES) for (const v of [DESKTOP, PHONE]) {
    const id = `${loc} ${v.width}`;
    const p = await openPage({ ...v, reducedMotion: true });
    try {
      await p.goto(urlOf(loc), { settle: 1500 });
      await p.scrollThrough({ step: 0.8, delay: 200, max: 30 });
      await sleep(600);
      const s = await p.eval(`(() => ({ phase: document.getElementById('room').dataset.phase, time: document.getElementById('hud-time').textContent,
        toggleHidden: document.getElementById('motion-toggle').hidden || getComputedStyle(document.getElementById('motion-toggle')).display === 'none',
        decorOn: [...document.querySelectorAll('#decor-scene .dstep')].map((x) => x.classList.contains('is-on')),
        decorSrc: (document.querySelector('#decor-scene .dstep.is-on') || {}).src || '', focus: document.getElementById('focus-scene').dataset.state,
        running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.constructor.name).slice(0, 5) }))()`);
      check('reduced', `${id} day room, 00:14`, s.phase === 'day' && s.time === '00:14', `${s.phase} ${s.time}`);
      check('reduced', `${id} decor shows the final lake stage`, s.decorOn.lastIndexOf(true) === s.decorOn.length - 1 && s.decorOn.filter(Boolean).length === 1 && /lake/.test(s.decorSrc), s.decorSrc.split('/').pop());
      check('reduced', `${id} focus shows the prep sheet`, s.focus === 'prep', s.focus);
      check('reduced', `${id} pause button hidden`, s.toggleHidden);
      check('reduced', `${id} 0 running animations`, s.running.length === 0, s.running.join(','));
    } catch (e) { check('reduced', id, false, String(e.message)); }
    finally { await p.close(); }
  }
}

// A MutationObserver that stamps every data-phase change of the hero room with performance.now().
const WATCH_PHASE = `(() => { const room = document.getElementById('room'); window.__phases = [{ t: performance.now(), phase: room.dataset.phase }];
  new MutationObserver(() => { const last = window.__phases[window.__phases.length - 1]; if (last.phase !== room.dataset.phase) window.__phases.push({ t: performance.now(), phase: room.dataset.phase }); })
    .observe(room, { attributes: true, attributeFilter: ['data-phase'] }); })()`;

async function hero() {
  const p = await openPage(DESKTOP);
  try {
    // start the stopwatch when the document is parsed, before the section modules (deferred) have started the cycle
    await before(p, `document.addEventListener('DOMContentLoaded', () => { ${WATCH_PHASE} }, { once: true });`);
    await p.goto(urlOf('ko'), { settle: 300 });
    await sleep(22500);
    const log = await p.eval('window.__phases');
    const names = log.map((x) => x.phase).join('>');
    check('hero', 'phases run day>dusk>unlit>night>day', names.startsWith('day>dusk>unlit>night>day'), names);
    const want = [['day', 5600], ['dusk', 5000], ['unlit', 1500], ['night', 7600]];
    want.forEach(([name, ms], i) => {
      if (!log[i + 1]) return check('hero', `${name} lasts ${ms} ms`, false, 'phase did not end');
      const got = log[i + 1].t - log[i].t;
      check('hero', `${name} lasts ${ms} ms`, near(got, ms, i === 0 ? 220 : 150), `measured ${Math.round(got)}`);
    });
    // the first choice hands the room to the visitor for good
    await p.eval(`document.querySelector('.todpick button[data-go="dusk"]').click()`);
    await sleep(300);
    const chosen = await roomPhase(p);
    await sleep(7000);
    check('hero', 'a user choice stops the auto-cycle for good', chosen === 'dusk' && (await roomPhase(p)) === 'dusk', `${chosen} then ${await roomPhase(p)}`);
  } catch (e) { check('hero', 'run', false, String(e.message)); } finally { await p.close(); }
}

async function pause() {
  const p = await openPage(DESKTOP);
  try {
    await before(p, COUNT_RAF);
    await p.goto(urlOf('ko'), { settle: 800 });
    await p.eval(WATCH_PHASE);
    const sections = [['top', null], ['collection', '#collection'], ['rooms', '#rooms-host'], ['night', '#night']];
    const btn = `document.getElementById('motion-toggle')`;
    for (const [name, sel] of sections) {
      if (sel) { await scrollToSection(p, sel); await sleep(900); } else await sleep(300);
      if (!(await p.eval(`${btn}.getAttribute('aria-pressed') === 'true'`))) await p.eval(`${btn}.click()`);
      // the wall finishes a breathing step already under way (about 1.3 s) instead of freezing between two grid slots
      await sleep(name === 'rooms' ? 1900 : 400);
      const a = await p.eval('window.__raf');
      const phaseA = await roomPhase(p);
      await sleep(2000);
      const b = await p.eval('window.__raf');
      check('pause', `no requestAnimationFrame for 2 s while paused (${name})`, b === a, `${b - a} frames`);
      check('pause', `html.is-motion-paused set (${name})`, await p.eval(`document.documentElement.classList.contains('is-motion-paused')`));
      if (name === 'top') check('pause', 'hero phase frozen while paused', phaseA === (await roomPhase(p)), phaseA);
      await p.eval(`${btn}.click()`);   // resume for the next section
      await sleep(200);
    }
    await p.scrollTo(0); await sleep(1500);
    const c = await p.eval('window.__raf'); await sleep(1500);
    check('pause', 'frames resume after the pause is lifted', (await p.eval('window.__raf')) > c);
    check('pause', 'button state and label follow the pause', await p.eval(`${btn}.getAttribute('aria-pressed') === 'false' && !!${btn}.getAttribute('aria-label')`));
  } catch (e) { check('pause', 'run', false, String(e.message)); } finally { await p.close(); }
}

async function hidden() {
  const p = await openPage(DESKTOP);
  try {
    await p.goto(urlOf('ko'), { settle: 100 });
    await p.eval(WATCH_PHASE);
    const T0 = await p.eval('performance.now()');
    await sleep(2000);
    const hideAt = await p.eval(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); return performance.now(); })()`);
    await sleep(7000);
    const during = await p.eval('window.__phases.length');
    const showAt = await p.eval(`(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); return performance.now(); })()`);
    await sleep(5000);
    const log = await p.eval('window.__phases');
    check('hidden', 'cycle frozen for 7 s in a hidden tab', during === 1, `${during} phase(s) seen`);
    const change = log[1];
    check('hidden', 'it resumes with the remaining time (day 5600 ms in total)', !!change && near((hideAt - log[0].t) + (change.t - showAt), 5600, 400),
      change ? `visible ${(Math.round(hideAt - log[0].t))} + ${Math.round(change.t - showAt)} ms` : 'no change after resuming');
    check('hidden', 'the clock and phase never ran while hidden', !change || change.t > showAt, '');
  } catch (e) { check('hidden', 'run', false, String(e.message)); } finally { await p.close(); }
}

async function focus() {
  const p = await openPage(DESKTOP);
  try {
    await p.goto(urlOf('ko'), { settle: 500 });
    await p.eval(`window.__f = []; const sc = document.getElementById('focus-scene'); window.__f.push({ t: performance.now(), s: sc.dataset.state });
      new MutationObserver(() => { const l = window.__f[window.__f.length - 1]; if (l.s !== sc.dataset.state) window.__f.push({ t: performance.now(), s: sc.dataset.state }); }).observe(sc, { attributes: true, attributeFilter: ['data-state'] });
      new IntersectionObserver((es) => { if (es[0].intersectionRatio >= .6 && !window.__vis) window.__vis = performance.now(); }, { threshold: [.6] }).observe(sc);`);
    await p.eval(`(() => { const r = document.getElementById('focus-scene').getBoundingClientRect(); scrollTo(0, scrollY + r.top + r.height / 2 - innerHeight / 2); })()`);
    await sleep(7500);
    const { log, vis } = await p.eval('({ log: window.__f, vis: window.__vis })');
    const done = log.find((x) => x.s === 'done');
    check('focus', 'the demo reaches the done card', !!done, log.map((x) => x.s).join('>'));
    if (done && vis) {
      const since = done.t - vis;
      check('focus', 'prep sheet holds >= 3.2 s of visibility before the press', since >= 3150, `${Math.round(since)} ms after 60% visible`);
      check('focus', 'done card follows within the press and settle time', since <= 5200, `${Math.round(since)} ms`);
    } else check('focus', 'scene became >= 60% visible', !!vis);
    check('focus', 'it never returns to the prep sheet by itself', log.filter((x) => x.s === 'prep').length === 1, log.map((x) => x.s).join('>'));
    const inert = await p.eval(`({ prep: document.getElementById('fprep').inert, done: document.getElementById('fdone').inert })`);
    check('focus', 'the hidden state is inert, the shown one is not', inert.prep && !inert.done, JSON.stringify(inert));
    // a palette choice returns to the prep sheet
    await p.eval(`document.querySelector('.pick button[data-palette]:not([aria-checked="true"])').click()`);
    await sleep(900);
    const after = await p.eval(`document.getElementById('focus-scene').dataset.state`);
    check('focus', 'a palette choice returns to the prep sheet', after === 'prep', after);
  } catch (e) { check('focus', 'run', false, String(e.message)); } finally { await p.close(); }
}

async function decor() {
  const p = await openPage(DESKTOP);
  try {
    await p.goto(urlOf('ko'), { settle: 500 });
    await p.eval(`(() => { const r = document.getElementById('decor-scene').getBoundingClientRect(); scrollTo(0, scrollY + r.top + r.height / 2 - innerHeight / 2); })()`);
    await sleep(2500);
    const early = await p.eval(`[...document.querySelectorAll('#decor-scene .dstep')].findIndex((x) => x.classList.contains('is-on'))`);
    await sleep(15000);
    const s = await p.eval(`(() => { const steps = [...document.querySelectorAll('#decor-scene .dstep')]; const on = steps.findIndex((x) => x.classList.contains('is-on'));
      return { on, n: steps.length, src: (steps[on] || {}).src || '', hero: ((document.querySelector('#room img') || {}).src || ''),
        pressed: [...document.querySelectorAll('#decor-scene .dcard')].map((c) => c.getAttribute('aria-pressed')).join(','), acq: document.getElementById('dacq').className }; })()`);
    check('decor', 'the demo starts on the first stage', early === 0, `stage ${early} after 2.5 s`);
    check('decor', 'it ends on the lake room (last stage)', s.on === s.n - 1 && /lake/.test(s.src), `${s.on}/${s.n} ${s.src.split('/').pop()}`);
    check('decor', 'the acquisition dialog is closed at the end', !/is-open/.test(s.acq), s.acq);
    check('decor', 'the hero stays garden, not lake', !/lake/.test(s.hero), s.hero.split('/').pop());
    await p.eval(`document.querySelectorAll('#decor-scene .dcard')[0].click()`);
    await sleep(900);
    const first = await p.eval(`[...document.querySelectorAll('#decor-scene .dstep')].findIndex((x) => x.classList.contains('is-on'))`);
    check('decor', 'a card click is the visitor\'s: the stage follows it', first >= 0, `stage ${first}`);
  } catch (e) { check('decor', 'run', false, String(e.message)); } finally { await p.close(); }
}

async function nojs() {
  for (const [name, v] of [['1440', DESKTOP], ['390', PHONE]]) for (const loc of ['ko', 'en', 'ar']) {
    const id = `${loc} ${name}`;
    const p = await openPage({ ...v, jsOff: true });
    try {
      await p.goto(urlOf(loc), { settle: 800 });
      const s = await p.eval(`(() => {
        const visible = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.01 && r.width > 0 && r.height > 0 && !el.closest('[inert],[hidden]'); };
        const copy = [...document.querySelectorAll('main h1, main h2, main p, main figcaption')].filter((el) => el.textContent.trim());
        const hidden = copy.filter((el) => !visible(el)).map((el) => (el.tagName + '#' + (el.id || el.className)).slice(0, 40) + ':' + el.textContent.trim().slice(0, 18));
        const still = [...document.querySelectorAll('#rooms-host ol.rooms-still li')];
        const sections = ['hero', 'focus', 'decor', 'collection', 'records', 'night', 'get'].filter((id) => !document.getElementById(id) || document.getElementById(id).textContent.trim().length < 20);
        const broken = [...document.images].filter((i) => i.getAttribute('src') && i.complete && !i.naturalWidth).map((i) => i.getAttribute('src').slice(-40));
        return { copy: copy.length, hidden, rooms: still.length, roomsShown: still.filter(visible).length, emptySections: sections, broken, phones: document.querySelectorAll('.phone').length }; })()`);
      check('nojs', `${id} every section has its copy`, !s.emptySections.length, s.emptySections.join(','));
      const stray = s.hidden.filter((x) => !/fdone|fcard|done/i.test(x));
      check('nojs', `${id} all copy visible (only the done card is held back)`, !stray.length, `${stray.length}/${s.copy}: ${stray.slice(0, 3).join(' | ')}`);
      check('nojs', `${id} 12 room captions listed and shown`, s.rooms === 12 && s.roomsShown === 12, `${s.roomsShown} shown of ${s.rooms}`);
      check('nojs', `${id} one phone, no broken image`, s.phones === 1 && !s.broken.length, `${s.phones} phones; ${s.broken.join(',')}`);
    } catch (e) { check('nojs', id, false, String(e.message)); }
    finally { await p.close(); }
  }
}

// mount() then destroy() of every section module, counted through patched globals installed before any script.
const COUNTERS = `(() => {
  const S = { timers: new Set(), frames: new Set(), listeners: new Map(), observers: new Set() };
  window.__S = S;
  const st = window.setTimeout.bind(window), ct = window.clearTimeout.bind(window), si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setTimeout = (fn, ms, ...a) => { const id = st((...x) => { S.timers.delete('t' + id); fn(...x); }, ms, ...a); S.timers.add('t' + id); return id; };
  window.clearTimeout = (id) => { S.timers.delete('t' + id); ct(id); };
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); S.timers.add('i' + id); return id; };
  window.clearInterval = (id) => { S.timers.delete('i' + id); ci(id); };
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => { const id = raf((t) => { S.frames.delete(id); fn(t); }); S.frames.add(id); return id; };
  window.cancelAnimationFrame = (id) => { S.frames.delete(id); caf(id); };
  const ids = new WeakMap(); let n = 0; const idOf = (o) => { if (!ids.has(o)) ids.set(o, ++n); return ids.get(o); };
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const key = (t, type, fn, o) => idOf(t) + '|' + type + '|' + idOf(fn) + '|' + (typeof o === 'boolean' ? o : !!(o && o.capture));
  EventTarget.prototype.addEventListener = function (type, fn, o) { if (fn && !(o && typeof o === 'object' && o.once)) S.listeners.set(key(this, type, fn, o), type); return add.call(this, type, fn, o); };
  EventTarget.prototype.removeEventListener = function (type, fn, o) { if (fn) S.listeners.delete(key(this, type, fn, o)); return rem.call(this, type, fn, o); };
  for (const name of ['IntersectionObserver', 'MutationObserver', 'ResizeObserver']) {
    const Native = window[name]; if (!Native) continue;
    window[name] = class extends Native { constructor(...a) { super(...a); S.observers.add(this); } disconnect() { S.observers.delete(this); return super.disconnect(); } };
  }
})()`;

async function leak() {
  const p = await openPage(DESKTOP);
  try {
    await before(p, COUNTERS);
    // main.js and the rooms module would mount on their own: serve them empty so only the test mounts sections.
    await p.intercept([{ match: /\/assets\/home\/(main|rooms\/index)\.js/, status: 200, headers: { 'content-type': 'text/javascript' }, body: '' }]);
    await p.goto(urlOf('ko'), { settle: 800 });
    const r = await p.eval(`(async () => {
      const S = window.__S, out = {};
      const { motion } = await import('/assets/home/motion.js'); const { life } = await import('/assets/home/life.js');
      const { text, timeOf } = await import('/assets/home/copy.js');
      const mods = { hero: ['hero', await import('/assets/home/hero.js')], focus: ['focus', await import('/assets/home/focus.js')], decor: ['decor', await import('/assets/home/decor.js')],
        themes: ['collection', await import('/assets/home/themes.js')], records: ['records', await import('/assets/home/records.js')], night: ['night', await import('/assets/home/night.js')] };
      const palette = { id: 'dawn', set() {}, subscribe() { return () => {}; } };
      const snap = () => ({ timers: S.timers.size, frames: S.frames.size, listeners: S.listeners.size, observers: S.observers.size });
      for (const [name, [id, mod]] of Object.entries(mods)) {
        document.getElementById(id).scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 400));
        const cycle = async () => {
          const L = life();
          const api = mod.mount(document.getElementById(id), { motion, life: L, text, timeOf, palette }) || {};
          await new Promise((r) => setTimeout(r, 1600));
          const running = snap();
          api.destroy && api.destroy(); L.end();
          await new Promise((r) => setTimeout(r, 80));
          return { running, end: snap(), own: L.counts };
        };
        const base = snap(), one = await cycle(), two = await cycle();
        const grow = (a, b) => Object.keys(a).filter((k) => b[k] > a[k]).map((k) => k + '+' + (b[k] - a[k]));
        // leaked: still held after destroy and growing with every mount; persistent: held once (a shared singleton)
        out[name] = { base, running: one.running, own: one.own, own2: two.own, leaked: grow(one.end, two.end), persistent: grow(base, one.end) };
      }
      return out; })()`);
    for (const [name, o] of Object.entries(r)) {
      const used = Object.keys(o.running).some((k) => o.running[k] > o.base[k]);
      const own = (c) => c.timers + c.intervals + c.frames;
      check('leak', `${name}: mount then destroy leaves nothing running`, !o.leaked.length && !own(o.own) && !own(o.own2),
        o.leaked.length ? 'grows per mount: ' + o.leaked.join(' ') : JSON.stringify(o.own));
      if (o.persistent.length) console.log(`note ${name}: ${o.persistent.join(' ')} held after the first destroy and not growing (a shared singleton)`);
      check('leak', `${name}: the section really registered work while mounted`, used, JSON.stringify(o.running));
    }
    check('leak', 'no console error while mounting', !p.log.console.length && !p.log.exceptions.length, [...p.log.console, ...p.log.exceptions].slice(0, 2).join(' | '));
  } catch (e) { check('leak', 'run', false, String(e.message)); } finally { await p.close(); }
}

async function fonts() {
  // each page loads only its own language's faces (extras F2): LINE Seed KR on ko pages, the app's font elsewhere
  const faces = (p) => [...p.log.requests.values()].filter((r) => r.type === 'Font').map((r) => (r.url.match(/\/assets\/fonts\/([a-z-]+)\.[0-9a-f]{10}\./) || [])[1]).filter(Boolean).sort();
  for (const [loc, want, rare] of [['ko', ['line-seed-ko', 'line-seed-latin'], true], ['en', ['line-seed-jp-latin'], false], ['ja', ['line-seed-jp-ja', 'line-seed-jp-latin'], false],
                                   ['ar', ['noto-sans-arabic'], false], ['zh-hant', ['noto-sans-tc'], false]]) {
    const p = await openPage(DESKTOP);
    try {
      await p.goto(urlOf(loc).replace(/\/?$/, '/') + 'feedback/', { settle: 2500 });
      const draft = await p.eval(`document.documentElement.hasAttribute('data-i18n-draft')`);
      if (draft && loc !== 'ko') console.log(`note fonts: ${loc} is a draft page (Korean fallback text); checked again once translated`);
      else check('fonts', `${loc} board loads the ${want.join(' + ')} face${want.length > 1 ? 's' : ''} only`, JSON.stringify(faces(p)) === JSON.stringify(want), faces(p).join('+'));
      await p.eval(`(() => { const s = document.createElement('p'); s.id = 'rare-probe'; s.textContent = '\ub6ec\ub6e9'; document.querySelector('main').append(s); })()`);
      await sleep(2000);
      if (rare) check('fonts', `${loc}: a rare Hangul syllable adds the rare face`, faces(p).includes('line-seed-rare'), faces(p).join('+'));
      else check('fonts', `${loc}: Hangul in a post falls back to the system font (no Korean face declared)`, !faces(p).some((f) => f.startsWith('line-seed-') && !f.startsWith('line-seed-jp')), faces(p).join('+'));
    } catch (e) { check('fonts', loc, false, String(e.message)); } finally { await p.close(); }
  }
}

// ---- rooms ----
const mouse = (p, type, x, y) => p.c.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'mouse' });
const roomReqs = (p) => [...p.log.requests.values()].map((r) => r.url || '').filter((u) => u.includes('/assets/rooms/')).map((u) => u.replace(/^https?:\/\/[^/]+/, ''));
const RMV = `(() => { const rv = document.getElementById('rmv'); if (!rv) return null; const act = document.activeElement;
  return { open: rv.open, phase: rv.dataset.phase, tod: rv.dataset.tod, name: (document.getElementById('rmv-name') || {}).textContent,
    items: [...rv.querySelectorAll('.rmv__iname')].length, night: (rv.querySelector('.rmv__marks button[data-tod="night"]') || {}).ariaChecked,
    active: act && act.closest('.tile') ? 'tile:' + act.closest('.tile')._room.id : (act && act.className) }; })()`;

async function rooms() {
  const p = await openPage(DESKTOP);
  try {
    await p.goto(urlOf('ko'), { settle: 400 });
    const atTop = roomReqs(p);
    check('rooms', 'no /assets/rooms/ request at the top of the page', !atTop.length, atTop.slice(0, 2).join(' '));
    await scrollToSection(p, '#rooms-host');
    await sleep(4500);
    const idle = roomReqs(p);
    const strange = idle.filter((u) => !/\/assets\/rooms\/manifest\.[0-9a-f]{10}\.json$/.test(u) && !/\/assets\/rooms\/[a-z0-9-]+\/thumb\.[0-9a-f]{10}\.webp$/.test(u));
    check('rooms', 'before dwell only the manifest and thumbs are requested', !strange.length && idle.some((u) => /manifest/.test(u)), `${idle.length} requests; unexpected: ${strange.slice(0, 2).join(' ')}`);
    await p.eval(`document.querySelector('.flow-toggle').click()`);   // hold the wall still (the visitor's own toggle)
    await sleep(700);
    const pick = async () => p.eval(`(() => { const t = [...document.querySelectorAll('.tile')].find((li) => { const r = li.querySelector('.tile__art').getBoundingClientRect();
      return r.left > 40 && r.right < innerWidth - 40 && r.top > 80 && r.bottom < innerHeight - 10; }); if (!t) return null; const r = t.querySelector('.tile__art').getBoundingClientRect();
      return { id: t._room.id, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    let tile = null;
    for (let i = 0; i < 12 && !tile; i++) { tile = await pick(); if (!tile) { await p.eval(`scrollBy(0, 60)`); await sleep(500); } }
    check('rooms', 'a tile is on the paper to aim at', !!tile);
    if (!tile) return;
    // crossing tiles at 100 ms loads nothing
    const crossed = new Set(roomReqs(p));
    await mouse(p, 'mouseMoved', tile.x - 6, tile.y - 6); await sleep(100); await mouse(p, 'mouseMoved', 5, 5); await sleep(700);
    const crossNew = roomReqs(p).filter((u) => !crossed.has(u) && !/\/thumb\.[0-9a-f]{10}\.webp$/.test(u));   // tiles that scroll into the pool bring their thumbs
    check('rooms', 'a pointer passing over a tile loads no room', !crossNew.length, crossNew.slice(0, 3).join(' '));
    // dwell loads that room only: layers, items and the day image; no dusk or night yet
    const manifest = await p.eval(`fetch(document.getElementById('rooms-host').dataset.roomsManifest).then((r) => r.json())`);
    const mine = (() => { const e = manifest.rooms[tile.id]; return new Set([e.day, ...e.layers.map((l) => l.src), ...e.items.map((i) => i.thumb), e.tod.dusk, e.tod.night, e.tod.lit].map((x) => '/assets/rooms/' + x)); })();
    const was = new Set(roomReqs(p));
    await mouse(p, 'mouseMoved', tile.x, tile.y); await sleep(2200);
    const got = roomReqs(p).filter((u) => !was.has(u));
    check('rooms', 'resting on a tile loads that room only', got.length > 0 && got.every((u) => mine.has(u)), `${got.length} files; foreign: ${got.filter((u) => !mine.has(u)).slice(0, 2).join(' ')}`);
    check('rooms', 'no dusk or night frame before opening', !got.some((u) => /\/(dusk|night|lit)\./.test(u)));
    // open
    await mouse(p, 'mousePressed', tile.x, tile.y); await mouse(p, 'mouseReleased', tile.x, tile.y);
    let state = null;
    for (let i = 0; i < 70; i++) { await sleep(250); state = await p.eval(RMV); if (state && state.open && state.tod === 'night' && state.night === 'true') break; }
    check('rooms', 'the room view opens and ends at night with the night mark checked', !!state && state.open && state.tod === 'night' && state.night === 'true', JSON.stringify(state));
    check('rooms', 'item names are listed', !!state && state.items > 0, `${state && state.items} items`);
    if (f.out) await p.shot(`${OUT}/rooms-open.png`);
    const name = state && state.name;
    await p.eval(`document.querySelector('.rmv__btn[data-go="1"]').click()`);
    await sleep(2500);
    const next = await p.eval(RMV);
    check('rooms', 'next room shows another room', !!next && next.name && next.name !== name, `${name} -> ${next && next.name}`);
    // rapid 다음: the row takes every step with the view, so the room shown keeps the opened tile's place
    const HIDDEN = `(() => { const li = [...document.querySelectorAll('.tile')].find((t) => t.querySelector('.tile__art').style.visibility === 'hidden'); if (!li) return null;
      const r = li.querySelector('.tile__art').getBoundingClientRect(); return { id: li._room.id, name: li._room.name, x: r.left + r.width / 2 }; })()`;
    const place = await p.eval(HIDDEN);
    for (let i = 0; i < 4; i++) { await p.key('ArrowRight', 'ArrowRight', 39); await sleep(70); }
    await sleep(1500);
    const kept = await p.eval(HIDDEN);
    const shown = await p.eval(RMV);
    check('rooms', 'rapid next presses keep the row with the view', !!place && !!kept && !!shown && Math.abs(kept.x - place.x) < 3 && kept.name === shown.name, `${JSON.stringify(kept)} vs place ${place && Math.round(place.x)}, view ${shown && shown.name}`);
    await p.key('Escape', 'Escape', 27);
    await sleep(1400);
    const closed = await p.eval(RMV);
    check('rooms', 'Esc closes the view and focus returns to a tile', !!closed && !closed.open && /^tile:/.test(closed.active || ''), JSON.stringify(closed));
    check('rooms', 'focus returns to the tile of the room shown', !!closed && !!kept && closed.active === 'tile:' + kept.id, `${closed && closed.active} vs ${kept && kept.id}`);
    const offPaper = await p.eval(`[...document.querySelectorAll('#rmv-flow .tile__btn')].filter((b) => b.tabIndex === 0 && b !== document.activeElement)
      .map((b) => b.querySelector('.tile__art').getBoundingClientRect()).filter((r) => r.left < -1 || r.right > innerWidth + 1).length`);
    check('rooms', 'no Tab stop is left on a tile off the paper', offPaper === 0, `${offPaper} off-paper stops`);
    // the page-wide pause: a room opens as its still day room (no build, no light pass), Esc returns to its tile
    await p.eval(`document.getElementById('motion-toggle').click()`);
    await sleep(400);
    const still = await pick();
    if (still) {
      await mouse(p, 'mousePressed', still.x, still.y); await mouse(p, 'mouseReleased', still.x, still.y);
      await sleep(300);
      const sv = await p.eval(`(() => { const rv = document.getElementById('rmv'); return [rv.dataset.path, rv.dataset.phase, rv.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length]; })()`);
      check('rooms', 'with the page paused a room opens as a still', sv[0] === 'still' && sv[1] === 'end' && sv[2] === 0, JSON.stringify(sv));
      await p.key('Escape', 'Escape', 27); await sleep(400);
      const back = await p.eval(RMV);
      check('rooms', 'with the page paused Esc returns focus to that tile', !!back && !back.open && back.active === 'tile:' + still.id, JSON.stringify(back));
    } else check('rooms', 'a tile to open with the page paused', false);
    await p.eval(`document.getElementById('motion-toggle').click()`);
    const bad = [...p.log.console, ...p.log.exceptions, ...p.log.http4xx, ...p.log.failed];
    check('rooms', 'no console error, exception, 4xx while browsing rooms', !bad.length, bad.slice(0, 2).join(' | '));
  } catch (e) { check('rooms', 'run', false, String(e.message)); } finally { await p.close(); }
  // the rooms module (or a kicker icon) cannot load: the page head shows the static list again and hides the icon
  const q = await openPage(PHONE);
  try {
    await q.intercept([{ match: /\/assets\/home\/rooms\/index\.js/, status: 404, body: 'gone' }, { match: /\/assets\/art\/kicker\//, status: 404, body: 'gone' }]);
    await q.goto(urlOf('ko'), { settle: 800 });
    await q.scrollThrough({ step: 0.8, delay: 150, max: 30 });
    await scrollToSection(q, '#rooms-host'); await sleep(600);
    const s = await q.eval(`(() => { const l = document.querySelector('#rooms-host .rooms-still'); const icons = [...document.querySelectorAll('img.obj-icon')];
      return { display: getComputedStyle(l).display, shown: [...l.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().height > 0).length,
        icons: icons.length, failed: icons.filter((i) => i.complete && !i.naturalWidth).length, visible: icons.filter((i) => i.complete && !i.naturalWidth && getComputedStyle(i).visibility !== 'hidden').length }; })()`);
    check('rooms', 'a rooms module that fails to load leaves the static list shown', s.display !== 'none' && s.shown === 12, JSON.stringify(s));
    check('rooms', 'a kicker icon that fails to load shows no broken image', s.failed > 0 && s.visible === 0, `${s.failed} failed, ${s.visible} still visible`);
  } catch (e) { check('rooms', 'fallback run', false, String(e.message)); } finally { await q.close(); }
}

const RUN = { layout, reduced, hero, pause, hidden, focus, decor, nojs, leak, fonts, rooms };
for (const name of ONLY) {
  if (!RUN[name]) { console.error('unknown scenario ' + name + '; known: ' + ALL.join(', ')); process.exit(2); }
  await RUN[name]();
}
console.log(`\n${results.length} assertions, ${failed} failing`);
process.exit(failed ? 1 : 0);
