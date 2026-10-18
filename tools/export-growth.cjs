/* Export production onboarding artwork/motion; the app checkout is read-only. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {app, native} = require('./native-renderer.cjs');
const ts = require(path.join(app, 'node_modules/typescript'));
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/assets/v5/growth-motion');
const files = [
  ['src/world/drawn/growth/art-shapes.ts', 'art-shapes.mjs'],
  ['src/world/drawn/growth/art-flower.ts', 'art-flower.mjs'],
  ['src/features/onboarding/scene/onboarding-flower-motion.ts', 'onboarding-flower-motion.mjs'],
];
const hash = input => crypto.createHash('sha256').update(input).digest('hex');
fs.mkdirSync(out, {recursive:true});
const manifest = files.map(([source, file]) => {
  const input = fs.readFileSync(path.join(app, source), 'utf8');
  const code = ts.transpileModule(input, {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
    .replaceAll("'./art-shapes'", "'./art-shapes.mjs'")
    .replaceAll("'@/world/drawn/growth/art-flower'", "'./art-flower.mjs'");
  const output = `// Generated from Dayloom ${source}. Do not edit.\n${code}`;
  fs.writeFileSync(path.join(out, file), output);
  return {file,source,sourceSha256:hash(input),sha256:hash(output)};
});
for (const source of ['src/features/onboarding/scene/onboarding-flower-drawing.ts','src/features/onboarding/scene/onboarding-flower.tsx']) {
  manifest.push({source,sourceSha256:hash(fs.readFileSync(path.join(app,source)))});
}
fs.writeFileSync(path.join(root,'architecture/native-growth-sources.json'),JSON.stringify(manifest,null,2)+'\n');
const parts = native(path.join(app,files[1][0])).flowerArt[0];
const art = parts.map(p => {
  const geometry = p.type === 'ellipse' ? `ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}"`
    : `path d="${p.ops.map(op=>op.join(' ')).join(' ')}"`;
  return `<${geometry} fill="${p.fill ?? 'none'}" fill-opacity="${p.fillAlpha}" stroke="${p.stroke ?? 'none'}" stroke-width="${p.strokeWidth}" stroke-opacity="${p.strokeAlpha}" stroke-linecap="round" stroke-linejoin="round"/>`;
}).join('');
fs.writeFileSync(path.join(root,'docs/assets/v5/growth/flower-0.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="25 8 210 205">${art}</svg>\n`);
console.log('PASS production flower artwork, timeline and track poses exported');
