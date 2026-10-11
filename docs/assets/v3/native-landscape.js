/* eslint-disable */
// 생성 파일: node scripts/build-drawn-web.mjs (npm run drawn:bench). 고치지 마세요. 원본은 src/world/drawn · drawn-lab 이에요.
(function () {
  'use strict';
  var __DEV__ = true;
  var defs = {
"../../Documents/Codex/2026-10-08/claude-startup-program-claim/work/native-export-v3/entry.js": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawTimeMark = exports.drawHourglass = exports.scenes = exports.furniture = void 0;
exports.draw = draw;
exports.drawFurniture = drawFurniture;
const scenery_1 = require("@/world/drawn/room/collections/scenery");
const react_native_skia_1 = require("@shopify/react-native-skia");
const world_imaginative_views_1 = require("@/world/drawn/room/studies/world-imaginative-views");
const objects_1 = require("@/world/drawn/room/collections/objects");
const cache = new Map();
exports.furniture = objects_1.COLLECTION_OBJECTS.map(d => ({ id: d.id, label: d.label, bounds: d.previewBox }));
exports.scenes = [...scenery_1.COLLECTION_SCENERY_KINDS, 'study-pink-muhly'];
function draw(ctx, { scene = 'collection-cloud-orchard', tod = 0, time = 0, reduced = false, width = ctx.canvas.width, height = ctx.canvas.height, fit = 'cover', framing = 'outdoor', sourceAspect = 1 } = {}) {
    if (!exports.scenes.includes(scene))
        throw new Error('Unknown native scenery ' + scene);
    if (sourceAspect !== 1 && scene !== 'study-pink-muhly')
        throw new Error('Collection scenery has fixed square geometry; sourceAspect applies only to pink-muhly');
    const key = scene + ':' + framing + ':' + sourceAspect;
    let c = cache.get(key);
    if (!c) {
        const def = scene === 'study-pink-muhly' ? (0, world_imaginative_views_1.makeImaginativeView)('pink-muhly', '#B8D7D2', '#DCA4B4', '#A84660', { bounds: { x0: 0, y0: 0, x1: 1000 * sourceAspect, y1: 1000 }, sun: [.66, .25], horizon: .59 }) : (0, scenery_1.makeCollectionScenery)(scene, framing, { x0: 0, y0: 0, x1: 1000 * sourceAspect, y1: 1000 });
        c = { def, built: def.build(Object.values(def.variants)[0].palette) };
        cache.set(key, c);
    }
    const g = (0, react_native_skia_1.canvasFor)(ctx), e = { tod: Math.max(0, Math.min(2, tod)), season: 'summer', lightOn: false, tint: '#FFFFFF', shadow: '#718B65', now: time, reduced, windowOpen: 1, gust: 0 };
    ctx.save();
    const scale = fit === 'native' ? height / 1000 : fit === 'contain' ? Math.min(width / (1000 * sourceAspect), height / 1000) : Math.max(width / (1000 * sourceAspect), height / 1000);
    ctx.translate((width - 1000 * sourceAspect * scale) / 2, (height - 1000 * scale) / 2);
    ctx.scale(scale, scale);
    c.def.back(g, c.built, e);
    c.def.frame(g, c.built, e);
    ctx.restore();
}
function drawFurniture(ctx, { id, tod = 0, time = 0, reduced = false, width = ctx.canvas.width, height = ctx.canvas.height } = {}) {
    const d = objects_1.COLLECTION_OBJECTS.find(x => x.id === id);
    if (!d)
        throw new Error('Unknown native furniture ' + id);
    let c = cache.get(id);
    if (!c) {
        const palette = Object.values(d.variants)[0].palette;
        c = { built: d.build(palette) };
        cache.set(id, c);
    }
    const b = d.previewBox, k = Math.min(width / (b.x1 - b.x0), height / (b.y1 - b.y0)) * .94;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(k, k);
    ctx.translate(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
    const g = (0, react_native_skia_1.canvasFor)(ctx), e = { tod, season: 'summer', lightOn: false, tint: '#FFFFFF', shadow: '#718B65', now: time, reduced, windowOpen: 1, gust: 0 };
    d.back?.(g, c.built, e);
    d.frame?.(g, c.built, e);
    d.front?.(g, c.built, e);
    ctx.restore();
}
var native_glyphs_js_1 = require("./native-glyphs.js");
Object.defineProperty(exports, "drawHourglass", { enumerable: true, get: function () { return native_glyphs_js_1.drawHourglass; } });
Object.defineProperty(exports, "drawTimeMark", { enumerable: true, get: function () { return native_glyphs_js_1.drawTimeMark; } });

}, {"@/world/drawn/room/collections/scenery":"src/world/drawn/room/collections/scenery.ts","@shopify/react-native-skia":"design/prototype-editorial/lab/drawn-web/skia-canvas2d.js","@/world/drawn/room/studies/world-imaginative-views":"src/world/drawn/room/studies/world-imaginative-views.ts","@/world/drawn/room/collections/objects":"src/world/drawn/room/collections/objects.ts","./native-glyphs.js":"../../Documents/Codex/2026-10-08/claude-startup-program-claim/work/native-export-v3/native-glyphs.js"}],
"../../Documents/Codex/2026-10-08/claude-startup-program-claim/work/native-export-v3/native-glyphs.js": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawHourglass = drawHourglass;
exports.drawTimeMark = drawTimeMark;
const hourglass_liquid_geometry_1 = require("@/shared/drawing/hourglass-liquid-geometry");
const focus_hourglass_color_flow_1 = require("@/shared/ui/focus-hourglass-color-flow");
const focus_hourglass_palettes_1 = require("@/shared/ui/focus-hourglass-palettes");
const sky_motion_1 = require("@/shared/ui/sky-motion");
const vessel = 'M40 24 H120 C120 45 111 59 94 73 C86 79 83 83 83 91 C83 99 87 103 95 109 C111 122 120 137 120 158 H40 C40 137 49 122 65 109 C73 103 77 99 77 91 C77 83 74 79 66 73 C49 59 40 45 40 24Z';
function drawHourglass(ctx, { width = ctx.canvas.width, height = ctx.canvas.height, progress = 0, time = 1.8, paletteId = 'dawn', restingFill, initialFill, flipProgress, angle = 0 } = {}) {
    const pal = (0, focus_hourglass_palettes_1.resolveFocusHourglassPalette)(paletteId), liquid = (0, hourglass_liquid_geometry_1.getHourglassLiquidGeometry)({ progress, restingFill, initialFill, flipProgress }), k = Math.min(width / 112, height / 166), path = new Path2D(vessel);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(k, k);
    ctx.translate(-80, -91);
    ctx.fillStyle = 'rgba(255,253,247,.3)';
    ctx.fill(path);
    ctx.strokeStyle = 'rgba(187,170,146,.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke(path);
    ctx.save();
    ctx.clip(path);
    const mask = new Path2D();
    if (liquid.enabled[0])
        mask.rect(38, liquid.levels[0], 84, Math.max(0, 92 - liquid.levels[0]));
    if (liquid.enabled[1])
        mask.rect(38, liquid.levels[1], 84, Math.max(0, liquid.lowerEnd - liquid.levels[1]));
    ctx.clip(mask);
    // Native shader samples color at R(angle) * vessel coordinates. Paint the
    // color field with the inverse transform so the launch rotation leaves it level.
    ctx.translate(80, 91);
    ctx.rotate(-angle * Math.PI / 180);
    ctx.translate(-80, -91);
    const base = ctx.createLinearGradient(42, 45, 121, 155);
    pal.base.forEach((c, i) => base.addColorStop(i / 2, c));
    ctx.fillStyle = base;
    ctx.fillRect(-128, -128, 416, 438);
    for (let chamber = 0; chamber < 2; chamber++)
        for (let i = 0; i < 4; i++) {
            const c = (0, focus_hourglass_color_flow_1.getHourglassColorCloud)(i, chamber, time / 8.5);
            ctx.save();
            ctx.translate(c.cx, c.cy);
            ctx.scale(c.rx, c.ry);
            const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
            pool.addColorStop(0, pal.colors[i] + 'bb');
            pool.addColorStop(.34, pal.colors[i] + '99');
            pool.addColorStop(.68, pal.colors[i] + '40');
            pool.addColorStop(1, pal.colors[i] + '00');
            ctx.fillStyle = pool;
            ctx.fillRect(-1, -1, 2, 2);
            ctx.restore();
        }
    ctx.restore();
    ctx.fillStyle = '#D5BB94';
    for (const y of [15, 158]) {
        ctx.beginPath();
        ctx.roundRect(31, y, 98, 10, 5);
        ctx.fill();
    }
    ctx.restore();
}
const color = { morning: '#FBA83C', day: '#F6B92B', evening: '#F37F57', moon: '#56659E', full: '#EFC766', crater: '#DDAE45', ink: '#2F3752', star: '#2F3752' };
function drawTimeMark(ctx, { width = ctx.canvas.width, height = ctx.canvas.height, phase = 'daytime', time = 950 } = {}) {
    ctx.save();
    ctx.scale(width / 48, height / 48);
    const circle = (x, y, r, c) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); };
    const line = (x, y, x2, y2, c, w) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); };
    const part = (kind, x, y, index, fn, angle = 0) => { const p = (0, sky_motion_1.skyPartPose)(kind, time, index); let dx = p.x, dy = p.y; if (kind === 'morningRay') {
        dx = p.x * Math.cos(angle * Math.PI / 180);
        dy = p.x * Math.sin(angle * Math.PI / 180);
    } ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(p.rotate * Math.PI / 180); ctx.scale(p.sx, p.sy); ctx.translate(-x, -y); fn(); ctx.restore(); };
    const rays = (morning) => { for (const a of morning ? [-90, -135, -45, -170, -10] : [0, 45, 90, 135, 180, 225, 270, 315]) {
        const r = a * Math.PI / 180, y = morning ? 35 : 24, inner = morning ? 17.5 : 15.5, outer = morning ? 22 : 20;
        const fn = () => line(24 + inner * Math.cos(r), y + inner * Math.sin(r), 24 + outer * Math.cos(r), y + outer * Math.sin(r), morning ? color.morning : color.day, 3.8);
        if (morning)
            part('morningRay', 0, 0, Math.round(Math.abs(a + 90) / 45), fn, a);
        else
            fn();
    } };
    const star = (x, y, r) => { ctx.fillStyle = color.star; ctx.fill(new Path2D(`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`)); };
    if (phase === 'morning') {
        rays(true);
        ctx.save();
        ctx.beginPath();
        ctx.rect(-4, -4, 56, 39);
        ctx.clip();
        circle(24, 35, 13, color.morning);
        ctx.restore();
    }
    if (phase === 'daytime') {
        part('dayRays', 24, 24, 0, () => rays(false));
        part('sun', 24, 24, 0, () => circle(24, 24, 10.5, color.day));
    }
    if (phase === 'night') {
        part('moon', 22.5, 25, 0, () => { circle(22.5, 25, 13.5, color.full); for (const [x, y, r] of [[-4.7, -4.6, 2.9], [4.1, 2.2, 3.7], [-3.7, 6.2, 1.8]])
            circle(22.5 + x, 25 + y, r, color.crater); });
        part('cloud', 0, 0, 0, () => { for (const [x, y, r] of [[22, 36.5, 5.2], [29.5, 32.5, 7.4], [37.5, 36, 5.6]])
            circle(x, y, r, color.ink); ctx.beginPath(); ctx.roundRect(17, 36, 26, 5.6, 2.8); ctx.fill(); });
        part('star', 39.5, 10.5, 0, () => star(39.5, 10.5, 5.4));
        part('star', 43, 24, 1, () => star(43, 24, 2.8));
    }
    if (phase === 'evening') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-4, -4, 56, 40);
        ctx.clip();
        circle(19, 38, 14.5, color.evening);
        ctx.restore();
        part('crescent', 36, 13.5, 0, () => { const cut = new Path2D(); cut.rect(-50, -50, 150, 150); cut.arc(39.4, 10.4, 7.6, 0, Math.PI * 2); ctx.save(); ctx.clip(cut, 'evenodd'); circle(36, 13.5, 8.2, color.moon); ctx.restore(); });
        [[40.5, 16], [44.2, 10], [47.6, 4.6]].forEach(([y, w], i) => part('glint', 19, y, i, () => { ctx.globalAlpha = .5; line(19 - w / 2, y, 19 + w / 2, y, color.evening, 2.4); }));
    }
    if (phase === 'anytime')
        line(16, 24, 32, 24, '#776B66', 3);
    ctx.restore();
}

}, {"@/shared/drawing/hourglass-liquid-geometry":"src/shared/drawing/hourglass-liquid-geometry.ts","@/shared/ui/focus-hourglass-color-flow":"src/shared/ui/focus-hourglass-color-flow.ts","@/shared/ui/focus-hourglass-palettes":"src/shared/ui/focus-hourglass-palettes.ts","@/shared/ui/sky-motion":"src/shared/ui/sky-motion.ts"}],
"src/shared/ui/sky-motion.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skyEasing = void 0;
exports.portion = portion;
exports.swell = swell;
exports.skyPartPose = skyPartPose;
const cubic_bezier_1 = require("./cubic-bezier");
exports.skyEasing = {
    warm: [.2, .7, .25, 1],
    swell: [.3, .6, .4, 1],
    return: [.4, 0, .6, 1],
};
function curveValue(name, value) {
    'worklet';
    return (0, cubic_bezier_1.cubicBezierAt)(value, exports.skyEasing[name]);
}
function portion(time, duration, delay = 0) {
    'worklet';
    return Math.min(1, Math.max(0, (time - delay) / duration));
}
function swell(time, duration, delay = 0, peak = .4) {
    'worklet';
    const p = portion(time, duration, delay);
    return p < peak ? curveValue('swell', p / peak) : 1 - curveValue('return', (p - peak) / (1 - peak));
}
/** Authored sky.mjs timing, in its original 48/64-unit coordinates. */
function skyPartPose(kind, time, index = 0, direction = 1) {
    'worklet';
    let x = 0, y = 0, rotate = 0, sx = 1, sy = 1;
    if (kind === 'morningRay')
        x = 2.6 * swell(time, 460, index * 70);
    if (kind === 'dayRays')
        rotate = 45 * curveValue('warm', portion(time, 640));
    if (kind === 'sun')
        sx = sy = 1 + .06 * swell(time, 520);
    if (kind === 'crescent')
        rotate = -18 * swell(time, 620);
    if (kind === 'glint')
        sx = 1 - .55 * swell(time, 480, 60 + index * 80);
    if (kind === 'moon')
        rotate = -12 * swell(time, 640);
    if (kind === 'cloud')
        x = 2.5 * swell(time, 640, 60);
    if (kind === 'star' || kind === 'cardStar') {
        const p = portion(time, kind === 'star' ? 520 : 480, kind === 'star' ? 140 + index * 110 : 160 + index * 90);
        rotate = 90 * curveValue('swell', p);
        sx = sy = 1 + (kind === 'star' ? .35 : .5) * swell(time, kind === 'star' ? 520 : 480, kind === 'star' ? 140 + index * 110 : 160 + index * 90, .5);
    }
    if (kind === 'halo')
        sx = sy = 1 + .2 * swell(time, 680, 0, .35);
    if (kind === 'wisp')
        x = direction * 3 * swell(time, 760, index * 90);
    if (kind === 'cardGlint')
        sx = 1 - .55 * swell(time, 480, 120 + index * 80);
    return { x, y, rotate, sx, sy };
}

}, {"./cubic-bezier":"src/shared/ui/cubic-bezier.ts"}],
"src/shared/ui/cubic-bezier.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cubicBezierAt = cubicBezierAt;
/** Sample an authored CSS curve on either JS or UI thread, without creating easing closures per frame. */
function cubicBezierAt(value, curve) {
    'worklet';
    if (value <= 0)
        return 0;
    if (value >= 1)
        return 1;
    const [x1, y1, x2, y2] = curve;
    const ax = 1 - 3 * x2 + 3 * x1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
    let t = value, low = 0, high = 1;
    for (let i = 0; i < 16; i++) {
        const x = ((ax * t + bx) * t + cx) * t, delta = x - value;
        if (Math.abs(delta) < 1e-7)
            break;
        if (delta < 0)
            low = t;
        else
            high = t;
        const derivative = (3 * ax * t + 2 * bx) * t + cx;
        const candidate = derivative > 1e-7 ? t - delta / derivative : NaN;
        t = candidate > low && candidate < high ? candidate : (low + high) / 2;
    }
    return ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
}

}, {}],
"src/shared/ui/focus-hourglass-palettes.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.focusHourglassPaletteIds = exports.DEFAULT_FOCUS_HOURGLASS_PALETTE_ID = exports.focusHourglassPalettes = void 0;
exports.canonicalFocusHourglassPaletteId = canonicalFocusHourglassPaletteId;
exports.resolveFocusHourglassPalette = resolveFocusHourglassPalette;
// Shared by Decor previews, Focus and durable palette-id validation.
exports.focusHourglassPalettes = {
    dawn: {
        id: 'dawn', label: '새벽빛',
        colors: ['#8DA9DA', '#B7A3D2', '#E5B1C7', '#F2DEBB'],
        base: ['#D6DEEB', '#DDD7E5', '#EBDDD2'],
    },
    apricot: {
        id: 'apricot', label: '살구 노을',
        colors: ['#E6B17B', '#DB968E', '#E7C371', '#EEC1AA'],
        base: ['#E9D1B6', '#E4BFB0', '#EFDCB9'],
    },
    lilac: {
        id: 'lilac', label: '라일락 안개',
        colors: ['#8C9ED5', '#A487CA', '#C7A6CE', '#DED7ED'],
        base: ['#D2D4E7', '#CEBEDD', '#DAD3E6'],
    },
    sea: {
        id: 'sea', label: '물빛 유리',
        colors: ['#74A8BD', '#96BCD8', '#A3C9BE', '#E5DAB9'],
        base: ['#CCDDE1', '#BAD6D7', '#D8DFCF'],
    },
    rose: {
        id: 'rose', label: '로즈티',
        colors: ['#CB91A8', '#B891B3', '#E6CCAD', '#E8BAC6'],
        base: ['#E6D0D4', '#DAC1CE', '#E7D6CC'],
    },
    prism: {
        id: 'prism', label: '프리즘',
        colors: ['#6C92D9', '#DA8EBF', '#ECC279', '#AC9CDA'],
        base: ['#D3CEDF', '#D9C3D3', '#E6D5BA'],
    },
};
exports.DEFAULT_FOCUS_HOURGLASS_PALETTE_ID = 'dawn';
exports.focusHourglassPaletteIds = Object.keys(exports.focusHourglassPalettes);
// Decode previous saved choices without rewriting the user's database.
const legacyPaletteIds = {
    celadon: 'sea', opal: 'dawn', champagne: 'apricot',
};
function canonicalFocusHourglassPaletteId(id) {
    if (Object.hasOwn(exports.focusHourglassPalettes, id))
        return id;
    return Object.hasOwn(legacyPaletteIds, id) ? legacyPaletteIds[id] : undefined;
}
function resolveFocusHourglassPalette(id) {
    return exports.focusHourglassPalettes[canonicalFocusHourglassPaletteId(id ?? '') ?? exports.DEFAULT_FOCUS_HOURGLASS_PALETTE_ID];
}

}, {}],
"src/shared/ui/focus-hourglass-color-flow.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOURGLASS_COLOR_PREVIEW_PHASE = exports.HOURGLASS_COLOR_CYCLE_MS = void 0;
exports.getHourglassColorCloud = getHourglassColorCloud;
exports.HOURGLASS_COLOR_CYCLE_MS = 8500;
exports.HOURGLASS_COLOR_PREVIEW_PHASE = 1800 / exports.HOURGLASS_COLOR_CYCLE_MS;
/** Periodic color currents, independent of elapsed Focus time and droplet phase. */
function getHourglassColorCloud(index, chamber, phase) {
    'worklet';
    const angle = phase * Math.PI * 2 + index * Math.PI / 2 + chamber * 1.1;
    return {
        cx: 80 + 33 * Math.sin(angle),
        cy: (chamber ? 146 : 66) + (chamber ? 14 : 23) * Math.cos(angle * (index % 2 ? 1 : 2) + index),
        rx: 35 + index * 2,
        ry: chamber ? 27 : 39,
    };
}

}, {}],
"src/shared/drawing/hourglass-liquid-geometry.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hourglassRestingArea = hourglassRestingArea;
exports.hourglassRunningArea = hourglassRunningArea;
exports.hourglassTopSurfaceY = hourglassTopSurfaceY;
exports.hourglassBottomSurfaceY = hourglassBottomSurfaceY;
exports.getHourglassLiquidGeometry = getHourglassLiquidGeometry;
/** Approved focus-prep-sand.mjs geometry, sampled once before any UI worklet runs. */
const NECK_Y = 91;
const CHAMBER_DEPTH = 67;
const AREA_STEP = .25;
const TOP_EDGE = [
    [[83, 91], [83, 83], [86, 79], [94, 73]],
    [[94, 73], [111, 59], [120, 45], [120, 24]],
];
const BOTTOM_EDGE = [
    [[83, 91], [83, 99], [87, 103], [95, 109]],
    [[95, 109], [111, 122], [120, 137], [120, 158]],
];
function lerp(from, to, t) {
    'worklet';
    return from + (to - from) * t;
}
function clamp(value, low, high) {
    'worklet';
    return Math.min(high, Math.max(low, value));
}
function smooth(value) {
    'worklet';
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
}
function buildChamberAreas(edge) {
    const cubic = (a, b, c, d, t) => {
        const u = 1 - t;
        return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    };
    const outline = edge.flatMap(([p0, p1, p2, p3]) => Array.from({ length: 49 }, (_, index) => {
        const t = index / 48;
        return [Math.abs(cubic(p0[1], p1[1], p2[1], p3[1], t) - NECK_Y), cubic(p0[0], p1[0], p2[0], p3[0], t) - 80];
    }));
    const halfWidth = (depth) => {
        for (let index = 1; index < outline.length; index++) {
            const [d0, w0] = outline[index - 1];
            const [d1, w1] = outline[index];
            if (depth <= d1)
                return d1 === d0 ? w1 : lerp(w0, w1, (depth - d0) / (d1 - d0));
        }
        return outline[outline.length - 1][1];
    };
    const areas = [0];
    for (let k = 1; k * AREA_STEP <= CHAMBER_DEPTH; k++) {
        areas.push(areas[k - 1] + AREA_STEP * 2 * halfWidth((k - .5) * AREA_STEP));
    }
    return areas;
}
const TOP_AREAS = buildChamberAreas(TOP_EDGE);
const BOTTOM_AREAS = buildChamberAreas(BOTTOM_EDGE);
const BOTTOM_FULL = BOTTOM_AREAS[BOTTOM_AREAS.length - 1];
function chamberArea(areas, depth) {
    'worklet';
    const x = clamp(depth, 0, CHAMBER_DEPTH) / AREA_STEP;
    const k = Math.min(Math.floor(x), areas.length - 2);
    return lerp(areas[k], areas[k + 1], x - k);
}
function chamberLevel(areas, amount) {
    'worklet';
    if (amount <= 0)
        return 0;
    if (amount >= areas[areas.length - 1])
        return CHAMBER_DEPTH;
    let low = 0, high = areas.length - 1;
    while (high - low > 1) {
        const mid = (low + high) >> 1;
        if (areas[mid] <= amount)
            low = mid;
        else
            high = mid;
    }
    return (low + (amount - areas[low]) / (areas[high] - areas[low])) * AREA_STEP;
}
function hourglassRestingArea(fill) {
    'worklet';
    return BOTTOM_FULL - chamberArea(BOTTOM_AREAS, CHAMBER_DEPTH - 62 * clamp(fill, 0, 1));
}
const RUN_SCALE = Math.min(1, chamberArea(TOP_AREAS, .92 * CHAMBER_DEPTH) / hourglassRestingArea(.92));
function hourglassRunningArea(fill) {
    'worklet';
    return hourglassRestingArea(fill) * RUN_SCALE;
}
function hourglassTopSurfaceY(amount) {
    'worklet';
    return NECK_Y - chamberLevel(TOP_AREAS, amount);
}
function hourglassBottomSurfaceY(amount) {
    'worklet';
    return NECK_Y + chamberLevel(BOTTOM_AREAS, BOTTOM_FULL - amount);
}
function getHourglassLiquidGeometry(state) {
    'worklet';
    const p = clamp(state.progress, 0, 1);
    const remaining = Math.sqrt(1 - p);
    let top = 92 - 64 * remaining, bottom = 158 - 62 * (1 - remaining);
    let upperVisible = p < .9999, lowerVisible = p > .0001;
    let lowerEnd = 159, lowerSurfaceOpacity = 1, lowerIsSlab = 0;
    if (state.restingFill !== undefined) {
        const fill = clamp(state.restingFill, 0, 1);
        bottom = 158 - 62 * fill - (state.lift ?? 0);
        upperVisible = false;
        lowerVisible = fill > .002;
        if (state.flipProgress !== undefined) {
            const t = clamp(state.flipProgress, 0, 1);
            const slide = smooth((t - .48) / .52);
            const settledDepth = NECK_Y - hourglassTopSurfaceY(hourglassRunningArea(fill));
            bottom = lerp(158 - 62 * fill, NECK_Y - 1, slide);
            const depth = lerp(62 * fill + 1, settledDepth + 1, slide);
            lowerEnd = bottom + depth;
            lowerSurfaceOpacity = 1 - smooth(t / .35);
            lowerIsSlab = 1;
        }
    }
    else if (state.initialFill !== undefined) {
        const total = hourglassRunningArea(state.initialFill);
        const upper = total * (1 - p), lower = total - upper;
        top = hourglassTopSurfaceY(upper);
        bottom = hourglassBottomSurfaceY(lower);
        upperVisible = upper > .05;
        lowerVisible = lower > .05;
    }
    return {
        levels: [top, bottom],
        enabled: [!state.empty && upperVisible ? 1 : 0, !state.empty && lowerVisible ? 1 : 0],
        lowerEnd,
        lowerSurfaceOpacity,
        lowerIsSlab,
    };
}

}, {}],
"src/world/drawn/room/collections/objects.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTION_OBJECTS = exports.orbitRug = exports.mineralRug = exports.lakeRug = exports.teaTrolley = exports.starChart = exports.telescope = exports.knittingBasket = exports.mineralCabinet = exports.waterVase = exports.fernPress = exports.seedCabinet = exports.pottingTray = exports.harborPoster = exports.driftwoodVase = exports.shellMobile = exports.pebbleLamp = exports.lakeBench = void 0;
const ink_1 = require("../../core/ink");
const types_1 = require("../types");
const art_paths_1 = require("./art-paths");
// Content keys survive the redesign so a saved placement continues to resolve.
exports.lakeBench = (0, types_1.defineSeat)({
    id: 'collection-bentwood-bench', previewBox: { x0: 193, y0: 1055, x1: 887, y1: 1503 }, slot: 'seat', label: '둥근 원목 리넨 벤치',
    anchors: [{ id: 'seat', x: [380, 700], y: 1306 }], support: { id: 'seat', x: [292, 790], y: 1306 },
    variants: { original: { label: '크림 리넨과 호두나무', palette: { wood: '#A17C55', edge: '#74553E', grain: '#C5A073', fabric: '#E9DDC6', shade: '#C9B799', seam: '#F7ECD7', accent: '#91A397' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({
            rearLegs: 'M307 1284 L332 1284 L350 1434 Q339 1442 325 1437 Z M748 1284 L773 1284 L755 1437 Q741 1442 730 1434 Z',
            posts: 'M267 1175 L291 1174 L305 1343 L278 1345 Z M789 1174 L813 1175 L802 1345 L775 1343 Z',
            slats: 'M331 1129 L350 1125 L366 1274 L344 1278 Z M395 1113 L416 1111 L427 1265 L404 1267 Z M466 1107 L487 1106 L492 1261 L469 1262 Z M529 1103 L551 1103 L552 1260 L528 1260 Z M593 1106 L614 1107 L611 1262 L588 1261 Z M664 1111 L685 1113 L676 1267 L653 1265 Z M730 1125 L749 1129 L736 1278 L714 1274 Z',
            back: 'M263 1188 C255 1120 363 1080 540 1080 C717 1080 825 1120 817 1188 L793 1194 C798 1147 704 1116 540 1116 C376 1116 282 1147 287 1194 Z',
            backLight: 'M270 1167 C286 1114 389 1091 540 1091 C691 1091 794 1114 810 1167',
            backEdge: 'M287 1194 C282 1147 376 1116 540 1116 C704 1116 798 1147 793 1194',
            rail: 'M273 1337 Q540 1377 807 1337 L804 1380 Q540 1420 276 1380 Z',
            seatSide: 'M279 1284 Q540 1249 801 1284 L801 1335 C789 1361 647 1373 540 1373 C433 1373 291 1361 279 1335 Z',
            seat: 'M280 1286 C292 1251 395 1236 540 1236 C685 1236 788 1251 800 1286 C788 1315 661 1333 540 1333 C419 1333 292 1315 280 1286 Z',
            cushionLight: 'M299 1277 C351 1252 448 1249 540 1249 C632 1249 729 1252 781 1277',
            seam: 'M287 1303 C328 1331 444 1345 540 1345 C636 1345 752 1331 793 1303',
            arms: 'M278 1181 C272 1201 251 1224 238 1247 Q226 1268 238 1280 L268 1293 L267 1470 Q277 1481 295 1475 L305 1289 Q306 1273 290 1266 L267 1257 C280 1235 297 1212 299 1188 Z M802 1181 C808 1201 829 1224 842 1247 Q854 1268 842 1280 L812 1293 L813 1470 Q803 1481 785 1475 L775 1289 Q774 1273 790 1266 L813 1257 C800 1235 783 1212 781 1188 Z',
            armTop: 'M281 1190 Q280 1219 254 1257 Q249 1265 273 1275 M799 1190 Q800 1219 826 1257 Q831 1265 807 1275',
            pillow: 'M635 1199 Q677 1185 736 1199 Q750 1202 751 1215 L755 1254 Q755 1267 741 1270 Q690 1281 644 1268 Q633 1264 631 1254 L625 1218 Q623 1204 635 1199 Z',
            pillowShade: 'M630 1242 Q682 1265 753 1247 L755 1254 Q755 1267 741 1270 Q690 1281 644 1268 Q633 1264 631 1254 Z',
            pillowSeam: 'M639 1212 Q682 1199 738 1210 M642 1255 Q689 1267 742 1257',
        }) }),
    back(g, b, e) {
        const f = (0, ink_1.ink)(g, e.tint), p = b.pal;
        f.oval(540, 1480, 284, 15, e.shadow, .45);
        f.oval(285, 1476, 27, 7, e.shadow, .7);
        f.oval(795, 1476, 27, 7, e.shadow, .7);
        f.fill(b.rearLegs, p.edge);
        f.fill(b.posts, p.edge);
        f.fill(b.slats, p.wood);
        f.fill(b.back, p.wood);
        f.stroke(b.backLight, p.grain, 4, .8);
        f.stroke(b.backEdge, p.edge, 4, .65);
        f.fill(b.rail, p.edge);
        f.line([[297, 1372], [419, 1387], [540, 1392], [661, 1387], [783, 1372]], p.wood, 9);
        f.fill(b.seatSide, p.shade);
        f.fill(b.seat, p.fabric);
        f.stroke(b.cushionLight, p.seam, 3, .8);
        f.stroke(b.seam, p.seam, 3, .8);
        f.fill(b.pillow, p.accent);
        f.fill(b.pillowShade, '#7E9284', .6);
        f.stroke(b.pillowSeam, '#BAC4AF', 2.5, .7);
        f.fill(b.arms, p.wood);
        f.stroke(b.armTop, p.grain, 5, .8);
        f.line([[282, 1322], [281, 1431], [279, 1465]], p.grain, 3, .7);
        f.line([[798, 1322], [799, 1431], [801, 1465]], p.grain, 3, .7);
        f.circle(285, 1381, 4, p.edge, .55);
        f.circle(795, 1381, 4, p.edge, .55);
    },
});
exports.pebbleLamp = (0, types_1.defineLight)({
    id: 'collection-pebble-lamp', previewBox: { x0: -51, y0: 737, x1: 200, y1: 1484 }, slot: 'light', label: '주름 리넨 스탠드', zone: 'lightFloorLeft', defaultOn: 'night',
    emitters: [{ x: 74, y: 861, r: 290, color: '#FFEAC0' }],
    variants: { original: { label: '아이보리와 청록 도자기', palette: { metal: '#AC9268', shade: '#EFE2C4', fold: '#CFBE9C', light: '#FFF0CD', base: '#648F89', edge: '#426F6D' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({
            shade: 'M6 764 Q74 745 141 764 L183 920 Q77 955 -35 920 Z',
            pole: 'M67 928 L79 928 L82 1398 L63 1398 Z',
            base: 'M10 1417 C8 1389 43 1377 74 1377 C105 1377 140 1389 138 1417 L135 1443 Q74 1464 13 1443 Z',
            foot: 'M13 1435 Q74 1453 136 1435 L136 1450 Q74 1468 13 1450 Z',
            folds: 'M15 771 L-16 924 M37 768 L17 930 M60 766 L53 934 M84 766 L91 934 M108 768 L126 930 M131 771 L160 924',
            top: 'M7 764 Q74 784 140 764',
        }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(74, 1461, 77, 12, e.shadow, .6); f.fill(b.pole, p.metal); f.fill(b.base, p.base); f.fill(b.foot, p.edge); f.oval(74, 1403, 55, 13, '#8CB0A3'); f.line([[67, 983], [67, 1369]], '#CDB990', 2.5); f.fill(b.shade, p.shade); f.stroke(b.folds, p.fold, 3, .6); f.stroke(b.top, '#F9ECD3', 4); f.oval(74, 925, 108, 13, p.fold); f.oval(74, 924, 94, 7, p.shade); f.line([[141, 938], [141, 985]], p.metal, 2); f.circle(141, 990, 5, p.base); },
    glow(g, b, e) {
        'worklet';
        if (!e.lightOn)
            return;
        const f = (0, ink_1.ink)(g);
        f.fill(b.shade, b.pal.light, .88);
        f.stroke(b.folds, b.pal.fold, 3, .35);
        f.oval(74, 924, 94, 7, b.pal.light);
    },
});
exports.shellMobile = (0, types_1.defineProp)({
    id: 'collection-shell-mobile', previewBox: { x0: 937, y0: 481, x1: 1191, y1: 839 }, slot: 'wallDeco', label: '리넨 직조 벽걸이',
    variants: { original: { label: '귀리 리넨과 바랜 청록', palette: { cloth: '#E9DEC4', shade: '#CFC0A2', ink: '#779D92', wood: '#A48461', line: '#B3A184' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ cloth: 'M972 566 Q1065 550 1157 566 L1151 786 Q1123 806 1071 795 Q1019 784 978 804 Z', stripe: 'M976 669 Q1065 655 1154 669 L1153 705 Q1067 691 977 705 Z', fold: 'M1117 564 Q1140 601 1125 655 L1119 791 Q1138 794 1151 785 L1157 566 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.line([[973, 546], [1064, 501], [1159, 546]], p.line, 3); f.circle(1064, 499, 5, p.wood); f.line([[953, 551], [1174, 551]], p.wood, 11); f.fill(b.cloth, p.cloth); f.fill(b.stripe, p.ink); f.fill(b.fold, p.shade, .35); for (const x of [985, 1026, 1067, 1108, 1147])
        f.line([[x, 552], [x, 568]], p.cloth, 6); for (let x = 985; x < 1150; x += 13) {
        const y = 795 + Math.sin(x * .035) * 7;
        f.line([[x, y - 5], [x + 1, y + 20]], p.shade, 3);
    } for (let y = 584; y < 779; y += 14)
        f.line([[987, y], [1107, y - 3]], p.shade, 1, .28); },
});
exports.driftwoodVase = (0, types_1.defineProp)({
    id: 'collection-driftwood-vase', previewBox: { x0: -153, y0: -210, x1: 153, y1: 10 }, slot: 'sill', label: '올리브 가지와 유리병',
    variants: { original: { label: '청록 유리와 백자', palette: { glass: '#85B4AD', shade: '#60928C', light: '#C4DACA', leaf: '#6E8865', stem: '#8E8062', cream: '#ECE1C5' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({
            vase: 'M-102 -99 L-102 -77 C-125 -65 -130 -39 -118 -14 Q-95 -2 -62 -12 C-44 -38 -53 -64 -74 -77 L-74 -99 Z',
            branch: 'M-88 -84 Q-85 -124 -58 -160 M-80 -122 Q-111 -139 -124 -160 M-69 -146 Q-75 -169 -74 -187',
            leaves: 'M-98 -137 C-121 -126 -139 -141 -139 -148 C-119 -154 -106 -147 -98 -137 Z M-103 -150 C-123 -166 -116 -179 -113 -182 C-99 -172 -96 -161 -103 -150 Z M-65 -153 C-52 -182 -35 -182 -29 -177 C-31 -158 -49 -150 -65 -153 Z M-79 -171 C-99 -183 -96 -195 -92 -199 C-76 -192 -72 -181 -79 -171 Z M-55 -164 C-53 -190 -40 -196 -31 -192 C-28 -173 -39 -164 -55 -164 Z',
            cup: 'M25 -56 Q66 -77 96 -53 L92 -11 Q62 1 30 -12 Z', handle: 'M96 -49 C137 -67 135 -8 96 -18',
        }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(-88, -4, 48, 5, e.shadow, .45); f.oval(66, -3, 46, 5, e.shadow, .45); f.stroke(b.branch, p.stem, 3); f.fill(b.leaves, p.leaf); f.fill(b.vase, p.glass); f.oval(-88, -99, 15, 4, p.shade); f.oval(-88, -43, 31, 6, p.shade, .35); f.line([[-110, -54], [-113, -35], [-107, -18]], p.light, 5, .8); f.stroke(b.handle, p.cream, 9); f.fill(b.cup, p.cream); f.oval(61, -54, 35, 8, '#C5BBA0'); f.oval(61, -55, 28, 4, '#E1D5B9'); },
});
exports.harborPoster = (0, types_1.defineProp)({
    id: 'collection-tide-clock', previewBox: { x0: 953, y0: 480, x1: 1187, y1: 831 }, slot: 'wallDeco', label: '노을빛 작은 판화',
    variants: { original: { label: '월넛과 살구빛 종이', palette: { wood: '#896449', edge: '#B68D64', paper: '#F0DFC1', ink: '#457C7D', light: '#91B0A0', clay: '#C87960', gold: '#D9AA60' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ frame: 'M968 535 L1172 535 L1172 816 L968 816 Z', paper: 'M979 546 L1161 546 L1161 805 L979 805 Z', sky: 'M995 567 L1145 567 L1145 741 L995 741 Z', hill: 'M995 683 Q1027 625 1077 660 Q1118 683 1145 646 L1145 741 L995 741 Z', water: 'M995 706 Q1060 689 1145 709 L1145 757 L995 757 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.line([[980, 535], [1070, 498], [1160, 535]], p.edge, 2.5); f.circle(1070, 496, 4, p.wood); f.fill(b.frame, p.wood); f.line([[970, 537], [1170, 537]], p.edge, 3); f.fill(b.paper, p.paper); f.fill(b.sky, '#E1B794'); f.circle(1093, 608, 28, p.gold); f.fill(b.hill, p.clay); f.fill(b.water, p.ink); f.line([[1005, 723], [1031, 717], [1065, 719]], p.light, 5); f.line([[1083, 741], [1134, 736]], p.paper, 3, .8); f.line([[1037, 779], [1103, 779]], p.wood, 2, .5); },
});
exports.pottingTray = (0, types_1.defineProp)({
    id: 'collection-potting-tray', previewBox: { x0: -170, y0: -174, x1: 173, y1: 15 }, slot: 'sill', label: '꽃 한 송이의 정원 쟁반',
    variants: { original: { label: '백자와 분홍 꽃', palette: { clay: '#BE9372', rim: '#DFBC96', cream: '#EFE6D1', shade: '#CFC6AB', green: '#79966B', flower: '#CC8B9A', center: '#D9B26A' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ tray: 'M-156 -18 Q0 -46 156 -18 L150 -6 Q0 17 -150 -6 Z', pot: 'M-126 -64 L-68 -64 L-73 -21 Q-97 -12 -122 -22 Z', stem: 'M-97 -62 Q-85 -109 -110 -136 M-97 -93 Q-62 -101 -59 -119', leaf: 'M-94 -85 Q-132 -85 -133 -111 Q-103 -111 -94 -85 Z M-89 -100 Q-84 -129 -58 -129 Q-55 -108 -89 -100 Z', can: 'M20 -83 Q66 -102 106 -78 L105 -25 Q61 -6 19 -25 Z', handle: 'M20 -76 C-35 -112 -40 -19 18 -36', spout: 'M105 -65 L142 -96 L153 -89 L108 -39 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(0, -1, 149, 5, e.shadow, .4); f.fill(b.tray, p.rim); f.line([[-142, -6], [0, 5], [143, -6]], p.clay, 3); f.fill(b.pot, p.clay); f.oval(-97, -64, 29, 6, p.rim); f.oval(-97, -64, 22, 3, '#79644B'); f.stroke(b.stem, p.green, 3); f.fill(b.leaf, p.green); for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        f.oval(-111 + Math.cos(a) * 12, -144 + Math.sin(a) * 10, 10, 9, p.flower);
    } f.circle(-111, -144, 6, p.center); f.stroke(b.handle, p.cream, 10); f.fill(b.can, p.cream); f.fill(b.spout, p.cream); f.oval(65, -81, 37, 9, p.shade); f.oval(65, -81, 28, 5, '#E4DBC2'); f.line([[32, -66], [30, -42], [38, -30]], '#FFF5DC', 4); f.line([[142, -97], [155, -88]], p.clay, 4); },
});
exports.seedCabinet = (0, types_1.defineProp)({
    id: 'collection-seed-cabinet', previewBox: { x0: 900, y0: 1080, x1: 1204, y1: 1487 }, slot: 'plantSpot', label: '등나무 문 수납장',
    variants: { original: { label: '꿀빛 원목과 라탄', palette: { wood: '#AB8056', side: '#826044', rim: '#C49C6A', cane: '#CBB38A', weave: '#A89169', cream: '#E5D7BA', green: '#7C9980' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ body: 'M921 1177 Q920 1149 949 1149 L1121 1149 Q1145 1150 1146 1175 L1146 1427 L921 1427 Z', side: 'M1146 1171 L1182 1190 L1182 1421 L1146 1427 Z', top: 'M925 1154 L962 1135 L1166 1144 L1182 1190 L1146 1182 L921 1177 Z', door: 'M941 1282 Q941 1225 1033 1225 Q1124 1225 1124 1282 L1124 1404 L941 1404 Z', book: 'M951 1127 L1032 1127 L1049 1140 L965 1140 Z', vase: 'M1095 1094 L1113 1094 L1113 1107 Q1140 1117 1130 1141 Q1103 1152 1083 1137 Q1074 1117 1095 1107 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(1057, 1462, 134, 14, e.shadow, .6); for (const x of [940, 1158])
        f.line([[x, 1409], [x + (x > 1000 ? 5 : -4), 1454]], p.side, 15); f.fill(b.side, p.side); f.fill(b.body, p.wood); f.fill(b.top, p.rim); f.fill(b.door, p.cane); g.save(); g.clipPath(b.door, 1, true); for (let x = 947; x < 1125; x += 12)
        f.line([[x, 1219], [x, 1410]], p.weave, 2, .6); for (let y = 1243; y < 1404; y += 13)
        f.line([[938, y], [1128, y]], '#E2CB9E', 2, .7); g.restore(); f.stroke(b.door, p.rim, 7); f.line([[1032, 1234], [1032, 1397]], p.wood, 5); f.circle(1018, 1320, 5, p.side); f.circle(1046, 1320, 5, p.side); f.line([[938, 1195], [1129, 1195]], p.side, 2); f.line([[1009, 1206], [1057, 1206]], p.side, 5); f.fill(b.book, p.green); f.line([[964, 1136], [1034, 1136]], p.cream, 4); f.fill(b.vase, p.cream); f.oval(1104, 1095, 10, 3, p.weave); },
});
exports.fernPress = (0, types_1.defineProp)({
    id: 'collection-fern-press', previewBox: { x0: 953, y0: 485, x1: 1183, y1: 829 }, slot: 'wallDeco', label: '잎을 그린 종이 액자',
    variants: { original: { label: '청록 수채와 밝은 참나무', palette: { frame: '#BB966D', shade: '#937350', paper: '#F0E8D5', leaf: '#739A92', light: '#A1BAA7', stem: '#7A9180' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ frame: 'M970 542 L1167 542 L1167 812 L970 812 Z', paper: 'M981 553 L1156 553 L1156 801 L981 801 Z', stem: 'M1039 762 Q1052 702 1095 607 M1061 708 Q1029 691 1020 666', leaves: 'M1063 705 C1017 718 994 687 1008 672 C1027 654 1061 681 1063 705 Z M1071 680 C1064 641 1094 625 1112 642 C1123 661 1100 679 1071 680 Z M1084 646 C1061 619 1072 591 1093 593 C1112 598 1101 633 1084 646 Z M1048 733 C1067 706 1101 714 1102 735 C1095 753 1063 749 1048 733 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.line([[982, 542], [1069, 502], [1154, 542]], p.shade, 2); f.fill(b.frame, p.frame); f.line([[972, 809], [1165, 809]], p.shade, 3); f.fill(b.paper, p.paper); f.stroke(b.stem, p.stem, 2.5); f.fill(b.leaves, p.leaf, .88); f.line([[1038, 693], [1015, 682]], p.light, 2); f.line([[1080, 665], [1101, 649]], p.light, 2); f.line([[1078, 778], [1111, 778]], p.shade, 1.5, .4); },
});
exports.waterVase = (0, types_1.defineProp)({
    id: 'collection-water-vase', previewBox: { x0: -139, y0: -177, x1: 134, y1: 13 }, slot: 'sill', label: '긴 목 도자기와 작은 잔',
    variants: { original: { label: '우유빛 유약과 청자', palette: { body: '#E7DFCA', shade: '#C6C7B1', light: '#F8EFDB', cup: '#86A8A0', edge: '#5C8C86' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ body: 'M-85 -151 Q-64 -163 -39 -152 L-42 -97 Q-9 -80 -13 -37 Q-17 -10 -51 -8 Q-95 -6 -112 -29 C-128 -55 -110 -84 -83 -98 Z', handle: 'M-40 -116 C25 -143 34 -49 -12 -47', shade: 'M-42 -97 C-13 -79 -9 -42 -24 -21 Q-39 -9 -56 -8 C-33 -36 -31 -76 -42 -97 Z', cup: 'M56 -49 Q88 -60 115 -47 L111 -11 Q85 0 61 -12 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(-57, -3, 65, 5, e.shadow, .4); f.oval(86, -3, 36, 5, e.shadow, .4); f.stroke(b.handle, p.shade, 11); f.stroke(b.handle, p.body, 6); f.fill(b.body, p.body); f.fill(b.shade, p.shade); f.oval(-62, -151, 23, 5, p.shade); f.line([[-97, -55], [-101, -35], [-89, -21]], p.light, 5); f.fill(b.cup, p.cup); f.oval(86, -48, 30, 7, p.edge); f.oval(86, -49, 23, 4, '#B2C8B8'); },
});
exports.mineralCabinet = (0, types_1.defineProp)({
    id: 'collection-mineral-cabinet', previewBox: { x0: 900, y0: 1081, x1: 1203, y1: 1486 }, slot: 'plantSpot', label: '곡선 모서리 낮은 책장',
    variants: { original: { label: '월넛과 크림 도자기', palette: { wood: '#88694F', edge: '#AF8B65', back: '#BEA587', shadow: '#6D5846', paper: '#E7D9B9', blue: '#7F9D9D', clay: '#B8816D' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ body: 'M919 1202 C919 1122 952 1099 1037 1099 C1122 1099 1156 1122 1156 1202 L1156 1434 L919 1434 Z', inside: 'M940 1204 C940 1147 962 1120 1037 1120 C1112 1120 1135 1147 1135 1204 L1135 1344 L940 1344 Z', side: 'M1156 1188 L1183 1210 L1183 1427 L1156 1434 Z', vase: 'M1040 1167 Q1071 1147 1101 1170 L1105 1234 Q1071 1253 1036 1235 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(1050, 1461, 137, 15, e.shadow, .6); for (const x of [940, 1140])
        f.line([[x, 1422], [x + (x > 1000 ? 6 : -4), 1454]], p.shadow, 15); f.fill(b.side, p.shadow); f.fill(b.body, p.wood); f.fill(b.inside, p.back); f.rect(939, 1254, 197, 10, p.edge); f.rect(939, 1264, 197, 5, p.shadow); for (const [x, y, h, c] of [[952, 1186, 66, p.blue], [972, 1176, 76, p.paper], [992, 1183, 69, p.clay]]) {
        f.rect(x, y, 15, h, c);
        f.line([[x + 4, y + 9], [x + 11, y + 9]], p.paper, 1.5);
    } f.fill(b.vase, p.paper); f.oval(1071, 1169, 29, 7, '#AFA487'); f.oval(1071, 1168, 21, 3, p.back); f.rect(958, 1302, 98, 16, p.blue); f.rect(965, 1285, 93, 15, p.clay); f.line([[970, 1291], [1052, 1291]], p.paper, 4); f.oval(1098, 1329, 27, 9, p.paper); f.rect(932, 1356, 211, 58, p.edge); f.line([[1004, 1377], [1072, 1377]], p.shadow, 6); f.line([[935, 1417], [1140, 1417]], p.shadow, 3); },
});
exports.knittingBasket = (0, types_1.defineProp)({
    id: 'collection-knitting-basket', previewBox: { x0: 700, y0: 1553, x1: 1061, y1: 1790 }, slot: 'floorItem', label: '담요를 담은 짜임 바구니',
    variants: { original: { label: '내추럴 라탄과 와인빛 울', palette: { reed: '#B9976E', dark: '#8D7154', light: '#D7BD95', cloth: '#9A6974', shade: '#775564', stripe: '#DFCDB5' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ body: 'M734 1628 Q884 1587 1016 1628 L991 1744 Q879 1774 758 1744 Z', handleL: 'M752 1641 C688 1590 725 1555 775 1616', handleR: 'M986 1626 C1031 1572 1062 1620 1003 1650', cloth: 'M778 1627 Q823 1585 897 1603 Q926 1613 948 1641 L944 1720 Q914 1741 877 1725 L849 1650 Q819 1651 778 1627 Z', fold: 'M846 1626 Q881 1610 905 1625 L926 1728 L879 1725 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(878, 1761, 139, 15, e.shadow, .6); f.stroke(b.handleL, p.dark, 12); f.stroke(b.handleL, p.light, 5); f.stroke(b.handleR, p.dark, 12); f.stroke(b.handleR, p.light, 5); f.fill(b.body, p.reed); for (let y = 1657; y < 1743; y += 13)
        f.line([[762, y], [878, y + 13], [996, y]], p.light, 3, .8); for (let x = 770; x < 992; x += 22)
        f.line([[x, 1640], [x + (880 - x) * .12, 1744]], p.dark, 2.5, .55); f.oval(875, 1630, 140, 24, p.dark); f.oval(875, 1626, 129, 17, p.reed); f.fill(b.cloth, p.cloth); f.fill(b.fold, p.shade); f.line([[875, 1660], [938, 1656]], p.stripe, 10); f.line([[882, 1681], [940, 1678]], p.stripe, 3); for (let x = 885; x < 941; x += 10)
        f.line([[x, 1724], [x + 2, 1735]], p.cloth, 3); },
});
exports.telescope = (0, types_1.defineProp)({
    id: 'collection-telescope', previewBox: { x0: 907, y0: 1184, x1: 1202, y1: 1490 }, slot: 'plantSpot', label: '책이 놓인 원목 협탁',
    variants: { original: { label: '월넛과 잉크빛 책', palette: { wood: '#A47E58', shade: '#7C5E46', edge: '#C1A174', blue: '#536E80', paper: '#E4D6B8', glass: '#BD9664', green: '#91A79A' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ base: 'M961 1439 Q1038 1407 1136 1439 L1144 1455 Q1043 1481 952 1455 Z', stem: 'M1020 1287 L1080 1287 L1090 1445 Q1051 1455 1013 1446 Z', edge: 'M926 1249 Q1042 1211 1178 1249 L1178 1271 Q1053 1313 927 1271 Z', top: 'M926 1249 C934 1221 990 1206 1051 1206 C1117 1206 1172 1222 1178 1249 C1158 1274 984 1295 926 1249 Z', book: 'M954 1221 L1026 1209 L1081 1230 L1004 1245 Z', cup: 'M1100 1201 L1142 1201 L1138 1237 Q1119 1245 1103 1238 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(1048, 1467, 115, 13, e.shadow, .6); f.fill(b.base, p.shade); f.fill(b.stem, p.wood); for (const x of [1028, 1041, 1054, 1067, 1080])
        f.line([[x, 1301], [x + 3, 1437]], p.edge, 3, .65); f.fill(b.edge, p.shade); f.fill(b.top, p.wood); f.line([[956, 1255], [1045, 1270], [1140, 1255]], p.edge, 3); f.fill(b.book, p.blue); f.line([[959, 1233], [1003, 1250], [1078, 1235]], p.paper, 5); f.line([[957, 1226], [1004, 1241], [1080, 1227]], p.green, 7); f.fill(b.cup, p.glass); f.oval(1121, 1202, 21, 6, '#DBC69E'); f.oval(1121, 1202, 15, 3, '#896A4D'); f.line([[1110, 1213], [1112, 1233]], '#DEBF8D', 3); },
});
exports.starChart = (0, types_1.defineProp)({
    id: 'collection-star-chart', previewBox: { x0: 950, y0: 516, x1: 1183, y1: 800 }, slot: 'wallDeco', label: '둥근 모서리 벽 선반',
    variants: { original: { label: '참나무와 작은 백자', palette: { wood: '#B18C64', shade: '#8B6A4E', light: '#D4B589', back: '#C7AB88', cream: '#E9E0C9', blue: '#6D8895', clay: '#C1937B' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ back: 'M969 777 L969 601 Q969 533 1067 533 Q1166 533 1166 601 L1166 777 Z', inner: 'M987 759 L987 603 Q987 552 1067 552 Q1148 552 1148 603 L1148 759 Z', vase: 'M1004 621 Q1027 606 1051 622 L1057 669 Q1028 682 998 669 Z', cup: 'M1087 722 L1127 722 L1123 756 L1090 756 Z', handle: 'M1127 730 C1154 716 1154 752 1125 748' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.fill(b.back, p.wood); f.fill(b.inner, p.back); for (const y of [680, 759]) {
        f.rect(980, y, 180, 10, p.light);
        f.rect(983, y + 10, 175, 6, p.shade);
    } f.fill(b.vase, p.cream); f.oval(1028, 622, 23, 5, '#BFB69A'); for (const [x, h, c] of [[1080, 67, p.blue], [1096, 59, p.cream], [1112, 70, p.clay]]) {
        f.rect(x, 680 - h, 12, h, c);
        f.line([[x + 3, 666], [x + 9, 666]], p.cream, 1.5);
    } f.rect(1000, 740, 63, 14, p.blue); f.line([[1006, 745], [1056, 745]], p.cream, 4); f.stroke(b.handle, p.cream, 5); f.fill(b.cup, p.cream); f.oval(1107, 724, 19, 4, p.clay); },
});
exports.teaTrolley = (0, types_1.defineProp)({
    id: 'collection-tea-trolley', previewBox: { x0: 886, y0: 1131, x1: 1195, y1: 1487 }, slot: 'plantSpot', label: '둥근 원목 차 카트',
    variants: { original: { label: '꿀빛 원목과 분홍 도자기', palette: { wood: '#B28B61', shade: '#896A4C', light: '#D7B88B', pot: '#C48989', cream: '#F1E3CA', tea: '#927454', cloth: '#A8BBA6' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ frame: 'M932 1240 C904 1238 900 1184 922 1179 Q936 1177 936 1196 L949 1412 L938 1412 Z M1161 1240 L1164 1412 L1152 1412 L1148 1239 Z', tray: 'M924 1223 Q1038 1183 1174 1223 L1174 1247 Q1040 1285 924 1247 Z', lower: 'M943 1366 Q1051 1337 1160 1366 L1160 1385 Q1050 1411 943 1385 Z', pot: 'M1002 1161 C989 1176 990 1210 1015 1217 Q1045 1227 1064 1208 C1080 1180 1056 1153 1036 1154 Z', spout: 'M1059 1172 Q1085 1179 1092 1158 L1100 1161 Q1092 1199 1066 1199 Z', handle: 'M1004 1168 C958 1147 963 1212 999 1202', cloth: 'M970 1374 L1063 1369 L1071 1421 Q1025 1436 979 1424 Z' }) }),
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.oval(1051, 1461, 135, 13, e.shadow, .6); for (const x of [943, 1158]) {
        f.circle(x, 1445, 16, p.shade);
        f.circle(x, 1445, 7, p.light);
        f.line([[x, 1402], [x, 1436]], p.shade, 8);
    } f.fill(b.frame, p.wood); f.fill(b.lower, p.wood); f.fill(b.cloth, p.cloth); for (let x = 985; x < 1065; x += 13)
        f.line([[x, 1419], [x + 2, 1431]], p.cloth, 3); f.fill(b.tray, p.wood); f.oval(1049, 1224, 112, 20, p.light); f.line([[935, 1247], [1048, 1263], [1164, 1247]], p.shade, 3); f.stroke(b.handle, p.pot, 8); f.fill(b.pot, p.pot); f.fill(b.spout, p.pot); f.oval(1034, 1163, 25, 6, p.cream); f.circle(1034, 1153, 6, p.pot); f.oval(1112, 1230, 34, 7, p.cream); f.rect(1094, 1198, 36, 27, p.cream); f.oval(1112, 1199, 18, 5, p.tea); f.oval(1112, 1223, 18, 5, p.cream); },
});
exports.lakeRug = (0, types_1.defineProp)({
    id: 'collection-waterline-rug', previewBox: { x0: 128, y0: 1499, x1: 952, y1: 1730 }, slot: 'rug', label: '타원 리넨 러그',
    variants: { original: { label: '오트밀과 바랜 청록', palette: { edge: '#73968B', body: '#DCD3B5', stitch: '#F0E6CF', weave: '#BDB89A' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ body: 'M151 1602 C181 1539 344 1516 540 1516 C736 1516 899 1539 929 1602 C947 1662 755 1714 540 1714 C326 1714 133 1662 151 1602 Z', inner: 'M171 1605 C206 1556 351 1538 540 1538 C729 1538 874 1556 909 1605 C919 1647 753 1692 540 1692 C327 1692 162 1647 171 1605 Z' }) }),
    eventSurface: b => b.body,
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.fill(b.body, p.edge); f.fill(b.inner, p.body); f.stroke(b.inner, p.stitch, 3, .75); g.save(); g.clipPath(b.inner, 1, true); for (let y = 1547; y < 1692; y += 10)
        f.line([[173, y], [906, y]], p.weave, 1, .42); for (let x = 184; x < 906; x += 21)
        f.line([[x, 1538], [x + 8, 1692]], p.stitch, 1.5, .4); g.restore(); },
});
exports.mineralRug = (0, types_1.defineProp)({
    id: 'collection-stepped-diamond-rug', previewBox: { x0: 121, y0: 1494, x1: 960, y1: 1743 }, slot: 'rug', label: '모서리가 둥근 울 러그',
    variants: { original: { label: '살구 베이지와 코코아', palette: { edge: '#9E7E6A', body: '#DFC5A7', stripe: '#BF9B85', stitch: '#EBD7BC' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ body: 'M166 1530 Q540 1494 914 1530 Q945 1535 945 1560 L939 1668 Q939 1691 910 1696 Q540 1736 170 1696 Q141 1691 141 1668 L135 1560 Q135 1535 166 1530 Z', inside: 'M175 1547 Q540 1513 905 1547 Q924 1550 924 1570 L920 1662 Q920 1675 901 1679 Q540 1716 179 1679 Q160 1675 160 1662 L156 1570 Q156 1550 175 1547 Z', stripe: 'M223 1543 Q255 1539 287 1538 L288 1690 L224 1684 Z M794 1538 L820 1541 L819 1687 L793 1690 Z' }) }),
    eventSurface: b => b.body,
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.fill(b.body, p.edge); f.fill(b.inside, p.body); f.fill(b.stripe, p.stripe, .65); f.stroke(b.inside, p.stitch, 3); for (let i = 0; i < 75; i++) {
        const x = 177 + (i * 73 % 720), y = 1559 + (i * 37 % 108);
        f.line([[x, y], [x + 5, y + 1]], p.stitch, 2, .6);
    } },
});
exports.orbitRug = (0, types_1.defineProp)({
    id: 'collection-star-compass-rug', previewBox: { x0: 109, y0: 1488, x1: 971, y1: 1744 }, slot: 'rug', label: '잉크빛 둥근 직조 러그',
    variants: { original: { label: '바랜 남색과 미색 실', palette: { edge: '#586D7F', body: '#8196A0', line: '#B4C2BE', weave: '#6D8590' } } },
    build: pal => ({ pal, ...(0, art_paths_1.artPaths)({ body: 'M132 1603 C163 1530 350 1504 540 1504 C730 1504 917 1530 948 1603 C962 1678 758 1727 540 1727 C322 1727 118 1678 132 1603 Z', inside: 'M156 1607 C184 1549 351 1527 540 1527 C729 1527 896 1549 924 1607 C932 1660 755 1704 540 1704 C325 1704 148 1660 156 1607 Z' }) }),
    eventSurface: b => b.body,
    back(g, b, e) { const f = (0, ink_1.ink)(g, e.tint), p = b.pal; f.fill(b.body, p.edge); f.fill(b.inside, p.body); f.stroke(b.inside, p.line, 3); g.save(); g.clipPath(b.inside, 1, true); for (let y = 1535; y < 1705; y += 9)
        for (let x = 165; x < 922; x += 18)
            f.line([[x, y], [x + 8, y + 2]], (x + y) % 3 ? p.weave : p.line, 1.5, .42); g.restore(); },
});
exports.COLLECTION_OBJECTS = [exports.lakeBench, exports.pebbleLamp, exports.shellMobile, exports.driftwoodVase, exports.harborPoster, exports.pottingTray, exports.seedCabinet, exports.fernPress, exports.waterVase, exports.mineralCabinet, exports.knittingBasket, exports.telescope, exports.starChart, exports.teaTrolley, exports.lakeRug, exports.mineralRug, exports.orbitRug];

}, {"../../core/ink":"src/world/drawn/core/ink.ts","../types":"src/world/drawn/room/types.ts","./art-paths":"src/world/drawn/room/collections/art-paths.ts"}],
"src/world/drawn/room/collections/art-paths.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.artPaths = artPaths;
const react_native_skia_1 = require("@shopify/react-native-skia");
/** Parse authored curves once during definition.build, never on the frame path. */
function artPaths(source) {
    return Object.fromEntries(Object.entries(source).map(([key, svg]) => {
        const path = react_native_skia_1.Skia.Path.MakeFromSVGString(svg);
        if (!path)
            throw new Error(`Invalid collection artwork: ${key}`);
        return [key, path];
    }));
}

}, {"@shopify/react-native-skia":"design/prototype-editorial/lab/drawn-web/skia-canvas2d.js"}],
"design/prototype-editorial/lab/drawn-web/skia-canvas2d.js": [function (module, exports, require) {
'use strict';
// 앱 그림 코드가 쓰는 @shopify/react-native-skia API를 브라우저 Canvas 2D로 옮기는 작은 번역 층.
// scripts/build-drawn-web.mjs가 앱 코드의 '@shopify/react-native-skia' import를 이 파일로 바꿔 묶는다.
// 앱 코드(src/world/drawn · drawn-lab)가 실제로 쓰는 것만 있다. 없는 기능을 부르면 바로 오류가 나게 두었다.
// ───────── 값(열거형): 앱 코드는 이름으로만 쓰므로 Canvas 2D 값으로 바로 둔다 ─────────
const BlendMode = {
    Clear: 'destination-out', Src: 'copy', SrcOver: 'source-over', DstOver: 'destination-over', SrcIn: 'source-in', DstIn: 'destination-in',
    SrcOut: 'source-out', DstOut: 'destination-out', SrcATop: 'source-atop', DstATop: 'destination-atop', Xor: 'xor', Plus: 'lighter',
    Screen: 'screen', Overlay: 'overlay', Darken: 'darken', Lighten: 'lighten', ColorDodge: 'color-dodge', ColorBurn: 'color-burn',
    HardLight: 'hard-light', SoftLight: 'soft-light', Difference: 'difference', Exclusion: 'exclusion', Multiply: 'multiply',
    Hue: 'hue', Saturation: 'saturation', Color: 'color', Luminosity: 'luminosity',
};
const ClipOp = { Difference: 0, Intersect: 1 };
const FillType = { Winding: 0, EvenOdd: 1, InverseWinding: 2, InverseEvenOdd: 3 };
const PaintStyle = { Fill: 0, Stroke: 1 };
const StrokeCap = { Butt: 'butt', Round: 'round', Square: 'square' };
const StrokeJoin = { Miter: 'miter', Round: 'round', Bevel: 'bevel' };
// ───────── 색: '#rgb' · '#rrggbb' · '#rrggbbaa' · rgb() · rgba() · 이름 → [r, g, b, a(0..1)] ─────────
const colorCache = new Map();
let probe = null;
function parseColor(s) {
    const hit = colorCache.get(s);
    if (hit)
        return hit;
    let out = null, t = String(s).trim();
    if (t[0] === '#') {
        let h = t.slice(1);
        if (h.length === 3 || h.length === 4)
            h = h.split('').map((c) => c + c).join('');
        const n = (i) => parseInt(h.slice(i, i + 2), 16);
        out = [n(0), n(2), n(4), h.length >= 8 ? n(6) / 255 : 1];
    }
    else {
        const m = /^rgba?\(([^)]+)\)$/i.exec(t);
        if (m) {
            const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
            out = [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
        }
        else {
            // 이름 색(white · transparent …): 브라우저에게 물어 #rrggbb나 rgba()로 받는다
            probe = probe || document.createElement('canvas').getContext('2d');
            probe.fillStyle = '#000000';
            probe.fillStyle = t;
            const back = probe.fillStyle;
            out = back === t ? [0, 0, 0, 1] : parseColor(back);
        }
    }
    colorCache.set(s, out);
    return out;
}
const css = (c) => `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;
// ───────── 붓(Paint) ─────────
class Paint {
    constructor() {
        this.c = [0, 0, 0, 1];
        this.style = PaintStyle.Fill;
        this.sw = 0;
        this.cap = 'butt';
        this.join = 'miter';
        this.blend = 'source-over';
    }
    setColor(c) { this.c = Array.isArray(c) ? c : parseColor(c); }
    getColor() { return this.c; }
    /** Skia처럼 알파를 바꾼다(곱하지 않는다). 색 배열은 캐시와 같이 쓰므로 새 배열을 만든다 */
    setAlphaf(a) { this.c = [this.c[0], this.c[1], this.c[2], a]; }
    getAlphaf() { return this.c[3]; }
    setAntiAlias() { }
    setDither() { }
    setStyle(s) { this.style = s; }
    setStrokeWidth(w) { this.sw = w; }
    setStrokeCap(c) { this.cap = c; }
    setStrokeJoin(j) { this.join = j; }
    setBlendMode(b) { this.blend = b; }
    setColorFilter(filter) { this.filter = filter; }
    dispose() { }
    copy() { return Object.assign(new Paint(), this); }
}
// ───────── 길(Path): 명령 목록을 들고 있다가 처음 그릴 때 Path2D를 한 번 만든다 ─────────
let pathProbe = null;
class Path {
    constructor(ops, fill) { this.ops = ops; this.fill = fill; this.p = null; }
    dispose() { this.ops = []; this.p = null; }
    contains(x, y) {
        pathProbe = pathProbe || document.createElement('canvas').getContext('2d');
        return pathProbe.isPointInPath(this.p2d(), x, y, this.rule());
    }
    isInterpolatable(other) {
        return other instanceof Path && this.ops.length === other.ops.length &&
            this.ops.every((op, i) => op[0] === other.ops[i][0] && op.length === other.ops[i].length &&
                op.slice(1).every(Number.isFinite) && other.ops[i].slice(1).every(Number.isFinite));
    }
    interpolate(end, weight, output) {
        if (!this.isInterpolatable(end))
            return null;
        const ops = this.ops.map((op, i) => op.map((value, j) => j === 0 ? value : value * weight + end.ops[i][j] * (1 - weight)));
        if (output) {
            output.ops = ops;
            output.fill = this.fill;
            output.p = null;
            return output;
        }
        return new Path(ops, this.fill);
    }
    rule() { return this.fill === FillType.EvenOdd || this.fill === FillType.InverseEvenOdd ? 'evenodd' : 'nonzero'; }
    transform(m) {
        if (m.length !== 9 || !m.every(Number.isFinite) || m[6] !== 0 || m[7] !== 0 || m[8] !== 1) {
            throw new Error('skia-canvas2d: unsupported path transform');
        }
        const source = this.p2d();
        this.ops = [['P', source, { a: m[0], b: m[3], c: m[1], d: m[4], e: m[2], f: m[5] }]];
        this.p = null;
        return this;
    }
    p2d() {
        if (this.p)
            return this.p;
        const p = new Path2D();
        for (const o of this.ops) {
            switch (o[0]) {
                case 'M':
                    p.moveTo(o[1], o[2]);
                    break;
                case 'L':
                    p.lineTo(o[1], o[2]);
                    break;
                case 'Q':
                    p.quadraticCurveTo(o[1], o[2], o[3], o[4]);
                    break;
                case 'C':
                    p.bezierCurveTo(o[1], o[2], o[3], o[4], o[5], o[6]);
                    break;
                case 'Z':
                    p.closePath();
                    break;
                case 'R':
                    p.rect(o[1], o[2], o[3], o[4]);
                    break;
                case 'RR':
                    p.roundRect(o[1], o[2], o[3], o[4], [{ x: o[5], y: o[6] }]);
                    break;
                case 'E':
                    p.moveTo(o[1] + o[3], o[2]);
                    p.ellipse(o[1], o[2], o[3], o[4], 0, 0, Math.PI * 2);
                    p.closePath();
                    break;
                case 'P':
                    p.addPath(o[1], o[2]);
                    break;
                default: throw new Error(`skia-canvas2d: 모르는 길 명령 ${o[0]}`);
            }
        }
        this.p = p;
        return p;
    }
}
class PathBuilder {
    constructor() { this.ops = []; this.fill = FillType.Winding; }
    moveTo(x, y) { this.ops.push(['M', x, y]); return this; }
    lineTo(x, y) { this.ops.push(['L', x, y]); return this; }
    quadTo(x1, y1, x2, y2) { this.ops.push(['Q', x1, y1, x2, y2]); return this; }
    cubicTo(x1, y1, x2, y2, x3, y3) { this.ops.push(['C', x1, y1, x2, y2, x3, y3]); return this; }
    close() { this.ops.push(['Z']); return this; }
    addPath(path) { for (const o of path.ops)
        this.ops.push(o); return this; }
    addRect(r) { this.ops.push(['R', r.x, r.y, r.width, r.height]); return this; }
    addRRect(rr) { const r = rr.rect; this.ops.push(['RR', r.x, r.y, r.width, r.height, rr.rx, rr.ry]); return this; }
    addCircle(x, y, r) { this.ops.push(['E', x, y, r, r]); return this; }
    addOval(r) { this.ops.push(['E', r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2]); return this; }
    setFillType(t) { this.fill = t; return this; }
    build() { return new Path(this.ops.slice(), this.fill); }
    detach() { const p = this.build(); this.ops = []; return p; }
}
const rectPath = (r) => { const p = new Path2D(); p.rect(r.x, r.y, r.width, r.height); return p; };
const ovalPath = (cx, cy, rx, ry) => { const p = new Path2D(); p.moveTo(cx + rx, cy); p.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2); p.closePath(); return p; };
// ───────── 캔버스(SkCanvas): Canvas 2D 문맥 위에 그린다. saveLayer는 같은 크기의 겹 캔버스로 흉내 낸다 ─────────
class Canvas {
    /** ctx: 화면 캔버스의 2D 문맥 */
    constructor(ctx) { this.root = ctx; this.ctx = ctx; this.stack = []; this.layers = []; this.depth = 0; }
    /** 한 프레임 시작: 지난 프레임이 오류로 끊겼어도 겹 · 저장 단계를 비운다 */
    begin() { this.ctx = this.root; this.stack.length = 0; this.depth = 0; }
    _apply(paint) {
        const c = this.ctx;
        c.globalCompositeOperation = paint.blend;
        c.globalAlpha = 1;
        if (paint.style === PaintStyle.Stroke) {
            c.strokeStyle = css(paint.c);
            c.lineWidth = paint.sw || 1;
            c.lineCap = paint.cap;
            c.lineJoin = paint.join;
        }
        else
            c.fillStyle = css(paint.c);
    }
    _paintPath(p2d, rule, paint) {
        this._apply(paint);
        if (paint.style === PaintStyle.Stroke)
            this.ctx.stroke(p2d);
        else
            this.ctx.fill(p2d, rule);
    }
    save() { this.ctx.save(); this.stack.push(null); return this.stack.length; }
    saveLayer(paint) {
        const root = this.ctx.canvas, t = this.ctx.getTransform();
        let lay = this.layers[this.depth];
        if (!lay || lay.canvas.width !== root.width || lay.canvas.height !== root.height) {
            const cv = document.createElement('canvas');
            cv.width = root.width;
            cv.height = root.height;
            lay = this.layers[this.depth] = { canvas: cv, ctx: cv.getContext('2d') };
        }
        this.depth++;
        const lc = lay.ctx;
        if (lc.reset)
            lc.reset();
        else
            lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.clearRect(0, 0, root.width, root.height);
        lc.setTransform(t);
        this.stack.push({ prev: this.ctx, lay, alpha: paint ? paint.c[3] : 1, blend: paint ? paint.blend : 'source-over', filter: paint?.filter });
        this.ctx = lc;
        return this.stack.length;
    }
    restore() {
        const top = this.stack.pop();
        if (top === undefined)
            return;
        if (top === null) {
            this.ctx.restore();
            return;
        }
        const prev = top.prev;
        if (top.filter)
            applyLayerFilter(top.lay, top.filter);
        prev.save();
        prev.setTransform(1, 0, 0, 1, 0, 0);
        prev.globalAlpha = top.alpha;
        prev.globalCompositeOperation = top.blend;
        prev.drawImage(top.lay.canvas, 0, 0);
        prev.restore();
        this.ctx = prev;
        this.depth--;
    }
    getSaveCount() { return this.stack.length + 1; }
    restoreToCount(n) { while (this.stack.length + 1 > n)
        this.restore(); }
    translate(x, y) { this.ctx.translate(x, y); }
    scale(x, y) { this.ctx.scale(x, y === undefined ? x : y); }
    // Skia의 행 우선 3×3 아핀 행렬을 Canvas 2D의 a,b,c,d,e,f 순서로 옮긴다.
    concat(m) { this.ctx.transform(m[0], m[3], m[1], m[4], m[2], m[5]); }
    rotate(deg, px = 0, py = 0) {
        const r = deg * Math.PI / 180;
        if (px || py) {
            this.ctx.translate(px, py);
            this.ctx.rotate(r);
            this.ctx.translate(-px, -py);
        }
        else
            this.ctx.rotate(r);
    }
    drawPath(path, paint) { this._paintPath(path.p2d(), path.rule(), paint); }
    drawOval(r, paint) { this._paintPath(ovalPath(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2), 'nonzero', paint); }
    drawCircle(x, y, r, paint) { this._paintPath(ovalPath(x, y, r, r), 'nonzero', paint); }
    drawRect(r, paint) { this._paintPath(rectPath(r), 'nonzero', paint); }
    drawRRect(rr, paint) { const r = rr.rect, p = new Path2D(); p.roundRect(r.x, r.y, r.width, r.height, [{ x: rr.rx, y: rr.ry }]); this._paintPath(p, 'nonzero', paint); }
    clipPath(path, op) {
        if (op === ClipOp.Difference) {
            const p = new Path2D();
            p.rect(-1e5, -1e5, 2e5, 2e5);
            p.addPath(path.p2d());
            this.ctx.clip(p, 'evenodd');
        }
        else
            this.ctx.clip(path.p2d(), path.rule());
    }
    clipRect(r, op) { this.clipPath(new PathBuilder().addRect(r).build(), op); }
    drawPicture(pic) { pic.replay(this); }
    drawColor(c, blend) {
        const x = this.ctx;
        x.save();
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.globalCompositeOperation = blend || 'source-over';
        x.fillStyle = css(Array.isArray(c) ? c : parseColor(c));
        x.fillRect(0, 0, x.canvas.width, x.canvas.height);
        x.restore();
    }
    clear(c) { const x = this.ctx; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, x.canvas.width, x.canvas.height); x.restore(); if (c)
        this.drawColor(c); }
}
// ───────── 그림(Picture): 부른 순서대로 적어 두었다가 다시 그린다(붓은 부른 때 값으로 복사) ─────────
const RECORD = ['save', 'saveLayer', 'restore', 'translate', 'scale', 'concat', 'rotate', 'drawPath', 'drawOval', 'drawCircle', 'drawRect', 'drawRRect', 'clipPath', 'clipRect', 'drawPicture', 'drawColor', 'clear'];
class Recorder {
    constructor() { this.ops = []; this.n = 0; }
    getSaveCount() { return this.n + 1; }
    restoreToCount(n) { while (this.n + 1 > n)
        this.restore(); }
}
for (const name of RECORD) {
    Recorder.prototype[name] = function (...args) {
        if (name === 'save' || name === 'saveLayer')
            this.n++;
        if (name === 'restore')
            this.n = Math.max(0, this.n - 1);
        this.ops.push([name, args.map((a) => (a instanceof Paint ? a.copy() : a))]);
        if (name === 'save' || name === 'saveLayer')
            return this.n;
    };
}
class Picture {
    constructor(ops) { this.ops = ops; }
    replay(cv) { for (const [name, args] of this.ops)
        cv[name](...args); }
}
function createPicture(fn) { const r = new Recorder(); fn(r); return new Picture(r.ops); }
// Inspection-only Canvas2D fallback. Native Skia applies this on the GPU; no native pixel readback.
function applyLayerFilter(lay, filter) {
    const image = lay.ctx.getImageData(0, 0, lay.canvas.width, lay.canvas.height), d = image.data;
    if (filter.kind === 'matrix') {
        const m = filter.matrix;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
            d[i] = r * m[0] + g * m[1] + b * m[2] + a * m[3] + 255 * m[4];
            d[i + 1] = r * m[5] + g * m[6] + b * m[7] + a * m[8] + 255 * m[9];
            d[i + 2] = r * m[10] + g * m[11] + b * m[12] + a * m[13] + 255 * m[14];
            d[i + 3] = r * m[15] + g * m[16] + b * m[17] + a * m[18] + 255 * m[19];
        }
    }
    else if (filter.kind === 'src-in') {
        for (let i = 0; i < d.length; i += 4) {
            d[i] = filter.color[0];
            d[i + 1] = filter.color[1];
            d[i + 2] = filter.color[2];
            d[i + 3] *= filter.color[3];
        }
    }
    else
        throw new Error('skia-canvas2d: unsupported color filter');
    lay.ctx.putImageData(image, 0, 0);
}
const Skia = {
    Color: parseColor,
    ColorFilter: {
        MakeMatrix(matrix) {
            if (matrix.length !== 20 || !matrix.every(Number.isFinite))
                throw new Error('Invalid color matrix');
            return { kind: 'matrix', matrix: [...matrix], dispose() { } };
        },
        MakeBlend(color, mode) {
            if (mode !== BlendMode.SrcIn)
                throw new Error('Unsupported filter blend mode');
            return { kind: 'src-in', color: [...color], dispose() { } };
        },
    },
    Paint: () => new Paint(),
    XYWHRect: (x, y, width, height) => ({ x, y, width, height }),
    RRectXY: (rect, rx, ry) => ({ rect, rx, ry }),
    PathBuilder: { Make: () => new PathBuilder() },
    Path: {
        Oval: (r) => new PathBuilder().addOval(r).build(),
        MakeFromSVGString(svg) {
            try {
                return new Path([['P', new Path2D(svg)]], FillType.Winding);
            }
            catch {
                return null;
            }
        },
    },
};
/** 화면 캔버스용 SkCanvas(작업대가 부른다) */
const canvasFor = (ctx) => new Canvas(ctx);
module.exports = { Skia, BlendMode, ClipOp, FillType, PaintStyle, StrokeCap, StrokeJoin, createPicture, canvasFor, Canvas };

}, {}],
"src/world/drawn/room/types.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineProp = exports.defineLight = exports.defineSeat = exports.defineView = exports.defineWindow = exports.defineFloor = exports.defineWall = exports.OPTIONAL_SLOTS = exports.REQUIRED_SLOTS = void 0;
const scenery_event_tags_1 = require("./scenery-event-tags");
exports.REQUIRED_SLOTS = ['wall', 'floor', 'window', 'view', 'seat', 'light'];
exports.OPTIONAL_SLOTS = ['wallDeco', 'plantSpot', 'sill', 'rug', 'floorItem'];
/** 아이템 정의를 적을 때 쓴다(B를 추론하고, 목록에 넣을 수 있는 모양으로 바꾼다) */
const defineWall = (d) => d;
exports.defineWall = defineWall;
const defineFloor = (d) => d;
exports.defineFloor = defineFloor;
const defineWindow = (d) => d;
exports.defineWindow = defineWindow;
const defineView = (d) => ({ ...d, events: (0, scenery_event_tags_1.sceneryEventTags)(d.id, d.events) });
exports.defineView = defineView;
const defineSeat = (d) => d;
exports.defineSeat = defineSeat;
const defineLight = (d) => d;
exports.defineLight = defineLight;
const defineProp = (d) => d;
exports.defineProp = defineProp;

}, {"./scenery-event-tags":"src/world/drawn/room/scenery-event-tags.ts"}],
"src/world/drawn/room/scenery-event-tags.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sceneryEventTags = sceneryEventTags;
/** Semantic scenery capabilities shared by runtime definitions and requirement choices. */
const SCENERY_EVENT_TAGS = {
    'study-salt-lake': ['lake'],
    'study-tide-pools': ['sea', 'tide', 'open-sky'],
    'study-flower-meadow': ['meadow', 'garden', 'butterfly', 'open-sky'],
    'study-terraced-dunes': ['dunes', 'wind', 'open-sky'],
    'study-glass-dunes': ['dunes', 'wind', 'open-sky'],
    'study-rose-canyon': ['dunes', 'wind', 'open-sky'],
    'study-mist-forest': ['trees', 'leaves', 'forest', 'fog', 'fireflies'],
    'study-moonlit-forest': ['trees', 'leaves', 'forest', 'fog', 'fireflies'],
    'study-cloud-sea': ['cloud', 'open-sky'],
    'study-lotus-lagoon': ['lake', 'garden', 'fireflies'],
    'study-garden-lake': ['lake', 'garden', 'butterfly', 'trees'],
    'study-prism-ice': ['lake', 'snow', 'north'],
    'study-lantern-valley': ['lantern', 'festival', 'city'],
    'study-starlit-lake': ['lake', 'open-sky'],
    'study-starlit-coast': ['sea', 'tide', 'open-sky'],
    'study-starlit-dunes': ['dunes', 'wind', 'open-sky'],
    'study-ribbon-aurora': ['snow', 'north'],
    'study-alpine-stars': ['snow', 'mountain', 'open-sky'],
    'study-harbor-stars': ['sea', 'lantern', 'open-sky'],
    'open-collection-oasis-court': ['garden', 'trees', 'birds'],
    'open-collection-crystal-mesa': ['dunes', 'wind', 'open-sky', 'birds'],
    'open-collection-comet-observatory': ['mountain', 'open-sky', 'snow'],
    'open-collection-cloud-tea-village': ['hills', 'cloud', 'open-sky', 'trees', 'birds'],
    'open-collection-cloud-orchard': ['garden', 'trees', 'butterfly', 'birds', 'wind'],
    space: ['cosmic'],
    'open-planet-station': ['cosmic'],
};
function sceneryEventTags(id, authored) {
    const tags = new Set([...authored, ...(SCENERY_EVENT_TAGS[id] ?? [])]);
    // Both spellings remain readable while authored event timing uses either one.
    if (tags.has('openSky') || tags.has('open-sky')) {
        tags.add('openSky');
        tags.add('open-sky');
    }
    if (tags.has('trees') || tags.has('leaves')) {
        tags.add('trees');
        tags.add('leaves');
    }
    return [...tags];
}

}, {}],
"src/world/drawn/core/ink.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shapeOf = exports.rrect = exports.polyline = exports.joined = exports.ink = exports.furry = exports.edge = void 0;
var ink_1 = require("@/shared/drawing/ink");
Object.defineProperty(exports, "edge", { enumerable: true, get: function () { return ink_1.edge; } });
Object.defineProperty(exports, "furry", { enumerable: true, get: function () { return ink_1.furry; } });
Object.defineProperty(exports, "ink", { enumerable: true, get: function () { return ink_1.ink; } });
Object.defineProperty(exports, "joined", { enumerable: true, get: function () { return ink_1.joined; } });
Object.defineProperty(exports, "polyline", { enumerable: true, get: function () { return ink_1.polyline; } });
Object.defineProperty(exports, "rrect", { enumerable: true, get: function () { return ink_1.rrect; } });
Object.defineProperty(exports, "shapeOf", { enumerable: true, get: function () { return ink_1.shapeOf; } });

}, {"@/shared/drawing/ink":"src/shared/drawing/ink.ts"}],
"src/shared/drawing/ink.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.furry = exports.edge = exports.rrect = void 0;
exports.shapeOf = shapeOf;
exports.polyline = polyline;
exports.joined = joined;
exports.ink = ink;
// 그리기 도구(모두 worklet): 붓(ink)과 가구 도형 만들기. 방 아이템 · 풍경 · 이벤트가 같은 도구로 그려야 그림체가 같다.
// 방 빛(tint): ink(g, tint)로 만든 붓은 칠하는 색마다 tint를 곱한다. 방 층(벽 · 가구 · 소품)은 이 붓으로만 칠한다.
// 창밖 풍경과 빛(glow)은 자기 색을 쓰므로 tint 없이 만든다.
const react_native_skia_1 = require("@shopify/react-native-skia");
const color_1 = require("./color");
const geometry_1 = require("./geometry");
/** 둥근 사각형 윤곽 점(n이 클수록 각지다) */
const rrect = (x0, y0, x1, y1, n = 6) => {
    'worklet';
    return (0, geometry_1.ellPts)((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, n, 90);
};
exports.rrect = rrect;
/** 가구 가장자리(살짝 울퉁불퉁 · 기본 12 · 2.2 · 1.6). 같은 seed면 같은 모양 */
const edge = (pts, seed, d = 12, bump = 2.2, lump = 1.6) => {
    'worklet';
    return (0, geometry_1.fuzzy)(pts, seed, d, bump, lump);
};
exports.edge = edge;
/** 보송한 가장자리(털 · 잎 · 구름 · 기본 8 · 4.5 · 3) */
const furry = (pts, seed, d = 8, bump = 4.5, lump = 3) => {
    'worklet';
    return (0, geometry_1.fuzzy)(pts, seed, d, bump, lump);
};
exports.furry = furry;
function shapeOf(s) {
    'worklet';
    const r = s.rr, e = s.ell;
    const pts = r ? (0, exports.rrect)(r[0], r[1], r[2], r[3], r[4]) : s.cm ? (0, geometry_1.catmull)(s.cm[0], s.cm[1], s.cm[2]) : e ? (0, geometry_1.ellPts)(e[0], e[1], e[2], e[3], e[4], e[5], e[6]) : s.pts;
    const a = (s.fu || s.fz);
    return s.fu ? (0, exports.furry)(pts, a[0], a[1], a[2], a[3]) : (0, exports.edge)(pts, a[0], a[1], a[2], a[3]);
}
/** 열린 선(줄 · 줄기 · 이음선) */
function polyline(pts) {
    'worklet';
    const p = react_native_skia_1.Skia.PathBuilder.Make().moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++)
        p.lineTo(pts[i][0], pts[i][1]);
    return p.build();
}
/** 여러 모양을 한 Path로(한 번에 칠할 때) */
function joined(paths) {
    'worklet';
    const b = react_native_skia_1.Skia.PathBuilder.Make();
    for (const p of paths)
        b.addPath(p);
    return b.build();
}
function ink(g, tint) {
    'worklet';
    const paint = react_native_skia_1.Skia.Paint();
    paint.setAntiAlias(true);
    const T = tint && tint.toLowerCase() !== '#ffffff' ? tint : null;
    const c = (color) => (T ? (0, color_1.multiply)(color, T) : color);
    const set = (color, alpha) => { paint.setColor(react_native_skia_1.Skia.Color(c(color))); if (alpha != null && alpha !== 1)
        paint.setAlphaf(alpha); };
    const fill = (p, color, alpha) => { paint.setStyle(react_native_skia_1.PaintStyle.Fill); set(color, alpha); g.drawPath(p, paint); };
    const stroke = (p, color, width, alpha) => {
        paint.setStyle(react_native_skia_1.PaintStyle.Stroke);
        paint.setStrokeWidth(width);
        paint.setStrokeCap(react_native_skia_1.StrokeCap.Round);
        paint.setStrokeJoin(react_native_skia_1.StrokeJoin.Round);
        set(color, alpha);
        g.drawPath(p, paint);
        paint.setStyle(react_native_skia_1.PaintStyle.Fill);
    };
    return {
        paint, c, fill, stroke,
        rect: (x, y, w, h, color, alpha) => { paint.setStyle(react_native_skia_1.PaintStyle.Fill); set(color, alpha); g.drawRect(react_native_skia_1.Skia.XYWHRect(x, y, w, h), paint); },
        circle: (x, y, r, color, alpha) => { paint.setStyle(react_native_skia_1.PaintStyle.Fill); set(color, alpha); g.drawCircle(x, y, r, paint); },
        oval: (cx, cy, rx, ry, color, alpha) => { paint.setStyle(react_native_skia_1.PaintStyle.Fill); set(color, alpha); g.drawOval(react_native_skia_1.Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint); },
        line: (pts, color, width, alpha) => stroke(polyline(pts), color, width, alpha),
    };
}

}, {"@shopify/react-native-skia":"design/prototype-editorial/lab/drawn-web/skia-canvas2d.js","./color":"src/shared/drawing/color.ts","./geometry":"src/shared/drawing/geometry.ts"}],
"src/shared/drawing/geometry.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blob = exports.sharp = exports.soft = exports.hash = exports.ease = exports.clamp = exports.lerp = exports.TAU = void 0;
exports.catmull = catmull;
exports.ellPts = ellPts;
exports.resample = resample;
exports.fuzzy = fuzzy;
// 도구: 보간 · 곡선 · 보송한 가장자리(fuzzy). 목업 lab/drawn/base.js를 옮기고 Path2D 대신 SkPath를 만든다(docs/24 §3 geometry).
// 모두 worklet이라 UI 스레드(매 프레임 다리)와 JS 스레드(한 번 만드는 모양) 양쪽에서 쓴다.
const react_native_skia_1 = require("@shopify/react-native-skia");
const math_1 = require("./math");
var math_2 = require("./math");
Object.defineProperty(exports, "TAU", { enumerable: true, get: function () { return math_2.TAU; } });
Object.defineProperty(exports, "lerp", { enumerable: true, get: function () { return math_2.lerp; } });
Object.defineProperty(exports, "clamp", { enumerable: true, get: function () { return math_2.clamp; } });
Object.defineProperty(exports, "ease", { enumerable: true, get: function () { return math_2.ease; } });
Object.defineProperty(exports, "hash", { enumerable: true, get: function () { return math_2.hash; } });
function catmull(ctrl, closed, k = 8) {
    'worklet';
    const out = [], n = ctrl.length;
    const get = (i) => (closed ? ctrl[(i + n) % n] : ctrl[Math.min(n - 1, Math.max(0, i))]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
        const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
        for (let j = 0; j < k; j++) {
            const t = j / k, t2 = t * t, t3 = t2 * t;
            const c = (m) => .5 * (2 * p1[m] + (-p0[m] + p2[m]) * t + (2 * p0[m] - 5 * p1[m] + 4 * p2[m] - p3[m]) * t2 + (-p0[m] + 3 * p1[m] - 3 * p2[m] + p3[m]) * t3);
            out.push([c(0), c(1)]);
        }
    }
    if (!closed) {
        const last = ctrl[n - 1];
        out.push([last[0], last[1]]);
    }
    return out;
}
function ellPts(cx, cy, rx, ry, rot = 0, n = 2, N = 60) {
    'worklet';
    const out = [], c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < N; i++) {
        const a = i / N * math_1.TAU, ca = Math.cos(a), sa = Math.sin(a);
        const x = Math.sign(ca) * Math.abs(ca) ** (2 / n) * rx, y = Math.sign(sa) * Math.abs(sa) ** (2 / n) * ry;
        out.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return out;
}
function resample(pts, d) {
    'worklet';
    const out = [], n = pts.length;
    let carry = 0;
    for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        let s = carry;
        for (; s < L; s += d)
            out.push([a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L]);
        carry = s - L;
    }
    return out;
}
/** 보송한 가장자리: 윤곽을 촘촘히 나눠 큰 덩어리(느린 물결)로 한 번 흔들고, 그 위에 간격 · 높이가 제각각인 작은 털 뭉치를 붙인다. 같은 시드면 같은 모양. */
function fuzzy(pts, seed, d = 8, bump = 4.5, lump = 3) {
    'worklet';
    const q = resample(pts, 2), n = q.length;
    let cx = 0, cy = 0;
    for (const [x, y] of q) {
        cx += x / n;
        cy += y / n;
    }
    const nrm = (i) => { const a = q[(i - 2 + n) % n], b = q[(i + 2) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; return [ty / l, -tx / l]; };
    let dot = 0;
    for (let i = 0; i < n; i++) {
        const [nx, ny] = nrm(i);
        dot += nx * (q[i][0] - cx) + ny * (q[i][1] - cy);
    }
    const sg = dot >= 0 ? 1 : -1, per = n * 2;
    const m1 = Math.max(1, Math.round(per / 110)), m2 = Math.max(2, Math.round(per / 43)), ph1 = (0, math_1.hash)(1, seed) * math_1.TAU, ph2 = (0, math_1.hash)(2, seed) * math_1.TAU;
    const Pn = q.map((p, i) => {
        const [nx, ny] = nrm(i), u = i / n * math_1.TAU, off = lump * (.6 * Math.sin(m1 * u + ph1) + .4 * Math.sin(m2 * u + ph2));
        return [p[0] + nx * sg * off, p[1] + ny * sg * off, nx * sg, ny * sg];
    });
    const path = react_native_skia_1.Skia.PathBuilder.Make();
    path.moveTo(Pn[0][0], Pn[0][1]);
    for (let i = 0, k = 0; i < n; k++) {
        const j = Math.min(n, i + Math.max(2, Math.round(d * (.5 + (0, math_1.hash)(k, seed + 7)) / 2))), a = Pn[i], b = Pn[j % n];
        const h = bump * (.15 + .85 * (0, math_1.hash)(k, seed + 13) ** 1.5);
        path.quadTo((a[0] + b[0]) / 2 + (a[2] + b[2]) / 2 * h, (a[1] + b[1]) / 2 + (a[3] + b[3]) / 2 * h, b[0], b[1]);
        i = j;
    }
    path.close();
    return path.build();
}
const soft = (ctrl, seed) => {
    'worklet';
    return fuzzy(catmull(ctrl, true), seed);
};
exports.soft = soft;
const sharp = (ctrl, seed) => {
    'worklet';
    return fuzzy(ctrl, seed);
};
exports.sharp = sharp;
const blob = (cx, cy, rx, ry, seed, rot = 0, n = 2) => {
    'worklet';
    return fuzzy(ellPts(cx, cy, rx, ry, rot, n), seed);
};
exports.blob = blob;

}, {"@shopify/react-native-skia":"design/prototype-editorial/lab/drawn-web/skia-canvas2d.js","./math":"src/shared/drawing/math.ts"}],
"src/shared/drawing/math.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hash = exports.ease = exports.clamp = exports.lerp = exports.TAU = void 0;
/** Scalar animation math, shared by pure controllers and Skia geometry. */
exports.TAU = Math.PI * 2;
const lerp = (a, b, t) => {
    'worklet';
    return a + (b - a) * t;
};
exports.lerp = lerp;
const clamp = (v, a = 0, b = 1) => {
    'worklet';
    return Math.min(b, Math.max(a, v));
};
exports.clamp = clamp;
const ease = (t) => {
    'worklet';
    return t * t * (3 - 2 * t);
};
exports.ease = ease;
const hash = (i, s) => {
    'worklet';
    const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return x - Math.floor(x);
};
exports.hash = hash;

}, {}],
"src/shared/drawing/color.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.darken = exports.lighten = void 0;
exports.rgb = rgb;
exports.hex = hex;
exports.mix = mix;
exports.multiply = multiply;
// 색 도구(모두 worklet): '#rrggbb' 문자열만 다룬다. 투명도는 그릴 때 따로 준다.
const math_1 = require("./math");
function rgb(h) {
    'worklet';
    const s = h.charCodeAt(0) === 35 ? h.slice(1) : h;
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const hx = (v) => {
    'worklet';
    const s = Math.round((0, math_1.clamp)(v, 0, 255)).toString(16);
    return s.length < 2 ? '0' + s : s;
};
function hex(r, g, b) {
    'worklet';
    return '#' + hx(r) + hx(g) + hx(b);
}
/** a → b를 t만큼 */
function mix(a, b, t) {
    'worklet';
    const A = rgb(a), B = rgb(b);
    return hex((0, math_1.lerp)(A[0], B[0], t), (0, math_1.lerp)(A[1], B[1], t), (0, math_1.lerp)(A[2], B[2], t));
}
/** 곱하기(방 빛): 흰색이면 그대로 */
function multiply(a, b) {
    'worklet';
    const A = rgb(a), B = rgb(b);
    return hex(A[0] * B[0] / 255, A[1] * B[1] / 255, A[2] * B[2] / 255);
}
const lighten = (a, k) => {
    'worklet';
    return mix(a, '#ffffff', k);
};
exports.lighten = lighten;
const darken = (a, k) => {
    'worklet';
    return mix(a, '#000000', k);
};
exports.darken = darken;

}, {"./math":"src/shared/drawing/math.ts"}],
"src/world/drawn/room/studies/world-imaginative-views.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGINATIVE_VIEW_KINDS = exports.IMAGINATIVE_SCENES = void 0;
exports.makeImaginativeView = makeImaginativeView;
const react_native_skia_1 = require("@shopify/react-native-skia");
const color_1 = require("../../core/color");
const geometry_1 = require("../../core/geometry");
const ink_1 = require("../../core/ink");
const types_1 = require("../types");
const scenery_motion_1 = require("../scenery-motion");
/** Authored scene paths are built once; selected layers share cached motion transforms. */
exports.IMAGINATIVE_SCENES = {
    'pink-muhly': { label: '바람길이 난 핑크뮬리', composition: 'foreground-field', tags: ['muhly', 'butterfly'] },
    'planet-parade': { label: '세 행성이 뜬 살구빛 하늘', composition: 'orbital-diagonal', tags: ['cosmic'] },
    'milky-river': { label: '은하수가 흐르는 검푸른 만', composition: 'diagonal-galaxy', tags: ['cosmic', 'tide'] },
    'moon-surface': { label: '달의 분화구 너머 푸른 행성', composition: 'near-craters', tags: ['cosmic'] },
    'coral-arches': { label: '산호빛 바위 문과 민트 바다', composition: 'side-arch', tags: ['tide'] },
    'rain-canopy': { label: '거대한 잎 아래 비의 정원', composition: 'overhead-canopy', tags: ['fireflies'] },
    'blue-grotto': { label: '빛이 고인 보랏빛 동굴', composition: 'nested-cave', tags: ['tide', 'fireflies'] },
    'golden-reeds': { label: '꿀빛 갈대와 초록 물길', composition: 'reeds-closeup', tags: ['muhly', 'fireflies'] },
    'glowing-tide': { label: '발광하는 파도가 감싼 해안', composition: 'curved-shore', tags: ['tide', 'fireflies'] },
    'ribbon-aurora': { label: '눈 평원 위 리본 오로라', composition: 'sweeping-sky', tags: ['aurora', 'cosmic'] },
};
exports.IMAGINATIVE_VIEW_KINDS = Object.keys(exports.IMAGINATIVE_SCENES);
function makeImaginativeView(kind, sky, land, accent, frame) {
    const info = exports.IMAGINATIVE_SCENES[kind], B = frame.bounds;
    const W = B.x1 - B.x0, H = B.y1 - B.y0, M = Math.min(W, H);
    const X = (x) => B.x0 + x * W, Y = (y) => B.y0 + y * H;
    const skyNight = ['planet-parade', 'moon-surface', 'milky-river'].includes(kind) ? '#202840' : '#304154';
    const skies = kind === 'moon-surface'
        ? [(0, color_1.mix)(sky, '#293E5C', .62), (0, color_1.mix)(sky, '#493E60', .67), '#192B42']
        : kind === 'milky-river' ? ['#263A55', '#373754', '#16283F']
            : kind === 'ribbon-aurora' ? ['#345867', '#46516C', '#1B384B']
                : [sky, (0, color_1.mix)(sky, '#E7B1C4', .34), (0, color_1.mix)(skyNight, sky, .16)];
    return (0, types_1.defineView)({
        id: `study-${kind}`, label: info.label, slot: 'view', celestial: false, cloud: null,
        events: info.tags, sky: [[skies[0], skies[0], skies[0]], [skies[1], skies[1], skies[1]], [skies[2], skies[2], skies[2]]],
        variants: { study: { label: '시안', palette: { sky, land, accent } } },
        build: () => {
            const parts = [];
            let serial = 25100;
            const animate = (start, motion) => { for (let i = start; i < parts.length; i++)
                parts[i].motion = motion; };
            const mood = (c, dark = .45) => [c, (0, color_1.mix)(c, '#C390A6', .17), (0, color_1.mix)(c, '#25394C', dark)];
            const light = (c) => [(0, color_1.mix)(c, '#FFEDD5', .18), c, c];
            const add = (path, color, alpha = 1, stroke = 0, nightOnly = false) => parts.push({ path, color, alpha, stroke, nightOnly });
            const curve = (svg, c, x = 0, y = 0, sx = 1, sy = 1, alpha = 1, stroke = 0) => {
                const path = react_native_skia_1.Skia.Path.MakeFromSVGString(svg);
                path.transform([W / 1000 * sx, 0, X(x / 1000), 0, H / 1000 * sy, Y(y / 1000), 0, 0, 1]);
                add(path, c, alpha, stroke * M / 1000);
            };
            const poly = (p, c, smooth = false, alpha = 1) => {
                const pts = p.map(([x, y]) => [X(x), Y(y)]);
                add((0, ink_1.shapeOf)(smooth ? { cm: [pts, true, 7], fz: [serial++, 8, .6, .4] } : { pts, fz: [serial++, 8, .45, .3] }), c, alpha);
            };
            const oval = (x, y, rx, ry, c, alpha = 1) => add((0, ink_1.shapeOf)({ ell: [X(x), Y(y), W * rx, H * ry], fz: [serial++, 8, .35, .25] }), c, alpha);
            const circle = (x, y, r, c, alpha = 1) => oval(x, y, r * M / W, r * M / H, c, alpha);
            const line = (p, c, width = .004, alpha = 1, nightOnly = false) => add((0, ink_1.polyline)(p.map(([x, y]) => [X(x), Y(y)])), c, alpha, M * width, nightOnly);
            const ripple = (x, y, w, c, phase) => {
                line((0, geometry_1.catmull)([[x - w * .5, y], [x, y + .003], [x + w * .5, y - .001]], false, 6), c, .003, .65);
                parts[parts.length - 1].motion = { pivot: [X(x), Y(y)], phase, speed: .85, flow: M * .024 };
            };
            const glow = (x, y, r, c) => {
                circle(x, y, r * 2.1, light(c), .035);
                circle(x, y, r * 1.6, light(c), .065);
                circle(x, y, r * 1.2, light(c), .13);
            };
            const star = (x, y, r = .004, c = '#F8E8C8', nightOnly = true) => {
                const start = parts.length;
                const p = react_native_skia_1.Skia.PathBuilder.Make().addCircle(X(x), Y(y), M * Math.min(r, .0038)).build();
                serial++;
                add(p, light(c), .94, 0, nightOnly);
                animate(start, { pivot: [X(x), Y(y)], phase: x * 17 + y * 11, speed: .8 + x * .35, shimmer: .8 });
            };
            const scatter = (count, minY = .04, maxY = .64, always = false) => {
                for (let i = 0; i < count; i++)
                    star(.06 + ((i * 43 + 11) % 89) / 100, minY + ((i * 29 + 7) % 97) / 97 * (maxY - minY), i % 9 === 0 ? .006 : .0025 + (i % 3) * .0007, '#F7E7C9', !always);
            };
            const pink = mood((0, color_1.mix)('#DF9DBB', accent, .32)), pinkPale = mood('#F1C2D2', .35), green = mood((0, color_1.mix)('#5B9086', land, .25));
            const deep = mood('#3A6268'), cream = mood('#F3DFC2', .33), sea = mood((0, color_1.mix)('#80BBB9', land, .28), .45);
            if (kind === 'pink-muhly') {
                // Low, weathered shoulders enclose a valley; the path disappears behind its far field.
                const ridgeFar = mood('#B0ABB9', .43), ridge = mood('#94899F', .43);
                const ridgeLight = mood('#ADA0B0', .43), ridgeShade = mood('#827D92', .43);
                curve('M-20 515 Q42 490 87 494 L126 481 Q158 457 190 463 L227 459 Q254 464 279 484 L319 488 Q360 502 402 534 Q485 551 555 523 L597 498 Q625 494 652 470 L691 456 Q721 432 753 440 L787 435 Q815 440 841 462 L879 471 Q916 465 946 486 L1020 505 L1020 710 L-20 710 Z', ridgeFar);
                curve('M600 512 L652 470 L691 456 Q721 432 753 440 L735 455 Q719 458 707 477 L672 493 Q638 514 600 528 Z', mood('#C4BAC5', .40));
                curve('M-20 561 L42 537 Q80 531 109 509 L153 501 Q176 484 198 490 L234 502 Q257 524 285 528 L321 540 Q363 548 405 576 Q453 595 492 588 L555 615 L-20 735 Z', ridge);
                curve('M42 537 Q80 531 109 509 L153 501 Q176 484 198 490 Q178 509 169 525 L137 534 Q121 552 100 561 L59 574 L-20 591 L-20 561 Z', ridgeLight);
                curve('M198 490 L234 502 Q257 524 285 528 L321 540 Q338 547 360 552 Q296 559 268 544 L232 540 Q217 522 198 490 Z', ridgeShade);
                curve('M320 572 Q371 568 405 576 Q453 595 492 588 L555 615 L482 628 Q424 604 394 607 Z', mood('#A698AC', .42));
                curve('M553 609 Q623 579 659 562 L706 552 Q735 537 763 512 Q786 500 811 508 L841 515 Q875 539 909 537 L948 548 Q982 551 1020 538 L1020 718 L553 682 Z', mood('#9988A0', .43));
                curve('M659 562 L706 552 Q735 537 763 512 Q786 500 811 508 Q793 527 771 537 L749 559 Q710 566 691 582 L638 600 L599 604 Z', mood('#B2A0B0', .40));
                curve('M811 508 L841 515 Q875 539 909 537 L948 548 Q887 563 858 549 L827 546 L798 555 L773 559 Z', mood('#877F96', .44));
                // The muted verge anchors pink flower haze to soil instead of floating on the hills.
                curve('M-20 629 Q99 588 205 613 Q291 637 393 623 Q506 603 610 627 Q706 610 785 618 Q900 600 1020 633 L1020 1080 L-20 1080 Z', mood('#A5A58F', .46));
                curve('M-20 654 Q60 620 124 626 Q177 614 230 645 Q317 644 377 665 Q456 650 513 645 Q555 638 598 649 Q662 628 718 639 Q771 624 821 639 Q904 621 1020 651 L1020 1080 L-20 1080 Z', mood('#CEA6B5', .43));
                curve('M-20 723 Q47 694 94 689 Q151 660 202 682 Q273 674 327 708 Q387 718 448 698 Q514 666 563 675 Q496 719 472 754 L438 856 L-20 881 Z', pink);
                curve('M-20 738 Q99 708 193 722 Q265 706 327 739 Q379 752 443 735 Q410 769 413 802 Q284 770 205 790 Q86 760 -20 799 Z', mood('#CA92AD', .43));
                curve('M615 663 Q675 642 733 656 Q799 639 854 665 Q932 646 1020 675 L1020 1080 L558 1080 L467 807 Q521 719 615 663 Z', mood('#C58DAA', .43));
                curve('M652 709 Q704 681 762 695 Q824 677 886 697 Q963 673 1020 697 L1020 769 Q942 735 881 750 Q806 725 748 748 Q689 729 602 762 Z', mood('#D29AB4', .40));
                // Both path edges follow the same bend and widen continuously toward the viewer.
                curve('M610 630 Q623 642 594 658 C570 673 554 682 542 697 C526 716 479 737 473 769 C464 808 550 850 568 901 Q604 970 642 1080 L375 1080 Q430 966 444 919 C468 866 391 823 408 777 C421 739 483 714 514 690 Q543 668 578 652 Q603 642 610 630 Z', mood('#C9AF9E', .43));
                curve('M610 631 Q618 643 590 659 Q557 680 544 698 C527 721 484 741 480 769 C474 807 555 850 575 905 L627 1080 L397 1080 Q447 970 456 920 C478 861 406 822 419 779 C429 744 487 719 519 693 Q548 669 580 655 Q603 644 610 631 Z', cream);
                curve('M421 783 C414 820 484 861 461 921 Q450 962 434 990 Q447 934 440 909 C439 869 394 825 405 790 Z', mood('#B89797', .42));
                // Small interruptions in the path edge are rooted grass lips, with no outline ribbons.
                curve('M-20 840 Q42 801 104 806 Q165 775 228 801 Q287 795 342 829 Q381 837 412 859 Q433 900 413 951 L362 1080 L-20 1080 Z', mood('#D5A0B7', .41));
                curve('M-20 945 Q72 908 142 924 Q215 887 285 920 Q342 927 385 972 L352 1080 L-20 1080 Z', mood('#BA819F', .44));
                curve('M563 889 Q615 844 681 849 Q721 807 785 826 Q854 796 914 823 Q969 806 1020 827 L1020 1080 L641 1080 Z', mood('#AF789D', .44));
                curve('M626 962 Q692 904 750 923 Q813 882 877 903 Q946 882 1020 921 L1020 1080 L655 1080 Z', mood('#C38AAA', .42));
                // Each tuft is four cached paths. Fine branches, seed flecks and blades share the root pivot.
                const tuft = (x, y, h, index, near) => {
                    const start = parts.length;
                    let stems = '', branches = '', seeds = '', blades = '';
                    const count = near ? 5 : 3;
                    for (let k = 0; k < count; k++) {
                        const height = h * (.60 + (0, geometry_1.hash)(index * 7 + k, 317) * .46);
                        const lean = (k - (count - 1) / 2) * height * .115 + height * (.07 + (0, geometry_1.hash)(index, 331) * .16);
                        const topX = x + lean, topY = y - height;
                        stems += `M${x} ${y} Q${x + lean * .24} ${y - height * .57} ${topX} ${topY} `;
                        for (let j = 0; j < 6; j++)
                            for (const side of [-1, 1]) {
                                // Attachment points lie on the stem's quadratic curve, including its lean.
                                const t = .09 + j * .071 + (0, geometry_1.hash)(index * 47 + k * 13 + j + side, 337) * .026, u = 1 - t;
                                const axisX = x + lean * (.48 * u * (1 - u) + u * u), axisY = y - height * (1.14 * u * (1 - u) + u * u);
                                const spread = height * (.025 + Math.sin(t / .54 * Math.PI) * .115) * (.60 + (0, geometry_1.hash)(index * 31 + k * 7 + j + side, 349) * .60);
                                const rise = height * (.045 + (0, geometry_1.hash)(index * 47 + k * 11 + j + side, 353) * .070);
                                const tipX = axisX + side * spread, tipY = axisY - rise;
                                branches += `M${axisX} ${axisY} Q${axisX + side * spread * .72} ${axisY - rise * .42} ${tipX} ${tipY} `;
                                const forkX = axisX + side * spread * .61, forkY = axisY - rise * .46;
                                branches += `M${forkX} ${forkY} q${side * spread * .03} ${-rise * .51} ${side * spread * .22} ${-rise * .75} `;
                                const radius = height * (near ? .0065 : .006);
                                seeds += `M${tipX - radius} ${tipY} a${radius} ${radius * .66} 0 1 0 ${radius * 2} 0 a${radius} ${radius * .66} 0 1 0 ${-radius * 2} 0 `;
                            }
                        const bladeSide = k % 2 ? 1 : -1, bladeX = x + bladeSide * height * (.13 + k * .022), bladeY = y - height * (.34 + k * .033);
                        blades += `M${x} ${y} Q${x + bladeSide * height * .045} ${bladeY + height * .12} ${bladeX} ${bladeY} Q${x + bladeSide * height * .025} ${y - height * .15} ${x} ${y} Z `;
                    }
                    curve(stems, mood('#98758F', .43), 0, 0, 1, 1, near ? .66 : .46, near ? 1.15 : .85);
                    curve(branches, index % 3 ? mood('#E9B2C9', .38) : pinkPale, 0, 0, 1, 1, near ? .77 : .58, near ? .95 : .7);
                    curve(seeds, index % 3 ? pinkPale : light('#E5A9C2'), 0, 0, 1, 1, near ? .69 : .49);
                    curve(blades, mood(index % 3 ? '#8C8D7F' : '#A48C8E', .46), 0, 0, 1, 1, near ? .68 : .42);
                    animate(start, { pivot: [X(x / 1000), Y(y / 1000)], phase: index * .83, speed: .7 + (0, geometry_1.hash)(index, 353) * .18, rotate: near ? 5 : 3.5 });
                };
                // Perspective bands avoid a repeated fence of equally tall stems along the horizon.
                for (let i = 0; i < 64; i++) {
                    const x = 16 + (0, geometry_1.hash)(i, 359) * 984, y = 673 + (0, geometry_1.hash)(i, 367) * 159;
                    const pathCenter = y < 700 ? 578 - (y - 658) * 1.05 : 534 - (y - 700) * .91;
                    if (Math.abs(x - pathCenter) < (y - 630) * .24 + 16)
                        continue;
                    tuft(x, y, 23 + (y - 655) * .28, i, false);
                }
                for (const [i, [x, y, h]] of [
                    [14, 890, 139], [71, 857, 116], [146, 883, 139], [198, 863, 97], [253, 928, 137], [323, 879, 93], [372, 942, 109],
                    [657, 890, 91], [730, 912, 146], [804, 861, 108], [877, 918, 156], [951, 872, 117], [1006, 923, 147],
                    [-6, 1051, 183], [62, 991, 146], [131, 1074, 205], [213, 1027, 157], [293, 1081, 172], [344, 1018, 112],
                    [683, 1044, 138], [737, 998, 128], [828, 1090, 225], [906, 1024, 151], [996, 1078, 203],
                ].entries())
                    tuft(x, y, h, i + 80, true);
                // A few earth-coloured grains sit on the wide near bend, never across its vanishing point.
                for (const [x, y, rx, ry] of [[475, 889, 3, 1.4], [501, 937, 4, 1.7], [473, 998, 5, 1.8], [562, 981, 3, 1.3], [528, 1034, 6, 2]])
                    oval(x / 1000, y / 1000, rx / 1000, ry / 1000, mood('#C6AA9A', .44), .55);
            }
            else if (kind === 'planet-parade') {
                scatter(46, .02, .95, true);
                // One tilted ring has a hidden back half and a visible front half.
                const ringArc = (start, end) => (0, ink_1.polyline)(Array.from({ length: 65 }, (_, i) => {
                    const a = start + (end - start) * i / 64, xx = Math.cos(a) * M * .19, yy = Math.sin(a) * M * .036, tilt = -.28;
                    return [X(.27) + xx * Math.cos(tilt) - yy * Math.sin(tilt), Y(.33) + xx * Math.sin(tilt) + yy * Math.cos(tilt)];
                }));
                add(ringArc(0, Math.PI * 2), mood('#CEADB9', .18), .85, M * .009);
                circle(.27, .33, .103, light('#EDBFAC'));
                const smallDisk = parts[parts.length - 1].path, startBands = parts.length;
                oval(.27, .31, .11, .014, light('#E8C6AF'), .8);
                oval(.27, .35, .11, .016, mood('#C694A7', .15), .65);
                for (let i = startBands; i < parts.length; i++)
                    parts[i].clip = smallDisk;
                add(ringArc(0, Math.PI), light('#F1D7B7'), .95, M * .010);
                circle(.72, .19, .043, light('#BCDCCE'));
                circle(.88, .67, .24, mood((0, color_1.mix)(accent, '#D79ABC', .45), .14));
                const largeDisk = parts[parts.length - 1].path, startLarge = parts.length;
                oval(.88, .64, .25, .026, light('#EDB5CB'), .5);
                oval(.88, .72, .25, .021, light('#BA9CD4'), .6);
                for (let i = startLarge; i < parts.length; i++)
                    parts[i].clip = largeDisk;
                poly([[-.1, .98], [.11, .86], [.29, .9], [.48, .83], [.67, .99], [1.1, 1.1], [-.1, 1.1]], mood('#8A82AC'), true);
            }
            else if (kind === 'milky-river') {
                // A broad diagonal star cloud, made from cached translucent dust patches.
                // Tiny stars are batched into four paths instead of hundreds of moving layers.
                const haze = (x, y, r, c, alpha) => {
                    for (let j = 0; j < 18; j++) {
                        const size = r * (1 - j * .055);
                        add(react_native_skia_1.Skia.PathBuilder.Make().addOval(react_native_skia_1.Skia.XYWHRect(X(x - size), Y(y - size * .76), W * size * 2, H * size * 1.52)).build(), light(c), alpha * (.3 + j * .037));
                    }
                };
                for (let i = 0; i < 24; i++) {
                    const t = i / 23, x = .94 - t * .80 + .033 * Math.sin(i * .83), y = .035 + t * .705;
                    const r = .16 + .063 * Math.sin(t * Math.PI) + (0, geometry_1.hash)(i, 811) * .025;
                    haze(x, y, r, i % 4 === 0 ? '#BEA2CF' : i % 3 === 0 ? '#8BC6CB' : '#A7B5D4', .019);
                }
                for (let i = 0; i < 36; i++) {
                    const t = i / 35, x = .94 - t * .80 + .014 * Math.sin(i * .65), y = .038 + t * .697;
                    haze(x, y, .068 + .04 * Math.sin(t * Math.PI), i % 7 < 2 ? '#EBCDDD' : '#D4E4DD', .015);
                }
                for (const [x, y, r] of [[.73, .19, .057], [.64, .30, .073], [.45, .46, .076], [.31, .59, .066], [.19, .71, .048]])
                    haze(x - .065, y - .018, r, '#C7A4CB', .019);
                for (const [x, y, r] of [[.8, .15, .045], [.56, .37, .049], [.38, .52, .043], [.24, .66, .04]])
                    haze(x + .072, y + .005, r, '#23364F', .032);
                for (let group = 0; group < 4; group++) {
                    const stars = react_native_skia_1.Skia.PathBuilder.Make();
                    for (let i = group; i < 1040; i += 4) {
                        const t = (0, geometry_1.hash)(i, 887), offset = ((0, geometry_1.hash)(i, 891) + (0, geometry_1.hash)(i, 897) - 1) * (.11 + .16 * Math.sin(t * Math.PI));
                        const x = .94 - t * .80 + offset, y = .035 + t * .705 + offset * .68;
                        stars.addCircle(X(x), Y(y), M * (.0007 + (0, geometry_1.hash)(i, 901) * .00085));
                    }
                    add(stars.build(), light(group === 0 ? '#B7DDE6' : group === 1 ? '#D9C6E3' : '#F0EADF'), .43 + group * .14);
                }
                const field = react_native_skia_1.Skia.PathBuilder.Make();
                for (let i = 0; i < 125; i++)
                    field.addCircle(X((0, geometry_1.hash)(i, 921)), Y((0, geometry_1.hash)(i, 931) * .8), M * (.00065 + (0, geometry_1.hash)(i, 947) * .0006));
                add(field.build(), light('#D3DEED'), .64);
                for (const [x, y, r] of [[.81, .1, .0021], [.69, .265, .0025], [.56, .38, .002], [.39, .52, .0024], [.22, .70, .0021], [.12, .31, .002], [.48, .12, .002], [.84, .59, .0024]]) {
                    haze(x, y, .012, '#DDE5EE', .023);
                    const start = parts.length;
                    add(react_native_skia_1.Skia.PathBuilder.Make().addCircle(X(x), Y(y), M * r).build(), light('#FAF1DF'), .95);
                    animate(start, { pivot: [X(x), Y(y)], phase: x * 13 + y * 9, speed: .72, shimmer: .55 });
                }
                curve('M-20 807 Q30 771 70 753 L117 711 L151 720 L197 677 Q224 660 253 686 L296 724 L328 716 L387 761 Q430 750 475 789 L520 808 L1020 820 L1020 1050 L-20 1050 Z', mood('#384F67', .3));
                curve('M70 753 L117 711 L151 720 L197 677 Q224 660 253 686 L221 692 L199 716 L161 735 L141 734 L114 764 Z', mood('#516079', .3));
                curve('M650 818 Q711 751 761 749 L806 705 Q830 692 851 711 L899 752 Q951 738 1020 775 L1020 1050 L650 1050 Z', mood('#344C65', .3));
                curve('M806 705 Q830 692 851 711 L899 752 L947 763 L886 773 L849 747 L821 730 L773 768 Z', mood('#485C74', .3));
                curve('M-20 825 Q223 791 437 816 Q665 789 1020 811 L1020 1050 L-20 1050 Z', mood('#547B8B', .38));
                curve('M396 817 Q517 805 623 817 Q553 842 574 863 Q642 880 700 869 Q584 913 427 877 Q478 854 396 817 Z', light('#9FAEC2'), 0, 0, 1, 1, .13);
                curve('M-20 842 Q91 843 187 879 Q267 920 351 931 Q256 925 147 910 Q53 887 -20 903 Z', mood('#3A5866', .33));
                curve('M1020 864 Q908 852 805 914 Q736 952 652 978 Q869 924 1020 933 Z', mood('#344E61', .3));
                for (const [x, y, w] of [[.47, .839, .095], [.56, .86, .13], [.52, .891, .16], [.58, .933, .21]]) {
                    line([[x - w * .5, y], [x + w * .5, y]], light('#C2CFDB'), .0016, .3);
                    parts[parts.length - 1].motion = { pivot: [X(x), Y(y)], phase: y * 17, speed: .38, dy: M * .009, shimmer: .4 };
                }
            }
            else if (kind === 'moon-surface') {
                scatter(27, .045, .53, true);
                circle(.28, .255, .109, light('#B9D6D5'), .23);
                circle(.28, .255, .103, light('#6EA6BA'));
                const earth = parts[parts.length - 1].path;
                const planet = (svg, c, alpha = 1) => {
                    const path = react_native_skia_1.Skia.Path.MakeFromSVGString(svg);
                    path.transform([M * .00103, 0, X(.28), 0, M * .00103, Y(.255), 0, 0, 1]);
                    add(path, c, alpha);
                    parts[parts.length - 1].clip = earth;
                };
                planet('M-79 -47 Q-68 -60 -52 -65 Q-38 -66 -31 -57 Q-27 -46 -21 -42 Q-23 -34 -36 -28 Q-37 -21 -31 -13 Q-34 -5 -47 -4 Q-44 6 -49 17 L-57 11 Q-62 1 -63 -14 Q-77 -10 -79 -22 Z', light('#B8C8A0'));
                planet('M-25 -9 Q-13 -14 -2 -5 Q0 6 16 11 Q20 21 12 34 Q4 42 -5 45 Q-3 61 -11 67 L-23 76 Q-25 63 -28 55 Q-43 44 -37 38 Q-41 22 -33 14 Z', light('#AAC49A'));
                planet('M30 -60 Q44 -70 56 -67 Q69 -59 79 -46 Q80 -35 64 -28 Q56 -16 43 -20 L36 -34 Q28 -29 20 -39 Z', light('#B6CAA5'));
                planet('M26 -103 C107 -76 129 31 56 84 C22 103 6 104 -12 100 C49 66 65 11 54 -34 Q46 -73 26 -103 Z', light('#315E7D'), .48);
                curve('M-20 626 L52 594 Q91 558 128 578 L173 551 Q210 528 251 559 L299 592 Q345 581 381 596 L441 567 Q480 544 510 566 L568 599 Q650 581 720 607 L794 581 Q842 566 879 584 L1020 618 L1020 1050 L-20 1050 Z', mood('#9697AD', .3));
                curve('M52 594 Q91 558 128 578 L173 551 Q210 528 251 559 Q212 564 198 590 L159 607 L97 628 Z', mood('#C0BFCA', .3));
                curve('M441 567 Q480 544 510 566 L568 599 L519 600 Q486 583 461 592 L407 620 Z', mood('#B8B7C3', .3));
                curve('M-20 733 Q172 658 357 693 Q517 624 675 659 Q833 630 1020 688 L1020 1050 L-20 1050 Z', mood('#C4C1CB', .28));
                curve('M-20 846 Q173 756 334 787 Q536 714 684 767 Q870 716 1020 763 L1020 1050 L-20 1050 Z', mood('#D8D2D0', .28));
                const crater = (x, y, rx, ry) => {
                    if (rx < 80) {
                        curve('M-1 0 Q-.7 -.65 .09 -.62 Q.83 -.54 1 .02 Q.7 .52 -.08 .49 Q-.82 .45 -1 0 Z', mood('#ABA6B8', .32), x, y, rx, ry);
                        curve('M-.79 .05 Q-.31 -.15 .14 -.03 Q.49 .03 .87 -.01 Q.59 .44 -.13 .38 Q-.57 .36 -.79 .05 Z', mood('#C9C4CE', .29), x, y, rx, ry);
                        return;
                    }
                    curve('M-1.15 .13 Q-1.2 -.45 -.67 -.79 Q0 -1.11 .74 -.65 Q1.24 -.22 1.18 .25 Q.76 1.05 -.13 1.12 Q-.93 1.04 -1.15 .13 Z', mood('#C4BEC8', .3), x, y, rx, ry);
                    curve('M-1 0 C-.96 -.71 -.34 -.97 .22 -.86 C.76 -.82 1.05 -.44 1 .03 C.91 .65 .37 .84 -.22 .78 C-.76 .76 -1.06 .44 -1 0 Z', mood('#CDC6CE', .29), x, y, rx, ry);
                    curve('M-.89 -.01 C-.82 -.6 -.3 -.76 .22 -.67 C.73 -.59 .92 -.28 .88 .04 C.8 .51 .23 .68 -.26 .57 C-.65 .48 -.92 .28 -.89 -.01 Z', mood('#9893AA', .32), x, y, rx, ry);
                    curve('M-.72 .02 Q-.33 -.22 .16 -.04 Q.53 .12 .86 .01 Q.74 .45 .23 .55 Q-.38 .68 -.65 .34 Z', mood('#C3BDCA', .3), x, y, rx, ry);
                    curve('M-.99 .03 Q-.91 -.61 -.12 -.85 Q-.61 -.55 -.75 -.06 Q-.82 .21 -.69 .40 Q-.95 .29 -.99 .03 Z', mood('#E7DED5', .27), x, y, rx, ry);
                    curve('M-.98 .15 Q-.63 .71 -.05 .76 Q.55 .8 .99 .1 Q.81 .87 .12 .97 Q-.7 .98 -.98 .15 Z', mood('#D8D1D0', .27), x, y, rx, ry);
                };
                crater(648, 650, 28, 8);
                crater(821, 693, 66, 19);
                crater(220, 820, 173, 64);
                crater(571, 773, 48, 14);
                crater(837, 1017, 259, 101);
                curve('M-20 1030 L-20 950 Q112 893 241 925 Q437 860 592 906 Q453 935 391 1016 L391 1050 Z', mood('#C9C3CA', .28));
                for (const [x, y, r] of [[477, 884, 19], [412, 945, 31], [89, 982, 24], [708, 837, 12], [899, 764, 9]]) {
                    oval(x / 1000 + .008, y / 1000 + .006, r / 1000 * 1.1, r / 1000 * .25, mood('#ACA6B5', .32), .65);
                    curve('M-1 .1 L-.8 -.43 L-.22 -.77 L.5 -.56 L.95 -.08 L.51 .25 L-.42 .27 Z', mood('#AAA7B5', .3), x, y, r, r * .75);
                    curve('M-.8 -.43 L-.22 -.77 L.5 -.56 L.15 -.17 L-.4 -.08 Z', mood('#E3DCD5', .27), x, y, r, r * .75);
                }
                for (const [x, y, r] of [[351, 877, 3], [387, 826, 2], [640, 862, 3], [296, 976, 4], [663, 731, 2], [481, 959, 3], [922, 896, 4]])
                    oval(x / 1000, y / 1000, r / 1000, r / 2200, mood('#ABA5B2', .3), .7);
            }
            else if (kind === 'coral-arches') {
                poly([[-.1, .57], [1.1, .57], [1.1, 1.1], [-.1, 1.1]], sea);
                // The rock silhouettes hide the short, scattered water reflections.
                for (let i = 0; i < 10; i++) {
                    const x = .40 + (i * 19 % 37) / 100, y = .71 + (i * 13 % 27) / 100;
                    ripple(x, y, .035 + (i % 3) * .015, light('#CBE9DC'), i * 1.4);
                }
                poly([[-.1, -.1], [.17, -.1], [.35, .13], [.40, .39], [.32, .66], [.24, .93], [.08, 1.1], [-.1, 1.1]], mood('#C77C80'), true);
                poly([[-.1, .03], [.15, .07], [.28, .22], [.26, .41], [.10, .54], [-.1, .65]], mood('#E7B195'), true);
                poly([[.9, 1.1], [.88, .80], [.97, .61], [1.1, .65], [1.1, 1.1]], mood('#EBAE9B'), true);
                poly([[.49, .64], [.56, .48], [.66, .44], [.75, .48], [.81, .64], [.71, .64], [.68, .55], [.62, .53], [.58, .64]], mood('#C594BA'), true);
                poly([[.51, .61], [.56, .48], [.66, .44], [.74, .48], [.70, .49], [.65, .48], [.59, .52], [.55, .63]], mood('#DCB5B6'), false, .7);
                poly([[.18, .09], [.31, .24], [.34, .42], [.28, .58], [.30, .39], [.25, .27]], mood('#AE697A'), false, .55);
            }
            else if (kind === 'rain-canopy') {
                poly([[-.05, .46], [.18, .37], [.50, .47], [.82, .36], [1.05, .46], [1.05, 1.08], [-.05, 1.08]], mood('#9DAFB7'), true);
                poly([[-.08, .83], [.34, .70], [.72, .78], [1.08, .64], [1.08, 1.1], [-.08, 1.1]], green, true);
                oval(.56, .91, .35, .13, sea);
                oval(.55, .9, .16, .035, light('#B9D8D0'), .4);
                for (const [x, y, s, dir] of [[.03, .04, .57, 1], [.96, .06, .64, -1], [.10, .50, .38, 1], [.97, .58, .30, -1]]) {
                    poly([[x, y], [x + dir * s * .8, y + .04], [x + dir * s, y + .22], [x + dir * s * .5, y + .27], [x, y + .12]], deep, true);
                    line([[x, y + .06], [x + dir * s * .8, y + .17]], mood('#A6C4A2'), .005, .6);
                }
                for (let i = 0; i < 21; i++) {
                    const x = .1 + (i * 13 % 81) / 100, y = .28 + (i * 19 % 51) / 100;
                    line([[x, y], [x - .012, y + .042]], light('#D4E0DF'), .0025, .42);
                }
                for (let i = 0; i < 5; i++) {
                    const x = .29 + i * .10, y = .76 + (i % 2) * .045;
                    star(x, y, .006, '#E4E8A3');
                }
            }
            else if (kind === 'blue-grotto') {
                poly([[-.1, -.1], [1.1, -.1], [1.1, 1.1], [-.1, 1.1]], mood('#514F71', .3));
                poly([[.05, 1.1], [.10, .55], [.20, .35], [.34, .20], [.56, .15], [.75, .25], [.88, .45], [.94, .75], [.87, 1.1]], mood('#9692BB', .32), false);
                poly([[.25, 1.1], [.26, .61], [.32, .45], [.46, .34], [.63, .36], [.73, .51], [.76, .72], [.71, 1.1]], light('#A4DBD3'), true);
                poly([[.10, .55], [.20, .35], [.34, .20], [.42, .27], [.30, .39], [.24, .58], [.20, .84]], mood('#77759D', .28), false);
                poly([[.56, .15], [.75, .25], [.88, .45], [.78, .40], [.69, .29], [.53, .26], [.42, .27]], mood('#B4ABCB', .3), false);
                poly([[.73, .51], [.78, .40], [.88, .45], [.94, .75], [.85, .82], [.79, .61]], mood('#787598', .27), false);
                poly([[-.1, .84], [.2, .76], [.39, .79], [.60, .75], [1.1, .84], [1.1, 1.1], [-.1, 1.1]], sea, true);
                for (let i = 0; i < 17; i++) {
                    const y = .795 + (i * 17 % 24) / 100, x = .52 + Math.sin(i * 2.1) * (.06 + (y - .79) * .55);
                    ripple(x, y, .035 + (i % 4) * .016, light('#CBF4E7'), i * 1.17);
                }
                poly([[-.1, .79], [.12, .78], [.24, .89], [.30, 1.1], [-.1, 1.1]], mood('#655D80'), false);
                poly([[.76, 1.1], [.84, .85], [1.1, .77], [1.1, 1.1]], mood('#85709B'), false);
                poly([[.84, .85], [1.1, .77], [1.1, .84], [.87, .92]], mood('#A795B7'), false, .48);
                poly([[-.1, .79], [.12, .78], [.24, .89], [.10, .84]], mood('#9C91B2'), false, .4);
                for (const [x, y] of [[.12, .65], [.86, .7], [.83, .47]]) {
                    glow(x, y, .009, '#B9ECD9');
                    star(x, y, .005, '#D0F2DC', false);
                }
            }
            else if (kind === 'golden-reeds') {
                poly([[-.1, .57], [1.1, .57], [1.1, 1.1], [-.1, 1.1]], mood('#729A95'));
                poly([[.40, .59], [.52, .58], [.72, .78], [.62, 1.1], [.22, 1.1], [.53, .82]], sea, true);
                for (let i = 0; i < 22; i++) {
                    const start = parts.length;
                    const x = i < 11 ? .01 + i * .028 : .70 + (i - 11) * .031, y = .58 + (i % 5) * .07, top = y - .15 - (i % 3) * .04;
                    line([[x + .04, 1.08], [x, y]], mood('#AA9F69'), .005);
                    line([[x, y], [x - .03, top]], mood('#D3B877', .28), .003);
                    for (let j = 0; j < 6; j++) {
                        const t = j / 6, xx = x - .03 * t, yy = y + (top - y) * t, spread = .015 * (1 - t * .6);
                        line([[xx - spread, yy - .025], [xx, yy], [xx + spread, yy - .020]], mood('#E8C989', .28), .003, .85);
                    }
                    line([[x + .01, y + .20], [x - .05, y + .1]], green, .01);
                    animate(start, { pivot: [X(x + .04), Y(1.08)], phase: i * .7, speed: .9, rotate: 6 });
                }
                for (let i = 0; i < 12; i++) {
                    const x = .18 + (i * 17 % 61) / 100, y = .28 + (i * 23 % 53) / 100;
                    glow(x, y, .005, '#FFE5A5');
                    star(x, y, .004, '#FFE8AD', false);
                }
            }
            else if (kind === 'glowing-tide') {
                // A horizon anchors the bay; the luminous tide rolls toward a curved foreground beach.
                const ocean = mood((0, color_1.mix)('#4A8998', land, .34), .43), wet = mood('#839DAD', .34), sand = mood('#C6B8C0', .35);
                poly([[-.05, .49], [1.05, .49], [1.05, 1.07], [-.05, 1.07]], ocean);
                poly([[-.05, .505], [.07, .42], [.20, .445], [.30, .51]], mood('#547485', .4), true);
                poly([[.77, .5], [.89, .45], [1.05, .47], [1.05, .54]], mood('#7F9DA7', .38), true);
                poly([[-.06, .76], [.12, .795], [.28, .865], [.48, .91], [.72, .90], [1.06, .83], [1.06, 1.07], [-.06, 1.07]], sand, true);
                poly([[-.06, .752], [.13, .774], [.31, .843], [.49, .871], [.71, .863], [1.06, .799], [1.06, .849], [.72, .908], [.48, .923], [.28, .882], [.10, .819], [-.06, .79]], wet, true);
                const wave = [[-.06, .752], [.12, .781], [.30, .845], [.49, .884], [.71, .879], [.9, .847], [1.06, .817]];
                const swell = [[-.06, .657], [.17, .680], [.35, .733], [.55, .758], [.77, .733], [1.06, .701]];
                const startWave = parts.length;
                line((0, geometry_1.catmull)(wave, false, 10), light('#70CDBF'), .037, .17);
                line((0, geometry_1.catmull)(wave, false, 10), light('#A4E8D9'), .009, .90);
                line((0, geometry_1.catmull)(swell, false, 10), light('#8ED2D8'), .018, .09);
                line((0, geometry_1.catmull)(swell, false, 10), light('#9DDEE0'), .004, .56);
                animate(startWave, { pivot: [X(.5), Y(.84)], phase: 0, speed: .85, dy: M * .012, shimmer: .48 });
                for (let i = 0; i < 24; i++) {
                    const x = .035 + i * .043, y = .758 + Math.sin(Math.min(1, x) * Math.PI * .84) * .127 + (i % 3) * .009;
                    oval(x, y, .0027 + i % 3 * .0015, .0018, light('#C5EEE2'), .66);
                    parts[parts.length - 1].motion = { pivot: [X(x), Y(y)], phase: i * .7, speed: .63, shimmer: .38 };
                }
                for (const [x, y, w] of [[.36, .557, .07], [.60, .586, .085], [.20, .625, .058], [.77, .639, .095]]) {
                    line([[x, y], [x + w, y]], light('#A6CED8'), .0025, .38);
                    parts[parts.length - 1].motion = { pivot: [X(x), Y(y)], phase: x * 10, speed: .85, flow: M * .023 };
                }
                poly([[.105, .966], [.12, .928], [.167, .921], [.203, .95], [.193, .978], [.146, .987]], mood('#71838F'), true);
                poly([[.123, .928], [.166, .921], [.189, .941], [.159, .95]], mood('#9DA7AB'), true);
            }
            else {
                scatter(23, .035, .69, true);
                // One folded curtain: the mint lower edge fades upward into violet air.
                const edge = (x) => .335 - .118 * Math.sin((x + .09) * 5.5) + .033 * Math.sin(x * 10);
                const curtainStart = parts.length;
                for (let layer = 0; layer < 22; layer++) {
                    const t = layer / 21, upper = [], lower = [];
                    for (let i = 0; i <= 48; i++) {
                        const x = -.10 + i * .025, base = edge(x), height = .11 + .16 * Math.sin((x + .12) * Math.PI) ** 2;
                        upper.push([x, base - height * (1 - t)]);
                        lower.push([x, base + .008 + .012 * Math.sin(x * 6)]);
                    }
                    poly([...upper, ...lower.reverse()], light(layer < 7 ? '#BA9FD8' : layer < 14 ? '#79C9C2' : '#BBEBD2'), true, .021 + Math.pow(t, 3) * .031);
                }
                for (let i = 0; i < 31; i++) {
                    const x = .06 + i * .031, base = edge(x), h = .095 + .075 * (.5 + .5 * Math.sin(i * 1.7));
                    poly([[x - .002, base], [x - .024, base - h], [x - .021, base - h * 1.06], [x + .003, base - .008]], light(i % 3 ? '#AADACC' : '#C7AEDB'), true, .023 + i % 4 * .004);
                }
                animate(curtainStart, { pivot: [X(.5), Y(.28)], phase: .35, speed: .32, dy: M * .024, shimmer: .22 });
                const second = parts.length;
                for (let j = 0; j < 9; j++)
                    curve('M510 335 Q664 257 808 301 Q925 352 1050 294 Q939 380 804 334 Q670 292 510 335 Z', light(j < 4 ? '#C2A7D7' : '#91CCC1'), 0, -j * 4, 1, 1, .026);
                animate(second, { pivot: [X(.78), Y(.32)], phase: 1.9, speed: .26, dy: M * .016, shimmer: .25 });
                curve('M-20 790 L45 768 L84 732 L120 740 L170 693 Q187 681 205 701 L251 728 L291 722 L344 768 L414 778 L479 752 L529 715 L563 724 L612 682 Q635 674 653 696 L707 739 L747 731 L801 756 L872 715 L914 727 L959 710 L1020 752 L1020 1050 L-20 1050 Z', mood('#91A9BB', .37));
                curve('M84 732 L120 740 L170 693 Q187 681 205 701 L190 706 L181 726 L159 721 L148 741 L109 765 L75 771 Z', mood('#CAD6DB', .3));
                curve('M529 715 L563 724 L612 682 Q635 674 653 696 L635 696 L621 718 L602 713 L589 747 L562 757 L538 754 L501 780 Z', mood('#DBE0DC', .3));
                curve('M612 682 Q635 674 653 696 L707 739 L688 751 L670 728 L651 729 L634 706 Z', mood('#819DB4', .34));
                curve('M-20 837 Q110 779 265 801 Q397 861 559 807 Q763 761 1020 804 L1020 1050 L-20 1050 Z', mood('#CADADC', .31));
                curve('M-20 837 Q110 779 265 801 Q397 861 559 807 Q383 889 210 839 Q81 823 -20 866 Z', mood('#A5BECF', .34));
                curve('M-20 956 Q123 871 336 910 Q544 947 708 865 Q855 822 1020 875 L1020 1050 L-20 1050 Z', mood('#E4E5DE', .29));
                curve('M380 961 Q566 957 708 865 Q855 822 1020 875 Q874 852 777 893 Q582 986 380 961 Z', mood('#B5D0D0', .31));
                // A small rooted spruce grove gives the luminous sky a quiet scale reference.
                for (const [x, y, h] of [[57, 885, 97], [98, 902, 141], [143, 901, 109], [184, 913, 72], [881, 868, 56], [919, 881, 83], [953, 889, 66]]) {
                    curve('M0 0 L-3 -12 L-19 -8 L-10 -24 L-25 -22 L-12 -42 L-21 -38 L-9 -60 L-15 -58 L0 -100 L10 -68 L8 -63 L20 -42 L12 -45 L26 -21 L13 -23 L23 -8 L4 -11 L3 0 Z', mood('#547586', .37), x, y, h / 100, h / 100);
                    curve('M0 -100 L0 -70 L-6 -58 L-1 -63 L-4 -44 L-13 -37 L-6 -37 L-10 -25 L-18 -21 L-5 -24 L0 -4 L-1 -42 L3 -67 Z', mood('#B2CFD1', .34), x, y, h / 100, h / 100, .8);
                }
            }
            return { parts, moving: (0, scenery_motion_1.prepareSceneryMotion)(parts.map(p => ({ ...p, colors: p.color }))), bounds: B, skies, composition: info.composition };
        },
        back: (g, b, e) => {
            const f = (0, ink_1.ink)(g);
            f.rect(B.x0 - 2, B.y0 - 2, W + 4, H + 4, (0, color_1.byTod)(b.skies, e.tod));
            for (const part of b.parts) {
                if (part.motion || (part.nightOnly && e.tod !== 2))
                    continue;
                if (part.clip) {
                    g.save();
                    g.clipPath(part.clip, 1, true);
                }
                const color = (0, color_1.byTod)(part.color, e.tod);
                if (part.stroke)
                    f.stroke(part.path, color, part.stroke, part.alpha);
                else
                    f.fill(part.path, color, part.alpha);
                if (part.clip)
                    g.restore();
            }
        },
        frame: (g, b, e) => {
            'worklet';
            (0, scenery_motion_1.drawSceneryMotion)(g, b.moving, e);
        },
    });
}

}, {"@shopify/react-native-skia":"design/prototype-editorial/lab/drawn-web/skia-canvas2d.js","../../core/color":"src/world/drawn/core/color.ts","../../core/geometry":"src/world/drawn/core/geometry.ts","../../core/ink":"src/world/drawn/core/ink.ts","../types":"src/world/drawn/room/types.ts","../scenery-motion":"src/world/drawn/room/scenery-motion.ts"}],
"src/world/drawn/room/scenery-motion.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareSceneryMotion = prepareSceneryMotion;
exports.drawSceneryMotion = drawSceneryMotion;
const color_1 = require("../core/color");
const ink_1 = require("../core/ink");
/** Retain authored depth: later opaque terrain/objects still cover moving water, stars and foliage. */
function prepareSceneryMotion(parts) {
    return parts.flatMap((part, index) => part.motion ? [{ part, occluders: (0, ink_1.joined)(parts.slice(index + 1)
                .filter(q => !q.motion && !q.stroke && (q.alpha ?? 1) > .85 && !q.nightOnly).map(q => q.clip ?? q.path)) }] : []);
}
function drawSceneryMotion(g, layers, env) {
    'worklet';
    const f = (0, ink_1.ink)(g), time = env.reduced ? 0 : env.now;
    for (const layer of layers) {
        const p = layer.part, m = p.motion;
        if (p.nightOnly && env.tod < 1.5)
            continue;
        const flow = m.flow, isFlow = flow !== undefined;
        let dx = 0, dy = 0, wave = 0, alpha = p.alpha ?? 1;
        if (isFlow) {
            const progress = ((time * m.speed + m.phase) / (Math.PI * 2)) % 1;
            dy = env.reduced ? 0 : flow * (progress - .5);
            alpha *= env.reduced ? .8 : Math.sin(progress * Math.PI);
        }
        else {
            wave = env.reduced ? 0 : (Math.sin(time * m.speed + m.phase) - Math.sin(m.phase)) * .5;
            dx = (m.dx ?? 0) * wave;
            dy = (m.dy ?? 0) * wave;
            alpha *= 1 - (m.shimmer ?? 0) * (1 - Math.cos(time * m.speed + m.phase)) * .5;
        }
        g.save();
        g.clipPath(layer.occluders, 0, true);
        if (p.clip)
            g.clipPath(p.clip, 1, true);
        g.translate(m.pivot[0] + dx, m.pivot[1] + dy);
        if (!isFlow && m.rotate)
            g.rotate(m.rotate * wave, 0, 0);
        if (!isFlow && m.stretch)
            g.scale(1 + m.stretch * wave, 1);
        g.translate(-m.pivot[0], -m.pivot[1]);
        if (p.stroke)
            f.stroke(p.path, (0, color_1.byTod)(p.colors, env.tod), p.stroke, alpha);
        else
            f.fill(p.path, (0, color_1.byTod)(p.colors, env.tod), alpha);
        g.restore();
    }
}

}, {"../core/color":"src/world/drawn/core/color.ts","../core/ink":"src/world/drawn/core/ink.ts"}],
"src/world/drawn/core/color.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.darken = exports.lighten = exports.multiply = exports.mix = exports.hex = exports.rgb = void 0;
exports.byTod = byTod;
const math_1 = require("@/shared/drawing/math");
const color_1 = require("@/shared/drawing/color");
var color_2 = require("@/shared/drawing/color");
Object.defineProperty(exports, "rgb", { enumerable: true, get: function () { return color_2.rgb; } });
Object.defineProperty(exports, "hex", { enumerable: true, get: function () { return color_2.hex; } });
Object.defineProperty(exports, "mix", { enumerable: true, get: function () { return color_2.mix; } });
Object.defineProperty(exports, "multiply", { enumerable: true, get: function () { return color_2.multiply; } });
Object.defineProperty(exports, "lighten", { enumerable: true, get: function () { return color_2.lighten; } });
Object.defineProperty(exports, "darken", { enumerable: true, get: function () { return color_2.darken; } });
/** 시간대 값(0 낮 · 1 노을 · 2 밤, 사이는 섞는다) */
function byTod(c, tod) {
    'worklet';
    const t = (0, math_1.clamp)(tod, 0, 2);
    return t <= 1 ? (0, color_1.mix)(c[0], c[1], t) : (0, color_1.mix)(c[1], c[2], t - 1);
}

}, {"@/shared/drawing/math":"src/shared/drawing/math.ts","@/shared/drawing/color":"src/shared/drawing/color.ts"}],
"src/world/drawn/core/geometry.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blob = exports.sharp = exports.soft = exports.fuzzy = exports.resample = exports.ellPts = exports.catmull = exports.hash = exports.ease = exports.clamp = exports.lerp = exports.TAU = void 0;
var geometry_1 = require("@/shared/drawing/geometry");
Object.defineProperty(exports, "TAU", { enumerable: true, get: function () { return geometry_1.TAU; } });
Object.defineProperty(exports, "lerp", { enumerable: true, get: function () { return geometry_1.lerp; } });
Object.defineProperty(exports, "clamp", { enumerable: true, get: function () { return geometry_1.clamp; } });
Object.defineProperty(exports, "ease", { enumerable: true, get: function () { return geometry_1.ease; } });
Object.defineProperty(exports, "hash", { enumerable: true, get: function () { return geometry_1.hash; } });
Object.defineProperty(exports, "catmull", { enumerable: true, get: function () { return geometry_1.catmull; } });
Object.defineProperty(exports, "ellPts", { enumerable: true, get: function () { return geometry_1.ellPts; } });
Object.defineProperty(exports, "resample", { enumerable: true, get: function () { return geometry_1.resample; } });
Object.defineProperty(exports, "fuzzy", { enumerable: true, get: function () { return geometry_1.fuzzy; } });
Object.defineProperty(exports, "soft", { enumerable: true, get: function () { return geometry_1.soft; } });
Object.defineProperty(exports, "sharp", { enumerable: true, get: function () { return geometry_1.sharp; } });
Object.defineProperty(exports, "blob", { enumerable: true, get: function () { return geometry_1.blob; } });

}, {"@/shared/drawing/geometry":"src/shared/drawing/geometry.ts"}],
"src/world/drawn/room/collections/scenery.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTION_SCENERY_LABELS = exports.COLLECTION_SCENERY_KINDS = void 0;
exports.makeCollectionScenery = makeCollectionScenery;
const color_1 = require("../../core/color");
const ink_1 = require("../../core/ink");
const layout_1 = require("../layout");
const scene_structure_1 = require("../scene-structure");
const scenery_motion_1 = require("../scenery-motion");
const types_1 = require("../types");
const art_paths_1 = require("./art-paths");
exports.COLLECTION_SCENERY_KINDS = ['collection-oasis-court', 'collection-crystal-mesa', 'collection-comet-observatory', 'collection-cloud-tea-village', 'collection-cloud-orchard'];
exports.COLLECTION_SCENERY_LABELS = {
    'collection-oasis-court': ['그늘이 드리운 안뜰', 'The shaded courtyard'],
    'collection-crystal-mesa': ['모래빛 지붕의 작은 마을', 'The sand-roof village'],
    'collection-comet-observatory': ['언덕 위 작은 관측소', 'The hilltop observatory'],
    'collection-cloud-tea-village': ['언덕 위 찻집 골목', 'The hillside tea lane'],
    'collection-cloud-orchard': ['낮은 담장 너머 과수원', 'The orchard beyond the wall'],
};
const SKIES = {
    'collection-oasis-court': ['#C8DDDA', '#E5C6B5', '#2B455E'],
    'collection-crystal-mesa': ['#D8DCCC', '#E5BC9F', '#394761'],
    'collection-comet-observatory': ['#BDD4DD', '#D4BBC8', '#253651'],
    'collection-cloud-tea-village': ['#CCDDE0', '#E8C9C5', '#3B4C67'],
    'collection-cloud-orchard': ['#D6E0D0', '#E5C9B6', '#334B60'],
};
function buildLandscape(kind, bounds, framing) {
    const parts = [];
    const mood = (c) => [c, (0, color_1.mix)(c, '#DCAD9E', .18), (0, color_1.mix)(c, '#21394F', .57)];
    const add = (svg, c, stroke = 0, alpha = 1, motion) => parts.push({ path: (0, art_paths_1.artPaths)({ p: svg }).p, colors: typeof c === 'string' ? mood(c) : c, stroke, alpha, ...(motion ? { motion } : {}) });
    const ellipse = (x, y, rx, ry, c, alpha = 1) => parts.push({ path: (0, ink_1.shapeOf)({ ell: [x, y, rx, ry], fz: [5100 + parts.length, 10, .35, .2] }), colors: typeof c === 'string' ? mood(c) : c, stroke: 0, alpha });
    const line = (pts, c, width = 3, alpha = 1) => add(pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '), c, width, alpha);
    const cloud = (svg, phase) => add(svg, ['#F5EFDA', '#F7DECB', '#6A8196'], 0, .86, { pivot: [500, 180], phase, speed: .21, dx: 62 });
    const glow = ['#B2C0AB', '#D8C499', '#F2D59C'];
    // Small botanical forms are attached to authored branches or ground patches.
    const sprig = (x, y, s, c) => {
        add(`M${x} ${y} Q${x + 9 * s} ${y - 18 * s} ${x + 27 * s} ${y - 32 * s}`, c, 1.8 * s);
        add(`M${x + 6 * s} ${y - 11 * s} Q${x - 10 * s} ${y - 29 * s} ${x - 4 * s} ${y - 35 * s} Q${x + 11 * s} ${y - 27 * s} ${x + 6 * s} ${y - 11 * s} Z M${x + 13 * s} ${y - 21 * s} Q${x + 18 * s} ${y - 41 * s} ${x + 28 * s} ${y - 42 * s} Q${x + 34 * s} ${y - 28 * s} ${x + 13 * s} ${y - 21 * s} Z M${x + 20 * s} ${y - 26 * s} Q${x + 39 * s} ${y - 29 * s} ${x + 44 * s} ${y - 20 * s} Q${x + 32 * s} ${y - 12 * s} ${x + 20 * s} ${y - 26 * s} Z`, c);
    };
    const grass = (x, y, s, c) => {
        add(`M${x - 19 * s} ${y} Q${x - 19 * s} ${y - 14 * s} ${x - 30 * s} ${y - 27 * s} Q${x - 7 * s} ${y - 18 * s} ${x - 5 * s} ${y - 2 * s} Q${x - 3 * s} ${y - 29 * s} ${x + 9 * s} ${y - 43 * s} Q${x + 5 * s} ${y - 18 * s} ${x + 9 * s} ${y - 2 * s} Q${x + 19 * s} ${y - 19 * s} ${x + 32 * s} ${y - 20 * s} Q${x + 20 * s} ${y - 8 * s} ${x + 22 * s} ${y} Z`, c);
    };
    for (const [i, [x, y]] of [[116, 141], [254, 83], [388, 184], [528, 91], [685, 133], [822, 72], [893, 232], [568, 261], [210, 316], [747, 296], [435, 316], [945, 371], [71, 257], [650, 55]].entries()) {
        parts.push({ path: (0, ink_1.shapeOf)({ ell: [x, y, i % 4 ? 2.5 : 4, i % 4 ? 2.5 : 4], fz: [8100 + i, 7, .1, .1] }), colors: ['#F5E9C5', '#F5E9C5', '#F5E9C5'], stroke: 0, nightOnly: true, motion: { pivot: [x, y], phase: i * 1.43, speed: .8 + i % 3 * .15, shimmer: .62 } });
    }
    if (kind === 'collection-oasis-court') {
        cloud('M417 182 Q457 153 493 171 Q537 141 575 177 Q615 162 648 196 L406 199 Z', 1.2);
        add('M-20 478 Q154 401 351 462 Q559 403 774 449 Q898 402 1020 459 L1020 1000 L-20 1000 Z', '#A8B89C');
        add('M-20 603 L1020 603 L1020 1000 L-20 1000 Z', '#DDC5A2');
        // An L-shaped building and rear arcade enclose a continuous paved court.
        add('M272 344 L770 344 L770 636 L272 636 Z', '#E8D6B6');
        add('M272 330 L752 330 L793 314 L793 329 L770 345 L272 345 Z', '#CBB18E');
        add('M268 328 L750 328 L793 312 L312 312 Z', '#F0DEC0');
        add('M272 345 L770 345 L770 361 L272 361 Z', '#C2AC8B', 0, .65);
        for (const x of [354, 552]) {
            add(`M${x} 637 L${x} 468 Q${x} 389 ${x + 65} 389 Q${x + 130} 389 ${x + 130} 468 L${x + 130} 637 Z`, '#8E947C');
            add(`M${x + 16} 636 L${x + 16} 468 Q${x + 16} 412 ${x + 68} 406 Q${x + 40} 428 ${x + 40} 470 L${x + 40} 636 Z`, '#6F7F6D');
            add(`M${x - 6} 633 L${x - 6} 468 Q${x - 6} 383 ${x + 65} 383 Q${x + 136} 383 ${x + 136} 468 L${x + 136} 633`, '#F0E2C4', 10);
            add(`M${x + 40} 635 L${x + 40} 582 L${x + 130} 582 L${x + 130} 635 Z`, '#ABB295');
            add(`M${x + 20} 635 L${x + 113} 607 L${x + 130} 623 L${x + 130} 638 Z`, '#C9BE9A');
        }
        add('M-20 239 L272 239 L272 697 L-20 697 Z', '#EDDEC0');
        add('M272 239 L313 260 L313 660 L272 697 Z', '#C4AC89');
        add('M-20 223 L274 223 L317 244 L272 251 L-20 241 Z', '#F4E7CC');
        add('M36 697 L36 444 Q36 353 118 353 Q200 353 200 444 L200 697 Z', '#9E9E81');
        add('M49 697 L49 445 Q49 370 118 367 Q83 393 83 451 L83 697 Z', '#79816B');
        add('M84 692 L84 455 Q84 400 132 399 Q183 400 183 455 L183 692 Z', '#A6AA8C');
        add('M29 693 L29 444 Q29 345 118 345 Q207 345 207 444 L207 693', '#F8EBD0', 13);
        line([[134, 405], [134, 686]], '#879179', 3);
        ellipse(159, 576, 4, 5, '#D6BE8C');
        add('M22 697 L211 697 L227 711 L17 711 Z', '#F2DFBB');
        add('M17 711 L227 711 L227 724 L17 724 Z', '#BCA785');
        add('M760 548 L1020 548 L1020 657 L760 657 Z', '#E6D7B8');
        add('M757 540 L1020 540 L1020 552 L757 552 Z', '#F5E8CB');
        add('M761 644 L1020 644 L1020 657 L761 657 Z', '#C7B693');
        add('M313 636 L755 636 L842 690 L359 676 Z', '#C6B697', 0, .7);
        add('M-20 727 L215 727 L331 764 L-20 832 Z', '#C2B18F', 0, .55);
        for (const [x, y, w, h] of [[340, 656, 111, 13], [504, 667, 125, 17], [731, 677, 82, 15], [42, 924, 77, 26], [953, 849, 66, 23]])
            add(`M${x} ${y} l${w} 0 l14 ${h} l${-w - 7} 0 Z`, '#E9D8B7', 0, .7);
        // Pool walls share their upper and lower edges; the water sits below the coping.
        add('M307 728 Q330 700 360 700 L730 700 Q774 700 798 727 L929 858 Q958 900 910 918 L213 918 Q163 900 194 865 Z', '#C1AB85');
        add('M373 722 L716 722 Q746 722 765 745 L876 865 Q893 887 865 893 L250 893 Q216 887 231 864 L338 749 Q349 722 373 722 Z', '#78AAA3');
        add('M373 722 L716 722 Q746 722 765 745 L776 757 Q739 743 710 743 L381 743 Q361 743 348 762 L338 749 Q349 722 373 722 Z', '#517E7A');
        add('M381 744 L503 744 L421 886 L267 886 Z', '#A4C9B9', 0, .45);
        add('M629 744 L704 744 L816 883 L730 883 Z', '#B3D0BB', 0, .3);
        add('M194 865 Q169 899 213 918 L910 918 Q946 909 939 884 L939 918 Q927 947 893 950 L229 950 Q183 946 183 917 Z', '#EBD8B5');
        line([[243, 923], [892, 923]], '#F7E7C8', 4, .8);
        for (const x of [314, 424, 534, 644, 754, 864])
            line([[x, 919], [x, 949]], '#C5AF88', 2.5, .65);
        for (const x of [419, 529, 639])
            line([[x, 702], [x, 721]], '#EBD7B3', 3);
        add('M430 842 Q489 838 533 842', ['#D0E0C7', '#E9D5B4', '#A9C5C1'], 3, .8, { pivot: [470, 842], phase: 1, speed: .75, flow: 11 });
        add('M663 792 Q699 788 730 792', ['#D0E0C7', '#E9D5B4', '#A9C5C1'], 2.5, .8, { pivot: [698, 792], phase: 3, speed: .75, flow: 9 });
        ellipse(894, 685, 67, 21, '#BDAB87');
        ellipse(894, 682, 53, 15, '#8F9773');
        add('M883 686 Q859 595 889 488 Q865 458 846 422 L858 416 Q883 450 901 467 Q922 423 955 404 L960 416 Q923 455 913 493 Q891 599 905 687 Z', '#948263');
        add('M892 678 Q876 596 900 499', '#C0AC81', 4, .8);
        const start = parts.length;
        add('M774 436 C744 419 751 381 783 370 C761 342 790 308 824 320 C836 279 881 287 900 311 C934 284 984 302 983 338 C1026 344 1040 392 1008 413 Q1014 456 969 463 Q936 486 904 455 Q865 482 826 450 Q791 462 774 436 Z', '#729780');
        add('M785 374 Q793 337 830 349 Q849 307 885 340 Q927 313 957 350 Q994 341 1000 379 Q951 400 916 377 Q870 405 836 381 Q806 399 785 374 Z', '#9AB28C');
        add('M800 426 Q846 402 877 427 Q924 402 978 431 Q946 467 905 447 Q850 471 800 426 Z', '#5E866E');
        for (const [x, y, sc] of [[791, 409, .75], [841, 363, .9], [900, 350, .65], [951, 385, .9], [860, 438, .65], [936, 449, .7]])
            sprig(x, y, sc, '#BAC8A0');
        for (let i = start; i < parts.length; i++)
            parts[i] = { ...parts[i], motion: { pivot: [900, 456], phase: .7, speed: .52, rotate: 2.2 } };
        grass(936, 693, .65, '#9CAC7F');
        grass(853, 688, .5, '#81956F');
        ellipse(76, 843, 48, 10, '#B8A17F', .6);
        add('M30 779 L119 779 L109 834 Q76 856 40 834 Z', '#B88366');
        ellipse(75, 779, 46, 11, '#D2AA81');
        ellipse(75, 777, 35, 6, '#847A58');
        sprig(62, 776, 1.7, '#739174');
        sprig(36, 771, 1.2, '#A1B38C');
    }
    else if (kind === 'collection-crystal-mesa') {
        ellipse(225, 159, 30, 30, ['#F3E7C4', '#F3CCA0', '#DCDACA']);
        cloud('M529 218 Q569 187 609 207 Q648 180 684 213 Q721 204 752 229 L520 234 Z', 2);
        add('M-20 473 L128 430 L246 456 L426 376 L554 447 L757 387 L1020 466 L1020 1000 L-20 1000 Z', '#B6B6A7');
        add('M-20 596 Q168 475 353 540 Q543 444 713 504 Q892 475 1020 560 L1020 1000 L-20 1000 Z', '#CEB699');
        add('M-20 767 Q131 648 290 684 Q478 571 651 629 Q872 567 1020 688 L1020 1000 L-20 1000 Z', '#E3C9A6');
        add('M378 1000 Q472 917 518 836 Q586 722 659 593 L696 593 Q659 741 631 846 Q609 939 615 1000 Z', '#F2DFC0');
        add('M332 813 Q412 822 535 857 L522 888 Q409 851 316 840 Z', '#F2DFC0');
        add('M616 809 Q715 787 831 750 L847 768 Q728 821 626 836 Z', '#F2DFC0');
        // Every house uses one consistent receding vector for wall, roof and base.
        const house = (x, base, w, h, d, front, side, roof) => {
            const y = base - h, dy = d * .46;
            add(`M${x} ${base} L${x + w} ${base} L${x + w + d + 52} ${base - dy + 25} L${x + 70} ${base + 31} Z`, '#BDA789', 0, .52);
            add(`M${x + w} ${y} L${x + w + d} ${y - dy} L${x + w + d} ${base - dy} L${x + w} ${base} Z`, side);
            add(`M${x} ${y} L${x + w} ${y} L${x + w} ${base} L${x} ${base} Z`, front);
            add(`M${x - 7} ${y - 11} L${x + w + 7} ${y - 11} L${x + w + d + 7} ${y - dy - 11} L${x + d - 7} ${y - dy - 11} Z`, roof);
            add(`M${x - 7} ${y - 11} L${x + w + 7} ${y - 11} L${x + w + 7} ${y + 3} L${x - 7} ${y + 3} Z`, '#DFC19A');
            add(`M${x + w + 7} ${y - 11} L${x + w + d + 7} ${y - dy - 11} L${x + w + d + 7} ${y - dy + 3} L${x + w + 7} ${y + 3} Z`, '#B18C6D');
            line([[x - 5, y - 10], [x + w + 6, y - 10]], '#F3DFC0', 3);
            add(`M${x} ${y + 4} L${x + w} ${y + 4} L${x + w} ${y + 12} L${x} ${y + 12} Z`, '#BEA382', 0, .42);
            add(`M${x} ${base - 14} L${x + w} ${base - 14} L${x + w} ${base} L${x} ${base} Z`, '#CDB797', 0, .55);
            const dx = x + w * .21, dw = w * .23, dt = base - h * .57;
            add(`M${dx - 5} ${base} L${dx - 5} ${dt} Q${dx + dw / 2} ${dt - dw * .78} ${dx + dw + 5} ${dt} L${dx + dw + 5} ${base} Z`, '#CFB794');
            add(`M${dx} ${base} L${dx} ${dt} Q${dx + dw / 2} ${dt - dw * .64} ${dx + dw} ${dt} L${dx + dw} ${base} Z`, '#758C80');
            add(`M${dx + 5} ${base - 5} L${dx + 5} ${dt + 1} Q${dx + dw / 2} ${dt - dw * .43} ${dx + dw - 5} ${dt + 1} L${dx + dw - 5} ${base - 5} Z`, '#99A28B');
            line([[dx + dw / 2, dt - 8], [dx + dw / 2, base - 7]], '#6D8072', 2);
            ellipse(dx + dw - 10, base - h * .22, 2.5, 3, '#D6BC8D');
            const wx = x + w * .68, wy = base - h * .59, ww = w * .15, wh = h * .25;
            add(`M${wx - 4} ${wy - 4} h${ww + 8} v${wh + 8} h${-ww - 8} Z`, '#BAA285');
            add(`M${wx} ${wy} h${ww} v${wh} h${-ww} Z`, glow);
            line([[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], '#9C9B7E', 2);
            line([[wx - 8, wy - 2], [wx - 8, wy + wh]], '#739188', 5);
            line([[wx + ww + 8, wy - 2], [wx + ww + 8, wy + wh]], '#739188', 5);
            line([[wx - 10, wy + wh + 6], [wx + ww + 10, wy + wh + 6]], '#E7D3AE', 4);
            const cx = x + w * .64 + d * .4, cy = y - dy * .42;
            add(`M${cx} ${cy - 31} h18 v30 l-18 1 Z`, '#B99B7C');
            line([[cx - 3, cy - 32], [cx + 22, cy - 32]], '#E9D1AC', 5);
            add(`M${x + w + d * .55} ${y + 29 - dy * .55} l${d * .25} ${-dy * .25} v${h * .19} l${-d * .25} ${dy * .25} Z`, '#A38F73');
        };
        house(147, 580, 126, 119, 34, '#D8C5A6', '#BBA58A', '#DDC7A4');
        house(584, 606, 179, 182, 45, '#EAD5B3', '#C1A68A', '#DFC29A');
        house(766, 763, 155, 170, 44, '#DCB89D', '#B99279', '#CAA087');
        house(247, 813, 264, 238, 61, '#EEDCBB', '#C4A789', '#D8B28D');
        // Broad solid treads reach the door; the side lane meets the last step.
        add('M294 811 L376 811 L387 822 L291 822 Z', '#F0DCB9');
        add('M291 822 L387 822 L387 830 L291 830 Z', '#BCA17E');
        add('M283 830 L387 830 L401 841 L280 841 Z', '#E7D0AC');
        add('M280 841 L401 841 L401 849 L280 849 Z', '#BCA17E');
        for (const [x, y, w, h] of [[658, 656, 19, 5], [623, 727, 25, 6], [587, 801, 34, 8], [554, 884, 45, 10], [511, 966, 63, 13]])
            add(`M${x - w / 2} ${y} l${w} -2 l4 ${h} l${-w} 2 Z`, '#DDC6A4', 0, .6);
        add('M-20 934 Q99 886 216 919 L278 1000 L-20 1000 Z', '#C4AE8B');
        add('M733 1000 Q805 906 916 914 L1020 928 L1020 1000 Z', '#D1B692');
        for (const [x, y, sc] of [[209, 813, .9], [738, 763, .65], [881, 941, 1.2]]) {
            ellipse(x, y + 7, 29 * sc, 7 * sc, '#AB997A', .6);
            add(`M${x - 24 * sc} ${y - 35 * sc} L${x + 24 * sc} ${y - 35 * sc} L${x + 18 * sc} ${y + 2 * sc} Q${x} ${y + 10 * sc} ${x - 18 * sc} ${y + 2 * sc} Z`, '#B58368');
            ellipse(x, y - 35 * sc, 26 * sc, 6 * sc, '#D2AA81');
            ellipse(x, y - 36 * sc, 20 * sc, 3 * sc, '#807B5B');
            sprig(x - 8 * sc, y - 34 * sc, sc * 1.5, '#789579');
            sprig(x - 27 * sc, y - 36 * sc, sc, '#A8B58A');
        }
        for (const [x, y, sc] of [[134, 958, 1], [818, 965, .9], [961, 895, .7], [707, 693, .4], [78, 682, .5]]) {
            grass(x, y, sc, '#929773');
            sprig(x + 18 * sc, y - 2 * sc, sc, '#B2B38A');
        }
        for (const [x, y] of [[181, 974], [782, 971], [91, 708]]) {
            ellipse(x, y, 18, 6, '#B6A184');
            add(`M${x - 16} ${y} Q${x} ${y - 12} ${x + 16} ${y}`, '#E8D2AE', 3);
        }
    }
    else if (kind === 'collection-comet-observatory') {
        ellipse(749, 208, 32, 32, ['#F2E9C8', '#F6DEB9', '#EEE5CA']);
        cloud('M107 277 C142 246 176 264 194 262 C228 230 266 263 282 267 Q319 257 350 286 L96 293 Z', 1.8);
        // Rock shoulders and branching ridges distinguish the distant range from the meadow.
        add('M-20 486 L49 428 Q92 403 133 419 L207 359 Q232 346 252 321 Q267 309 286 332 L334 372 L376 359 Q397 352 420 374 L475 426 Q524 404 554 371 L598 337 Q617 317 639 338 L683 370 L719 331 Q738 306 760 329 L812 378 L848 366 Q885 369 919 413 L1020 479 L1020 1000 L-20 1000 Z', '#ADBFC0');
        add('M133 419 Q168 391 207 359 Q232 346 252 321 Q242 350 240 368 Q239 385 259 398 Q225 412 206 444 Q182 470 136 483 L79 483 Z', '#C0CBC1');
        add('M252 321 Q277 347 287 361 Q274 386 284 405 Q304 400 334 372 L376 359 Q361 385 347 406 Q351 420 349 431 Q329 442 304 465 Q290 446 271 433 Q257 442 241 455 Q250 419 263 397 Q239 377 243 353 Z', '#9EB3B3');
        add('M598 337 Q617 317 639 338 Q629 351 628 370 Q625 387 647 398 Q622 412 610 428 Q589 449 575 467 L535 466 Q553 434 587 399 Q610 373 615 350 Z', '#C1CBBF');
        add('M719 331 Q738 306 760 329 Q748 352 752 368 Q761 389 776 406 Q753 421 750 441 Q745 461 731 479 L690 470 Q701 437 714 407 Q731 389 735 379 Q729 354 743 325 Z', '#98AFB0');
        add('M-20 605 Q72 535 129 523 L178 477 Q212 451 242 470 L284 494 Q315 472 349 496 L405 545 Q452 559 500 539 Q567 482 622 496 L676 479 Q710 465 747 500 L803 537 Q855 525 903 551 L1020 596 L1020 1000 L-20 1000 Z', '#7E9F98');
        add('M129 523 Q152 500 178 477 Q212 451 242 470 Q224 489 220 513 Q225 530 246 543 Q198 570 156 609 L86 623 Z', '#9BB09C');
        add('M242 470 L284 494 Q315 472 349 496 Q331 507 325 523 Q333 538 343 545 Q336 568 310 582 L278 605 Q289 576 288 555 Q252 559 230 535 Q215 514 231 489 Z', '#74968C');
        add('M587 509 L676 479 Q710 465 747 500 Q716 512 707 528 Q705 541 717 548 Q695 571 665 581 L615 594 Q637 570 646 546 Q620 529 587 509 Z', '#95AC98');
        add('M-20 675 Q110 608 221 611 Q359 570 457 607 Q588 573 709 609 Q879 559 1020 625 L1020 1000 L-20 1000 Z', '#688C7B');
        add('M-20 703 Q149 621 305 648 Q399 604 500 622 Q425 651 355 673 Q184 660 67 737 Z', '#A7B69A', 0, .7);
        for (const [x, y, h] of [[21, 667, 24], [43, 655, 31], [72, 643, 25], [103, 634, 34], [130, 628, 27], [160, 622, 32], [196, 620, 24], [240, 610, 30], [276, 606, 22], [331, 603, 26], [879, 587, 24], [909, 599, 32], [940, 610, 24], [971, 617, 30]]) {
            add(`M${x - 10} ${y} L${x - 5} ${y - h * .4} L${x - 9} ${y - h * .4} L${x - 3} ${y - h * .72} L${x - 6} ${y - h * .72} L${x} ${y - h} L${x + 6} ${y - h * .72} L${x + 3} ${y - h * .72} L${x + 10} ${y - h * .34} L${x + 6} ${y - h * .34} L${x + 12} ${y} Z`, '#608572');
        }
        add('M-20 809 Q158 690 296 712 Q407 679 478 661 Q584 622 711 650 Q817 632 913 662 L1020 703 L1020 1000 L-20 1000 Z', '#92AD90');
        add('M-20 816 Q160 707 301 754 Q172 773 85 849 L-20 882 Z', '#A5B99A');
        add('M788 795 Q885 738 1020 768 L1020 851 Q878 808 818 835 Z', '#7C9E82');
        for (const [x, y, s] of [[257, 629, .65], [288, 616, .72], [325, 616, .58], [849, 576, .52], [874, 580, .65], [903, 586, .5]]) {
            add(`M${x - 16 * s} ${y} Q${x - 21 * s} ${y - 18 * s} ${x - 8 * s} ${y - 27 * s} Q${x - 17 * s} ${y - 48 * s} ${x} ${y - 60 * s} Q${x + 18 * s} ${y - 43 * s} ${x + 10 * s} ${y - 29 * s} Q${x + 29 * s} ${y - 11 * s} ${x + 18 * s} ${y} Z`, '#6D9388');
        }
        ellipse(642, 712, 180, 28, '#6E927E');
        add('M416 582 L514 582 L514 681 L416 663 Z', '#C8B49A');
        add('M416 582 L445 565 L544 565 L514 582 Z', '#E4D7B9');
        add('M411 578 L515 578 L515 590 L411 590 Z', '#9DAA98');
        add('M435 606 L475 613 L475 648 L435 641 Z', glow);
        line([[454, 611], [454, 644]], '#91977F', 3);
        add('M505 556 Q642 580 768 556 L768 686 Q642 742 505 686 Z', '#C1A28A');
        add('M723 565 Q751 563 768 556 L768 686 Q752 696 723 705 Z', '#A88F7B');
        add('M505 584 Q642 615 768 584 L768 609 Q642 647 505 609 Z', '#D3BA9D');
        add('M505 556 C500 391 763 391 768 556 Q642 584 505 556 Z', '#E7DFC7');
        add('M647 434 C708 445 744 497 746 556 L690 556 Q687 474 647 434 Z', '#A6B7B5');
        add('M627 431 L647 434 Q699 480 697 556 L675 556 Q673 475 627 431 Z', '#557C85');
        add('M505 560 Q642 592 768 560', '#789791', 8);
        add('M511 574 Q641 607 762 574', '#EEE2C8', 5);
        add('M510 548 C521 474 570 443 619 432', '#F7EBD2', 4, .8);
        add('M548 550 Q546 478 604 439', '#C5CABB', 2.5, .8);
        add('M727 551 Q725 484 670 441', '#8FABA9', 2.5, .7);
        add('M510 537 Q592 553 674 542', '#C5C9B8', 2, .65);
        add('M689 542 Q728 540 761 533', '#91A5A2', 2, .7);
        add('M628 431 Q638 422 650 434 L659 442 L638 443 Z', '#AFC2BB');
        add('M502 687 Q640 721 775 687 L775 704 Q640 742 502 704 Z', '#91A28C');
        add('M499 684 Q641 716 778 684', '#D8CDB0', 7);
        add('M571 701 L571 626 Q596 597 621 626 L621 710 Z', '#6D7C72');
        add('M580 632 Q597 613 613 632 L613 696 L580 689 Z', glow);
        add('M568 690 L568 626 Q596 589 624 626 L624 703', '#DBC7A7', 7);
        line([[597, 618], [597, 700]], '#8A907A', 3);
        line([[581, 653], [612, 655]], '#8A907A', 3);
        ellipse(607, 676, 2.5, 3, '#BB9D70');
        for (const x of [660, 711]) {
            add(`M${x} 615 L${x + 25} 615 L${x + 25} 650 L${x} 650 Z`, glow);
            line([[x + 12, 616], [x + 12, 650]], '#957F69', 2);
        }
        for (const y of [637, 661, 679]) {
            line([[518, y], [549, y]], '#AD8F78', 2, .7);
            line([[732, y], [755, y]], '#AD8F78', 2, .7);
        }
        for (const [x, y, w] of [[524, 619, 21], [540, 648, 16], [518, 674, 20], [639, 670, 20], [667, 690, 21], [692, 674, 16], [741, 632, 13]]) {
            add(`M${x} ${y} l${w} 1 l0 9 l${-w} -1 Z`, '#D4B397', 0, .5);
        }
        add('M421 1000 Q521 889 489 839 Q467 782 588 709 L612 714 Q545 792 572 827 Q643 900 596 1000 Z', '#DCC7A4');
        add('M426 999 Q526 889 494 838 Q478 782 589 717', '#C4B48F', 4, .7);
        add('M567 718 L616 726 L628 720 L580 710 Z', '#E7D8B9');
        for (const [x, y, w, h] of [[573, 746, 24, 6], [548, 778, 28, 7], [526, 815, 34, 8], [546, 865, 42, 11], [553, 924, 53, 13], [524, 980, 64, 15]])
            add(`M${x - w / 2} ${y} l${w} 3 l-5 ${h} l${-w} -4 Z`, '#E7D7B6', 0, .8);
        add('M-20 894 Q89 834 237 849 L349 882 L351 936 Q126 883 -20 950 Z', '#B3AD91');
        add('M-20 888 Q128 820 354 879 L354 892 Q133 839 -20 903 Z', '#D7CCB1');
        for (const [x, y] of [[78, 888], [171, 878], [270, 899]])
            line([[x, y], [x + 33, y + 6]], '#929E88', 2.5);
        for (const [x, y, h] of [[41, 892, 25], [113, 876, 28], [205, 882, 26], [310, 904, 22]])
            line([[x, y], [x + 2, y + h]], '#939F88', 2.5, .7);
        // Curved trunks and uneven foliage frame the approach without a science-fiction badge.
        add('M856 852 Q843 726 879 650 L894 653 Q863 736 879 852 Z M109 894 Q130 797 97 706 L109 700 Q145 786 130 892 Z', '#7D8162');
        const start = parts.length;
        add('M793 682 C763 638 801 603 832 612 C825 567 888 552 911 588 C957 568 995 624 964 653 Q1004 698 948 713 Q907 743 870 714 Q818 732 793 682 Z', '#557F70');
        add('M808 639 Q835 599 865 620 Q893 579 923 623 Q956 613 966 649 Q917 674 883 648 Q839 674 808 639 Z', '#8CAB83');
        for (const [x, y, s, c] of [[815, 667, .6, '#799A7C'], [858, 629, .6, '#B2C398'], [920, 636, .6, '#A1B88C'], [905, 692, .65, '#739975'], [961, 678, .5, '#89AA83']])
            sprig(x, y, s, c);
        for (let i = start; i < parts.length; i++)
            parts[i] = { ...parts[i], motion: { pivot: [879, 707], phase: 2, speed: .49, rotate: 2 } };
        add('M53 741 C8 713 33 653 70 660 C78 614 137 628 143 660 C190 649 208 708 173 729 Q134 768 95 738 Z', '#5C8774');
        sprig(59, 703, .8, '#8EAD88');
        sprig(114, 678, .8, '#A8BE96');
        sprig(144, 724, .7, '#83A584');
        add('M119 884 Q139 790 105 716', '#A3A580', 3, .8);
        add('M868 846 Q856 762 885 686', '#ACAE83', 3, .8);
        for (const [x, y, s] of [[377, 918, 1], [661, 947, 1.1], [776, 862, .7], [80, 986, 1.1], [323, 800, .55]]) {
            grass(x, y, s, '#638B71');
            sprig(x + 22 * s, y, s, '#ABC095');
            for (const dx of [-12, 8, 26]) {
                line([[x + dx * s, y - 4 * s], [x + (dx + 3) * s, y - (30 + dx / 4) * s]], '#769574', 2 * s);
                ellipse(x + (dx + 3) * s, y - (32 + dx / 4) * s, 4 * s, 3 * s, '#E2D8AF');
            }
        }
        for (const [x, y] of [[475, 868], [514, 786], [567, 731]]) {
            line([[x, y], [x, y - 23]], '#78866D', 4);
            ellipse(x, y - 25, 7, 5, glow);
        }
    }
    else if (kind === 'collection-cloud-tea-village') {
        cloud('M450 202 Q487 178 526 193 Q569 162 609 198 Q652 187 681 218 L441 218 Z', .6);
        add('M-20 534 Q139 454 289 499 Q451 400 619 467 Q841 407 1020 510 L1020 1000 L-20 1000 Z', '#B8C9BD');
        add('M-20 646 Q170 564 315 594 Q503 496 666 563 Q855 501 1020 601 L1020 1000 L-20 1000 Z', '#93B09D');
        add('M-20 759 Q167 677 329 716 Q542 597 753 658 Q900 632 1020 706 L1020 1000 L-20 1000 Z', '#B8C2A0');
        add('M134 822 L373 796 L461 826 L305 865 L126 850 Z', '#91A68C', 0, .6);
        add('M560 676 L718 658 L766 677 L638 698 Z', '#8AA48A', 0, .6);
        // A closer tea house on the left and a smaller home uphill share the same lane.
        add('M372 580 L428 554 L428 794 L372 820 Z', '#C8AE91');
        add('M150 820 L150 580 L261 483 L372 580 L372 820 Z', '#EFE0C3');
        // The visible roof plane recedes with the side wall, sharing its eave.
        add('M261 463 L317 437 L443 551 L387 577 Z', '#AD7D70');
        add('M261 463 L387 577 L387 590 L261 480 L135 593 L135 580 Z', '#B78B78');
        add('M387 577 L443 551 L443 564 L387 590 Z', '#896A5E');
        add('M151 583 L261 487 L371 583 L371 592 L261 499 L151 594 Z', '#D7C3A2');
        line([[141, 580], [261, 475], [380, 582]], '#D9A98E', 4);
        line([[268, 462], [321, 442], [437, 551]], '#C49A83', 3);
        ellipse(262, 554, 18, 22, '#AF9A7F');
        ellipse(262, 553, 12, 15, glow);
        line([[251, 553], [273, 553]], '#B2A485', 2);
        add('M340 494 L340 448 L361 439 L361 485 Z', '#95715F');
        add('M324 487 L324 442 L340 448 L340 494 Z', '#C29B7D');
        line([[322, 442], [340, 448], [363, 438]], '#DEB694', 5);
        for (const [x, y] of [[293, 489], [318, 512], [344, 535], [370, 557]])
            line([[x, y], [x + 48, y - 23]], '#C49A83', 2, .65);
        add('M150 805 L372 805 L372 820 L150 820 Z', '#D3C4A5');
        add('M372 582 L382 578 L382 814 L372 820 Z', '#B79B80', 0, .5);
        add('M179 822 L179 691 Q207 660 234 691 L234 815 Z', '#7F9C8E');
        add('M174 814 L174 691 Q206 648 240 691 L240 811', '#D5BA97', 7);
        add('M189 697 Q207 678 224 697 L224 735 L189 738 Z', glow);
        line([[208, 687], [208, 738]], '#7D8E7D', 2.5);
        line([[185, 763], [228, 759]], '#A7B5A0', 2.5);
        ellipse(226, 754, 3, 4, '#D8BE8F');
        add('M286 646 L341 646 L341 705 L286 705 Z', glow);
        line([[313, 647], [313, 704]], '#A89F81', 3);
        line([[286, 676], [341, 676]], '#A89F81', 3);
        add('M278 632 L350 632 L356 644 L272 644 Z', '#AA8C70');
        add('M290 709 L339 709 L334 729 L295 729 Z', '#BB8D74');
        for (const x of [297, 310, 325, 335])
            ellipse(x, 708, 9, 7, '#809E7E');
        for (const [x, y] of [[296, 700], [314, 696], [334, 701]]) {
            line([[x, y + 13], [x, y]], '#67846D', 2);
            ellipse(x, y, 4, 3, '#D7A58E');
        }
        line([[276, 650], [276, 704]], '#7C9785', 8);
        line([[351, 650], [351, 704]], '#7C9785', 8);
        for (const y of [658, 670, 682, 694]) {
            line([[272, y], [280, y]], '#A3B49B', 2);
            line([[347, y], [355, y]], '#A3B49B', 2);
        }
        line([[375, 625], [410, 643], [410, 667]], '#8F765D', 4);
        add('M395 665 L426 675 L426 708 L395 697 Z', '#D8BA8F');
        add('M401 677 L418 682 L417 691 L402 686 Z', '#F0E0BB');
        add('M717 536 L754 519 L754 660 L717 677 Z', '#BCA58A');
        add('M568 677 L568 536 L641 471 L717 536 L717 677 Z', '#E7D4B5');
        add('M641 456 L678 439 L765 516 L727 533 Z', '#A88071');
        add('M556 533 L641 456 L727 533 L727 543 L641 473 L556 543 Z', '#BE9580');
        add('M727 533 L765 516 L765 526 L727 543 Z', '#8B6E60');
        line([[564, 535], [641, 467], [721, 536]], '#DBB698', 3);
        add('M590 674 L590 597 Q608 578 627 597 L627 670 Z', '#8BA396');
        add('M655 569 L689 569 L689 610 L655 610 Z', glow);
        add('M585 671 L585 597 Q608 570 632 597 L632 667', '#CEB695', 6);
        line([[655, 612], [690, 612]], '#AD9678', 4);
        line([[672, 570], [672, 609]], '#B3A082', 2);
        add('M568 665 L717 665 L717 677 L568 677 Z', '#CAB99A');
        add('M393 1000 Q497 913 435 855 Q369 788 515 733 Q577 709 607 674 L624 678 Q606 740 544 767 Q477 800 531 843 Q636 923 551 1000 Z', '#ECDBB8');
        add('M425 842 Q320 827 229 822 L222 813 Q333 808 435 827 Z', '#ECDBB8');
        add('M174 821 L237 815 L247 824 L179 833 Z', '#F1E1BF');
        for (const [x, y, w, h] of [[588, 706, 21, 6], [550, 750, 31, 7], [492, 798, 39, 9], [492, 847, 42, 11], [516, 907, 63, 16], [463, 976, 82, 19]])
            add(`M${x - w / 2} ${y} l${w} -3 l5 ${h} l${-w} 4 Z`, '#D3C2A0', 0, .65);
        // Low garden walls and plants anchor both sides of the path.
        add('M696 790 Q838 726 1020 754 L1020 801 Q835 770 707 833 Z', '#C0B295');
        line([[703, 790], [802, 760], [906, 751], [1012, 759]], '#E1D2B4', 9);
        for (const [x, y, h] of [[739, 783, 31], [808, 765, 34], [881, 758, 35], [950, 760, 30]])
            line([[x, y], [x + 3, y + h]], '#A79F85', 2.5, .65);
        add('M771 860 L887 838 L899 847 L781 871 Z', '#B29471');
        line([[787, 869], [790, 900]], '#8B795E', 7);
        line([[880, 851], [884, 881]], '#8B795E', 7);
        add('M781 836 L891 816 L891 830 L781 851 Z', '#C2A683');
        add('M-20 1000 L-20 865 Q92 831 170 858 Q213 908 184 1000 Z', '#9FB294');
        const start = parts.length;
        add('M28 866 C-5 838 7 798 35 795 C11 752 58 727 88 745 C119 713 161 742 153 773 C197 778 188 830 161 833 Q148 879 109 859 Q63 898 28 866 Z', '#729880');
        add('M48 791 Q78 748 109 784 Q141 750 157 789 Q124 818 93 801 Q68 829 48 791 Z', '#A5BB90');
        sprig(39, 830, .75, '#9DB68D');
        sprig(93, 795, .85, '#C0CCA2');
        sprig(138, 835, .65, '#96AE86');
        for (let i = start; i < parts.length; i++)
            parts[i] = { ...parts[i], motion: { pivot: [100, 858], phase: 1.2, speed: .57, rotate: 2.6 } };
        for (const [x, y] of [[218, 859], [767, 874], [830, 839]]) {
            line([[x, y], [x + 3, y - 24]], '#829775', 2.5);
            ellipse(x + 3, y - 27, 7, 5, '#D6A596');
        }
        for (const [x, y, s] of [[256, 946, 1.1], [676, 979, 1.2], [726, 897, .8], [510, 703, .5]]) {
            grass(x, y, s, '#879F7C');
            sprig(x + 21 * s, y, s, '#A8B98F');
        }
        grass(915, 886, .75, '#829C7A');
        sprig(947, 898, .8, '#A3B88C');
    }
    else {
        ellipse(770, 163, 29, 29, ['#F2E9C5', '#F4D5B3', '#E5E1C8']);
        cloud('M155 211 Q187 187 222 204 Q253 177 286 202 Q321 194 349 216 L148 220 Z', 1.3);
        add('M-20 497 Q63 460 130 468 Q211 414 286 447 Q369 402 465 433 Q559 395 651 423 Q724 411 804 449 Q919 424 1020 476 L1020 1000 L-20 1000 Z', '#A7BBA5');
        add('M-20 611 Q106 529 237 568 Q353 488 482 536 Q606 476 737 539 Q884 500 1020 589 L1020 1000 L-20 1000 Z', '#BDCAA6');
        add('M-20 736 Q138 642 299 673 Q445 562 587 608 Q757 577 1020 711 L1020 1000 L-20 1000 Z', '#99AD82');
        add('M-20 779 Q173 686 320 730 Q416 665 490 658 Q354 724 311 806 Q149 792 -20 881 Z', '#AABB8F');
        add('M648 677 Q787 656 1020 777 L1020 833 Q843 739 678 737 Z', '#88A078');
        add('M433 1000 Q361 925 424 854 Q484 785 555 731 Q615 687 614 615 L631 615 Q654 691 601 751 Q530 826 533 874 Q520 926 645 1000 Z', '#E4D3AE');
        add('M433 1000 Q367 925 430 855 Q489 786 557 735', '#C4BD92', 3, .65);
        for (const [x, y, sc] of [[439, 932, 1], [560, 774, .55], [612, 672, .25]])
            add(`M${x - 12 * sc} ${y} q${20 * sc} ${-7 * sc} ${39 * sc} ${-3 * sc}`, '#C9BD97', 3 * sc, .6);
        // Two asymmetric branch structures, with small fruit and foliage inside the crown.
        const tree = (x, y, sc, mirrored, wide) => {
            const sx = sc * (mirrored ? -1 : 1);
            const local = (svg, c, stroke = 0, alpha = 1) => {
                const path = (0, art_paths_1.artPaths)({ p: svg }).p;
                path.transform([sx, 0, x, 0, sc, y, 0, 0, 1]);
                parts.push({ path, colors: mood(c), stroke: stroke * sc, alpha });
            };
            ellipse(x + 12 * sc, y + 2 * sc, 83 * sc, 14 * sc, '#718B65', .4);
            local('M-14 5 Q-3 -36 -11 -90 Q-19 -137 -5 -188 L8 -188 Q-1 -140 5 -95 Q15 -42 15 6 L3 2 L-3 -5 L-8 3 Z', '#8C7C59');
            local('M-4 -130 C-33 -157 -67 -175 -82 -209 L-76 -213 C-52 -180 -23 -169 3 -157 Z M5 -140 Q34 -164 69 -211 L77 -207 Q57 -160 13 -128 Z M-1 -176 Q-20 -205 -6 -252 L1 -250 Q-8 -207 8 -179 Z', '#8C7C59');
            local('M1 -15 Q7 -60 -1 -103 Q-4 -131 1 -165', '#BEA47A', 3, .7);
            const first = parts.length;
            local(wide
                ? 'M-142 -233 Q-160 -255 -139 -275 Q-139 -310 -102 -312 Q-83 -337 -48 -330 Q-25 -349 3 -331 Q29 -349 57 -326 Q96 -334 110 -305 Q148 -294 139 -264 Q166 -245 146 -224 Q143 -197 112 -198 Q89 -173 58 -188 Q31 -167 4 -185 Q-21 -162 -55 -182 Q-86 -172 -105 -199 Q-140 -198 -142 -233 Z'
                : 'M-123 -217 Q-149 -242 -125 -268 Q-134 -295 -108 -311 Q-94 -341 -60 -332 Q-41 -362 -8 -348 Q21 -362 44 -337 Q81 -344 99 -316 Q134 -308 127 -279 Q151 -254 129 -232 Q137 -199 98 -193 Q69 -163 39 -187 Q7 -175 -10 -191 Q-45 -175 -63 -194 Q-97 -181 -123 -217 Z', '#779266');
            local('M-118 -272 Q-111 -304 -78 -301 Q-57 -322 -29 -308 Q-7 -333 24 -310 Q49 -325 69 -300 Q42 -280 14 -286 Q-11 -267 -39 -282 Q-70 -261 -93 -277 Z', '#A3B780');
            local('M-139 -234 Q-113 -257 -85 -242 Q-65 -266 -37 -242 Q-49 -216 -76 -221 Q-106 -203 -130 -221 Z', '#87A06C');
            local('M32 -260 Q61 -290 87 -274 Q118 -281 132 -251 Q123 -217 91 -223 Q69 -201 45 -224 Q15 -227 32 -260 Z', '#91AA73');
            local('M-42 -213 Q-12 -238 15 -219 Q34 -240 57 -218 Q43 -187 14 -198 Q-15 -178 -42 -213 Z', '#749362');
            for (const [dx, dy] of [[-95, -288], [-56, -299], [-17, -308], [37, -302], [76, -254], [105, -244], [-102, -238], [-64, -232], [-15, -211], [26, -211]]) {
                local(`M${dx} ${dy} q7 -11 15 -11 q-1 9 -15 11 Z M${dx + 1} ${dy + 2} q10 -5 17 0 q-6 7 -17 0 Z`, '#BCC894', 0, .65);
            }
            const fruit = wide ? [[-101, -248], [-39, -286], [56, -242], [17, -203]] : [[-75, -253], [26, -299], [81, -240]];
            for (const [fx, fy] of fruit) {
                local(`M${fx} ${fy - 3} C${fx - 10} ${fy - 10} ${fx - 12} ${fy + 6} ${fx - 3} ${fy + 8} Q${fx} ${fy + 6} ${fx + 3} ${fy + 8} C${fx + 12} ${fy + 6} ${fx + 9} ${fy - 10} ${fx} ${fy - 3} Z`, '#C49460');
                local(`M${fx - 4} ${fy - 2} l-1 4`, '#E9C592', 2, .9);
                local(`M${fx} ${fy - 4} l2 -7`, '#637A51', 1.5);
            }
            for (let i = first; i < parts.length; i++)
                parts[i] = { ...parts[i], motion: { pivot: [x, y - 178 * sc], phase: x * .014, speed: .48, rotate: 1.7 } };
        };
        tree(556, 640, .27, false, false);
        tree(697, 648, .31, true, true);
        tree(407, 736, .57, true, true);
        tree(772, 739, .61, false, false);
        tree(124, 916, 1.28, false, true);
        tree(934, 884, 1.15, true, false);
        // The low boundary ends beside the lane instead of cutting through a tree.
        add('M-20 913 Q128 881 318 918 L330 972 Q144 929 -20 968 Z', '#A3A98B');
        add('M-20 900 Q150 872 325 907 L330 922 Q148 888 -20 916 Z', '#D4CCAA');
        add('M299 898 L341 906 L346 970 L306 964 Z', '#C5C1A0');
        add('M292 893 L340 901 L352 912 L304 905 Z', '#E1D6B5');
        for (const [x, y, w] of [[8, 923, 47], [73, 917, 45], [137, 919, 48], [204, 929, 46]]) {
            add(`M${x} ${y} l${w} 2 l1 18 l${-w} -3 Z`, '#C1C0A1', 0, .8);
        }
        add('M815 850 Q919 823 1020 859 L1020 887 Q928 857 822 880 Z', '#A8AF8E');
        add('M811 844 Q922 817 1020 851 L1020 861 Q922 832 817 855 Z', '#D7CEAA');
        // A small harvest basket rests in the shade just inside the boundary.
        ellipse(824, 933, 43, 7, '#718B65', .45);
        add('M787 888 L855 888 L851 927 Q820 937 791 927 Z', '#B1936B');
        add('M794 891 C788 850 850 850 850 890', '#8A7858', 5);
        ellipse(821, 889, 35, 8, '#CBB28A');
        ellipse(821, 887, 28, 4, '#7F7959');
        for (const [x, y] of [[805, 884], [820, 880], [837, 884]])
            ellipse(x, y, 7, 6, '#C49B67');
        for (const y of [901, 910, 919])
            add(`M795 ${y} Q822 ${y + 5} 850 ${y}`, '#D8C29A', 2);
        for (const x of [800, 814, 828, 842])
            line([[x, 896], [x, 925]], '#937C56', 1.5, .55);
        for (const [x, y, sc] of [[376, 951, .75], [749, 916, .65], [967, 969, 1], [203, 990, .9], [707, 802, .4]]) {
            grass(x, y, sc, '#6E8C62');
        }
        for (const [x, y] of [[363, 973], [730, 929], [748, 944]]) {
            line([[x, y], [x + 3, y - 19]], '#819769', 1.8);
            ellipse(x + 3, y - 20, 3, 2.5, '#E2D4A7');
        }
    }
    const scale = Math.max((bounds.x1 - bounds.x0) / 1000, (bounds.y1 - bounds.y0) / 1000) * (framing === 'indoor' ? 1.06 : 1);
    return { kind, bounds, sky: SKIES[kind], parts, moving: (0, scenery_motion_1.prepareSceneryMotion)(parts), clip: (0, ink_1.shapeOf)({ pts: [[bounds.x0, bounds.y0], [bounds.x1, bounds.y0], [bounds.x1, bounds.y1], [bounds.x0, bounds.y1]], fz: [9900, 30, 0, 0] }), scale, tx: (bounds.x0 + bounds.x1) / 2 - 500 * scale, ty: (bounds.y0 + bounds.y1) / 2 - 500 * scale };
}
function begin(g, b) {
    'worklet';
    g.save();
    g.clipPath(b.clip, 1, true);
    g.translate(b.tx, b.ty);
    g.scale(b.scale, b.scale);
}
function drawStill(g, b, e) { const f = (0, ink_1.ink)(g); begin(g, b); f.rect(-100, -100, 1200, 1200, (0, color_1.byTod)(b.sky, e.tod)); for (const p of b.parts) {
    if (p.motion || p.nightOnly && e.tod < 1.5)
        continue;
    if (p.stroke)
        f.stroke(p.path, (0, color_1.byTod)(p.colors, e.tod), p.stroke, p.alpha);
    else
        f.fill(p.path, (0, color_1.byTod)(p.colors, e.tod), p.alpha);
} g.restore(); }
function drawMotion(g, b, e) {
    'worklet';
    begin(g, b);
    (0, scenery_motion_1.drawSceneryMotion)(g, b.moving, e);
    g.restore();
}
function makeCollectionScenery(kind, framing, bounds) { const sky = SKIES[kind]; return (0, types_1.defineView)({ id: `open-${kind}`, slot: 'view', label: exports.COLLECTION_SCENERY_LABELS[kind][0], structures: [framing], sky: sky.map(c => [c, c, c]), cloud: null, celestial: false, events: [], variants: { original: { label: '원본', palette: { sky: sky[0] } } }, build: () => buildLandscape(kind, bounds ?? (framing === 'outdoor' ? scene_structure_1.OUTDOOR_OPENING : layout_1.VIEW_BOX), framing), back: drawStill, frame: drawMotion }); }

}, {"../../core/color":"src/world/drawn/core/color.ts","../../core/ink":"src/world/drawn/core/ink.ts","../layout":"src/world/drawn/room/layout.ts","../scene-structure":"src/world/drawn/room/scene-structure.ts","../scenery-motion":"src/world/drawn/room/scenery-motion.ts","../types":"src/world/drawn/room/types.ts","./art-paths":"src/world/drawn/room/collections/art-paths.ts"}],
"src/world/drawn/room/scene-structure.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDOOR_ONLY_SLOTS = exports.OUTDOOR_OPENING = void 0;
exports.assertSceneStructure = assertSceneStructure;
exports.assertViewStructure = assertViewStructure;
const layout_1 = require("./layout");
/** Structure capability is independent of any particular landscape or product ID. */
exports.OUTDOOR_OPENING = { x0: layout_1.VIS.x0, y0: layout_1.VIS.y0, x1: layout_1.VIS.x1, y1: layout_1.FLOOR_Y };
exports.INDOOR_ONLY_SLOTS = ['wall', 'window', 'wallDeco', 'sill'];
function assertSceneStructure(structure) {
    if (structure !== 'indoor' && structure !== 'outdoor')
        throw new Error('Unknown drawn structure.');
}
function assertViewStructure(view, structure) {
    // Legacy views are indoor. Authored dual views explicitly declare their framing.
    if (!(view.structures ?? ['indoor']).includes(structure)) {
        throw new Error(`View does not support ${structure} framing.`);
    }
}

}, {"./layout":"src/world/drawn/room/layout.ts"}],
"src/world/drawn/room/layout.ts": [function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZONES = exports.CREATURE_SCALE = exports.FLOOR_ANCHOR = exports.CREATURE_TINT = exports.ROOM_TINT = exports.VIEW_BOX = exports.BASEBOARD = exports.FLOOR_Y = exports.VIS = exports.CAMERA = exports.WORLD_H = exports.WORLD_W = void 0;
exports.WORLD_W = 1080;
exports.WORLD_H = 2340;
/** 화면에 놓는 법: 방 좌표를 s배로 줄여 (x, y)만큼 옮긴다(화면 좌표 = x + s × 방 좌표, 폭 1080 기준). 홈 UI(위 아이콘 · 아래 시트)에 맞춘 값 */
exports.CAMERA = { s: .8, x: 108, y: 12 };
/** 카메라로 화면에 보이는 방 좌표 범위: 벽 · 바닥은 이 끝까지 칠한다 */
exports.VIS = { x0: -exports.CAMERA.x / exports.CAMERA.s, y0: -exports.CAMERA.y / exports.CAMERA.s, x1: (exports.WORLD_W - exports.CAMERA.x) / exports.CAMERA.s, y1: (exports.WORLD_H - exports.CAMERA.y) / exports.CAMERA.s };
/** 벽과 바닥이 만나는 선 · 걸레받이 */
exports.FLOOR_Y = 1384;
exports.BASEBOARD = { y0: 1360, y1: 1388 };
/** 창밖 풍경을 그리는 범위(모든 창의 뚫린 곳이 이 안에 들어간다) */
exports.VIEW_BOX = { x0: 180, y0: 250, x1: 900, y1: 1030 };
/** 방에 곱하는 시간대 빛(창밖 풍경 · 빛 층은 빼고) · 동물 실루엣에 얹는 색 */
exports.ROOM_TINT = ['#FFFFFF', '#F8E2D2', '#7E86AC'];
exports.CREATURE_TINT = { dusk: '#E9A27C', night: '#232B4A', a: [.14, .42] };
/** 바닥(모든 방에 있다): 동물 발이 닿는 선과 걸을 수 있는 x 범위 */
exports.FLOOR_ANCHOR = { id: 'floor', x: [70, 1010], y: 1480 };
/** 동물 기본 배율(고양이 그림 좌표 → 방 좌표) */
exports.CREATURE_SCALE = .4;
/**
 * 자리마다 아이템이 그릴 수 있는 곳(방 좌표). 벗어나면 이웃 자리와 겹친다.
 * 홈 UI가 덮는 곳: 위 아이콘(통계 x −86–94 · 설정 x 986–1166, y 169–349), 행동 시트 기본 위치(y 1505 아래). 시트를 내리면 아래도 보인다.
 */
exports.ZONES = {
    /** 창틀 · 창턱까지. 뚫린 곳은 VIEW_BOX 안 */
    window: { x0: 150, y0: 250, x1: 930, y1: 1110 },
    /** 올라갈 수 있는 큰 가구(소파 자리). 창 앞(x 180–900)에서는 위끝이 y 1000보다 아래, 양옆은 y 700까지 */
    seat: { x0: 60, y0: 700, x1: 1020, y1: 1520 },
    /** 조명: 왼쪽 바닥(스탠드) · 천장(펜던트 · 줄 전구, 아이콘을 피해 x 120–960) · 왼쪽 벽(벽등 · 네온) */
    lightFloorLeft: { x0: -120, y0: 560, x1: 250, y1: 1480 },
    lightCeiling: { x0: 120, y0: -15, x1: 960, y1: 390 },
    lightWallLeft: { x0: -120, y0: 380, x1: 170, y1: 960 },
    /** 오른쪽 벽 장식(액자 · 시계 · 선반 · 모빌) */
    wallDeco: { x0: 930, y0: 380, x1: 1200, y1: 960 },
    /** 오른쪽 바닥 구석(화분 · 책장 · 어항 · 협탁) */
    plantSpot: { x0: 860, y0: 960, x1: 1200, y1: 1480 },
    /** 창턱 위 작은 것(창의 sill 선 위, 높이 200 안) */
    sill: { x0: 150, y0: 890, x1: 930, y1: 1110 },
    /** 바닥 러그(대부분 시트 아래) */
    rug: { x0: 0, y0: 1480, x1: 1080, y1: 1740 },
    /** 바닥 앞 작은 것(장난감 · 바구니 · 물그릇, 시트 아래) */
    floorItem: { x0: 40, y0: 1500, x1: 1040, y1: 1900 },
};

}, {}]
  };
  var cache = {};
  function load(id) {
    if (cache[id]) return cache[id].exports;
    var d = defs[id], m = cache[id] = { exports: {} };
    d[0].call(m.exports, m, m.exports, function (spec) { return load(d[1][spec]); });
    return m.exports;
  }
  window.DRAWN_STAMP = "1791692618593";
  window.MARLandscape = load("../../Documents/Codex/2026-10-08/claude-startup-program-claim/work/native-export-v3/entry.js");
  window.DRAWN_SKIA = load("design/prototype-editorial/lab/drawn-web/skia-canvas2d.js");
})();
