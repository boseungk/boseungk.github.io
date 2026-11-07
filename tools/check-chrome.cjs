/* Shared chrome controllers in a small DOM/event fixture (no browser):
   site/language-picker.js (the picker block moved from check-interactions.cjs, same assertions: Safari-safe menu,
   search, Escape, outside click, shared-suggestion navigation to /ar/feedback/) and site/chrome.js (the scroll line
   and the two-row fallback when one bar row does not fit). Runs with node --test or plain node. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');
const docs = path.resolve(__dirname, '../docs');

class Target {
  constructor() { this.listeners = {}; }
  addEventListener(name, fn) { (this.listeners[name] ??= new Set()).add(fn); }
  removeEventListener(name, fn) { this.listeners[name]?.delete(fn); }
  emit(name, data = {}) { for (const fn of [...this.listeners[name] ?? []]) fn(data); }
}
class Element extends Target {
  constructor(text = '') {
    super(); this.nodeType = 1; this.attrs = {}; this.dataset = {}; this.childNodes = []; this.children = []; this.textContent = text;
    this.classes = new Set(); this.classList = {add: (...keys) => keys.forEach(k => this.classes.add(k)), remove: (...keys) => keys.forEach(k => this.classes.delete(k)), contains: k => this.classes.has(k), toggle: (k, on = !this.classes.has(k)) => (on ? this.classes.add(k) : this.classes.delete(k), on)};
    this.map = {}; this.rect = {left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0};
  }
  set textContent(value) { this.childNodes = [{nodeType: 3, nodeValue: value}]; }
  get textContent() { return this.childNodes.map(n => n.nodeValue ?? n.textContent).join(''); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  querySelector(k) { return this.map[k] ?? null; }
  querySelectorAll(k) { return this.map[k] ?? []; }
  getBoundingClientRect() { return this.rect; }
  contains(el) { return el === this || this.childNodes.some(child => child === el || child.contains?.(el)); }
  focus() { this.document.activeElement = this; }
}
function setup({wide = true} = {}) {
  const window = new Target(), document = new Target(), media = new Target(), resizers = [];
  media.matches = wide;
  document.map = {}; document.querySelector = k => document.map[k] ?? null; document.getElementById = id => document.map['#' + id] ?? null;
  document.fonts = {ready: Promise.resolve()};
  const s = {console, document, URL, scrollY: 0, matchMedia: () => media, setTimeout: fn => fn(),
    getComputedStyle: el => el.style ?? {paddingLeft: '0px', paddingRight: '0px'},
    ResizeObserver: class { constructor(fn) { this.fn = fn; resizers.push(this); } observe(el) { this.el = el; } },
    addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window)};
  s.window = s; vm.createContext(s);
  const load = file => vm.runInContext(fs.readFileSync(path.join(docs, file), 'utf8'), s, {filename: file});
  const resize = width => resizers.forEach(r => r.fn([{contentRect: {width}}]));
  return {s, window, document, media, load, resize};
}

test('language picker: Safari-safe keyboard menu, Escape and outside click', () => {
  const e = setup(), picker = new Element(), trigger = new Element(), links = [new Element(), new Element()];
  [trigger, ...links].forEach(el => { el.document = e.document; }); picker.childNodes = [trigger, ...links];
  picker.map = {summary: trigger, a: links}; e.document.map['.language-picker'] = picker;
  e.load('assets/site/language-picker.js'); trigger.focus();
  const key = k => picker.emit('keydown', {key: k, preventDefault() {}});
  key('ArrowDown'); assert(picker.open); assert.equal(e.document.activeElement, links[0]);
  key('ArrowDown'); assert.equal(e.document.activeElement, links[1]); key('ArrowDown'); assert.equal(e.document.activeElement, links[0]);
  picker.emit('focusout'); assert(picker.open, 'Safari pointer navigation must survive summary blur');
  e.document.emit('pointerdown', {target: links[1]}); assert(picker.open);
  key('Escape'); assert(!picker.open); assert.equal(e.document.activeElement, trigger);
  key('ArrowUp'); assert.equal(e.document.activeElement, links[1]); e.document.emit('pointerdown', {target: new Element()}); assert(!picker.open);
});

test('language picker: search, empty state, Escape reset and shared suggestion navigation', () => {
  const e = setup(), picker = new Element(), trigger = new Element(), search = new Element(), empty = new Element();
  const rows = [['日本語 Japanese ja-JP', 'ja'], ['Français French fr-FR', 'fr'], ['العربية Arabic ar-SA', 'ar']];
  const links = rows.map(([name, code]) => {
    const link = new Element(); link.dataset.languageSearch = name; link.href = `https://www.myanimalroom.com/${code}/feedback/?idea=sample`;
    link.parentElement = new Element(); link.document = e.document; return link;
  });
  search.value = ''; trigger.document = search.document = e.document;
  picker.childNodes = [trigger, search, ...links];
  picker.map = {summary: trigger, a: links, '[data-language-search-input]': search, '[data-language-empty]': empty};
  e.document.map['.language-picker'] = picker; e.s.location = {href: 'https://www.myanimalroom.com/feedback/?idea=sample#idea-sample', hash: '#idea-sample'};
  e.load('assets/site/language-picker.js');
  const key = value => picker.emit('keydown', {key: value, preventDefault() {}});
  search.value = 'francais'; search.emit('input'); key('ArrowDown');
  assert.equal(e.document.activeElement, links[1]); assert.equal(empty.hidden, true);
  key('ArrowDown'); assert.equal(e.document.activeElement, links[1]);
  search.value = '日本'; search.emit('input'); key('ArrowDown'); assert.equal(e.document.activeElement, links[0]);
  search.value = 'no such language'; search.emit('input'); key('ArrowDown'); assert.equal(empty.hidden, false);
  key('Escape'); assert.equal(search.value, ''); assert(links.every(link => !link.parentElement.hidden));
  links[2].emit('click'); assert.equal(links[2].href, 'https://www.myanimalroom.com/ar/feedback/?idea=sample#idea-sample');
});

function bar(e, items, {padding = 40, width = 1000} = {}) {
  const el = new Element(); el.rect = {left: 0, right: width, top: 0, bottom: 60, width, height: 60};
  el.style = {paddingLeft: padding + 'px', paddingRight: padding + 'px'};
  el.children = items.map(([left, right]) => Object.assign(new Element(), {rect: {left, right, top: 8, bottom: 52, width: right - left, height: 44}}));
  e.document.map['#bar'] = el; return el;
}

test('chrome.js: the 1px line appears after 8px of scroll and leaves at the top', () => {
  const e = setup(), el = bar(e, [[40, 200], [700, 960]]);
  e.load('assets/site/chrome.js');
  assert.equal(el.classList.contains('is-solid'), false);
  e.s.scrollY = 8; e.window.emit('scroll'); assert.equal(el.classList.contains('is-solid'), false);
  e.s.scrollY = 9; e.window.emit('scroll'); assert.equal(el.classList.contains('is-solid'), true);
  e.s.scrollY = 0; e.window.emit('scroll'); assert.equal(el.classList.contains('is-solid'), false);
});

test('chrome.js: two rows only when one row does not fit (both directions), never below 760px', () => {
  const e = setup(), el = bar(e, [[40, 200], [500, 960]]);
  e.load('assets/site/chrome.js');
  assert.equal(el.classList.contains('is-stacked'), false, 'items inside the content box: one row');
  el.children[1].rect = {...el.children[1].rect, right: 990}; e.resize(920);
  assert.equal(el.classList.contains('is-stacked'), true, 'an item past the inline end: two rows');
  e.resize(920); el.children[1].rect = {...el.children[1].rect, right: 950}; e.resize(920);
  assert.equal(el.classList.contains('is-stacked'), true, 'the same width is not re-measured');
  e.resize(1100); assert.equal(el.classList.contains('is-stacked'), false, 'a new width re-measures from one row');
  el.children[0].rect = {...el.children[0].rect, left: 12}; e.resize(1101);
  assert.equal(el.classList.contains('is-stacked'), true, 'RTL overflow past the inline start also stacks');
  e.media.matches = false; e.resize(700);
  assert.equal(el.classList.contains('is-stacked'), false, 'below 760px the CSS owns the two-row layout');
});

test('chrome.js: no bar, no error', () => {
  const e = setup();
  assert.doesNotThrow(() => e.load('assets/site/chrome.js'));
});

// tools/sitebuild/chrome.py variants that no page uses yet (404 header, home footer, hero/closing stores, live Play),
// rendered in memory by the real build with a fixture template and catalog (writes nothing).
test('chrome.py: header/footer variants and store labels per locale', () => {
  const {execFileSync} = require('node:child_process');
  const script = String.raw`
import json, sys
sys.dont_write_bytecode = True
sys.path.insert(0, 'tools')
from sitebuild import core, chrome
from sitebuild.core import Build, Site
src = dict(Site().source(), **{'{store}에서 받기': 'Download on the {store}', '곧 출시': 'Coming soon', '문의 및 오류 신고': 'Contact and bug reports', '앱 개인정보처리방침': 'App privacy policy'})
tpl = '<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><!--SITE_HEADER:minimal--><main id="main" tabindex="-1"><!--STORES:hero reveal--><!--STORES:closing--></main><!--SITE_FOOTER:home--></body></html>'
out = {}
for live in (False, True):
    chrome.STORES['play_live'] = live
    pages = Build(Site(templates={'news.ko.html': tpl}, source=src), 'draft', only=['news']).run()
    out[str(live)] = {k: pages[f'docs/{p}news/index.html'] for k, p in (('ko', ''), ('en', 'en/'), ('ar', 'ar/'), ('ja', 'ja/'))}
print(json.dumps(out))
`;
  const pages = JSON.parse(execFileSync('python3', ['-c', script], {cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 1 << 26}));
  const {ko, en, ar, ja} = pages.False;
  const header = page => page.match(/<header class="bar"[\s\S]*?<\/header>/)[0];
  const footer = page => page.match(/<footer[\s\S]*?<\/footer>/)[0];
  for (const page of [ko, en, ar]) {
    assert.match(page, /<a class="skip-link" href="#main">/);
    assert.equal((header(page).match(/class="store"/g) || []).length, 1, 'minimal header: App Store only');
    assert.doesNotMatch(header(page), /bar__nav|language-picker|data-href/);
    assert.match(header(page), /<a class="wordmark brand"[^>]*><img[^>]*><span class="mar-choice-label">My Animal Room<\/span><\/a>/);
    assert.match(footer(page), /^<footer class="foot" id="contact">/);
    assert.doesNotMatch(footer(page), /class="stores|aria-current/);
    assert.doesNotMatch(page, /<!--/, 'no placeholder or partial note survives');
  }
  assert.match(ko, /<div class="stores stores--hero reveal"><a class="store" href="https:\/\/apps\.apple\.com\/app\/id6826182682" rel="noopener"><span class="store__label"><span class="store__name">App Store<\/span><span class="store__go">에서 받기<\/span><\/span><\/a><a class="store" data-href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.myanimalroom\.app"><span class="store__name">Google Play<\/span><span class="store__soon">곧 출시<\/span><\/a><\/div>/);
  assert.match(en, /<span class="store__label"><span class="store__go">Download on the <\/span><span class="store__name">App Store<\/span><\/span><\/a>/, 'the split follows the locale word order, inside one flex item so the space stays');
  assert.match(en, /<div class="stores stores--closing">/);
  assert.match(en, /aria-label="Download on the App Store"/);
  assert.match(en, /<span class="store__soon">Coming soon<\/span>/);
  assert.match(footer(en), /href="\/en\/privacy\/"><span class="mar-choice-label">Website privacy/);
  assert.doesNotMatch(footer(en), /hreflang/, 'an English page needs no hreflang on English policies');
  assert.match(footer(ar), /<a href="\/en\/privacy\/" hreflang="en">/, 'English-only policy from ar');
  assert.match(footer(ja), /<a href="\/ja\/app-privacy\/">/, 'ja has its own app policy');
  assert.match(footer(ar), /<a href="\/en\/app-privacy\/" hreflang="en">/);
  assert.match(footer(ko), /<a href="mailto:contact@myanimalroom\.com"><span class="mar-choice-label">문의 및 오류 신고<\/span><\/a>/);
  const live = pages.True;
  assert.match(live.ko, /<a class="store" href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.myanimalroom\.app&amp;hl=ko" rel="noopener"><span class="store__label"><span class="store__name">Google Play<\/span><span class="store__go">에서 받기<\/span><\/span><\/a>/);
  assert.doesNotMatch(live.ko, /data-href|store__soon/);
});
