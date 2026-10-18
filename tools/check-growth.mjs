import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createGrowthClock} from '../docs/assets/v5/growth-clock.mjs';
import {flowerArt} from '../docs/assets/v5/growth-motion/art-flower.mjs';
import {FLOWER_DURATION_MS,flowerPosition,prepareFlowerTransitions,flowerTrackPose} from '../docs/assets/v5/growth-motion/onboarding-flower-motion.mjs';

const require=createRequire(import.meta.url);
const {app,native}=require('./native-renderer.cjs');
const original=native(app+'/src/features/onboarding/scene/onboarding-flower-motion.ts');
const plain=value=>JSON.parse(JSON.stringify(value));

test('exported timeline and all track poses match production source at every 50ms',()=>{
  const plans=prepareFlowerTransitions(),source=original.prepareFlowerTransitions();
  assert.deepEqual(plain(plans),plain(source));
  for(let time=0;time<=12000;time+=50){
    const position=flowerPosition(time);
    assert.deepEqual(position,plain(original.flowerPosition(time)));
    const plan=plans[position.transition];
    for(let i=0;i<plan.tracks.length;i++)assert.deepEqual(
      plain(flowerTrackPose(plan.tracks[i],plan,position.progress)),
      plain(original.flowerTrackPose(source[position.transition].tracks[i],source[position.transition],position.progress)));
  }
  assert.deepEqual(flowerPosition(599),{transition:0,progress:0});
  assert.deepEqual(flowerPosition(3299),{transition:0,progress:1});
  assert.deepEqual(flowerPosition(3300),{transition:1,progress:0});
  assert.deepEqual(flowerPosition(99999),{transition:3,progress:1});
  for(const entry of JSON.parse(readFileSync(new URL('../architecture/native-growth-sources.json',import.meta.url)))){
    assert.equal(createHash('sha256').update(readFileSync(app+'/'+entry.source)).digest('hex'),entry.sourceSha256);
  }
});

test('visibility, tab background and global pause preserve time; completion never resets',()=>{
  const clock=createGrowthClock();
  assert.equal(clock.running,false);clock.tick(5000);assert.equal(clock.elapsed,0);
  clock.set({visible:true});clock.tick(5000);clock.tick(6800);assert.equal(clock.elapsed,1800);
  for(const state of ['visible','hidden','paused']){
    clock.set({[state]:state!=='visible'});assert.equal(clock.running,false);
    clock.tick(50000);assert.equal(clock.elapsed,1800);
    clock.set({[state]:state==='visible'});clock.tick(60000);assert.equal(clock.elapsed,1800);
  }
  clock.tick(69300);assert.equal(clock.elapsed,FLOWER_DURATION_MS);assert.equal(clock.running,false);
  clock.set({visible:false});clock.set({visible:true});clock.tick(999999);assert.equal(clock.elapsed,FLOWER_DURATION_MS);
});

test('reduced motion selects the final flower without changing global pause',()=>{
  const clock=createGrowthClock();clock.set({visible:true,paused:true,reduced:true});
  assert.equal(clock.elapsed,FLOWER_DURATION_MS);assert.equal(clock.running,false);
  clock.set({reduced:false});assert.equal(clock.running,false);assert.equal(clock.elapsed,0);
  clock.set({paused:false});assert.equal(clock.running,true);
});

// A minimal SVG fixture exercises the real DOM adapter, not an alternate renderer.
class Element {
  constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.style={};}
  setAttribute(k,v){this.attrs[k]=v;}
  append(n){this.children.push(n);}
  getTotalLength(){return 64;}
  getPointAtLength(t){return {x:130,y:155-t};}
}
globalThis.document={createElementNS:(_,tag)=>new Element(tag)};
const {createFlowerScene}=await import('../docs/assets/v5/growth-flower.mjs');
const visible=scene=>scene.children.filter(g=>g.style.display!=='none');
const signature=node=>JSON.stringify([node.tag,node.attrs,node.children.map(signature)]);

test('SVG adapter keeps pot fixed, preserves all exact stage artwork and retains bloom attachments',()=>{
  const {scene,draw}=createFlowerScene();
  const exact=scene.children.slice(0,5);
  for(const [stage,time] of [0,3000,5700,8400,11100].entries()){
    draw(time);assert.deepEqual(visible(scene),[exact[stage]]);
    assert.equal(exact[stage].children.length,flowerArt[stage].length);
  }
  draw(0,true);assert.deepEqual(visible(scene),[exact[4]]);
  const pot=exact[0].children.slice(0,9).map(signature);
  for(const start of [600,3300,6000,8700]){
    for(const delta of [240,720,1200,1920,2376]){
      const position=draw(start+delta),[group]=visible(scene);assert.equal(visible(scene).length,1);
      assert.deepEqual(group.children.slice(0,9).map(n=>signature(n.children[0])),pot);
      assert(group.children.slice(0,9).every(n=>!('transform'in n.attrs)&&!('opacity'in n.attrs)));
      const after=flowerArt[position.transition+1];
      for(const node of group.children.slice(0,after.length)){
        assert(!JSON.stringify(node.attrs).includes('NaN'));
        if('opacity'in node.attrs)assert(Number(node.attrs.opacity)>=0&&Number(node.attrs.opacity)<=1);
      }
      if(position.transition===3){
        // Production bloom keeps the existing stem/foliage at full opacity.
        for(let i=9;i<16;i++)assert.equal(group.children[i].attrs.opacity,'1');
      }
    }
  }
});
