/* A self-running day in each room. Pointer position never changes time or playback. */
(function () {
  'use strict';
  const root = document.querySelector('.room-carousel');
  if (!root) return;
  const reel = root.querySelector('.room-reel');
  const cards = [...root.querySelectorAll('.room-print')];
  const pauseButton = root.querySelector('[data-room-pause]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => {value = clamp(value); return value * value * (3 - 2 * value);};
  let index = 0, elapsed = 0, manualPause = false, globalPause = false;
  let visible = false, raf = 0, last = null;

  // Each room owns its companion, so switching rooms cannot teleport one canvas.
  const companions = cards.map(card => {
    const pet = window.MARPet ? MARPet('cat') : null;
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 720;
    canvas.className = 'room-companion'; canvas.setAttribute('aria-hidden', 'true');
    const scale = Number(card.dataset.petScale) / (320 / 870);
    canvas.style.width = (320 * scale / 780 * 100) + '%';
    canvas.style.height = (360 * scale / 1280 * 100) + '%';
    canvas.style.left = ((Number(card.dataset.petX) - 160 * scale) / 780 * 100) + '%';
    canvas.style.top = ((Number(card.dataset.petY) - 324 * scale) / 1280 * 100) + '%';
    card.querySelector('.room-print-art').append(canvas);
    return {pet, canvas, ctx: canvas.getContext('2d'), time: 0, pose: 'sit'};
  });
  const stopped = () => manualPause || globalPause || reduce.matches;
  function updateControl() {
    const paused = stopped();
    root.dataset.roomPaused = String(paused);
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? MARCopy.text('장면 재생') : MARCopy.text('장면 멈춤');
    // OS and page-wide pause remain authoritative; this button is a local pause.
    pauseButton.disabled = globalPause || reduce.matches;
    if (pauseButton.disabled) pauseButton.textContent = MARCopy.text('움직임 정지됨');
  }
  function renderPositions() {
    cards.forEach((card, i) => {
      let distance = (i - index + cards.length) % cards.length;
      if (distance > 4) distance -= cards.length;
      const active = distance === 0;
      card.style.transform = `translateX(calc(-50% + ${distance * 102}%)) translateY(${active ? 0 : 22}px) scale(${active ? 1 : .80})`;
      card.style.opacity = Math.abs(distance) <= 1 ? '1' : '0';
      card.style.zIndex = active ? '3' : '1';
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-hidden', String(!active));
    });
    root.dataset.roomIndex = String(index);
  }
  function drawTime(seconds) {
    // Day 0–2.5s, sunset transition 2.5–4s and hold to 6.2s,
    // night transition 6.2–7.7s, lamps 7.7–8.5s, night hold to 12s.
    const dusk = smooth((seconds - 2.5) / 1.5);
    const night = smooth((seconds - 6.2) / 1.5);
    const lamp = smooth((seconds - 7.7) / .8);
    const card = cards[index], companion = companions[index];
    card.style.setProperty('--room-dusk', dusk);
    card.style.setProperty('--room-night', night);
    card.style.setProperty('--lamp-light', lamp);
    companion.canvas.style.filter = `brightness(${1 - dusk * .06 - night * .21})`;
    root.dataset.roomTime = (dusk + night).toFixed(2);
    root.dataset.roomPhase = night > .5 ? 'night' : dusk > .5 ? 'dusk' : 'day';
    const pose = night > .65 ? 'loaf' : 'sit';
    if (companion.pet && pose !== companion.pose) {
      companion.pose = pose; companion.pet.command(pose, stopped());
    }
  }
  function drawCompanion(companion, dt) {
    if (!companion.pet) return;
    if (!stopped()) companion.time += dt;
    companion.ctx.clearRect(0, 0, 640, 720);
    companion.pet.draw(companion.ctx, {width: 640, height: 720, time: companion.time,
      dt, reduced: stopped(), autonomous: false});
  }
  function ready(card) {
    return [...card.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0);
  }
  function advance(step, announce = true) {
    const next = (index + step + cards.length) % cards.length;
    if (!ready(cards[next])) return;
    index = next; elapsed = 0;
    drawTime(0); renderPositions(); drawCompanion(companions[index], 0);
    if (announce) root.querySelector('.room-announcement').textContent = cards[index].querySelector('figcaption span').textContent;
  }
  function tick(now) {
    raf = 0;
    if (!visible || document.hidden || stopped()) {last = null; return;}
    if (!ready(cards[index])) {last = null; schedule(); return;}
    const dt = last === null ? 0 : Math.max(0, (now - last) / 1000);
    last = now;
    elapsed += dt;
    if (elapsed >= 12 && ready(cards[(index + 1) % cards.length])) advance(1, false);
    else drawTime(elapsed);
    drawCompanion(companions[index], Math.min(dt, .06));
    schedule();
  }
  function schedule() {
    if (!visible || document.hidden || stopped()) {
      cancelAnimationFrame(raf); raf = 0; last = null; return;
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  root.querySelector('[data-room-prev]').addEventListener('click', () => advance(-1));
  root.querySelector('[data-room-next]').addEventListener('click', () => advance(1));
  pauseButton.addEventListener('click', () => {
    manualPause = !manualPause; updateControl(); schedule();
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); advance(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) cards.forEach(card => card.querySelectorAll('img').forEach(image => {image.loading = 'eager';}));
    schedule();
  }, {threshold: .35}).observe(reel);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('mar:motion', event => {
    globalPause = !!event.detail?.paused; updateControl(); schedule();
  });
  reduce.addEventListener('change', () => {updateControl(); schedule();});
  renderPositions(); drawTime(0);
  companions.forEach(companion => drawCompanion(companion, 0));
  updateControl();
})();
