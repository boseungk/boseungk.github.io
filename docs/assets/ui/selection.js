/* Apply the app's measured-label selection behavior to web focus/hover and phase groups. */
(function(){
  'use strict';
  const spec=MARSelectionSpec,reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let pagePaused=reduce.matches;
  const ns='http://www.w3.org/2000/svg',controllers=[];
  document.documentElement.style.setProperty('--choice-x',spec.padding.x+'px');
  document.documentElement.style.setProperty('--choice-y',spec.padding.y+'px');
  document.documentElement.style.setProperty('--choice-ink',spec.ink);
  document.documentElement.style.setProperty('--choice-muted',spec.muted);
  function labelFor(item){
    let label=item.querySelector('[data-language-current],bdi,.customize-item-label,.mar-choice-label');
    if(!label){
      label=document.createElement('span');
      [...item.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).forEach(n=>label.append(n));
      item.prepend(label);
    }
    label.classList.add('mar-choice-label');return label;
  }
  function mount(group,items,selected=()=>null,interactive=true){
    if(!group||!items.length)return;
    group.classList.add('mar-choice-group');
    const labels=new Map(items.map(item=>[item,labelFor(item)]));
    const svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
    svg.setAttribute('width','0');svg.setAttribute('height','0');svg.classList.add('mar-choice-wash');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    path.setAttribute('fill',spec.fill);svg.append(path);group.prepend(svg);
    const motion=MARSelectionMotion.createMotion();let hovered=null,raf=0,last=0,lastTarget='';
    function paint(state){if(state.frame)path.setAttribute('d',spec.path(state.frame));svg.style.opacity=String(state.alpha);}
    function active(){return !pagePaused&&!reduce.matches&&!document.hidden;}
    function tick(now){raf=0;const state=motion.tick(last?now-last:0);last=now;paint(state);if(state.active&&active())raf=requestAnimationFrame(tick);}
    function refresh(){
      const focused=items.find(item=>item.contains(document.activeElement));
      const item=focused||hovered||selected();
      const base=group.getBoundingClientRect();
      let frame=null;
      if(item&&labels.has(item)&&!item.closest('[hidden]')){
        const r=labels.get(item).getBoundingClientRect();
        if(r.width>0&&r.height>0)frame=[r.left-base.left+group.scrollLeft,r.top-base.top+group.scrollTop,r.width,r.height];
      }
      svg.style.width=group.clientWidth+'px';
      svg.style.height=Math.max(group.clientHeight,...items.map(i=>i.getBoundingClientRect().bottom-base.top+group.scrollTop))+'px';
      const key=JSON.stringify(frame),animate=active();
      if(key===lastTarget&&animate)return;
      lastTarget=key;paint(motion.set(frame,animate));
      if(!animate){cancelAnimationFrame(raf);raf=0;last=0;}
      else if(motion.state().active&&!raf){last=performance.now();raf=requestAnimationFrame(tick);}
    }
    if(interactive){
      items.forEach(item=>item.addEventListener('pointerenter',()=>{hovered=item;refresh();}));
      group.addEventListener('pointerleave',()=>{hovered=null;refresh();});
      group.addEventListener('focusin',refresh);group.addEventListener('focusout',()=>queueMicrotask(refresh));
    }
    new MutationObserver(refresh).observe(group,{subtree:true,attributes:true,attributeFilter:['data-current','aria-current','aria-pressed','class','hidden','open']});
    const resize=new ResizeObserver(refresh);resize.observe(group);labels.forEach(label=>resize.observe(label));
    controllers.push(refresh);document.fonts.ready.then(refresh);refresh();
  }
  const each=(selector,fn)=>document.querySelectorAll(selector).forEach(fn);
  each('.header nav,.site-nav,.footer nav,.footer-nav,.feedback-footer nav',group=>{const items=[...group.querySelectorAll('a')];mount(group,items,()=>items.find(item=>item.getAttribute('aria-current')==='page'));});
  each('.feedback-compose-toggle',item=>mount(item,[item],()=>item));
  each('.journey-flow',group=>{const items=[...group.querySelectorAll('[data-journey-step]')];mount(group,items,()=>items.find(i=>i.dataset.current==='true'),false);});
  each('.customize-ingredients',group=>{const items=[...group.querySelectorAll('[data-customize-item]')];mount(group,items,()=>items.filter(i=>i.classList.contains('is-added')).at(-1),false);});
  each('.feedback-sort',group=>{const items=[...group.querySelectorAll('button')];mount(group,items,()=>items.find(i=>i.getAttribute('aria-pressed')==='true'));});
  each('.language-options',group=>{const items=[...group.querySelectorAll('a')];mount(group,items,()=>items.find(i=>i.getAttribute('aria-current')==='page'));});
  each('.header .brand,.footer .brand,.footer-about>a:last-child,.feedback-footer>.brand,.site-header>.brand,.email,.text-link,.document p a,.feedback-privacy a,.feedback-note a,.not-found a',item=>{if(!item.closest('.mar-choice-group'))mount(item,[item]);});
  each('.language-picker',picker=>{const summary=picker.querySelector('summary');mount(summary,[summary],()=>picker.open?summary:null);picker.addEventListener('toggle',()=>controllers.forEach(refresh=>refresh()));});
  addEventListener('mar:motion',e=>{pagePaused=!!e.detail?.paused;controllers.forEach(refresh=>refresh());});
  reduce.addEventListener('change',()=>{pagePaused=reduce.matches;controllers.forEach(refresh=>refresh());});
  document.addEventListener('visibilitychange',()=>controllers.forEach(refresh=>refresh()));
})();
