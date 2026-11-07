/* 추천하는 방 둘러보기: 흐르는 방의 벽 (the drifting room wall), and the room view it opens.
   Acquisition "arrive" entrance, rows glide in from two tiles away, a lively breath, 96 px desktop parallax.
   A tile opens the room view (view.js): the room builds itself with "이 조합의 물건", then passes from day to night;
   its assets load only when the tile is hovered (300 ms), focused, pressed (touch: 150 ms) or opened.
   Data: the 101 recommended rooms of the app in the manifest's order (sorted by wall hue; rain-leaf-room excluded),
   with names and themes from the per-locale room text (index.js roomData). Wall colour = mean of the visible wall in
   each thumbnail; the tile's placeholder until its picture has decoded.
   Every listener, observer, timer and frame goes through life(), so destroy() leaves nothing running. */
import { life } from './life.js';
import { createRoomView } from './view.js';

const NROWS = 3;
const DIR = [-1, 1, -1];                 // travel direction per row (-1: leftward)
const mod = (a, n) => ((a % n) + n) % n;

/* timing (ms) */
const T = {
  breath: 2800,     // one cycle: a cascading step through the three rows, then a short rest (owner wanted it livelier)
  stagger: 200,     // row-to-row delay inside a breath
  step: 1500,       // one tile, ease-ink
  lag: 340,         // inside a row the leading room sets off first; the far end follows 340ms later
  firstRest: 1400,  // after the entrance, before the first breath
  enterGlide: 2000, // rows glide 2 tiles into place, ease-paper
  enterRise: 760,   // each tile arrives on the acquisition curve (9px, .88 -> -2px, 1.025 -> rest)
  snap: 380,        // after a drag, settle onto the grid
  swap: 650,        // prev/next in the room view: the row takes the same step
  dwell: 300,       // a pointer (or keyboard focus) resting on a tile this long loads that room's assets
  press: 150,       // a touch waits this long (unless it moves or is cancelled) before it loads the room
  resume: 600       // after the pointer leaves a tile
};

function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
    if (t < 0 || t > 1) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 30; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return Y(t);
  };
}
const easeInk = bezier(.4, 0, .2, 1), easePaper = bezier(.22, .61, .36, 1);
const PAPER = 'cubic-bezier(.22,.61,.36,1)';
const ARRIVE = [{ opacity: 0, transform: 'translateY(9px) scale(.88)' }, { opacity: 1, transform: 'translateY(-2px) scale(1.025)', offset: .62 }, { opacity: 1, transform: 'none' }];

/* mount({ host, tools, reduce, motion, text, data, rtl }) -> { destroy(), life }
   reduce: MediaQueryList (read once); motion: { paused, subscribe(fn) } (the page-wide pause, live);
   text: page copy (site/text.mjs); data: index.js roomData() */
export function mount(opts) {
  const L = life();
  try { return wall(L, opts); } catch (e) { L.end(); opts.host.querySelector('dialog[open]')?.close(); throw e; }
}

