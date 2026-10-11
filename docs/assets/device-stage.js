/* Phone geometry / screen UV approach adapted from HyperFrames vfx-iphone-device.
   Standard WebGL only. No experimental HTML-in-canvas API or third-party requests. */
(function(global){
  'use strict';
  global.MARDevice = async function(stage, worldCanvas){
    const T=global.THREE;
    if(!T) return null;
    let renderer;
    try {renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});} catch(e){return null;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    renderer.outputEncoding=T.sRGBEncoding;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    renderer.domElement.setAttribute('aria-hidden','true');
    stage.appendChild(renderer.domElement);
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(31,1,.1,100), group=new T.Group();
    scene.add(group); camera.position.set(0,0,7.2);
    scene.add(new T.AmbientLight(0xffffff,1.6));
    const key=new T.DirectionalLight(0xffffff,3);key.position.set(3,5,4);scene.add(key);
    const fill=new T.DirectionalLight(0xffdfc3,1.1);fill.position.set(-4,1,3);scene.add(fill);
    const env=document.createElement('canvas');env.width=512;env.height=256;
    const ec=env.getContext('2d'),gradient=ec.createLinearGradient(0,0,512,0);
    [[0,'#323234'],[.18,'#f2f1ee'],[.32,'#545457'],[.52,'#ffffff'],[.67,'#323234'],[.8,'#eeeeee'],[1,'#545457']].forEach(([n,c])=>gradient.addColorStop(n,c));
    ec.fillStyle=gradient;ec.fillRect(0,0,512,256);
    const et=new T.CanvasTexture(env);et.mapping=T.EquirectangularReflectionMapping;
    const pm=new T.PMREMGenerator(renderer);const envTarget=pm.fromEquirectangular(et);scene.environment=envTarget.texture;et.dispose();pm.dispose();
    const screen=document.createElement('canvas');screen.width=780;screen.height=1688;const sc=screen.getContext('2d');
    const tex=new T.CanvasTexture(screen);tex.encoding=T.sRGBEncoding;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    const images=await Promise.all(['actions','memory','home'].map(name=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src='/assets/screens/'+name+'.webp';})));
    let model,progress=0,screenIndex=-1,visible=true,paused=false,raf=0,last=0,dirty=true;
    try{
      model=await new Promise((resolve,reject)=>new T.GLTFLoader().load('/assets/device/iphone.glb',g=>resolve(g.scene),undefined,reject));
      let box=new T.Box3().setFromObject(model);model.scale.setScalar(3.28/box.getSize(new T.Vector3()).y);box.setFromObject(model);model.position.sub(box.getCenter(new T.Vector3()));
      model.traverse(mesh=>{if(!mesh.isMesh)return; if(mesh.name==='body'||mesh.name==='rear-window'||mesh.name.includes('button')){mesh.material.color?.set('#8c8985');mesh.material.roughness=.26;mesh.material.metalness=.85;} if(mesh.name.startsWith('front-glass')){
        const geo=mesh.geometry;geo.computeBoundingBox();const b=geo.boundingBox,pos=geo.attributes.position,uv=new Float32Array(pos.count*2);
        for(let i=0;i<pos.count;i++){uv[i*2]=(pos.getX(i)-b.min.x)/(b.max.x-b.min.x);uv[i*2+1]=(pos.getY(i)-b.min.y)/(b.max.y-b.min.y);}
        geo.setAttribute('uv',new T.BufferAttribute(uv,2));mesh.material=new T.MeshBasicMaterial({map:tex,toneMapped:false});
      }});
      // Current registry model's display faces +Z, toward this camera.
      group.add(model);stage.dataset.ready='true';
    }catch(error){renderer.dispose();renderer.domElement.remove();console.warn('Phone model unavailable; retaining the native screen.');return null;}
    function drawScreen(index){
      const im=images[index===2?1:0];
      sc.save();sc.fillStyle='#181819';sc.fillRect(0,0,780,1688);sc.beginPath();sc.roundRect(13,13,754,1662,75);sc.clip();
      sc.fillStyle=index===0?'#e9e2e2':index===1?'#f1e7d3':'#fcf9f9';sc.fillRect(0,0,780,1688);
      if(index===1 && worldCanvas.width>0){
        sc.drawImage(worldCanvas,0,0,worldCanvas.width,worldCanvas.height,0,0,780,1688);
      }else if(im){
        // Preserve the capture's ratio; pad around its content instead of stretching it.
        const factor=Math.min(780/im.width,1500/im.height);const w=im.width*factor,h=im.height*factor;
        sc.drawImage(im,(780-w)/2,105,w,h);
      }
      sc.restore();sc.fillStyle='#111113';sc.beginPath();sc.roundRect(275,33,230,61,31);sc.fill();
      tex.needsUpdate=true;screenIndex=index;
    }
    function render(t){raf=0;if(!visible||document.hidden)return;if(t-last<33&&!dirty){schedule();return;}last=t;
      const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
      if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
      const idx=Math.min(2,Math.floor(progress*3));
      if(idx!==screenIndex||idx===1||dirty)drawScreen(idx);
      const p=progress*3-idx;
      group.rotation.set(.055*Math.sin(progress*Math.PI*2),(-.46+.76*Math.sin(progress*Math.PI))*Math.min(1,w/500),-.07+.11*progress);
      group.position.y=.035*Math.sin(progress*Math.PI*2);
      camera.position.z=w/h<.65?7.1:6.9;
      renderer.render(scene,camera);dirty=false;if(idx===1&&!paused)schedule();
    }
    function schedule(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(render);}
    const observer=new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible){dirty=true;schedule();}else if(raf){cancelAnimationFrame(raf);raf=0;}});observer.observe(stage);
    const size=new ResizeObserver(()=>{dirty=true;schedule();});size.observe(stage);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){dirty=true;schedule();}});
    schedule();
    return {set(p){progress=Math.max(0,Math.min(.999,p));dirty=true;schedule();},pause(v){paused=v;dirty=true;schedule();},destroy(){observer.disconnect();size.disconnect();if(raf)cancelAnimationFrame(raf);renderer.dispose();tex.dispose();envTarget.dispose();}};
  };
})(window);
