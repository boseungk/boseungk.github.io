// 6. Night: the band's meteors run only while the band is on screen (and the page is not paused or hidden);
// the night mark replays once. Reduced motion: no meteors.
import { live, cue, replay } from './motion.js';

export function mount(root, { motion, life: L }) {
  const band = root.querySelector('#band');
  const mark = root.querySelector('#night-mark');
  if (!motion.reduced) {
    live(L, band, on => band.classList.toggle('is-on', on));
    cue(L, mark, () => replay(mark, 'play'), { minRatio: 1 });
  }
  return {
    destroy() {
      L.end();
      band.classList.remove('is-on');
      mark.classList.remove('play');
    },
  };
}
