import { paint, svg } from './growth-reveal-paths.mjs';
import { plantTransitionPlan } from './growth-reveal-plant-structure.mjs';
import { prepareStem, drawStem } from './growth-reveal-stem-motion.mjs';

const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{const t=clamp(n);return t*t*(3-2*t);};
const phase=(p,start,span)=>p===1?1:ease((p-start)/span);
const transform=([x,y],sx,sy,rotation=0)=>`translate(${x} ${y}) rotate(${rotation}) scale(${sx} ${sy}) translate(${-x} ${-y})`;
function top(parts,indices) {
  let minimum=155;
  for(const index of indices){const part=parts[index];if(part.type==='ellipse')minimum=Math.min(minimum,part.cy-part.ry);
    else for(const op of part.ops)for(let i=2;i<op.length;i+=2)minimum=Math.min(minimum,op[i]);}
  return minimum;
}

export function createPlantTransition(scene,before,after,study) {
  scene.replaceChildren();const plan=plantTransitionPlan(before,after,study),nodes=[],live=svg('g');scene.append(live);
  const owner=new Map(plan.tracks.flatMap(track=>track.indices.map(index=>[index,track])));
  const rigidReplacement=plan.replacement&&['cactus','succulent'].includes(study.kind);
  const stem=study.kind==='flower'&&study.from>0&&study.to<4?prepareStem(before[9],after[9]):null;
  const oldSupport=plan.old.nodes.filter(node=>node.role==='wood'||node.role==='body').flatMap(node=>node.indices);
  const newSupport=plan.next.nodes.filter(node=>node.role==='wood'||node.role==='body').flatMap(node=>node.indices);
  const startScale=study.from===0?.035:Math.max(.18,Math.min(.95,(155-top(before,oldSupport.length?oldSupport:plan.old.nodes.flatMap(node=>node.indices)))/(155-top(after,newSupport.length?newSupport:plan.next.nodes.flatMap(node=>node.indices)))));
  after.forEach((part,index)=>{
    const track=owner.get(index),group=svg('g'),node=paint(part);group.append(node);live.append(group);
    if(track)nodes.push({group,node,track,isStem:!!stem&&index===9});
  });
  const retained=new Set(plan.next.nodes.filter(node=>plan.old.nodes.some(old=>old.signature===node.signature)).map(node=>node.signature));
  const oldIndices=new Set(plan.old.nodes.filter(node=>plan.replacement||!retained.has(node.signature)).flatMap(node=>node.indices));
  const oldGroup=svg('g'),movingLeaves=[];
  const oldOwner=new Map(plan.old.nodes.flatMap(node=>node.indices.map(i=>[i,node])));
  before.forEach((part,index)=>{
    if(!oldIndices.has(index)||(stem&&index===9))return;
    const group=svg('g');group.append(paint(part));oldGroup.append(group);
    if(stem){const old=oldOwner.get(index),next=plan.next.nodes.find(node=>node.id===old.id);if(next)movingLeaves.push({group,dx:next.anchor[0]-old.anchor[0],dy:next.anchor[1]-old.anchor[1]});}
  });live.append(oldGroup);
  const fixedOld=svg('g');before.forEach((part,index)=>fixedOld.append(paint(part)));
  const exactAfter=svg('g');after.forEach(part=>exactAfter.append(paint(part)));scene.append(fixedOld,exactAfter);
  function seek(position) {
    const p=clamp(position);live.style.display=p===0||p===1?'none':'';fixedOld.style.display=p===0?'':'none';exactAfter.style.display=p===1?'':'none';
    // Entire prior plant stays attached while the new support grows into place.
    const oldExit=study.from===0?.12:plan.replacement?(rigidReplacement?.25:.48):.18;
    oldGroup.setAttribute('opacity',String(p===0||p===1?0:1-phase(p,oldExit,.2)));
    const stemProgress=phase(p,.09,plan.supportEnd-.09);
    for(const leaf of movingLeaves)leaf.group.setAttribute('transform',`translate(${leaf.dx*stemProgress} ${leaf.dy*stemProgress})`);
    for(const {group,node,track,isStem}of nodes) {
      if(p===0||p===1){group.setAttribute('opacity','0');continue;}
      if(isStem){group.setAttribute('opacity','1');drawStem(node,stem,stemProgress);continue;}
      if(stem&&track.role==='wood'){
        const growth=phase(p,plan.supportEnd,.18);group.setAttribute('opacity',String(clamp(growth*4)));
        group.setAttribute('transform',transform(track.anchor,1,Math.max(.001,growth)));continue;
      }
      if(plan.replacement&&(rigidReplacement||track.role==='wood')) {
        const growth=phase(p,.09,plan.supportEnd-.09),sy=startScale+(1-startScale)*growth;
        group.setAttribute('opacity',String(phase(p,.04,.14)));
        group.setAttribute('transform',transform([130,155],.8+.2*growth,sy));continue;
      }
      if(track.common) {
        group.setAttribute('opacity',String(plan.replacement?phase(p,plan.supportEnd,.1):1));group.removeAttribute('transform');continue;
      }
      const support=track.role==='wood';
      const growth=phase(p,support?.08:track.delay,support?plan.supportEnd-.08:track.span);
      group.setAttribute('opacity',String(clamp(growth*4)));
      if(track.role==='surface'){group.removeAttribute('transform');continue;}
      const scale=Math.max(.001,growth),rotation=track.role==='wood'||track.role==='branch'?0:(track.anchor[0]<132?-1:1)*10*(1-growth);
      group.setAttribute('transform',transform(track.anchor,.35+.65*scale,scale,rotation));
    }
  }
  return {seek,plan};
}
