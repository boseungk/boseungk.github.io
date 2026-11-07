// One lifetime per mounted section: everything it starts is registered here, so end() stops all of it
// (listeners, observers, timeouts, intervals, animation frames). Same contract as home/rooms/life.js.
export function life() {
  const offs = [], timers = new Set(), intervals = new Set(), frames = new Set();
  let dead = false;
  return {
    get dead() { return dead; },
    on(target, type, fn, opts) { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); },
    io(cb, opts) { const o = new IntersectionObserver((es, ob) => { if (!dead) cb(es, ob); }, opts); offs.push(() => o.disconnect()); return o; },
    mo(cb) { const o = new MutationObserver((rs, ob) => { if (!dead) cb(rs, ob); }); offs.push(() => o.disconnect()); return o; },
    later(fn, ms) { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; },
    clear(t) { if (t) { clearTimeout(t); timers.delete(t); } },
    every(fn, ms) { const t = setInterval(() => { if (!dead) fn(); }, ms); intervals.add(t); return t; },
    stop(t) { if (t) { clearInterval(t); intervals.delete(t); } },
    frame(fn) { const f = requestAnimationFrame(now => { frames.delete(f); if (!dead) fn(now); }); frames.add(f); return f; },
    cancel(f) { if (f) { cancelAnimationFrame(f); frames.delete(f); } },
    add(fn) { offs.push(fn); },
    get counts() { return { timers: timers.size, intervals: intervals.size, frames: frames.size, offs: offs.length }; },
    end() {
      if (dead) return; dead = true;
      timers.forEach(clearTimeout); timers.clear();
      intervals.forEach(clearInterval); intervals.clear();
      frames.forEach(cancelAnimationFrame); frames.clear();
      while (offs.length) { try { offs.pop()(); } catch (e) { console.error(e); } }
    },
  };
}
