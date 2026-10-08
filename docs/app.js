'use strict';
const language=document.documentElement.lang==='en'?'en':'ko';
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduce.matches, dirty=true;
const motion=document.querySelector('#motion');
function updateMotion(){motion.textContent=language==='ko'?(paused?'움직임 재생':'움직임 멈추기'):(paused?'Play motion':'Pause motion');dirty=true;}
motion.addEventListener('click',()=>{paused=!paused;updateMotion()});updateMotion();
reduce.addEventListener('change',event=>{paused=event.matches;updateMotion()});
window.addEventListener('resize',()=>{dirty=true});
try{
 const A=window.DRAWN_APP,SK=window.DRAWN_SKIA;
 const room=A.composeRoom(structuredClone(A.DEFAULT_SELECTION),{season:'spring',lightOn:true}),events=A.prepareEvents(room),sets=A.buildCatSets(),coats=A.buildCoat('blackBib'),lab=A.makeLab(),heroCat=A.makeLab();
 const anchor=room.anchors.find(a=>a.id==='floor')||room.anchors[0];A.setStage(lab,anchor);
 const originalDog=A.buildDog('spotted','ref');
 // Keep the authored spotted dog's geometry and every pose; warm its coat only.
 const dogPalette={'#78756e':'#947050','#eae6dd':'#f3e5ce'};
 const warmPart=part=>part?{...part,color:dogPalette[part.color.toLowerCase()]||part.color,patches:part.patches.map(p=>({...p,color:dogPalette[p.color.toLowerCase()]||p.color}))}:part;
 const warmSet=set=>({...set,body:warmPart(set.body),neck:warmPart(set.neck),head:warmPart(set.head),tail:warmPart(set.tail),nose:warmPart(set.nose),tongue:warmPart(set.tongue),legs:set.legs.map(warmPart),ears:set.ears?.map(warmPart)});
 const dog={...originalDog,sets:originalDog.sets.map(warmSet),rest:originalDog.rest.map(poses=>Object.fromEntries(Object.entries(poses).map(([pose,parts])=>[pose,{...parts,body:warmPart(parts.body),neck:warmPart(parts.neck),legs:parts.legs.map(warmPart)}])))},dogState=A.makeDogState(0);
 A.command(heroCat,'sit',true);A.dogCommand(dogState,'sit',[-80,80],true,dog);
 const surfaces=['room','companions'].map(id=>{const cv=document.getElementById(id),ctx=cv.getContext('2d');return {id,cv,ctx,g:SK.canvasFor(ctx)}});
 document.querySelectorAll('[data-icon]').forEach(cv=>{const g=SK.canvasFor(cv.getContext('2d'));g.begin();g.scale(2,2);A.drawHomeIcon(g,cv.dataset.icon)});
 let now=0,last=0,elapsed=0,commandIndex=0,tod=0,lastDraw=0;
 const commands=['look','stand','sit','look'];
 document.querySelectorAll('[data-tod]').forEach(button=>button.addEventListener('click',()=>{tod=Number(button.dataset.tod);dirty=true;document.querySelectorAll('[data-tod]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))}));
 document.querySelector('#hello').addEventListener('click',()=>{if(paused){A.command(heroCat,'stand',true);A.dogCommand(dogState,'stand',[-80,80],true,dog);}else{A.command(heroCat,'look',false);A.dogCommand(dogState,'wag',[-80,80],false,dog)}elapsed=0;dirty=true;document.querySelector('#greeting-status').textContent=language==='ko'?'고양이와 강아지가 인사해요.':'The cat and dog say hello.'});
 document.querySelectorAll('#hello,#motion,[data-tod]').forEach(button=>{button.hidden=false});
 function draw(time){requestAnimationFrame(draw);if(document.hidden||(paused&&!dirty)||time-lastDraw<32)return;dirty=false;lastDraw=time;const dt=last?Math.min((time-last)/1000,.06):0;last=time;if(!paused&&!document.hidden){now+=dt;elapsed+=dt;A.step(lab,dt,now,false,true);A.step(heroCat,dt,now,false,true);A.stepDog(dogState,dog,dt,now,false,true);if(elapsed>6){const action=commands[commandIndex++%commands.length];A.command(lab,action,false);A.command(heroCat,action,false);A.dogCommand(dogState,action==='look'?'wag':action,[-80,80],false,dog);elapsed=0;}}
 for(const {id,cv,ctx,g} of surfaces){const w=cv.clientWidth,h=cv.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);if(!w||!h)continue;if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}g.begin();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(id==='companions'){
 const scale=Math.min(w/650,h/250),ground=h*.9;
 ctx.fillStyle='#e7d9c9';ctx.beginPath();ctx.ellipse(w*.34,ground+4,70*scale,8*scale,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(w*.66,ground+4,90*scale,9*scale,0,0,Math.PI*2);ctx.fill();
 g.save();g.translate(w*.34-A.CAT.origin.restX*.27*scale,ground-950*.27*scale);g.scale(.27*scale,.27*scale);A.drawCat(g,heroCat.S,A.CAT.coats.blackBib,sets[heroCat.boilIdx],coats[heroCat.boilIdx],now,heroCat.boilIdx);g.restore();
 g.save();g.translate(w*.68,ground);g.scale(.64*scale,.64*scale);A.drawDog(g,dogState,dog,now);g.restore();continue;}
 const p={x:0,y:-h*.13,scale:w/A.WORLD_W};
 const tint=tod?{c:A.CREATURE_TINT.night,a:A.CREATURE_TINT.a[1]}:null;
 g.save();g.translate(p.x,p.y);A.drawFrame(g,{k:p.scale,room,todIdx:tod,env:{tod,season:'spring',lightOn:true,tint:room.tint[tod],shadow:room.shadowBase,now,windowOpen:0,gust:0,reduced:paused,autoEvents:false,viewTags:room.viewTags},catTint:tint,events,dog:null,petVisible:true,placement:{surfaceId:anchor.id,y:anchor.y,scale:anchor.scale||1,x:A.ROOM.place.catX+(lab.S.x-A.CAT.origin.restX)*A.CREATURE_SCALE},contactSurfaceId:anchor.id,lift:0},lab,sets,coats,A.CAT.coats.blackBib,now);g.restore();
 }}requestAnimationFrame(draw);
}catch(error){console.error('Room preview:',error);document.querySelectorAll('#hello,#motion,[data-tod]').forEach(button=>{button.hidden=true});document.querySelector('#greeting-status').textContent=language==='ko'?'캐릭터 미리보기를 불러오지 못했습니다. 제품 소개는 계속 읽을 수 있어요.':'The animated preview could not load. Product information is still available.';}
