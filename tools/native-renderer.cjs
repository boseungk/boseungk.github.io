/* Export boundary: read native sources; render into the website only. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = process.env.DAYLOOM_SOURCE || '/Users/gpt/Projects/dayloom';
const modules = process.env.NATIVE_NODE_MODULES || '/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {createCanvas, Path2D, ImageData} = require(path.join(modules, '@napi-rs/canvas'));
const ts = require(path.join(app, 'node_modules/typescript'));
const cache = new Map();
const sandbox = {console, Path2D, ImageData, document: {createElement: () => createCanvas(1, 1)}, performance};
sandbox.window = sandbox;
vm.createContext(sandbox);
function native(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = {exports: {}};
  cache.set(file, module);
  let input = fs.readFileSync(file, 'utf8');
  if (file.endsWith('/skia-canvas2d.js')) {
    // napi-rs addPath can join closed contours with a diagonal. Concatenate
    // SVG subpaths to retain every M boundary; keep transformed addPath intact.
    const declaration = 'const p = new Path2D();\n    for (const o of this.ops)';
    const operation = "case 'P': p.addPath(o[1], o[2]); break;";
    if (!input.includes(declaration) || !input.includes(operation)) {
      throw new Error('Native canvas adapter changed; review the contour correction before exporting.');
    }
    input = input.replace(declaration, 'let p = new Path2D();\n    for (const o of this.ops)')
      .replace(operation, "case 'P': if (!o[2]) p = new Path2D(p.toSVGString() + ' ' + o[1].toSVGString()); else p.addPath(o[1], o[2]); break;");
  }
  const code = ts.transpileModule(input, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }}).outputText;
  function resolve(name) {
    const stem = name === '@shopify/react-native-skia' ? path.join(app, 'design/prototype-editorial/lab/drawn-web/skia-canvas2d.js')
      : name.startsWith('@/') ? path.join(app, 'src', name.slice(2))
      : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
    if (!stem) throw new Error('Unsupported native import: ' + name);
    const found = [stem, stem + '.ts', stem + '.tsx', stem + '.js', stem + '/index.ts']
      .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!found) throw new Error('Missing native import: ' + name);
    return native(found);
  }
  vm.runInContext('(function(require,module,exports){' + code + '\n})', sandbox, {filename: file})(resolve, module, module.exports);
  return module.exports;
}
module.exports = {app, native, createCanvas, Path2D, ImageData};
