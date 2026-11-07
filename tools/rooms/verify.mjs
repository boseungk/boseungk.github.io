// Fidelity of the shipped files (the numbers behind PORT-PLAN A acceptance):
//   stack: the manifest's layers stacked in paint order (975x2110), scaled to 780x1688, against the shipped day.webp
//   tod:   each dusk/night/lit webp against its PNG master scaled the same way (encode loss only)
// pct24 = % of pixels off by more than 24/255 on any channel (flattened on white, alpha included); limit 0.5 %.
// usage: node tools/rooms/verify.mjs [--sample N | --ids id,id | --all]   (default: 12 rooms, evenly spread)
import fs from 'node:fs';
import path from 'node:path';
import {ASSETS, ARCH, OUTPUTS, sharp, readJSON, readLock, parseArgs} from '../assets/lib/common.mjs';
import {raw, diffStats} from '../assets/lib/diff.mjs';

const LIMIT = 0.5, LS = 2.5, W = 975, H = 2110, FRAME = {w: 780, h: 1688};
const PNG = path.join(OUTPUTS, 'rooms-png');
const lock = readLock(path.join(ARCH, 'room-asset-sources.json'));
if (!lock) { console.error('architecture/room-asset-sources.json missing; run build-room-assets.mjs'); process.exit(1); }
const manifest = readJSON(path.join(ASSETS, lock.outputs.find(o => o.kind === 'manifest').file));
const flags = parseArgs(process.argv.slice(2));
const all = manifest.order;
let ids;
if (flags.get('ids')) ids = String(flags.get('ids')).split(',');
else if (flags.get('all')) ids = all;
else { const n = Math.min(all.length, Number(flags.get('sample')) || 12); ids = Array.from({length: n}, (_, i) => all[Math.floor(i * all.length / n)]); }

const at = rel => path.join(ASSETS, 'rooms', rel);
async function stacked(room) {
  const layers = [];
  for (const l of room.layers) {
    const buf = await sharp(at(l.src)).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    layers.push({input: buf.data, raw: {width: buf.info.width, height: buf.info.height, channels: 4}, left: Math.round(l.x * LS), top: Math.round(l.y * LS)});
  }
  const base = await sharp({create: {width: W, height: H, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).composite(layers).png().toBuffer();
  return sharp(base).resize(FRAME.w, FRAME.h, {fit: 'fill', kernel: 'lanczos3'}).png().toBuffer();
}
let worst = 0; const lines = [];
for (const id of ids) {
  const room = manifest.rooms[id]; if (!room) { console.error(`unknown room ${id}`); process.exit(1); }
  const out = {};
  out.stack = diffStats(await raw(await stacked(room)), await raw(at(room.day)));
  for (const t of Object.keys(room.tod)) {
    const png = path.join(PNG, id, t + '.png'), reference = fs.existsSync(png) ? await raw(png, FRAME) : null;
    if (reference) out[t] = diffStats(reference, await raw(at(room.tod[t])));
  }
  const p = Object.values(out).map(d => d.pct24); worst = Math.max(worst, ...p);
  lines.push(`${id.padEnd(26)} stack/day pct24 ${String(out.stack.pct24).padStart(6)} (mean ${out.stack.mean})` + Object.entries(out).filter(([k]) => k !== 'stack').map(([k, d]) => `  ${k} ${d.pct24} (mean ${d.mean})`).join(''));
}
console.log(lines.join('\n'));
if (worst > LIMIT) { console.error(`FAIL: worst pct24 ${worst} % > ${LIMIT} %`); process.exit(1); }
console.log(`PASS rooms fidelity: ${ids.length} rooms, worst pct24 ${worst} % (limit ${LIMIT} %)`);
