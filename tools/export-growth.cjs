/* Export the growth stage artwork (tools/assets/src/growth/*.svg) and the app source hashes it was drawn from; the app checkout is read-only. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {app, native} = require('./native-renderer.cjs');
const root = path.resolve(__dirname, '..');
const files = [
  'src/world/drawn/growth/art-shapes.ts',
  'src/world/drawn/growth/art-flower.ts',
  'src/features/onboarding/scene/onboarding-flower-motion.ts',
  'src/features/onboarding/scene/onboarding-flower-drawing.ts',
  'src/features/onboarding/scene/onboarding-flower.tsx',
];
const hash = input => crypto.createHash('sha256').update(input).digest('hex');
const svgOnly = process.argv.includes('--svg-only');   // write only tools/assets/src/growth/*.svg (no architecture/ write)
const flowerArt = native(path.join(app,files[1])).flowerArt;
const body = parts => parts.map(p => {
  const geometry = p.type === 'ellipse' ? `ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}"`
    : `path d="${p.ops.map(op=>op.join(' ')).join(' ')}"`;
  return `<${geometry} fill="${p.fill ?? 'none'}" fill-opacity="${p.fillAlpha}" stroke="${p.stroke ?? 'none'}" stroke-width="${p.strokeWidth}" stroke-opacity="${p.strokeAlpha}" stroke-linecap="round" stroke-linejoin="round"/>`;
}).join('');
// Stage SVGs for the home page: flowerArt[0..4] with tight viewBoxes (same x/width, bottom edge at y=202; measured for sample C).
// Output is byte-equal to samples/c/assets/growth/flower-{0..4}.svg (no trailing newline).
const STAGE_VIEWBOX = ['70.5 137 126 65', '70.5 114 126 88', '70.5 77 126 125', '70.5 39 126 163', '70.5 22 126 180'];
const srcGrowth = path.join(root, 'tools/assets/src/growth');
fs.mkdirSync(srcGrowth, {recursive:true});
STAGE_VIEWBOX.forEach((viewBox, k) => fs.writeFileSync(path.join(srcGrowth, `flower-${k}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body(flowerArt[k])}</svg>`));
if (svgOnly) { console.log('PASS growth stage SVGs written to tools/assets/src/growth'); process.exit(0); }
const manifest = files.map(source => ({source, sourceSha256: hash(fs.readFileSync(path.join(app, source)))}));
fs.writeFileSync(path.join(root,'architecture/native-growth-sources.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('PASS growth stage SVGs and source hashes exported');
