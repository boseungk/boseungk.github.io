// 5. Records: one quiet cue per page, once, when the page is 60% in view and the page is not paused
// (tasks: the read item is checked; growth: sprout -> stem on the plant timing; memory: the evening marks replay).
// Reduced motion shows the final state from the start; so does the page without script.
import { cue, replay } from './motion.js';

export function mount(root, { motion, life: L, text }) {
  const reduced = motion.reduced;
  const taskDone = root.querySelector('#task-done'), taskCount = root.querySelector('#tasks-count');
  const growth = root.querySelector('#paper-growth');
  const stages = growth.querySelector('.stages');
  const items = [...stages.querySelectorAll('.stages__i')];
  const memory = root.querySelector('#paper-memory');
  const current = k => items.forEach((item, i) => (i === k ? item.setAttribute('aria-current', 'step') : item.removeAttribute('aria-current')));
  // the measured selection wash of the app (ui/selection.js) under the current stage name
  window.MARSelection?.mount(stages, items, () => items.find(item => item.hasAttribute('aria-current')) || null, false);
  L.add(() => window.MARSelection?.destroy(stages));

  const final = () => {
    taskDone.classList.add('is-done');
    taskDone.classList.remove('drew');
    taskCount.textContent = text('3개 중 1개 완료');
    growth.classList.remove('pre', 'grow');
    current(2);
  };

  if (reduced) {
    final();
  } else {
    // start from the moment just before: one item still open, the plant still a sprout
    taskDone.classList.remove('is-done', 'drew');
    taskCount.textContent = text('3개 중 0개 완료');
    growth.classList.remove('grow');
    growth.classList.add('pre');
    current(1);
    cue(L, root.querySelector('#paper-tasks'), () => L.later(() => {
      taskDone.classList.add('is-done', 'drew');
      taskCount.textContent = text('3개 중 1개 완료');
    }, 500), { minRatio: .6 });
    cue(L, growth, () => L.later(() => {
      growth.classList.remove('pre');
      growth.classList.add('grow');
      // the labels cross-dim as the new stage settles
      L.later(() => current(2), 1320);
    }, 300), { minRatio: .6 });
    cue(L, memory, () => memory.querySelectorAll('.tod').forEach((mark, i) => L.later(() => replay(mark, 'play'), 400 + i * 160)), { minRatio: .6 });
  }

  return {
    destroy() {
      L.end();
      memory.querySelectorAll('.tod.play').forEach(mark => mark.classList.remove('play'));
      final();
    },
  };
}
