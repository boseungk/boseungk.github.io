/* 추천하는 방: the room view. A tile on the wall unfolds into its whole room, modelled on the app's
   recommended-room detail (the room plus "이 조합의 물건").
   - First open of a room: the tile's picture hands back to a cream canvas and the room builds itself slot by slot
     (wall, floor, view, window, seat, rug, plant, lamp), each list item arriving in the same frame as its piece.
     The app's Apply swell holds the finished room, then one light carries it from day through dusk to night and
     the lamp turns on. The 낮 / 노을 / 밤 marks are then the visitor's.
   - Re-open: the finished day room. 이전 / 다음: the next room is painted over the current one, slot by slot.
   - Assets per room come from the room manifest v2 (/assets/rooms/manifest.json: paths relative to the manifest,
     hashed file names) and load only when a tile is hovered, focused, pressed or opened. Room names, descriptions
     and item names come from the per-locale room text; the view's own words from the page copy (site/text.mjs).
   Motion vocabulary (APP-DESIGN-LANGUAGE.md): the theme reveal's diagonal light front (114.2deg), the acquisition
   paper pieces and "arrive" curve, the measured choice wash (ui/selection.js) on the marks, the Purchase -> Apply
   swell, paper easing.
   Reduced motion, and the page-wide pause (read when a room opens; its button is outside the dialog), open the
   finished day room as a still: no build, no light pass; the marks switch at once.
   Every listener, timer and frame goes through the wall's life() (L), so the wall's destroy() ends the view too;
   while the dialog is closed this module runs no frames and no timers. */

/* build and list order: the lamp is the last piece, so the last object placed hands over to the evening.
   Any other slot goes just before 'light'. Outdoor rooms have no wall or window: their view is the backdrop. */
const BUILD_IN = ['wall', 'floor', 'view', 'window', 'wallDeco', 'sill', 'seat', 'rug', 'plantSpot', 'light'];
const BUILD_OUT = ['view', 'floor', 'seat', 'rug', 'plantSpot', 'light'];
const PAINT = ['view', 'wall', 'floor', 'rug', 'window', 'wallDeco', 'light', 'sill', 'plantSpot', 'seat'];
const MATERIAL = new Set(['wall', 'floor', 'view']);
const TODS = ['dusk', 'night', 'lit'];

/* timing (ms) */
const T = {
  unfold: 520, fold: 420, picLead: 120,
  build0: 520, gap: 560, lastBy: 4700,   // one piece about every 0.56s: the list wash rests on each item before moving on
  nameIn: 220, out: 120, wash: 540, washFade: 160,
  apply: 800, lightAfter: 520, lightLate: 1500,
  dusk: 1200, nightLag: 800, night: 1200, lampWait: 500, lamp: 420, edge: .30, angle: 114.2,
  fast0: 80, fastGap: 230, fastLastBy: 1700, fastWash: 320,
  swap: 650, user: 800, cover: 220, closeCover: 160, waitLayers: 1200, clear: 300,
  settle: 250, noPic: 400   // 이전/다음: a room's requests start once it has been shown this long; the old picture leaves after noPic
};
const FIRST = { sweep: 900, roll: 820, view: 560, gather: 640, arrive: 520 };
const FAST = { sweep: 600, roll: 560, view: 420, gather: 480, arrive: 420 };

/* ---------- easing ---------- */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = t => ((ax * t + bx) * t + cx) * t, fy = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = fx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
    if (t < 0 || t > 1 || Math.abs(fx(t) - x) > 1e-4) { let a = 0, b = 1; t = x; for (let i = 0; i < 24; i++) { if (fx(t) < x) a = t; else b = t; t = (a + b) / 2; } }
    return fy(t);
  };
}
const paper = bezier(.22, .61, .36, 1), inkE = bezier(.4, 0, .2, 1), gatherE = bezier(.22, .65, .3, 1);
const swellE = bezier(.3, .6, .4, 1), returnE = bezier(.4, 0, .6, 1);
const SPRING = [0, .0826, .2553, .4445, .6138, .749, .8485, .9169, .9609, .987, 1.001, 1.0074, 1.0093, 1.0088, 1.0073, 1.0055, 1.0039, 1.0026, 1.0016, 1.0009, 1];
const spring = p => { if (p >= 1) return 1; const f = p * (SPRING.length - 1), i = Math.floor(f); return SPRING[i] + (SPRING[i + 1] - SPRING[i]) * (f - i); };
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const lin = t => t;
const mix = (a, b, t) => a + (b - a) * t;
const PAPER = 'cubic-bezier(.22,.61,.36,1)', INK = 'cubic-bezier(.4,0,.2,1)';

/* acquisition cuts: polygon, start offset, delay; each cut grows 4% about its centre so neighbours overlap (no seams) */
const PIECES = [
  ['0 0,38% 0,34% 42%,0 48%', -5, -4, 30], ['38% 0,72% 0,68% 46%,34% 42%', 0, -6, 0], ['72% 0,100% 0,100% 50%,68% 46%', 5, -4, 60],
  ['0 48%,34% 42%,38% 100%,0 100%', -5, 5, 70], ['34% 42%,68% 46%,64% 100%,38% 100%', 0, 6, 20], ['68% 46%,100% 50%,100% 100%,64% 100%', 5, 4, 50]];
const TURN = [-2, 2, -1, 2, -2, -1];
const CUTS = PIECES.map(([cut]) => {
  const v = cut.split(',').map(p => p.trim().split(/\s+/).map(parseFloat));
  const cx = v.reduce((a, p) => a + p[0], 0) / v.length, cy = v.reduce((a, p) => a + p[1], 0) / v.length;
  return 'polygon(' + v.map(([x, y]) => `${(cx + (x - cx) * 1.04).toFixed(2)}% ${(cy + (y - cy) * 1.04).toFixed(2)}%`).join(',') + ')';
});

/* the hero's time-of-day marks (.todpick), namespaced ids; the label span carries the measured selection wash */
const marksMarkup = LABEL => `
        <button type="button" role="radio" aria-checked="true" data-tod="day"><span class="mar-choice-label"><svg class="tod" viewBox="0 0 48 48" width="28" height="28" aria-hidden="true"><g class="rays" stroke="#F6B92B" stroke-width="3.8" stroke-linecap="round"><path d="M39.5 24H44M34.96 34.96L38.14 38.14M24 39.5V44M13.04 34.96L9.86 38.14M8.5 24H4M13.04 13.04L9.86 9.86M24 8.5V4M34.96 13.04L38.14 9.86"/></g><circle class="sun" cx="24" cy="24" r="10.5" fill="#F6B92B"/></svg><span>${LABEL.day}</span></span></button>
        <button type="button" role="radio" aria-checked="false" data-tod="dusk"><span class="mar-choice-label"><svg class="tod" viewBox="0 0 48 48" width="28" height="28" aria-hidden="true"><defs><clipPath id="rmv-tde-c"><rect x="-4" y="-4" width="56" height="40"/></clipPath><mask id="rmv-tde-m"><rect x="-4" y="-4" width="56" height="56" fill="#fff"/><circle cx="39.4" cy="10.4" r="7.6"/></mask></defs><circle clip-path="url(#rmv-tde-c)" cx="19" cy="38" r="14.5" fill="#F37F57"/><circle class="crescent" cx="36" cy="13.5" r="8.2" fill="#56659E" mask="url(#rmv-tde-m)"/><g stroke="#F37F57" stroke-width="2.4" stroke-linecap="round" opacity=".5"><line class="glint" style="--i:0" x1="11" y1="40.5" x2="27" y2="40.5"/><line class="glint" style="--i:1" x1="14" y1="44.2" x2="24" y2="44.2"/><line class="glint" style="--i:2" x1="16.7" y1="47.6" x2="21.3" y2="47.6"/></g></svg><span>${LABEL.dusk}</span></span></button>
        <button type="button" role="radio" aria-checked="false" data-tod="night"><span class="mar-choice-label"><svg class="tod" viewBox="0 0 48 48" width="28" height="28" aria-hidden="true"><g class="moon"><circle cx="22.5" cy="25" r="13.5" fill="#EFC766"/><g fill="#DDAE45"><circle cx="17.8" cy="20.4" r="2.9"/><circle cx="26.6" cy="27.2" r="3.7"/><circle cx="18.8" cy="31.2" r="1.8"/></g></g><g class="cloud" fill="#2F3752"><circle cx="22" cy="36.5" r="5.2"/><circle cx="29.5" cy="32.5" r="7.4"/><circle cx="37.5" cy="36" r="5.6"/><rect x="17" y="36" width="26" height="5.6" rx="2.8"/></g><path class="star" fill="#2F3752" d="M39.5 5.1Q39.5 10.5 44.9 10.5Q39.5 10.5 39.5 15.9Q39.5 10.5 34.1 10.5Q39.5 10.5 39.5 5.1Z"/></svg><span>${LABEL.night}</span></span></button>`;

