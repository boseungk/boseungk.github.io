/* Export the configured app icon at browser sizes; artwork is not redrawn.
   Rounded, transparent: icons/icon-{48,96,192}, icons/app-icon-{56,512}.
   Opaque full-bleed square (iOS draws transparent touch-icon pixels black): icons/apple-touch-icon-180, copied to docs/apple-touch-icon.png.
   docs/favicon.ico is a hand-written PNG-in-ICO (16/32/48). Outputs keep stable names (class 2 in PORT-PLAN 2.3; the build stamps ?v=). */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const app = process.env.DAYLOOM_SOURCE || '/Users/gpt/Projects/dayloom';
const modules = process.env.NATIVE_NODE_MODULES || '/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {createCanvas, loadImage} = require(path.join(modules, '@napi-rs/canvas'));
const RADIUS = .22;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function draw(image, size, rounded) {
  const canvas = createCanvas(size, size), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (rounded) { ctx.beginPath(); ctx.roundRect(0, 0, size, size, size * RADIUS); ctx.clip(); }
  ctx.drawImage(image, 0, 0, size, size);
  return canvas.toBuffer('image/png');
}
// ICO header: 6 bytes, then 16 per image, then the PNG payloads. Width/height 0 would mean 256; every size here is below that.
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({size, png}, i) => {
    const e = 6 + 16 * i;
    head[e] = size; head[e + 1] = size; head[e + 2] = 0; head[e + 3] = 0;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map(i => i.png)]);
}
(async () => {
  const config = JSON.parse(fs.readFileSync(path.join(app, 'app.json')));
  // ICON_SOURCE (a path under the app repo) overrides app.json while a new store icon is out before the app adopts it.
  const sourceRel = process.env.ICON_SOURCE || config.expo.icon;
  const source = path.resolve(app, sourceRel), bytes = fs.readFileSync(source);
  const image = await loadImage(bytes);
  if (image.width !== image.height) throw new Error('The configured app icon must be square');
  const docs = path.resolve(__dirname, '../docs'), output = path.join(docs, 'assets'), icons = path.join(output, 'icons');
  fs.mkdirSync(icons, {recursive: true});
  // [relative path under docs/, size, rounded, role]
  const jobs = [
    ['assets/icons/icon-48.png', 48, true, 'link rel=icon 48'],
    ['assets/icons/icon-96.png', 96, true, 'link rel=icon 96'],
    ['assets/icons/icon-192.png', 192, true, 'link rel=icon 192'],
    ['assets/icons/app-icon-56.png', 56, true, 'wordmark in header and footer (shown at 28 px)'],
    ['assets/icons/app-icon-512.png', 512, true, 'JSON-LD image and logo'],
    ['assets/icons/apple-touch-icon-180.png', 180, false, 'apple-touch-icon: opaque full-bleed square'],
  ];
  const outputs = [];
  for (const [rel, size, rounded, role] of jobs) {
    const png = draw(image, size, rounded);
    fs.writeFileSync(path.join(docs, rel), png);
    outputs.push({file: rel.replace(/^assets\//, ''), size, cornerRadius: rounded ? +(size * RADIUS).toFixed(2) : 0, opaque: !rounded, role, bytes: png.length, sha256: sha(png)});
    if (rel === 'assets/icons/apple-touch-icon-180.png') {
      fs.writeFileSync(path.join(docs, 'apple-touch-icon.png'), png);
      outputs.push({file: '../apple-touch-icon.png', size, cornerRadius: 0, opaque: true, role: 'root copy of apple-touch-icon-180', bytes: png.length, sha256: sha(png)});
    }
  }
  const sizes = [16, 32, 48], pngs = sizes.map(size => ({size, png: draw(image, size, true)})), icon = ico(pngs);
  fs.writeFileSync(path.join(docs, 'favicon.ico'), icon);
  outputs.push({file: '../favicon.ico', size: sizes, cornerRadius: +RADIUS, opaque: false, role: 'PNG-in-ICO 16/32/48', bytes: icon.length, sha256: sha(icon)});
  fs.writeFileSync(path.join(output, 'app-icon-source.json'), JSON.stringify({source: sourceRel, sourceSha256: sha(bytes), sourceSize: image.width, outputs}, null, 2) + '\n');
  console.log('PASS browser icons exported from ' + sourceRel + ': ' + outputs.map(o => o.file + ' ' + o.bytes + ' B').join(', '));
})().catch(error => {console.error(error); process.exitCode = 1;});
