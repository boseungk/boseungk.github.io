// 1. Hero: the running focus screen inside the phone; the garden room turns day -> dusk -> night (5600/5000/1500/7600 ms).
// The cycle only demonstrates: the first touch of the marks or the phone, or keyboard focus on the marks, hands the
// room to the visitor for good (a focused mark never changes under the visitor).
// Offscreen, in a hidden tab or while the page is paused the cycle, the HUD clock and the colour flow freeze and
// resume with the time left. Reduced motion: day, 00:14, no timers.
import { live, loop30, replay } from './motion.js';
import { radios } from './choice.js';
import { makeHourglass, CYCLE, STILL_PHASE } from './hourglass.js';

const PHASES = [
  { id: 'day', pick: 'day', ms: 5600 },
  { id: 'dusk', pick: 'dusk', ms: 5000 },
  { id: 'unlit', pick: 'night', ms: 1500 },
  { id: 'night', pick: 'night', ms: 7600 },
];
const GOAL = 25 * 60;
const mmss = secs => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

export function mount(root, { motion, life: L, palette }) {
  const reduced = motion.reduced;
  const room = root.querySelector('#room');
  const phone = root.querySelector('#hero-phone');
  const todpick = root.querySelector('.todpick');
  const marks = [...todpick.querySelectorAll('button[data-go]')];
  const timeEl = root.querySelector('#hud-time');

  // dusk, unlit and night layers wait for the page's load event (dusk is first needed at 5.6 s)
  const layers = [...room.querySelectorAll('img[data-src]')];
  const loadLayers = () => layers.forEach(img => { if (!img.getAttribute('src')) img.src = img.dataset.src; });
  if (document.readyState === 'complete') loadLayers();
  else L.on(window, 'load', loadLayers, { once: true });

  let phase = 0, auto = !reduced, on = false;
  let phaseTimer = 0, phaseStart = 0, phaseLeft = PHASES[0].ms, meteorTimer = 0, meteorSide = 0;

  const meteors = () => {
    L.clear(meteorTimer); meteorTimer = 0;
    if (reduced || !on || PHASES[phase].id !== 'night') { room.classList.remove('shoot-l', 'shoot-r'); return; }
    const fire = () => {
      const cls = meteorSide++ % 2 ? 'shoot-r' : 'shoot-l';
      room.classList.remove('shoot-l', 'shoot-r');
      void room.offsetWidth;
      room.classList.add(cls);
      meteorTimer = L.later(fire, 3600 + Math.random() * 2600);
    };
    meteorTimer = L.later(fire, 1500);
  };
  const setPhase = (i, fromUser) => {
    phase = (i + PHASES.length) % PHASES.length;
    const p = PHASES[phase];
    room.dataset.phase = p.id;
    marks.forEach(b => b.setAttribute('aria-checked', String(b.dataset.go === p.pick)));
    if (fromUser && !motion.paused) replay(marks.find(b => b.dataset.go === p.pick)?.querySelector('.tod'), 'play');
    meteors();
  };
  const schedule = ms => {
    L.clear(phaseTimer); phaseTimer = 0;
    if (!auto || !on) return;
    phaseStart = performance.now(); phaseLeft = ms;
    phaseTimer = L.later(() => { phaseTimer = 0; setPhase(phase + 1); schedule(PHASES[phase].ms); }, ms);
  };
  const stopAuto = () => { if (!auto) return; auto = false; L.clear(phaseTimer); phaseTimer = 0; };
  ['pointerdown', 'keydown', 'click', 'focusin'].forEach(type => { L.on(todpick, type, stopAuto); L.on(phone, type, stopAuto); });
  const choose = b => {
    stopAuto();
    loadLayers();
    setPhase(PHASES.findIndex(p => p.pick === b.dataset.go && p.id !== 'unlit'), true);
  };
  marks.forEach(b => L.on(b, 'click', () => choose(b)));
  radios(L, todpick, marks, choose);
  setPhase(0);

  // HUD: a small hourglass beside a real-seconds timer (goal 25 min)
  const hud = makeHourglass(root.querySelector('#hud-glass'), { palette: palette.id, skins: 2, L, reduced });
  L.add(palette.subscribe(id => hud.setPalette(id)));
  let secs = 0, tick = 0, flowT = 0;
  const showTime = () => { timeEl.textContent = mmss(secs); hud.setProgress(Math.min(1, secs / GOAL)); };
  const flow = loop30(L, dt => { flowT += dt; hud.setPhase((flowT % CYCLE) / CYCLE); });

  if (reduced) {
    timeEl.textContent = '00:14';
    hud.setProgress(.42);
    hud.setPhase(STILL_PHASE);
  } else {
    showTime();
    hud.setPhase(0);
    room.classList.add('is-live');
    live(L, phone, visible => {
      on = visible;
      room.classList.toggle('is-paused', !visible);
      if (visible) {
        if (!tick) tick = L.every(() => { secs++; showTime(); }, 1000);
        flow.start();
        if (auto) schedule(Math.max(800, phaseLeft));
      } else {
        L.stop(tick); tick = 0;
        flow.stop();
        if (auto && phaseTimer) { L.clear(phaseTimer); phaseTimer = 0; phaseLeft -= performance.now() - phaseStart; }
      }
      meteors();
    });
  }

  return {
    destroy() {
      L.end();
      hud.destroy();
      room.classList.remove('is-live', 'is-paused', 'shoot-l', 'shoot-r');
      room.dataset.phase = 'day';
      marks.forEach(b => b.setAttribute('aria-checked', String(b.dataset.go === 'day')));
      timeEl.textContent = '00:14';
    },
  };
}
