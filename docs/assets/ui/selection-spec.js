/* Generated from native Dayloom selection sources. */
(function(g){
const spec={"spring":{"mass":1,"stiffness":484,"damping":36.52,"energyThreshold":1e-7},"opacityMs":110,"padding":{"x":10,"y":5},"fill":"#efe3dd","ink":"#473E3B","muted":"#5F5551"};
spec.path=([x,y,w,h])=>{const point=(px,py)=>`${x+w*px} ${y+h*py}`;return `M${point(.16,.08)}C${point(.35,.02)} ${point(.73,.04)} ${point(.88,.12)}C${point(1,.2)} ${point(1,.7)} ${point(.89,.87)}C${point(.74,1)} ${point(.33,.98)} ${point(.13,.89)}C${point(0,.81)} ${point(0,.31)} ${point(.08,.18)}Q${point(.11,.1)} ${point(.16,.08)}Z`;};
g.MARSelectionSpec=Object.freeze(spec);
})(window);
