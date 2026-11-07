#!/usr/bin/env node
/* Art generator (PORT-PLAN A3, assets plan 7.1). Encodes the images listed in tools/assets/art/*.json into content-hashed
   files under docs/assets/art/ and records provenance in architecture/art-asset-sources.json (also the incremental lock).

   usage: node tools/assets/build-art.mjs [--list home,community,brand] [--check] [--verify N] [--sources-md] [--force]
     (none)        encode what changed (lock hit = reuse), write hashed files, write the lock, prune per PORT-PLAN 2.3
     --check       encode nothing: lists vs lock, file name == sha256[:10], sources unchanged
     --verify N    re-encode N random outputs and compare bytes (detects encoder drift)
     --fidelity N  decode N random lossy outputs and diff them against the pre-encode image (pct24 <= 1 %; the 192 px theme covers are the worst case, room frames use 0.5 %)
     --sources-md  rewrite the generated art and icon tables in docs/assets/ASSET-SOURCES.md from the lock (no encoding)

   A list is a JSON array of rows (tools/assets/art/<list>.json):
     {"out":"art/pieces/opal.webp", "src":"dayloom:ui/pieces/opal-v2-color.png",
      "crop":{"left":0,"top":330,"width":2064,"height":1320}, "resize":{"width":256}, "extend":{...sharp extend},
      "composite":[{"src":"src:records/photo.png","left":10,"top":20,"width":120}],
      "webp":{"quality":90,"alphaQuality":100} | "lossless":true | "jpeg":{"quality":82} | "png":{}, "note":"free text kept in the lock"}
   src prefixes: dayloom: (Dayloom assets/images, read only) | dayloom-root: (Dayloom repo root) | src: (tools/assets/src/)
                 | copy:<path> (byte copy; <path> may itself start with one of the prefixes, else it is relative to tools/assets/src/)
   Operations run in the order crop, resize, extend, composite, encode. Encoding defaults: webp q85 effort 6 smartSubsample.
   Runs are serialised with outputs/.build-art.lock. Class 1 files (PORT-PLAN 2.3): hashed names, never overwritten, never given ?v=. */
import fs from 'node:fs';
import path from 'node:path';
import {SCRATCH_RE, ASSETS, ARCH, ROOT, SRC, DAYLOOM, DAYLOOM_IMAGES, sharp, sha256, hashedName, HASHED, toolVersions, dayloomInfo, readJSON, readLock, writeLock, withRunLock, retain, pool, parseArgs, rel, dirBytes, kb, mb} from './lib/common.mjs';
import {raw, diffStats} from './lib/diff.mjs';
import {updateSection, table, fmt, today} from './lib/sources-md.mjs';

const LOCK = path.join(ARCH, 'art-asset-sources.json');
const ART_DIR = path.join(ASSETS, 'art');
const LISTS_DIR = path.join(ROOT, 'tools/assets/art');
const FIDELITY_LIMIT = 1;   // % of pixels off by more than 24/255; the 192 px theme covers are the worst case (about 0.96 % at q92)
const WEBP_DEFAULT = {quality: 85, effort: 6, smartSubsample: true};

function resolveSrc(spec) {
  let copy = false, s = spec;
  if (s.startsWith('copy:')) { copy = true; s = s.slice(5); }
  let file;
  if (s.startsWith('dayloom-root:')) file = path.join(DAYLOOM, s.slice(13));
  else if (s.startsWith('dayloom:')) file = path.join(DAYLOOM_IMAGES, s.slice(8));
  else if (s.startsWith('src:')) file = path.join(SRC, s.slice(4));
  else file = path.join(SRC, s);
  return {copy, file, label: s.startsWith('dayloom') || s.startsWith('src:') ? s : 'src:' + s};
}
const lossless = p => ({compressionLevel: 0});
async function stage(buf, fn) { return fn(sharp(buf)).png(lossless()).toBuffer(); }

