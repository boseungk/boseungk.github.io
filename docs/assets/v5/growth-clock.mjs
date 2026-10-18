import {FLOWER_DURATION_MS} from './growth-motion/onboarding-flower-motion.mjs';

/** Like OnboardingFlower: resume remaining time and retain the finished flower. */
export function createGrowthClock() {
  let elapsed=0,last=null,visible=false,hidden=false,paused=false,reduced=false;
  const running=()=>visible&&!hidden&&!paused&&!reduced&&elapsed<FLOWER_DURATION_MS;
  return {
    get elapsed(){return reduced?FLOWER_DURATION_MS:elapsed;},
    get running(){return running();},
    set(state){
      if('visible'in state)visible=state.visible;
      if('hidden'in state)hidden=state.hidden;
      if('paused'in state)paused=state.paused;
      if('reduced'in state)reduced=state.reduced;
      last=null;
    },
    tick(now){
      if(!running()){last=null;return this.elapsed;}
      if(last!==null)elapsed=Math.min(FLOWER_DURATION_MS,elapsed+Math.max(0,now-last));
      last=now;return elapsed;
    },
  };
}
