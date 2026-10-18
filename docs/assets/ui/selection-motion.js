/* Browser clock for native LiquidChoiceBackdrop: measured frame + analytic spring. */
(function(g){
  'use strict';
  const spec=g.MARSelectionSpec,{mass,stiffness,damping,energyThreshold}=spec.spring;
  const omega0=Math.sqrt(stiffness/mass),zeta=damping/(2*Math.sqrt(stiffness*mass)),omega1=omega0*Math.sqrt(1-zeta*zeta);
  const energy=(x,v)=>(stiffness*x*x+mass*v*v)/2;
  function createMotion(){
    let frame=null,target=null,velocity=[0,0,0,0],initial=[0,0,0,0],initialized=false;
    let alpha=0,from=0,to=0,elapsed=spec.opacityMs;
    function set(next,animate=true){
      if(next){
        if(!initialized||!animate){frame=[...next];velocity.fill(0);initial.fill(0);}
        else if(!target||next.some((v,i)=>v!==target[i]))initial=next.map((v,i)=>energy(frame[i]-v,velocity[i]));
        target=[...next];initialized=true;
      }else{target=null;initialized=false;velocity.fill(0);initial.fill(0);}
      const nextAlpha=next?1:0;
      if(!animate){alpha=from=to=nextAlpha;elapsed=spec.opacityMs;}
      else if(to!==nextAlpha){from=alpha;to=nextAlpha;elapsed=0;}
      return state();
    }
    function tick(ms){
      const t=Math.min(Math.max(ms,0),64)/1000;
      if(target&&frame)for(let i=0;i<4;i++){
        if(!initial[i])continue;
        const x=frame[i]-target[i],v=velocity[i],sin=Math.sin(omega1*t),cos=Math.cos(omega1*t),envelope=Math.exp(-zeta*omega0*t);
        const part=envelope*(sin*((v+zeta*omega0*x)/omega1)+x*cos);
        frame[i]=target[i]+part;
        velocity[i]=-zeta*omega0*part+envelope*(cos*(v+zeta*omega0*x)-omega1*x*sin);
        if(energy(frame[i]-target[i],velocity[i])/initial[i]<=energyThreshold){frame[i]=target[i];velocity[i]=initial[i]=0;}
      }
      elapsed=Math.min(spec.opacityMs,elapsed+Math.max(ms,0));
      const p=elapsed/spec.opacityMs,q=p<.5?2*p*p:1-2*(1-p)*(1-p);
      alpha=from+(to-from)*q;
      return state();
    }
    function state(){return {frame:frame&&[...frame],alpha,active:elapsed<spec.opacityMs||initial.some(Boolean)};}
    return {set,tick,state};
  }
  g.MARSelectionMotion={createMotion};
})(window);
