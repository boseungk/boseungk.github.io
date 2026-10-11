/* The native default room, fitted once and shared by the phone and hero.
   Only its existing wall/floor planes repeat into the wider canvas. */
(function(global){
  'use strict';
  const MASTER_W=1600,MASTER_H=1000;
  const BOX={x0:0,y0:110,x1:1080,y1:1470},ROOM_WIDTH=624,ROOM_TOP=90;
  const PET_CANVAS={width:320,height:360};
  const dimension=(value,fallback)=>Number.isFinite(value)&&value>0?value:fallback;

  global.MARHeroRoom=function(){
    const A=global.DRAWN_APP;
    if(!A||!global.DRAWN_SKIA)throw new Error('Native room renderer has not loaded.');
    const room=A.composeRoom(A.DEFAULT_SELECTION,{season:'spring',lightOn:true});
    const anchor=room.anchors.find(item=>item.id==='floor')||room.anchors[0];
    const events=A.prepareEvents(room),lab=A.makeLab();
    const sets=A.buildCatSets(),coats=A.buildCoat('blackBib');
    const wall=room.back.find(layer=>layer.slot==='wall');
    const floor=room.back.find(layer=>layer.slot==='floor');
    const wallDef=A.CATALOG.wall.find(item=>item.id===wall.id);
    const floorDef=A.CATALOG.floor.find(item=>item.id===floor.id);
    const wrappers=new WeakMap();
    let lastTime=0;
    A.setStage(lab,anchor);
    lab.S.x=A.CAT.origin.restX;
    lab.win=room.windowOpens?1:0;
    lab.ev=A.makeEventsState([16,26],917);

    function geometry(width=MASTER_W,height=MASTER_H){
      width=dimension(width,MASTER_W);height=dimension(height,MASTER_H);
      const unit=height/MASTER_H,k=ROOM_WIDTH/(BOX.x1-BOX.x0)*unit;
      return {width,height,k,x:(width-ROOM_WIDTH*unit)/2-BOX.x0*k,y:ROOM_TOP*unit-BOX.y0*k};
    }

    function getPetPlacement(width=MASTER_W,height=MASTER_H){
      if(typeof width==='object'){height=width.height;width=width.width;}
      const p=geometry(width,height);
      const anchorX=p.x+(A.CAMERA.x+A.ROOM.place.catX*A.CAMERA.s)*p.k;
      const anchorY=p.y+(A.CAMERA.y+anchor.y*A.CAMERA.s)*p.k;
      const nativeScale=p.k*A.CAMERA.s*A.CREATURE_SCALE;
      // MARPet centres CAT.origin.restX and puts its feet at 90% of the canvas.
      const previewScale=Math.min(PET_CANVAS.width/870,PET_CANVAS.height/650);
      const scale=nativeScale/previewScale,widthPx=PET_CANVAS.width*scale,heightPx=PET_CANVAS.height*scale;
      return {x:anchorX-widthPx/2,y:anchorY-heightPx*.9,width:widthPx,height:heightPx,
        anchorX,anchorY,scale,nativeScale,canvasWidth:PET_CANVAS.width,canvasHeight:PET_CANVAS.height};
    }

    function draw(ctx,{width=ctx.canvas.width,height=ctx.canvas.height,time=0,paused=false}={}){
      const p=geometry(width,height),clock=Number.isFinite(time)?time:0;
      const env={tod:0,season:'spring',lightOn:true,tint:room.tint[0],shadow:room.shadowBase,
        now:clock,windowOpen:room.windowOpens?1:0,gust:paused?0:.2+.12*Math.sin(clock*.6),reduced:!!paused};
      if(clock<lastTime)lab.ev=A.makeEventsState([16,26],917);
      if(!paused)A.stepEvents(lab.ev,events,Math.min(Math.max(0,clock-lastTime),.06),clock,env,room.viewTags,true);
      lastTime=clock;
      let g=wrappers.get(ctx);
      if(!g){g=global.DRAWN_SKIA.canvasFor(ctx);wrappers.set(ctx,g);}
      g.begin();
      // Fill the strip above native VIS with the selected wall's own colour.
      ctx.save();ctx.fillStyle=wall.built.c;ctx.fillRect(0,0,p.width,p.height);ctx.restore();
      g.save();
      try{
        g.translate(p.x,p.y);
        g.save();
        try{
          g.scale(p.k,p.k);g.translate(A.CAMERA.x,A.CAMERA.y);g.scale(A.CAMERA.s,A.CAMERA.s);
          const span=A.VIS.x1-A.VIS.x0;
          const tiles=Math.ceil(p.width/(span*p.k*A.CAMERA.s))+1;
          // Continue the native cream wall, oak boards and original baseboard.
          // Furniture is drawn exactly once by drawFrame below.
          for(let tile=-tiles;tile<=tiles;tile++){
            g.save();g.translate(tile*span,0);
            wallDef.back(g,wall.built,env);floorDef.back(g,floor.built,env);
            g.restore();
          }
        }finally{g.restore();}
        A.drawFrame(g,{k:p.k,room,todIdx:0,env,catTint:null,events,dog:null,petVisible:false,
          placement:{surfaceId:anchor.id,x:A.ROOM.place.catX,y:anchor.y,scale:1},
          contactSurfaceId:anchor.id,lift:0},lab,sets,coats,A.CAT.coats.blackBib,clock);
      }finally{g.restore();}
      return ctx.canvas;
    }
    return {draw,getPetPlacement};
  };
})(window);
