/* Native Dayloom composition export. Reads the app; writes only website assets. */
const fs = require('node:fs'), path = require('node:path');
const {app, native, createCanvas} = require('./native-renderer.cjs');
const skia=native(app+'/design/prototype-editorial/lab/drawn-web/skia-canvas2d.js');
const growth=native(app+'/src/world/drawn/growth/art.ts');
const prep=growth.createGrowthArtPreparation();
const out=path.resolve(__dirname,'../docs/assets/v5/growth');fs.mkdirSync(out,{recursive:true});
for(let stage=0;stage<5;stage++){const canvas=createCanvas(780,660),g=skia.canvasFor(canvas.getContext('2d'));g.begin();growth.drawGrowthArtFitted(g,prep.get('tree',stage),{x:70,y:45,width:640,height:560},undefined,true);fs.writeFileSync(path.join(out,`tree-${stage}.png`),canvas.toBuffer('image/png'));}
prep.dispose();console.log('Exported all five native tree stages with fixed future bounds.');
