/* Native presentation adapter. The 11s editorial pacing illustrates user actions;
   it never creates app sessions, records, rewards, or automatic goal completion.
   Sources: FocusCompletionCard/FocusQuietCompletion, memory-flight-motion,
   MemoryDayScreen/MemoryTraceList, native drawn animal playback. */
(function(global){
 'use strict';
 const DURATION=11000,COMPLETE=1800,RETURN=5100,INDEX=6500,DAY=8200;
 const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
 const portion=(t,d,delay=0)=>clamp((t-delay)/d);
 function bezier(v,curve){
  v=clamp(v);if(v===0||v===1)return v;
  const [x1,y1,x2,y2]=curve;let lo=0,hi=1,t=v;
  for(let i=0;i<22;i++){const x=3*(1-t)*(1-t)*t*x1+3*(1-t)*t*t*x2+t*t*t;if(x<v)lo=t;else hi=t;t=(lo+hi)/2;}
  return 3*(1-t)*(1-t)*t*y1+3*(1-t)*t*t*y2+t*t*t;
 }
 function frameAt(ms){
  const t=clamp(ms,0,DURATION);
  return {time:t,phase:t<COMPLETE?'running':t<RETURN?'completion':t<INDEX?'home':t<DAY?'index':'day',
   completionIn:bezier(portion(t,220,COMPLETE),[.215,.61,.355,1]),
   completionOut:bezier(portion(t,200,RETURN),[0,0,.58,1]),
   flightTime:clamp(t-RETURN,0,740),memoryIn:bezier(portion(t,280,DAY),[.22,.61,.36,1]),
   elapsedSeconds:540,targetMinutes:25,done:t>=DURATION};
 }
 // Direct port of native memoryFlightPose and memoryFlightDestinationPose, in pt.
 function flightPose(from,to,time){
  const p=bezier(portion(time,400),[.45,0,.25,1]),q=portion(time,400);
  const fx=from.x+from.width/2,fy=from.y+from.height/2;
  const tx=to.x+to.width*30.5/64,ty=to.y+to.height*8/64-10;
  const lift=Math.min(28,Math.abs(ty-fy)*.1);
  const y=q<.26?fy-lift*bezier(q/.26,[.25,.6,.45,1]):fy-lift+(ty-fy+lift)*bezier((q-.26)/.74,[.55,0,.8,.45]);
  const tuck=bezier(portion(time,140,400),[.4,0,1,1]);
  const press=bezier(portion(time,260,480),[.42,0,.58,1]),bounce=press<.4?press/.4:(1-press)/.6;
  return {x:fx+(tx-fx)*p-10,y:y-10+20*tuck,width:20,height:20,rotate:0,opacity:time>=540?0:1,
   clipHeight:20*(1-tuck),dockY:1.2*bounce,dockRotate:-.8*bounce};
 }
 function makeMachine(reduced=false){
  let time=reduced?DURATION:0,started=reduced,paused=reduced,visible=false;
  return {entry(ratio,passed=false){visible=ratio>0;if(passed||reduced){time=DURATION;started=true;}else if(ratio>=.35)started=true;},
   tick(delta){if(started&&visible&&!paused)time=clamp(time+Math.max(0,delta),0,DURATION);return frameAt(time);},
   pause(value){paused=!!value;},reduced(value){reduced=!!value;paused=reduced;if(reduced){time=DURATION;started=true;}},
   seek(value){time=clamp(value,0,1)*DURATION;started=true;},replay(){time=reduced?DURATION:0;started=true;},
   state(){return {...frameAt(time),started,paused,visible};}};
 }
 function makePainter(source){
  const W=390,H=834.5,ctx=source.getContext('2d');ctx.scale(4,4);
  const sharedScreen=global.MARHeroScreen(),room=global.MARHeroRoom(),A=global.DRAWN_APP;
  const roomCanvas=document.createElement('canvas');roomCanvas.width=1600;roomCanvas.height=1000;
  const rc=roomCanvas.getContext('2d'),g=global.DRAWN_SKIA.canvasFor(rc);
  const glass=document.createElement('canvas');glass.width=224;glass.height=336;
  const gc=glass.getContext('2d'),mark=document.createElement('canvas');mark.width=mark.height=160;
  const mc=mark.getContext('2d');global.MARLandscape.drawTimeMark(mc,{width:160,height:160,phase:'daytime',time:950});
  const icons={};for(const name of ['room','memory','focus','decor','tasks']){
   const c=document.createElement('canvas');c.width=c.height=256;const ig=global.DRAWN_SKIA.canvasFor(c.getContext('2d'));ig.begin();ig.scale(4,4);A.drawHomeIcon(ig,name);icons[name]=c;
  }
  const nativeRoom=A.composeRoom(A.DEFAULT_SELECTION,{season:'spring',lightOn:true});
  const catSets=A.buildCatSets(),coats=A.buildCoat('blackBib');
  let animal='cat',dog=null,world,playback,config,request=null,exitQueued=false,previousTime=0;
  function reset(){
   dog=animal==='dog'?A.buildDog('spotted','ref'):null;
   const scene=A.makeAnimalScene(nativeRoom,animal,dog);config=A.makePlaybackConfig(scene);
   world=A.makeLab();A.setStage(world,{id:'floor',x:config.range,y:config.support.y});
   world.S.x=A.CAT.origin.restX+(config.support.x-A.ROOM.place.catX)/A.CREATURE_SCALE;
   world.dog=dog?A.makeDogState(config.support.x):null;
   if(dog)A.dogCommand(world.dog,'sit',config.range,true,dog);else A.command(world,'sitB',true);
   playback=A.makeDrawnPlayback();playback.visible=true;playback.position={...config.support};
   request=null;exitQueued=false;previousTime=0;
  }
  reset();
  function stepAnimal(t){
   if(t<previousTime)reset();
   // Seek and ordinary playback use the same native executor and fixed increments.
   while(previousTime<t){
    const next=Math.min(t,previousTime+1000/30),dt=(next-previousTime)/1000;
    if(next>=COMPLETE&&!exitQueued){exitQueued=true;request={id:'journey-rise',owner:'web-example',clip:{kind:'drawn',command:'stand',from:dog?'seated':'sitB',to:'stand',durationMs:1200}};}
    if(request){const feedback=A.stepAnimalPlayback(playback,world,request,dog,config,dt,false,false);
     if(feedback?.error){request=null;}
     else if(feedback?.finished||feedback?.settled){
      request=request.id==='journey-rise'?{id:'journey-exit',owner:'web-example',clip:{kind:'drawn',command:'exit',from:'stand',to:'offscreen',durationMs:2200}}:null;
     }
    }
    previousTime=next;
   }
  }
  function text(s,x,y,size=17,color='#473e3b',align='left'){
   ctx.font=`400 ${size}px Line, sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,x,y);
  }
  function rect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function line(x,y,x2,y2,color='#e5e5e5'){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
  function phaseMark(x,y,size=20,arrival=950){const mc=mark.getContext('2d');mc.clearRect(0,0,160,160);MARLandscape.drawTimeMark(mc,{width:160,height:160,phase:'daytime',time:arrival});ctx.drawImage(mark,x,y,size,size);}
  function status(){text('9:41',32,32.5,14.5);ctx.fillStyle='#473e3b';for(let i=0;i<4;i++)ctx.fillRect(313.5+i*5,30-(i+1)*2,3,(i+1)*2);ctx.strokeStyle='#473e3b';ctx.lineWidth=1;ctx.strokeRect(346,21,20,10);ctx.fillRect(347.5,22.5,15,7);ctx.fillRect(367,24,1.5,4);rect(134,816.5,122,4.5,2.25,'#473e3b');}
  function back(){ctx.strokeStyle='#473e3b';ctx.lineWidth=1.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(41.5,66);ctx.lineTo(34,73.5);ctx.lineTo(41.5,81);ctx.stroke();}
  function worldFrame(f,paused){
   room.draw(rc,{width:1600,height:1000,time:f.time/1000,paused});
   stepAnimal(f.time);
   // Same room projection and native occlusion as MARHeroRoom; playback owns contact.
   const k=624/1080,x=(1600-624)/2,y=90-110*k;
   g.begin();g.save();g.translate(x,y);
   A.drawFrame(g,{k,room:nativeRoom,todIdx:0,env:{tod:0,season:'spring',lightOn:true,tint:nativeRoom.tint[0],shadow:nativeRoom.shadowBase,now:f.time/1000,windowOpen:1,gust:0,reduced:paused},
    catTint:null,events:[],dog,petVisible:playback.visible,placement:playback.position,contactSurfaceId:A.contactSurface(playback),lift:playback.lift},world,catSets,coats,A.CAT.coats.blackBib,f.time/1000);
   g.restore();
   sharedScreen.draw({progress:1,time:f.time/1000,paused,worldCanvas:roomCanvas,elapsedSeconds:540,
    hideHourglass:f.time>=COMPLETE,hudReveal:1-f.completionIn});
   ctx.drawImage(sharedScreen.canvas,0,0,W,H);
  }
  const card={x:16,y:(H-332)/2,w:358,h:332},phase={x:98,y:card.y+213,width:20,height:20},dock={x:92,y:732,width:62,height:62};
  function completion(f){
   const opacity=f.completionIn*(1-f.completionOut);if(opacity<=0)return;
   ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle='rgba(40,34,30,.24)';ctx.fillRect(0,0,W,H);
   ctx.translate(0,8*(1-f.completionIn));rect(card.x,card.y,card.w,card.h,18,'#fff');
   text('집중을 마쳤어요',195,card.y+48,17,'#5f5551','center');
   global.MARLandscape.drawHourglass(gc,{width:224,height:336,progress:0,time:0,paletteId:'dawn',restingFill:.5294});ctx.drawImage(glass,167,card.y+72,56,84);
   const sheen=bezier(portion(f.time,1100,COMPLETE),[.645,.045,.355,1]);
   if(sheen>0&&sheen<1){ctx.save();ctx.translate(167,card.y+72);ctx.scale(.5,.5);ctx.translate(-24,-8);
    ctx.clip(new Path2D('M40 24 H120 C120 45 111 59 94 73 C86 79 83 83 83 91 C83 99 87 103 95 109 C111 122 120 137 120 158 H40 C40 137 49 122 65 109 C73 103 77 99 77 91 C77 83 74 79 66 73 C49 59 40 45 40 24Z'));
    ctx.globalAlpha*=Math.sin(sheen*Math.PI)*.65;ctx.translate(sheen*170-90,0);ctx.translate(80,90);ctx.rotate(Math.PI/10);ctx.translate(-80,-90);
    const shine=ctx.createLinearGradient(44,0,76,0);shine.addColorStop(0,'rgba(255,253,247,0)');shine.addColorStop(.5,'rgba(255,253,247,.85)');shine.addColorStop(1,'rgba(255,253,247,0)');
    ctx.fillStyle=shine;ctx.fillRect(44,20,32,140);ctx.restore();}
   text('9분의 집중',195,card.y+197,26,'#473e3b','center');
   if(f.time<RETURN)phaseMark(phase.x,phase.y);
   text('오늘 기록에 남겼어요',124,card.y+231,17,'#5f5551');
   rect(44,card.y+256,302,48,12,'#e1cabf');text('확인',195,card.y+287,17,'#473e3b','center');ctx.restore();
  }
  function homeDock(f){
   const flight=flightPose(phase,dock,f.flightTime);
   ['room','memory','focus','decor','tasks'].forEach((name,i)=>{
    const x=20+i*72;ctx.save();if(name==='memory'){ctx.translate(x+31,763+flight.dockY);ctx.rotate(flight.dockRotate*Math.PI/180);ctx.drawImage(icons[name],-31,-31,62,62);}else ctx.drawImage(icons[name],x,732,62,62);ctx.restore();
   });
   if(f.time>=RETURN&&f.time<RETURN+540&&flight.opacity){ctx.save();ctx.beginPath();ctx.rect(flight.x,flight.y,20,flight.clipHeight);ctx.clip();phaseMark(flight.x,flight.y);ctx.restore();}
  }
  function memoryIndex(f){
   ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);back();text('기억',195,80,20,'#473e3b','center');
   text('2026년 10월',24,137,18);text('통계',342,80,13,'#5f5551','center');
   ctx.strokeStyle='#5f5551';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(142,125);ctx.lineTo(147,130);ctx.lineTo(152,125);ctx.moveTo(300,123);ctx.lineTo(294,129);ctx.lineTo(300,135);ctx.moveTo(343,123);ctx.lineTo(349,129);ctx.lineTo(343,135);ctx.stroke();
   const cue=1-portion(f.time,700,INDEX);
   if(cue>0){ctx.save();ctx.globalAlpha=cue*.65;rect(14,170,362,106,14,'#f5f5f5');ctx.restore();}
   text('11',24,211,24,'#5f5551');text('오늘',24,239,13,'#776b66');
   text('책을 조금 읽고,',74,209,16);text('생각도 천천히 정리했다.',74,235,16);text('집중 9분',74,261,14,'#776b66');
  }
  function emptyMedia(x,label,isRoom){rect(x,120,56,78,10,'#f5f5f5');ctx.strokeStyle=isRoom?'#b17457':'#a9787a';ctx.lineWidth=1;
   if(isRoom){ctx.beginPath();ctx.arc(x+28,147,10.25,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x+28,147,7,0,Math.PI*2);ctx.stroke();}
   else{ctx.beginPath();for(const [dx,dy,sx,sy] of [[8,126,1,1],[48,126,-1,1],[8,166,1,-1],[48,166,-1,-1]]){ctx.moveTo(x+dx+8*sx,dy);ctx.lineTo(x+dx,dy);ctx.lineTo(x+dx,dy+8*sy);}ctx.stroke();ctx.strokeRect(x+22,141,13,10);ctx.beginPath();ctx.moveTo(x+23,150);ctx.lineTo(x+27,146);ctx.lineTo(x+30,149);ctx.stroke();}
   text(label,x+28,188,12,'#5f5551','center');}
  function memoryDay(f){
   ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);back();text('저장됨',195,80,13,'#776b66','center');
   // Canonical day view: autosave in the centre, erase glyph at right, no title.
   ctx.strokeStyle='#776b66';ctx.lineWidth=1.2;ctx.strokeRect(344,69,10,13);line(342,67,356,67,'#776b66');line(347,64,351,64,'#776b66');
   ctx.save();ctx.globalAlpha=f.memoryIn;ctx.translate(0,6*(1-f.memoryIn));
   text('2026년 10월',24,137,14,'#5f5551');text('11일 일요일',24,174,28);emptyMedia(246,'사진',false);emptyMedia(310,'방 이미지',true);
   text('책을 조금 읽고,',24,243,17);text('생각도 천천히 정리했다.',24,273,17);
   line(24,625,366,625);text('그날의 흔적',24,654,14,'#776b66');
   const cue=1-portion(f.time,700,DAY+250);if(f.time>=DAY+250&&cue>0){ctx.save();ctx.globalAlpha=cue;rect(16,667,358,40,10,'#f5f5f5');ctx.restore();}
   phaseMark(24,676,20,Math.min(950,Math.max(0,f.time-DAY-250)));text('오후 2:09',54,692,13,'#776b66');text('책 한 챕터 ✎',128,692,15,'#5f5551');text('9분',366,692,14,'#776b66','right');ctx.restore();
  }
  return {draw(f,paused){ctx.clearRect(0,0,W,H);if(f.phase==='index')memoryIndex(f);else if(f.phase==='day')memoryDay(f);else{
    worldFrame(f,paused);if(f.time>=RETURN)homeDock(f);if(f.time>=COMPLETE)completion(f);
   }status();},setAnimal(value){animal=value==='dog'?'dog':'cat';reset();},reset};
 }
 function mount(root){
  if(root.__marJourney)return root.__marJourney;
  const stage=root.querySelector('#device-stage');
  if(!stage)return null;
  const reduce=global.matchMedia('(prefers-reduced-motion: reduce)'),machine=makeMachine(reduce.matches);
  let phone=null,painter=null,dead=false,last=0,raf=0,loading=false,selectedAnimal='cat',hold=0;
  const source=document.createElement('canvas');source.width=1560;source.height=3338;
  function update(){const s=machine.state();root.dataset.journeyPhase=s.phase;root.dataset.journeyTime=String(Math.round(s.time));
   root.querySelectorAll('[data-journey-step]').forEach(el=>el.dataset.current=String(el.dataset.journeyStep===(s.phase==='running'?'running':s.phase==='completion'||s.phase==='home'?'completion':'memory')));
   if(painter){painter.draw(s,s.paused);phone?.render();}}
  function schedule(){if(!raf&&!dead&&!document.hidden)raf=global.requestAnimationFrame(paint);}
  function paint(now){raf=0;if(dead||document.hidden)return;const before=machine.state();
   const delta=last?Math.min(100,Math.max(0,now-last)):0;last=now;
   if(before.done&&before.visible&&!before.paused&&!reduce.matches){hold+=delta;if(hold>=3000){hold=0;machine.replay();painter?.reset();}}else{hold=0;machine.tick(delta);}
   update();const s=machine.state();
   if(s.started&&s.visible&&!s.paused&&!reduce.matches)schedule();else last=0;
  }
  async function initialize(){if(loading||dead)return;loading=true;
   try{await document.fonts.ready;painter=makePainter(source);painter.setAnimal(selectedAnimal);update();phone=await global.MARHeroPhone(stage,source);if(dead){phone?.destroy();return;}update();schedule();}
   catch(error){root.dataset.journeyUnavailable='true';console.warn('Journey preview unavailable',error);}}
  const observer=new global.IntersectionObserver(entries=>{for(const e of entries){machine.entry(e.intersectionRatio>=.65?.35:e.intersectionRatio>0?.1:0,e.boundingClientRect.bottom<=0);if(e.isIntersecting)initialize();}last=0;update();schedule();},{threshold:[0,.65]});observer.observe(stage);
  const resize=new global.ResizeObserver(()=>{phone?.resize();update();});resize.observe(stage);
  function onReplay(){machine.replay();painter?.reset();last=0;update();schedule();}
  function onMotion(e){machine.pause(e.detail.paused);last=0;update();schedule();}
  function onAnimal(e){selectedAnimal=e.detail.animal;painter?.setAnimal(selectedAnimal);update();}
  function onReduced(e){machine.reduced(e.matches);last=0;update();schedule();}
  function onVisibility(){last=0;if(document.hidden){if(raf)global.cancelAnimationFrame(raf);raf=0;}else{update();schedule();}}
  // Fast skipping settles; revisiting resumes a visible in-progress sequence, never restarts it.
  function onScroll(){if(!machine.state().done&&root.getBoundingClientRect().bottom<=0){machine.seek(1);update();}}
  global.addEventListener('mar:motion',onMotion);global.addEventListener('mar:animal',onAnimal);
  global.addEventListener('scroll',onScroll,{passive:true});document.addEventListener('visibilitychange',onVisibility);reduce.addEventListener('change',onReduced);
  const api={pause(value){machine.pause(value);last=0;update();schedule();},setAnimal(value){selectedAnimal=value;painter?.setAnimal(value);update();},
   seek(value){machine.seek(value);last=0;update();schedule();},replay:onReplay,getState:()=>machine.state(),
   destroy(){dead=true;observer.disconnect();resize.disconnect();if(raf)global.cancelAnimationFrame(raf);phone?.destroy();
    global.removeEventListener('mar:motion',onMotion);global.removeEventListener('mar:animal',onAnimal);
    global.removeEventListener('scroll',onScroll);document.removeEventListener('visibilitychange',onVisibility);reduce.removeEventListener('change',onReduced);delete root.__marJourney;}};
  root.__marJourney=api;update();return api;
 }
 global.MARJourney={mount,frameAt,flightPose,makeMachine,duration:DURATION};
})(window);
