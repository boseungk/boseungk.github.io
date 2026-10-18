import {flowerArt} from './growth-motion/art-flower.mjs';
import {flowerPhase, flowerPosition, flowerTrackPose, prepareFlowerTransitions} from './growth-motion/onboarding-flower-motion.mjs';

const pathData = part => part.ops.map(op => op.join(' ')).join(' ');
function svg(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function paint(part) {
  const node = part.type === 'ellipse'
    ? svg('ellipse', {cx:part.cx,cy:part.cy,rx:part.rx,ry:part.ry}) : svg('path', {d:pathData(part)});
  for (const [key, value] of Object.entries({fill:part.fill ?? 'none', 'fill-opacity':part.fillAlpha,
    stroke:part.stroke ?? 'none','stroke-width':part.strokeWidth,'stroke-opacity':part.strokeAlpha,
    'stroke-linecap':'round','stroke-linejoin':'round'})) node.setAttribute(key, String(value));
  return node;
}
function sampleStem(part) {
  const node = paint(part), length = node.getTotalLength();
  return Array.from({length:65}, (_, i) => {const p = node.getPointAtLength(length*i/64);return [p.x,p.y];});
}

/** SVG counterpart of onboarding-flower-drawing.ts. Native code owns every pose
 * and timing value; only Skia path painting and viewport framing are adapted. */
export function createFlowerScene() {
  const scene = svg('svg', {viewBox:'25 8 210 205','aria-hidden':'true',focusable:'false'});
  const plans = prepareFlowerTransitions();
  const exact = flowerArt.map(parts => {const group = svg('g');parts.forEach(p=>group.append(paint(p)));scene.append(group);return group;});
  const transitions = plans.map((plan,index) => {
    const group = svg('g'), before = flowerArt[index], after = flowerArt[index+1];
    const stem = index>0 && index<3 ? {a:sampleStem(before[9]),b:sampleStem(after[9])} : null;
    const nodes = after.map((part,i) => {
      const owner = svg('g'), node = paint(part);owner.append(node);group.append(owner);
      return {owner,node,track:plan.tracks.find(t=>t.indices.includes(i))};
    });
    const old = plan.oldIndices.filter(i=>!stem || i!==9).map(i => {
      const owner = svg('g');owner.append(paint(before[i]));group.append(owner);
      const previous = plan.old.find(n=>n.indices.includes(i));
      return {owner,previous,next:plan.tracks.find(t=>t.id===previous.id)};
    });
    scene.append(group);return {group,before,after,stem,nodes,old};
  });
  function draw(elapsed, reduced = false) {
    const {transition:index,progress:p} = flowerPosition(elapsed,reduced);
    exact.forEach((group,i)=>group.style.display=(p===0&&i===index)||(p===1&&i===index+1)?'':'none');
    transitions.forEach((t,i)=>t.group.style.display=p>0&&p<1&&i===index?'':'none');
    if(p===0||p===1)return {transition:index,progress:p};
    const plan=plans[index],t=transitions[index],stemProgress=flowerPhase(p,.09,.39);
    t.nodes.forEach(({owner,node,track},i)=>{
      if(!track)return; // Pot and shadow remain fixed and fully opaque.
      if(t.stem && i===9){
        const a=t.before[9],b=t.after[9];
        node.setAttribute('d',stemProgress===0?pathData(a):stemProgress===1?pathData(b):t.stem.a.map(([x,y],n)=>`${n?'L':'M'}${x+(t.stem.b[n][0]-x)*stemProgress} ${y+(t.stem.b[n][1]-y)*stemProgress}`).join(' '));
        const rgb=[1,3,5].map(offset=>{const ca=parseInt(a.stroke.slice(offset,offset+2),16),cb=parseInt(b.stroke.slice(offset,offset+2),16);return Math.round(ca+(cb-ca)*stemProgress);});
        node.setAttribute('stroke',`rgb(${rgb.join(',')})`);
        node.setAttribute('stroke-width',String(a.strokeWidth+(b.strokeWidth-a.strokeWidth)*stemProgress));
        return;
      }
      const pose=flowerTrackPose(track,plan,p),[x,y]=pose.anchor;
      owner.setAttribute('opacity',String(pose.opacity));
      owner.setAttribute('transform',`translate(${x} ${y}) rotate(${pose.rotation}) scale(${pose.sx} ${pose.sy}) translate(${-x} ${-y})`);
    });
    const oldOpacity=1-flowerPhase(p,index===0?.12:plan.replacement?.48:.18,.2);
    for(const {owner,previous,next} of t.old){
      owner.setAttribute('opacity',String(oldOpacity));
      if(t.stem&&next)owner.setAttribute('transform',`translate(${(next.anchor[0]-previous.anchor[0])*stemProgress} ${(next.anchor[1]-previous.anchor[1])*stemProgress})`);
    }
    return {transition:index,progress:p};
  }
  return {scene,draw};
}
