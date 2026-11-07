#!/usr/bin/env node
/* Room asset generator (PORT-PLAN A2, assets plan 6.2). Produces docs/assets/rooms/** (content-hashed webp), the manifest v2,
   docs/assets/i18n/rooms/source.json (Korean room text, id keys) and the lock architecture/room-asset-sources.json.

   usage: node tools/rooms/build-room-assets.mjs [--only id,id] [--force] [--from-webp] [--relayer id,id]
                                                  [--check] [--verify N] [--sources-md]
     (none)         encode what changed (lock hit = reuse), write files, manifest, text source, lock, prune per PORT-PLAN 2.3
     --only a,b     only these rooms may be (re-)encoded; every other room must be reusable from the lock
     --force        ignore lock hits
     --from-webp    tod frames from the 975 px q85 webp masters instead of outputs/rooms-png/<id>/{dusk,night,lit}.png
                    (records todSource "webp-q85"; fallback if the PNG masters are gone)
     --relayer ids  re-encode those rooms' layer masters from outputs/rooms-png/<id>/L-*.png (enc_one.sh policy: cwebp 1.6.0 lossy q88
                    alpha_q100 sharp_yuv vs lossless -z 9, lossless when within 15 %), for after tools/rooms/render.cjs re-rendered them
     --check        no encoding: files vs lock vs manifest, name == sha256[:10], every room complete, text keys, sources unchanged
     --verify N     re-encode N random lossy outputs and compare bytes (detects encoder drift)
     --sources-md   refresh the generated rooms table in docs/assets/ASSET-SOURCES.md from the lock

   Inputs: tools/rooms/rooms.json; outputs/rooms-png/{<id>/*.png, meta/{names,res,ver}} (A0 + render.cjs/names.cjs); Dayloom
   assets/images (read only); layer masters = committed docs/assets/rooms files (per the lock), else samples/c/assets/rooms,
   else outputs/samples-snapshot/c/assets/rooms. Layers are byte copies. Frames: tod 780x1688 q85 from the PNG masters, day and
   thumb q85 from Dayloom's full/thumbnail PNGs, items 224 px box q90 alpha 100, one file per unique content. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {SCRATCH_RE, ASSETS, ARCH, ROOT, OUTPUTS, DAYLOOM, DAYLOOM_IMAGES, sharp, sha256, hashedName, HASHED, toolVersions, dayloomInfo, readJSON, readLock, writeLock, withRunLock, retain, pool, parseArgs, rel, dirBytes, kb, mb} from '../assets/lib/common.mjs';
import {updateSection, table, fmt, today} from '../assets/lib/sources-md.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOMS_JSON = path.join(HERE, 'rooms.json');
const PNG = path.join(OUTPUTS, 'rooms-png'), META = path.join(PNG, 'meta');
const LOCK = path.join(ARCH, 'room-asset-sources.json');
const ROOMS_DIR = path.join(ASSETS, 'rooms');
const TEXT_SOURCE = path.join(ASSETS, 'i18n/rooms/source.json');
const SAMPLE_LAYERS = [path.join(ROOT, 'samples/c/assets/rooms'), path.join(OUTPUTS, 'samples-snapshot/c/assets/rooms')];
const OPENED_BUDGET_KB = 260;       // average opened weight per room (plan A acceptance); outliers are reported
const OPENED_HARD_KB = 450;         // no single room may exceed this

const SCENE = {w: 390, h: 844}, LAYER_SCALE = 2.5, FRAME = {w: 780, h: 1688};
const PAINT = ['view', 'wall', 'floor', 'rug', 'window', 'wallDeco', 'light', 'plantSpot', 'seat'];
const ASSEMBLY = {indoor: ['wall', 'floor', 'view', 'window', 'wallDeco', 'seat', 'light', 'rug', 'plantSpot'], outdoor: ['view', 'floor', 'seat', 'light', 'rug', 'plantSpot']};
const TOD = ['dusk', 'night', 'lit'];
const WEBP = {quality: 85, effort: 6, smartSubsample: true};
const OPS = {
  tod: {resize: {width: FRAME.w, height: FRAME.h, fit: 'fill', kernel: 'lanczos3'}, webp: WEBP},
  day: {webp: WEBP}, thumb: {webp: WEBP},
  item: {resize: {width: 224, height: 224, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3'}, webp: {quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true}},
  layer: {copy: true},
};
const NOTES = [
  "Rendered with the app's own still renderer (recordProductStill via recordRecommendationRoom inputs: seed 31, reduced, no animal, no events, scenery season resolved from summer), tools/rooms/render.cjs.",
  'layers: one transparent webp per slot, cropped to its box; x/y/w/h are scene units (390x844), image pixels = scene units x 2.5 (975x2110). Listed back to front (paint order); z is the stacking index. Stack them in that order for an exact day room. Byte copies of the masters (enc_one.sh policy: cwebp 1.6.0 lossy q88 alpha_q 100 sharp_yuv, or lossless -z 9 when within 15 % of the lossy size). Lossless masters re-encode byte for byte; lossy masters are not bit-reproducible from the PNGs.',
  'items: in assembly order; item = definition id (text key item.<item>), variant = text key variant.<variant>, present only where the app would show a colour name; thumb is the app decor thumbnail re-encoded at a 224 px box.',
  'tod: full-scene frames at 780x1688 (the day frame size), q85, resampled (lanczos3) from the 975x2110 app renders. dusk = tod 1, lamp off. night = tod 2, lamp off. lit = tod 2, lamp on at the app default (brightness .65, #FFD49B): interior lifted by the night-light colour matrix, sky untouched, lamp glows. Crossfade night to lit for the lamp turning on. day = the app full.png at q85 (equal to the stacked layers).',
  'Outdoor rooms have no wall or window; their view is the whole backdrop and is assembled first. The app applies no interior night light outdoors, so lit only adds the lamp glow.',
  'match: the stacked layers, scaled to the shipped 780x1688 full.png, against that file: pctOff = % of pixels off by more than 24/255 on any channel, meanAbs = mean absolute RGB difference (0-255). Almost all of it is the 975 to 780 resampling.',
];

const exists = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const img = rel => path.join(DAYLOOM_IMAGES, rel);
const stripId = rel => rel.replace(/^dayloom:/, '');

function themeIds() {
  const text = fs.readFileSync(path.join(DAYLOOM, 'src/features/collection/domain/collection-themes.ts'), 'utf8');
  const out = {}; for (const m of text.matchAll(/\bid: "(\w+)",\s*name: "([^"]+)",\s*nameEn/g)) out[m[2]] = m[1];
  return out;
}

// ---- data ---------------------------------------------------------------------------------------------------------------
function loadData() {
  const rooms = readJSON(ROOMS_JSON), names = readJSON(path.join(META, 'names.json'));
  const themes = themeIds(), problems = [];
  const placeId = {'실내': 'indoor', '야외': 'outdoor'};
  const res = {}, ver = {};
  for (const r of rooms) {
    res[r.id] = readJSON(path.join(META, 'res', r.id + '.json'));
    const vf = path.join(META, 'ver', r.id + '.json'); ver[r.id] = exists(vf) ? readJSON(vf) : null;
    if (!themes[r.theme]) problems.push(`${r.id}: theme "${r.theme}" is not an app theme`);
    if (!placeId[r.place]) problems.push(`${r.id}: place "${r.place}" unknown`);
    if (names[r.id].recipeTitle !== r.name) problems.push(`${r.id}: rooms.json name "${r.name}" differs from the app title "${names[r.id].recipeTitle}"`);
  }
  return {rooms, names, themes, placeId, res, ver, problems};
}

// Variant text keys: the last id segment, unless the same segment carries different labels (the scenery "original"), then the whole content id.
function variantKeys(names) {
  const label = new Map();
  for (const o of Object.values(names)) for (const it of o.items) { if (!shown(it, o)) continue; const seg = it.id.split('.').pop(); (label.get(seg) ?? label.set(seg, new Set()).get(seg)).add(it.variant); }
  const conflict = new Set([...label].filter(([, v]) => v.size > 1).map(([k]) => k));
  return id => { const seg = id.split('.').pop(); return conflict.has(seg) ? id : seg; };
}
const shown = (it, o) => it.variant && it.variant !== o.recipeTitle && it.variant !== it.name;
const itemKey = id => id.split('.').slice(0, -1).join('.');

// ---- jobs ---------------------------------------------------------------------------------------------------------------
function layerMaster(id, slot, lock) {
  const prev = lock?.outputs.find(o => o.logical === `rooms/${id}/${slot}.webp`);
  if (prev && exists(path.join(ASSETS, prev.file))) return {file: path.join(ASSETS, prev.file), from: 'docs'};
  for (const dir of SAMPLE_LAYERS) { const f = path.join(dir, id, slot + '.webp'); if (exists(f)) return {file: f, from: 'sample'}; }
  throw new Error(`No layer master for ${id}/${slot} (docs lock, samples/c, samples-snapshot all missing)`);
}
function relayer(id, slot) {   // enc_one.sh policy
  const src = path.join(PNG, id, `L-${slot}.png`), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mar-layer-'));
  const lossy = path.join(tmp, 'a.webp'), ll = path.join(tmp, 'b.webp');
  execFileSync('cwebp', ['-quiet', '-q', '88', '-alpha_q', '100', '-alpha_filter', 'best', '-m', '6', '-sharp_yuv', src, '-o', lossy]);
  execFileSync('cwebp', ['-quiet', '-lossless', '-z', '9', src, '-o', ll]);
  const a = fs.statSync(lossy).size, b = fs.statSync(ll).size, bytes = fs.readFileSync(b * 100 <= a * 115 ? ll : lossy);
  fs.rmSync(tmp, {recursive: true, force: true}); return bytes;
}

async function buildJobs(data, lock, flags) {
  const {rooms, names, res} = data, jobs = [], fromWebp = !!flags.get('from-webp');
  const relayerIds = new Set(flags.get('relayer') && flags.get('relayer') !== true ? String(flags.get('relayer')).split(',') : []);
  for (const r of rooms) {
    const id = r.id, structure = res[id].structure;
    for (const slot of PAINT) {
      const s = res[id].slots[slot]; if (!s || s.empty) continue;
      if (relayerIds.has(id)) { const bytes = relayer(id, slot); jobs.push({room: id, kind: 'layer', logical: `rooms/${id}/${slot}.webp`, label: `png:${id}/L-${slot}.png`, bytes, op: {...OPS.layer, cwebp: 'enc_one policy'}}); continue; }
      const m = layerMaster(id, slot, lock);
      jobs.push({room: id, kind: 'layer', logical: `rooms/${id}/${slot}.webp`, label: `layer:${id}/${slot}.webp`, file: m.file, op: OPS.layer});
    }
    for (const t of TOD) {
      if (fromWebp) { const f = SAMPLE_LAYERS.map(d => path.join(d, id, t + '.webp')).find(exists); if (!f) throw new Error(`--from-webp: ${id}/${t}.webp missing`); jobs.push({room: id, kind: 'tod', logical: `rooms/${id}/${t}.webp`, label: `webp-q85:${id}/${t}.webp`, file: f, op: OPS.tod}); }
      else jobs.push({room: id, kind: 'tod', logical: `rooms/${id}/${t}.webp`, label: `rooms-png:${id}/${t}.png`, file: path.join(PNG, id, t + '.png'), op: OPS.tod});
    }
    jobs.push({room: id, kind: 'day', logical: `rooms/${id}/day.webp`, label: `dayloom:collection/recommendations/${id}.full.png`, file: img(`collection/recommendations/${id}.full.png`), op: OPS.day});
    jobs.push({room: id, kind: 'thumb', logical: `rooms/${id}/thumb.webp`, label: `dayloom:collection/recommendations/${id}.thumbnail.png`, file: img(`collection/recommendations/${id}.thumbnail.png`), op: OPS.thumb});
  }
  // items: one file per unique source content; the first stem (sorted) owns it
  const stems = new Map();
  for (const r of rooms) for (const it of names[r.id].items) {
    const rel = it.thumb.replace(/^\/app\//, ''); stems.set(it.id, {rel, rooms: new Set([...(stems.get(it.id)?.rooms ?? []), r.id])});
  }
  const byContent = new Map(), aliases = {};
  for (const stem of [...stems.keys()].sort()) {
    const f = img(stems.get(stem).rel); if (!exists(f)) throw new Error(`Missing item thumbnail ${f}`);
    const h = sha256(fs.readFileSync(f));
    if (byContent.has(h)) { aliases[stem] = byContent.get(h); continue; }
    byContent.set(h, stem);
    jobs.push({rooms: [...stems.get(stem).rooms], kind: 'item', logical: `rooms/items/${stem}.webp`, label: `dayloom:${stems.get(stem).rel}`, file: f, op: OPS.item});
  }
  return {jobs, aliases, stems};
}

async function encodeJob(job, bytes) {
  if (job.op.copy) return bytes;
  let s = sharp(bytes); if (job.op.resize) s = s.resize(job.op.resize);
  return s.webp(job.op.webp).toBuffer();
}
const jobKey = (job, srcSha, T) => sha256(JSON.stringify([srcSha, job.op, job.op.copy ? null : [T.sharp, T.libwebp]])).slice(0, 16);

async function build(flags) {
  const t0 = Date.now(), T = toolVersions(), data = loadData(), lock = readLock(LOCK);
  const only = flags.get('only') && flags.get('only') !== true ? new Set(String(flags.get('only')).split(',')) : null;
  if (only) for (const id of only) if (!data.rooms.some(r => r.id === id)) throw new Error(`--only: unknown room ${id}`);
  const old = new Map((lock?.outputs ?? []).map(o => [o.logical, o]));
  const {jobs, aliases} = await buildJobs(data, lock, flags);
  let encoded = 0, reused = 0;
  const outputs = await pool(4, jobs, async job => {
    const srcBytes = job.bytes ?? fs.readFileSync(job.file), srcSha = sha256(srcBytes), key = jobKey(job, srcSha, T), prev = old.get(job.logical);
    const selected = !only || (job.room ? only.has(job.room) : job.rooms.some(r => only.has(r)));
    const hit = !flags.get('force') && prev && fs.existsSync(path.join(ASSETS, prev.file)) && (prev.key === key || (!selected && !flags.get('force')));
    let entry;
    if (hit) { entry = prev; reused++; }
    else {
      if (only && !selected) throw new Error(`--only: ${job.logical} is not in the lock; run without --only first`);
      const bytes = await encodeJob(job, srcBytes), file = hashedName(job.logical, bytes), target = path.join(ASSETS, file);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);
      const m = await sharp(bytes).metadata();
      entry = {logical: job.logical, file, sha256: sha256(bytes), bytes: bytes.length, w: m.width, h: m.height, source: job.label, sourceSha256: srcSha, op: job.op, key};
      encoded++;
    }
    return {...entry, kind: job.kind};
  });
  const by = new Map(outputs.map(o => [o.logical, o]));
  const m = assemble(data, by, aliases, flags);
  const manifestBytes = Buffer.from(JSON.stringify(m.manifest)), manifestLogical = 'rooms/manifest.json', manifestFile = hashedName(manifestLogical, manifestBytes);
  fs.writeFileSync(path.join(ASSETS, manifestFile), manifestBytes);
  const manifestEntry = {logical: manifestLogical, file: manifestFile, sha256: sha256(manifestBytes), bytes: manifestBytes.length, w: null, h: null, source: 'generated by tools/rooms/build-room-assets.mjs', sourceSha256: null, op: {manifest: 2}, key: sha256(manifestBytes).slice(0, 16), kind: 'manifest'};
  fs.mkdirSync(path.dirname(TEXT_SOURCE), {recursive: true});
  fs.writeFileSync(TEXT_SOURCE, JSON.stringify(m.text, null, 1) + '\n');
  const all = [...outputs, manifestEntry].sort((a, b) => a.logical.localeCompare(b.logical));
  const todSource = flags.get('from-webp') ? 'webp-q85' : (lock?.extra?.todSource && only ? lock.extra.todSource : 'png-master');
  writeLock(LOCK, {version: 1, generator: 'tools/rooms/build-room-assets.mjs', tools: T, dayloom: dayloomInfo(),
    extra: {todSource, notes: NOTES, itemAliases: aliases, rooms: m.perRoom, problems: [...data.problems, ...m.problems], limits: {pct24: 0.5, openedAvgKB: OPENED_BUDGET_KB, openedMaxKB: OPENED_HARD_KB}}, outputs: all});
  const removed = retain(ROOMS_DIR, LOCK, all.map(o => o.file));
  report(m, all, removed, encoded, reused, Date.now() - t0);
  writeSourcesMd();
  if (m.problems.length || data.problems.length) { console.error('PROBLEMS:\n  ' + [...data.problems, ...m.problems].join('\n  ')); process.exitCode = 1; }
}

// Manifest v2, text source and per-room opened weights from the output table.
function assemble(data, by, aliases, flags) {
  const {rooms, names, themes, placeId, res, ver} = data, problems = [], perRoom = {};
  const variantKey = variantKeys(names), fileOf = logical => by.get(logical)?.file;
  const relPath = file => file.replace(/^rooms\//, '');
  const manifest = {version: 2, scene: SCENE, layerScale: LAYER_SCALE, frame: FRAME, paintOrder: PAINT, assemblyOrder: ASSEMBLY, order: rooms.map(r => r.id), rooms: {}};
  const text = {};
  for (const r of rooms) {
    const id = r.id, n = names[id], rs = res[id], structure = rs.structure, order = ASSEMBLY[structure], p = [];
    const layers = []; let opened = 0;
    PAINT.forEach(slot => {
      const s = rs.slots[slot]; if (!s) return;
      if (s.empty) { p.push(`${slot} layer rendered empty`); return; }
      const o = by.get(`rooms/${id}/${slot}.webp`); if (!o) { p.push(`${slot}.webp missing`); return; }
      const [x, y, w, h] = s.box; layers.push({slot, src: relPath(o.file), x, y, w, h, z: layers.length + 1}); opened += o.bytes;
    });
    const tod = {}; for (const t of TOD) { const o = by.get(`rooms/${id}/${t}.webp`); if (o) { tod[t] = relPath(o.file); opened += o.bytes; } else p.push(`${t}.webp missing`); }
    const day = by.get(`rooms/${id}/day.webp`), thumb = by.get(`rooms/${id}/thumb.webp`); opened += day?.bytes ?? 0;
    const byslot = Object.fromEntries(n.items.map(i => [i.slot, i]));
    const seenFiles = new Set(), items = order.filter(s => byslot[s]).map(slot => {
      const i = byslot[slot], canonical = aliases[i.id] ?? i.id, o = by.get(`rooms/items/${canonical}.webp`);
      if (!o) p.push(`item thumbnail missing for ${i.id}`); else if (!seenFiles.has(o.file)) { seenFiles.add(o.file); opened += o.bytes; }
      text[`item.${itemKey(i.id)}`] = i.name;
      const e = {slot, item: itemKey(i.id), ...(shown(i, n) ? {variant: variantKey(i.id)} : {}), thumb: o ? relPath(o.file) : null, layer: layers.some(l => l.slot === slot)};
      if (e.variant) text[`variant.${e.variant}`] = i.variant;
      return e;
    });
    for (const s of Object.keys(byslot)) if (!order.includes(s)) p.push(`slot ${s} not in assembly order`);
    for (const l of layers) if (!byslot[l.slot]) p.push(`layer ${l.slot} has no item`);
    if (!day) p.push('day.webp missing'); if (!thumb) p.push('thumb.webp missing');
    const v = ver[id];
    if (!v) p.push('not verified (outputs/rooms-png/meta/ver)'); else {
      if (v.stackVsShipped.pct24 > 0.5) p.push(`assembled day differs from shipped (${v.stackVsShipped.pct24}% px)`);
      for (const t of TOD) if (v['webp_' + t]?.pct24 > 0.5) p.push(`${t} master compression (${v['webp_' + t].pct24}% px)`);
    }
    text[`room.${id}.name`] = r.name; text[`room.${id}.desc`] = r.description;
    manifest.rooms[id] = {wall: r.wall, theme: themes[r.theme], place: placeId[r.place], structure, season: rs.season, thumb: thumb && relPath(thumb.file), day: day && relPath(day.file), tod, layers, items, kb: Math.round(opened / 102.4) / 10};
    perRoom[id] = {ok: p.length === 0, note: p.join('; '), match: v ? {pctOff: v.stackVsShipped.pct24, meanAbs: v.stackVsShipped.mean} : null};
    if (opened / 1024 > OPENED_HARD_KB) p.push(`opened weight ${kb(opened)} KB > ${OPENED_HARD_KB} KB`);
    for (const x of p) problems.push(`${id}: ${x}`);
  }
  for (const [name, id] of Object.entries(themes)) text[`theme.${id}`] = name;
  text['place.indoor'] = '실내'; text['place.outdoor'] = '야외';
  const sorted = Object.fromEntries(Object.keys(text).sort().map(k => [k, text[k]]));
  return {manifest, text: sorted, perRoom, problems};
}

function report(m, all, removed, encoded, reused, ms) {
  const sum = k => all.filter(o => o.kind === k).reduce((a, o) => a + o.bytes, 0), cnt = k => all.filter(o => o.kind === k).length;
  const kbs = Object.values(m.manifest.rooms).map(r => r.kb), dir = dirBytes(ROOMS_DIR);
  console.log(`rooms: ${all.length} files (${encoded} encoded, ${reused} reused), ${removed.length} stale removed, ${(ms / 1000).toFixed(1)} s`);
  for (const k of ['layer', 'tod', 'day', 'thumb', 'item', 'manifest']) console.log(`  ${k.padEnd(9)} ${String(cnt(k)).padStart(4)} files ${String(kb(sum(k))).padStart(9)} KB`);
  console.log(`docs/assets/rooms: ${dir.files} files, ${mb(dir.bytes)} MB; opened room weight avg ${(kbs.reduce((a, b) => a + b, 0) / kbs.length).toFixed(1)} KB, max ${Math.max(...kbs)} KB (budget ${OPENED_BUDGET_KB}); wall tiles (101 thumbs) ${kb(sum('thumb'))} KB`);
  const avg = kbs.reduce((a, b) => a + b, 0) / kbs.length, over = Object.entries(m.manifest.rooms).filter(([, r]) => r.kb > OPENED_BUDGET_KB).map(([id, r]) => `${id} ${r.kb}`);
  console.log(`  opened weight: average ${avg.toFixed(1)} KB ${avg <= OPENED_BUDGET_KB ? 'within' : 'OVER'} the ${OPENED_BUDGET_KB} KB budget; ${over.length} rooms above it (detailed frames, not layers): ${over.join(', ')}`);
  if (avg > OPENED_BUDGET_KB) m.problems.push(`average opened weight ${avg.toFixed(1)} KB > ${OPENED_BUDGET_KB}`);
}

// ---- check / verify ------------------------------------------------------------------------------------------------------
function check() {
  const lock = readLock(LOCK); if (!lock) throw new Error(`${rel(LOCK)} missing; run build-room-assets.mjs`);
  const problems = [], by = new Map(lock.outputs.map(o => [o.logical, o])), data = loadData();
  problems.push(...data.problems);
  for (const o of lock.outputs) {
    const f = path.join(ASSETS, o.file);
    if (!exists(f)) { problems.push(`missing ${o.file}`); continue; }
    const b = fs.readFileSync(f);
    if (sha256(b) !== o.sha256) problems.push(`${o.file}: content differs from the lock`);
    if (!o.file.includes('.' + sha256(b).slice(0, 10) + '.')) problems.push(`${o.file}: name != sha256[:10] of its content`);
  }
  const known = new Set(lock.outputs.map(o => o.file));
  (function walk(d) { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (!known.has(path.relative(ASSETS, p).split(path.sep).join('/'))) problems.push(`unreferenced file ${path.relative(ASSETS, p)}`); } })(ROOMS_DIR);
  const man = by.get('rooms/manifest.json'); let manifest = null;
  if (!man) problems.push('manifest not in lock'); else { manifest = readJSON(path.join(ASSETS, man.file)); if (manifest.version !== 2) problems.push('manifest version != 2'); }
  const ids = data.rooms.map(r => r.id);
  if (manifest) {
    if (JSON.stringify(manifest.order) !== JSON.stringify(ids)) problems.push('manifest order differs from rooms.json');
    if (Object.keys(manifest.rooms).length !== ids.length) problems.push(`manifest has ${Object.keys(manifest.rooms).length} rooms, rooms.json ${ids.length}`);
    const text = readJSON(TEXT_SOURCE), need = key => { if (!(key in text)) problems.push(`text source lacks ${key}`); };
    const fileOk = (id, p) => { if (!p) problems.push(`${id}: empty path`); else if (!known.has('rooms/' + p)) problems.push(`${id}: manifest points at unknown file ${p}`); };
    for (const id of ids) {
      const r = manifest.rooms[id]; if (!r) { problems.push(`${id}: missing from manifest`); continue; }
      fileOk(id, r.thumb); fileOk(id, r.day); for (const t of TOD) fileOk(id, r.tod?.[t]);
      if (!r.layers?.length) problems.push(`${id}: no layers`); for (const l of r.layers ?? []) fileOk(id, l.src);
      if (!r.items?.length) problems.push(`${id}: no items`); for (const i of r.items ?? []) { fileOk(id, i.thumb); need(`item.${i.item}`); if (i.variant) need(`variant.${i.variant}`); }
      need(`room.${id}.name`); need(`room.${id}.desc`); need(`theme.${r.theme}`); need(`place.${r.place}`);
      if (r.kb > OPENED_HARD_KB) problems.push(`${id}: opened weight ${r.kb} KB > ${OPENED_HARD_KB}`);
    }
  }
  let changed = 0, compared = 0;
  if (exists(path.join(DAYLOOM_IMAGES, 'collection/recommendations/salt-mirror.full.png'))) {
    for (const o of lock.outputs) {
      if (!o.source || !o.sourceSha256) continue;
      const f = o.source.startsWith('dayloom:') ? img(stripId(o.source)) : o.source.startsWith('rooms-png:') ? path.join(PNG, o.source.slice(10).replace(':', '/')) : null;
      if (!f || !exists(f)) continue;
      compared++; if (sha256(fs.readFileSync(f)) !== o.sourceSha256) { changed++; problems.push(`${o.logical}: source ${o.source} changed since the lock`); }
    }
  }
  if (SCRATCH_RE.test(JSON.stringify(lock))) problems.push('lock contains scratch paths');
  if (problems.length) { console.error('FAIL rooms\n  ' + problems.slice(0, 60).join('\n  ') + (problems.length > 60 ? `\n  … ${problems.length - 60} more` : '')); process.exit(1); }
  const kbs = Object.values(manifest.rooms).map(r => r.kb), dir = dirBytes(ROOMS_DIR);
  console.log(`PASS rooms: ${ids.length} rooms, ${lock.outputs.length} files (every name == sha256[:10]), layers/tod/day/thumb/items present, text keys complete, ${compared} sources compared (${changed} changed); docs/assets/rooms ${mb(dir.bytes)} MB; opened weight max ${Math.max(...kbs)} KB, avg ${(kbs.reduce((a, b) => a + b, 0) / kbs.length).toFixed(1)} KB (${Object.values(manifest.rooms).filter(r => r.kb > OPENED_BUDGET_KB).length} rooms above ${OPENED_BUDGET_KB} KB)`);
  if (kbs.reduce((a, b) => a + b, 0) / kbs.length > OPENED_BUDGET_KB) { console.error('FAIL rooms: average opened weight over budget'); process.exit(1); }
}

async function verify(n) {
  const lock = readLock(LOCK), data = loadData(), {jobs} = await buildJobs(data, lock, new Map());
  const byLogical = new Map(jobs.map(j => [j.logical, j]));
  const cand = lock.outputs.filter(o => byLogical.has(o.logical) && !o.op.copy && exists(byLogical.get(o.logical).file ?? ''));
  const pick = [...cand].sort(() => Math.random() - .5).slice(0, n); let bad = 0;
  for (const o of pick) { const j = byLogical.get(o.logical), bytes = await encodeJob(j, fs.readFileSync(j.file)); if (sha256(bytes) !== o.sha256) { bad++; console.error(`DRIFT ${o.logical}: ${sha256(bytes).slice(0, 10)} != ${o.sha256.slice(0, 10)}`); } }
  const T = toolVersions(); if (lock.tools.sharp !== T.sharp || lock.tools.libwebp !== T.libwebp) console.error(`note: lock written with sharp ${lock.tools.sharp} / libwebp ${lock.tools.libwebp}; running ${T.sharp} / ${T.libwebp}`);
  if (bad) { console.error(`FAIL rooms verify: ${bad}/${pick.length} drifted`); process.exit(1); }
  console.log(`PASS rooms verify: ${pick.length} re-encoded outputs are byte-identical`);
}

function writeSourcesMd() {
  const lock = readLock(LOCK); if (!lock) return;
  const g = k => lock.outputs.filter(o => o.kind === k), sum = a => a.reduce((x, o) => x + o.bytes, 0);
  const man = JSON.parse(fs.readFileSync(path.join(ASSETS, lock.outputs.find(o => o.kind === 'manifest').file), 'utf8'));
  const kbs = Object.values(man.rooms).map(r => r.kb);
  const rows = [
    ['`rooms/<id>/<slot>.<h>.webp`', 'room layers (view, wall, floor, rug, window, wallDeco, light, plantSpot, seat)', g('layer').length, 'cropped to the slot box, scene ×2.5', 'byte copy of the app-render masters (lossless or lossy q88 α100)', fmt(sum(g('layer')))],
    ['`rooms/<id>/{dusk,night,lit}.<h>.webp`', 'time-of-day frames', g('tod').length, '780 × 1688', 'app still render 975 × 2110 (tools/rooms/render.cjs) → lanczos3 → webp q85', fmt(sum(g('tod')))],
    ['`rooms/<id>/day.<h>.webp`', 'finished day room', g('day').length, '780 × 1688', 'Dayloom `collection/recommendations/<id>.full.png` → webp q85', fmt(sum(g('day')))],
    ['`rooms/<id>/thumb.<h>.webp`', 'wall tile and cover', g('thumb').length, '312 × 675', 'Dayloom `collection/recommendations/<id>.thumbnail.png` → webp q85', fmt(sum(g('thumb')))],
    ['`rooms/items/<stem>.<h>.webp`', 'item thumbnails, one file per unique content', g('item').length, '≤ 224 × 224', 'Dayloom `decor/{thumbnails,scenery-thumbnails}/<stem>.png` → webp q90 α100', fmt(sum(g('item')))],
    ['`rooms/manifest.<h>.json`', 'structure only (manifest v2)', 1, '—', 'generated; text keys live in `i18n/rooms/source.json`', fmt(sum(g('manifest')))],
  ];
  const md = `## Recommended rooms (room view) (generated ${today()})\n\nBuilt by \`tools/rooms/build-room-assets.mjs\`; the lock \`architecture/room-asset-sources.json\` records every file's source, source hash, encode parameters and the render contract (sharp ${lock.tools.sharp}, libwebp ${lock.tools.libwebp}; Dayloom commit \`${lock.dayloom.commit?.slice(0, 10) ?? 'unknown'}\`). Time-of-day source: ${lock.extra.todSource}.\n\n` +
    table(['Files', 'Use', 'Count', 'Dimensions', 'Source and encode', 'Bytes'], rows) +
    `\n\nTotal ${lock.outputs.length} files, ${fmt(lock.outputs.reduce((a, o) => a + o.bytes, 0))} bytes. Opened room weight (layers + 3 frames + day + items): average ${(kbs.reduce((a, b) => a + b, 0) / kbs.length).toFixed(1)} KB, maximum ${Math.max(...kbs)} KB.\n\nRender contract: ${lock.extra.notes[0]} ${lock.extra.notes[3]}\n`;
  updateSection('rooms', md);
}

const flags = parseArgs(process.argv.slice(2));
try {
  if (flags.get('check')) check();
  else if (flags.get('verify')) await verify(Number(flags.get('verify')) || 20);
  else if (flags.get('sources-md')) { writeSourcesMd(); console.log('rooms table refreshed in docs/assets/ASSET-SOURCES.md'); }
  else await withRunLock(() => build(flags));
} catch (e) { console.error(e.stack ?? e); process.exit(1); }
