/* Apply the app's measured-label selection behavior to web focus/hover and choice groups.
   One wash per group, measured from the padded label (span.mar-choice-label, bdi or [data-language-current]).
   - window.MARSelection.mount(group, items, selected, interactive=true) mounts a group once and returns its
     refresh function (a second call for the same group returns the same function).
   - The returned refresh function carries destroy() (also MARSelection.destroy(group)): it disconnects the group's
     observers, removes its listeners and wash, cancels the pending frame and lets the group be mounted again.
   - Declarative groups: <div data-choice-group> with [data-choice] items (default: its buttons, links and
     [role=radio]); the selected item has aria-checked/aria-pressed/aria-selected="true" or aria-current="page".
     They mount when this script runs; call MARSelection.scan(root) after adding one later.
   - A paused page (mar:motion), reduced motion or a hidden tab settles the wash without animation frames. */
(function(){
  'use strict';
  const spec=MARSelectionSpec,reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let pagePaused=reduce.matches;
  const ns='http://www.w3.org/2000/svg',controllers=[],mounted=new WeakMap(),destroyers=new WeakMap();
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
    if(!group||!items||!items.length)return null;
    if(mounted.has(group))return mounted.get(group);
    group.classList.add('mar-choice-group');
    const labels=new Map(items.map(item=>[item,labelFor(item)]));
    const svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
    svg.setAttribute('width','0');svg.setAttribute('height','0');svg.classList.add('mar-choice-wash');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    path.setAttribute('fill',spec.fill);svg.append(path);group.prepend(svg);
    const motion=MARSelectionMotion.createMotion();let hovered=null,raf=0,last=0,lastTarget='',dead=false;
    function paint(state){if(state.frame)path.setAttribute('d',spec.path(state.frame));svg.style.opacity=String(state.alpha);}
    function active(){return !pagePaused&&!reduce.matches&&!document.hidden;}
    function tick(now){raf=0;const state=motion.tick(last?now-last:0);last=now;paint(state);if(state.active&&active())raf=requestAnimationFrame(tick);}
    function refresh(){
      if(dead)return;
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
    const off=[],on=(target,type,fn)=>{target.addEventListener(type,fn);off.push(()=>target.removeEventListener(type,fn));};
    if(interactive){
      items.forEach(item=>on(item,'pointerenter',()=>{hovered=item;refresh();}));
      on(group,'pointerleave',()=>{hovered=null;refresh();});
      on(group,'focusin',refresh);on(group,'focusout',()=>queueMicrotask(refresh));
    }
    const mutations=new MutationObserver(refresh);
    mutations.observe(group,{subtree:true,attributes:true,attributeFilter:['data-current','aria-current','aria-pressed','aria-checked','aria-selected','class','hidden','open']});
    const resize=new ResizeObserver(refresh);resize.observe(group);labels.forEach(label=>resize.observe(label));
    function destroy(){
      if(dead)return;
      dead=true;mutations.disconnect();resize.disconnect();off.forEach(fn=>fn());
      cancelAnimationFrame(raf);raf=0;last=0;svg.remove();
      mounted.delete(group);destroyers.delete(group);
      const at=controllers.indexOf(refresh);if(at>=0)controllers.splice(at,1);
    }
    refresh.destroy=destroy;destroyers.set(group,destroy);
    mounted.set(group,refresh);controllers.push(refresh);document.fonts.ready.then(refresh);refresh();
    return refresh;
  }
  const isSelected=item=>['aria-checked','aria-pressed','aria-selected'].some(name=>item.getAttribute(name)==='true')||item.getAttribute('aria-current')==='page';
  function scan(root=document){
    root.querySelectorAll('[data-choice-group]').forEach(group=>{
      const marked=[...group.querySelectorAll('[data-choice]')];
      const items=marked.length?marked:[...group.querySelectorAll('button,a[href],[role=radio]')];
      mount(group,items,()=>items.find(isSelected)||null);
    });
  }
  const each=(selector,fn)=>document.querySelectorAll(selector).forEach(fn);
  each('.header nav,.site-nav,.footer nav,.footer-nav,.feedback-footer nav,.bar__nav,.foot__links,.foot__social',group=>{const items=[...group.querySelectorAll('a')];mount(group,items,()=>items.find(item=>item.getAttribute('aria-current')==='page'));});
  each('.journey-flow',group=>{const items=[...group.querySelectorAll('[data-journey-step]')];mount(group,items,()=>items.find(i=>i.dataset.current==='true'),false);});
  each('.customize-ingredients',group=>{const items=[...group.querySelectorAll('[data-customize-item]')];mount(group,items,()=>items.filter(i=>i.classList.contains('is-added')).at(-1),false);});
  each('.feedback-sort,.feedback-filter',group=>{const items=[...group.querySelectorAll('button,[role=radio]')];mount(group,items,()=>items.find(isSelected));});
  each('.language-options',group=>{const items=[...group.querySelectorAll('a')];mount(group,items,()=>items.find(i=>i.getAttribute('aria-current')==='page'));});
  each('.header .brand,.footer .brand,.footer-about>a:last-child,.feedback-footer>.brand,.site-header>.brand,.bar .wordmark,.foot__mark,.email,.text-link,.feedback-privacy a,.not-found a',item=>{if(!item.closest('.mar-choice-group'))mount(item,[item]);});
  each('.language-picker',picker=>{const summary=picker.querySelector('summary');mount(summary,[summary],()=>picker.open?summary:null);picker.addEventListener('toggle',()=>controllers.forEach(refresh=>refresh()));});
  scan();
  addEventListener('mar:motion',e=>{pagePaused=!!e.detail?.paused;controllers.forEach(refresh=>refresh());});
  reduce.addEventListener('change',()=>{pagePaused=reduce.matches;controllers.forEach(refresh=>refresh());});
  document.addEventListener('visibilitychange',()=>controllers.forEach(refresh=>refresh()));
  window.MARSelection=Object.freeze({mount,scan,destroy:group=>destroyers.get(group)?.(),refresh:()=>controllers.forEach(refresh=>refresh())});
})();
