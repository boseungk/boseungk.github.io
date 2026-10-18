/* Export the configured app icon at browser sizes, without cropping or redrawing. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const app = process.env.DAYLOOM_SOURCE || '/Users/gpt/Projects/dayloom';
const modules = process.env.NATIVE_NODE_MODULES || '/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {createCanvas, loadImage} = require(path.join(modules, '@napi-rs/canvas'));
(async () => {
  const config = JSON.parse(fs.readFileSync(path.join(app, 'app.json')));
  const source = path.resolve(app, config.expo.icon), bytes = fs.readFileSync(source);
  const image = await loadImage(bytes);
  if (image.width !== image.height) throw new Error('The configured app icon must be square');
  const output = path.resolve(__dirname, '../docs/assets');
  const sizes = [[32, 'favicon-32.png'], [180, 'app-icon-180.png']];
  for (const [size, name] of sizes) {
    const canvas = createCanvas(size, size), ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, size, size);
    fs.writeFileSync(path.join(output, name), canvas.toBuffer('image/png'));
  }
  fs.writeFileSync(path.join(output, 'app-icon-source.json'), JSON.stringify({source: config.expo.icon, sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), sourceSize: image.width, outputs: sizes.map(([size, file]) => ({file, size}))}, null, 2) + '\n');
  console.log('PASS browser icons exported from ' + config.expo.icon);
})().catch(error => {console.error(error); process.exitCode = 1;});
