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
// selection.js in a DOM fixture: [data-choice-group] mounts once, MARSelection.mount returns the group's refresh,
// aria-checked moves the wash on the spring, and a paused page (mar:motion) settles with no animation frame.
(()=>{
 class T{constructor(){this.l={};}addEventListener(n,f){(this.l[n]??=[]).push(f);}removeEventListener(n,f){this.l[n]=(this.l[n]??[]).filter(x=>x!==f);}emit(n,d={}){(this.l[n]??[]).forEach(f=>f(d));}}
 class El extends T{
  constructor(tag='div',rect=[0,0,0,0]){super();this.tagName=tag.toUpperCase();this.attrs={};this.dataset={};this.kids=[];this.parent=null;this.style={};this.classSet=new Set();
   this.classList={add:(...k)=>k.forEach(x=>this.classSet.add(x)),contains:k=>this.classSet.has(k)};this.box=rect;this.clientWidth=rect[2];this.clientHeight=rect[3];this.scrollLeft=0;this.scrollTop=0;}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
  remove(){if(this.parent)this.parent.kids=this.parent.kids.filter(k=>k!==this);this.parent=null;}
  append(...n){n.forEach(c=>{c.parent=this;this.kids.push(c);});}prepend(c){c.parent=this;this.kids.unshift(c);}
  get childNodes(){return this.kids;}
  all(){return this.kids.flatMap(k=>k instanceof El?[k,...k.all()]:[]);}
  matches(sel){return sel.split(',').some(one=>{one=one.trim();const m=one.match(/^\[([\w-]+)(?:=([\w-]+))?\]$/);if(m)return m[2]?this.getAttribute(m[1])===m[2]:this.getAttribute(m[1])!==null||m[1].replace(/^data-/,'').replace(/-(\w)/g,(_,c)=>c.toUpperCase()) in this.dataset;if(one.startsWith('.'))return this.classSet.has(one.slice(1));return this.tagName===one.toUpperCase();});}
  querySelectorAll(sel){return this.all().filter(e=>e.matches(sel));}querySelector(sel){return this.querySelectorAll(sel)[0]??null;}
  closest(sel){let e=this;while(e){if(e instanceof El&&e.matches(sel))return e;e=e.parent;}return null;}
  contains(x){return x===this||this.kids.some(k=>k===x||k.contains?.(x));}
  getBoundingClientRect(){const [x,y,w,h]=this.box;return {left:x,top:y,width:w,height:h,right:x+w,bottom:y+h};}
 }
 const group=new El('div',[0,0,300,40]);group.setAttribute('data-choice-group','');
 const items=[0,1,2].map(i=>{const b=new El('button',[i*100,0,90,40]);b.setAttribute('role','radio');b.setAttribute('data-choice','');b.setAttribute('aria-checked',String(i===1));const l=new El('span',[i*100+10,5,60,30]);l.classList.add('mar-choice-label');b.append(l);return b;});
 group.append(...items);
 const frames=[],observers=[],watchers=[],cancelled=[],media=new T();media.matches=false;
 const doc=new T();doc.hidden=false;doc.activeElement=null;doc.documentElement={style:{setProperty(){}}};doc.fonts={ready:{then(){}}};
 doc.querySelectorAll=sel=>sel==='[data-choice-group]'?[group]:[];doc.createElement=t=>new El(t);doc.createElementNS=(ns,t)=>new El(t);
 const ctx={document:doc,matchMedia:()=>media,queueMicrotask:f=>f(),performance:{now:()=>0},
  requestAnimationFrame:f=>{frames.push(f);return frames.length;},cancelAnimationFrame(id){cancelled.push(id);},
  MutationObserver:class{constructor(f){observers.push(f);watchers.push(this);}observe(){this.on=true;}disconnect(){this.on=false;}},ResizeObserver:class{constructor(){watchers.push(this);}observe(){this.on=true;}disconnect(){this.on=false;}},MARSelectionSpec:spec,MARSelectionMotion:s.MARSelectionMotion};
 const win=new T();ctx.addEventListener=win.addEventListener.bind(win);ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(docs,'assets/ui/selection.js'),'utf8'),ctx);
 const washes=()=>group.kids.filter(k=>k.classSet.has('mar-choice-wash'));
 const d=()=>washes()[0].kids[0].getAttribute('d'),x0=()=>Number(d().match(/^M([\d.]+)/)[1]);
 assert.equal(washes().length,1,'declarative group mounts');assert(group.classList.contains('mar-choice-group'));
 const at=i=>spec.path([i*100+10,5,60,30]);
 assert.equal(d(),at(1),'first appearance is at the selected label');assert(frames.length>0,'fade-in runs on animation frames');
 const refresh=ctx.MARSelection.mount(group,items);assert.equal(typeof refresh,'function');
 ctx.MARSelection.scan();assert.equal(washes().length,1,'a second mount or scan does not add a wash');
 assert.equal(ctx.MARSelection.mount(group,items),refresh,'mount returns the same refresh for a mounted group');
 const run=n=>{for(let t=16;n--;t+=16){const f=frames.splice(0);f.forEach(fn=>fn(t));}};
 run(20);items[1].setAttribute('aria-checked','false');items[2].setAttribute('aria-checked','true');observers.forEach(f=>f());
 run(3);assert(x0()>at(1).match(/^M([\d.]+)/)[1]*1&&x0()<at(2).match(/^M([\d.]+)/)[1]*1,'aria-checked moves the wash on the spring');
 run(80);assert.equal(d(),at(2),'the spring settles on the new label');
 win.emit('mar:motion',{detail:{paused:true}});frames.length=0;
 items[2].setAttribute('aria-checked','false');items[0].setAttribute('aria-checked','true');observers.forEach(f=>f());
 assert.equal(frames.length,0,'paused page: no animation frame');assert.equal(d(),at(0),'paused page: the wash settles at once');
 assert.equal(washes()[0].style.opacity,'1');
