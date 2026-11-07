// Home entry (module). Section modules follow one contract: mount(root, ctx) -> {destroy()}, with
// ctx = {motion, life, text, timeOf, palette}; everything they start goes through their life (life.js), so
// destroy() leaves no timer, frame, listener or observer behind. A module that throws (or fails to load) is logged
// and its static markup stays. The hero is imported with this file and mounts at once; the other sections' code is
// fetched (import()) and mounted when they come within one viewport. The page head modulepreloads this file's static
// graph (tools/templates/home.ko.html), so the hero's code arrives in one round. A change of the reduced-motion
// setting mounts every mounted section again (each reads it at mount).
// The rooms wall (추천하는 방 둘러보기) is home/rooms/index.js, a separate module that mounts itself.
import { motion } from './motion.js';
import { life } from './life.js';
import { text, timeOf } from './copy.js';
import * as hero from './hero.js';

const SECTIONS = [
  { id: 'hero', module: hero, eager: true },
  { id: 'focus', load: () => import('./focus.js') },
  { id: 'decor', load: () => import('./decor.js') },
  { id: 'collection', load: () => import('./themes.js') },
  { id: 'records', load: () => import('./records.js') },
  { id: 'night', load: () => import('./night.js') },
];

// the hourglass colour chosen in the focus section also paints the hero's HUD hourglass
const palette = (() => {
  const listeners = new Set();
  return {
    id: 'dawn',
    set(id) { if (id === this.id) return; this.id = id; listeners.forEach(fn => fn(id)); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();

/* ---------- one-shot reveals (content stays visible if this script never runs) ---------- */
function reveals() {
  if (motion.reduced) return;
  const items = [...document.querySelectorAll('main .reveal')];
  const vh = window.innerHeight;
  items.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) el.classList.add('in');
    const siblings = el.parentElement ? [...el.parentElement.children].filter(x => x.classList.contains('reveal')) : [];
    const k = siblings.indexOf(el);
    if (k > 0) el.style.setProperty('--rd', Math.min(k, 5) * 50 + 'ms');
  });
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .01 });
  document.documentElement.classList.add('rv');
  items.forEach(el => { if (!el.classList.contains('in')) io.observe(el); });
}

/* ---------- section lifetimes ---------- */
const mounted = new Map();
const near = new Set();
const loading = new Set();
function mountSection(section) {
  if (mounted.has(section) || loading.has(section)) return;
  const root = document.getElementById(section.id);
  if (!root) return;
  if (!section.module) {
    loading.add(section);
    section.load().then(module => {
      loading.delete(section);
      section.module = module;
      if (near.has(section)) mountSection(section);
    }, error => {
      loading.delete(section);
      console.error(`home: ${section.id} did not load; its static content stays`, error);
    });
    return;
  }
  const L = life();
  try {
    const api = section.module.mount(root, { motion, life: L, text, timeOf, palette }) || {};
    mounted.set(section, { L, api });
  } catch (error) {
    console.error(`home: ${section.id} did not start; its static content stays`, error);
    L.end();
  }
}
function unmountAll() {
  mounted.forEach(({ L, api }, section) => {
    try { api.destroy?.(); } catch (error) { console.error(`home: ${section.id} did not stop cleanly`, error); }
    L.end();
  });
  mounted.clear();
}
function start() {
  const watch = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const section = SECTIONS.find(s => s.id === e.target.id);
    watch.unobserve(e.target);
    near.add(section);
    mountSection(section);
  }), { rootMargin: '100% 0px' });
  SECTIONS.forEach(section => {
    const root = document.getElementById(section.id);
    if (!root) return;
    if (section.eager) { near.add(section); mountSection(section); }
    else watch.observe(root);
  });
}

/* ---------- the page pause (#motion-toggle, WCAG 2.2.2) ---------- */
function toggle() {
  const button = document.getElementById('motion-toggle');
  if (!button) return;
  const sync = () => {
    button.hidden = motion.reduced;               // nothing moves under reduced motion
    button.setAttribute('aria-pressed', String(motion.user));
    button.setAttribute('aria-label', motion.user ? text('움직임 재생') : text('움직임 멈추기'));
  };
  button.addEventListener('click', () => motion.setUser(!motion.user));
  motion.subscribe(why => { if (why !== 'hidden') sync(); });
  sync();
}

reveals();
toggle();
start();
motion.subscribe(why => {
  if (why !== 'reduced') return;
  unmountAll();
  SECTIONS.forEach(section => { if (near.has(section)) mountSection(section); });
});
