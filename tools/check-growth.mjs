// Growth artwork parity with the app. The home's flower stages are SVG masters in tools/assets/src/growth/,
// exported from Dayloom's own drawing code by tools/export-growth.cjs --svg-only. This check re-runs that export
// into a scratch tree and compares bytes, and compares the recorded source hashes with the app files.
// Skips (with a reason) when the app checkout or TypeScript cannot be found:
//   DAYLOOM_SOURCE=<private-app-checkout>  TYPESCRIPT_PATH=<a typescript 5 package directory>
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const repo = new URL('../', import.meta.url).pathname;
const app = process.env.DAYLOOM_SOURCE || join(repo, 'outputs/app-source-not-configured');
// TypeScript: the env var, the app's own install, then the copy npx left on this workstation.
const typescript = [process.env.TYPESCRIPT_PATH, join(app, 'node_modules/typescript')]
  .find(path => path && existsSync(join(path, 'package.json'))) || join(app, 'node_modules/typescript');
const masters = join(repo, 'tools/assets/src/growth');

function unavailable() {
  if (!existsSync(app)) return `app checkout not found at ${app} (set DAYLOOM_SOURCE)`;
  if (!existsSync(join(typescript, 'package.json'))) return `TypeScript not found at ${typescript} (set TYPESCRIPT_PATH)`;
  return null;
}

test('the growth stage SVG masters exist: flower 0-4 and the bloom', () => {
  const names = readdirSync(masters).filter(name => name.endsWith('.svg')).sort();
  assert.deepEqual(names, ['flower-0.svg', 'flower-1.svg', 'flower-2.svg', 'flower-3.svg', 'flower-4.svg', 'flower-bloom.svg']);
  for (const name of names) assert.match(readFileSync(join(masters, name), 'utf8'), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[-\d. ]+">/, name);
});

test('flower-0..4.svg equal a fresh export of flowerArt[0..4] from the app source', t => {
  const why = unavailable();
  if (why) return t.skip(why);
  const scratch = mkdtempSync(join(tmpdir(), 'growth-'));
  mkdirSync(join(scratch, 'tools'), {recursive: true});
  for (const file of ['export-growth.cjs', 'native-renderer.cjs']) cpSync(join(repo, 'tools', file), join(scratch, 'tools', file));
  const run = spawnSync(process.execPath, [join(scratch, 'tools/export-growth.cjs'), '--svg-only'], {env: {...process.env, DAYLOOM_SOURCE: app, TYPESCRIPT_PATH: typescript}, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr || run.stdout);
  for (let stage = 0; stage < 5; stage++) {
    const fresh = readFileSync(join(scratch, 'tools/assets/src/growth', `flower-${stage}.svg`));
    assert.ok(fresh.equals(readFileSync(join(masters, `flower-${stage}.svg`))), `flower-${stage}.svg differs from the app's drawing; re-run node tools/export-growth.cjs --svg-only`);
  }
});

test('recorded source hashes equal the app files', t => {
  const why = existsSync(join(app, 'src')) ? null : `app checkout with src/ not found at ${app} (set DAYLOOM_SOURCE)`;
  if (why) return t.skip(why);
  const manifest = JSON.parse(readFileSync(join(repo, 'architecture/native-growth-sources.json'), 'utf8'));
  assert.ok(manifest.length >= 3);
  for (const entry of manifest) {
    assert.equal(createHash('sha256').update(readFileSync(join(app, entry.source))).digest('hex'), entry.sourceSha256, `${entry.source} changed in the app; re-export`);
  }
});
