const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('docs/assets/v4/hero.js','utf8');
const body=source.match(/function sceneAt\(value\)\{return (.*?);\}/)[1];
const sceneAt=vm.runInNewContext(`const clamp=v=>Math.max(0,Math.min(1,v));const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};value=>(${body})`);
for(const p of [.17,.23,.29]){const s=sceneAt(p);assert.equal(s.launch,1);assert.equal(s.expand,0);assert.equal(s.dusk,0);}
for(const p of [.50,.54,.58]){assert.equal(sceneAt(p).expand,1);assert.equal(sceneAt(p).dusk,0);}
for(const p of [.68,.72,.77]){assert.equal(sceneAt(p).dusk,1);assert.equal(sceneAt(p).night,0);assert.equal(sceneAt(p).lamp,0);}
for(const p of [.95,.97,1]){assert.equal(sceneAt(p).night,1);assert.equal(sceneAt(p).lamp,1);}
assert(sceneAt(.63).dusk>0&&sceneAt(.63).dusk<1);
assert(sceneAt(.83).night>0&&sceneAt(.83).night<1);
for(const key of ['launch','expand','dusk','night','lamp']){let previous=0;for(let n=0;n<=100;n++){const current=sceneAt(n/100)[key];assert(current>=previous&&current<=1);previous=current;}}
// Exercise the actual compositing routine, including reverse scroll and fast jumps.
const context={clearRect(){},save(){},restore(){},drawImage(){}};
const calls=[];
const state={world:{width:1600},wc:context,ac:context,animal:{},clock:0,paused:false,reduced:false,launch:0,
  room:{draw(ctx,options){calls.push([options.tod,options.lightOn]);}},pet:{draw(){}},
  lightLayers:[{tod:0,lightOn:false},{tod:1,lightOn:false},{tod:2,lightOn:false},{tod:2,lightOn:true}].map(x=>({...x,ctx:{},canvas:{}}))};
vm.createContext(state);
vm.runInContext(source.slice(source.indexOf(' function drawWorld(dt)'),source.indexOf(' function expansion()')),state);
for(const [p,expected] of [[.54,[[0,false]]],[.72,[[1,false]]],[.97,[[2,true]]],[.72,[[1,false]]],[0,[[0,false]]]]){
  Object.assign(state,{dusk:sceneAt(p).dusk,night:sceneAt(p).night,lamp:sceneAt(p).lamp});calls.length=0;state.drawWorld(0);
  assert.deepEqual(calls,expected,`native rendering at scroll ${p}`);
}
console.log('PASS hero phone/day/sunset/night holds, native time rendering and reverse/fast scroll');
