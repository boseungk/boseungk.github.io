const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('docs/assets/v4/hero.js','utf8');
const body=source.match(/function sceneAt\(value\)\{return (.*?);\}/)[1];
const sceneAt=vm.runInNewContext(`const clamp=v=>Math.max(0,Math.min(1,v));const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};value=>(${body})`);
for(const p of [.22,.28,.36]){const s=sceneAt(p);assert.equal(s.launch,1);assert.equal(s.expand,0);assert.equal(s.dusk,0);}
for(const p of [.65,.69,.72]){assert.equal(sceneAt(p).expand,1);assert.equal(sceneAt(p).dusk,0);}
for(const p of [.89,.95,1])assert.equal(sceneAt(p).dusk,1);
assert(sceneAt(.8).dusk>0&&sceneAt(.8).dusk<1);
for(const key of ['launch','expand','dusk']){let previous=0;for(let n=0;n<=100;n++){const current=sceneAt(n/100)[key];assert(current>=previous&&current<=1);previous=current;}}
assert.equal(sceneAt(0).launch,0);assert.equal(sceneAt(0).dusk,0);
console.log('PASS hero phone/day/night viewing plateaus, monotonic transitions and return-to-top reset');
