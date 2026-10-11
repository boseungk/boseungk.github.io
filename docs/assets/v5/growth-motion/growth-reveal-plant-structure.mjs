import { partAnchor } from './growth-reveal-recipes.mjs';

const range=(from,to)=>Array.from({length:to-from},(_,i)=>from+i);
const signature=(node,parts)=>JSON.stringify(node.indices.map(index=>parts[index]));
export const PLANT_KINDS=['flower','tree','blossom','succulent','cactus'];

/** Study-only rig: a painted face and its veins/shading have one motion owner. */
export function plantStructure(kind,stage,parts) {
  const baseCount=kind==='flower'?9:14,nodes=[],used=new Set(range(0,baseCount));
  function add(id,indices,anchor,role='leaf') {
    for(const index of indices){if(!parts[index]||used.has(index))throw new Error(`Invalid ${kind}/${stage} owner: ${index}`);used.add(index);}
    nodes.push({id,indices,anchor,role});
  }
  if(stage===0&&kind!=='succulent')add('seed',range(baseCount,parts.length),[130,153],'seed');
  else if(kind==='flower') {
    add('stem',[9],[130,155],'wood');
    if(stage===1){add('left-leaf',[10],[132,139]);add('right-leaf',[11],[132,132]);}
    else {
      add('left-leaf',[10,12],[130,137]);add('right-leaf',[11,13],[134,120]);
      if(stage===2)add('top-leaf',[14],[135,103]);
      else {
        add('side-stem',[14],[137,99],'wood');add('top-leaf',[15],[137,102]);
        if(stage===3)add('bud',[16,17,18],[135,70],'bloom');
        else {add('flower',range(16,28),[139,67],'bloom');add('side-bud',[28,29],[157,86],'bloom');}
      }
    }
  } else if(kind==='tree') {
    const woodColors=['#778B5E','#9D8563','#9A7D59'];
    for(let i=baseCount;i<parts.length;i++)if(woodColors.includes(parts[i].fill??parts[i].stroke))add(`wood-${i}`,[i],partAnchor(parts[i]),'wood');
    const leaves=new Map();
    for(let i=baseCount;i<parts.length;i++) {
      if(used.has(i)||parts[i].type==='ellipse')continue;
      const anchor=partAnchor(parts[i]),key=anchor.join(',');
      if(!leaves.has(key))leaves.set(key,{anchor,indices:[]});leaves.get(key).indices.push(i);
    }
    for(const [key,leaf] of leaves)add(`leaf-${key}`,leaf.indices,leaf.anchor);
    for(let i=baseCount;i<parts.length;i++)if(!used.has(i))add(`surface-${i}`,[i],partAnchor(parts[i]),'surface');
  } else if(kind==='blossom') {
    if(stage===1){add('stem',[14],[130,153],'wood');add('left-leaf',[15],[133,138]);add('right-leaf',[16],[135,130]);}
    else {
      add('trunk',[14,15,16],[130,156],'wood');
      for(let i=17;i<24;i++)add(`leaf-${i}`,[i],partAnchor(parts[i]));
      const centers=[[99,88],[116,59],[156,52],[165,82],[178,105],[128,104]];
      if(stage===3)centers.slice(0,5).forEach((center,i)=>add(`bud-${i}`,range(24+i*3,27+i*3),center,'bloom'));
      if(stage===4){centers.forEach((center,i)=>add(`bloom-${i}`,range(24+i*12,36+i*12),center,'bloom'));
        add('side-bud',[96,97],[99,88],'branch');add('small-leaf',[98],[153,111]);}
    }
  } else if(kind==='succulent') {
    if(stage<=1){add('fallen-leaf',[14,15,16,17],[110,156]);if(stage===1){add('root',[18],[114,155],'branch');add('left-shoot',[19,20],[115,153]);add('right-shoot',[21,22],[115,153]);}}
    else {
      let leaf;
      for(let i=14;i<parts.length;i++) {
        const part=parts[i];
        if(part.type==='ellipse'){if(leaf){add(leaf.id,leaf.indices,leaf.anchor);leaf=null;}add(`surface-${i}`,[i],partAnchor(part),'surface');continue;}
        if(part.fill&&part.fillAlpha===1){if(leaf)add(leaf.id,leaf.indices,leaf.anchor);leaf={id:`leaf-${i}`,indices:[],anchor:partAnchor(part)};}
        if(!leaf)throw new Error('Succulent detail is missing its leaf');leaf.indices.push(i);
      }
      if(leaf)add(leaf.id,leaf.indices,leaf.anchor);
    }
  } else if(kind==='cactus') {
    if(stage<=2)add('body',range(14,parts.length),[130,155],'body');
    else {
      add('left-arm',[14,16,17,18,...range(22,31)],[116,124],'branch');
      add('right-arm',[15,19,20,21,...range(31,40)],[141,125],'branch');
      add('body',range(40,58),[130,155],'body');
      if(stage===4){add('flower',range(58,66),[166,44],'bloom');add('side-bud',[66,67],[95,66],'bloom');}
    }
  }
  if(used.size!==parts.length)throw new Error(`Unowned ${kind}/${stage} artwork`);
  return {baseCount,nodes:nodes.map(node=>({...node,signature:signature(node,parts)}))};
}

export function plantTransitionPlan(before,after,study) {
  const old=plantStructure(study.kind,study.from,before),next=plantStructure(study.kind,study.to,after);
  const replacement=(['flower','tree'].includes(study.kind)&&study.to<=3)||(study.kind==='blossom'&&study.to<=2)
    ||(study.kind==='cactus'&&study.to<=2)||(study.kind==='succulent'&&study.to===2);
  const oldSignatures=new Set(old.nodes.map(node=>node.signature));
  const newWood=next.nodes.some(node=>node.role==='wood'&&!oldSignatures.has(node.signature));
  const supportEnd=.48;
  return {old,next,replacement,supportEnd,tracks:next.nodes.map((node,index)=>{
    const common=oldSignatures.has(node.signature);
    const delay=replacement?supportEnd+.025*(index%4):newWood?supportEnd+.025*(index%4):.17+.045*(index%4);
    return {...node,common,delay,span:replacement||newWood?.35:.57};
  })};
}
