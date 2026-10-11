/* A bounded Canvas2D host for the app's authored room and animal renderer. */
(function (global) {
  'use strict';
  const SCENES = Object.freeze({
    common: { default: true, label: '나의 작은 방' },
    forest: { study: 'forest-velvet', label: '숲빛 벨벳' },
    lake: { study: 'ultramarine-melon', label: '울트라마린 호수' },
    coast: { study: 'coral-tide', label: '산호빛 밀물' },
    garden: { study: 'pistachio-rose', label: '피스타치오와 장미' },
    winter: { study: 'snowberry-cabin', label: '스노베리 오두막' },
    space: { study: 'quiet-aurora', label: '조용한 오로라' },
    retro: { study: 'tangerine-olive', label: '탠저린 올리브' },
    cloud: { study: 'butter-cloud', label: '버터 구름집' },
    mineral: { study: 'amethyst-saffron', label: '자수정과 사프란' },
    seasonal: { view: 'cherry-path', label: '사계절 벚꽃 길', seasonal: true }
  });
  const CAT_COMMANDS = ['stand', 'sit', 'loaf', 'sleep', 'walk', 'trot', 'look', 'stretch', 'sniff', 'paw', 'hop', 'tilt', 'ear', 'shake', 'doze'];
  const DOG_COMMANDS = ['stand', 'sit', 'lie', 'sleep', 'walk', 'trot', 'wag', 'bow', 'sniff', 'tap', 'hop', 'tilt', 'ear', 'shake', 'doze'];
  const clamp = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;
  let shared = null;

  function assets(A) {
    if (shared) return shared;
    const original = A.buildDog('spotted', 'ref');
    const palette = { '#78756e': '#947050', '#eae6dd': '#f3e5ce' };
    const part = p => p ? { ...p, color: palette[p.color.toLowerCase()] || p.color,
      patches: p.patches.map(q => ({ ...q, color: palette[q.color.toLowerCase()] || q.color })) } : p;
    const set = p => ({ ...p, body: part(p.body), neck: part(p.neck), head: part(p.head), tail: part(p.tail),
      nose: part(p.nose), tongue: part(p.tongue), legs: p.legs.map(part), ears: p.ears?.map(part) });
    const dog = { ...original, sets: original.sets.map(set), rest: original.rest.map(poses =>
      Object.fromEntries(Object.entries(poses).map(([pose, p]) => [pose, { ...p, body: part(p.body), neck: part(p.neck), legs: p.legs.map(part) }]))) };
    shared = { sets: A.buildCatSets(), coats: A.buildCoat('blackBib'), dog };
    return shared;
  }

  function mount(canvas, initial) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('MARWorld.mount needs a canvas.');
    let opts = { scene: 'forest', animal: 'cat', tod: 0, season: 'spring', brightness: .65,
      lampColor: '#FFD49B', crop: 'room', paused: false, autonomous: false };
    const media = global.matchMedia('(prefers-reduced-motion: reduce)');
    let dead = false, failed = false, visible = true, frame = 0, dirty = true;
    let clock = 0, last = 0, lastDraw = -Infinity, room, events, lab, anchor, art, g, ctx, buffer, bufferCtx, bufferG;
    let displayTod = 0, fromTod = 0, transition = null, sceneCache = new Map();
    let movementRange, routineIndex = 0, nextRoutineAt = 4;
    const routine = ['look', 'walk', 'sit', 'stretch', 'sniff', 'lie', 'stand', 'trot', 'sit'];
    const stopped = () => opts.paused || media.matches;
    const status = (state, message, extra) => canvas.dispatchEvent(new CustomEvent('marworld:status', {
      bubbles: true, detail: { state, message, ...extra }
    }));
    function fail(error) {
      failed = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      console.error('MyAnimalRoom preview:', error);
      canvas.dataset.worldStatus = 'error';
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f6f0e7'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#695a4a'; ctx.font = `${Math.max(13, canvas.width / 30)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(canvas.ownerDocument.documentElement.lang === 'en' ? 'Room preview is unavailable.' : '방 미리보기를 불러오지 못했어요.', canvas.width / 2, canvas.height / 2);
      }
      status('error', String(error.message || error));
    }
    function schedule() {
      if (!dead && !failed && visible && !canvas.ownerDocument.hidden && !frame && (dirty || !stopped())) frame = requestAnimationFrame(tick);
    }
    function wake() { dirty = true; last = 0; schedule(); }
    function normalize(patch) {
      const next = { ...opts, ...patch };
      if (!SCENES[next.scene]) next.scene = 'common';
      next.zoom = clamp(next.zoom, 0);
      if (!['cat', 'dog', 'none'].includes(next.animal)) next.animal = 'cat';
      if (!['spring', 'summer', 'autumn', 'winter'].includes(next.season)) next.season = 'spring';
      if (!['room', 'landscape', 'animal'].includes(next.crop)) next.crop = 'room';
      next.tod = [0, 1, 2].includes(Number(next.tod)) ? Number(next.tod) : 0;
      next.brightness = clamp(next.brightness, .65);
      if (!/^#[0-9a-f]{6}$/i.test(next.lampColor)) next.lampColor = '#FFD49B';
      next.paused = !!next.paused;
      next.autonomous = !!next.autonomous;
      // The bundled public catalog has no authored outdoor view. Never describe
      // an indoor window crop as an outdoor scene in the returned state.
      delete next.place;
      return next;
    }
    function compose() {
      const A = global.DRAWN_APP, key = `${opts.scene}:${opts.season}`;
      if (!sceneCache.has(key)) {
        const scene = SCENES[opts.scene];
        let nextRoom;
        if (scene.default) {
          nextRoom = A.composeRoom(A.DEFAULT_SELECTION, { season: opts.season, lightOn: true });
        } else if (scene.view) {
          // Retain the app's stable default room and use the actual four-season
          // cherry-path drawing: blossoms, green leaves, autumn leaves, snow.
          const selection = { ...A.DEFAULT_SELECTION, view: { id: scene.view } };
          nextRoom = A.composeRoom(selection, { season: opts.season, lightOn: true });
        } else {
          const study = A.WORLD_PALETTE_STUDIES.find(s => s.id === scene.study);
          const prepared = A.preparePaletteStudy(study);
          nextRoom = prepared.compose(prepared.selection, { season: opts.season, lightOn: true });
        }
        sceneCache.set(key, { room: nextRoom, events: A.prepareEvents(nextRoom) });
        // One host retains at most three expensive authored geometry sets.
        if (sceneCache.size > 3) sceneCache.delete(sceneCache.keys().next().value);
      }
      ({ room, events } = sceneCache.get(key));
      anchor = room.anchors.find(a => a.id === 'floor') || room.anchors[0];
      // Locomotion visits both edges and returns to the middle. Keep that path
      // short enough for the complete dog silhouette and the animal crop.
      const center = A.ROOM.place.catX;
      movementRange = [Math.max(anchor.x[0] + 180, center - 90), Math.min(anchor.x[1] - 180, center + 90)];
      if (movementRange[0] >= movementRange[1]) movementRange = [center - 40, center + 40];
      A.setStage(lab, { ...anchor, x: movementRange });
      lab.ev = A.makeEventsState([16, 26], 917);
      lab.win = room.windowOpens ? 1 : 0;
      lab.S.x = A.CAT.origin.restX;
      lab.dog = A.makeDogState(A.ROOM.place.catX);
      A.command(lab, 'sit', true);
      A.dogCommand(lab.dog, 'sit', movementRange, true, art.dog);
      routineIndex = 0; nextRoutineAt = clock + 4;
    }
    function env(tod) {
      return { tod, season: opts.season, lightOn: opts.brightness > 0, tint: room.tint[tod],
        shadow: room.shadowBase, now: clock, windowOpen: room.windowOpens ? 1 : 0,
        gust: stopped() ? 0 : .2 + .12 * Math.sin(clock * .6), reduced: stopped(),
        lamp: { intensity: opts.brightness, color: opts.lampColor } };
    }
    function paint(target, context, tod, width, height, dpr) {
      const A = global.DRAWN_APP;
      target.begin(); context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
      // Bounds are in projected world coordinates, including the app's own camera.
      let box = { x0: 0, y0: 110, x1: 1080, y1: 1470 };
      if (opts.crop === 'landscape') {
        const b = room.openingBox;
        box = { x0: A.CAMERA.x + b.x0 * A.CAMERA.s - 32, y0: A.CAMERA.y + b.y0 * A.CAMERA.s - 32,
          x1: A.CAMERA.x + b.x1 * A.CAMERA.s + 32, y1: A.CAMERA.y + b.y1 * A.CAMERA.s + 32 };
      } else if (opts.crop === 'animal') {
        const x = A.CAMERA.x + A.ROOM.place.catX * A.CAMERA.s, y = A.CAMERA.y + anchor.y * A.CAMERA.s;
        box = { x0: x - 350, y0: y - 520, x1: x + 350, y1: y + 120 };
      }
      if (opts.zoom > 0 && opts.crop === 'room') {
        const b = room.openingBox, z = opts.zoom;
        const targetBox = { x0: A.CAMERA.x + b.x0 * A.CAMERA.s - 40, y0: A.CAMERA.y + b.y0 * A.CAMERA.s - 40,
          x1: A.CAMERA.x + b.x1 * A.CAMERA.s + 40, y1: A.CAMERA.y + b.y1 * A.CAMERA.s + 40 };
        Object.keys(box).forEach(key => { box[key] += (targetBox[key] - box[key]) * z; });
      }
      const scale = Math.max(width / (box.x1 - box.x0), height / (box.y1 - box.y0));
      const x = (width - (box.x1 - box.x0) * scale) / 2 - box.x0 * scale;
      const y = (height - (box.y1 - box.y0) * scale) / 2 - box.y0 * scale;
      target.save(); target.translate(x, y);
      A.drawFrame(target, { k: scale, room, todIdx: tod, env: env(tod),
        catTint: tod ? { c: tod === 1 ? A.CREATURE_TINT.dusk : A.CREATURE_TINT.night, a: A.CREATURE_TINT.a[tod - 1] } : null,
        events, dog: opts.animal === 'dog' ? art.dog : null, petVisible: opts.animal !== 'none',
        placement: { surfaceId: anchor.id, y: anchor.y, scale: 1,
          x: opts.animal === 'dog' ? lab.dog.x : A.ROOM.place.catX + (lab.S.x - A.CAT.origin.restX) * A.CREATURE_SCALE },
        contactSurfaceId: anchor.id, lift: 0 }, lab, art.sets, art.coats, A.CAT.coats.blackBib, clock);
      target.restore();
    }
    function tick(time) {
      frame = 0;
      if (dead || failed || !visible || canvas.ownerDocument.hidden) { last = 0; return; }
      if (!dirty && time - lastDraw < 1000 / 30) { schedule(); return; }
      try {
        const dt = last ? Math.min((time - last) / 1000, .06) : 0;
        last = time; lastDraw = time;
        if (!stopped()) {
          clock += dt;
          global.DRAWN_APP.step(lab, dt, clock, false, true);
          global.DRAWN_APP.stepDog(lab.dog, art.dog, dt, clock, false, true);
          global.DRAWN_APP.stepEvents(lab.ev, events, dt, clock, env(opts.tod), room.viewTags, true);
          if (opts.autonomous && opts.animal !== 'none' && clock >= nextRoutineAt) {
            const busy = opts.animal === 'dog' ? lab.dog.motion || lab.dog.pending || lab.dog.settling
              : lab.cur || lab.queue.length || lab.pendingCommand || lab.settling;
            if (!busy) command(routine[routineIndex++ % routine.length], true);
          }
        }
        const rect = canvas.getBoundingClientRect(), width = rect.width, height = rect.height;
        if (width > 0 && height > 0) {
          const dpr = Math.min(global.devicePixelRatio || 1, 2);
          const pw = Math.round(width * dpr), ph = Math.round(height * dpr);
          if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
          let progress = transition ? Math.min(1, (time - transition) / 650) : 1;
          if (stopped()) progress = 1;
          paint(g, ctx, displayTod, width, height, dpr);
          if (progress < 1) {
            if (buffer.width !== pw || buffer.height !== ph) { buffer.width = pw; buffer.height = ph; }
            paint(bufferG, bufferCtx, fromTod, width, height, dpr);
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - progress;
            ctx.drawImage(buffer, 0, 0); ctx.globalAlpha = 1;
          } else transition = null;
        }
        dirty = false;
        schedule();
      } catch (error) { fail(error); }
    }
    function set(patch) {
      if (dead || failed) return false;
      try {
        const next = normalize(patch || {}), recompose = next.scene !== opts.scene || next.season !== opts.season;
        if (next.tod !== opts.tod) { fromTod = displayTod; displayTod = next.tod; transition = stopped() || next.paused ? null : performance.now(); }
        opts = next;
        if (recompose) compose();
        if (patch && ('animal' in patch || 'autonomous' in patch)) nextRoutineAt = clock + 4;
        wake(); return true;
      } catch (error) { fail(error); return false; }
    }
    function command(action, automatic) {
      if (dead || failed || opts.animal === 'none') return false;
      const dog = opts.animal === 'dog';
      const mapped = dog ? ({ hello: 'wag', look: 'tilt', stretch: 'bow', paw: 'tap', loaf: 'lie' }[action] || action)
        : ({ hello: 'paw', wag: 'paw', bow: 'stretch', lie: 'loaf' }[action] || action);
      if (!(dog ? DOG_COMMANDS : CAT_COMMANDS).includes(mapped)) return false;
      try {
        if (dog) global.DRAWN_APP.dogCommand(lab.dog, mapped, movementRange, stopped(), art.dog);
        else global.DRAWN_APP.command(lab, mapped, stopped());
        nextRoutineAt = clock + (['sit', 'lie', 'loaf'].includes(mapped) ? 8 : 6);
        if (!automatic) { wake(); status('command', mapped, { animal: opts.animal, action: mapped }); }
        return true;
      } catch (error) { fail(error); return false; }
    }
    function event(id) {
      if (dead || failed || stopped()) return false;
      const available = events.filter(e => global.DRAWN_APP.eligible(e.when, env(opts.tod), room.viewTags));
      const chosen = id && id !== 'auto' ? available.find(e => e.id === id) : available.find(e => e.id !== lab.ev.last);
      if (!chosen) return false;
      global.DRAWN_APP.triggerEvent(lab.ev, events, chosen.id, .43);
      wake(); status('event', chosen.label, { id: chosen.id }); return true;
    }
    function visibility() { last = 0; if (canvas.ownerDocument.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake(); }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; last = 0;
      if (!visible) { cancelAnimationFrame(frame); frame = 0; } else wake();
    }, { threshold: 0 }) : null;
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(wake) : null;
    function destroy() {
      dead = true; cancelAnimationFrame(frame); frame = 0; observer?.disconnect(); resize?.disconnect();
      media.removeEventListener('change', wake); global.removeEventListener('resize', wake);
      canvas.ownerDocument.removeEventListener('visibilitychange', visibility); sceneCache.clear();
      buffer = bufferCtx = bufferG = g = art = lab = room = events = null;
    }
    const api = { set, command, event, pause: value => set({ paused: !!value }), destroy,
      get state() { return { ...opts, reducedMotion: media.matches, visible, failed }; },
      get events() { return events ? events.map(e => ({ id: e.id, label: e.label,
        available: !stopped() && global.DRAWN_APP.eligible(e.when, env(opts.tod), room.viewTags) })) : []; } };
    try {
      if (!global.DRAWN_APP || !global.DRAWN_SKIA) throw new Error('The authored room renderer has not loaded.');
      ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas2D is unavailable.');
      g = global.DRAWN_SKIA.canvasFor(ctx); art = assets(global.DRAWN_APP); lab = global.DRAWN_APP.makeLab();
      buffer = canvas.ownerDocument.createElement('canvas'); bufferCtx = buffer.getContext('2d'); bufferG = global.DRAWN_SKIA.canvasFor(bufferCtx);
      opts = normalize(initial || {}); displayTod = fromTod = opts.tod; compose();
      if (!opts.textureSource) observer?.observe(canvas);
      resize?.observe(canvas); media.addEventListener('change', wake);
      global.addEventListener('resize', wake); canvas.ownerDocument.addEventListener('visibilitychange', visibility);
      canvas.dataset.worldStatus = 'ready'; status('ready', SCENES[opts.scene].label); schedule();
    } catch (error) { fail(error); }
    return api;
  }
  global.MARWorld = Object.freeze({ mount, scenes: SCENES, commands: { cat: CAT_COMMANDS, dog: DOG_COMMANDS },
    capabilities: Object.freeze({ outdoor: false, seasons: ['spring', 'summer', 'autumn', 'winter'] }) });
})(window);
