/* Regression for napi-rs addPath connecting separate SVG contours. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {app, native, createCanvas} = require('./native-renderer.cjs');
const {Skia, canvasFor} = native(path.join(app, 'design/prototype-editorial/lab/drawn-web/skia-canvas2d.js'));
const canvas = createCanvas(100, 100), ctx = canvas.getContext('2d'), g = canvasFor(ctx);
const paint = Skia.Paint(); paint.setColor('#000000');
const first = Skia.Path.MakeFromSVGString('M10 10H30V30H10Z');
const second = Skia.Path.MakeFromSVGString('M60 60H80V80H60Z');
const shape = Skia.PathBuilder.Make().addPath(first).addPath(second).build();
g.begin(); g.drawPath(shape, paint);
assert.equal(ctx.getImageData(20, 20, 1, 1).data[3], 255);
assert.equal(ctx.getImageData(70, 70, 1, 1).data[3], 255);
assert.equal(ctx.getImageData(45, 45, 1, 1).data[3], 0, 'independent contours must not grow a joining triangle');
const transformed = first.transform([1, 0, 30, 0, 1, 0, 0, 0, 1]);
ctx.clearRect(0, 0, 100, 100); g.drawPath(transformed, paint);
assert.equal(ctx.getImageData(50, 20, 1, 1).data[3], 255, 'retain transformed path support');
assert.equal(ctx.getImageData(20, 20, 1, 1).data[3], 0);
console.log('PASS separate native SVG contours and transformed paths');
