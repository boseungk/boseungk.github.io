/* Read-only use of the app's own still renderer (recordProductStill, the same call that made the shipped recommendation PNGs).
   Writes the PNG masters to outputs/rooms-png/<id>/ and a JSON result to outputs/rooms-png/meta/res/<id>.json.
   Only needed when rooms or the app's art change (about 2 s per room). ROOMS_OUT overrides the output root (for a determinism test).
   usage: TYPESCRIPT_PATH=<typescript dir if Dayloom has no node_modules> node tools/rooms/render.cjs id1,id2,... */
const B = require('./boot.cjs');
const { fs, createCanvas, skia, RC, pf, resolveScenerySeason, createDrawnScenePreparation, DEFAULT_ROOM_LIGHT_PREFERENCES } = B;
const path = require('node:path');
const { loadImage } = require(path.join(process.env.NATIVE_NODE_MODULES || path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'), '@napi-rs/canvas'));
const ROOT = process.env.ROOMS_OUT || path.join(__dirname, '../../outputs/rooms-png'), META = path.join(ROOT, 'meta');
const SHIP = path.join(B.app, 'assets/images/collection/recommendations/');
const SW = 390, SH = 844, LS = 2.5;                      // scene units; layer scale (B format: 975x2110 scene)
const LW = SW * LS, LH = SH * LS, TW = 780, TH = 1688;   // shipped detail size (for the fidelity check); tod frames use the layer scale
const PAINT = ['view', 'wall', 'floor', 'rug', 'window', 'wallDeco', 'light', 'plantSpot', 'seat']; // compose.ts order
const ids = process.argv[2].split(',').filter(Boolean);
const res = createDrawnScenePreparation(() => 'summer');

function still(prepared, season, W, H, tod, lampOn) {
  const pic = pf.recordProductStill({ prepared, width: W, height: H, season, tod, seed: 31, lightOn: lampOn,
    lamp: { intensity: lampOn ? DEFAULT_ROOM_LIGHT_PREFERENCES.brightness : 0, color: DEFAULT_ROOM_LIGHT_PREFERENCES.color },
    reduced: true, frozen: false, focus: false, eventIds: [], preview: null }, false);
  const c = createCanvas(W, H), g = skia.canvasFor(c.getContext('2d'));
  g.begin(); g.drawPicture(pic);
  // napi-rs encodes from its recorded ops, where drawImage(layer canvas) points at a canvas the shim later reuses;
  // getImageData is the true raster, so bake it into a fresh canvas before encoding.
  const o = createCanvas(W, H); o.getContext('2d').putImageData(c.getContext('2d').getImageData(0, 0, W, H), 0, 0); return o;
}
const EMPTY = (v) => ({ ...v, pics: null, frame: null });
function only(prepared, slot) {
  const R = prepared.room;
  const room = { ...R, back: R.back.filter(l => l.slot === slot), front: R.front.filter(l => l.slot === slot), glows: [],
    view: slot === 'view' ? R.view : EMPTY(R.view), viewUnderlay: slot === 'view' ? R.viewUnderlay : undefined };
  return { ...prepared, room };
}
function bbox(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) { const o = y * W * 4; for (let x = 0; x < W; x++) if (d[o + x * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function crop(c, b) { const o = createCanvas(b.w, b.h); o.getContext('2d').drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); return o; }
function diff(a, b, W, H) {
  const A = a.getContext('2d').getImageData(0, 0, W, H).data, Bd = b.getContext('2d').getImageData(0, 0, W, H).data;
  let s = 0, n24 = 0, n60 = 0;
  for (let i = 0; i < A.length; i += 4) {
    const m = Math.max(Math.abs(A[i] - Bd[i]), Math.abs(A[i + 1] - Bd[i + 1]), Math.abs(A[i + 2] - Bd[i + 2]), Math.abs(A[i + 3] - Bd[i + 3]));
    s += (Math.abs(A[i] - Bd[i]) + Math.abs(A[i + 1] - Bd[i + 1]) + Math.abs(A[i + 2] - Bd[i + 2])) / 3;
    if (m > 24) n24++; if (m > 60) n60++;
  }
  const N = W * H; return { mean: +(s / N).toFixed(3), pct24: +(100 * n24 / N).toFixed(3), pct60: +(100 * n60 / N).toFixed(3) };
}
const save = (c, f) => fs.writeFileSync(f, c.toBuffer('image/png'));

(async () => {
  for (const id of ids) {
    const t0 = Date.now(), out = path.join(ROOT, id); fs.mkdirSync(out, { recursive: true });
    const recipe = RC.recommendedCompositions.find(r => r.id === id);
    const room = RC.compositionScene(recipe).room, season = resolveScenerySeason(room, 'summer');
    const prepared = res.get(room, season);
    const r = { id, season, structure: prepared.room.structure || 'indoor', slots: {} };
    // full frames
    const day780 = still(prepared, season, TW, TH, 0, false); save(day780, path.join(out, 'day780.png'));
    const ship = createCanvas(TW, TH); ship.getContext('2d').drawImage(await loadImage(SHIP + id + '.full.png'), 0, 0);
    r.renderVsShipped = diff(day780, ship, TW, TH);
    save(still(prepared, season, LW, LH, 1, false), path.join(out, 'dusk.png'));
    save(still(prepared, season, LW, LH, 2, false), path.join(out, 'night.png'));
    save(still(prepared, season, LW, LH, 2, true), path.join(out, 'lit.png'));
    const day975 = still(prepared, season, LW, LH, 0, false); save(day975, path.join(out, 'day.png'));
    // slot layers at 2.5x, cropped to their alpha box
    const stack = createCanvas(LW, LH), sx = stack.getContext('2d');
    for (const slot of PAINT) {
      const R = prepared.room;
      const present = slot === 'view' ? true : R.back.some(l => l.slot === slot) || R.front.some(l => l.slot === slot);
      if (!present) continue;
      const c = still(only(prepared, slot), season, LW, LH, 0, false);
      const b = bbox(c); if (!b) { r.slots[slot] = { empty: true }; continue; }
      save(crop(c, b), path.join(out, 'L-' + slot + '.png'));
      sx.drawImage(c, 0, 0);
      r.slots[slot] = { px: b, box: [b.x / LS, b.y / LS, b.w / LS, b.h / LS].map(v => +v.toFixed(1)) };
    }
    r.rawStackVsRender975 = diff(stack, day975, LW, LH);
    r.ms = Date.now() - t0;
    fs.mkdirSync(path.join(META, 'res'), { recursive: true });
    fs.writeFileSync(path.join(META, 'res', id + '.json'), JSON.stringify(r));
    console.log(id, r.season, r.structure, 'render', JSON.stringify(r.renderVsShipped), 'rawstack', JSON.stringify(r.rawStackVsRender975), r.ms + 'ms');
  }
  res.dispose();
})().catch(e => { console.error('ERR', e.stack); process.exit(1); });