function opOf(row) {
  const op = {};
  for (const k of ['crop', 'resize', 'extend']) if (row[k]) op[k] = row[k];
  if (row.composite) op.composite = row.composite.map(c => ({src: c.src, left: c.left, top: c.top, width: c.width}));
  const ext = path.extname(row.out).slice(1);
  if (row.copy) op.copy = true;
  else if (ext === 'webp') op.webp = row.lossless ? {lossless: true, effort: 6, ...(typeof row.lossless === 'object' ? row.lossless : {})} : {...WEBP_DEFAULT, ...(row.webp ?? {})};
  else if (ext === 'jpg' || ext === 'jpeg') op.jpeg = {quality: 85, mozjpeg: true, ...(row.jpeg ?? {})};
  else if (ext === 'png') op.png = {compressionLevel: 9, effort: 10, ...(row.png ?? {})};
  else throw new Error(`${row.out}: unsupported output extension`);
  return op;
}

// Everything before the final encode: the lossless PNG the encoder sees.
async function prepare(row, srcBytes, compositeBytes) {
  const op = row.op;
  let buf = srcBytes;
  if (op.crop) buf = await stage(buf, s => s.extract(op.crop));
  if (op.resize) buf = await stage(buf, s => s.resize({fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3', ...op.resize}));
  if (op.extend) buf = await stage(buf, s => s.extend(op.extend));
  if (op.composite) {
    const layers = await Promise.all(op.composite.map(async (c, i) => ({input: await sharp(compositeBytes[i]).resize({width: c.width, kernel: 'lanczos3'}).png().toBuffer(), left: c.left, top: c.top})));
    buf = await stage(buf, s => s.composite(layers));
  }
  return buf;
}
async function encode(row, srcBytes, compositeBytes) {
  const op = row.op;
  if (op.copy) return srcBytes;
  const buf = await prepare(row, srcBytes, compositeBytes);
  let img = sharp(buf);
  if (op.webp) img = img.webp(op.webp); else if (op.jpeg) img = img.jpeg(op.jpeg); else img = img.png(op.png);
  return img.toBuffer();
}

function dims(bytes, out) {
  if (out.endsWith('.svg')) { const m = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(bytes.toString('utf8', 0, 400)); return m ? {w: +m[1], h: +m[2]} : {w: null, h: null}; }
  return null;
}

function loadRows(listNames) {
  const rows = [], names = listNames ?? fs.readdirSync(LISTS_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
  const seen = new Map();
  for (const list of names) {
    const file = path.join(LISTS_DIR, list + '.json');
    if (!fs.existsSync(file)) throw new Error(`No such art list: ${rel(file)}`);
    for (const r of readJSON(file)) {
      if (seen.has(r.out)) throw new Error(`${r.out} appears in lists ${seen.get(r.out)} and ${list}`);
      seen.set(r.out, list);
      const s = resolveSrc(r.src);
      rows.push({...r, list, copy: s.copy, srcFile: s.file, srcLabel: s.label, op: opOf({...r, copy: s.copy})});
    }
  }
  return rows;
}

async function rowInputs(row) {
  if (!fs.existsSync(row.srcFile)) throw new Error(`${row.out}: missing source ${row.srcLabel} (${row.srcFile})`);
  const srcBytes = fs.readFileSync(row.srcFile);
  const compositeBytes = (row.op.composite ?? []).map(c => { const s = resolveSrc(c.src); if (!fs.existsSync(s.file)) throw new Error(`${row.out}: missing composite source ${c.src}`); return fs.readFileSync(s.file); });
  const compositeSha = compositeBytes.map(sha256);
  const op = row.op.composite ? {...row.op, composite: row.op.composite.map((c, i) => ({...c, sourceSha256: compositeSha[i]}))} : row.op;
  const T = toolVersions();
  const key = sha256(JSON.stringify([sha256(srcBytes), op, op.copy ? null : [T.sharp, T.libwebp]])).slice(0, 16);
  return {srcBytes, compositeBytes, op, sourceSha256: sha256(srcBytes), key};
}

async function build(flags) {
  const listNames = flags.get('list') && flags.get('list') !== true ? String(flags.get('list')).split(',') : null;
  const rows = loadRows(listNames), lock = readLock(LOCK), T = toolVersions();
  const old = new Map((lock?.outputs ?? []).map(o => [o.logical, o]));
  const t0 = Date.now(); let encoded = 0, reused = 0;
  const outputs = await pool(4, rows, async row => {
    const inp = await rowInputs(row), prev = old.get(row.out);
    const reuse = !flags.get('force') && prev && prev.key === inp.key && fs.existsSync(path.join(ASSETS, prev.file));
    let entry;
    if (reuse) { entry = prev; reused++; }
    else {
      const bytes = await encode({...row, op: inp.op}, inp.srcBytes, inp.compositeBytes);
      const file = hashedName(row.out, bytes), target = path.join(ASSETS, file);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);   // class 1: never overwritten in place
      const d = dims(bytes, row.out) ?? await sharp(bytes).metadata().then(m => ({w: m.width, h: m.height}));
      entry = {logical: row.out, file, sha256: sha256(bytes), bytes: bytes.length, w: d.w, h: d.h, source: row.srcLabel, sourceSha256: inp.sourceSha256, op: inp.op, key: inp.key};
      encoded++;
    }
    const {provenance, list, ...rest} = entry;
    return {...rest, list: row.list, ...(row.note ? {provenance: row.note} : {})};
  });
  // Keep entries of lists not built in this run.
  const built = new Set(rows.map(r => r.list));
  const kept = listNames ? (lock?.outputs ?? []).filter(o => !built.has(o.list)) : [];   // a full run drops entries of lists that no longer exist
  const all = [...kept, ...outputs].sort((a, b) => a.logical.localeCompare(b.logical));
  const listsMeta = listNames ? {...(lock?.extra?.lists ?? {})} : {};
  for (const list of built) listsMeta[list] = {file: rel(path.join(LISTS_DIR, list + '.json')), sha256: sha256(fs.readFileSync(path.join(LISTS_DIR, list + '.json')))};
  writeLock(LOCK, {version: 1, generator: 'tools/assets/build-art.mjs', tools: T, dayloom: dayloomInfo(), extra: {lists: listsMeta}, outputs: all});
  const removed = retain(ART_DIR, LOCK, all.map(o => o.file));
  const total = dirBytes(ART_DIR);
  console.log(`art: ${rows.length} rows (${encoded} encoded, ${reused} reused), ${removed.length} stale files removed, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`docs/assets/art: ${total.files} files, ${mb(total.bytes)} MB (${kb(total.bytes)} KB)`);
  writeSourcesMd();
}

async function check(flags) {
  const lock = readLock(LOCK);
  if (!lock) throw new Error(`${rel(LOCK)} is missing; run build-art.mjs`);
  const problems = [];
  const byLogical = new Map(lock.outputs.map(o => [o.logical, o]));
  for (const o of lock.outputs) {
    const f = path.join(ASSETS, o.file);
    if (!fs.existsSync(f)) { problems.push(`missing file ${o.file}`); continue; }
    const bytes = fs.readFileSync(f);
    if (sha256(bytes) !== o.sha256) problems.push(`${o.file}: content differs from the lock`);
    if (!o.file.includes('.' + sha256(bytes).slice(0, 10) + '.')) problems.push(`${o.file}: name != sha256[:10] of its content`);
    if (bytes.length !== o.bytes) problems.push(`${o.file}: size ${bytes.length} != lock ${o.bytes}`);
  }
  const onDisk = [];
  (function walk(d) { for (const e of fs.existsSync(d) ? fs.readdirSync(d, {withFileTypes: true}) : []) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else onDisk.push(path.relative(ASSETS, p).split(path.sep).join('/')); } })(ART_DIR);
  const known = new Set(lock.outputs.map(o => o.file));
  for (const f of onDisk) if (!known.has(f)) { if (!HASHED.test(f)) problems.push(`unhashed file in art/: ${f}`); }
  let rows = 0, stale = 0, srcChanged = 0;
  const listNames = flags.get('list') && flags.get('list') !== true ? String(flags.get('list')).split(',') : null;
  for (const row of loadRows(listNames)) {
    rows++;
    const o = byLogical.get(row.out);
    if (!o) { problems.push(`${row.out}: in ${row.list}.json but not in the lock (run build-art.mjs)`); continue; }
    if (!fs.existsSync(row.srcFile)) { srcChanged++; continue; }    // Dayloom or src missing here: cannot compare
    const inp = await rowInputs(row);
    if (inp.sourceSha256 !== o.sourceSha256) { srcChanged++; problems.push(`${row.out}: source ${row.srcLabel} changed since the lock`); }
    else if (inp.key !== o.key) { stale++; problems.push(`${row.out}: list row or encoder changed since the lock (run build-art.mjs)`); }
  }
  for (const o of lock.outputs) if (!/^art\//.test(o.logical)) problems.push(`${o.logical}: logical path must start with art/`);
  const secrets = SCRATCH_RE.test(JSON.stringify(lock));
  if (secrets) problems.push('lock contains scratch paths');
  if (problems.length) { console.error('FAIL art\n  ' + problems.join('\n  ')); process.exit(1); }
  const total = dirBytes(ART_DIR);
  console.log(`PASS art: ${lock.outputs.length} outputs, ${rows} list rows match the lock, every name == sha256[:10], docs/assets/art ${mb(total.bytes)} MB`);
}

async function verify(n, flags) {
  const lock = readLock(LOCK), rows = loadRows(null), T = toolVersions();
  const byOut = new Map(rows.map(r => [r.out, r]));
  const pick = [...lock.outputs].filter(o => !o.op?.copy && byOut.has(o.logical)).sort(() => Math.random() - .5).slice(0, n);
  let bad = 0;
  for (const o of pick) {
    const row = byOut.get(o.logical), inp = await rowInputs(row);
    const bytes = await encode({...row, op: inp.op}, inp.srcBytes, inp.compositeBytes);
    const same = sha256(bytes) === o.sha256;
    if (!same) { bad++; console.error(`DRIFT ${o.logical}: re-encode ${sha256(bytes).slice(0, 10)} != ${o.sha256.slice(0, 10)}`); }
  }
  if (lock.tools.sharp !== T.sharp || lock.tools.libwebp !== T.libwebp) console.error(`note: lock was written with sharp ${lock.tools.sharp} / libwebp ${lock.tools.libwebp}; running ${T.sharp} / ${T.libwebp}`);
  if (bad) { console.error(`FAIL art verify: ${bad}/${pick.length} drifted`); process.exit(1); }
  console.log(`PASS art verify: ${pick.length} re-encoded outputs are byte-identical`);
}

// Pixel check of lossy outputs against the lossless image the encoder was given (decoded output vs. prepared PNG).
async function fidelity(n) {
  const lock = readLock(LOCK), byOut = new Map(loadRows(null).map(r => [r.out, r]));
  const pick = lock.outputs.filter(o => !o.op?.copy && byOut.has(o.logical) && !o.op.webp?.lossless).sort(() => Math.random() - .5).slice(0, n);
  const rowsOut = []; let worst = 0;
  for (const o of pick) {
    const row = byOut.get(o.logical), inp = await rowInputs(row);
    const ref = await prepare({...row, op: inp.op}, inp.srcBytes, inp.compositeBytes);
    const d = diffStats(await raw(ref), await raw(fs.readFileSync(path.join(ASSETS, o.file))));
    worst = Math.max(worst, d.pct24); rowsOut.push(`${o.logical.padEnd(52)} mean ${String(d.mean).padStart(6)}  pct24 ${String(d.pct24).padStart(6)} %  pct60 ${String(d.pct60).padStart(6)} %  alphaMax ${d.alphaMax}`);
  }
  console.log(rowsOut.join('\n'));
  if (worst > FIDELITY_LIMIT) { console.error(`FAIL art fidelity: worst pct24 ${worst} % > ${FIDELITY_LIMIT} %`); process.exit(1); }
  console.log(`PASS art fidelity: ${pick.length} lossy outputs, worst pct24 ${worst} % (limit ${FIDELITY_LIMIT} %)`);
}

function writeSourcesMd() {
  const lock = readLock(LOCK); if (!lock) return;
  const groups = new Map();
  for (const o of lock.outputs) {
    const g = o.logical.split('/').slice(0, o.logical.split('/').length > 2 ? 2 : 1).join('/');
    const e = groups.get(g) ?? {list: o.list, n: 0, bytes: 0, srcs: new Set(), ops: new Set(), dims: new Set()};
    e.n++; e.bytes += o.bytes; e.srcs.add(o.source.replace(/[^/:]+$/, '*').replace(/^(dayloom:[^/]+\/[^/]+\/).*$/, '$1*')); e.dims.add(o.w ? `${o.w}×${o.h}` : 'svg');
    const w = o.op.webp ?? o.op.jpeg ?? o.op.png; e.ops.add(o.op.copy ? 'byte copy' : o.op.webp?.lossless ? 'webp lossless' : o.op.webp ? `webp q${w.quality}${w.alphaQuality ? ' α' + w.alphaQuality : ''}` : o.op.jpeg ? `jpeg q${w.quality}` : 'png');
    if (o.op.resize) e.ops.add('resize ' + JSON.stringify(o.op.resize).replace(/[{}"]/g, '')); if (o.op.crop) e.ops.add('crop ' + JSON.stringify(o.op.crop).replace(/[{}"]/g, ''));
    groups.set(g, e);
  }
  const rows = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([g, e]) => [`\`${g}/\``, e.list, e.n, [...e.dims].slice(0, 4).join(', '), [...e.srcs].join('<br>'), [...e.ops].join('; '), fmt(e.bytes)]);
  const tot = lock.outputs.reduce((a, o) => a + o.bytes, 0);
  const untraced = lock.outputs.filter(o => o.provenance).map(o => `- \`${o.logical}\`: ${o.provenance}`);
  let md = `## Site art (generated ${today()})\n\nHashed files under \`docs/assets/art/\`, encoded by \`tools/assets/build-art.mjs\` from the lists in \`tools/assets/art/\`. The lock \`architecture/art-asset-sources.json\` records every output's source, source hash and encode parameters (sharp ${lock.tools.sharp}, libwebp ${lock.tools.libwebp}). Dayloom commit: \`${lock.dayloom.commit?.slice(0, 10) ?? 'unknown'}\`.\n\n`;
  md += table(['Group', 'List', 'Files', 'Dimensions', 'Source', 'Encode', 'Bytes'], rows) + `\n\nTotal: ${lock.outputs.length} files, ${fmt(tot)} bytes.\n`;
  if (untraced.length) md += `\nProvenance notes:\n\n${untraced.join('\n')}\n`;
  updateSection('art', md);
  // icons
  const iconFile = path.join(ASSETS, 'app-icon-source.json');
  if (fs.existsSync(iconFile)) {
    const icons = readJSON(iconFile);
    const irows = icons.outputs.map(o => [`\`${o.file}\``, Array.isArray(o.size) ? o.size.join('/') : o.size, o.opaque ? 'opaque, full bleed' : `rounded ${o.cornerRadius ? '(22 %)' : ''}, transparent`, o.role ?? '', fmt(o.bytes ?? 0)]);
    updateSection('icons', `## Site icons (generated ${today()})\n\nExported by \`tools/build-site-icons.cjs\` from \`${icons.source}\` (Dayloom, sha256 \`${icons.sourceSha256.slice(0, 12)}…\`, ${icons.sourceSize} px). The artwork is not redrawn. These names are stable (class 2); the build stamps \`?v=\`.\n\n` + table(['File (under docs/ or docs/assets/)', 'Size', 'Corners', 'Use', 'Bytes'], irows) + '\n');
  }
}

const flags = parseArgs(process.argv.slice(2));
try {
  if (flags.get('check')) await check(flags);
  else if (flags.get('fidelity')) await fidelity(Number(flags.get('fidelity')) || 12);
  else if (flags.get('verify')) await verify(Number(flags.get('verify')) || 20, flags);
  else if (flags.get('sources-md')) { writeSourcesMd(); console.log('art and icon tables refreshed in docs/assets/ASSET-SOURCES.md'); }
  else await withRunLock(() => build(flags));
} catch (e) { console.error(e.stack ?? e); process.exit(1); }
