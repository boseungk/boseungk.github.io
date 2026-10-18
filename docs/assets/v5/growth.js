import {createFlowerScene} from './growth-flower.mjs';
import {createGrowthClock} from './growth-clock.mjs';

const root=document.querySelector('.growth-live');
if(root){
  const host=root.querySelector('.growth-art'),caption=root.querySelector('[data-growth-caption]'),count=root.querySelector('[data-growth-count]');
  const labels=[MARCopy.text('씨앗'),MARCopy.text('새싹'),MARCopy.text('줄기'),MARCopy.text('봉오리'),MARCopy.text('꽃')];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),clock=createGrowthClock();
  const flower=createFlowerScene();
  let raf=0,stage=-1;
  function paint(){
    const {transition,progress}=flower.draw(clock.elapsed);
    const current=transition+(progress===1?1:0);
    root.dataset.growthStage=String(current);
    root.dataset.growthProgress=progress.toFixed(3);
    if(current!==stage){stage=current;caption.textContent=labels[stage];count.textContent=`0${stage+1} / 05`;}
  }
  function schedule(){
    if(!clock.running){cancelAnimationFrame(raf);raf=0;return;}
    if(!raf)raf=requestAnimationFrame(tick);
  }
  function tick(now){raf=0;clock.tick(now);paint();schedule();}
  function update(state){clock.set(state);paint();schedule();}
  clock.set({reduced:reduce.matches,hidden:document.hidden,paused:document.querySelector('#motion-toggle')?.getAttribute('aria-pressed')==='true'});
  paint();host.replaceChildren(flower.scene);
  new IntersectionObserver(entries=>update({visible:entries[0].intersectionRatio>=.8}),{threshold:[0,.8]}).observe(root);
  window.addEventListener('mar:motion',e=>update({paused:!!e.detail?.paused}));
  document.addEventListener('visibilitychange',()=>update({hidden:document.hidden}));
  reduce.addEventListener('change',()=>update({reduced:reduce.matches}));
}
