/* Native FocusPrep / FocusSessionHud proportions and focusFlightMotion choreography.
   A presentation adapter: the app remains read-only; the root owns time and world. */
(function (global) {
  'use strict';
  const W=780,H=1669,worldRect={x:0,y:0,width:780,height:1250};
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const cubic=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  // Exact sampling used by focusFlightMotion, prep exit and HUD entry.
  function bezier(value,[x1,y1,x2,y2]){
    if(value<=0)return 0;if(value>=1)return 1;
    const ax=1-3*x2+3*x1,bx=3*x2-6*x1,cx=3*x1;
    let t=value,low=0,high=1;
    for(let i=0;i<16;i++){
      const x=((ax*t+bx)*t+cx)*t,delta=x-value;
      if(Math.abs(delta)<1e-7)break;
      if(delta<0)low=t;else high=t;
      const derivative=(3*ax*t+2*bx)*t+cx,candidate=derivative>1e-7?t-delta/derivative:NaN;
      t=candidate>low&&candidate<high?candidate:(low+high)/2;
    }
    return ((1-3*y2+3*y1)*t+(3*y2-6*y1))*t*t+3*y1*t;
  }
  global.MARHeroScreen=function () {
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    // Keep text rasterized above the largest displayed Retina size.
    canvas.width=W*2;canvas.height=H*2;
    const ctx=canvas.getContext('2d');
    ctx.scale(2,2);
    const layout={source:{x:295,y:1130,w:144,h:216},target:{x:214,y:1360,w:120,h:180}};
    const glass=document.createElement('canvas');glass.width=240;glass.height=360;
    const gc=glass.getContext('2d');
    function text(s,x,y,size,color='#473e3b',align='left',max) {
      ctx.font=`400 ${size}px Line, sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,x,y,max);
    }
    function timer(value,x,y){
      // Native 48pt type at 2x, tabular digits, and -1.4pt tracking.
      // Canvas has no portable tabular-numeral control; fixed cells keep every frame stable.
      const size=96,tracking=2.8,digitWidth=size*.656;
      ctx.font=`400 ${size}px Line, sans-serif`;ctx.textAlign='center';ctx.fillStyle='#473e3b';
      for(const glyph of value){
        const width=glyph===':'?size*.232:digitWidth;
        ctx.fillText(glyph,x+width/2,y);x+=width-tracking;
      }
    }
    function round(x,y,w,h,r,color) {ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
    function line(x1,y1,x2,y2,color='#e5e5e5',width=2) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
    function status(){text('9:41',64,65,29);ctx.fillStyle='#473e3b';for(let i=0;i<4;i++)ctx.fillRect(627+i*10,60-(i+1)*4,6,(i+1)*4);ctx.strokeStyle='#473e3b';ctx.lineWidth=2;ctx.strokeRect(692,42,40,20);ctx.fillRect(695,45,30,14);ctx.fillRect(734,48,3,8);round(268,1633,244,9,4.5,'#473e3b');}
    function draw({progress=0,time=0,paused=false,worldCanvas,hideHourglass=false,hudReveal=1}={}) {
      const p=clamp(progress),flight=clamp((p-.15)/.5),flightMs=flight*1000;
      ctx.clearRect(0,0,W,H);ctx.fillStyle='#DCC6A8';ctx.fillRect(0,0,W,H);
      if(worldCanvas&&worldCanvas.width&&worldCanvas.height){
        // Exact centre cover. The same source crop is the expansion's initial frame.
        const scale=Math.max(worldRect.width/worldCanvas.width,worldRect.height/worldCanvas.height);
        const sw=worldRect.width/scale,sh=worldRect.height/scale;
        ctx.drawImage(worldCanvas,(worldCanvas.width-sw)/2,(worldCanvas.height-sh)/2,sw,sh,0,0,worldRect.width,worldRect.height);
      }
      // Continue the oak floor behind the transparent session HUD.
      // Blend within the room, rather than introducing a separate white panel.
      const floorBlend=ctx.createLinearGradient(0,1080,0,1250);floorBlend.addColorStop(0,'rgba(220,198,168,0)');floorBlend.addColorStop(1,'#DCC6A8');ctx.fillStyle=floorBlend;ctx.fillRect(0,1080,W,H-1080);
      // RN focus-overlay.tsx: focusPaperWashStops, using Oat day paperSheet (#FFFFFF).
      // focus-flight-motion.ts reveals this wash at the 580ms return-flight boundary.
      if(flightMs>=580){
        const wash=ctx.createLinearGradient(0,0,0,H);
        for(const [offset,alpha] of [[0,0],[.48,0],[.72,.58],[1,.88]])wash.addColorStop(offset,`rgba(255,255,255,${alpha})`);
        ctx.fillStyle=wash;ctx.fillRect(0,0,W,H);
      }
      const prepOpacity=1-bezier((flightMs-580)/180,[.4,0,1,1]);
      const hudOpacity=bezier((flightMs-730)/240,[.25,.1,.25,1])*hudReveal;
      if(prepOpacity>0){ctx.save();ctx.globalAlpha=prepOpacity;ctx.translate(0,40*(1-prepOpacity));
        round(0,865,W,H-865,44,'#fff');text('집중할 시간',390,967,44,'#473e3b','center');
        ctx.strokeStyle='#473e3b';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(90,933);ctx.lineTo(76,947);ctx.lineTo(90,961);ctx.stroke();line(48,1004,732,1004);
        line(110,1138,138,1138,'#5f5551',3);text('25',392,1160,84);text('분',503,1158,36);text('오후 2:25에 마쳐요',392,1203,26,'#776b66');text('+',659,1157,52,'#5f5551','center');
        line(82,1270,698,1270,'#e5e5e5',6);line(82,1270,310,1270,'#e1cabf',6);round(298,1258,24,24,12,'#e1cabf');
        text('책 한 챕터',74,1385,32);line(48,1420,732,1420);round(48,1460,684,96,24,'#e1cabf');text('집중 시작',390,1522,34,'#473e3b','center');
        ctx.restore();
      }
      if(hudOpacity>0){ctx.save();ctx.globalAlpha=hudOpacity;
        const elapsed=Math.round(clamp((p-.65)/.35)*192),minutes=Math.floor(elapsed/60),seconds=elapsed%60;
        text('책 한 챕터 · 25분',303,1303,32,'#5f5551');timer(String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0'),297,1410);
        ctx.strokeStyle='#473e3b';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(390,1518,33,0,Math.PI*2);ctx.stroke();round(382,1510,16,16,2.6,'#473e3b');text('길게 눌러 마치기',390,1590,26,'#776b66','center');ctx.restore();
      }
      // Native flip: 520ms ease-in/out cubic, followed by its 580–1000ms flight.
      const move=bezier((flightMs-580)/420,[.32,.72,.24,1]),rotation=flightMs<520?Math.PI*cubic(clamp(flightMs/520)):0;
      const x=layout.source.x+(layout.target.x-layout.source.x)*move,y=layout.source.y+(layout.target.y-layout.source.y)*move;
      const gw=144+(120-144)*move,gh=216+(180-216)*move;
      if(!hideHourglass){
        gc.clearRect(0,0,240,360);
        if(global.MARLandscape)global.MARLandscape.drawHourglass(gc,{width:240,height:360,progress:p>.65?clamp((p-.65)/.35)*.128:0,time,paletteId:'dawn',restingFill:flightMs<520?.5294:undefined,initialFill:.5294,flipProgress:flightMs>0&&flightMs<520?clamp(flightMs/520):undefined,angle:rotation*180/Math.PI});
        ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(glass,-gw/2,-gh/2,gw,gh);ctx.restore();
      }
      status();return canvas;
    }
    return {canvas,draw,getHourglassLayout(){return layout;},getWorldRect(){return {...worldRect};}};
  };
})(window);
