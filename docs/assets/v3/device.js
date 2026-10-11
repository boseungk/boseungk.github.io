/* GLB display surface extracted from the actual front face; artwork never covers the rim.
   Web presentation follows FocusSessionHud and FocusCompletionCard layout and tokens. */
(function(global){'use strict';
const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
global.MARDeviceV3=async function(stage){
 const T=global.THREE;let renderer;try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch(e){return null;}
 renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,2),3));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.domElement.setAttribute('aria-hidden','true');stage.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.1,100),group=new T.Group();scene.add(group);camera.position.set(0,0,7.25);
 scene.add(new T.AmbientLight(0xffffff,.7));const key=new T.DirectionalLight(0xffffff,1.25);key.position.set(-3,4,6);scene.add(key);const fill=new T.DirectionalLight(0xe8e6e4,.35);fill.position.set(3,0,4);scene.add(fill);
 const env=document.createElement('canvas');env.width=512;env.height=256;const ec=env.getContext('2d');ec.fillStyle='#b4b4b4';ec.fillRect(0,0,512,256);ec.fillStyle='#ffffff';ec.fillRect(70,20,155,210);ec.fillStyle='#777777';ec.fillRect(310,10,105,235);const et=new T.CanvasTexture(env);et.mapping=T.EquirectangularReflectionMapping;const pm=new T.PMREMGenerator(renderer),environment=pm.fromEquirectangular(et);scene.environment=environment.texture;et.dispose();pm.dispose();
 const screen=document.createElement('canvas');screen.width=1560;screen.height=3338;const ctx=screen.getContext('2d'),texture=new T.CanvasTexture(screen);ctx.scale(2,2);texture.encoding=T.sRGBEncoding;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const pet=MARPet('cat'),petCanvas=document.createElement('canvas');petCanvas.width=320;petCanvas.height=360;const pc=petCanvas.getContext('2d');
 const hg=document.createElement('canvas');hg.width=112;hg.height=168;const hc=hg.getContext('2d');const sun=document.createElement('canvas');sun.width=96;sun.height=96;MARLandscape.drawTimeMark(sun.getContext('2d'),{width:96,height:96,phase:'daytime',time:950});
 const icons={};for(const name of ['collection','memory','focus','decor','actions']){const c=document.createElement('canvas');c.width=c.height=128;const g=DRAWN_SKIA.canvasFor(c.getContext('2d'));g.begin();g.scale(2,2);DRAWN_APP.drawHomeIcon(g,name);icons[name]=c;}
 const memoryPhoto=document.createElement('canvas');memoryPhoto.width=memoryPhoto.height=180;MARLandscape.draw(memoryPhoto.getContext('2d'),{scene:'study-pink-muhly',width:180,height:180,tod:0,time:0,reduced:true});
 let model;try{model=await new Promise((res,rej)=>new T.GLTFLoader().load('/assets/device/iphone.glb',g=>res(g.scene),undefined,rej));}catch(e){renderer.dispose();renderer.domElement.remove();return null;}
 model.traverse(mesh=>{if(!mesh.isMesh)return;
  if(mesh.name==='front-glass'){
   const src=mesh.geometry,positions=src.attributes.position,indices=src.index?.array,count=indices?indices.length:positions.count,verts=[],uv=[];src.computeBoundingBox();const z=src.boundingBox.max.z;
   for(let n=0;n<count;n+=3){const ids=[indices?indices[n]:n,indices?indices[n+1]:n+1,indices?indices[n+2]:n+2];if(!ids.every(i=>Math.abs(positions.getZ(i)-z)<.000001))continue;const [a,b,c]=ids;const nz=(positions.getX(b)-positions.getX(a))*(positions.getY(c)-positions.getY(a))-(positions.getY(b)-positions.getY(a))*(positions.getX(c)-positions.getX(a));if(nz<=0)continue;for(const i of ids){const x=positions.getX(i)*(.03425/.03525),y=positions.getY(i)*(.07330/.07430);verts.push(x,y,z+.000016);uv.push((x+.03425)/.0685,(y+.07330)/.1466);}}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();const display=new T.Mesh(geometry,new T.MeshBasicMaterial({map:texture,toneMapped:false}));display.name='website-display';mesh.add(display);
   mesh.material=new T.MeshStandardMaterial({color:'#090a0b',roughness:.42,metalness:0,envMapIntensity:.25});
   // A physical camera island on the glass, independent of UI texture/safe areas.
   const shape=new T.Shape(),w=.0198,h=.0052,r=h/2,x=-w/2,y=.0649;
   shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
   const island=new T.Mesh(new T.ShapeGeometry(shape,18),new T.MeshBasicMaterial({color:'#08090b'}));island.position.z=z+.00003;island.name='website-camera-island';mesh.add(island);
  }else if(!mesh.name.startsWith('website-')){mesh.material=new T.MeshStandardMaterial({color:mesh.name.includes('lens')?'#181c20':'#383a3c',roughness:.58,metalness:.65,envMapIntensity:.35});}
 });
 let box=new T.Box3().setFromObject(model);model.scale.setScalar(3.35/box.getSize(new T.Vector3()).y);box.setFromObject(model);model.position.sub(box.getCenter(new T.Vector3()));group.add(model);stage.dataset.ready='true';
 let p=0,time=0,last=0,paused=false,visible=true,raf=0,dirty=true;
 function text(str,x,y,size=32,color='#473e3b',align='left',max){ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`400 ${size}px Line, sans-serif`;ctx.fillText(str,x,y,max);}
 function round(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
 const nativeScreen=MARHeroScreen(),nativeRoom=MARHeroRoom(),roomCanvas=document.createElement('canvas');roomCanvas.width=1600;roomCanvas.height=1000;const rc=roomCanvas.getContext('2d');
 function phoneBase(dt,showPet=true){nativeRoom.draw(rc,{width:1600,height:1000,time,paused});if(showPet){pc.clearRect(0,0,320,360);pet.draw(pc,{width:320,height:360,dt,time,reduced:paused,autonomous:false});const at=nativeRoom.getPetPlacement(1600,1000);rc.drawImage(petCanvas,at.x,at.y,at.width,at.height);}nativeScreen.draw({progress:1,time,paused,worldCanvas:roomCanvas,hideHourglass:!showPet});ctx.drawImage(nativeScreen.canvas,0,0,780,1669);}
 function statusBar(){text('9:41',64,65,29,'#473e3b');ctx.fillStyle='#473e3b';for(let i=0;i<4;i++)ctx.fillRect(627+i*10,60-(i+1)*4,6,(i+1)*4);ctx.strokeStyle='#473e3b';ctx.lineWidth=2;ctx.strokeRect(692,42,40,20);ctx.fillRect(695,45,30,14);ctx.fillRect(734,48,3,8);}
 function dock(){const names=['collection','memory','focus','decor','actions'];names.forEach((name,i)=>ctx.drawImage(icons[name],62+i*142,1496,88,88));}
 function renderScreen(dt){ctx.clearRect(0,0,780,1669);const completion=p>=.36&&p<.68,returning=p>=.58&&p<.77,mem=p>=.77;
  if(mem){
   // MemoryDayScreen: 24pt page inset, 14pt month, 28pt day, 17/30pt prose.
   // One consistent public demo record follows the 25-minute Focus session above.
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,780,1669);text('기억',390,157,38,'#473e3b','center');ctx.strokeStyle='#473e3b';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(83,132);ctx.lineTo(68,147);ctx.lineTo(83,162);ctx.stroke();
   text('2026년 10월',48,251,28,'#5f5551');text('11일 일요일',48,325,56);ctx.save();ctx.beginPath();ctx.roundRect(620,226,112,112,20);ctx.clip();ctx.drawImage(memoryPhoto,620,226,112,112);ctx.restore();text('나의 공간',676,368,23,'#5f5551','center');
   text('책을 조금 읽고,',48,480,34);text('생각도 천천히 정리했다.',48,540,34);text('서두르지 않아도 괜찮은 하루.',48,660,34);
   ctx.strokeStyle='#e5e5e5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(48,1250);ctx.lineTo(732,1250);ctx.stroke();text('그날의 흔적',48,1308,28,'#776b66');ctx.drawImage(sun,48,1346,40,40);text('오후 2:25',108,1378,26,'#776b66');text('책 한 챕터',280,1378,30,'#5f5551');text('25분',732,1378,28,'#776b66','right');
  }
  else{phoneBase(dt,p<.58);if(p<.36){/* Shared RN Focus HUD is already drawn by phoneBase. */}
   else dock();
   if(completion){const alpha=1-smooth((p-.58)/.1);ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='rgba(40,34,30,.18)';ctx.fillRect(0,0,780,1669);round(42,490,696,635,36,'#ffffff');text('집중을 마쳤어요',390,560,34,'#5f5551','center');hc.clearRect(0,0,112,168);MARLandscape.drawHourglass(hc,{width:112,height:168,progress:1,time,paletteId:'dawn'});ctx.drawImage(hg,334,595);text('25분 동안 집중했어요',390,838,49,'#473e3b','center');if(p<.58)ctx.drawImage(sun,216,878,42,42);text('오늘의 기억에 남겼어요',440,911,31,'#5f5551','center');round(90,984,600,96,24,'#e1cabf');text('확인',390,1045,34,'#473e3b','center');ctx.restore();}
   if(returning){const t=smooth((p-.58)/.17),x=237+(247-237)*t,y=899+(1540-899)*t-Math.sin(t*Math.PI)*230,s=42-14*t;ctx.save();ctx.translate(x,y);ctx.rotate(t*.14);ctx.globalAlpha=1-smooth((t-.9)/.1);ctx.drawImage(sun,-s/2,-s/2,s,s);ctx.restore();}
  }
  statusBar();round(268,1633,244,9,4.5,'#473e3b');texture.needsUpdate=true;
 }
 function paint(now){raf=0;if(!visible||document.hidden)return;if(now-last<33&&!dirty){schedule();return;}const dt=last?Math.max(0,Math.min((now-last)/1000,.06)):.033;last=now;if(!paused)time+=dt;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;const pixel=renderer.getPixelRatio();if(renderer.domElement.width!==Math.floor(w*pixel)||renderer.domElement.height!==Math.floor(h*pixel)){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  renderScreen(dt);group.rotation.set(0,0,0);camera.position.z=camera.aspect<.72?7.4:7.25;renderer.render(scene,camera);dirty=false;if(!paused&&p<.77)schedule();}
 function schedule(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(paint);}
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=0;dirty=true;schedule();}else if(raf){cancelAnimationFrame(raf);raf=0;}},{rootMargin:'40px'});observer.observe(stage);const resize=new ResizeObserver(()=>{dirty=true;schedule();});resize.observe(stage);document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden){dirty=true;schedule();}});
 paint(performance.now());
 return{set(value){p=clamp(value);dirty=true;schedule();},pause(value){paused=value;dirty=true;schedule();},setAnimal(value){pet.setAnimal(value);dirty=true;schedule();},destroy(){observer.disconnect();resize.disconnect();if(raf)cancelAnimationFrame(raf);renderer.dispose();texture.dispose();environment.dispose();}};
};
})(window);
