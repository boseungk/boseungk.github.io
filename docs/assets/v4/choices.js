/* Native LiquidChoiceBackdrop path and spring, following the automatic journey. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const stopped = () => reduce.matches || !document.body.classList.contains('motion-on');
  const ns = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('.journey-flow').forEach(group => {
    const steps = [...group.querySelectorAll('[data-journey-step]')];
    const svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
    svg.classList.add('choice-wash');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    path.setAttribute('fill', '#EFE3DD'); svg.append(path); group.prepend(svg);
    let current = null, target = null, velocity = [0, 0, 0, 0], raf = 0, last = 0;
    function paint() {
      if (!current) return;
      const [x, y, w, h] = current, p = (a, b) => `${x + w * a} ${y + h * b}`;
      path.setAttribute('d', `M${p(.16,.08)}C${p(.35,.02)} ${p(.73,.04)} ${p(.88,.12)}C${p(1,.2)} ${p(1,.7)} ${p(.89,.87)}C${p(.74,1)} ${p(.33,.98)} ${p(.13,.89)}C${p(0,.81)} ${p(0,.31)} ${p(.08,.18)}Q${p(.11,.1)} ${p(.16,.08)}Z`);
    }
    function settle() {
      cancelAnimationFrame(raf); raf = 0; current = [...target]; velocity.fill(0); paint();
    }
    function tick(now) {
      raf = 0;
      const dt = Math.min((now - last) / 1000 || 1 / 60, 1 / 30); last = now;
      for (let step = 0; step < 4; step++) for (let i = 0; i < 4; i++) {
        velocity[i] += (484 * (target[i] - current[i]) - 36.52 * velocity[i]) * dt / 4;
        current[i] += velocity[i] * dt / 4;
      }
      if (stopped() || document.hidden || current.every((v, i) => Math.abs(target[i] - v) < .05 && Math.abs(velocity[i]) < .05)) settle();
      else {paint(); raf = requestAnimationFrame(tick);}
    }
    function update() {
      const selected = steps.find(step => step.dataset.current === 'true');
      svg.style.opacity = selected ? '1' : '0';
      if (!selected) {cancelAnimationFrame(raf); raf = 0; current = target = null; return;}
      const base = group.getBoundingClientRect(), r = selected.getBoundingClientRect();
      const next = [r.left - base.left, r.top - base.top, r.width, r.height];
      if (!current || stopped() || document.hidden) {target = next; settle(); return;}
      if (target && next.every((v, i) => Math.abs(v - target[i]) < .01)) return;
      target = next;
      if (!raf) {last = performance.now(); raf = requestAnimationFrame(tick);}
    }
    new MutationObserver(update).observe(group, {subtree: true, attributes: true, attributeFilter: ['data-current']});
    new ResizeObserver(update).observe(group);
    document.fonts.ready.then(update);
    addEventListener('mar:motion', update); reduce.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
  });
})();
