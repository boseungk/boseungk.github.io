/* Controller regressions run in a small DOM/event fixture, without a browser dependency. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const docs = path.resolve(__dirname, '../docs');
class Target {
  constructor() { this.listeners = {}; }
  addEventListener(name, fn) { (this.listeners[name] ??= new Set()).add(fn); }
  removeEventListener(name, fn) { this.listeners[name]?.delete(fn); }
  emit(name, data = {}) { for (const fn of [...this.listeners[name] ?? []]) fn(data); }
}
class Element extends Target {
  constructor(text = '') {
    super(); this.nodeType = 1; this.tagName = 'DIV'; this.attrs = {}; this.dataset = {};
    this.childNodes = []; this.textContent = text; this.style = {setProperty(name, value) {this[name] = value;}};
    this.classes = new Set(); this.classList = {add: (...keys) => keys.forEach(k => this.classes.add(k)), remove: (...keys) => keys.forEach(k => this.classes.delete(k)), contains: k => this.classes.has(k), toggle: (k, on) => on ? this.classes.add(k) : this.classes.delete(k)};
    this.map = {}; this.rect = {top: 900, bottom: 1100};
  }
  set textContent(value) {this.childNodes = [{nodeType: 3, nodeValue: value}];}
  get textContent() {return this.childNodes.map(n => n.nodeValue ?? n.textContent).join('');}
  setAttribute(k, v) {this.attrs[k] = v;}
  getAttribute(k) {return this.attrs[k] ?? null;}
  querySelector(k) {return this.map[k] ?? null;}
  querySelectorAll(k) {return this.map[k] ?? [];}
  getBoundingClientRect() {return this.rect;}
  append(el) {this.childNodes.push(el);}
  contains(el) {return el === this || this.childNodes.some(child => child.contains?.(el) || child === el);}
  focus() {this.document.activeElement = this;}
  animate() {return {cancel() {}};}
  getContext() {return {clearRect() {}};}
}
function setup(lang = 'ko', reduced = false) {
  const window = new Target(), document = new Target(), body = new Element();
  document.body = body; body.classes.add('motion-on'); document.hidden = false;
  document.documentElement = {lang}; document.querySelector = k => document.map[k] ?? null;
  document.querySelectorAll = k => k === '[data-task][aria-checked="true"]' ? (document.map['[data-task]'] ?? []).filter(b => b.getAttribute('aria-checked') === 'true') : document.map[k] ?? [];
  document.map = {}; document.getElementById = id => document.map['#' + id] ?? null; document.createElement = () => new Element();
  const frames = new Map(), observers = [], mutations = [], media = new Target(); media.matches = reduced;
  const s = {console, document, innerHeight: 1000, matchMedia: () => media, queueMicrotask: fn => fn(), setTimeout: fn => fn(),
    requestAnimationFrame: fn => {const id = ++s.frameId; frames.set(id, fn); return id;}, cancelAnimationFrame: id => frames.delete(id), frameId: 0,
    IntersectionObserver: class {constructor(fn) {this.fn = fn; observers.push(this);} observe() {} disconnect() {}},
    MutationObserver: class {constructor(fn) {mutations.push(fn);} observe() {}},
    addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window)};
  s.window = s; vm.createContext(s);
  const load = file => vm.runInContext(fs.readFileSync(path.join(docs, file), 'utf8'), s, {filename: file});
  const frame = now => {const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn(now)); mutations.forEach(fn => fn());};
  return {s, document, body, window, observers, media, load, frame, flush: () => mutations.forEach(fn => fn())};
}
function locale(env) {env.load('assets/v5/copy.js');}
function tasks(lang, reduced = false) {
  const e = setup(lang, reduced), list = new Element(), result = new Element();
  const buttons = Array.from({length: 3}, () => {
    const b = new Element(), mark = new Element(); b.setAttribute('aria-checked', 'false');
    for (const selector of ['.task-native-ring', 'path', '.task-native-burst']) mark.map[selector] = new Element();
    b.map['.task-check'] = mark; return b;
  });
  e.document.map = {'[data-task]': buttons, '.task-list': list, '#task-result': result}; e.body.childNodes = [result];
  locale(e); e.load('assets/v5/actions.js');
  e.frame(100); assert.equal(buttons[0].getAttribute('aria-checked'), 'false');
  list.rect = {top: 510, bottom: 800}; e.window.emit('scroll'); e.frame(200);
  assert.equal(buttons[0].getAttribute('aria-checked'), 'true');
  if (reduced) {assert(buttons.every(b => b.getAttribute('aria-checked') === 'true')); return;}
  buttons[1].emit('click'); buttons[1].emit('click'); e.flush();
  e.body.classes.delete('motion-on'); e.window.emit('mar:motion', {detail: {paused: true}}); e.frame(800);
  assert.equal(buttons[2].getAttribute('aria-checked'), 'false');
  e.body.classes.add('motion-on'); e.window.emit('mar:motion', {detail: {paused: false}});
  for (let now = 900; now <= 2500; now += 100) e.frame(now);
  assert.equal(buttons[1].getAttribute('aria-checked'), 'false', 'preserve manual visitor choice');
  assert.equal(buttons[2].getAttribute('aria-checked'), 'true'); assert.equal(list.dataset.autoCheck, 'complete');
  assert.match(result.textContent, lang === 'en' ? /^2 of 3 sample tasks completed\.$/ : /^2개 완료/);
  buttons[0].emit('click'); e.flush(); assert.equal(buttons[0].getAttribute('aria-checked'), 'false');
}
function rooms(lang) {
  const e = setup(lang), root = new Element(), reel = new Element(), pause = new Element(), prev = new Element(), next = new Element(), announcement = new Element();
  const cards = Array.from({length: 9}, (_, i) => {
    const card = new Element(), art = new Element(), caption = new Element(`Room ${i}`);
    card.dataset = {petScale: '.2', petX: '390', petY: '950'};
    card.map = {'.room-print-art': art, 'figcaption span': caption, img: [Object.assign(new Element(), {complete: true, naturalWidth: 780})]};
    return card;
  });
  root.map = {'.room-reel': reel, '.room-print': cards, '[data-room-pause]': pause, '[data-room-prev]': prev, '[data-room-next]': next, '.room-announcement': announcement};
  e.document.map['.room-carousel'] = root; e.body.childNodes = [pause, announcement];
  e.s.MARPet = () => ({command() {}, draw() {}});
  locale(e); e.load('assets/v5/rooms.js'); e.flush();
  assert.equal(root.dataset.roomIndex, '0'); assert.equal(cards.filter(c => c.classes.has('is-active')).length, 1);
  assert.equal(new Set(cards.map(c => c.map['.room-print-art'].childNodes[0])).size, 9, 'one companion canvas per room');
  e.observers[0].fn([{isIntersecting: true}]); e.frame(100); e.frame(4100);
  assert(Number(root.dataset.roomLight) > 0); e.frame(8200); assert.equal(root.dataset.roomIndex, '1');
  pause.emit('click'); e.flush(); assert.equal(root.dataset.roomPaused, 'true'); e.frame(20000); assert.equal(root.dataset.roomIndex, '1');
  assert.equal(pause.textContent, lang === 'en' ? 'Play' : '장면 재생');
  next.emit('click'); assert.equal(root.dataset.roomIndex, '2'); prev.emit('click'); assert.equal(root.dataset.roomIndex, '1');
  e.window.emit('mar:motion', {detail: {paused: true}}); e.flush(); assert(pause.disabled);
  assert.equal(pause.textContent, lang === 'en' ? 'Motion paused' : '움직임 정지됨');
  cards[2].map.img[0].naturalWidth = 0; next.emit('click'); assert.equal(root.dataset.roomIndex, '1', 'retain decoded room on image failure');
}
function menu() {
  const e = setup(), picker = new Element(), trigger = new Element(), links = [new Element(), new Element()];
  [trigger, ...links].forEach(el => {el.document = e.document;}); picker.childNodes = [trigger, ...links];
  picker.map = {summary: trigger, a: links}; e.document.map['.language-picker'] = picker;
  e.load('assets/v5/language-picker.js'); trigger.focus();
  const key = k => picker.emit('keydown', {key: k, preventDefault() {}});
  key('ArrowDown'); assert(picker.open); assert.equal(e.document.activeElement, links[0]);
  key('ArrowDown'); assert.equal(e.document.activeElement, links[1]); key('ArrowDown'); assert.equal(e.document.activeElement, links[0]);
  picker.emit('focusout'); assert(picker.open, 'Safari pointer navigation must survive summary blur');
  e.document.emit('pointerdown', {target: links[1]}); assert(picker.open);
  key('Escape'); assert(!picker.open); assert.equal(e.document.activeElement, trigger);
  key('ArrowUp'); assert.equal(e.document.activeElement, links[1]); e.document.emit('pointerdown', {target: new Element()}); assert(!picker.open);
}
function searchableMenu() {
  const e=setup(), picker=new Element(), trigger=new Element(), search=new Element(), empty=new Element();
  const rows=[['日本語 Japanese ja-JP','ja'],['Français French fr-FR','fr'],['العربية Arabic ar-SA','ar']];
  const links=rows.map(([name,code])=>{
    const link=new Element();link.dataset.languageSearch=name;link.href=`https://www.myanimalroom.com/${code}/feedback/?idea=sample`;
    link.parentElement=new Element();link.document=e.document;return link;
  });
  search.value='';trigger.document=search.document=e.document;
  picker.childNodes=[trigger,search,...links];
  picker.map={summary:trigger,a:links,'[data-language-search-input]':search,'[data-language-empty]':empty};
  e.document.map['.language-picker']=picker;e.s.URL=URL;e.s.location={href:'https://www.myanimalroom.com/feedback/?idea=sample#idea-sample',hash:'#idea-sample'};
  e.load('assets/v5/language-picker.js');
  const key=value=>picker.emit('keydown',{key:value,preventDefault(){}});
  search.value='francais';search.emit('input');key('ArrowDown');
  assert.equal(e.document.activeElement,links[1]);assert.equal(empty.hidden,true);
  key('ArrowDown');assert.equal(e.document.activeElement,links[1]);
  search.value='日本';search.emit('input');key('ArrowDown');assert.equal(e.document.activeElement,links[0]);
  search.value='no such language';search.emit('input');key('ArrowDown');assert.equal(empty.hidden,false);
  key('Escape');assert.equal(search.value,'');assert(links.every(link=>!link.parentElement.hidden));
  links[2].emit('click');assert.equal(links[2].href,'https://www.myanimalroom.com/ar/feedback/?idea=sample#idea-sample');
}
async function customize(lang) {
  const e = setup(lang), root = new Element(), story = new Element(), room = new Element(), caption = new Element(), number = new Element();
  const warnings = []; e.s.console = {warn: (...args) => warnings.push(args)};
  story.rect = {top: 0, bottom: 4000, height: 4000};
  const frames = Array.from({length: 4}, (_, i) => Object.assign(new Element(), {complete: true, naturalWidth: 780, src: `step-${i}.png`, decode: () => Promise.resolve()}));
  root.map = {'.customize-story': story, '.customize-room': room, '[data-customize-frame]': frames, '[data-customize-item]': [], '[data-customize-caption]': caption, '[data-customize-number]': number};
  locale(e); e.load('assets/v5/customize.js'); const controller = e.s.MARCustomize.mount(root);
  assert.equal(controller.state, 0);
  frames[1].complete = false; frames[1].naturalWidth = 0; frames[1].decode = () => Promise.reject(Error('bad PNG'));
  controller.seek(.3); await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.state, 0, 'retain decoded stage after failed incoming PNG');
  assert.equal(root.dataset.customizeUnavailable, 'true'); assert.equal(warnings.length, 1);
  frames[1].complete = true; frames[1].naturalWidth = 780; controller.seek(.3);
  assert.equal(controller.state, 1); assert.equal(root.dataset.customizeUnavailable, undefined);
  assert.equal(caption.textContent, lang === 'en' ? 'Choose a tulip lamp.' : '튤립 조명을 골랐어요.');
  controller.seek(1); assert.equal(controller.state, 3); controller.seek(0); assert.equal(controller.state, 0);
  controller.destroy(); assert.equal(root.marCustomize, undefined);
}
(async () => {
  for (const lang of ['ko', 'en']) {tasks(lang); tasks(lang, true); rooms(lang); await customize(lang);}
  menu(); searchableMenu(); console.log('PASS task/manual/pause, room ownership/8s/pause/loading, customize decode/retry/reverse, KO+EN labels, searchable keyboard menu and shared suggestion navigation');
})().catch(error => {console.error(error); process.exitCode = 1;});