// destroy(): observers disconnected, listeners removed, wash removed, no frame left, and the group can be mounted again
 const count=()=>[group,...items].reduce((n,e)=>n+Object.values(e.l).flat().length,0);
 assert(count()>0&&watchers.every(w=>w.on),'a mounted group listens and observes');
 win.emit('mar:motion',{detail:{paused:false}});items[0].setAttribute('aria-checked','false');items[1].setAttribute('aria-checked','true');observers.forEach(f=>f());
 assert(frames.length>0,'a pending animation frame exists before destroy');cancelled.length=0;
 assert.equal(typeof refresh.destroy,'function');assert.equal(typeof ctx.MARSelection.destroy,'function');
 refresh.destroy();
 assert.equal(washes().length,0,'destroy removes the wash');assert.equal(count(),0,'destroy removes every listener');
 assert(watchers.every(w=>!w.on),'destroy disconnects the mutation and resize observers');assert(cancelled.length>0,'destroy cancels the pending frame');
 frames.length=0;observers.forEach(f=>f());frames.forEach(f=>f(16));win.emit('mar:motion',{detail:{paused:true}});
 assert.equal(washes().length,0,'a destroyed controller stays inert');refresh.destroy();ctx.MARSelection.destroy(group);
 const again=ctx.MARSelection.mount(group,items);assert.notEqual(again,refresh,'a destroyed group mounts anew');assert.equal(washes().length,1,'the remounted group has one wash');
 ctx.MARSelection.destroy(group);assert.equal(washes().length,0,'MARSelection.destroy(group) unmounts');
})();
const {loadImage,createCanvas}=require('/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
(async()=>{
 for(const size of [48,96,192]){
  const icon=await loadImage(path.join(docs,'assets/icons',`icon-${size}.png`));
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');ctx.drawImage(icon,0,0);
  assert.equal(ctx.getImageData(0,0,1,1).data[3],0);assert.equal(ctx.getImageData(size/2,size/2,1,1).data[3],255);
 }
 console.log('PASS native padded label/first appearance/110ms fade/spring/hidden reset/reduced motion, MARSelection mount/scan/aria-checked/paused settle/destroy and transparent rounded favicons');
})().catch(e=>{console.error(e);process.exitCode=1;});
