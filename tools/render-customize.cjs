/* Native Dayloom composition export. Reads the app; writes only website assets. */
const fs = require('node:fs'), path = require('node:path');
const {app, native, createCanvas} = require('./native-renderer.cjs');
const api = native(app + '/design/prototype-editorial/lab/drawn-web/entry.js');
const skia = native(app + '/design/prototype-editorial/lab/drawn-web/skia-canvas2d.js');
const {compositionScene} = native(app + '/src/app-shell/collection/recommended-compositions.ts');
const {collectionThemes} = native(app + '/src/features/collection/domain/collection-themes.ts');
const prep = native(app + '/src/world/drawn/scene/preparation.ts').createDrawnScenePreparation(() => 'summer');
const output = path.resolve(__dirname, '../docs/assets/v5/customize');
fs.mkdirSync(output, {recursive: true});
const projection = {width: 780, height: 1280, top: 24, scale: 780 / 1080, camera: api.CAMERA};
function surface() {
  const canvas = createCanvas(projection.width, projection.height), g = skia.canvasFor(canvas.getContext('2d'));
  g.begin(); g.translate(0, projection.top); g.scale(projection.scale, projection.scale);
  g.translate(api.CAMERA.x, api.CAMERA.y); g.scale(api.CAMERA.s, api.CAMERA.s);
  return {canvas, g};
}
function bounds(canvas) {
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return {left, top, right, bottom, uncropped: right < 0 || (left > 0 && top > 0 && right < canvas.width - 1 && bottom < canvas.height - 1)};
}
const theme = collectionThemes.find(theme => theme.id === 'garden');
const themeScene = compositionScene({id: theme.id, place: 'indoor', ...theme.room}).room;
const base = {id: 'web-default', place: 'indoor', nativeSelection: api.DEFAULT_SELECTION, selections: {}};
const stages = [
  ['step-0', base],
  ['step-1', {...base, id: 'web-lamp', nativeSelection: {...api.DEFAULT_SELECTION, light: themeScene.selection.light}, selections: {light: theme.room.selections.light}}],
  ['step-2', {...base, id: 'web-seat-rug', nativeSelection: {...api.DEFAULT_SELECTION, ...Object.fromEntries(['light', 'seat', 'rug'].map(slot => [slot, themeScene.selection[slot]]))}, selections: Object.fromEntries(['light', 'seat', 'rug'].map(slot => [slot, theme.room.selections[slot]]))}],
  ['step-3', {id: theme.id, place: 'indoor', ...theme.room}],
];
const unlit = process.argv.includes('--unlit');
const nightOnly = process.argv.includes('--night-only');
const duskOnly = process.argv.includes('--dusk-only');
const incrementalOnly = process.argv.includes('--incremental-only');
const stagesOnly = process.argv.includes('--stages-only');
if ([nightOnly, duskOnly, incrementalOnly, stagesOnly].filter(Boolean).length > 1) throw new Error('Choose one export mode');
if (unlit && !nightOnly) throw new Error('--unlit requires --night-only');
const report = incrementalOnly || stagesOnly ? JSON.parse(fs.readFileSync(path.join(output, 'render-evidence.json'), 'utf8')) : {source: app, projection, stages: [], rooms: []};
if (incrementalOnly) report.stages = report.stages.filter(stage => !['step-0', 'step-1', 'step-2'].includes(stage.id));
if (stagesOnly) report.stages = [];
report.sequenceTheme = theme.id;
const jobs = stagesOnly ? stages : incrementalOnly ? stages.slice(0, 3) : [...stages, ...collectionThemes.map(theme => [theme.id, {id: theme.id, place: 'indoor', ...theme.room}])];
for (const [baseId, recipe] of jobs) {
  if ((nightOnly || duskOnly) && baseId.startsWith('step-')) continue;
  const id = baseId + (nightOnly ? (unlit ? '-night-unlit' : '-night') : duskOnly ? '-dusk' : '');
  const tod = nightOnly ? 2 : duskOnly ? 1 : 0;
  const season = recipe.nativeSelection ? 'spring' : 'summer';
  const room = recipe.nativeSelection ? api.composeRoom(recipe.nativeSelection, {season, lightOn: true}) : prep.get(compositionScene(recipe).room, season).room;
  const env = {tod, season, lightOn: !unlit && (nightOnly || !!recipe.nativeSelection), tint: room.tint[tod], shadow: room.shadowBase, now: 0, windowOpen: 1, gust: 0, reduced: true};
  const {canvas, g} = surface(); api.drawRoomBack(g, room, tod, env); api.drawRoomFront(g, room, tod, env);
  // Extend only the native wall's edge color into the safety padding.
  const ctx = canvas.getContext('2d'), wall = ctx.getImageData(0, projection.top + 1, 1, 1).data;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = `rgb(${wall[0]},${wall[1]},${wall[2]})`; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  fs.writeFileSync(path.join(output, id + '.png'), canvas.toBuffer('image/png'));
  const slots = {};
  for (const slot of ['window', 'light', 'rug', 'seat']) {
    const isolated = surface();
    for (const layer of [...room.back, ...room.front].filter(layer => layer.slot === slot)) {
      if (layer.pics) isolated.g.drawPicture(layer.pics[0]);
      if (layer.frame) {isolated.g.save(); if (layer.at) isolated.g.translate(...layer.at); layer.frame(isolated.g, layer.built, env); isolated.g.restore();}
    }
    slots[slot] = bounds(isolated.canvas);
    if (!slots[slot].uncropped) throw Error(id + ': clipped ' + slot + ' ' + JSON.stringify(slots[slot]));
  }
  const floorAnchor = room.anchors.find(anchor => anchor.id === 'floor');
  if (!floorAnchor) throw new Error(id + ': native floor anchor missing');
  const entry = {id, petAnchor: {x: (api.CAMERA.x + api.ROOM.place.catX * api.CAMERA.s) * projection.scale, y: projection.top + (api.CAMERA.y + floorAnchor.y * api.CAMERA.s) * projection.scale, scale: projection.scale * api.CAMERA.s * api.CREATURE_SCALE}, environmentId: recipe.environmentId, nativeSelection: recipe.nativeSelection, season, selections: recipe.selections, omittedSlots: recipe.omittedSlots || [], slots};
  report[id.startsWith('step-') ? 'stages' : 'rooms'].push(entry);
  console.log(id + ': window/light/rug/seat fully inside frame');
}
report.stages.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(output, nightOnly ? (unlit ? 'unlit-render-evidence.json' : 'night-render-evidence.json') : duskOnly ? 'dusk-render-evidence.json' : 'render-evidence.json'), JSON.stringify(report, null, 2) + '\n');
prep.dispose();
