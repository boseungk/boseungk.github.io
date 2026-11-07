// 4. Collection: the nine theme boards. A theme opens grey -> colour behind a diagonal light (3200ms), once per
// theme; the first one opens when the feature is half in view. The light freezes while the page is paused or hidden.
// Board URLs come from the buttons' data-color-src / data-gray-src (stamped by the build). A board that fails to
// load keeps the previous pair. Reduced motion: the colour board, no light.
import { smooth } from './motion.js';
import { radios } from './choice.js';

const UNLOCK_MS = 3200;

export function mount(root, { motion, life: L, text }) {
  const reduced = motion.reduced;
  const feature = root.querySelector('#feature');
  const gray = feature.querySelector('.gray'), color = feature.querySelector('.color');
  const caption = root.querySelector('#feature-name');
  const tpick = root.querySelector('.tpick');
  const buttons = [...tpick.querySelectorAll('button[data-theme]')];
  const button = id => buttons.find(b => b.dataset.theme === id);
  const nameOf = id => button(id).querySelector('.tpick__name').textContent.trim();
  const checked = () => buttons.find(b => b.getAttribute('aria-checked') === 'true') || buttons[0];
  const FIRST = checked().dataset.theme;

  const opened = new Set();
  let shown = FIRST, unlocking = null, seen = false, token = 0, anim = null;
  const set = (front, glow, zoom) => {
    feature.style.setProperty('--front', front);
    feature.style.setProperty('--glow', glow);
    feature.style.setProperty('--zoom', zoom);
  };
  const setFinal = () => set(1.3, 0, 1);
  const setStart = () => set(-.18, 0, 1.19);
  const openMini = id => { opened.add(id); button(id)?.classList.add('is-open'); };

  // the light: a frame clock that stops while the page is paused or hidden and resumes where it was
  const runs = () => !motion.paused && !document.hidden;
  const tick = now => {
    anim.raf = 0;
    if (anim.last) anim.elapsed += Math.min(100, now - anim.last);
    anim.last = now;
    const p = Math.min(1, anim.elapsed / UNLOCK_MS), ph = smooth(.14, .76, p);
    set((-.18 + 1.36 * ph).toFixed(4), (.14 * Math.sin(ph * Math.PI)).toFixed(4), (1.19 - .19 * smooth(0, .88, p)).toFixed(4));
    if (p >= 1) { const done = anim.done; anim = null; done(); return; }
    if (runs()) anim.raf = L.frame(tick);
    else anim.last = 0;
  };
  const resume = () => { if (anim && !anim.raf && runs()) { anim.last = 0; anim.raf = L.frame(tick); } };
  const halt = () => { if (anim && anim.raf) { L.cancel(anim.raf); anim.raf = 0; anim.last = 0; } };
  L.add(motion.subscribe(() => (runs() ? resume() : halt())));
  const cancelUnlock = () => { if (anim) { L.cancel(anim.raf); anim = null; } };
  const unlock = id => {
    cancelUnlock();
    unlocking = id;
    const done = () => { unlocking = null; openMini(id); };
    if (reduced) { setFinal(); done(); return; }
    anim = { elapsed: 0, last: 0, raf: 0, done };
    resume();
  };

  const preload = src => { const img = new Image(); img.src = src; return img.decode(); };
  const showTheme = async id => {
    const tok = ++token;
    if (unlocking) { cancelUnlock(); openMini(unlocking); unlocking = null; }
    const ghost = (opened.has(shown) ? color : gray).cloneNode();
    ghost.className = 'ghost'; ghost.alt = ''; ghost.removeAttribute('loading');
    feature.appendChild(ghost);
    const first = !opened.has(id), b = button(id);
    try {
      await Promise.all([preload(b.dataset.colorSrc), first ? preload(b.dataset.graySrc) : null]);
    } catch (e) {
      // keep the previous pair, and the choice that matches it
      ghost.remove();
      if (tok === token) {
        buttons.forEach(x => x.setAttribute('aria-checked', String(x.dataset.theme === shown)));
        if (opened.has(shown)) setFinal();     // an unlock cut short by this choice ends in colour, not half grey
      }
      return;
    }
    if (tok !== token || L.dead) { ghost.remove(); return; }
    gray.src = b.dataset.graySrc;
    color.src = b.dataset.colorSrc;
    color.alt = text('{name} 테마의 방', { name: nameOf(id) });
    caption.textContent = nameOf(id);
    shown = id;
    first ? setStart() : setFinal();
    L.frame(() => { ghost.style.opacity = '0'; });
    L.later(() => ghost.remove(), reduced ? 0 : 260);
    if (first) L.later(() => { if (tok === token) unlock(id); }, reduced ? 0 : 240);
  };
  const choose = b => {
    const id = b.dataset.theme;
    if (b.getAttribute('aria-checked') === 'true' && (opened.has(id) || unlocking === id || !seen)) {
      if (!seen) { seen = true; unlock(id); }
      return;
    }
    buttons.forEach(x => x.setAttribute('aria-checked', String(x === b)));
    seen = true;
    showTheme(id);
  };
  buttons.forEach(b => L.on(b, 'click', () => choose(b)));
  radios(L, tpick, buttons, choose);
  // on narrow screens the boards are a rail: start it with the chosen board in the middle (no page scroll)
  if (tpick.scrollWidth > tpick.clientWidth + 1) {
    const g = tpick.getBoundingClientRect(), r = checked().getBoundingClientRect();
    tpick.scrollLeft += (r.left + r.width / 2) - (g.left + g.width / 2);
  }

  if (reduced) {
    setFinal();
    openMini(FIRST);
    seen = true;
  } else {
    setStart();
    const io = L.io((entries, observer) => {
      const e = entries[entries.length - 1];
      if (!e.isIntersecting || e.intersectionRatio < .49) return;
      observer.disconnect();
      if (seen) return;
      seen = true;
      unlock(FIRST);
    }, { threshold: [0, .5] });
    io.observe(feature);
  }

  return {
    destroy() {
      L.end();
      feature.querySelectorAll('.ghost').forEach(g => g.remove());
      setFinal();
    },
  };
}
