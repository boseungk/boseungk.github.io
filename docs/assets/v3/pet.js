/* The app's own animal geometry and controllers, on a transparent stage. */
(function(global){
'use strict';let art;
function assets(){if(art)return art;const A=global.DRAWN_APP,raw=A.buildDog('spotted','ref');const colors={'#78756e':'#947050','#eae6dd':'#f3e5ce'};
const part=p=>p?{...p,color:colors[p.color.toLowerCase()]||p.color,patches:p.patches.map(q=>({...q,color:colors[q.color.toLowerCase()]||q.color}))}:p;
const set=p=>({...p,body:part(p.body),neck:part(p.neck),head:part(p.head),tail:part(p.tail),nose:part(p.nose),tongue:part(p.tongue),legs:p.legs.map(part),ears:p.ears?.map(part)});
art={sets:A.buildCatSets(),coats:A.buildCoat('blackBib'),dog:{...raw,sets:raw.sets.map(set),rest:raw.rest.map(poses=>Object.fromEntries(Object.entries(poses).map(([pose,p])=>[pose,{...p,body:part(p.body),neck:part(p.neck),legs:p.legs.map(part)}])))}};return art;}
global.MARPet=function(animal='cat'){
 const A=global.DRAWN_APP,art=assets(),lab=A.makeLab(),stage={id:'floor',x:[480,640],y:0};A.setStage(lab,stage);lab.dog=A.makeDogState(560);A.command(lab,'sit',true);A.dogCommand(lab.dog,'sit',stage.x,true,art.dog);
 let kind=animal,next=6,index=0;const wrappers=new WeakMap(),routine=['look','stretch','sit','sniff','stand','walk','sit','loaf'];
 function command(action,instant=false){const mapped=kind==='dog'?({look:'tilt',stretch:'bow',loaf:'lie',hello:'wag'}[action]||action):({hello:'paw',lie:'loaf'}[action]||action);if(kind==='dog')A.dogCommand(lab.dog,mapped,stage.x,instant,art.dog);else A.command(lab,mapped,instant);}
 function draw(ctx,{width,height,time=0,dt=0,reduced=false,autonomous=true}){
  if(!reduced){A.step(lab,Math.min(dt,.06),time,false,true);A.stepDog(lab.dog,art.dog,Math.min(dt,.06),time,false,true);if(autonomous&&time>next){const busy=kind==='dog'?lab.dog.motion||lab.dog.pending||lab.dog.settling:lab.cur||lab.queue.length||lab.pendingCommand||lab.settling;if(!busy){command(routine[index++%routine.length]);next=time+6.5;}}}
  let g=wrappers.get(ctx);if(!g){g=DRAWN_SKIA.canvasFor(ctx);wrappers.set(ctx,g);}g.begin();
  const scale=kind==='cat'?Math.min(width/870,height/650):Math.min(width/680,height/500),base=height*.90;
  ctx.save();ctx.fillStyle='rgba(84,69,56,.10)';ctx.beginPath();ctx.ellipse(width*.5,base+2,width*.20,height*.027,0,0,Math.PI*2);ctx.fill();ctx.restore();
  g.save();if(kind==='cat'){g.translate(width*.5-A.CAT.origin.restX*scale,base-950*scale);g.scale(scale,scale);A.drawCat(g,lab.S,A.CAT.coats.blackBib,art.sets[lab.boilIdx],art.coats[lab.boilIdx],time,lab.boilIdx);}else{g.translate(width*.5-560*scale,base);g.scale(scale,scale);A.drawDog(g,lab.dog,art.dog,time);}g.restore();
 }
 return {draw,command,setAnimal(value){kind=value==='dog'?'dog':'cat';command('sit',true);},get animal(){return kind;}};
};
})(window);
