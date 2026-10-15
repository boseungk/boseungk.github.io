(function(){
'use strict';
const picker=document.querySelector('.language-picker');if(!picker)return;
const trigger=picker.querySelector('summary'),links=[...picker.querySelectorAll('a')];
const search=picker.querySelector('[data-language-search-input]'),empty=picker.querySelector('[data-language-empty]');
const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
function filter(){
 const query=normalize(search.value);let visible=0;
 links.forEach(link=>{const match=normalize(link.dataset.languageSearch).includes(query);link.parentElement.hidden=!match;if(match)visible++;});
 empty.hidden=visible>0;
}
if(search)search.addEventListener('input',filter);
function close(restore=false){picker.open=false;if(search){search.value='';filter();}if(restore)trigger.focus();}
document.addEventListener('pointerdown',e=>{if(picker.open&&!picker.contains(e.target))close();});
// Safari may blur the summary without focusing a clicked link. Do not close
// on blur: that can hide the link before its click/navigation is dispatched.
picker.addEventListener('keydown',e=>{
 if(e.key==='Tab'){setTimeout(()=>{if(!picker.contains(document.activeElement))close();},0);return;}
 if(e.key==='Escape'&&picker.open){e.preventDefault();close(true);return;}
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){
  e.preventDefault();picker.open=true;
  const visible=search?links.filter(link=>!link.parentElement.hidden):links;if(!visible.length)return;
  const index=visible.indexOf(document.activeElement),step=e.key==='ArrowDown'?1:-1;
  visible[index<0?(step===1?0:visible.length-1):(index+step+visible.length)%visible.length].focus();
 }
});
// Keep a shared suggestion and the corresponding section when changing language.
links.forEach(link=>link.addEventListener('click',()=>{
 const target=new URL(link.href,location.href);
 if(location.hash)target.hash=location.hash;
 link.href=target.href;
}));
})();
