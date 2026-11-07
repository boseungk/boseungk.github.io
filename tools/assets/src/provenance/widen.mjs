// node widen.mjs <src.png> <out> <outWidth> [fmt=webp|png] [q]
import {createRequire} from 'node:module'; import fs from 'node:fs';
const require = createRequire('/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const {createCanvas, loadImage} = require('@napi-rs/canvas');
const [src, out, ow, fmt = 'webp', q = '92'] = process.argv.slice(2);
const im = await loadImage(src); const W = im.width, H = im.height, OW = +ow, pad = Math.round((OW - W) / 2);
const s = createCanvas(W, H); const sx = s.getContext('2d'); sx.drawImage(im, 0, 0); const d = sx.getImageData(0, 0, W, H).data;
const c = createCanvas(OW, H); const x = c.getContext('2d');
const L = x.createImageData(pad, H), R = x.createImageData(OW - W - pad, H);
for (let y = 0; y < H; y++) {
  for (const [img, w, x0] of [[L, pad, 2], [R, OW - W - pad, W - 3]]) {
    const avg = [0, 0, 0, 0]; for (let k = 0; k < 2; k++) { const i = (y * W + x0 + (x0 > 2 ? k : -k)) * 4; for (let ch = 0; ch < 4; ch++) avg[ch] += d[i + ch] / 2; }
    for (let xx = 0; xx < w; xx++) { const o = (y * w + xx) * 4; for (let ch = 0; ch < 4; ch++) img.data[o + ch] = avg[ch]; }
  }
}
x.putImageData(L, 0, 0); x.putImageData(R, pad + W, 0); x.drawImage(im, pad, 0);
const buf = fmt === 'png' ? c.toBuffer('image/png') : c.toBuffer('image/webp', +q);
fs.writeFileSync(out, buf); console.log(out, OW + 'x' + H, (buf.length / 1024).toFixed(0) + 'KB');
