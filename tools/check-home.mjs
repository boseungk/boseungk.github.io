// Contracts of the home's source (no browser): module shape, lifetime discipline, timings, copy keys, markup rules.
// The behaviour itself (phases, pause, demos, room view, mount/destroy leaks) runs in a browser: tools/qa/home-browser.mjs.
//   node --test tools/check-home.mjs        (run after python3 tools/build-locales.py [--draft])
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {test} from 'node:test';
import {join} from 'node:path';

const repo = new URL('../', import.meta.url).pathname;
const homeDir = join(repo, 'docs/assets/home');
const read = path => readFileSync(join(repo, path), 'utf8');
const strip = js => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const SECTIONS = {hero: 'hero', focus: 'focus', decor: 'decor', collection: 'themes', records: 'records', night: 'night'};

const template = read('tools/templates/home.ko.html');
const ko = read('docs/index.html');
const main = strip(read('docs/assets/home/main.js'));

test('every section module exports mount(root, ctx) and main.js mounts it on an element that exists', () => {
  for (const [id, file] of Object.entries(SECTIONS)) {
    const source = strip(read(`docs/assets/home/${file}.js`));
    assert.match(source, /export function mount\(\s*root\s*,\s*\{[^}]*\blife\b[^}]*\}\s*\)/, `${file}.js: mount(root, {life, …})`);
    assert.match(source, /destroy\s*\(\s*\)\s*\{/, `${file}.js returns destroy()`);
    assert.ok(main.includes(`id: '${id}'`) && (main.includes(`import * as ${file} from './${file}.js'`) || main.includes(`import('./${file}.js')`)), `main.js lists ${id}`);
    assert.match(ko, new RegExp(`<[a-z]+[^>]*\\bid="${id}"`), `home page has #${id}`);
  }
  assert.match(main, /catch \(error\)/, 'a module that throws is caught');
  assert.match(main, /L\.end\(\)/, 'main.js ends the lifetime after destroy');
});

