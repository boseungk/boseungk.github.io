// 1. Hero: the focus screen inside the phone.
// Live room (motion allowed): the app's own drawn world runs on a Canvas 2D (/assets/live/scene.js, loaded at mount;
// the sea poster is its first frame). Once the phone is first visible, the focus section's prep sheet (cloned, so it
// carries the page's language) holds at least 1200 ms and until the scene is ready (at most 8 s), its start button is
// pressed, and focus starts: the view turns into the flower garden, one of three garden events starts, the cat walks
// in and hops onto the sofa, and the HUD clock runs in real seconds from 00:00. After 22 s of day the room goes
// dusk -> night, unlit for 3 s -> lamp warming up over 2400 ms -> day (12000/3000/12000/22000 ms); the lamp goes out
// over the 1600 ms the morning light comes in. Picking night from the marks also waits those 3 s before the lamp. Any touch of the phone or the marks skips the prep sheet.
// Still room (reduced motion, or a scene that cannot load): the greenhouse stills turn day -> dusk -> night
// (5600/5000/1500/7600 ms); reduced motion: day, 00:14, no timers.
// The cycle only demonstrates: the first touch of the marks or the phone, or keyboard focus on the marks, hands the
// room to the visitor for good (a focused mark never changes under the visitor).
// Offscreen, in a hidden tab or while the page is paused the scene, the cycle, the HUD clock and the colour flow
// freeze and resume with the time left.
import { live, loop30, replay } from './motion.js';
import { radios } from './choice.js';
import { makeHourglass, CYCLE, STILL_PHASE } from './hourglass.js';

const PHASES = [
  { id: 'day', pick: 'day', ms: 5600, sceneMs: 22000, tod: 0 },
  { id: 'dusk', pick: 'dusk', ms: 5000, sceneMs: 12000, tod: 1 },
  { id: 'unlit', pick: 'night', ms: 1500, sceneMs: 3000, tod: 2 },
  { id: 'night', pick: 'night', ms: 7600, sceneMs: 12000, tod: 2 },
];
const GOAL = 25 * 60;
const INTRO = { hold: 1200, press: 180, wait: 8000 };
const SCENE_URL = '/assets/live/scene.js';
const mmss = secs => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

