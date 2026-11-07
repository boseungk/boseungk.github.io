/* Boots the app's own still renderer (read only use of Dayloom, via tools/native-renderer.cjs; set TYPESCRIPT_PATH when
   Dayloom has no node_modules). Used by render.cjs and names.cjs. */
const fs=require('node:fs');const {app,native,createCanvas,Path2D}=require('../native-renderer.cjs');
const rr0=Path2D.prototype.roundRect;Path2D.prototype.roundRect=function(x,y,w,h,r){const f=v=>Array.isArray(v)?v.map(f):(v&&typeof v==='object'?Math.min(v.x??0,v.y??0):v);return rr0.call(this,x,y,w,h,f(r));};
const skia=native(app+'/design/prototype-editorial/lab/drawn-web/skia-canvas2d.js');
skia.Skia.RuntimeEffect={Make:()=>null};
// napi-rs: putImageData writes nothing under a non-identity transform; the shim's layer filter relies on it.
// Same restore as skia-canvas2d.js, but the filter runs with an identity transform (browser semantics).
function applyLayerFilter(lay, filter) {
  const image = lay.ctx.getImageData(0, 0, lay.canvas.width, lay.canvas.height), d = image.data;
  if (filter.kind === 'matrix') { const m = filter.matrix;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      d[i] = r*m[0] + g*m[1] + b*m[2] + a*m[3] + 255*m[4]; d[i+1] = r*m[5] + g*m[6] + b*m[7] + a*m[8] + 255*m[9];
      d[i+2] = r*m[10] + g*m[11] + b*m[12] + a*m[13] + 255*m[14]; d[i+3] = r*m[15] + g*m[16] + b*m[17] + a*m[18] + 255*m[19]; }
  } else if (filter.kind === 'src-in') {
    for (let i = 0; i < d.length; i += 4) { d[i] = filter.color[0]; d[i+1] = filter.color[1]; d[i+2] = filter.color[2]; d[i+3] *= filter.color[3]; }
  } else throw new Error('unsupported color filter');
  lay.ctx.putImageData(image, 0, 0);
}
skia.Canvas.prototype.restore = function () {
  const top = this.stack.pop();
  if (top === undefined) return;
  if (top === null) { this.ctx.restore(); return; }
  const prev = top.prev;
  if (top.filter) { const lc = top.lay.ctx; lc.save(); lc.setTransform(1, 0, 0, 1, 0, 0); applyLayerFilter(top.lay, top.filter); lc.restore(); }
  prev.save(); prev.setTransform(1, 0, 0, 1, 0, 0);
  prev.globalAlpha = top.alpha; prev.globalCompositeOperation = top.blend;
  prev.drawImage(top.lay.canvas, 0, 0);
  prev.getImageData(0, 0, 1, 1);   // napi-rs defers drawImage(canvas); flush before this layer canvas is reused
  prev.restore();
  this.ctx = prev; this.depth--;
};
const api=native(app+'/design/prototype-editorial/lab/drawn-web/entry.js');
native(app+'/src/world/drawn/events/player.ts').prepareEvents=()=>[];
const rec=native(app+'/src/app-shell/collection/recommendation-room-recording.ts');
const RC=native(app+'/src/app-shell/collection/recommended-compositions.ts');
const pf=native(app+'/src/world/drawn/scene/product-frame.ts');
const {resolveScenerySeason}=native(app+'/src/world/drawn/room/scenery-season.ts');
const {createDrawnScenePreparation}=native(app+'/src/world/drawn/scene/preparation.ts');
const {DEFAULT_ROOM_LIGHT_PREFERENCES}=native(app+'/src/features/space/domain/room-light-preferences.ts');
const C=native(app+'/src/world/drawn/room/compose.ts');
const nl=native(app+'/src/world/drawn/room/night-lighting.ts');
module.exports={fs,app,native,createCanvas,skia,api,rec,RC,pf,resolveScenerySeason,createDrawnScenePreparation,DEFAULT_ROOM_LIGHT_PREFERENCES,C,nl};
