// One motion state for the page (PORT-PLAN §2.6, home plan §2.2):
//   paused = the visitor's pause (#motion-toggle) || prefers-reduced-motion; hidden = document.hidden.
// Every change sets html.is-motion-paused (CSS pauses ambient animations with it) and dispatches
// window 'mar:motion' {detail: {paused, reduced, user}} for ui/selection.js and home/rooms/index.js.
// The visitor's choice is not stored (the site saves no visitor data).
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new Set();
let user = false;

export const motion = {
  get reduced() { return reduceQuery.matches; },
  get user() { return user; },
  get paused() { return user || reduceQuery.matches; },
  get hidden() { return document.hidden; },
  setUser(value) {
    if (value === user) return;
    user = value;
    changed('user');
  },
  // fn(why) with why = 'user' | 'reduced' | 'hidden'; returns the unsubscribe function
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

function mark() { document.documentElement.classList.toggle('is-motion-paused', motion.paused); }
// a listener removed by an earlier one in the same round (a section destroyed by a remount) is skipped
function notify(why) { [...listeners].forEach(fn => { if (!listeners.has(fn)) return; try { fn(why); } catch (e) { console.error(e); } }); }
function changed(why) {
  mark();
  window.dispatchEvent(new CustomEvent('mar:motion', { detail: { paused: motion.paused, reduced: motion.reduced, user } }));
  notify(why);
}
reduceQuery.addEventListener('change', () => changed('reduced'));
document.addEventListener('visibilitychange', () => notify('hidden'));
mark();

// cb(true) while el is on screen (opts: IntersectionObserver options, plus minRatio), the tab is visible and motion
// is not paused; cb(false) otherwise. Returns a function that re-evaluates the state.
export function live(L, el, cb, { minRatio = 0, ...opts } = {}) {
  let seen = false, last = null;
  const sync = () => {
    const on = seen && !document.hidden && !motion.paused;
    if (on !== last) { last = on; cb(on); }
  };
  const io = L.io(entries => {
    const e = entries[entries.length - 1];
    seen = e.isIntersecting && e.intersectionRatio >= minRatio - .01;
    sync();
  }, minRatio ? { threshold: [0, minRatio], ...opts } : opts);
  io.observe(el);
  L.add(motion.subscribe(sync));
  return sync;
}

// fn() once, the first time live() turns on (a one-shot cue that waits for the visitor and for an unpaused page).
export function cue(L, el, fn, opts) {
  let done = false;
  live(L, el, on => { if (on && !done) { done = true; fn(); } }, opts);
}

export function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.getBoundingClientRect();
  el.classList.add(cls);
}

// requestAnimationFrame loop capped at ~30fps; start()/stop() so nothing runs while hidden or paused.
export function loop30(L, fn) {
  let raf = 0, wait = 0, last = 0, on = false;
  const frame = now => {
    raf = 0;
    const dt = last ? Math.min(100, now - last) : 0;
    last = now;
    fn(dt);
    if (on) wait = L.later(() => { wait = 0; if (on) raf = L.frame(frame); }, 30);
  };
  return {
    start() { if (on) return; on = true; last = 0; raf = L.frame(frame); },
    stop() { on = false; L.cancel(raf); L.clear(wait); raf = 0; wait = 0; },
  };
}

// A demonstration on its own clock: [ms, fn] events; hold() freezes the clock, run() resumes it with the time left,
// reset() rewinds it, end() drops the rest. Timers go through the section's life.
export function timeline(L, events) {
  let index = 0, elapsed = 0, base = 0, running = false, timer = 0;
  const next = () => {
    L.clear(timer); timer = 0;
    if (!running || index >= events.length) return;
    const wait = Math.max(0, events[index][0] - (performance.now() - base));
    timer = L.later(() => { timer = 0; const fn = events[index++][1]; fn(); next(); }, wait);
  };
  const api = {
    get running() { return running; },
    get started() { return running || elapsed > 0 || index > 0; },
    get done() { return index >= events.length; },
    run() { if (running || index >= events.length) return; running = true; base = performance.now() - elapsed; next(); },
    hold() { if (!running) return; running = false; L.clear(timer); timer = 0; elapsed = performance.now() - base; },
    reset() { api.hold(); index = 0; elapsed = 0; },
    end() { api.hold(); index = events.length; },
  };
  return api;
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
