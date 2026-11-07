// Locale contracts of the generated site: page copy of every language, room text, policy routes, brand.
//   node --test tools/check-locales.mjs        (run after python3 tools/build-locales.py [--draft])
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';

const root = new URL('../', import.meta.url);
const docs = process.env.SITE_DOCS ? pathToFileURL(process.env.SITE_DOCS.replace(/\/?$/, '/')) : new URL('docs/', root);   // SITE_DOCS: a copy of docs/ (mutation tests)
const read = path => readFileSync(new URL(path, docs), 'utf8');
const locales = JSON.parse(read('assets/i18n/locales.json'));
const {createText, readCopy} = await import(new URL('assets/site/text.mjs', docs).href);
const KEY_CALL = /\b(?:t|text)\(\s*'([^']*)'/g;
const prefixOf = item => (item.path ? item.path + '/' : '');
const routeOf = (item, page) => '/' + prefixOf(item) + (page === 'home' ? '' : page + '/');
const pagePath = (item, page) => prefixOf(item) + (page === 'home' ? 'index.html' : page + '/index.html');

// readCopy() takes a document-like root; hand it the generated page's #page-copy.
function pageCopy(item, page) {
  const source = read(pagePath(item, page));
  const match = source.match(/<script type="application\/json" id="page-copy">(.*?)<\/script>/s);
  assert.ok(match, `${pagePath(item, page)} has no #page-copy`);
  const data = readCopy('page-copy', {getElementById: id => (id === 'page-copy' ? {textContent: match[1]} : null)});
  return {data, source};
}

// Every key the page's module graph passes to t('…')/text('…'), found through the page's own import map.
function graphKeys(source) {
  const map = JSON.parse(source.match(/<script type="importmap">(.*?)<\/script>/s)?.[1] ?? '{"imports":{}}').imports;
  const keys = new Set();
  for (const path of Object.keys(map)) for (const [, key] of readFileSync(new URL(path.slice(1), docs), 'utf8').matchAll(KEY_CALL)) keys.add(key);
  return keys;
}

const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('every public language has page copy for home and the board: routes, formats, placeholders, graph keys', () => {
  const routes = new Set();
  for (const item of locales) {
    for (const page of ['home', 'feedback']) {
      const {data, source} = pageCopy(item, page);
      const where = `${item.locale} ${page}`;
      assert.equal(data.meta.lang, item.lang, where);
      assert.equal(data.meta.locale, item.locale, where);
      assert.equal(data.meta.direction, item.direction, where);
      assert.match(source, new RegExp(`<html lang="${item.lang}" dir="${item.direction}"`), where);
      assert.deepEqual(Object.keys(data.meta.routes).sort(), ['appPrivacy', 'feedback', 'home', 'news', 'privacy'], where);
      assert.equal(data.meta.routes.home, routeOf(item, 'home'), where);
      assert.equal(data.meta.routes.feedback, routeOf(item, 'feedback'), where);
      assert.equal(data.meta.routes.news, routeOf(item, 'news'), where);
      if (page === 'feedback') routes.add(data.meta.routes.feedback);
      // The inlined copy is exactly the keys the modules ask for, with the placeholders the key declares.
      assert.deepEqual([...graphKeys(source)].sort(), Object.keys(data.copy).sort(), `${where}: #page-copy keys differ from the module graph`);
      for (const [key, value] of Object.entries(data.copy)) {
        assert.equal(typeof value, 'string', `${where}: ${key}`);
        assert.ok(value.trim(), `${where}: empty copy for ${key}`);
        assert.deepEqual(placeholders(value), placeholders(key), `${where}: placeholders of ${key} changed in "${value}"`);
      }
      const text = createText(data.copy, data.meta.locale);
      assert.throws(() => text('missing translation'), /Missing website copy/, where);
      if (page === 'feedback') {
        for (const key of ['검토 중', '준비 중', '반영 완료', '익명']) assert.ok(text(key), `${where}: ${key}`);
        assert.doesNotMatch(text('나도 원해요, 공감 {count}개', {count: 3}), /\{\w+\}/, where);
        assert.ok(text('나도 원해요, 공감 {count}개', {count: 1234}).includes(new Intl.NumberFormat(data.meta.locale).format(1234)), `${where}: counts use the locale's digits`);
      } else {
        const done = text('{time} 목표 도달', {time: new Intl.DateTimeFormat(data.meta.locale, {hour: 'numeric', minute: '2-digit'}).format(new Date('2026-10-15T17:05:00Z'))});
        assert.doesNotMatch(done, /\{\w+\}/, where);
        assert.doesNotMatch(text('{name}, {tod}', {name: 'x', tod: 'y'}), /\{\w+\}/, where);
        assert.doesNotMatch(text('3개 중 1개 완료'), /\{\w+\}/, where);
      }
      assert.ok(new Intl.DateTimeFormat(data.meta.locale).format(new Date('2026-10-15T12:00:00Z')), where);
    }
  }
  assert.equal(routes.size, locales.length, 'a distinct board route per language');
});

