/* Exercise GLB/display compositing and graphics fail-safe boundaries. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createCanvas} = require('/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const docs = path.resolve(__dirname, '../docs');
class Element {
  constructor() {this.style = {}; this.dataset = {}; this.children = []; this.clientWidth = 400; this.clientHeight = 700;}
  append(child) {this.children.push(child); child.parent = this;}
  remove() {if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);}
  setAttribute() {}
}
async function check(mode) {
  const warnings = [], stage = new Element(), source = new Element();
  let disposed = 0, renderCount = 0;
  const s = {console: {warn: (...args) => warnings.push(args)}, document: {createElement: tag => tag === 'canvas' ? createCanvas(1, 1) : new Element()}};
  s.window = s; vm.createContext(s);
  if (mode !== 'missing-library') {
    vm.runInContext(fs.readFileSync(path.join(docs, 'assets/vendor/three.min.js'), 'utf8'), s);
    const T = s.THREE;
    T.WebGLRenderer = class {
      constructor() {if (mode === 'webgl') throw Error('No WebGL'); this.domElement = new Element();}
      setPixelRatio() {} setSize() {} render() {renderCount++;} dispose() {disposed++;}
    };
    T.PMREMGenerator = class {fromEquirectangular() {return {texture: null, dispose() {disposed++;}};} dispose() {}};
    T.GLTFLoader = class {
      load(url, ready, progress, fail) {
        assert.equal(url, '/assets/device/iphone.glb');
        if (mode === 'glb') {fail(Error('GLB missing')); return;}
        const model = new T.Group(), glass = new T.Mesh(new T.PlaneGeometry(.0705, .1486), new T.MeshBasicMaterial());
        glass.name = 'front-glass'; model.add(glass); ready({scene: model});
      }
    };
  }
  vm.runInContext(fs.readFileSync(path.join(docs, 'assets/v4/phone.js'), 'utf8'), s);
  const phone = await s.MARHeroPhone(stage, source);
  if (mode !== 'primary') {
    assert.equal(phone, null); assert.equal(stage.dataset.ready, undefined);
    assert.equal(stage.dataset.phoneUnavailable, mode); assert.equal(warnings.length, 1);
    if (mode === 'glb') {assert.equal(disposed, 2); assert.equal(stage.children.length, 0);}
    return;
  }
  assert.equal(stage.dataset.ready, 'true');
  const host = stage.children.find(child => child.children?.includes(source));
  assert(host); assert.match(host.style.clipPath, /^polygon\(/);
  assert.equal(host.children.filter(child => child === source).length, 1, 'direct source display, no duplicate texture');
  const rect = phone.getScreenRect(); assert(rect.width > 0 && rect.height > 0);
  phone.render(); phone.resize(); assert(renderCount >= 2);
  phone.destroy(); phone.destroy(); assert.equal(stage.children.length, 0); assert.equal(stage.dataset.ready, undefined);
}
(async () => {
  for (const mode of ['primary', 'missing-library', 'webgl', 'glb']) await check(mode);
  console.log('PASS direct native phone display/mask/lifecycle and missing-library/WebGL/GLB fail-safe paths');
})().catch(error => {console.error(error); process.exitCode = 1;});
