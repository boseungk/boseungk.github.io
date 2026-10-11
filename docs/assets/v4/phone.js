/* Native GLB shell. The supplied app canvas owns every display pixel. */
(function(global){'use strict';
global.MARHeroPhone=async function(stage,sourceCanvas){
 const T=global.THREE;if(!T||!T.GLTFLoader)return null;
 let renderer;try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch(error){return null;}
 renderer.setPixelRatio(Math.min(Math.max(global.devicePixelRatio||1,2),3));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.style.cssText='display:block;width:100%;height:100%;';stage.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,100);camera.position.set(0,0,7);camera.lookAt(0,0,0);
 scene.add(new T.AmbientLight(0xffffff,.85));const key=new T.DirectionalLight(0xffffff,1.1);key.position.set(-3,4,6);scene.add(key);const fill=new T.DirectionalLight(0xe8e6e4,.4);fill.position.set(3,0,4);scene.add(fill);
 const env=document.createElement('canvas');env.width=512;env.height=256;const ec=env.getContext('2d');ec.fillStyle='#aaa';ec.fillRect(0,0,512,256);ec.fillStyle='#fff';ec.fillRect(70,20,155,210);ec.fillStyle='#777';ec.fillRect(310,10,105,235);const et=new T.CanvasTexture(env);et.mapping=T.EquirectangularReflectionMapping;const pm=new T.PMREMGenerator(renderer),environment=pm.fromEquirectangular(et);scene.environment=environment.texture;et.dispose();pm.dispose();
 const texture=new T.CanvasTexture(sourceCanvas);texture.encoding=T.sRGBEncoding;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 let model;try{model=await new Promise((resolve,reject)=>new T.GLTFLoader().load('/assets/device/iphone.glb',g=>resolve(g.scene),undefined,reject));}catch(error){texture.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();return null;}
 let display=null;
 model.traverse(mesh=>{if(!mesh.isMesh)return;
  if(mesh.name==='front-glass'){
   const src=mesh.geometry,pos=src.attributes.position,indices=src.index?.array,count=indices?indices.length:pos.count,verts=[],uv=[];src.computeBoundingBox();const z=src.boundingBox.max.z;
   for(let n=0;n<count;n+=3){const ids=[indices?indices[n]:n,indices?indices[n+1]:n+1,indices?indices[n+2]:n+2];if(!ids.every(i=>Math.abs(pos.getZ(i)-z)<.000001))continue;const [a,b,c]=ids;const nz=(pos.getX(b)-pos.getX(a))*(pos.getY(c)-pos.getY(a))-(pos.getY(b)-pos.getY(a))*(pos.getX(c)-pos.getX(a));if(nz<=0)continue;for(const i of ids){const x=pos.getX(i)*(.03425/.03525),y=pos.getY(i)*(.07330/.07430);verts.push(x,y,z+.000016);uv.push((x+.03425)/.0685,(y+.07330)/.1466);}}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingBox();display=new T.Mesh(geometry,new T.MeshBasicMaterial({map:texture,toneMapped:false}));display.name='website-display';mesh.add(display);
   mesh.material=new T.MeshStandardMaterial({color:'#090a0b',roughness:.42,metalness:0,envMapIntensity:.25});
   const shape=new T.Shape(),w=.0198,h=.0052,r=h/2,x=-w/2,y=.0649;shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
   const island=new T.Mesh(new T.ShapeGeometry(shape,18),new T.MeshBasicMaterial({color:'#08090b'}));island.position.z=z+.00003;island.name='website-camera-island';mesh.add(island);
  }else if(!mesh.name.startsWith('website-')){mesh.material=new T.MeshStandardMaterial({color:mesh.name.includes('lens')?'#181c20':'#383a3c',roughness:.58,metalness:.65,envMapIntensity:.35});}
 });
 let box=new T.Box3().setFromObject(model);model.scale.setScalar(3.35/box.getSize(new T.Vector3()).y);box.setFromObject(model);model.position.sub(box.getCenter(new T.Vector3()));scene.add(model);model.updateMatrixWorld(true);box.setFromObject(model);const modelSize=box.getSize(new T.Vector3());let width=0,height=0,dead=false;
 function resize(){if(dead)return; width=stage.clientWidth;height=stage.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);const aspect=width/height,viewHeight=Math.max(modelSize.y/.94,modelSize.x/(aspect*.94));camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.right=viewHeight*aspect/2;camera.left=-camera.right;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
 function getScreenRect(){if(!display||!width||!height)return null;model.updateMatrixWorld(true);const b=display.geometry.boundingBox;const points=[new T.Vector3(b.min.x,b.min.y,b.max.z),new T.Vector3(b.max.x,b.min.y,b.max.z),new T.Vector3(b.min.x,b.max.y,b.max.z),new T.Vector3(b.max.x,b.max.y,b.max.z)].map(p=>{p.applyMatrix4(display.matrixWorld).project(camera);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2};});const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),w=Math.max(...points.map(p=>p.x))-x,h=Math.max(...points.map(p=>p.y))-y;return{x,y,width:w,height:h,radius:w*.21702,radiusX:w*.21702,radiusY:w*.22179};}
 function render(){if(dead)return;if(width!==stage.clientWidth||height!==stage.clientHeight)resize();if(!width||!height)return;texture.needsUpdate=true;renderer.render(scene,camera);}
 function destroy(){if(dead)return;dead=true;model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(m=>m.dispose());});texture.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();delete stage.dataset.ready;}
 resize();render();stage.dataset.ready='true';return{render,resize,getScreenRect,destroy};
};
})(window);