function wall(L, { host, tools, reduce, motion, text, data, rtl = false }) {
  const still = reduce.matches;
  const mode = still ? 'static' : 'motion';
  const themeLabel = room => room.theme === 'common' ? room.themeName : text('{theme} 테마', { theme: room.themeName });
  const tileLabel = room => room.theme === 'common'
    ? text('{name}, {collection}의 방 크게 보기', { name: room.name, collection: room.themeName })
    : text('{name}, {theme} 테마의 방 크게 보기', { name: room.name, theme: room.themeName });

  /* rows: rooms sorted by wall colour, dealt into three rows so each row walks through the whole palette,
     starting in a different colour zone */
  const ALL = data.rooms;
  const LISTS = Array.from({ length: NROWS }, () => []);
  ALL.forEach((room, i) => LISTS[i % NROWS].push(room));
  const START = LISTS.map((list, r) => Math.round(r * list.length / NROWS));
  const rowLabels = [text('추천하는 방, 첫째 줄'), text('추천하는 방, 둘째 줄'), text('추천하는 방, 셋째 줄')];

  const flow = document.createElement('div');
  flow.className = 'flow is-waiting'; flow.id = 'rmv-flow';
  flow.setAttribute('role', 'region'); flow.setAttribute('aria-label', text('추천하는 방'));
  rowLabels.forEach((label, r) => {
    const row = document.createElement('div'), track = document.createElement('ul');
    row.className = 'flow__row'; row.dataset.row = String(r);
    track.className = 'flow__track'; track.setAttribute('aria-label', label);
    row.appendChild(track); flow.appendChild(row);
  });
  host.appendChild(flow);
  const hint = document.createElement('p');
  hint.className = 'note'; hint.textContent = text('방을 누르면 크게 볼 수 있어요');
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'flow-toggle';
  toggle.setAttribute('aria-pressed', 'false'); toggle.setAttribute('aria-controls', 'rmv-flow');
  toggle.textContent = text('움직임 멈추기');
  tools.append(hint, toggle);
  const rowEls = [...flow.querySelectorAll('.flow__row')];

  const G = { vw: 0, left: 0, tile: 0, gap: 0, pitch: 1, buffer: 1, amp: 0 };
  const S = LISTS.map((list, r) => ({
    r, list, row: rowEls[r], track: rowEls[r].querySelector('.flow__track'),
    base: r === 1 ? .5 : 0,  // the middle row sits half a tile over: a woven wall
    u: 0, par: 0, tween: null, drag: null, vel: 0, inertia: false,
    pool: new Map(), free: []
  }));
  const roomAt = (st, s) => st.list[mod(s + START[st.r], st.list.length)];

  /* the wall's own width (no scrollbar), the same width home.css and rooms.css query (container .rooms-host) */
  function measure() {
    const vw = flow.clientWidth || innerWidth;
    const gutter = vw <= 900 ? 24 : 40;
    const left = Math.max(gutter, (vw - 1200) / 2 + gutter);
    const gap = vw <= 900 ? 12 : 20;
    const n = vw >= 1100 ? 6 : vw >= 901 ? 5 : vw >= 600 ? 4 : 2.5;
    const tile = Math.floor((vw - 2 * left - gap * (n - 1)) / n);
    Object.assign(G, { vw, left, gap, tile, pitch: tile + gap, amp: vw <= 900 ? 28 : 96 });
    flow.style.setProperty('--tile', tile + 'px');
    flow.style.setProperty('--gap', gap + 'px');
  }

  /* ---------- image loading: at most six in flight, shown only once decoded ---------- */
  const loadQ = []; let loading = 0; const MAXLOAD = 6;
  let pumpQueued = false;
  function queueLoad(img, src) {
    img._want = src; img._queued = true; loadQ.push(img);
    if (!pumpQueued) { pumpQueued = true; queueMicrotask(() => { pumpQueued = false; if (!L.dead) pump(); }); } // tiles are attached first
  }
  function pump() {
    while (loading < MAXLOAD && loadQ.length) {
      const img = loadQ.shift(), src = img._want;
      if (!src || !img.isConnected) { img._queued = false; continue; }
      loading++;
      const pre = new Image(); pre.decoding = 'async'; pre.src = src;
      pre.decode().catch(() => {}).finally(() => {
        if (L.dead) return;
        loading--;
        // a failed picture leaves the wall colour showing, never a broken image
        if (img._want === src) { if (pre.naturalWidth) { img.src = src; img.classList.add('is-in'); } img._queued = false; }
        pump();
      });
    }
  }

  /* ---------- tiles ---------- */
  function makeTile() {
    const li = document.createElement('li');
    li.className = 'tile';
    li.innerHTML = '<button type="button" class="tile__btn"><span class="tile__in"><span class="tile__art"><img alt="" width="312" height="675" decoding="async" draggable="false"></span><span class="tile__name"></span></span></button>';
    li._btn = li.firstChild; li._art = li.querySelector('.tile__art'); li._img = li._art.firstChild; li._name = li.querySelector('.tile__name');
    return li;
  }
  function fill(li, room, lazy) {
    if (li._room === room && (li._img.classList.contains('is-in') || li._img._queued)) return;
    li._room = room;
    li._btn.setAttribute('aria-label', tileLabel(room));
    li._art.style.backgroundColor = room.wall;
    li._name.textContent = room.name;
    const img = li._img;
    img.classList.remove('is-in'); img.removeAttribute('src');
    if (lazy) { img.loading = 'lazy'; img.src = room.thumb; img.classList.add('is-in'); }
    else queueLoad(img, room.thumb);
  }

  function layoutRow(st, now) {
    const { pitch, left, vw, buffer } = G;
    const shift = st.base + st.u + st.par / pitch;
    const sMin = Math.ceil((-pitch * (1 + buffer) - left) / pitch - shift);
    const sMax = Math.floor((vw + pitch * buffer - left) / pitch - shift);
    for (const [s, li] of st.pool) if (s < sMin || s > sMax) { st.pool.delete(s); li.remove(); st.free.push(li); }
    let first = Infinity; for (const s of st.pool.keys()) if (s < first) first = s;
    const anchor = st.pool.get(first) || null;
    for (let s = sMin; s <= sMax; s++) {
      if (st.pool.has(s)) continue;
      const li = st.free.pop() || makeTile();
      li._slot = s; li._st = st; li._x = NaN;
      fill(li, roomAt(st, s));
      st.pool.set(s, li);
      if (s < first && anchor) st.track.insertBefore(li, anchor); else st.track.appendChild(li);
    }
    /* a step travels along the row: the leading rooms set off first, the rest follow (tw.lag ms spread) */
    const tw = st.tween, lag = tw && tw.lag ? tw : null;
    const trackU = lag ? lag.from : st.u;
    const el = lag ? (now || performance.now()) - lag.t0 : 0, d = lag ? lag.to - lag.from : 0;
    const vs = view.state;
    for (const [s, li] of st.pool) {
      let x = left + (s + st.base) * pitch;
      const sx = x + trackU * pitch + st.par;
      if (lag) {
        const k = Math.min(1, Math.max(0, sx / vw)), lead = d < 0 ? k : 1 - k;
        x += d * pitch * lag.ease(Math.min(1, Math.max(0, (el - lead * lag.lag) / lag.dur)));
      }
      if (x !== li._x) { li._x = x; li.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; }
      /* only rooms wholly on the paper take Tab (and the focused one keeps it); Tab never moves a row, so it always
         leaves the wall after the last of them. Arrow keys walk further along the row (reveal) */
      const tab = (sx >= left - 1 && sx + G.tile <= vw - left + 1) || li._btn === document.activeElement ? 0 : -1;
      if (tab !== li._tab) { li._tab = tab; li._btn.tabIndex = tab; }
      li._art.style.visibility = (vs.open && vs.st === st && vs.slot === s) ? 'hidden' : '';
    }
    st.track.style.transform = `translate3d(${(trackU * pitch + st.par).toFixed(2)}px,0,0)`;
  }

  /* ---------- frame loop: runs only while something is moving ---------- */
  let raf = 0, lastNow = 0, parTarget = 0;
  function kick() { if (!raf && mode === 'motion') raf = L.frame(frame); }
  function frame(now) {
    raf = 0;
    const dt = Math.min(48, lastNow ? now - lastNow : 16); lastNow = now;
    let busy = false;
    for (const st of S) {
      if (st.tween) {
        const tw = st.tween, el = now - tw.t0, lag = tw.lag || 0;
        st.u = tw.from + (tw.to - tw.from) * tw.ease(Math.min(1, Math.max(0, (el - lag / 2) / tw.dur)));
        if (el >= tw.dur + lag) { st.u = tw.to; st.tween = null; tw.done && tw.done(); } else busy = true;
      } else if (st.inertia) {
        st.u += st.vel * dt / G.pitch;
        st.vel *= Math.pow(.9, dt / 16);
        if (Math.abs(st.vel) < .05) { st.inertia = false; snap(st); }
        busy = true;
      }
      const par = parTarget * DIR[st.r];
      if (Math.abs(par - st.par) > .1) { st.par += (par - st.par) * Math.min(1, dt / 90); busy = true; } else st.par = par;
      layoutRow(st, now);
    }
    if (busy) kick(); else lastNow = 0;
  }
  function tweenRow(st, to, dur, ease, done, lag = 0) { st.tween = { from: st.u, to, t0: performance.now(), dur, ease, done, lag }; kick(); }
  function snap(st) { tweenRow(st, Math.round(st.u), T.snap, easePaper, () => { dragging = Math.max(0, dragging - 1); sync(); }); }

  /* ---------- breathing: one tile per row, a cascading wave, then rest ---------- */
  let inView = false, entered = false, userPaused = false, hovering = false, focusIn = false, dragging = 0;
  let timer = 0, nextAt = 0, remaining = T.firstRest;
  const canPlay = () => mode === 'motion' && entered && inView && !document.hidden && !userPaused && !motion.paused && !hovering && !focusIn && !dragging && !view.state.open;
  function sync() {
    const ok = canPlay();
    if (ok && !timer) { nextAt = performance.now() + remaining; timer = L.later(breathe, remaining); }
    else if (!ok && timer) { L.clear(timer); timer = 0; remaining = Math.max(900, nextAt - performance.now()); }
  }
  function breathe() {
    timer = 0; remaining = T.breath;
    S.forEach((st, i) => L.later(() => {
      if (!canPlay() || st.tween || st.drag || st.inertia) return;
      tweenRow(st, Math.round(st.u) + DIR[st.r], T.step, easeInk, null, T.lag);
    }, i * T.stagger));
    sync();
  }

  /* ---------- entrance: rows glide in, rooms arrive on the acquisition curve ---------- */
  function enter() {
    if (entered || mode !== 'motion') return;
    entered = true;
    flow.classList.remove('is-waiting');
    if (motion.paused) { remaining = T.firstRest; sync(); return; }   // the page is paused: the wall is simply there
    for (const st of S) { st.u = -DIR[st.r] * 2; layoutRow(st); }
    flow.classList.add('is-entering');
    let last = 0;
    for (const st of S) {
      for (const li of st.pool.values()) {
        const x = li.getBoundingClientRect().left;
        const delay = Math.round(Math.min(1, Math.max(0, x / G.vw)) * 520 + st.r * 110);
        last = Math.max(last, delay);
        li.querySelector('.tile__in').animate(ARRIVE, { duration: T.enterRise, delay, easing: PAPER, fill: 'backwards' });
      }
      tweenRow(st, 0, T.enterGlide + st.r * 120, easePaper);
    }
    L.later(() => flow.classList.remove('is-entering'), last + T.enterRise + 40);
    remaining = T.firstRest;
    sync();
  }

  /* ---------- input ---------- */
  let suppressClick = false;
  function bindRow(st) {
    const row = st.row;
    L.on(row, 'pointerdown', e => {
      if (e.button > 0 || view.state.open) return;
      st.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, u0: st.u, moved: false, lx: e.clientX, lt: e.timeStamp, v: 0 };
    });
    L.on(row, 'pointermove', e => {
      const d = st.drag; if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.moved) {
        if (Math.abs(dx) < 7) { if (Math.abs(dy) > 10) st.drag = null; return; }
        if (Math.abs(dy) > Math.abs(dx)) { st.drag = null; return; }
        d.moved = true; d.u0 = st.u - dx / G.pitch;
        try { row.setPointerCapture(e.pointerId); } catch (_) {}
        row.classList.add('is-dragging'); flow.classList.add('is-dragging');
        st.tween = null; st.inertia = false; dragging++; sync();
      }
      const dt = Math.max(1, e.timeStamp - d.lt);
      d.v = .7 * ((e.clientX - d.lx) / dt) + .3 * d.v; d.lx = e.clientX; d.lt = e.timeStamp;
      st.u = d.u0 + dx / G.pitch; kick();
    });
    const end = e => {
      const d = st.drag; if (!d || d.id !== e.pointerId) return;
      st.drag = null;
      if (!d.moved) return;
      row.classList.remove('is-dragging'); flow.classList.remove('is-dragging');
      if (e.type === 'pointerup') { suppressClick = true; L.later(() => { suppressClick = false; }, 0); }
      st.vel = Math.max(-2.4, Math.min(2.4, d.v)); st.inertia = Math.abs(st.vel) > .05;
      if (!st.inertia) snap(st);
      remaining = Math.max(remaining, T.firstRest);
      kick();
    };
    L.on(row, 'pointerup', end);
    L.on(row, 'pointercancel', end);
  }

  /* an arrow-key move to a tile near the faded edge brings it fully onto the paper (Tab never moves a row) */
  function reveal(li) {
    if (mode !== 'motion') return;
    const st = li._st, r = li._art.getBoundingClientRect();
    const lo = G.left, hi = G.vw - G.left;
    let du = 0;
    if (r.left < lo - 1) du = Math.ceil((lo - r.left) / G.pitch - .01);
    else if (r.right > hi + 1) du = -Math.ceil((r.right - hi) / G.pitch - .01);
    if (du) tweenRow(st, Math.round(st.u) + du, 420, easePaper);
  }

  /* ---------- room view (view.js): the tile unfolds into the whole room ---------- */
  const tileFor = (st, slot) => {
    if (mode === 'motion') { const li = st.pool.get(slot); return li && li.isConnected ? li : null; }
    return [...st.track.children].find(x => x._slot === mod(slot, st.list.length)) || null;
  };
  const onScreen = (li, dx = 0) => { const r = li._art.getBoundingClientRect(); return r.right + dx > G.left * .5 && r.left + dx < G.vw - G.left * .5 && r.bottom > 0 && r.top < innerHeight; };
  const view = createRoomView({
    L, host, reduce, motion, text, data, rtl, themeLabel,
    rows: {
      roomAt,
      tileFor,
      /* the row takes the same step as the view. Rapid presses aim past the step still running, so row and view
         never part; with the page paused the row is simply there */
      step(st, d) {
        if (mode !== 'motion') return;
        const tw = st.tween, to = (tw ? tw.to : Math.round(st.u)) - d, done = tw && tw.done;
        if (motion.paused) { st.tween = null; st.u = to; layoutRow(st); if (done) done(); }
        else tweenRow(st, to, T.swap, easeInk, done);
      },
      /* a step still running finishes in `dur` (with the fold); returns the travel still to come, in px */
      settle(st, dur) {
        const tw = mode === 'motion' && st && st.tween;
        if (!tw) return 0;
        tweenRow(st, tw.to, dur, easeInk, tw.done);
        layoutRow(st);
        return (tw.to - st.u) * G.pitch;
      },
      relayout(st) { if (mode === 'motion' && st) layoutRow(st); },
      onOpen() { sync(); },
      onScreen,
      focusable: li => mode !== 'motion' || onScreen(li),
      bringIntoView(li) { if (mode === 'static') li.scrollIntoView({ block: 'nearest', inline: 'nearest' }); },   // the rails do not step with 이전/다음
      /* the last resort: the wall's own button, or while the page-wide pause hides it, a room on the paper or the wall */
      fallbackFocus(st) {
        if (!toggle.hidden) return toggle;
        const b = st && [...st.track.querySelectorAll('.tile__btn')].find(x => x.tabIndex === 0);
        if (b) return b;
        flow.tabIndex = -1;
        return flow;
      }
    }
  });

  /* ---------- wiring ---------- */
  L.on(flow, 'click', e => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
    const btn = e.target.closest('.tile__btn'); if (btn) view.open(btn.parentNode);
  }, true);
  /* a room's assets load when a pointer rests on its tile, when focus rests on it, or when it is pressed:
     a pointer crossing the wall, arrow keys walking past tiles or a scroll starting on a tile load nothing */
  let dwell = 0, dwellLi = null, dwellX = 0, dwellY = 0;
  const rest = (li, x, y) => { L.clear(dwell); dwellLi = li; dwellX = x; dwellY = y; dwell = L.later(() => { dwell = 0; view.prefetch(li._room); }, T.dwell); };
  const unrest = li => { if (!li || li === dwellLi) { L.clear(dwell); dwell = 0; dwellLi = null; } };
  L.on(flow, 'pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const li = e.target.closest('.tile');
    if (li && !hovering) { hovering = true; sync(); }
    if (li && li !== dwellLi) rest(li, e.clientX, e.clientY);
  });
  L.on(flow, 'pointermove', e => {          // still moving: the dwell starts again
    if (e.pointerType !== 'mouse' || !dwell || Math.hypot(e.clientX - dwellX, e.clientY - dwellY) <= 6) return;
    rest(dwellLi, e.clientX, e.clientY);
  });
  let hoverOff = 0;
  L.on(flow, 'pointerout', e => {
    if (e.pointerType !== 'mouse') return;
    const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.tile');
    const li = e.target.closest('.tile');
    if (li && to !== li) unrest(li);
    if (to) return;
    L.clear(hoverOff); hoverOff = L.later(() => { hovering = false; sync(); }, T.resume);
  });
  // a mouse press loads at once; a touch may be the start of a scroll, so it waits 150ms unless it moves or is cancelled
  let press = null;
  const unpress = () => { if (press) { L.clear(press.t); press = null; } };
  L.on(flow, 'pointerdown', e => {
    const li = e.target.closest('.tile'); if (!li) return;
    if (e.pointerType === 'mouse') { view.prefetch(li._room); return; }
    unpress();
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: L.later(() => { press = null; view.prefetch(li._room); }, T.press) };
  });
  L.on(flow, 'pointermove', e => { if (press && press.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) unpress(); });
  L.on(flow, 'pointercancel', unpress);
  L.on(flow, 'pointerover', e => { if (e.pointerType === 'mouse' && e.target.closest('.tile')) { L.clear(hoverOff); hoverOff = 0; } });
  L.on(flow, 'keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const li = e.target.closest('.tile'); if (!li) return;
    e.preventDefault();
    const st = li._st, d = e.key === 'ArrowRight' ? 1 : -1;     // the wall keeps its left-to-right geometry in every language
    if (mode === 'static') { const n = li[d > 0 ? 'nextElementSibling' : 'previousElementSibling']; if (n) n._btn.focus(); return; }   // focusin moves the rail's Tab stop
    const target = li._slot + d;
    layoutRow(st); const n = st.pool.get(target); if (n) { n._btn.focus({ preventScroll: true }); reveal(n); }
  });
  L.on(flow, 'focusin', e => {
    focusIn = true; sync();
    const li = e.target.closest('.tile'); if (!li) return;
    if (li !== dwellLi) rest(li, 0, 0);
    if (mode === 'static') rove(li);
    else if (li._btn.tabIndex !== 0) { li._tab = 0; li._btn.tabIndex = 0; }   // e.g. focus given back by the room view
  });
  /* reduced motion: one Tab stop per rail (the last focused room); arrow keys walk the rail */
  function rove(li) {
    const st = li._st;
    if (st.tabLi === li) return;
    if (st.tabLi) st.tabLi._btn.tabIndex = -1;
    st.tabLi = li; li._btn.tabIndex = 0;
  }
  L.on(flow, 'focusout', e => {
    const li = e.target.closest('.tile'), to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.tile');
    if (li && to !== li && !li.matches(':hover')) unrest(li);
    // a tile that held focus without being wholly in view (e.g. the recycled tile the closing dialog gave focus back to)
    // gives up its Tab stop, so Tab never reaches a room the visitor cannot see
    if (li && to !== li && mode === 'motion') queueMicrotask(() => {
      if (L.dead || li._tab !== 0 || li._btn === document.activeElement) return;
      const r = li._art.getBoundingClientRect();
      if (r.left < -1 || r.right > G.vw + 1) { li._tab = -1; li._btn.tabIndex = -1; }
    });
    if (e.target === flow) flow.removeAttribute('tabindex');    // the room view's last-resort target, once only
    if (!flow.contains(e.relatedTarget)) { focusIn = false; sync(); }
  });
  L.on(toggle, 'click', () => {
    userPaused = !userPaused;
    toggle.setAttribute('aria-pressed', String(userPaused));
    toggle.textContent = userPaused ? text('다시 움직이기') : text('움직임 멈추기');
    if (!userPaused) remaining = Math.min(remaining, 900);
    sync();
  });

  function onScroll() {
    if (mode !== 'motion' || userPaused || motion.paused) return;   // paused: the parallax holds where it is
    const r = flow.getBoundingClientRect();
    const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
    parTarget = p * G.amp;
    if (inView) kick();
  }

  let rz = 0;
  L.on(window, 'resize', () => {
    L.cancel(rz);
    rz = L.frame(() => {
      const was = G.vw; measure(); if (G.vw === was) return;
      if (mode === 'motion') { for (const st of S) { for (const li of st.pool.values()) { li.remove(); st.free.push(li); } st.pool.clear(); layoutRow(st); } onScroll(); }
    });
  });

  /* ---------- start ---------- */
  flow.dataset.mode = mode;
  measure();
  if (mode === 'static') {
    /* reduced motion: three tidy rails the visitor scrolls by hand, every room lazy-loaded */
    flow.classList.remove('is-waiting');
    toggle.hidden = true;
    hint.textContent = text('옆으로 넘기면 방이 더 있어요. 방을 누르면 크게 볼 수 있어요');
    for (const st of S) {
      for (let s = 0; s < st.list.length; s++) { const li = makeTile(); li._slot = s; li._st = st; fill(li, roomAt(st, s), true); li._btn.tabIndex = -1; st.track.appendChild(li); }
      if (st.track.firstElementChild) rove(st.track.firstElementChild);
    }
  } else {
    for (const st of S) layoutRow(st);
    onScroll(); for (const st of S) st.par = parTarget * DIR[st.r];
    for (const st of S) { layoutRow(st); bindRow(st); }
    L.on(window, 'scroll', onScroll, { passive: true });
    L.on(document, 'visibilitychange', sync);
    /* while the page-wide pause holds, the wall's own button steps aside: the page's button is the one control */
    toggle.hidden = motion.paused;
    L.add(motion.subscribe(() => { toggle.hidden = motion.paused; sync(); if (!motion.paused) onScroll(); }));
    L.io(entries => {
      for (const e of entries) {
        inView = e.isIntersecting;
        if (inView && e.intersectionRatio >= .1) enter();   // lab: .2; earlier, so the wall is never a white gap while it scrolls in
        if (inView) kick();
      }
      sync();
    }, { threshold: [0, .1] }).observe(flow);
  }

  return {
    life: L,
    destroy() {
      L.end();
      host.querySelector('dialog[open]')?.close();
      host.getAnimations({ subtree: true }).forEach(a => a.cancel());
      host.replaceChildren(); tools.replaceChildren();
    }
  };
}
