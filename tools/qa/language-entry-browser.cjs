/* Real Chrome language-entry regression. No existing browser profile is touched.
   PLAYWRIGHT_PATH=/path/to/playwright-core node tools/qa/language-entry-browser.cjs [origin]
   CHROME_PATH overrides the installed macOS Chrome. QA_OUTPUT optionally saves JSON evidence. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const locales = require('../../docs/assets/i18n/locales.json');
const origin = process.argv[2] || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const results = [];
  const cases = locales.map(item => ({locale: item.locale, expected: '/' + item.path + '/', lang: item.lang}));
  cases.push(
    {locale: 'kk-KZ', expected: '/en/', lang: 'en'},
    {locale: 'en-US', saved: 'ko', expected: '/ko/', lang: 'ko'},
    {locale: 'ko-KR', saved: 'en', expected: '/en/', lang: 'en'},
    {locale: 'en-US', saved: 'constructor', expected: '/en/', lang: 'en'},
    {locale: 'en-US', start: '/ko/', expected: '/ko/', lang: 'ko'},
    {locale: 'ko-KR', start: '/en/', expected: '/en/', lang: 'en'},
    {locale: 'ko-KR', nojs: true, expected: '/', lang: 'en'},
    {locale: 'en-US', nojs: true, expected: '/', lang: 'en'},
    {locale: 'ko-KR', start: '/index.html?from=qa#focus', expected: '/ko/', lang: 'ko', query: '?from=qa', hash: '#focus'},
    ...['feedback', 'news', 'privacy', 'app-privacy'].map(name => ({
      locale: 'en-US', start: '/' + name + '/?idea=qa#main', expected: '/ko/' + name + '/', lang: 'ko', query: '?idea=qa', hash: '#main',
    })),
  );
  async function run(item) {
    const ctx = await browser.newContext({locale: item.locale, javaScriptEnabled: !item.nojs, reducedMotion: 'reduce'});
    try {
      if (item.saved) await ctx.addInitScript(value => localStorage.setItem('mar-lang', value), item.saved);
      const page = await ctx.newPage();
      await page.goto(origin + (item.start || '/'), {waitUntil: 'domcontentloaded'});
      await page.waitForURL(url => url.pathname === item.expected);
      await page.locator('h1').waitFor();
      const url = new URL(page.url());
      const lang = await page.locator('html').getAttribute('lang');
      assert.equal(lang, item.lang);
      if (item.query) assert.equal(url.search, item.query);
      if (item.hash) assert.equal(url.hash, item.hash);
      const heading = (await page.locator('h1').textContent()).trim();
      assert.ok(heading);
      results.push({...item, url: page.url(), lang, heading, pass: true});
    } finally { await ctx.close(); }
  }
  try {
    for (let i = 0; i < cases.length; i += 3) await Promise.all(cases.slice(i, i + 3).map(run));
    // A real manual picker choice is remembered when returning to the bare root.
    const ctx = await browser.newContext({locale: 'en-US', reducedMotion: 'reduce'});
    try {
      const page = await ctx.newPage();
      await page.goto(origin + '/en/', {waitUntil: 'domcontentloaded'});
      await page.locator('.language-picker summary').click();
      await page.locator('.language-picker a[hreflang="ko"]').click();
      await page.waitForURL('**/ko/');
      assert.equal(await page.evaluate(() => localStorage.getItem('mar-lang')), 'ko');
      await page.goto(origin + '/', {waitUntil: 'domcontentloaded'});
      await page.waitForURL('**/ko/');
      results.push({manualChoice: 'ko', browserLanguage: 'en-US', url: page.url(), pass: true});
    } finally { await ctx.close(); }
    if (process.env.QA_OUTPUT) {
      fs.mkdirSync(path.dirname(process.env.QA_OUTPUT), {recursive: true});
      fs.writeFileSync(process.env.QA_OUTPUT, JSON.stringify({origin, results}, null, 2) + '\n');
    }
    console.log(`PASS ${results.length} actual Chrome cases: ${locales.length} browser languages, fallback, saved/manual choices, direct links, legacy URLs, no-JS`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