export function mount(root, { motion, life: L, palette }) {
  const reduced = motion.reduced;
  const room = root.querySelector('#room');
  const phone = root.querySelector('#hero-phone');
  const todpick = root.querySelector('.todpick');
  const marks = [...todpick.querySelectorAll('button[data-go]')];
  const timeEl = root.querySelector('#hud-time');
  const art = room.querySelector('.room__art');
  const poster = room.querySelector('.room__l--day');

  // the greenhouse dusk, unlit and night layers are only for the still room; they wait for the page's load event
  const layers = [...room.querySelectorAll('img[data-src]')];
  const loadLayers = () => layers.forEach(img => { if (!img.getAttribute('src')) img.src = img.dataset.src; });
  let still = false;
  const toStill = () => {
    if (still) return;
    still = true;
    room.classList.add('is-still');
    if (poster.dataset.still) poster.src = poster.dataset.still;
    if (document.readyState === 'complete') loadLayers();
    else L.on(window, 'load', loadLayers, { once: true });
  };

  // live room
  let scene = null, sceneStart = false, on = false;
  const canvas = reduced ? null : document.createElement('canvas');
  const sceneSettled = canvas ? (async () => {
    canvas.className = 'room__scene';
    art.append(canvas);
    try {
      const { createLiveRoom } = await import(SCENE_URL);
      if (L.dead) return;
      const made = await createLiveRoom({ canvas, width: 440, height: 956, hook: new URLSearchParams(location.search).get('hook') });
      if (L.dead) { made.destroy(); return; }   // the hero was torn down while the scene loaded
      scene = made;
      canvas.classList.add('is-ready');
      scene.setTod(PHASES[phase].tod, 0); scene.setLamp(PHASES[phase].id === 'night', 0);
      if (sceneStart) scene.start();
      if (on) scene.resume();
    } catch (err) {
      if (L.dead) return;
      console.warn('hero: live room unavailable', err);
      scene = null; canvas.remove(); toStill();
    }
  })() : Promise.resolve();
  if (!canvas) toStill();
  const startScene = () => { sceneStart = true; scene?.start(); };
  const phaseMs = i => (still ? PHASES[i].ms : PHASES[i].sceneMs);

  let phase = 0, auto = !reduced;
  let phaseTimer = 0, phaseStart = 0, phaseLeft = phaseMs(0), meteorTimer = 0, meteorSide = 0;

  const meteors = () => {
    L.clear(meteorTimer); meteorTimer = 0;
    if (reduced || !still || !on || PHASES[phase].id !== 'night') { room.classList.remove('shoot-l', 'shoot-r'); return; }
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
    const from = PHASES[phase].id;
    phase = (i + PHASES.length) % PHASES.length;
    const p = PHASES[phase];
    room.dataset.phase = p.id;
    marks.forEach(b => b.setAttribute('aria-checked', String(b.dataset.go === p.pick)));
    if (fromUser && !motion.paused) replay(marks.find(b => b.dataset.go === p.pick)?.querySelector('.tod'), 'play');
    // the lamp comes on slowly, 3 s into the night (after the unlit step, or after picking night), and goes out with the
    // morning light
    if (scene) {
      scene.setTod(p.tod, 1600);
      if (p.id === 'night') scene.setLamp(true, 2400, from === 'unlit' || from === 'night' ? 0 : PHASES[2].sceneMs);
      else scene.setLamp(false, 1600);
    }
    meteors();
  };
  const schedule = ms => {
    L.clear(phaseTimer); phaseTimer = 0;
    if (!auto || !on) return;
    phaseStart = performance.now(); phaseLeft = ms;
    phaseTimer = L.later(() => { phaseTimer = 0; setPhase(phase + 1); schedule(phaseMs(phase)); }, ms);
  };
  const stopAuto = () => { if (!auto) return; auto = false; L.clear(phaseTimer); phaseTimer = 0; };
  ['pointerdown', 'keydown', 'click', 'focusin'].forEach(type => { L.on(todpick, type, stopAuto); L.on(phone, type, stopAuto); });
  const choose = b => {
    stopAuto();
    if (still) loadLayers();
    setPhase(PHASES.findIndex(p => p.pick === b.dataset.go && p.id !== 'unlit'), true);
  };
  marks.forEach(b => L.on(b, 'click', () => choose(b)));
  radios(L, todpick, marks, choose);
  setPhase(0);

  // Intro: a clone of the focus section's prep sheet, at app points inside the phone (home.css .intro)
  const screen = phone.querySelector('.phone__screen');
  const prepSrc = document.getElementById('fprep');   // the focus section's, not this section's
  let intro = null;
  const strip = node => { node.removeAttribute('id'); node.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); return node; };
  if (!reduced && screen && prepSrc) {
    const layer = document.createElement('div');
    layer.className = 'intro is-prep'; layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
    const app = document.createElement('div'); app.className = 'intro__app';
    const sheet = strip(prepSrc.cloneNode(true));
    app.append(sheet); layer.append(app);
    screen.insertBefore(layer, screen.querySelector('.phone__sb'));
    const glassHost = sheet.querySelector('.fprep__glass');
    if (glassHost) glassHost.replaceChildren();
    const glass = glassHost ? makeHourglass(glassHost, { palette: palette.id, L, reduced }) : null;
    glass?.setProgress(0);
    const fit = () => app.style.setProperty('--k', String(screen.clientWidth / 440));
    fit();
    L.on(window, 'resize', fit);   // the phone's size follows the viewport (home.css --w)
    intro = { layer, button: sheet.querySelector('.appbtn'), timers: [], state: 'wait' };
  } else {
    delete room.dataset.intro;
  }
  // focus starts: the sheet leaves, the scene starts, the clock runs from 00:00 and the cycle waits a day's length
  const endIntro = () => {
    if (intro && intro.state === 'over') return;
    if (intro) {
      intro.timers.forEach(t => L.clear(t));
      intro.state = 'over';
      intro.button?.classList.remove('is-pressed');
      intro.layer.classList.remove('is-prep');
      L.later(() => intro.layer.remove(), 600);
    }
    delete room.dataset.intro;
    startScene();
    secs = 0; showTime();
    if (on) { if (!tick) tick = L.every(() => { secs++; showTime(); }, 1000); if (auto) schedule(phaseMs(0)); }
  };
  // the hold and the 8 s wait only count while the phone is visible; the press waits for the phone too
  const runIntro = () => {
    intro.state = 'run';
    let held = false, ready = false, holdLeft = INTRO.hold - INTRO.press, waitLeft = INTRO.wait, since = 0;
    const at = (ms, fn) => intro.timers.push(L.later(fn, ms));
    const clearAll = () => { intro.timers.forEach(t => L.clear(t)); intro.timers = []; };
    const go = () => {
      if (!held || !ready || !on || L.dead || intro.state !== 'run') return;
      intro.state = 'press';
      clearAll();
      intro.button?.classList.add('is-pressed');
      at(INTRO.press, endIntro);
    };
    intro.resume = () => {
      if (intro.state !== 'run') return;
      since = performance.now();
      if (!held) at(holdLeft, () => { held = true; go(); });
      if (!ready) at(waitLeft, () => { ready = true; go(); });
      go();
    };
    intro.pause = () => {
      if (intro.state !== 'run') return;
      clearAll();
      const spent = performance.now() - since;
      holdLeft = Math.max(0, holdLeft - spent); waitLeft = Math.max(0, waitLeft - spent);
    };
    sceneSettled.then(() => { ready = true; go(); });
    intro.resume();
  };
  if (intro) ['pointerdown', 'keydown', 'focusin'].forEach(type => { L.on(todpick, type, endIntro); L.on(phone, type, endIntro); });

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
      if (visible) scene?.resume(); else scene?.pause();
      if (intro && intro.state !== 'over') {   // the prep sheet stays until its press
        if (visible) { flow.start(); if (intro.state === 'wait') runIntro(); else intro.resume?.(); }
        else { flow.stop(); intro.pause?.(); }
        return;
      }
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
      if (intro) { intro.timers.forEach(t => L.clear(t)); intro.layer.remove(); }
      delete room.dataset.intro;
      L.end();
      hud.destroy();
      scene?.destroy(); scene = null; canvas?.remove();
      room.classList.remove('is-live', 'is-paused', 'is-still', 'shoot-l', 'shoot-r');
      room.dataset.phase = 'day';
      marks.forEach(b => b.setAttribute('aria-checked', String(b.dataset.go === 'day')));
      timeEl.textContent = '00:14';
    },
  };
}
