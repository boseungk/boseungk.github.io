const NS='http://www.w3.org/2000/svg';
export const svg=(tag,attrs={})=>{const node=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));return node;};
export const pathData=part=>part.ops.map(op=>op.join(' ')).join(' ');
function paintStyle(node,part) {
  Object.entries({fill:part.fill??'none','fill-opacity':part.fillAlpha??1,stroke:part.stroke??'none','stroke-width':part.strokeWidth??0,
    'stroke-opacity':part.strokeAlpha??1,'stroke-linecap':'round','stroke-linejoin':'round'}).forEach(([key,value])=>node.setAttribute(key,String(value)));
}
export function paint(part) {
  const node=part.type==='ellipse'?svg('ellipse',{cx:part.cx,cy:part.cy,rx:part.rx,ry:part.ry}):svg('path',{d:pathData(part)});
  paintStyle(node,part);
  return node;
}
function vertices(part) {
  if(part.type!=='path')return null;
  if(part.ops.every(op=>['M','L','Z'].includes(op[0])))return part.ops.filter(op=>op[0]!=='Z').map(op=>[op[1],op[2]]);
  return null;
}
function contour(part) {
  const path=svg('path',{d:pathData(part)}),length=path.getTotalLength();
  return Array.from({length:80},(_,i)=>{const p=path.getPointAtLength(length*i/80);return [p.x,p.y];});
}
function color(hex){return [1,3,5].map(start=>parseInt(hex.slice(start,start+2),16));}
export function prepareMorph(before,after) {
  const a=vertices(before),b=vertices(after),matching=a&&b&&a.length===b.length;
  return {before,after,a:matching?a:contour(before),b:matching?b:contour(after),ca:color(before.fill),cb:color(after.fill)};
}
export function drawMorph(node,morph,t) {
  if(t<=0){node.setAttribute('d',pathData(morph.before));paintStyle(node,morph.before);return;}
  if(t>=1){node.setAttribute('d',pathData(morph.after));paintStyle(node,morph.after);return;}
  paintStyle(node,morph.after);
  node.setAttribute('d',morph.a.map(([x,y],i)=>`${i?'L':'M'}${(x+(morph.b[i][0]-x)*t).toFixed(2)} ${(y+(morph.b[i][1]-y)*t).toFixed(2)}`).join(' ')+' Z');
  node.setAttribute('fill',`rgb(${morph.ca.map((c,i)=>Math.round(c+(morph.cb[i]-c)*t)).join(',')})`);
  const mix=(a,b)=>a+(b-a)*t;
  node.setAttribute('fill-opacity',String(mix(morph.before.fillAlpha??1,morph.after.fillAlpha??1)));
  node.setAttribute('stroke-width',String(mix(morph.before.strokeWidth??0,morph.after.strokeWidth??0)));
  node.setAttribute('stroke-opacity',String(mix(morph.before.stroke?(morph.before.strokeAlpha??1):0,morph.after.stroke?(morph.after.strokeAlpha??1):0)));
  const stroke=morph.before.stroke??morph.after.stroke;
  if(stroke){const a=color(morph.before.stroke??stroke),b=color(morph.after.stroke??stroke);node.setAttribute('stroke',`rgb(${a.map((c,i)=>Math.round(mix(c,b[i]))).join(',')})`);}
}