const markup = (w, LABEL) => `<dialog class="rmv" id="rmv" aria-labelledby="rmv-name" aria-describedby="rmv-desc" data-phase="idle" data-tod="day">
  <div class="rmv__scrim" data-close></div>
  <div class="rmv__sheet">
    <button type="button" class="rmv__close" data-close aria-label="${w.close}" autofocus><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path class="g" d="M5.2 4.8C9.6 8.1 14.6 14.1 19.3 19M19.2 4.9C15.4 9.7 9.4 14.2 4.7 19.2"/><path d="M5.2 4.8C9.6 8.1 14.6 14.1 19.3 19M19.2 4.9C15.4 9.7 9.4 14.2 4.7 19.2"/></svg></button>
    <div class="rmv__head rmv__t"><p class="rmv__kicker" id="rmv-theme"></p><h2 class="rmv__name" id="rmv-name"></h2></div>
    <div class="rmv__stage">
      <figure class="rmv__art" id="rmv-art" role="img" aria-label="">
        <div class="rmv__room">
          <div class="rmv__scene" aria-hidden="true">
            <div class="rmv__base">
              <img class="rmv__day" alt="" width="780" height="1688" decoding="async" draggable="false">
              <img class="rmv__tod" data-tod="dusk" alt="" decoding="async" draggable="false">
              <img class="rmv__tod" data-tod="night" alt="" decoding="async" draggable="false">
              <img class="rmv__tod" data-tod="lit" alt="" decoding="async" draggable="false">
            </div>
            <div class="rmv__build"></div>
            <img class="rmv__cover" alt="" decoding="async" draggable="false">
          </div>
        </div>
      </figure>
      <div class="rmv__marks rmv__t" role="radiogroup" aria-label="${w.marks}">${marksMarkup(LABEL)}
      </div>
    </div>
    <p class="rmv__desc rmv__t" id="rmv-desc"></p>
    <section class="rmv__items rmv__t" aria-labelledby="rmv-items-k">
      <h3 class="rmv__items-k" id="rmv-items-k">${w.items}</h3>
      <div class="rmv__recipe"><span class="rmv__wash" aria-hidden="true"></span><ol class="rmv__list"></ol></div>
      <p class="rmv__note">${w.note}</p>
    </section>
    <div class="rmv__nav rmv__t">
      <button type="button" class="rmv__btn" data-go="-1"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="g" d="M14.6 5.4C12.4 7.6 10.6 9.7 8.9 12.1C10.7 14.4 12.5 16.4 14.7 18.6"/><path d="M14.6 5.4C12.4 7.6 10.6 9.7 8.9 12.1C10.7 14.4 12.5 16.4 14.7 18.6"/></svg><span>${w.prev}</span></button>
      <button type="button" class="rmv__btn" data-go="1"><span>${w.next}</span><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="g" d="M9.4 5.4C11.6 7.6 13.4 9.7 15.1 12.1C13.3 14.4 11.5 16.4 9.3 18.6"/><path d="M9.4 5.4C11.6 7.6 13.4 9.7 15.1 12.1C13.3 14.4 11.5 16.4 9.3 18.6"/></svg></button>
    </div>
    <p class="sr-only" id="rmv-live" aria-live="polite"></p>
  </div>
</dialog>`;

