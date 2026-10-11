(function(){
'use strict';
const picker=document.querySelector('.language-picker');if(!picker)return;
const trigger=picker.querySelector('summary'),links=[...picker.querySelectorAll('a')];
function close(restore=false){picker.open=false;if(restore)trigger.focus();}
document.addEventListener('pointerdown',e=>{if(picker.open&&!picker.contains(e.target))close();});
// Safari may blur the summary without focusing a clicked link. Do not close
// on blur: that can hide the link before its click/navigation is dispatched.
picker.addEventListener('keydown',e=>{
 if(e.key==='Tab'){setTimeout(()=>{if(!picker.contains(document.activeElement))close();},0);return;}
 if(e.key==='Escape'&&picker.open){e.preventDefault();close(true);return;}
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){
  e.preventDefault();picker.open=true;
  const index=links.indexOf(document.activeElement),step=e.key==='ArrowDown'?1:-1;
  links[index<0?(step===1?0:links.length-1):(index+step+links.length)%links.length].focus();
 }
});
})();
