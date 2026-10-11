/* Direct use of Dayloom's growth-reveal study, not thumbnail entrance effects. */
import {families,studyFor} from './growth-motion/growth-reveal-recipes.mjs';
import {svg} from './growth-motion/growth-reveal-paths.mjs';
import {createPlantTransition} from './growth-motion/growth-reveal-plant-motion.mjs';
const root=document.querySelector('.growth-live');
if(root&&window.GROWTH_REVEAL_ART){
 const family=families.find(f=>f.kind==='tree'),art=window.GROWTH_REVEAL_ART.tree;
 const host=root.querySelector('.growth-art'),caption=root.querySelector('[data-growth-caption]'),count=root.querySelector('[data-growth-count]');
 const scene=svg('svg',{viewBox:'25 10 210 205',role:'img','aria-label':MARCopy.text('줄기와 가지가 자라며 잎이 펼쳐지는 작은 나무')});
 host.replaceChildren(scene);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let from=0,elapsed=0,raf=0,last=0,visible=false,paused=reduce.matches,motion,study;
 function build(){study=studyFor(family,from);motion=createPlantTransition(scene,art[from],art[from+1],study);motion.seek(0);}
 function paint(){const p=Math.max(0,Math.min(1,(elapsed-900)/study.duration));motion.seek(p);root.dataset.growthStage=String(from+(p===1?1:0));root.dataset.growthProgress=p.toFixed(3);caption.textContent=MARCopy.text(p===1?study.title:family.stages[from]);count.textContent=`0${from+(p===1?2:1)} / 05`;}
 function schedule(){if(!visible||document.hidden||paused){cancelAnimationFrame(raf);raf=0;last=0;return;}if(!raf)raf=requestAnimationFrame(tick);}
 function tick(now){raf=0;if(!visible||document.hidden||paused)return;elapsed+=last?Math.min(now-last,100):0;last=now;paint();if(elapsed>900+study.duration+(from===3?3000:650)){from=(from+1)%4;elapsed=0;build();paint();}schedule();}
 new IntersectionObserver(entries=>{visible=entries[0].intersectionRatio>=.35;schedule();},{threshold:[0,.35]}).observe(root);
 window.addEventListener('mar:motion',e=>{paused=!!e.detail?.paused||reduce.matches;schedule();});document.addEventListener('visibilitychange',schedule);reduce.addEventListener('change',()=>{paused=reduce.matches;if(paused){from=3;build();elapsed=900+study.duration;paint();}schedule();});
 build();if(reduce.matches){from=3;build();elapsed=900+study.duration;}paint();
}