/* scene points (390 x 844) to percentages of the scene box */
const place = (el, b) => { const s = el.style; s.left = (b.x / 3.9).toFixed(4) + '%'; s.top = (b.y / 8.44).toFixed(4) + '%'; s.width = (b.w / 3.9).toFixed(4) + '%'; s.height = (b.h / 8.44).toFixed(4) + '%'; };
const setMask = (el, ang, f, edge) => { const g = `linear-gradient(${ang}deg, #000 ${((f - edge) * 100).toFixed(2)}%, transparent ${((f + edge) * 100).toFixed(2)}%)`; el.style.webkitMaskImage = g; el.style.maskImage = g; };
const clearMask = el => { el.style.webkitMaskImage = ''; el.style.maskImage = ''; };
const rectIn = (box, el) => { const b = box.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; };
const washTo = (w, r) => { w.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px) scale(${(r.w / 100).toFixed(4)}, ${(r.h / 100).toFixed(4)})`; };
const lerpRect = (a, b, t) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });
const replay = (el, cls) => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); };
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escAll = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v).replace(/[&<>"]/g, ch => ESC[ch])]));

/* createRoomView({ L, host, reduce, motion, rows, text, data, rtl, themeLabel }) -> { open(li), prefetch(room), state }
   data: index.js roomData() (manifest v2, url(), word(), rooms); text: page copy; rows: the wall's row interface;
   motion: the page-wide pause ({ paused }) */
export function createRoomView({ L, host, reduce, motion, rows, text, data, rtl = false, themeLabel }) {
  const calm = () => reduce.matches || !!(motion && motion.paused);
  const LABEL = { day: text('낮'), dusk: text('노을'), night: text('밤') };
  const W = { close: text('닫기'), marks: text('방의 시간대'), items: text('이 조합의 물건'),
    note: text('앱에서는 물건을 하나씩 골라 꾸미기에서 미리 볼 수 있어요.'), prev: text('이전 방'), next: text('다음 방') };
  const SCENERY = text('풍경');
  // the room's own name (some names already say "room": 사구의 작은 방), with the time of day when one is shown
  const roomLabel = (name, tod) => tod ? text('{name}, {tod}', { name, tod: LABEL[tod] }) : name;
  const byId = new Map(data.rooms.map(r => [r.id, r]));
  const thumbURL = id => (byId.get(id) || {}).thumb || '';
  const fullURL = id => { const m = entry(id); return m ? m.day : ''; };   // the finished day room (equals the stacked layers)

  host.insertAdjacentHTML('beforeend', markup(escAll(W), escAll(LABEL)));
  const rv = host.querySelector('#rmv'), $ = s => rv.querySelector(s);
  const sheet = $('.rmv__sheet'), scrim = $('.rmv__scrim'), closeBtn = $('.rmv__close');
  const art = $('#rmv-art'), roomEl = $('.rmv__room'), base = $('.rmv__base'), build = $('.rmv__build'), cover = $('.rmv__cover'), dayEl = $('.rmv__day');
  const todEl = Object.fromEntries(TODS.map(k => [k, $(`.rmv__tod[data-tod="${k}"]`)]));
  const marks = $('.rmv__marks'), markBtns = [...marks.querySelectorAll('button')];
  const elTheme = $('#rmv-theme'), elName = $('#rmv-name'), elDesc = $('#rmv-desc');
  const itemsSec = $('.rmv__items'), recipe = $('.rmv__recipe'), wash = $('.rmv__wash'), list = $('.rmv__list'), note = $('.rmv__note');
  const live = $('#rmv-live'), nextBtn = $('.rmv__btn[data-go="1"]');
  const textEls = [...rv.querySelectorAll('.rmv__t')];
  const markFor = tod => markBtns.find(b => b.dataset.tod === tod);

  const state = { open: false, st: null, slot: 0 };
  const seen = new Set();
  let cur = null;          // the room shown: { room, m, path, full, applied, ... }; a new object per open / prev / next
  let from = null, closing = false, still = false, skipping = null, phase = 'idle';

  L.add(() => { if (state.open) document.documentElement.style.overflow = ''; });
  /* the marks take the site's measured selection wash (ui/selection.js, the native choice spring); it follows
     aria-checked, hover and focus by itself and settles without frames when motion is reduced or paused */
  if (window.MARSelection) {
    window.MARSelection.mount(marks, markBtns, () => markBtns.find(b => b.getAttribute('aria-checked') === 'true') || null);
    L.add(() => window.MARSelection.destroy(marks));
  }

  /* ---------- manifest v2: paths relative to the manifest, item names from the room text ---------- */
  const manifest = data.manifest, url = data.url, word = data.word;
  const norm = new Map();
  /* the only place that knows a room entry's format: null when the room has no entry (it opens as its picture) */
  function entry(id) {
    if (norm.has(id)) return norm.get(id);
    const e = manifest.rooms[id];
    let n = null;
    if (e) {
      const roomName = word(`room.${id}.name`);
      const slotOf = s => s === 'environment' ? 'view' : s;
      const layers = (e.layers || []).map((l, i) => ({ slot: slotOf(l.slot), src: url(l.src), x: +l.x, y: +l.y, w: +l.w, h: +l.h, z: l.z ?? PAINT.indexOf(slotOf(l.slot)) }))
        .sort((a, b) => a.z - b.z);
      const outdoor = e.structure === 'outdoor' || !layers.some(l => l.slot === 'wall');
      const order = outdoor ? BUILD_OUT : BUILD_IN;
      const rank = s => { const i = order.indexOf(s); return i < 0 ? order.indexOf('light') - .5 : i; };
      // a scenery card often carries the room's own name: the list says the app's label instead of repeating the title
      const items = (e.items || []).map((it, i) => {
        const name = word(`item.${it.item}`), slot = slotOf(it.slot);
        return { slot, name: slot === 'view' && name === roomName ? SCENERY : name, thumb: url(it.thumb), i };
      }).sort((a, b) => rank(a.slot) - rank(b.slot) || a.i - b.i);
      const tod = e.tod || {};
      n = { id, outdoor, items, layers, day: url(e.day), tod: { dusk: url(tod.dusk), night: url(tod.night), lit: url(tod.lit) },
        ok: layers.length > 0 && items.length > 0 && !!e.day };
    }
    norm.set(id, n);
    return n;
  }

  /* ---------- loading: at most six requests in flight, each image decoded before use, failures resolve to null.
     Lower prio first; within a prio the newest request first, so the room the visitor lands on never waits behind
     rooms passed on the way. Each job knows its room: demote() sends rooms no longer wanted to the back. ---------- */
  const queue = [], pending = new Map(), queued = new Map();
  let inflight = 0, seq = 0;
  const byPrio = (a, b) => a.prio - b.prio || b.seq - a.seq;
  function want(url, prio, room = '') {
    if (!url) return Promise.resolve(null);
    let p = pending.get(url);
    if (p) {
      const q = queued.get(url);      // still waiting: the latest asker's room and priority win
      if (q) { q.prio = Math.min(q.prio, prio); if (room) q.room = room; q.seq = ++seq; queue.sort(byPrio); }
      return p;
    }
    p = new Promise(res => {
      const job = { url, prio, room, seq: ++seq, res };
      queue.push(job); queued.set(url, job);
      queue.sort(byPrio);
    });
    pending.set(url, p);
    pump();
    return p;
  }
  function demote(keep) {
    let moved = false;
    for (const j of queue) if (j.prio < 9 && !keep.has(j.room)) { j.prio = 9; moved = true; }
    if (moved) queue.sort(byPrio);
  }
  /* the view closed: requests still waiting are dropped (they resolve null; those in flight finish). A room whose
     layers were among them is forgotten, so opening it again asks for them again. */
  function dropQueue() {
    const rooms = new Set();
    for (const j of queue.splice(0)) { queued.delete(j.url); pending.delete(j.url); rooms.add(j.room); j.res(null); }
    for (const id of rooms) { const s = sets.get(id); if (s && !s.done) sets.delete(id); }
  }
  /* the room shown and its two row neighbours */
  function around() {
    const k = new Set();
    if (!state.st) return k;
    for (const d of [0, -1, 1]) { const r = rows.roomAt(state.st, state.slot + d); if (r) k.add(r.id); }
    return k;
  }
  function pump() {
    while (inflight < 6 && queue.length) {
      const job = queue.shift();
      queued.delete(job.url);
      inflight++;
      const im = new Image();
      im.decoding = 'async';
      im.src = job.url;
      im.decode().then(() => im, () => null).then(r => {
        inflight--;
        pending.delete(job.url);
        job.res(r);
        if (!L.dead) pump();
      });
    }
  }
  /* decoded layer + drawing sets for the last 4 rooms */
  const sets = new Map();
  L.add(() => sets.clear());
  function roomSet(id, prio = 0) {
    let s = sets.get(id);
    if (s) { sets.delete(id); sets.set(id, s); return s; }
    const m = entry(id);
    if (!m || !m.ok) return null;
    s = { id, done: false, ready: false, keep: [] };
    let failed = false;
    const ps = [
      ...m.layers.map(l => want(l.src, prio, id).then(im => { if (im) s.keep.push(im); else failed = true; })),
      ...m.items.map(it => want(it.thumb, prio, id).then(im => { if (im) s.keep.push(im); }))
    ];
    s.p = Promise.all(ps).then(() => { s.done = true; s.ready = !failed; return s; });
    sets.set(id, s);
    for (const k of sets.keys()) {
      if (sets.size <= 4) break;
      if (cur && k === cur.room.id) continue;
      sets.delete(k);
    }
    return s;
  }
  const fulls = new Map();   // id -> Promise<boolean>, last 6
  function loadFull(id, prio = 1) {
    if (fulls.has(id)) return fulls.get(id);
    const p = want(fullURL(id), prio, id).then(im => { if (!im) fulls.delete(id); return !!im; });
    fulls.set(id, p);
    if (fulls.size > 6) fulls.delete(fulls.keys().next().value);
    return p;
  }
  /* hover or focus (after a short dwell), press: the room's layers and drawings, then its full picture.
     Only the latest such room stays at the front of the queue. */
  function prefetch(room) {
    if (!room || L.dead) return;
    demote(state.open ? new Set([...around(), room.id]) : new Set([room.id]));
    if (!calm()) roomSet(room.id, 0);
    loadFull(room.id, 1);
  }
  function prefetchNeighbours(c) {
    if (!state.open || !state.st) return;
    for (const d of [-1, 1]) { const r = rows.roomAt(state.st, state.slot + d); if (r && entry(r.id)) roomSet(r.id, 3); }
  }
  /* the neighbours' layers (이전/다음 build from them) wait until this room's own sequence has ended and the view
     has rested a moment, so opening a room downloads that room first; none on Save-Data or a 2G/3G connection */
  function neighboursLater(c) {
    const net = navigator.connection;
    if (net && (net.saveData || /(^|-)[23]g$/.test(net.effectiveType || ''))) return;
    const wait = () => {
      if (c !== cur || !state.open || closing) return;
      if (phase !== 'end') { L.later(wait, 250); return; }
      L.later(() => { if (c === cur && state.open && !closing) prefetchNeighbours(c); }, 600);
    };
    wait();
  }

  /* ---------- one clock, many tracks (times in ms from the start of the current sequence) ---------- */
  let tracks = [], raf = 0, last = 0, clock = 0, quiet = false;
  function add(start, dur, ease, fn, end, el) { tracks.push({ start, dur, ease, fn, end, el, on: false, done: false }); run(); }
  function tick(t) {
    for (const k of tracks) {
      if (k.done || t < k.start) continue;
      if (!k.on) { k.on = true; if (k.el && !quiet) k.el.style.willChange = 'transform, opacity'; }
      const raw = k.dur > 0 ? clamp((t - k.start) / k.dur) : 1;
      if (k.fn) k.fn(k.ease(raw), raw);
      if (raw >= 1) { k.done = true; if (k.el) k.el.style.willChange = ''; if (k.end) k.end(); }
    }
    tracks = tracks.filter(k => !k.done);
  }
  function loop(now) {
    raf = 0;
    const dt = last ? Math.min(50, now - last) : 16;
    last = now; clock += dt;
    tick(clock);
    if (tracks.length && state.open && !closing) { if (!raf) raf = L.frame(loop); } else last = 0;   // a track's add() may have asked already
  }
  function run() { if (!raf && state.open && !closing && tracks.length) raf = L.frame(loop); }
  function stopClock() { L.cancel(raf); raf = 0; last = 0; }
  function dropTracks() { for (const k of tracks) if (k.el) k.el.style.willChange = ''; tracks = []; }
  /* run every track to its end state at once, without the narrative steps (phase end, marks replay, live text) */
  function finishTracks() {
    quiet = true;
    try { tick(Infinity); } finally { quiet = false; }
    tracks = [];
  }
  function newSequence() { finishTracks(); clock = 0; last = 0; }

  function setPhase(p) {
    if (phase === p) return;
    phase = p;
    rv.dataset.phase = p;
    try { performance.mark('rmv:' + p); } catch (_) {}
  }

  /* ---------- marks ---------- */
  function setMarks(tod, { play = false } = {}) {
    for (const b of markBtns) { const on = b.dataset.tod === tod; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    const b = markFor(tod);
    if (play && !still) replay(b.querySelector('svg'), 'play');
    rv.dataset.tod = tod;
  }
  const todReady = (c, tod) => tod === 'day' || (c && (tod === 'night' ? (c.applied.lit || c.applied.night) : c.applied[tod]));
  function refreshMarks() {
    const c = cur, off = !c || !!c.plain || !!c.todFailed;
    marks.toggleAttribute('data-off', off);
    if (off) { marks.setAttribute('aria-hidden', 'true'); marks.inert = true; } else { marks.removeAttribute('aria-hidden'); marks.inert = false; }
    for (const b of markBtns) b.setAttribute('aria-disabled', String(!todReady(c, b.dataset.tod)));
    const a = document.activeElement;
    if (a && marks.contains(a) && (off || a.getAttribute('aria-disabled') === 'true')) nextBtn.focus({ preventScroll: true });
  }
  const artLabel = (c, tod) => art.setAttribute('aria-label', roomLabel(c.room.name, tod));

  /* ---------- the room's pictures ---------- */
  const srcFor = (c, tod) => tod === 'dusk' ? c.m.tod.dusk : tod === 'night' ? (c.applied.lit ? c.m.tod.lit : c.m.tod.night) : (c.full ? fullURL(c.room.id) : thumbURL(c.room.id));
  /* the full picture replaces the thumbnail as soon as it is decoded (identical framing, sharper) */
  function applyDay(c) { if (c === cur && c.baseIsCurrent && c.full && dayEl.dataset.src !== fullURL(c.room.id)) setDay(fullURL(c.room.id)); }
  function setDay(src) { dayEl.src = src; dayEl.dataset.src = src; }
  function loadTods(c) {
    if (!c.m || !c.m.ok || c.todsAsked) return;
    c.todsAsked = true;
    let left = TODS.length;
    for (const k of TODS) want(c.m.tod[k], 2, c.room.id).then(im => {
      if (c !== cur || L.dead) return;
      c.todImg[k] = im;
      if (im) applyTods(c);
      // the evening pictures failed: no light pass, and the marks go away as for a plain room
      if (!--left && (!c.todImg.dusk || !(c.todImg.night || c.todImg.lit))) { c.todFailed = true; refreshMarks(); }
    });
  }
  /* the dialog's tod pictures take the current room's frames only while the base shows the current room */
  function applyTods(c) {
    if (c !== cur || !c.baseIsCurrent || !state.open) return;
    for (const k of TODS) {
      if (!c.todImg[k] || c.applying[k]) continue;
      const el = todEl[k], src = c.m.tod[k], mine = c.applying[k] = {};
      el.src = src;
      // applied only once this very picture has decoded in its element (it may have been cleared meanwhile)
      el.decode().then(() => {
        if (c !== cur || L.dead || c.applying[k] !== mine) return;
        if (el.getAttribute('src') !== src) { c.applying[k] = null; return; }
        c.applied[k] = true;
        refreshMarks();
        if (c.onTod) c.onTod();
      }, () => { if (c.applying[k] === mine) c.applying[k] = null; });
    }
  }
  function resetTodEls() {
    for (const k of TODS) { const el = todEl[k]; el.removeAttribute('src'); el.style.opacity = ''; el.style.zIndex = ''; clearMask(el); }
    if (cur) { cur.applying = {}; cur.applied = {}; }     // the frames are gone: they must be applied again
  }
  /* the base shows `tod`: day under everything, the chosen frame above it */
  function setBase(tod) {
    dayEl.style.opacity = ''; dayEl.style.zIndex = ''; clearMask(dayEl);
    for (const k of TODS) {
      const el = todEl[k];
      el.style.zIndex = ''; clearMask(el);
      el.style.opacity = (tod === 'dusk' && k === 'dusk') || (tod === 'night' && (k === 'lit' || (k === 'night' && !cur.applied.lit))) ? '1' : '';
    }
  }
  function newSet(m) {
    const el = document.createElement('div');
    el.className = 'rmv__set';
    const hosts = {};
    m.layers.forEach((l, i) => { const d = document.createElement('div'); d.className = 'rmv__slot'; d.dataset.slot = l.slot; d.style.zIndex = String(i + 1); el.appendChild(d); hosts[l.slot] = d; });
    build.appendChild(el);
    return { el, hosts };
  }
  const clearBuild = () => { build.textContent = ''; };
  function makeLayer(l) {
    const im = new Image();
    im.alt = ''; im.className = 'rmv__layer'; im.decoding = 'sync'; im.draggable = false;
    im.src = l.src;
    place(im, l);
    return im;
  }

  /* ---------- a slot's piece arrives ----------
     wall (and an outdoor backdrop): colour comes in as light from the upper left, the theme reveal's front;
     floor: the same front laid from the foot of the wall towards you; view: far away, so it comes into focus;
     objects: the acquisition paper pieces gather into the drawing. Returns the step's end time. */
  function layerIn(set, l, t0, tm, outdoor, viewBox, floorBox) {
    const slotHost = set.hosts[l.slot], nw = makeLayer(l);
    // the wall's pattern runs on under the floor (the app hides it there): until the floor is laid, it stops at the floor line
    if (l.slot === 'wall' && floorBox && l.y + l.h > floorBox.y + .5) {
      nw.style.clipPath = `inset(0 0 ${((l.y + l.h - floorBox.y) / l.h * 100).toFixed(3)}% 0)`;
      set.unclipWall = () => { nw.style.clipPath = ''; };
    }
    if (l.slot === 'wall' || l.slot === 'floor' || (l.slot === 'view' && outdoor)) {
      const sweep = l.slot !== 'floor', ang = sweep ? T.angle : 180, edge = sweep ? .09 : .06, dur = sweep ? tm.sweep : tm.roll;
      // the wall's window opening shows blank paper (never the previous room) until the view arrives
      let hole = null;
      if (l.slot === 'wall' && viewBox && set.hosts.view) {
        hole = document.createElement('div');
        hole.className = 'rmv__hole';
        place(hole, viewBox);
        setMask(hole, ang, -edge - .02, edge);
        set.hosts.view.appendChild(hole);
      }
      setMask(nw, ang, -edge - .02, edge);
      slotHost.appendChild(nw);
      add(t0, dur, lin, (e, raw) => {
        const f = mix(-edge - .02, 1 + edge + .02, smooth(paper(raw)));
        setMask(nw, ang, f, edge);
        if (hole) setMask(hole, ang, f, edge);
      }, () => { clearMask(nw); if (hole) clearMask(hole); if (l.slot === 'floor' && set.unclipWall) set.unclipWall(); });
      return t0 + dur;
    }
    if (l.slot === 'view') {
      nw.style.opacity = '0';
      slotHost.appendChild(nw);
      add(t0, tm.view, paper, e => { nw.style.opacity = String(e); nw.style.transform = `scale(${(1.06 - .06 * e).toFixed(4)})`; },
        () => { nw.style.opacity = ''; nw.style.transform = ''; }, nw);
      return t0 + tm.view;
    }
    nw.style.opacity = '0';
    slotHost.appendChild(nw);
    return gather(slotHost, nw, l, t0 + 40, tm.gather);
  }
  function gather(slotHost, nw, box, t0, dur) {
    const wrap = document.createElement('div');
    wrap.className = 'rmv__pieces';
    place(wrap, box);
    const kk = clamp(art.clientWidth * box.w / 390 / 240, .5, 1);
    const ps = PIECES.map(([, fx, fy, d], n) => {
      const im = document.createElement('img');
      im.alt = ''; im.decoding = 'sync'; im.draggable = false; im.src = nw.src;
      im.style.clipPath = CUTS[n]; im.style.opacity = '0';
      wrap.appendChild(im);
      return { im, fx: fx * 2.4 * kk, fy: fy * 1.8 * kk, d, turn: TURN[n] };
    });
    slotHost.appendChild(wrap);
    for (const p of ps) add(t0 + p.d, dur, lin, (e, raw) => {
      const q = gatherE(raw), r = 1 - q;
      p.im.style.opacity = String(clamp(raw / .36));
      p.im.style.transform = raw >= 1 ? 'none' : `translate(${(p.fx * r).toFixed(2)}px, ${(p.fy * r).toFixed(2)}px) rotate(${(p.turn * r).toFixed(3)}deg) scale(${(.98 + .02 * q).toFixed(4)})`;
    }, null, p.im);
    // the whole drawing fills in under the pieces early (6% to 32% of the gather), then the pieces leave
    add(t0 + dur * .06, dur * .26, smooth, e => { nw.style.opacity = String(e); });
    add(t0 + 70 + dur, 0, lin, null, () => { nw.style.opacity = ''; wrap.remove(); });
    return t0 + 70 + dur;
  }

  /* ---------- 이 조합의 물건 ---------- */
  let itemEls = [];
  const colsFor = n => n <= 8 ? 4 : n <= 10 ? 5 : 4;
  function makeItem(it, hidden) {
    const li = document.createElement('li');
    li.className = 'rmv__item';
    li.innerHTML = '<span class="rmv__draw"></span><span class="rmv__iname"></span>';
    const x = { li, draw: li.firstChild, name: li.lastChild, img: null, it: null };
    if (it) {
      li.dataset.slot = it.slot;
      x.name.textContent = it.name;
      x.img = drawingImg(it, hidden);
      x.draw.appendChild(x.img);
      x.it = it;
      if (hidden) x.name.style.opacity = '0';
    }
    return x;
  }
  /* a drawing that cannot load leaves a quiet swatch in its place (rooms.css), never a gap or a broken image */
  function missing(im) {
    im.style.visibility = 'hidden'; im.style.opacity = '';
    const d = im.parentElement;
    if (d && d.lastElementChild === im) d.classList.add('is-missing');
  }
  function drawingImg(it, hidden, lazy) {
    const im = document.createElement('img');
    im.alt = ''; im.decoding = 'async'; im.draggable = false;
    im.onerror = () => missing(im);
    if (MATERIAL.has(it.slot)) im.className = 'is-material';
    if (lazy) { im.dataset.src = it.thumb; if (hidden) im.style.opacity = '0'; return im; }   // requested by wakeDrawing()
    im.src = it.thumb;
    if (hidden) im.style.opacity = '0';
    else if (!(im.complete && im.naturalWidth)) {     // not decoded yet: no grey box; it fades in when it decodes
      im.style.opacity = '0';
      im.decode().then(() => {
        if (L.dead) return;
        im.style.opacity = '';
        if (!still) im.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: PAPER });
      }, () => missing(im));
    }
    return im;
  }
  /* a drawing whose request waited (이전/다음 before the room settled): shown once decoded, never as a grey box */
  function wakeDrawing(im) {
    if (!im || !im.dataset.src || im.getAttribute('src')) return;
    im.src = im.dataset.src; delete im.dataset.src;
    if (im.complete && im.naturalWidth) return;
    im.style.visibility = 'hidden';
    im.decode().then(() => {
      if (L.dead) return;
      im.style.visibility = '';
      if (!still) im.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: PAPER });
    }, () => missing(im));
  }
  function fillList(c, hidden) {
    const items = (c.m && c.m.items) || [];
    itemsSec.hidden = !items.length;
    list.style.setProperty('--cols', String(colsFor(items.length)));
    list.textContent = '';
    itemEls = items.map(it => makeItem(it, hidden));
    for (const x of itemEls) list.appendChild(x.li);
    wash.style.opacity = '0';
  }
  function riseItems(delay) {
    if (still) return;
    itemEls.forEach((x, k) => x.li.animate([{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }], { duration: T.nameIn, delay: delay + k * 20, easing: PAPER, fill: 'backwards' }));
  }
  /* item k arrives: the acquisition "arrive" curve for the drawing, a small rise for the name */
  function arriveFn(img) {
    return (e, raw) => {
      let o, y, s;
      if (raw < .62) { const q = paper(raw / .62); o = clamp(raw / .62 * 1.5); y = mix(9, -2, q); s = mix(.88, 1.025, q); }
      else { const q = paper((raw - .62) / .38); o = 1; y = mix(-2, 0, q); s = mix(1.025, 1, q); }
      img.style.opacity = String(o);
      img.style.transform = raw >= 1 ? '' : `translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
    };
  }
  function drawIn(x, t0, tm) {
    if (x.img) add(t0 + 60, tm.arrive, lin, arriveFn(x.img), () => { x.img.style.opacity = ''; x.img.style.transform = ''; }, x.img);
    const nm = x.name;
    add(t0 + 60, T.nameIn, paper, e => { nm.style.opacity = String(e); nm.style.transform = `translateY(${(4 * (1 - e)).toFixed(2)}px)`; },
      () => { nm.style.opacity = ''; nm.style.transform = ''; }, nm);
  }
  /* prev / next: the old drawing and name leave, the new ones arrive */
  function itemSwap(x, it, t0, tm, lazy) {
    const same = x.it && x.it.thumb === it.thumb && x.it.name === it.name;
    x.li.dataset.slot = it.slot;
    if (same) { x.it = it; return; }
    const olds = [...x.draw.querySelectorAll('img')];
    for (const o of olds) add(t0, T.out, inkE, e => { o.style.opacity = String(1 - e); o.style.transform = `translateY(${(-4 * e).toFixed(2)}px)`; }, () => o.remove(), o);
    const nw = drawingImg(it, true, lazy);
    x.draw.classList.remove('is-missing');
    x.draw.appendChild(nw);
    x.img = nw; x.it = it;
    add(t0 + 60, tm.arrive, lin, arriveFn(nw), () => { nw.style.opacity = ''; nw.style.transform = ''; }, nw);
    const nm = x.name, had = nm.textContent !== '';
    if (had) add(t0, T.out, inkE, e => { nm.style.opacity = String(1 - e); }, () => { nm.textContent = it.name; });
    else { nm.textContent = it.name; nm.style.opacity = '0'; }
    add(t0 + T.out + 20, T.nameIn, paper, e => {
      if (nm.textContent !== it.name) nm.textContent = it.name;
      nm.style.opacity = String(e); nm.style.transform = `translateY(${(4 * (1 - e)).toFixed(2)}px)`;
    }, () => { nm.style.opacity = ''; nm.style.transform = ''; }, nm);
  }
  function settleList() {          // every item at rest, the wash out
    for (const x of itemEls) {
      for (const im of x.draw.querySelectorAll('img')) { if (im !== x.img) im.remove(); }
      if (x.img) { x.img.style.opacity = ''; x.img.style.transform = ''; }
      x.name.style.opacity = ''; x.name.style.transform = '';
      if (x.it && x.name.textContent !== x.it.name) x.name.textContent = x.it.name;
    }
    wash.style.opacity = '0';
    note.style.opacity = '';      // the helper line follows the list (a skip during 'wait' left it hidden)
  }

  /* copy changes: out 120 ink with a small rise, in 220 paper */
  function swapText(el, text, delay) {
    if (el.textContent === text) return;
    add(0, T.out, inkE, e => { el.style.opacity = String(1 - e); el.style.transform = `translateY(${(-4 * e).toFixed(2)}px)`; }, () => { el.textContent = text; }, el);
    add(T.out + 20 + delay, T.nameIn, paper, e => {
      if (el.textContent !== text) el.textContent = text;
      el.style.opacity = String(e); el.style.transform = `translateY(${(7 * (1 - e)).toFixed(2)}px)`;
    }, () => { el.style.opacity = ''; el.style.transform = ''; }, el);
  }
  function setText(room) {
    elTheme.textContent = themeLabel(room);
    elName.textContent = room.name;
    elDesc.textContent = room.desc;
    for (const el of [elTheme, elName, elDesc]) { el.style.opacity = ''; el.style.transform = ''; }
  }

  /* ---------- geometry: the room box laid exactly over the tile's band (scene y 100..530) ---------- */
  function win() {
    const W = art.clientWidth, H = art.clientHeight, k = W / 390;
    const y0 = parseFloat(getComputedStyle(art).getPropertyValue('--y0')) || 0;
    return { W, H, k, y0 };
  }
  function bandFrom(li, dx = 0) {     // dx: the row's travel still to come (a step landing with the fold)
    const g = win(), fr = li._art.getBoundingClientRect(), box = art.getBoundingClientRect(), s = fr.width / g.W;
    const b0 = (100 - g.y0) * g.k, b1 = Math.min(g.H, (530 - g.y0) * g.k);
    return {
      transform: `translate(${(fr.left + dx - box.left).toFixed(2)}px, ${(fr.top - box.top - s * b0).toFixed(2)}px) scale(${s.toFixed(4)})`,
      clipPath: `inset(${b0.toFixed(2)}px 0px ${(g.H - b1).toFixed(2)}px 0px round ${(12 / s).toFixed(2)}px)`
    };
  }

  /* ---------- open ---------- */
  function newCur(room, m) {
    return { room, m, path: '', plain: false, full: false, baseIsCurrent: true, todsAsked: false, todImg: {}, applying: {}, applied: {}, set: null, decided: false, onTod: null };
  }
  function adopt(c, m) {            // the manifest entry: list, sets, frames
    c.m = m;
    c.plain = !m || !m.ok;
    if (!c.plain) { if (!still) c.set = roomSet(c.room.id, 0); loadTods(c); }   // reduced motion never builds: no layers
  }
  function open(li) {
    if (state.open || L.dead || !li || !li._room) return;
    const room = li._room;
    still = calm();
    Object.assign(state, { open: true, st: li._st, slot: li._slot });
    from = li; closing = false; skipping = null;
    stopClock(); dropTracks(); clock = 0;
    const m = entry(room.id);
    const c = cur = newCur(room, m);
    demote(around());
    adopt(c, m);
    c.path = still ? 'still' : c.plain ? 'plain' : seen.has(room.id) ? 'seen' : (c.set && c.set.ready) ? 'build' : 'wait';
    rv.dataset.path = c.path;
    loadFull(room.id, 1).then(ok => { if (c !== cur) return; c.full = ok; applyDay(c); });
    if (c.set) c.set.p.then(() => { if (c === cur && state.open) neighboursLater(c); });

    // the scene starts as the tile's picture
    clearBuild(); resetTodEls();
    cover.style.opacity = ''; cover.removeAttribute('src');
    roomEl.style.transform = '';
    setDay(li._img.currentSrc || thumbURL(room.id));
    dayEl.style.opacity = ''; clearMask(dayEl);
    setText(room);
    live.textContent = '';
    const building = c.path === 'build' || c.path === 'wait';
    fillList(c, building);
    note.style.opacity = building ? '0' : '';     // the helper line follows the list, not an empty grid
    artLabel(c, building ? null : 'day');

    document.documentElement.style.overflow = 'hidden';
    rv.showModal();
    sheet.scrollTop = 0;
    rows.onOpen(true);
    rows.relayout(state.st);
    setMarks('day');
    refreshMarks();
    try { performance.mark('rmv:open'); } catch (_) {}

    if (still) { setPhase('end'); return; }
    setPhase('unfold');
    art.animate([bandFrom(li), { transform: 'none', clipPath: 'inset(0px 0px 0px 0px round 12px)' }], { duration: T.unfold, easing: PAPER });
    scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'linear' });
    sheet.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 80, easing: PAPER, fill: 'backwards', pseudoElement: '::before' });
    textEls.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: 300 + i * 50, easing: PAPER, fill: 'backwards' }));
    closeBtn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 300, easing: 'linear', fill: 'backwards' });

    if (c.path === 'build') startBuild(c, T.build0, true);
    else if (c.path === 'wait') waitPath(c);
    else {           // seen, plain: the finished day room
      riseItems(300 + 3 * 50);
      add(T.unfold, 0, lin, null, () => { if (!quiet && c === cur) reachEnd(c, 'day', false); });
    }
  }

  /* layers were not decoded at the click: the picture stays; build as soon as they are, or show the day room at 1200ms */
  function waitPath(c) {
    const decide = () => {
      if (c !== cur || !state.open || closing) return;
      if (c.decided) return;
      if (c.plain) { c.decided = true; showNow(c, 'plain'); return; }
      if (c.set && c.set.done && c.set.ready) { c.decided = true; clearToCanvas(c); return; }
      if ((c.set && c.set.done) || clock >= T.waitLayers) { c.decided = true; showNow(c, 'show'); }
    };
    if (c.set) c.set.p.then(decide); else Promise.resolve().then(decide);
    add(T.waitLayers, 0, lin, null, () => { if (!quiet) decide(); });
  }
  function clearToCanvas(c) {
    c.path = 'clear'; rv.dataset.path = 'build';
    startBuild(c, Math.max(T.build0, clock + T.picLead), true);    // never before the tile has unfolded
  }
  function showNow(c, path) {
    c.path = path; rv.dataset.path = path;
    if (path === 'plain') c.plain = true;
    for (const x of itemEls) { if (x.img) { x.img.style.opacity = ''; if (!(x.img.complete && x.img.naturalWidth)) { const im = x.img; im.style.opacity = '0'; im.decode().then(() => { if (!L.dead) im.style.opacity = ''; }, () => missing(im)); } } x.name.style.opacity = ''; }
    itemsSec.hidden = !itemEls.length;
    riseItems(0);
    if (note.style.opacity === '0') { note.style.opacity = ''; if (!still) note.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.nameIn, easing: PAPER }); }
    refreshMarks();
    artLabel(c, 'day');
    add(Math.max(clock, T.unfold), 0, lin, null, () => { if (!quiet && c === cur) reachEnd(c, 'day', false); });
  }

  /* ---------- the build: one piece per step, the list item in the same frame ---------- */
  /* the list items' boxes, measured when first needed and again after a resize */
  let rectGen = 0;
  function rectsOf(els) {
    let r = null, g = -1;
    return k => { if (!r || g !== rectGen) { r = els.map(x => rectIn(recipe, x.li)); g = rectGen; } return r[k]; };
  }
  /* the wash walks to item k on the choice spring; where the list wraps it fades out and in again instead of crossing the grid */
  function washStep(R, k, s, dur, ease) {
    if (k === 0) { add(s, T.washFade, lin, e => { washTo(wash, R(0)); wash.style.opacity = String(e); }); return; }
    if (Math.abs(R(k).y - R(k - 1).y) > 2) {
      add(s, T.washFade, lin, e => { wash.style.opacity = String(1 - e); });
      add(s + T.washFade, T.washFade, lin, e => { washTo(wash, R(k)); wash.style.opacity = String(e); });
      return;
    }
    add(s, dur, lin, (e, raw) => washTo(wash, lerpRect(R(k - 1), R(k), ease(raw))), null, wash);
  }
  function startBuild(c, B0, picFade) {
    const m = c.m, set = newSet(m), n = m.items.length;
    const gap = Math.min(T.gap, (T.lastBy - T.build0) / Math.max(1, n - 1));
    // the tile's picture hands back to paper along the same diagonal front, just ahead of the first piece:
    // blank paper travels as a band and never shows as an empty card
    if (picFade) add(B0 - T.picLead, FIRST.sweep, lin, (e, raw) => {
      const f = mix(-.11, 1.11, smooth(paper(raw)));
      const g = `linear-gradient(${T.angle}deg, transparent ${((f - .09) * 100).toFixed(2)}%, #000 ${((f + .09) * 100).toFixed(2)}%)`;
      dayEl.style.webkitMaskImage = g; dayEl.style.maskImage = g;
    }, () => { dayEl.style.opacity = '0'; clearMask(dayEl); });
    add(B0, 0, lin, null, () => { if (c === cur) setPhase('build'); });
    const R = rectsOf(itemEls);
    const bySlot = new Map(m.layers.map(l => [l.slot, l]));
    const viewBox = bySlot.get('view'), floorBox = m.items.some(i => i.slot === 'floor') ? bySlot.get('floor') : null;
    note.style.opacity = '0';
    let tEnd = B0;
    m.items.forEach((it, k) => {
      const s = B0 + k * gap, l = bySlot.get(it.slot);
      if (l) { tEnd = Math.max(tEnd, layerIn(set, l, s, FIRST, m.outdoor, viewBox, floorBox)); bySlot.delete(it.slot); }
      washStep(R, k, s, T.wash, spring);
      drawIn(itemEls[k], s, FIRST);
      tEnd = Math.max(tEnd, s + 60 + FIRST.arrive);
    });
    for (const l of bySlot.values()) set.hosts[l.slot].appendChild(makeLayer(l));   // a layer with no list item: present from the start
    tEnd = Math.min(tEnd, B0 + (n - 1) * gap + 70 + 40 + FIRST.gather);
    add(tEnd, T.washFade, lin, e => { wash.style.opacity = String(1 - e); });
    add(tEnd, T.nameIn, paper, e => { note.style.opacity = String(e); }, () => { note.style.opacity = ''; });
    // set: a later open shows the finished room, even if the visitor leaves during the light pass
    add(tEnd, 0, lin, null, () => { if (c === cur && !quiet) { setPhase('hold'); seen.add(c.room.id); } });
    // the app's Purchase -> Apply swell: "this room is set"
    add(tEnd + 40, T.apply, lin, (e, raw) => {
      const s = raw < .4 ? 1 + .018 * swellE(raw / .4) : 1 + .018 * (1 - returnE((raw - .4) / .6));
      roomEl.style.transform = raw >= 1 ? '' : `scale(${s.toFixed(4)})`;
    }, () => { roomEl.style.transform = ''; }, roomEl);
    c.tEnd = tEnd;
    add(tEnd + 40, 0, lin, null, () => { if (!quiet && c === cur) daySwap(c, () => { c.swapped = true; tryLight(c); }); });
    add(tEnd + T.lightAfter, 0, lin, null, () => { if (!quiet) tryLight(c); });
    add(tEnd + T.lightLate, 0, lin, null, () => { if (!quiet) tryLight(c, true); });
    c.onTod = () => tryLight(c);
  }
  /* layers -> full picture under them, then the layers go: invisible (identical pixels) */
  function daySwap(c, done) {
    const go = src => {
      if (c !== cur || closing || !state.open) return;
      setDay(src);
      dayEl.style.opacity = ''; clearMask(dayEl);
      dayEl.decode().catch(() => {}).then(() => L.frame(() => {
        if (c !== cur || closing || !state.open) return;
        clearBuild();
        done && done();
      }));
    };
    if (c.full) go(fullURL(c.room.id));
    else loadFull(c.room.id, 0).then(ok => { if (c !== cur) return; c.full = ok; go(ok ? fullURL(c.room.id) : thumbURL(c.room.id)); });
  }
  /* one soft diagonal light: dusk leading, night 800ms behind, then the lamp */
  function tryLight(c, late) {
    if (c !== cur || c.lit || phase !== 'hold' || !state.open || closing) return;
    const ready = c.swapped && c.applied.dusk && (c.applied.night || c.applied.lit);
    if (!ready) { if (late) { c.lit = true; reachEnd(c, 'day', true); } return; }
    if (clock < c.tEnd + T.lightAfter) return;
    c.lit = true;
    const tL = clock, dusk = todEl.dusk, night = c.applied.night ? todEl.night : todEl.lit, lamp = c.applied.night && c.applied.lit ? todEl.lit : null;
    setPhase('light');
    const front = (el, t0, dur) => {
      el.style.opacity = '1'; setMask(el, T.angle, -T.edge, T.edge);
      add(t0, dur, lin, (e, raw) => setMask(el, T.angle, -T.edge + 1.6 * smooth(raw), T.edge), () => clearMask(el));
    };
    front(dusk, tL, T.dusk);
    front(night, tL + T.nightLag, T.night);
    add(tL + T.dusk / 2, 0, lin, null, () => { if (!quiet && c === cur) autoMark('dusk'); });
    add(tL + T.nightLag + T.night / 2, 0, lin, null, () => { if (!quiet && c === cur) autoMark('night'); });
    let tEnd = tL + T.nightLag + T.night;
    if (lamp) {
      lamp.style.opacity = '0';
      add(tEnd + T.lampWait, T.lamp, paper, e => { lamp.style.opacity = String(e); }, () => { lamp.style.opacity = '1'; });
      tEnd += T.lampWait + T.lamp;
    }
    add(tEnd, 0, lin, null, () => { if (!quiet && c === cur) { dusk.style.opacity = ''; reachEnd(c, 'night', true); } });
  }
  function autoMark(tod) {
    setMarks(tod, { play: true });
  }
  function reachEnd(c, tod, markSeen) {
    if (c !== cur) return;
    setPhase('end');
    if (markSeen) seen.add(c.room.id);
    if (rv.dataset.tod !== tod) setMarks(tod);
    artLabel(c, tod);
    refreshMarks();
  }

  /* ---------- skip: a tap on the room, or a mark, jumps to the end ---------- */
  const SKIPPABLE = new Set(['unfold', 'build', 'hold', 'light', 'swap']);
  function skip(target, byMark) {
    if (!SKIPPABLE.has(phase) || skipping || closing) return;
    const c = cur;
    if (c.plain || !todReady(c, target)) target = 'day';
    c.decided = true;
    const frozen = tracks;
    tracks = []; clock = 0;
    skipping = { c, target, byMark, frozen };
    cover.src = srcFor(c, target);
    cover.style.opacity = '0';
    add(0, T.cover, inkE, e => { cover.style.opacity = String(e); });
    for (const x of itemEls) {
      const els = [x.name, ...x.draw.querySelectorAll('img')];
      for (const el of els) {
        const o0 = el.style.opacity === '' ? 1 : parseFloat(el.style.opacity) || 0;
        const old = x.img !== el && el.tagName === 'IMG';
        add(0, T.cover, lin, e => { el.style.opacity = String(old ? o0 * (1 - e) : mix(o0, 1, e)); });
      }
    }
    const w0 = parseFloat(wash.style.opacity) || 0;
    add(0, T.cover, lin, e => { wash.style.opacity = String(w0 * (1 - e)); });
    add(T.cover, 0, lin, null, () => queueMicrotask(endSkip));
  }
  function endSkip() {
    const sk = skipping;
    if (!sk) return;
    skipping = null;
    const { c, target, byMark, frozen } = sk;
    quiet = true;
    try { for (const k of frozen) { if (k.done) continue; k.done = true; if (k.fn) k.fn(k.ease(1), 1); if (k.el) k.el.style.willChange = ''; if (k.end) k.end(); } }
    finally { quiet = false; }
    if (c !== cur || !state.open) return;
    finishTracks();
    clearBuild();
    c.baseIsCurrent = true;
    setDay(srcFor(c, 'day'));
    roomEl.style.transform = '';
    setBase(target);
    applyTods(c);
    cover.style.opacity = ''; cover.removeAttribute('src');
    settleList();
    c.lit = true;
    setMarks(target);
    reachEnd(c, target, !c.plain);
    if (byMark) live.textContent = roomLabel(c.room.name, target);
  }

  /* ---------- 낮 / 노을 / 밤 ---------- */
  function chooseTod(tod) {
    const c = cur;
    if (!c || closing || c.plain) return;
    if (!todReady(c, tod)) return;
    if (skipping) return;
    if (SKIPPABLE.has(phase)) { skip(tod, true); return; }
    if (phase !== 'end') return;
    if (rv.dataset.tod === tod) return;       // already there, or on its way: the sweep carries on
    newSequence();
    if (build.firstChild) { clearBuild(); setDay(srcFor(c, 'day')); }   // the day swap was still waiting for its picture
    setMarks(tod, { play: true });
    artLabel(c, tod);
    live.textContent = roomLabel(c.room.name, tod);
    if (still) { setBase(tod); return; }
    const top = tod === 'day' ? dayEl : tod === 'dusk' ? todEl.dusk : (c.applied.night ? todEl.night : todEl.lit);
    const lamp = tod === 'night' && c.applied.night && c.applied.lit ? todEl.lit : null;
    top.style.zIndex = '5'; top.style.opacity = '1';
    setMask(top, T.angle, -T.edge, T.edge);
    if (lamp) { lamp.style.zIndex = '6'; lamp.style.opacity = '0'; setMask(lamp, T.angle, -T.edge, T.edge); }
    add(0, T.user, lin, (e, raw) => {
      const f = -T.edge + 1.6 * smooth(raw);
      setMask(top, T.angle, f, T.edge);
      if (lamp) setMask(lamp, T.angle, f, T.edge);
    }, () => setBase(tod));
    if (lamp) add(T.user - 160, T.lamp, paper, e => { lamp.style.opacity = String(e); }, () => setBase(tod));
  }

  /* ---------- 이전 방 / 다음 방: the next room is painted over the current one ---------- */
  function go(d) {
    if (!state.open || closing) return;
    if (skipping) endSkip();
    newSequence();
    const st = state.st;
    state.slot += d;
    rows.step(st, d);
    rows.relayout(st);
    const room = rows.roomAt(st, state.slot);
    const m = entry(room.id);
    const c = cur = newCur(room, m);
    demote(around());
    c.baseIsCurrent = false;
    // rooms passed on the way (rapid presses) ask for nothing: a room's requests start once it has been shown T.settle ms.
    // A room already decoded is painted at once.
    c.plain = !m || !m.ok;
    if (!c.plain && !still && sets.has(room.id)) c.set = roomSet(room.id, 0);
    c.load = () => {
      if (c !== cur || !state.open || closing || c.loading) return;
      c.loading = true;
      adopt(c, m);
      loadFull(room.id, 0).then(ok => { if (c !== cur) return; c.full = ok; applyDay(c); });
      want(thumbURL(room.id), 0, room.id).then(im => { c.thumbOK = !!im; });
      if (c.set) c.set.p.then(() => { if (c === cur && state.open) neighboursLater(c); });
      for (const x of itemEls) wakeDrawing(x.img);
      if (c.afterLoad) c.afterLoad();
    };
    if (still) c.load(); else L.later(c.load, T.settle);
    live.textContent = roomLabel(room.name, c.plain ? null : 'day');
    artLabel(c, 'day');
    setMarks('day');
    refreshMarks();

    if (still) {
      rv.dataset.path = c.path = 'still';
      setText(room);
      fillList(c, false);
      clearBuild(); resetTodEls();
      setDay(c.full ? fullURL(room.id) : thumbURL(room.id));
      c.baseIsCurrent = true; applyTods(c); applyDay(c);
      setPhase('end');
      return;
    }
    swapText(elTheme, themeLabel(room), 0);
    swapText(elName, room.name, 40);
    swapText(elDesc, room.desc, 80);
    setPhase('swap');
    c.path = !c.plain && c.set && c.set.ready ? 'swap' : 'fade';
    rv.dataset.path = c.path;
    if (c.path === 'swap') redecorate(c);
    else crossfade(c);
  }
  function redecorate(c) {
    const m = c.m, set = newSet(m), n = m.items.length;
    const gap = Math.min(T.fastGap, (T.fastLastBy - T.fast0) / Math.max(1, n - 1));
    // list length changes
    list.style.setProperty('--cols', String(colsFor(n)));
    itemsSec.hidden = false;
    while (itemEls.length < n) { const x = makeItem(null); itemEls.push(x); list.appendChild(x.li); }
    const extra = itemEls.slice(n);
    const R = rectsOf(itemEls.slice(0, n));
    const bySlot = new Map(m.layers.map(l => [l.slot, l]));
    const viewBox = bySlot.get('view'), floorBox = m.items.some(i => i.slot === 'floor') ? bySlot.get('floor') : null;
    let tEnd = 0;
    m.items.forEach((it, k) => {
      const s = T.fast0 + k * gap, l = bySlot.get(it.slot);
      if (l) { tEnd = Math.max(tEnd, layerIn(set, l, s, FAST, m.outdoor, viewBox, floorBox)); bySlot.delete(it.slot); }
      washStep(R, k, s, T.fastWash, paper);
      itemSwap(itemEls[k], it, s, FAST);
      tEnd = Math.max(tEnd, s + 60 + FAST.arrive);
    });
    for (const l of bySlot.values()) set.hosts[l.slot].appendChild(makeLayer(l));
    const sLast = T.fast0 + (n - 1) * gap;
    for (const x of extra) add(sLast, T.out, inkE, e => { x.li.style.opacity = String(1 - e); }, null);
    add(tEnd, T.washFade, lin, e => { wash.style.opacity = String(1 - e); });
    add(tEnd, 0, lin, null, () => {
      for (const x of extra) x.li.remove();
      itemEls = itemEls.slice(0, n);
      if (quiet || c !== cur) return;
      endSwap(c, true);
    });
  }
  /* the swap is painted: the new room's full picture goes under the layers, the old frames take the new room's */
  function endSwap(c, markSeen) {
    // a skip may have ended the swap while the picture was on its way: then the room is already set
    const finish = src => {
      if (c !== cur || closing || !state.open || phase !== 'swap') return;
      resetTodEls();
      setDay(src);
      dayEl.style.opacity = '';
      dayEl.decode().catch(() => {}).then(() => L.frame(() => {
        if (c !== cur || closing || !state.open || phase !== 'swap') return;
        clearBuild();
        c.baseIsCurrent = true;
        applyTods(c); applyDay(c);
        reachEnd(c, 'day', markSeen);
      }));
    };
    if (c.full) finish(fullURL(c.room.id));
    else if (c.thumbOK) finish(thumbURL(c.room.id));
    else Promise.race([loadFull(c.room.id, 0).then(ok => ok ? fullURL(c.room.id) : thumbURL(c.room.id)), want(thumbURL(c.room.id), 0).then(() => thumbURL(c.room.id))]).then(finish);
  }
  /* layers not ready: A's dissolve to the next room's picture; the list swaps at once (its drawings load once the
     room has settled). The picture is the wall tile's own when it is on screen; otherwise, if it has not come within
     T.noPic, the other room's art leaves first, so this room's name never sits over another room's picture. */
  function crossfade(c) {
    const m = c.m, items = (m && m.items) || [], id = c.room.id;
    const n = items.length;
    list.style.setProperty('--cols', String(colsFor(n)));
    while (itemEls.length < n) { const x = makeItem(null); itemEls.push(x); list.appendChild(x.li); }
    const extra = itemEls.slice(n);
    items.forEach((it, k) => itemSwap(itemEls[k], it, k * 30, FIRST, true));
    for (const x of extra) add(0, T.out, inkE, e => { x.li.style.opacity = String(1 - e); }, () => x.li.remove());
    itemEls = itemEls.slice(0, n);
    if (!n) add(T.out, 0, lin, null, () => { itemsSec.hidden = true; });
    wash.style.opacity = '0';
    const ok = () => c === cur && !closing && state.open && phase === 'swap';
    let painted = false;
    const paint = src => {
      if (painted || !ok()) return;
      painted = true;
      cover.src = src;
      cover.style.opacity = '0';
      cover.decode().catch(() => {}).then(() => {
        if (!ok()) return;
        add(clock, T.swap, inkE, e => { cover.style.opacity = String(e); }, () => {
          if (c !== cur) return;
          clearBuild(); resetTodEls();
          setDay(c.full ? fullURL(id) : src);
          dayEl.style.opacity = ''; clearMask(dayEl);
          base.style.opacity = ''; build.style.opacity = '';
          roomEl.style.transform = '';
          cover.style.opacity = ''; cover.removeAttribute('src');
          c.baseIsCurrent = true;
          applyTods(c); applyDay(c);
          if (!quiet) reachEnd(c, 'day', false);
        });
      });
    };
    const li = state.st && rows.tileFor(state.st, state.slot), tim = li && li._room && li._room.id === id ? li._img : null;
    if (tim && tim.complete && tim.naturalWidth) { paint(tim.currentSrc || thumbURL(id)); return; }
    add(T.noPic, 0, lin, null, () => {
      if (quiet || painted || !ok()) return;
      add(clock, T.clear, inkE, e => { const o = String(1 - e); base.style.opacity = o; build.style.opacity = o; }, () => {
        if (painted) return;
        clearBuild(); resetTodEls();
        dayEl.style.opacity = '0';
        base.style.opacity = ''; build.style.opacity = '';
      });
    });
    c.afterLoad = () => want(thumbURL(id), 0, id).then(async im => {
      if (!ok()) return;
      let src = im ? thumbURL(id) : null;
      if (!src && await loadFull(id, 0)) { c.full = true; src = fullURL(id); }
      if (!ok()) return;
      if (src) { paint(src); return; }
      // no picture at all: blank paper under this room's name, never the previous room
      painted = true;
      clearBuild(); resetTodEls();
      setDay(thumbURL(id)); dayEl.style.opacity = '0';
      base.style.opacity = ''; build.style.opacity = '';
      c.baseIsCurrent = true; applyTods(c);
      reachEnd(c, 'day', false);
    });
  }

  /* ---------- close: the room folds back into the tile of the room now shown ---------- */
  function close() {
    if (!state.open || closing) return;
    closing = true;
    stopClock();
    const c = cur;
    if (still) return finishClose();
    const dx = rows.settle(state.st, T.fold);      // a row still stepping (이전/다음) lands with the fold
    const li = rows.tileFor(state.st, state.slot);
    const visible = !!li && rows.onScreen(li, dx);
    // anything but the finished day room folds back as the daytime tile
    if (phase !== 'end' || rv.dataset.tod !== 'day' || build.firstChild || skipping) {
      cover.src = c ? srcFor(c, 'day') : dayEl.src;
      cover.style.opacity = '0';
      cover.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.closeCover, easing: INK, fill: 'forwards' });
    }
    textEls.forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear', fill: 'forwards' }));
    closeBtn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear', fill: 'forwards' });
    sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: 60, easing: 'linear', fill: 'forwards', pseudoElement: '::before' });
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: visible ? 140 : 0, easing: 'linear', fill: 'forwards' });
    const a = visible
      ? art.animate([{ transform: 'none', clipPath: 'inset(0px 0px 0px 0px round 12px)' }, bandFrom(li, dx)], { duration: T.fold, easing: INK, fill: 'forwards' })
      : art.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'linear', fill: 'forwards' });
    a.finished.then(() => { if (!L.dead) finishClose(); }, () => {});
  }
  function finishClose() {
    if (!state.open) return;
    stopClock();
    if (skipping) for (const k of skipping.frozen) if (k.el) k.el.style.willChange = '';
    dropTracks(); skipping = null;
    rv.close();
    document.documentElement.style.overflow = '';
    clearBuild();
    cover.style.opacity = ''; cover.removeAttribute('src');
    resetTodEls();
    dayEl.style.opacity = ''; clearMask(dayEl); roomEl.style.transform = '';
    base.style.opacity = ''; build.style.opacity = ''; note.style.opacity = '';
    wash.style.opacity = '0'; wash.style.willChange = '';
    rv.getAnimations({ subtree: true }).forEach(x => x.cancel());
    for (const x of itemEls) for (const im of x.draw.querySelectorAll('img')) { im.style.opacity = ''; im.style.transform = ''; }
    for (const el of [elTheme, elName, elDesc]) { el.style.opacity = ''; el.style.transform = ''; el.style.willChange = ''; }
    setPhase('idle');
    const st = state.st, slot = state.slot, shown = cur && cur.room;
    state.open = false; closing = false;
    cur = null;
    dropQueue();
    rows.relayout(st);
    // focus goes back to the tile of the room shown, if it is on the paper; the tile that opened the view only if it
    // still shows that room (tiles are recycled as the row steps or the window resizes); else the wall's last resort
    const ok = x => !!x && x.isConnected && x._room === shown && rows.focusable(x);
    const li = rows.tileFor(st, slot), back = ok(li) ? li : ok(from) ? from : null;
    if (back) { rows.bringIntoView(back); back._btn.focus({ preventScroll: true }); }
    else rows.fallbackFocus(st).focus();
    rows.onOpen(false);
  }

  /* ---------- input ---------- */
  const fwd = rtl ? -1 : 1;      // 다음 방 lies to the reading direction's end: right in LTR, left in RTL
  // a second Esc (or Android back) during the fold cannot be prevented: the dialog closes natively, so finish at once
  L.on(rv, 'cancel', e => { if (closing) { finishClose(); return; } e.preventDefault(); close(); });
  L.on(rv, 'close', () => { if (state.open) finishClose(); });
  L.on(rv, 'click', e => {
    if (e.target.closest('[data-close]')) { close(); return; }
    const b = e.target.closest('[data-go]'); if (b) { go(+b.dataset.go); return; }
    const t = e.target.closest('.rmv__marks button');
    if (t && t.getAttribute('aria-disabled') !== 'true') chooseTod(t.dataset.tod);
  });
  L.on(rv, 'keydown', e => {
    const k = e.key;
    if (marks.contains(e.target)) {
      const d = { ArrowRight: fwd, ArrowDown: 1, ArrowLeft: -fwd, ArrowUp: -1 }[k];
      if (!d) return;
      e.preventDefault();
      const on = markBtns.filter(b => b.getAttribute('aria-disabled') !== 'true');
      if (!on.length) return;
      const i = Math.max(0, on.indexOf(markBtns.find(b => b.getAttribute('aria-checked') === 'true')));
      const n = on[(i + d + on.length) % on.length];
      n.focus();
      chooseTod(n.dataset.tod);
      return;
    }
    if (k === 'ArrowRight') { e.preventDefault(); go(fwd); }
    if (k === 'ArrowLeft') { e.preventDefault(); go(-fwd); }
  });
  /* the room: a tap jumps to the end, a sideways swipe goes to the next or previous room */
  let ptr = null;
  L.on(art, 'pointerdown', e => { if (e.button > 0) return; ptr = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }; });
  L.on(art, 'pointercancel', () => { ptr = null; });
  L.on(art, 'pointerup', e => {
    if (!ptr || ptr.id !== e.pointerId) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, dt = e.timeStamp - ptr.t;
    ptr = null;
    if (Math.abs(dx) > 44 && Math.abs(dy) < Math.abs(dx) * .7) { go(dx < 0 ? fwd : -fwd); return; }
    if (Math.hypot(dx, dy) < 10 && dt < 500) skip('night', false);
  });
  L.on(window, 'resize', () => { rectGen++; });

  return { open, prefetch, state };
}
