/* RN LiquidChoiceBackdrop geometry and spring; one wash per selection group. */
(()=>{'use strict';
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!document.body.classList.contains('motion-on');
 const ns='http://www.w3.org/2000/svg';
 document.querySelectorAll('.intro-chapters,.pet-picker,.theme-links,.routine-controls').forEach(group=>{
  const buttons=[...group.querySelectorAll('button[aria-pressed]')];
  if(getComputedStyle(group).position==='static')group.style.position='relative';
  group.classList.add('wash-choices');
  buttons.forEach(button=>{const label=document.createElement('div');label.className='choice-label';while(button.firstChild)label.append(button.firstChild);button.append(label);});
  const svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');svg.classList.add('choice-wash');svg.setAttribute('aria-hidden','true');path.setAttribute('fill','#EFE3DD');svg.append(path);group.prepend(svg);
  let current=null,target=null,velocity=[0,0,0,0],raf=0,last=0;
  function paint(){if(!current)return;const [x,y,w,h]=current,p=(a,b)=>`${x+w*a} ${y+h*b}`;path.setAttribute('d',`M${p(.16,.08)}C${p(.35,.02)} ${p(.73,.04)} ${p(.88,.12)}C${p(1,.2)} ${p(1,.7)} ${p(.89,.87)}C${p(.74,1)} ${p(.33,.98)} ${p(.13,.89)}C${p(0,.81)} ${p(0,.31)} ${p(.08,.18)}Q${p(.11,.1)} ${p(.16,.08)}Z`);}
  function tick(t){raf=0;const dt=Math.min((t-last)/1000||1/60,1/30);last=t;let unsettled=false;for(let step=0;step<4;step++)for(let i=0;i<4;i++){velocity[i]+=(484*(target[i]-current[i])-36.52*velocity[i])*dt/4;current[i]+=velocity[i]*dt/4;}for(let i=0;i<4;i++)if(Math.abs(target[i]-current[i])>.05||Math.abs(velocity[i])>.05)unsettled=true;if(reduced()||!unsettled){current=[...target];velocity.fill(0);}else raf=requestAnimationFrame(tick);paint();}
  function update(){const selected=buttons.find(b=>b.getAttribute('aria-pressed')==='true');svg.style.opacity=selected?'1':'0';if(!selected)return;const base=group.getBoundingClientRect(),r=selected.querySelector('.choice-label').getBoundingClientRect();target=[r.left-base.left,r.top-base.top,r.width,r.height];if(!current||reduced()){cancelAnimationFrame(raf);raf=0;current=[...target];velocity.fill(0);paint();}else if(!raf){last=performance.now();raf=requestAnimationFrame(tick);}}
  new MutationObserver(update).observe(group,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});new ResizeObserver(update).observe(group);document.fonts.ready.then(update);addEventListener('mar:motion',update);update();
 });
 // Existing native sky glyphs play once on an explicit day/night change.
 document.querySelectorAll('[data-scene-time]').forEach(button=>{
  function draw(){const phase=button.textContent.includes('낮으로')?'daytime':'night',label=button.textContent;button.textContent='';const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.className='choice-sky';canvas.setAttribute('aria-hidden','true');button.append(canvas,document.createTextNode(label));const ctx=canvas.getContext('2d'),start=performance.now();function frame(t){if(!canvas.isConnected)return;const elapsed=reduced()?950:Math.min(950,t-start);ctx.clearRect(0,0,64,64);window.MARLandscape?.drawTimeMark(ctx,{width:64,height:64,phase,time:elapsed});if(elapsed<950)requestAnimationFrame(frame);}requestAnimationFrame(frame);}
  button.addEventListener('click',draw);draw();
 });
})();
