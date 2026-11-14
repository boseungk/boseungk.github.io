// Shared helpers for tools/rooms/build-room-assets.mjs, tools/assets/build-art.mjs and tools/assets/build-fonts.mjs.
// Nothing here writes to docs/ by itself. Locks live in architecture/*-asset-sources.json (PORT-PLAN 2.9).
import fs from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DOCS = path.join(ROOT, 'docs');
export const ASSETS = path.join(DOCS, 'assets');
export const SRC = path.join(ROOT, 'tools/assets/src');
export const ARCH = path.join(ROOT, 'architecture');
export const OUTPUTS = path.join(ROOT, 'outputs');
export const DAYLOOM = process.env.DAYLOOM_SOURCE || path.join(OUTPUTS, 'app-source-not-configured');
export const DAYLOOM_IMAGES = path.join(DAYLOOM, 'assets/images');
// Same default as tools/native-renderer.cjs.
export const NATIVE_NODE_MODULES = process.env.NATIVE_NODE_MODULES || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const req = createRequire(NATIVE_NODE_MODULES + '/');
export const sharp = req('sharp');
sharp.cache(false);
sharp.concurrency(1);

export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const sha10 = bytes => sha256(bytes).slice(0, 10);
export const HASHED = /\.[0-9a-f]{10}\.[A-Za-z0-9]+$/;
export const hashedName = (logical, bytes) => logical.replace(/(\.[A-Za-z0-9]+)$/, `.${sha10(bytes)}$1`);
export const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

let TOOLS = null;
export function toolVersions() {
  if (TOOLS) return TOOLS;
  let hb = null;
  try { hb = /HarfBuzz\)\s*([\d.]+)/.exec(execFileSync('hb-subset', ['--version'], {encoding: 'utf8'}))?.[1] ?? null; } catch { /* hb-subset optional except for fonts */ }
  return TOOLS = {node: process.versions.node.replace(/^v/, ''), sharp: sharp.versions.sharp, libvips: sharp.versions.vips, libwebp: sharp.versions.webp, hbSubset: hb};
}

export function dayloomInfo() {
  const git = (...a) => execFileSync('git', ['-C', DAYLOOM, ...a], {encoding: 'utf8'}).trim();
  try { return {path: 'env:DAYLOOM_SOURCE', commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain', '--', 'assets', 'design/store-listing').length > 0}; }
  catch { return {path: 'env:DAYLOOM_SOURCE', commit: null, dirty: null}; }
}

export async function pool(limit, items, fn) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }));
  return results;
}

// ---- locks -------------------------------------------------------------------------------------------------------
export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function readLock(file) { try { return readJSON(file); } catch { return null; } }
// The lock committed at HEAD: its files must survive one more generation (PORT-PLAN 2.3 retention).
export function headLock(file) {
  try { return JSON.parse(execFileSync('git', ['-C', ROOT, 'show', `HEAD:${rel(file)}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28})); }
  catch { return null; }
}
// Pretty header, one output per line (stable, diff-friendly, keeps a 2,000-entry lock readable).
export function writeLock(file, lock) {
  // Provenance is public: keep logical source names, never a developer's absolute checkout path.
  lock = JSON.parse(JSON.stringify(lock, (_key, value) => {
    if (typeof value !== 'string') return value;
    if (value === DAYLOOM) return 'env:DAYLOOM_SOURCE';
    if (value.startsWith(DAYLOOM + path.sep)) return 'dayloom:' + value.slice(DAYLOOM.length + 1);
    return value;
  }));
  const {outputs, ...rest} = lock;
  const head = JSON.stringify(rest, null, 1).replace(/\[\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1,$2]');   // [lo,hi] runs on one line
  const body = outputs.map(o => '  ' + JSON.stringify(o)).join(',\n');
  const text = head.slice(0, head.lastIndexOf('\n}')) + ',\n "outputs": [\n' + body + '\n ]\n}\n';
  JSON.parse(text);
  fs.writeFileSync(file, text);
}

// outputs/.build-art.lock serialises runs of every generator that writes a lock (fs.openSync 'wx').
export function withRunLock(fn) {
  const file = path.join(OUTPUTS, '.build-art.lock');
  fs.mkdirSync(OUTPUTS, {recursive: true});
  try {
    const old = fs.readFileSync(file, 'utf8'), pid = +old.split(/\s+/)[0];
    let alive = false; try { process.kill(pid, 0); alive = true; } catch { /* stale */ }
    if (!alive) fs.rmSync(file, {force: true});
  } catch { /* none */ }
  let fd;
  try { fd = fs.openSync(file, 'wx'); } catch { throw new Error(`Another asset generator is running (${rel(file)}). Wait for it, or delete the file if it crashed.`); }
  fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}\n`); fs.closeSync(fd);
  const release = () => fs.rmSync(file, {force: true});
  process.on('exit', release);
  return Promise.resolve().then(fn).finally(release);
}

// Delete hashed files under `dir` that neither the current nor the HEAD lock references.
export function retain(dir, lockFile, current) {
  const keep = new Set(current);
  for (const o of headLock(lockFile)?.outputs ?? []) keep.add(o.file);
  const removed = [];
  (function walk(d) {
    for (const e of fs.existsSync(d) ? fs.readdirSync(d, {withFileTypes: true}) : []) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); try { fs.rmdirSync(p); } catch { /* not empty */ } }
      else if (HASHED.test(e.name) && !keep.has(path.relative(ASSETS, p).split(path.sep).join('/'))) { fs.rmSync(p); removed.push(p); }
    }
  })(dir);
  return removed;
}

// Lock hygiene: scratch locations must never reach a lock or a published file. (Built from pieces so a grep for the paths finds nothing.)
export const SCRATCH_RE = new RegExp(['/private/tm' + 'p', '_n' + 'px', 'Documents/Cod' + 'ex'].join('|'));
export const kb = n => +(n / 1024).toFixed(1);
export const mb = n => +(n / 1048576).toFixed(2);
export function dirBytes(dir) {
  let n = 0, files = 0;
  (function walk(d) { for (const e of fs.existsSync(d) ? fs.readdirSync(d, {withFileTypes: true}) : []) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { n += fs.statSync(p).size; files++; } } })(dir);
  return {bytes: n, files};
}
export function parseArgs(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    flags.set(k, v);
  }
  return flags;
}
