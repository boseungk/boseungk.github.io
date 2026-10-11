(function(){
'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches;
// Keep all text readable; animate only the app's quiet, irregular colour wash.
const accentObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.style.setProperty('--accent-reveal','1');accentObserver.unobserve(entry.target);}}),{threshold:.7});
document.querySelectorAll('.tools-heading h2,.growth-copy h2').forEach(heading=>{const br=heading.querySelector('br');if(!br||!br.nextSibling||br.nextSibling.nodeType!==3)return;const text=br.nextSibling,span=document.createElement('span');span.className='heading-accent';span.textContent=text.textContent;text.replaceWith(span);span.style.setProperty('--accent-reveal',paused?'1':'0');accentObserver.observe(span);});
window.addEventListener('mar:motion',e=>{paused=!!e.detail?.paused||reduced.matches;if(paused){document.querySelectorAll('.heading-accent').forEach(el=>el.style.setProperty('--accent-reveal','1'));}});
})();
