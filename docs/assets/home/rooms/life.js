// One lifetime per mounted wall (and the room view it owns): every listener, observer, timer, frame and
// teardown step is registered here, so end() stops all of it. `open` reports what is still registered
// (tools/check-home.mjs and the browser QA read it after destroy()).
export function life() {
  const offs = [], timers = new Set(), frames = new Set();
  let dead = false;
  return {
    get dead() { return dead; },
    get open() { return { timers: timers.size, frames: frames.size, offs: offs.length }; },
    on(target, type, fn, opts) { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); },
    io(cb, opts) { const o = new IntersectionObserver((es, ob) => { if (!dead) cb(es, ob); }, opts); offs.push(() => o.disconnect()); return o; },
    later(fn, ms) { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; },
    clear(t) { if (t) { clearTimeout(t); timers.delete(t); } },
    frame(fn) { const f = requestAnimationFrame(now => { frames.delete(f); if (!dead) fn(now); }); frames.add(f); return f; },
    cancel(f) { if (f) { cancelAnimationFrame(f); frames.delete(f); } },
    add(fn) { offs.push(fn); },
    end() {
      if (dead) return; dead = true;
      timers.forEach(clearTimeout); timers.clear();
      frames.forEach(cancelAnimationFrame); frames.clear();
      while (offs.length) { try { offs.pop()(); } catch (e) { console.error(e); } }
    },
  };
}
