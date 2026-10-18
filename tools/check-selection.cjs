/* Regression checks against the native selection contract and rounded icon exports. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const docs=path.resolve(__dirname,'../docs');
const s={};s.window=s;vm.createContext(s);
for(const file of ['selection-spec.js','selection-motion.js'])vm.runInContext(fs.readFileSync(path.join(docs,'assets/ui',file),'utf8'),s);
const spec=s.MARSelectionSpec,m=s.MARSelectionMotion.createMotion();
assert.deepEqual(JSON.parse(JSON.stringify(spec.spring)),{mass:1,stiffness:484,damping:36.52,energyThreshold:1e-7});
assert.equal(spec.opacityMs,110);assert.equal(spec.padding.x,10);assert.equal(spec.padding.y,5);
let state=m.set([10,20,60,33]);assert.equal(state.alpha,0);assert.deepEqual([...state.frame],[10,20,60,33]);
assert.equal(m.tick(55).alpha,.5);assert.equal(m.tick(55).alpha,1);
m.set([120,20,94,33]);state=m.tick(16);assert(state.frame[0]>10&&state.frame[0]<120);assert.equal(state.alpha,1);
for(let n=0;n<100;n++)state=m.tick(16);
assert.equal(state.active,false);assert.deepEqual([...state.frame],[120,20,94,33]);
m.set(null);assert.equal(m.tick(55).alpha,.5);assert.equal(m.tick(55).alpha,0);
state=m.set([4,50,130,40]);assert.deepEqual([...state.frame],[4,50,130,40],'new appearance starts at its label rather than sweeping across the page');
state=m.set([240,50,64,33],false);assert.equal(state.active,false);assert.equal(state.alpha,1);assert.deepEqual([...state.frame],[240,50,64,33]);
assert(spec.path(state.frame).includes('C'),'native curve, not rectangle');
const {loadImage,createCanvas}=require('/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
(async()=>{
 for(const size of [32,180]){
  const icon=await loadImage(path.join(docs,'assets',size===32?'favicon-32.png':'app-icon-180.png'));
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');ctx.drawImage(icon,0,0);
  assert.equal(ctx.getImageData(0,0,1,1).data[3],0);assert.equal(ctx.getImageData(size/2,size/2,1,1).data[3],255);
 }
 console.log('PASS native padded label/first appearance/110ms fade/spring/hidden reset/reduced motion and transparent rounded favicons');
})().catch(e=>{console.error(e);process.exitCode=1;});