test('section modules start nothing outside their life: no bare timer, frame, listener or observer', () => {
  const lifeOnly = ['hero', 'focus', 'decor', 'themes', 'records', 'night', 'hourglass', 'choice'];
  const banned = [/\bsetTimeout\(/, /\bsetInterval\(/, /\brequestAnimationFrame\(/, /\.addEventListener\(/, /new (?:Intersection|Mutation|Resize)Observer\(/];
  for (const file of lifeOnly) {
    const source = strip(read(`docs/assets/home/${file}.js`));
    for (const pattern of banned) assert.doesNotMatch(source, pattern, `${file}.js uses ${pattern} directly; go through life (L.later/L.every/L.frame/L.on/L.io/L.mo)`);
  }
  for (const file of readdirSync(join(homeDir, 'rooms')).filter(name => name.endsWith('.js') && name !== 'life.js' && name !== 'index.js')) {
    const source = strip(read(`docs/assets/home/rooms/${file}`));
    for (const pattern of [/\bsetTimeout\(/, /\bsetInterval\(/, /\brequestAnimationFrame\(/]) assert.doesNotMatch(source, pattern, `rooms/${file} uses ${pattern} directly`);
  }
});

test('the hero cycle and the focus demo keep their timings', () => {
  const hero = read('docs/assets/home/hero.js');
  assert.deepEqual([...hero.matchAll(/id: '(\w+)', pick: '\w+', ms: (\d+)/g)].map(m => [m[1], +m[2]]), [['day', 5600], ['dusk', 5000], ['unlit', 1500], ['night', 7600]]);
  assert.match(hero, /const GOAL = 25 \* 60/);
  const focus = read('docs/assets/home/focus.js');
  assert.match(focus, /const HOLD = 3200, PRESS = 180/, 'the prep sheet holds 3.2 s, start shows 180 ms pressed');
  assert.match(focus, /threshold: \[0, \.6\]/, 'the focus demo waits for 60% visibility');
  assert.match(read('docs/assets/home/decor.js'), /intersectionRatio >= \.49[\s\S]*threshold: \[0, \.5\]/, 'the decor demo starts at 50% visibility');
});

test('copy goes through text(\'…\') with literal keys only, and the module graph holds no hard-coded locale', () => {
  const files = [...readdirSync(homeDir).filter(name => name.endsWith('.js')).map(name => `docs/assets/home/${name}`), ...readdirSync(join(homeDir, 'rooms')).map(name => `docs/assets/home/rooms/${name}`)];
  for (const file of files) {
    const source = strip(read(file));
    assert.doesNotMatch(source, /\btext\(\s*(?!')/, `${file}: text() needs a single-quoted literal key (the build collects keys by scanning)`);
    assert.doesNotMatch(source, /['"`]ko-KR['"`]/, `${file}: a fixed ko-KR locale (use the page's locale)`);
    assert.doesNotMatch(source.replace(/\btext\('[^']*'/g, 'text(\'\''), /[가-힣]{2}/, `${file}: Korean copy outside text('…') (it must be a page-copy key or page markup)`);
  }
});

test('the template follows the build rules: logical URLs, phrase keys, app-UI marks, one phone, no FAQ or channel cards', () => {
  assert.doesNotMatch(template, /\?v=|\.[0-9a-f]{10}\.(?:webp|png|jpe?g|otf|js|css)/, 'logical URLs only');
  assert.doesNotMatch(template, /\son(?:click|load|error)=/i, 'no inline handlers');
  assert.equal((template.match(/data-phrase/g) || []).length, 14, '14 phrase keys (home plan 4.2)');
  assert.ok((template.match(/data-app-ui/g) || []).length >= 10, 'app screen text is marked data-app-ui for the translator');
  assert.equal((template.match(/class="phone[\s"]/g) || []).length, 1, 'one phone mockup on the home');
  for (const gone of ['id="faq"', 'class="channels"', 'id="channels"', '개발 중', '출시 전', 'Not yet released']) assert.ok(!template.includes(gone), `template still has ${gone}`);
  for (const placeholder of ['HEAD_COMMON', 'HEAD_META', 'PAGE_COPY', 'SITE_HEADER', 'SITE_FOOTER:home', 'STORES:hero', 'STORES:closing', 'ROOMS_STILL', 'ROOMS_TEXT']) {
    assert.ok(template.includes(`<!--${placeholder}`) || template.includes(placeholder), `template lacks ${placeholder}`);
  }
  assert.ok(template.indexOf('<!--HEAD_COMMON') < template.indexOf('type="module"'), 'HEAD_COMMON comes before the first module script');
  // the build removes its markers: nothing of them in any generated home page
  for (const marker of ['data-phrase', 'data-app-ui']) assert.ok(!ko.includes(marker), `generated home still carries ${marker}`);
});

test('the rooms wall holds its place by its own width and falls back quietly when a script or icon fails', () => {
  const head = template.slice(0, template.indexOf('</head>'));
  assert.match(head, /addEventListener\('error'[^<]*obj-icon[^<]*rooms\\\/index[^<]*classList\.remove\('js'\)/, 'the head error listener hides a failed kicker icon and shows the static room list when rooms/index.js fails');
  const css = read('docs/assets/home/home.css'), rooms = read('docs/assets/home/rooms.css');
  assert.match(css, /\.rooms-host \{[^}]*container-type: inline-size/, '.rooms-host is the wall\'s size container');
  const reserve = css.split('\n').filter(line => line.includes(':not([data-variant])::before') || line.includes('--t:'));
  assert.ok(reserve.length >= 5 && reserve.every(line => !line.includes('100vw') && (!line.includes('{ html.js') || line.startsWith('@container'))), 'the wall reserve follows the host width (cqw, @container), as wall.js measure() does');
  assert.doesNotMatch(rooms.slice(0, rooms.indexOf('room view (view.js)')), /@media \((?:max|min)-width|100vw/, 'the wall\'s breakpoints follow the host width (@container, cqw)');
});

test('CSS keeps the motion and design contract of the app design language', () => {
  const css = read('docs/assets/home/home.css') + read('docs/assets/home/rooms.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.is-motion-paused/, 'the page pause reaches the CSS animations');
  assert.match(read('docs/assets/site/base.css'), /--ease-paper:\s*cubic-bezier\(\s*\.22\s*,\s*\.61\s*,\s*\.36\s*,\s*1\s*\)/, 'paper easing token');
  assert.match(css, /var\(--ease-paper\)/, 'the home uses the paper easing token');
  for (const banned of [/backdrop-filter\s*:\s*(?!none)/, /(?<![-\w])filter\s*:[^;]*blur\(/, /font-weight\s*:\s*(?:[5-9]00|bold)/]) assert.doesNotMatch(css, banned);
});

test('decor and theme names are the app catalog\'s own words (read-only Dayloom checkout)', t => {
  const app = process.env.DAYLOOM_SOURCE || '/Users/gpt/Projects/dayloom';
  const catalogFile = join(app, 'src/core/localization/catalogs/ko-KR.json');
  const themesFile = join(app, 'src/features/collection/domain/collection-themes.ts');
  if (!existsSync(catalogFile) || !existsSync(themesFile)) return t.skip(`app checkout not found at ${app}`);
  const catalog = new Set(Object.values(JSON.parse(readFileSync(catalogFile, 'utf8'))));
  const themes = readFileSync(themesFile, 'utf8');
  const items = [...template.matchAll(/class="dcard__name">([^<]+)</g)].map(m => m[1]);
  const names = [...template.matchAll(/class="tpick__name[^"]*">([^<]+)</g)].map(m => m[1]);
  assert.ok(items.length >= 4 && names.length >= 6, `${items.length} decor items, ${names.length} themes found`);
  for (const item of items) assert.ok(catalog.has(item), `decor item "${item}" is not in the app's ko-KR catalog`);
  for (const name of names) assert.ok(themes.includes(name) || catalog.has(name), `theme "${name}" is not in the app's collection themes`);
});
