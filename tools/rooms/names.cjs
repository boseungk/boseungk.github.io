/* App item names, variants and thumbnails per room (reads Dayloom, writes outputs/rooms-png/meta/names.json). */
const B=require('./boot.cjs');const {RC,native,app,fs}=B;
const {drawnProductContent}=native(app+'/src/app-shell/config/drawn-product-content.ts');
const {CATALOG}=native(app+'/src/world/drawn/room/catalog/index.ts');
const {sceneryLabels}=native(app+'/src/app-shell/collection/scenery-labels.ts');
const {PAIRED_SCENERY_KINDS}=native(app+'/src/world/drawn/room/outdoor/paired-scenery.ts');
const path=require('node:path');
const A=path.join(app,'assets/images');   // thumbnails are checked against Dayloom's own decor thumbnails
const HERE=__dirname,META=path.join(HERE,'../../outputs/rooms-png/meta');
const rooms=JSON.parse(fs.readFileSync(path.join(HERE,'rooms.json'),'utf8'));const out={};let missingThumb=[];
for(const r of rooms){const recipe=RC.recommendedCompositions.find(x=>x.id===r.id);
 const scene=RC.compositionScene(recipe),resolved=RC.compositionIngredients(recipe,scene);
 const intentional=Object.entries(recipe.selections).flatMap(([slot,id])=>resolved.filter(it=>it.slotId===`drawn:${slot}`&&it.contentId===id));
 const ordered=[...intentional,...resolved.filter(it=>it.global),...resolved.filter(it=>!it.global&&!intentional.includes(it))];
 const items=ordered.map(it=>{const slot=it.slotId===null?'environment':it.slotId.replace('drawn:','');const id=it.contentId;
  if(slot==='environment'){const L=sceneryLabels(id,'ko-KR');const thumb='/app/decor/scenery-thumbnails/'+id+'.png';if(!fs.existsSync(A+thumb.slice(4)))missingThumb.push(thumb);return {slot:'view',id,name:L.title,variant:L.variant,thumb};}
  const item=drawnProductContent.describe(id);const b=item.binding;const def=CATALOG[b.slot]?.find(c=>c.id===b.definitionId);
  const thumb='/app/decor/thumbnails/'+id+'.png';if(!fs.existsSync(A+thumb.slice(4)))missingThumb.push(thumb);
  const title=item.label;const name=def?def.label:undefined;const appearance=name&&title.startsWith(name+' · ')?title.slice(name.length+3).split(' · ').join(' '):undefined;
  return {slot,id,name:name??title,title,variant:appearance,thumb,legacy:!!item.legacy};});
 out[r.id]={recipeTitle:recipe.title,items,recipeSlots:Object.keys(recipe.selections)};}
fs.mkdirSync(META,{recursive:true});fs.writeFileSync(path.join(META,'names.json'),JSON.stringify(out,null,1));
console.log('missing thumbs',missingThumb.length,missingThumb.slice(0,10));
const ex=out['cherry-soda'];console.log(JSON.stringify(ex.items.map(i=>[i.slot,i.name,i.variant]),null,0), ex.recipeSlots.join(','));
const slots={};for(const o of Object.values(out))for(const i of o.items)slots[i.slot]=(slots[i.slot]||0)+1;console.log(slots);
