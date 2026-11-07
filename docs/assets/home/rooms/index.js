/* 추천하는 방 둘러보기: mounts the room wall (wall.js) and the room view it opens (view.js) into #rooms-host
   once the section is within 600px of the viewport.

   Host contract (tools/templates/home.ko.html):
     <div class="rooms__tools" id="rooms-tools"></div>
     <div class="rooms-host" id="rooms-host" data-rooms-manifest="/assets/rooms/manifest.json" data-rooms-text="<!--ROOMS_TEXT-->"
          data-rooms-css="/assets/home/rooms.css">
       <ol class="rooms-still" aria-label="추천하는 방"><!--ROOMS_STILL--></ol>   (or the sample's <noscript> list)
     </div>
   The build stamps the URLs: the manifest becomes its hashed file, the text and the stylesheet get ?v=….
   The static list is replaced only after the wall module, its stylesheet, the manifest, the room text and the page
   copy (#page-copy) have all loaded; if any of them fails, the list stays. With script the list is hidden before the
   first paint (html.js, home/home.css) and the host holds the wall's height; a failed load marks host and tools
   .is-still, which shows the list again. If this module never runs (it or an import failed to load), the page head's
   error listener drops html.js, which shows the list the same way.

   Motion: a change of the reduced-motion setting mounts the wall again (wall and view read it once, at mount).
   The global pause (window 'mar:motion' {detail:{paused}}, html.is-motion-paused) is passed on live: it stops the
   wall's breathing and parallax. Room names, descriptions and item names come from the per-locale room text. */
import { readCopy, createText } from '/assets/site/text.mjs';

const host = document.getElementById('rooms-host');
const tools = document.getElementById('rooms-tools');
if (host && tools && host.dataset.roomsManifest && host.dataset.roomsText) start(host, tools);

function getJSON(url) {
  return fetch(url).then(r => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); });
}

/* the wall's stylesheet (home/rooms.css) is not render-blocking: it is inserted when the wall starts to mount */
function getCSS(url) {
  const old = [...document.querySelectorAll('link[rel="stylesheet"]')].find(l => l.href === url);
  if (old && old.sheet) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = old || Object.assign(document.createElement('link'), { rel: 'stylesheet', href: url });
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => { link.remove(); reject(new Error(`stylesheet ${url}`)); }, { once: true });
    if (!old) document.head.appendChild(link);
  });
}

/* the one place that knows the manifest's top level and the room text keys; view.js reads each room's layers and items */
export function roomData(manifest, words, base) {
  if (!manifest || manifest.version !== 2 || !manifest.rooms || !Array.isArray(manifest.order)) throw new Error('rooms manifest: unexpected format');
  if (!words || typeof words !== 'object') throw new Error('rooms text: unexpected format');
  const url = p => (p ? new URL(p, base).href : '');
  const word = k => (typeof words[k] === 'string' ? words[k] : '');
  const rooms = [];
  for (const id of manifest.order) {
    const e = manifest.rooms[id], name = word(`room.${id}.name`);
    if (!e || !e.thumb || !name) continue;          // a room without a picture or a name stays off the wall
    rooms.push({ id, name, desc: word(`room.${id}.desc`), theme: e.theme || '', themeName: word(`theme.${e.theme}`), wall: e.wall || '', thumb: url(e.thumb) });
  }
  if (!rooms.length) throw new Error('rooms manifest: no rooms');
  return { manifest, url, word, rooms };
}

/* the page-wide pause: the last mar:motion event wins; before any event, the class on <html> */
function pageMotion() {
  const root = document.documentElement, subs = new Set();
  let known = null;
  addEventListener('mar:motion', e => {
    const p = !!(e.detail && e.detail.paused);
    if (p === known) return;
    known = p;
    subs.forEach(fn => { try { fn(p); } catch (err) { console.error(err); } });
  });
  return {
    get paused() { return known !== null ? known : root.classList.contains('is-motion-paused'); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
  };
}

function start(host, tools) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = host.querySelector('noscript');
  const fallbackHTML = ns ? ns.textContent : null;
  const stillNodes = ns ? null : [...host.childNodes];
  const motion = pageMotion();
  let current = null, token = 0, started = false, ready = null;

  function restore() {
    if (fallbackHTML !== null) host.innerHTML = fallbackHTML; else host.replaceChildren(...stillNodes);
    tools.replaceChildren();
    delete host.dataset.variant;
    host.classList.add('is-still'); tools.classList.add('is-still');
  }
  function load() {
    if (!ready) {
      const manifestURL = new URL(host.dataset.roomsManifest, location.href).href;
      const textURL = new URL(host.dataset.roomsText, location.href).href;
      const css = host.dataset.roomsCss ? getCSS(new URL(host.dataset.roomsCss, location.href).href) : null;
      ready = Promise.all([import('./wall.js'), getJSON(manifestURL), getJSON(textURL), css]).then(([mod, manifest, words]) => {
        const { meta, copy } = readCopy();
        return { mod, data: roomData(manifest, words, manifestURL), text: createText(copy, meta.locale), rtl: meta.direction === 'rtl' };
      });
      ready.catch(() => { ready = null; });         // a later mount (reduced-motion change) tries again
    }
    return ready;
  }
  async function show() {
    const my = ++token;
    started = true;
    const a = document.activeElement, hadFocus = !!a && (host.contains(a) || tools.contains(a));   // e.g. the room view was open
    if (current) { try { current.destroy(); } catch (e) { console.error(e); } current = null; }
    try {
      const { mod, data, text, rtl } = await load();
      if (my !== token) return;                     // a later mount won while this one loaded
      host.replaceChildren(); tools.replaceChildren();
      host.classList.remove('is-still'); tools.classList.remove('is-still');
      host.dataset.variant = 'flow';
      current = mod.mount({ host, tools, reduce, motion, text, data, rtl });
      if (hadFocus) (host.querySelector('.tile__btn:not([tabindex="-1"])') || tools.querySelector('button') || host).focus({ preventScroll: true });
    } catch (e) {
      console.error(e);
      if (my === token) { current = null; restore(); }
    }
  }
  const near = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { near.disconnect(); if (!started) show(); }
  }, { rootMargin: '600px 0px' });
  reduce.addEventListener('change', () => { if (started) show(); });
  near.observe(host);
}
