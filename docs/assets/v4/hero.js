/* One world, one companion, one camera path from product to experience. */
(function(){
 'use strict';
 const root=document.querySelector('.intro-story');if(!root)return;
 const stage=root.querySelector('.intro-stage'),phoneStage=root.querySelector('.intro-phone');
 const canvas=root.querySelector('.intro-canvas'),ctx=canvas.getContext('2d');
 const flat=root.querySelector('.intro-flat-screen'),flatCtx=flat.getContext('2d');
 const intro=root.querySelector('.intro-copy'),sceneCopy=root.querySelector('.intro-scene-copy');
 const world=document.createElement('canvas');world.width=1600;world.height=1000;const wc=world.getContext('2d');
 const terrain=document.createElement('canvas');terrain.width=1600;terrain.height=1000;const tc=terrain.getContext('2d');
 const animalCanvas=document.createElement('canvas');animalCanvas.width=320;animalCanvas.height=360;const ac=animalCanvas.getContext('2d');
 const hourglass=document.createElement('canvas');hourglass.width=320;hourglass.height=480;const hc=hourglass.getContext('2d');
 const pet=MARPet('cat'),screen=MARHeroScreen(),worldRect=screen.getWorldRect(),room=MARHeroRoom();
 let placement=room.getPetPlacement(1600,1000);
 // The room placement was authored for the cat. Normalize the dog's neutral
 // silhouette to that height, anchored at the same floor contact point.
 const roomPetBounds={};
 for(const kind of ['cat','dog']){const reference=MARPet(kind);ac.clearRect(0,0,320,360);reference.draw(ac,{width:320,height:360,reduced:true,autonomous:false});const pixels=ac.getImageData(0,0,320,360).data;let top=360,bottom=0,left=320,right=0;for(let y=0;y<360;y++)for(let x=0;x<320;x++)if(pixels[(y*320+x)*4+3]>128){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}roomPetBounds[kind]={top,bottom,left,right};}

 const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),mix=(a,b,p)=>a+(b-a)*p;
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 let phone=null,progress=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,staticMode=paused;
 let visible=true,clock=0,last=0,raf=0,dirty=true,activeChapter=-1,petBeat=-1;
 let box={width:1,height:1},screenBox=null;
 function geometry(){
  const sr=stage.getBoundingClientRect(),pr=phoneStage.getBoundingClientRect();box={width:sr.width,height:sr.height};
  const masterWidth=Math.max(1600,Math.ceil(1500*box.width/box.height));if(world.width!==masterWidth){world.width=terrain.width=masterWidth;}placement=room.getPetPlacement(masterWidth,1000);
  const dpr=Math.min(devicePixelRatio||1,3);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  phone?.resize();const r=phone?.getScreenRect();
  if(r)screenBox={x:pr.left-sr.left+r.x,y:pr.top-sr.top+r.y,width:r.width,height:r.height,radius:r.radius};
  else{const h=pr.height*.9,w=h*780/1669;screenBox={x:pr.left-sr.left+(pr.width-w)/2,y:pr.top-sr.top+pr.height*.05,width:w,height:h,radius:w*.21};}
  update();dirty=true;schedule();
 }
 function update(){
  const r=root.getBoundingClientRect(),top=parseFloat(getComputedStyle(stage).top)||0;
  progress=staticMode?0:clamp((top-r.top)/Math.max(1,root.offsetHeight-stage.offsetHeight));
  root.dataset.progress=progress.toFixed(3);
  const chapter=progress<.35?0:progress<.81?1:2;
  if(chapter!==activeChapter){activeChapter=chapter;root.querySelectorAll('[data-intro-jump]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===chapter)));}
  const exit=smooth((progress-.31)/.15);intro.style.opacity=1-exit;intro.style.transform=`translateY(${-exit*30}px)`;intro.inert=exit>.8;
  const copyIn=smooth((progress-.67)/.10);sceneCopy.style.opacity=copyIn;sceneCopy.style.transform=`translateY(${(1-copyIn)*20}px)`;sceneCopy.setAttribute('aria-hidden',String(copyIn<.5));
  const close=progress>.82;
  sceneCopy.querySelector('h2').innerHTML=close?'편안히 머물러요.<br>나의 작은 방에서.':'나의 작은 방에서,<br>온전히 나의 시간.';
  sceneCopy.querySelector('.scene-caption').innerHTML=close?'둘러보고, 기지개를 켜고, 편히 쉬어요.<br>집중하는 동안 곁에 머무는 작은 친구.':'좋아하는 물건들로 채운 나의 방.<br>동물 친구와 함께 집중해요.';
  const beat=progress<.25?0:progress<.81?1:2;
  if(beat!==petBeat){petBeat=beat;if(beat===0)pet.command('sit',true);else if(beat===1)pet.command('look');else pet.command('stretch');}
  dirty=true;schedule();
 }
 function drawWorld(dt){
  tc.clearRect(0,0,terrain.width,1000);room.draw(tc,{width:terrain.width,height:1000,time:clock,paused});
  wc.clearRect(0,0,world.width,1000);wc.drawImage(terrain,0,0);
  ac.clearRect(0,0,320,360);pet.draw(ac,{width:320,height:360,time:clock,dt,reduced:paused,autonomous:false});
  if(progress>.24||staticMode){wc.save();wc.globalAlpha=staticMode?1:smooth((progress-.24)/.07);if(pet.animal==='dog'){const cat=roomPetBounds.cat,dog=roomPetBounds.dog,k=placement.height/360*(cat.bottom-cat.top)/(dog.bottom-dog.top);const floor=placement.y+cat.bottom*placement.height/360;wc.drawImage(animalCanvas,placement.anchorX-(dog.left+dog.right)/2*k,floor-dog.bottom*k,320*k,360*k);}else wc.drawImage(animalCanvas,placement.x,placement.y,placement.width,placement.height);wc.restore();}
 }
 function drawExpansion(){
  if(!screenBox||progress<=.385||staticMode)return;
  const p=smooth((progress-.40)/.28),alpha=smooth((progress-.385)/.025),s=screenBox;
  const start={x:s.x,y:s.y,width:s.width,height:s.height*worldRect.height/1669};
  const inset=box.width<761?0:20*(1-p);
  const r={x:mix(start.x,inset,p),y:mix(start.y,0,p),width:mix(start.width,box.width-inset*2,p),height:mix(start.height,box.height,p)};
  const k0=s.width/780*1.25,k1=box.width<761?box.width*.95/624:box.height/826;
  const k=mix(k0,k1,p);
  const tx0=start.x-(world.width-624)/2*k0,ty0=start.y;
  const targetX=box.width*(box.width<761?.5:.66)-placement.anchorX*k1,targetY=box.width<761?box.height*.28-90*k1:20-90*k1;
  const tx=mix(tx0,targetX,p),ty=mix(ty0,targetY,p);
  ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();ctx.roundRect(r.x,r.y,r.width,r.height,[mix(s.radius,0,p),mix(s.radius,0,p),0,0]);ctx.clip();
  const fillRoom=(floorY)=>{ctx.fillStyle='#F1E6D3';ctx.fillRect(0,0,box.width,box.height);ctx.fillStyle='#DCC6A8';ctx.fillRect(0,floorY,box.width,box.height-floorY);};
  // Keep the animal at its authored room scale. The closing beat is behavior, not magnification.
  fillRoom(ty+673*k);ctx.drawImage(world,tx,ty,world.width*k,1000*k);ctx.restore();
  phoneStage.style.opacity=1-smooth((progress-.43)/.13);
 }
 function drawHourglass(){
  if(!screenBox||progress<.055||progress>.305||staticMode)return;
  const s=screenBox,scale=s.width/780,up=smooth((progress-.055)/.075),down=smooth((progress-.24)/.065);
  const layout=screen.getHourglassLayout();
  const source={x:s.x+layout.source.x*scale,y:s.y+layout.source.y*scale,w:layout.source.w*scale,h:layout.source.h*scale};
  const target={x:s.x+layout.target.x*scale,y:s.y+layout.target.y*scale,w:layout.target.w*scale,h:layout.target.h*scale};
  const bigH=box.width<761?230:320,bigX=box.width<761?box.width*.51:box.width*.52,bigY=box.width<761?box.height*.52:box.height*.53;
  let x=mix(source.x,bigX,up),y=mix(source.y,bigY,up),h=mix(source.h,bigH,up);x=mix(x,target.x,down);y=mix(y,target.y,down);h=mix(h,target.h,down);
  const flip=smooth((progress-.135)/.105),angle=flip<1?flip*Math.PI:0;
  hc.clearRect(0,0,320,480);MARLandscape.drawHourglass(hc,{width:320,height:480,progress:0,time:clock,paletteId:'dawn',restingFill:flip<1?.5294:undefined,initialFill:.5294,flipProgress:flip<1?flip:undefined,angle:angle*180/Math.PI});
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(hourglass,-h/3,-h/2,h*2/3,h);ctx.restore();
 }
 function render(t){
  raf=0;if(document.hidden||!visible)return;
  if(!dirty&&t-last<1000/30){schedule();return;}
  const dt=last?Math.min((t-last)/1000,.05):.033;last=t;if(!paused)clock+=dt;
  drawWorld(dt);
  const screenProgress=staticMode?1:clamp((progress-.10)/.24);
  screen.draw({progress:screenProgress,time:clock,paused,worldCanvas:world,hudReveal:staticMode?1:smooth((progress-.295)/.02),hideHourglass:!staticMode&&progress>=.055&&progress<=.305});
  if(phone&&progress<.57)phone.render();else if(!phone)flatCtx.drawImage(screen.canvas,0,0,flat.width,flat.height);
  ctx.clearRect(0,0,box.width,box.height);phoneStage.style.opacity=1;drawExpansion();drawHourglass();
  dirty=false;if(!paused)schedule();
 }
 function schedule(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(render);}
 function jump(p,instant=false){const top=parseFloat(getComputedStyle(stage).top)||0;scrollTo({top:scrollY+root.getBoundingClientRect().top-top+p*(root.offsetHeight-stage.offsetHeight),behavior:paused||instant?'instant':'smooth'});}
 root.querySelectorAll('[data-intro-jump]').forEach(b=>b.addEventListener('click',()=>jump(Number(b.dataset.introJump),true)));
 root.querySelector('#intro-begin').addEventListener('click',()=>jump(.34));
 addEventListener('scroll',update,{passive:true});addEventListener('resize',geometry);
 addEventListener('mar:motion',e=>{paused=e.detail.paused;staticMode=matchMedia('(prefers-reduced-motion: reduce)').matches;root.dataset.static=String(staticMode);last=0;geometry();});
 addEventListener('mar:animal',e=>{pet.setAnimal(e.detail.animal);dirty=true;schedule();});
 new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible){last=0;dirty=true;schedule();}else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'150px'}).observe(stage);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{last=0;dirty=true;schedule();}});
 root.dataset.static=String(staticMode);root.dataset.enhanced="true";geometry();
 document.fonts.ready.then(async()=>{dirty=true;schedule();try{phone=await MARHeroPhone(phoneStage,screen.canvas);geometry();}catch(e){console.warn('Using the static app preview.',e);}});
})();
