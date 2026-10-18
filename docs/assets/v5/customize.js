(function () {
  'use strict';
  const captions = [
    MARCopy.text('편안한 기본 방에서 시작해요.'),
    MARCopy.text('튤립 조명을 골랐어요.'),
    MARCopy.text('꽃잎 의자와 꽃 모양 러그를 더해요.'),
    MARCopy.text('꽃의 온실, 나만의 방이 되었어요.')
  ];
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  const stateFor = progress => progress < .22 ? 0 : progress < .47 ? 1 : progress < .72 ? 2 : 3;
  function mount(root) {
    if (!root) return null;
    if (root.marCustomize) return root.marCustomize;
    const story = root.querySelector('.customize-story');
    const room = root.querySelector('.customize-room');
    const frames = Array.from(root.querySelectorAll('[data-customize-frame]'));
    const items = Array.from(root.querySelectorAll('[data-customize-item]'));
    const caption = root.querySelector('[data-customize-caption]');
    const number = root.querySelector('[data-customize-number]');
    if (!story || !room || frames.length !== 4 || !caption || !number) return null;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = matchMedia('(max-width: 760px)');
    let paused = reduce.matches, visible = false, state = 3, target = 3, progress = 1, queued = 0, dead = false;
    const listeners = [];
    function listen(host, name, fn, options) { host.addEventListener(name, fn, options); listeners.push(() => host.removeEventListener(name, fn, options)); }
    function commit(next, immediate) {
      if (dead || next !== target) return;
      if (immediate || paused || reduce.matches || !visible) root.classList.add('is-customize-paused');
      else root.classList.remove('is-customize-paused');
      frames.forEach((frame, index) => {
        frame.classList.toggle('is-visible', index <= next);
        frame.classList.toggle('is-current', index === next);
        frame.setAttribute('aria-hidden', String(index !== next));
      });
      items.forEach(item => item.classList.toggle('is-added', Number(item.dataset.customizeItem) <= next));
      caption.textContent = captions[next]; number.textContent = String(next + 1).padStart(2, '0');
      delete root.dataset.customizeUnavailable;
      root.dataset.customizeState = String(next); state = next;
    }
    function choose(next, immediate) {
      target = next;
      if (next === state) return;
      const image = frames[next];
      // Keep the preceding complete composition until the incoming PNG is decoded.
      if (image.complete && image.naturalWidth > 0) commit(next, immediate);
      else {
        image.loading = 'eager';
        image.decode().then(() => commit(next, immediate)).catch(error => {
          root.dataset.customizeUnavailable = 'true';
          console.warn('Room image could not be decoded:', image.src, error);
        });
      }
    }
    function seek(value, options) {
      progress = clamp(value);
      choose(reduce.matches ? 3 : stateFor(progress), !!options?.immediate);
      return stateFor(progress);
    }
    function update() {
      queued = 0;
      if (dead) return;
      const rect = story.getBoundingClientRect();
      const height = window.innerHeight || 1;
      if (mobile.matches) {
        const art = room.getBoundingClientRect();
        progress = clamp((height - art.top) / (height + art.height * .1));
      } else progress = clamp(-rect.top / Math.max(1, rect.height - height));
      choose(reduce.matches ? 3 : stateFor(progress), !visible || document.hidden);
    }
    function requestUpdate() { if (!queued && !dead) queued = requestAnimationFrame(update); }
    function pause(value) {
      paused = !!value; root.classList.toggle('is-customize-paused', paused);
      choose(reduce.matches ? 3 : target, true);
    }
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) frames.forEach(image => {image.loading = 'eager';});
      requestUpdate();
    }, {rootMargin: '600px 0px'});
    observer.observe(story);
    listen(window, 'scroll', requestUpdate, {passive: true});
    listen(window, 'resize', requestUpdate, {passive: true});
    listen(window, 'mar:motion', event => pause(!!event.detail?.paused));
    listen(document, 'visibilitychange', () => {
      if (document.hidden) {cancelAnimationFrame(queued); queued = 0; choose(target, true);}
      else requestUpdate();
    });
    listen(reduce, 'change', () => {pause(reduce.matches); requestUpdate();});
    listen(mobile, 'change', requestUpdate);
    frames.forEach((frame, index) => {
      frame.classList.add('is-visible');
      frame.classList.toggle('is-current', index === 3);
      frame.setAttribute('aria-hidden', String(index !== 3));
    });
    root.classList.add('is-customize-ready');
    commit(3, true);
    const controller = {
      seek, update, pause,
      get state() {return state;},
      get progress() {return progress;},
      destroy() {
        dead = true; observer.disconnect(); cancelAnimationFrame(queued); listeners.forEach(remove => remove());
        root.classList.remove('is-customize-ready', 'is-customize-paused');
        frames.forEach((frame, index) => {frame.classList.remove('is-current', 'is-visible'); frame.setAttribute('aria-hidden', String(index !== 3));});
        caption.textContent = captions[3]; number.textContent = '04'; delete root.marCustomize;
      }
    };
    root.marCustomize = controller;
    update();
    return controller;
  }
  window.MARCustomize = {mount};
})();
