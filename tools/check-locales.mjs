import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