test('room text is complete for every language: 101 rooms, themes and every item the manifest names', () => {
  const manifestFile = readdirSync(new URL('assets/rooms/', docs)).filter(name => /^manifest\.[0-9a-f]{10}\.json$/.test(name));
  assert.equal(manifestFile.length, 1, 'one hashed room manifest');
  const manifest = JSON.parse(read('assets/rooms/' + manifestFile[0]));
  assert.equal(manifest.order.length, 101);
  const wanted = new Set();
  for (const id of manifest.order) {
    wanted.add(`room.${id}.name`).add(`room.${id}.desc`);
    const room = manifest.rooms[id];
    wanted.add(`theme.${room.theme}`);
    for (const item of room.items) wanted.add(`item.${item.item}`);
  }
  wanted.add('theme.common');
  const ko = JSON.parse(read('assets/i18n/rooms/source.json'));
  for (const key of wanted) assert.ok(typeof ko[key] === 'string' && ko[key], `Korean source lacks ${key}`);
  for (const item of locales) {
    const file = `assets/i18n/runtime/rooms.${item.lang}.json`;
    assert.ok(existsSync(new URL(file, docs)), `${file} was not generated`);
    const text = JSON.parse(read(file));
    const missing = [...wanted].filter(key => typeof text[key] !== 'string' || !text[key].trim());
    assert.deepEqual(missing.slice(0, 3), [], `${item.locale}: ${missing.length} room strings missing`);
    for (const key of wanted) assert.doesNotMatch(text[key], /\{\w+\}|<[a-z]/i, `${item.locale}: ${key}`);
  }
  const kor = JSON.parse(read('assets/i18n/runtime/rooms.ko.json'));
  for (const key of wanted) assert.equal(kor[key], ko[key], `rooms.ko.json differs from the source for ${key}`);
  for (const item of locales.filter(row => ['ar', 'he'].includes(row.lang))) {
    assert.equal(item.direction, 'rtl');
    assert.match(read(pagePath(item, 'home')), /<html lang="[a-z]+" dir="rtl"/);
  }
});

test('authored policy routes, language choices and alternates match available translations', () => {
  const origin = 'https://www.myanimalroom.com';
  const sitemap = read('sitemap.xml');
  for (const page of ['privacy', 'app-privacy']) {
    const routes = [{lang: 'ko', path: `/ko/${page}/`}, {lang: 'en', path: `/en/${page}/`}];
    if (page === 'app-privacy') routes.push({lang: 'ja', path: '/ja/app-privacy/'}, {lang: 'zh-Hant', path: '/zh-hant/app-privacy/'});
    for (const {lang, path} of routes) {
      const source = read(`.${path}index.html`);
      assert.match(source, new RegExp(`<html lang="${lang}"`));
      assert.ok(source.includes(`<link rel="canonical" href="${origin}${path}">`));
      assert.ok(source.includes(`<meta property="og:url" content="${origin}${path}">`));
      const choices = [...source.matchAll(/<a\b[^>]*data-language-search="[^"]*"[^>]*>/g)].map(match => match[0]);
      assert.equal(choices.length, routes.length, path);
      const current = choices.filter(choice => choice.includes('aria-current="page"'));
      assert.equal(current.length, 1, path);
      assert.ok(current[0].includes(`href="${path}"`), path);
      for (const choice of routes) {
        assert.ok(choices.some(link => link.includes(`href="${choice.path}"`) && link.includes(`lang="${choice.lang}"`)), path);
        assert.ok(source.includes(`<link rel="alternate" hreflang="${choice.lang}" href="${origin}${choice.path}">`));
      }
      assert.equal((source.match(/<link rel="alternate"/g) || []).length, routes.length + 1, path);
      assert.ok(source.includes(`<link rel="alternate" hreflang="x-default" href="${origin}/en/${page}/">`));
      assert.doesNotMatch(source, /<!--(?:LANGUAGE_PICKER|SITE_NAV|LOCALE_ALTERNATES|SITE_HEADER|SITE_FOOTER|HEAD_META)/);
      assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`));
    }
    for (const locale of locales.filter(item => !routes.some(route => route.lang === item.lang))) {
      assert.equal(existsSync(new URL(`${locale.path}/${page}/index.html`, docs)), false);
    }
  }
});

test('published pages use the spaced app brand while preserving channel handles', () => {
  const pages = readdirSync(docs, {recursive: true}).filter(path => path.endsWith('.html'));
  const expected = locales.length * 3 + 2 + 4 + 1 + 5;   // canonical pages, 404, English root and four legacy Korean URLs
  assert.equal(pages.length, expected);
  const brand = /<a class="[^"]*\bbrand\b[^"]*"[^>]*>(?:<img[^>]*>)?<span class="mar-choice-label">My Animal Room<\/span><\/a>/;
  for (const page of pages) {
    const source = read(page);
    assert.doesNotMatch(source, /MyAnimalRoom(?!Life)/, page);
    assert.match(source, brand, page);
    if (page === '404.html') continue;
    assert.match(source, /https:\/\/www\.myanimalroom\.com\//, page);
    assert.match(source, /https:\/\/www\.youtube\.com\/@MyAnimalRoomLife/, page);
  }
});
