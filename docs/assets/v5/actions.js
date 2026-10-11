/* Native ActionRow CompletionMark/Burst; local illustrative tasks only. */
(()=>{
 const tasks=[];
 const offsets=[[0,-15],[14,-8],[14,8],[0,15],[-14,8],[-14,-8]];
 document.querySelectorAll('[data-task]').forEach(button=>{
  const mark=button.querySelector('.task-check');
  mark.setAttribute('aria-hidden','true');
  mark.innerHTML='<i class="task-native-ring"></i><svg viewBox="0 0 22 22"><path d="M5.1 11.2 9 14.7 17 6.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 18" stroke-dashoffset="18"/></svg><span class="task-native-burst">'+offsets.map(([x,y])=>`<i style="--x:${x}px;--y:${y}px"></i>`).join('')+'</span>';
  let animations=[];
  const cancel=()=>{animations.forEach(a=>a.cancel());animations=[];};
  const task={button,touched:false,setDone};tasks.push(task);
  function setDone(done){
   cancel();button.setAttribute('aria-checked',String(done));
   if(done&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&document.body.classList.contains('motion-on')){
    const ring=mark.querySelector('.task-native-ring'),check=mark.querySelector('path'),burst=mark.querySelector('.task-native-burst');
    animations.push(check.animate([{strokeDashoffset:18},{strokeDashoffset:0}],{duration:110,easing:'cubic-bezier(.4,0,.2,1)'}));
    animations.push(ring.animate([{opacity:1,transform:'scale(1)',offset:0},{opacity:0,transform:'scale(1.29)',offset:.58},{opacity:0,transform:'scale(1.5)',offset:1}],{duration:110,easing:'cubic-bezier(.4,0,.2,1)'}));
    animations.push(burst.animate([{opacity:0,transform:'scale(0)',offset:0},{opacity:1,transform:'scale(.02)',offset:.02},{opacity:1,transform:'scale(.3)',offset:.3},{opacity:0,transform:'scale(1)',offset:1}],{duration:500,easing:'cubic-bezier(.25,.1,.25,1)'}));
   }
   const count=document.querySelectorAll('[data-task][aria-checked="true"]').length;document.querySelector('#task-result').textContent=MARCopy.taskSummary(count,tasks.length);
  }
  button.addEventListener('click',()=>{task.touched=true;setDone(button.getAttribute('aria-checked')!=='true');});
  addEventListener('mar:motion',e=>{if(e.detail.paused)cancel();});
 });
 // Start once when the list reaches the middle of the viewport. Never undo
 // a visitor's own choices, and pause the sequence when it is out of view.
 const list=document.querySelector('.task-list');if(!list)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let started=false,finished=false,index=0,elapsed=0,last=0,raf=0;
 function schedule(){if(!raf&&!finished&&!document.hidden)raf=requestAnimationFrame(tick);}
 function tick(now){
  raf=0;if(finished||document.hidden){last=0;return;}
  const r=list.getBoundingClientRect(),visible=r.bottom>100&&r.top<innerHeight*.85;
  if(!started&&r.top<=innerHeight*.52&&r.bottom>innerHeight*.25){started=true;list.dataset.autoCheck='running';}
  if(!started||!visible){last=0;return;}
  if(reduced.matches){for(const task of tasks)if(!task.touched)task.setDone(true);index=tasks.length;}
  else if(document.body.classList.contains('motion-on')){
   elapsed+=last?Math.min(now-last,100):0;last=now;
   if(index<tasks.length&&elapsed>=index*650){const task=tasks[index++];if(!task.touched)task.setDone(true);}
  }else{last=0;return;}
  if(index===tasks.length){finished=true;list.dataset.autoCheck='complete';removeEventListener('scroll',schedule);return;}
  schedule();
 }
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
 addEventListener('mar:motion',()=>{last=0;schedule();});
 document.addEventListener('visibilitychange',()=>{last=0;schedule();});
 reduced.addEventListener('change',schedule);schedule();
})();
