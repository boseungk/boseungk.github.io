/* Page-owned motion control, task phase drawings, closing landscape and statistics. */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => {value = clamp(value); return value * value * (3 - 2 * value);};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hosts = [];
  let paused = reduced.matches, clock = 0, last = 0, raf = 0, dirty = true;
  let scrollQueued = 0, chartProgress = 0;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = hosts.find(host => host.canvas === entry.target);
      if (item) item.visible = entry.isIntersecting;
    }
    dirty = true; schedule();
  }, {rootMargin: '150px'});
  function host(canvas, draw) {
    hosts.push({canvas, draw, visible: false}); observer.observe(canvas);
  }
  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {canvas.width = width; canvas.height = height;}
    return {width, height};
  }
  $$('[data-landscape]').forEach(canvas => host(canvas, (ctx, size) => {
    ctx.fillStyle = '#d6dfd8'; ctx.fillRect(0, 0, size.width, size.height);
    MARLandscape.draw(ctx, {...size, scene: canvas.dataset.landscape, tod: Number(canvas.dataset.tod), time: clock, reduced: paused, fit: 'cover'});
    canvas.parentElement.classList.add('ready');
  }));
  $$('[data-phase]').forEach(canvas => host(canvas, (ctx, size) => {
    ctx.clearRect(0, 0, size.width, size.height);
    MARLandscape.drawTimeMark(ctx, {...size, phase: canvas.dataset.phase, time: paused ? 950 : (clock * 1000) % 12000});
  }));
  function paint(now) {
    raf = 0;
    if (document.hidden) return;
    if (!dirty && now - last < 1000 / 30) {schedule(); return;}
    const dt = last ? Math.max(0, Math.min((now - last) / 1000, .06)) : .034;
    last = now;
    if (!paused) clock += dt;
    for (const item of hosts) {
      if (!item.visible && !dirty) continue;
      const size = fitCanvas(item.canvas);
      if (size.width > 1 && size.height > 1) item.draw(item.canvas.getContext('2d'), size);
    }
    dirty = false;
    if (!paused && hosts.some(item => item.visible)) schedule();
  }
  function schedule() {if (!raf && !document.hidden) raf = requestAnimationFrame(paint);}
  function scrollUpdate() {
    scrollQueued = 0;
    const rect = $('.statistics-panel').getBoundingClientRect();
    chartProgress = Math.max(chartProgress, paused ? 1 : smooth((innerHeight - rect.top) / (innerHeight * .65)));
    $('.week-chart').style.setProperty('--chart-progress', chartProgress);
    $('#stats-total').textContent = MARCopy.duration(Math.round(220 * chartProgress));
  }
  function setPaused(value) {
    paused = value; document.body.classList.toggle('motion-on', !paused);
    const button = $('#motion-toggle');
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? MARCopy.text('움직임 재생') : MARCopy.text('움직임 멈추기'));
    button.innerHTML = paused
      ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 3 10 7-10 7Z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4v12M14 4v12" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    dispatchEvent(new CustomEvent('mar:motion', {detail: {paused}}));
    last = 0; dirty = true; scrollUpdate(); schedule();
  }
  $('#motion-toggle').addEventListener('click', () => setPaused(!paused));
  reduced.addEventListener('change', event => setPaused(event.matches));
  addEventListener('scroll', () => {if (!scrollQueued) scrollQueued = requestAnimationFrame(scrollUpdate);}, {passive: true});
  addEventListener('resize', () => {dirty = true; scrollUpdate(); schedule();});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {cancelAnimationFrame(raf); raf = 0;}
    else {last = 0; dirty = true; schedule();}
  });
  window.MARCustomizeController = MARCustomize.mount($('#decorate'));
  window.MARJourneyController = MARJourney.mount($('#routine'));
  setPaused(paused);
  document.fonts.ready.then(() => {dirty = true; scrollUpdate(); schedule();});
})();
