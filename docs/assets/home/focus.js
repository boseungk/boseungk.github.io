// 2. Focus: one frameless scene, prep sheet -> completion card. The palette picker recolours the small hourglasses
// (the hero HUD too) and the slider's palette line only.
// Demonstration, once (home plan §6.2): it starts when the scene is at least 60% visible and its reveal has
// finished; the prep sheet holds 3200 ms, the start button shows its pressed state for 180 ms, then the done card.
// Leaving (or hiding the tab) before the press rewinds it for the next visit; the page pause freezes it; any choice
// of the visitor, or keyboard focus inside the scene, ends it for good (focus never falls out of a sheet that the
// demo hides). It never returns to the prep sheet by itself. Reduced motion: the prep sheet.
import { live, replay, timeline } from './motion.js';
import { radios } from './choice.js';
import { makeHourglass, PALETTES, STILL_PHASE } from './hourglass.js';

const GOAL_MIN = 25;
const HOLD = 3200, PRESS = 180, CARD_SETTLE = 580;

export function mount(root, { motion, life: L, text, timeOf, palette }) {
  const reduced = motion.reduced;
  const scene = root.querySelector('#focus-scene');
  const stage = scene.closest('.focus__stage') || scene;
  const fprep = root.querySelector('#fprep'), fdone = root.querySelector('#fdone');
  const fcard = fdone.querySelector('.fcard'), opal = fdone.querySelector('.opal');
  const startBtn = root.querySelector('#prep-start'), okBtn = root.querySelector('#done-ok');
  const fstate = root.querySelector('.fstate'), fButtons = [...fstate.querySelectorAll('button[data-show]')];
  const pick = root.querySelector('.pick'), pickButtons = [...pick.querySelectorAll('button[data-palette]')];
  const slider = root.querySelector('#prep-slider');
  const endEl = root.querySelector('#prep-end');

  // hourglasses: the prep sheet's (two skins, crossfades) and one still preview per palette
  const prep = makeHourglass(root.querySelector('#prep-glass'), { palette: palette.id, skins: 2, L, reduced });
  prep.setPreview();
  prep.setPhase(STILL_PHASE);
  const minis = [...root.querySelectorAll('[data-mini]')].map(el => {
    const m = makeHourglass(el, { palette: el.dataset.mini, L, reduced });
    m.setPreview();
    m.setPhase(STILL_PHASE);
    return m;
  });
  const paintSlider = id => PALETTES[id].colors.forEach((c, i) => slider.style.setProperty(`--c${i + 1}`, c));
  const markPalette = id => pickButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.palette === id)));
  markPalette(palette.id);
  paintSlider(palette.id);
  L.add(palette.subscribe(id => { prep.setPalette(id); paintSlider(id); markPalette(id); }));

  // "오후 5:30 목표 도달": the end time of a 25-minute goal started now, refreshed while the scene is on screen
  const showEnd = () => { endEl.textContent = text('{time} 목표 도달', { time: timeOf(new Date(Date.now() + GOAL_MIN * 60000)) }); };
  showEnd();
  let endTimer = 0;
  const near = L.io(entries => {
    const visible = entries[entries.length - 1].isIntersecting;
    L.stop(endTimer); endTimer = 0;
    if (visible) { showEnd(); endTimer = L.every(showEnd, 30000); }
  });
  near.observe(scene);

  let shown = 'prep', auto = !reduced, cardTimer = 0;
  const showFocus = (id, fromUser) => {
    if (id === shown) return;
    L.clear(cardTimer); cardTimer = 0;
    shown = id;
    scene.dataset.state = id;
    // focus inside the sheet that leaves moves to the one that arrives, never to <body>
    const rescue = (id === 'prep' ? fdone : fprep).contains(document.activeElement);
    fprep.inert = id !== 'prep';
    fdone.inert = id !== 'done';
    if (rescue && !fromUser) (id === 'done' ? okBtn : startBtn).focus({ preventScroll: true });
    fButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.show === id)));
    opal.classList.remove('pearl');
    fcard.classList.remove('bloom');
    // the card settles (220ms delay + 300ms), then the pearl light and the bloom play once
    if (id === 'done' && !reduced) cardTimer = L.later(() => { replay(opal, 'pearl'); replay(fcard, 'bloom'); }, CARD_SETTLE);
    if (fromUser) (id === 'done' ? okBtn : startBtn).focus({ preventScroll: true });
  };

  const demo = timeline(L, [
    [HOLD, () => startBtn.classList.add('is-pressed')],
    [HOLD + PRESS, () => { startBtn.classList.remove('is-pressed'); showFocus('done'); }],
  ]);
  const stopAuto = () => { if (!auto) return; auto = false; demo.end(); startBtn.classList.remove('is-pressed'); };
  L.on(stage, 'focusin', stopAuto);

  L.on(startBtn, 'click', () => { stopAuto(); showFocus('done', true); });
  L.on(okBtn, 'click', () => { stopAuto(); showFocus('prep', true); });
  const chooseState = b => { stopAuto(); showFocus(b.dataset.show); };
  fButtons.forEach(b => L.on(b, 'click', () => chooseState(b)));
  radios(L, fstate, fButtons, chooseState);

  const choosePalette = b => {
    palette.set(b.dataset.palette);
    // the colour only shows on the prep sheet, so bring it back
    stopAuto();
    showFocus('prep');
  };
  pickButtons.forEach(b => L.on(b, 'click', () => choosePalette(b)));
  radios(L, pick, pickButtons, choosePalette);

  if (auto) {
    const rv = document.documentElement;
    let visible = false, revealedAt = 0;
    const revealed = () => !rv.classList.contains('rv') || stage.classList.contains('in');
    const sync = () => {
      if (!auto || demo.done) return;
      if (!visible || document.hidden) {
        // left before the press: rewind, so the next visit sees the whole demonstration
        if (shown === 'prep' && demo.started) { demo.reset(); startBtn.classList.remove('is-pressed'); }
        return;
      }
      if (motion.paused) { demo.hold(); return; }
      if (!revealed()) return;                      // the class watcher below calls sync again
      const settle = revealedAt + 260 - performance.now();
      if (settle > 0) { L.later(sync, settle); return; }
      demo.run();
    };
    if (!revealed()) {
      const watch = L.mo(() => { if (revealed()) { watch.disconnect(); revealedAt = performance.now(); sync(); } });
      watch.observe(stage, { attributes: true, attributeFilter: ['class'] });
    }
    const io = L.io(entries => {
      const e = entries[entries.length - 1];
      visible = e.isIntersecting && e.intersectionRatio >= .59;
      sync();
    }, { threshold: [0, .6] });
    io.observe(scene);
    L.add(motion.subscribe(sync));
  }

  return {
    destroy() {
      L.end();
      prep.destroy();
      minis.forEach(m => m.destroy());
      startBtn.classList.remove('is-pressed');
      opal.classList.remove('pearl');
      fcard.classList.remove('bloom');
      scene.dataset.state = 'prep';
      fprep.inert = false;
      fdone.inert = true;
      fButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.show === 'prep')));
    },
  };
}
