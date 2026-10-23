import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const locales = JSON.parse(readFileSync(new URL('../docs/assets/i18n/locales.json', import.meta.url)));
const home = readFileSync(new URL('../docs/assets/v5/copy.js', import.meta.url), 'utf8');
const feedback = new URL('../docs/assets/feedback/copy.mjs', import.meta.url);

test('every public language has working runtime messages, counts, dates and a distinct board route', async () => {
  const routes = new Set();
  const previousDocument = globalThis.document;
  try {
    for (const item of locales) {
      const context = {document: {documentElement: {lang: item.lang}}};
      context.window = context;
      vm.createContext(context);
      vm.runInContext(home, context);
      const summary = context.MARCopy.taskSummary(2, 3);
      assert.ok(summary.includes(new Intl.NumberFormat(item.lang).format(2)), item.locale);
      assert.doesNotMatch(summary, /\{\w+\}/);
      assert.doesNotMatch(context.MARCopy.duration(75), /\{\w+\}/);
      assert.throws(() => context.MARCopy.text('missing translation'));
      globalThis.document = context.document;
      const module = await import(feedback.href + '?check=' + item.lang);
      assert.equal(module.currentLocale.locale, item.locale);
      assert.equal(module.currentLocale.direction, item.direction);
      const expected = '/' + (item.path ? item.path + '/' : '') + 'feedback/';
      assert.equal(module.currentLocale.feedback, expected);
      assert.equal(module.currentLocale.news, expected.replace('feedback/', 'news/'));
      for (const key of ['검토 중', '준비 중', '반영 완료']) assert.ok(module.text(key));
      routes.add(expected);
      assert.doesNotMatch(module.text('나도 원해요, 공감 {count}개', {count: 3}), /\{\w+\}/);
      assert.ok(module.text('익명'));
      assert.throws(() => module.text('missing translation'));
      assert.ok(new Intl.DateTimeFormat(item.locale).format(new Date('2026-10-15T12:00:00Z')));
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
  assert.equal(routes.size, locales.length);
});

test('authored policy routes, language choices and alternates match available translations', () => {
  const origin = 'https://www.myanimalroom.com';
  const sitemap = readFileSync(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');
  for (const page of ['privacy', 'app-privacy']) {
    const routes = [{lang: 'ko', path: `/${page}/`}, {lang: 'en', path: `/en/${page}/`}];
    if (page === 'app-privacy') routes.push({lang: 'ja', path: '/ja/app-privacy/'}, {lang: 'zh-Hant', path: '/zh-hant/app-privacy/'});
    for (const {lang, path} of routes) {
      const source = readFileSync(new URL(`../docs${path}index.html`, import.meta.url), 'utf8');
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
      assert.doesNotMatch(source, /<!--(?:LANGUAGE_PICKER|SITE_NAV|LOCALE_ALTERNATES)-->/);
      assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`));
    }
    for (const locale of locales.filter(item => !routes.some(route => route.lang === item.lang))) {
      assert.equal(existsSync(new URL(`../docs/${locale.path}/${page}/index.html`, import.meta.url)), false);
    }
  }
});


test('published pages use the spaced app brand while preserving channel handles', () => {
  const docs = new URL('../docs/', import.meta.url);
  const pages = readdirSync(docs, {recursive: true}).filter(path => path.endsWith('.html'));
  assert.equal(pages.length, 97);
  for (const page of pages) {
    const source = readFileSync(new URL(page, docs), 'utf8');
    assert.doesNotMatch(source, /MyAnimalRoom(?!Life)/, page);
    if (page === '404.html') continue;
    assert.match(source, /<a class="brand"[^>]*>My Animal Room<\/a>/, page);
    assert.match(source, /https:\/\/www\.myanimalroom\.com\//, page);
    if (page === 'index.html') {
      assert.match(source, /https:\/\/www\.youtube\.com\/@MyAnimalRoomLife/, page);
    }
  }
});
