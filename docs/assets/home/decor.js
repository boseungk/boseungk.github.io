// 3. Decor: a short live demonstration in the scene, once; then the cards are the visitor's.
// The default room gains the lake theme's lamp (with the acquisition dialog), then its bench and rug, and ends on
// 고요한 호수 (stage 3 = the lake room). It starts at 50% visibility and runs on its own clock, which stops
// offscreen, in a hidden tab and while the page is paused. A card click, or keyboard focus on a card, ends it (the
// room then shows the pressed card's stage). Reduced motion: stage 3.
import { live, timeline } from './motion.js';

// the six paper pieces of the acquisition dialog: [clip polygon, from x, from y, delay ms]
const PIECES = [
  ['0 0,38% 0,34% 42%,0 48%', -5, -4, 30], ['38% 0,72% 0,68% 46%,34% 42%', 0, -6, 0], ['72% 0,100% 0,100% 50%,68% 46%', 5, -4, 60],
  ['0 48%,34% 42%,38% 100%,0 100%', -5, 5, 70], ['34% 42%,68% 46%,64% 100%,38% 100%', 0, 6, 20], ['68% 46%,100% 50%,100% 100%,64% 100%', 5, 4, 50]];

export function mount(root, { motion, life: L }) {
  const reduced = motion.reduced;
  const scene = root.querySelector('#decor-scene');
  const steps = [...scene.querySelectorAll('.dstep')];
  const cards = [...scene.querySelectorAll('.dcard')];
  const dacq = scene.querySelector('#dacq'), acq = scene.querySelector('#acq');
  const tiles = acq.querySelector('.acq__tiles');

  tiles.replaceChildren(...PIECES.map(([cut, x, y, delay]) => {
    const tile = document.createElement('span');
    tile.className = 'acq-tile';
    tile.style.cssText = `--cut:polygon(${cut});--from-x:${x}px;--from-y:${y}px;--delay:${delay}ms`;
    return tile;
  }));

  const selectCard = k => cards.forEach((c, i) => c.setAttribute('aria-pressed', String(i === k)));
  // a stage that has not decoded yet keeps the previous one on screen; a failed one never replaces it
  let wanted = 0;
  const showStep = k => {
    wanted = k;
    const img = steps[k];
    const swap = () => { if (wanted === k) steps.forEach((s, i) => s.classList.toggle('is-on', i === k)); };
    if (img.complete && img.naturalWidth) { swap(); return; }
    img.loading = 'eager';
    img.decode().then(swap, () => {});
  };
  const openAcq = () => {
    dacq.classList.remove('is-closing');
    dacq.classList.add('is-open');
    acq.classList.add('play');
  };
  const closeAcq = () => { dacq.classList.add('is-closing'); dacq.classList.remove('is-open'); };
  const clearAcq = () => { dacq.classList.remove('is-open', 'is-closing'); acq.classList.remove('play', 'settled'); };

  const demo = timeline(L, [
    [0, () => { selectCard(0); showStep(0); }],
    [1200, () => selectCard(1)],
    [1500, openAcq],
    [3900, () => acq.classList.add('settled')],
    [4700, closeAcq],
    [4920, () => showStep(1)],
    [7000, () => { selectCard(2); showStep(2); }],
    [9200, () => { selectCard(3); showStep(3); }],
  ]);
  const endDemo = () => { demo.end(); clearAcq(); };
  cards.forEach((c, i) => L.on(c, 'click', () => { endDemo(); selectCard(i); showStep(i); }));
  L.on(scene, 'focusin', () => {
    if (demo.done) return;
    endDemo();
    showStep(Math.max(0, cards.findIndex(c => c.getAttribute('aria-pressed') === 'true')));
  });

  if (reduced) {
    demo.end();
    selectCard(3);
    showStep(3);
  } else {
    selectCard(0);
    showStep(0);
    let started = false, on = false;
    const io = L.io(entries => {
      const e = entries[entries.length - 1];
      if (!started && e.isIntersecting && e.intersectionRatio >= .49) { started = true; if (on) demo.run(); }
    }, { threshold: [0, .5] });
    io.observe(scene);
    live(L, scene, visible => {
      on = visible;
      scene.classList.toggle('is-paused', !visible);
      if (!started || demo.done) return;
      visible ? demo.run() : demo.hold();
    });
  }

  return {
    destroy() {
      L.end();
      clearAcq();
      tiles.replaceChildren();
      scene.classList.remove('is-paused');
    },
  };
}
