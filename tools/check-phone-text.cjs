/* Glyphs use browser text only after a live display mounts; canvas remains the fail-safe. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require('/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
class Element {
 constructor(){this.style={};this.children=[];this.attributes={};}
 append(child){this.children.push(child);child.parent=this;}
 setAttribute(key,value){this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key];}
 getComputedTextLength(){return this.textContent.length*Number(this.attributes['font-size'])*.6;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
const s={window:null,document:{createElement:()=>createCanvas(1,1),createElementNS:()=>new Element()}};s.window=s;vm.createContext(s);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../docs/assets/v4/screen.js'),'utf8'),s);
const screen=s.MARHeroScreen(),ctx=screen.canvas.getContext('2d'),fillText=ctx.fillText.bind(ctx);let glyphs=0;
ctx.fillText=(...args)=>{glyphs++;return fillText(...args);};
screen.draw({progress:0,hideGlyphs:true});assert.equal(glyphs,0,'font loading retains room/controls without fallback glyphs');assert.equal(ctx.getImageData(0,0,1,1).data[3],255);
screen.draw({progress:0});assert(glyphs>0,'unmounted fail-safe draws canvas glyphs');
const layer=screen.canvas.__marText,host=new Element();assert(layer,'screen exposes one text layer');layer.mount(host);layer.resize(300,642);glyphs=0;
screen.draw({progress:0});assert.equal(glyphs,0,'mounted layer omits actual canvas glyph calls');
const svg=host.children[0],caption=svg.children.find(n=>n.textContent==='오후 2:25에 마쳐요');assert(caption);assert(Number(caption.attributes['font-size'])>=11.5);
assert.equal(caption.attributes['font-family'],'Line, sans-serif');
assert(svg.children.some(n=>n.textContent==='집중할 시간'));
screen.draw({progress:1});assert(!svg.children.some(n=>n.textContent==='집중할 시간'),'no stale prep after HUD');assert(svg.children.some(n=>n.textContent==='길게 눌러 마치기'));
screen.draw({progress:0});assert(svg.children.some(n=>n.textContent==='집중할 시간'),'reverse seek restores prep');
layer.resize(0,0);assert.equal(svg.style.visibility,'hidden','zero-size display stays hidden');glyphs=0;screen.draw({progress:0});assert(glyphs>0,'zero-size display keeps canvas glyphs');layer.resize(280,599);screen.draw({progress:0});assert.equal(svg.style.visibility,'visible');
layer.begin();layer.text(ctx,'오후 2:09',108,1384,26,'#776b66','left',2);layer.text(ctx,'책 한 챕터 ✎',256,1384,30,'#5f5551','left',2,1,6);layer.end();
assert(Number(svg.children[1].attributes.x)>=Number(svg.children[0].attributes.x)+svg.children[0].getComputedTextLength()+6,'dense record row keeps a readable caption gap');
ctx.save();ctx.globalAlpha=.4;ctx.translate(0,40);layer.begin();layer.text(ctx,'fade',10,20,26,'#776b66','left',2);layer.end();ctx.restore();
assert(Math.abs(Number(svg.children[0].attributes.y)-60*599/1669)<.001,'canvas translation reaches browser baseline');assert(Math.abs(Number(svg.children[0].attributes.opacity)-.4)<.001,'canvas fade reaches browser glyph');
layer.destroy();glyphs=0;screen.draw({progress:0});assert(glyphs>0,'destroy restores canvas fail-safe');assert.equal(host.children.length,0);
console.log('PASS native text sizing/font, canvas omission/fail-safe, phase replacement, reverse seek, zero-size and lifecycle');

async function journeyCheck(mounted){
 const canvases=[],stage=new Element(),root={dataset:{},querySelector:()=>stage,querySelectorAll:()=>[],getBoundingClientRect:()=>({bottom:800})};
 let enter;
 const j={console,performance,Path2D:require('/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas').Path2D,
  ImageData:require('/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas').ImageData,
  document:{hidden:true,fonts:{ready:Promise.resolve()},addEventListener(){},removeEventListener(){},createElement(){const c=createCanvas(1,1),cc=c.getContext('2d'),fill=cc.fillText.bind(cc);c.glyphCalls=0;cc.fillText=(...args)=>{c.glyphCalls++;return fill(...args);};canvases.push(c);return c;},createElementNS:()=>new Element()},
  matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
  IntersectionObserver:class{constructor(cb){enter=cb;}observe(){}disconnect(){}},ResizeObserver:class{observe(){}disconnect(){}},
  addEventListener(){},removeEventListener(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){}};
 j.window=j;vm.createContext(j);
 for(const name of ['drawn-app.js','v3/native-landscape.js','v3/pet.js','v4/room.js','v4/screen.js','v5/journey.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../docs/assets',name),'utf8'),j);
 let source;
 j.MARHeroPhone=async(host,canvas)=>{source=canvas;if(!mounted)return null;canvas.__marText.mount(host);canvas.__marText.resize(243,520);return{render(){},resize(){},destroy(){canvas.__marText.destroy();}};};
 const api=j.MARJourney.mount(root);enter([{intersectionRatio:.8,isIntersecting:true,boundingClientRect:{bottom:800}}]);await new Promise(resolve=>setImmediate(resolve));
 assert(source,'journey painter initialized');
 for(const [progress,phase,label] of [[0,'running','길게 눌러 마치기'],[.3,'completion','집중을 마쳤어요'],[.53,'home',null],[.68,'index','기억'],[.95,'day','저장됨'],[0,'running','길게 눌러 마치기']]){
  canvases.forEach(c=>c.glyphCalls=0);api.seek(progress);assert.equal(root.dataset.journeyPhase,phase);
  if(mounted){
   assert.equal(canvases.reduce((sum,c)=>sum+c.glyphCalls,0),0,'shared screen and journey both omit canvas glyphs');
   const texts=stage.children[0].children.map(n=>n.textContent);assert.equal(texts.filter(t=>t==='9:41').length,1,'shared status produces no duplicate glyph');
   if(label)assert(texts.includes(label),phase+' browser glyphs');
   if(phase!=='completion')assert(!texts.includes('집중을 마쳤어요'),'no stale completion label');
  }else assert(source.glyphCalls>0,phase+' keeps canvas text on phone failure');
 }
 api.destroy();assert.equal(stage.children.length,0);
}
(async()=>{await journeyCheck(true);await journeyCheck(false);console.log('PASS journey running/completion/home/index/day/reverse text, shared glyph omission, single status and canvas fail-safe');})().catch(error=>{console.error(error);process.exitCode=1;});
