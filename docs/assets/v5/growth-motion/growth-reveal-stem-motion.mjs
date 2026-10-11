import { pathData, svg } from './growth-reveal-paths.mjs';

/** One continuous open stem, sampled from its fixed soil end toward its tip. */
export function prepareStem(before,after) {
  const sample=part=>{const path=svg('path',{d:pathData(part)}),length=path.getTotalLength();return Array.from({length:65},(_,i)=>{const p=path.getPointAtLength(length*i/64);return [p.x,p.y];});};
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  return {before,after,a:sample(before),b:sample(after),ca:rgb(before.stroke),cb:rgb(after.stroke)};
}
export function drawStem(node,stem,p) {
  const endpoint=p<=0?stem.before:p>=1?stem.after:null;
  node.setAttribute('d',endpoint?pathData(endpoint):stem.a.map(([x,y],i)=>`${i?'L':'M'}${x+(stem.b[i][0]-x)*p} ${y+(stem.b[i][1]-y)*p}`).join(' '));
  node.setAttribute('stroke',endpoint?endpoint.stroke:`rgb(${stem.ca.map((c,i)=>Math.round(c+(stem.cb[i]-c)*p)).join(',')})`);
  node.setAttribute('stroke-width',String(stem.before.strokeWidth+(stem.after.strokeWidth-stem.before.strokeWidth)*p));
}
