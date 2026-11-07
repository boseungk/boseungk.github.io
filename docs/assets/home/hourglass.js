// The app's hourglass drawn in SVG (sample C, from the app geometry): caps, vessel, liquid, stream, colour flow.
// makeHourglass(host, {palette, skins, L, reduced}) appends one <svg> to host and returns its api; destroy() removes it.
const NS = 'http://www.w3.org/2000/svg';

export const PALETTES = {
  dawn: { cap: ['#C2CAD9'], colors: ['#8DA9DA', '#B7A3D2', '#E5B1C7', '#F2DEBB'], base: ['#D6DEEB', '#DDD7E5', '#EBDDD2'] },
  apricot: { cap: ['#DAC8B9'], colors: ['#E6B17B', '#DB968E', '#E7C371', '#EEC1AA'], base: ['#E9D1B6', '#E4BFB0', '#EFDCB9'] },
  lilac: { cap: ['#CDC3DA'], colors: ['#8C9ED5', '#A487CA', '#C7A6CE', '#DED7ED'], base: ['#D2D4E7', '#CEBEDD', '#DAD3E6'] },
  sea: { cap: ['#BDCFCE'], colors: ['#74A8BD', '#96BCD8', '#A3C9BE', '#E5DAB9'], base: ['#CCDDE1', '#BAD6D7', '#D8DFCF'] },
  rose: { cap: ['#D4C1CC'], colors: ['#CB91A8', '#B891B3', '#E6CCAD', '#E8BAC6'], base: ['#E6D0D4', '#DAC1CE', '#E7D6CC'] },
  prism: { cap: ['#C8C5D6', '#C5CED8', '#CDD3D4', '#D8D0C8', '#D2C9D3'], colors: ['#6C92D9', '#DA8EBF', '#ECC279', '#AC9CDA'], base: ['#D3CEDF', '#D9C3D3', '#E6D5BA'] },
};
const FACETS = [
  { d: 'M34 0 H126 L129 3 V7 L126 10 H34 L31 7 V3Z', tint: -.2 },
  { d: 'M34 0 H126 L118 2.5 H42Z', tint: .56 },
  { d: 'M34 10 H126 L118 7.5 H42Z', tint: -.08 },
  { d: 'M34 0 L42 2.5 L38 5 L42 7.5 L34 10 L31 7 V3Z', tint: .34 },
  { d: 'M126 0 L129 3 V7 L126 10 L118 7.5 L122 5 L118 2.5Z', tint: -.12 },
  { d: 'M42 2.5 H118 L122 5 L118 7.5 H42 L38 5Z', tint: .18 },
  { d: 'M42 2.5 H69 L86 7.5 H42 L38 5Z', tint: .3, prismOpacity: .75 },
  { d: 'M94 2.5 H118 L122 5 L118 7.5 H108Z', tint: .1, prismOpacity: .18, prismColor: '#FFF8F0' },
  { d: 'M34 0 H60 L51 2.5 H42Z', tint: .72 },
  { d: 'M99 7.5 H118 L126 10 H111Z', tint: -.2 },
];
const VESSEL = 'M40 24 H120 C120 45 111 59 94 73 C86 79 83 83 83 91 C83 99 87 103 95 109 C111 122 120 137 120 158 H40 C40 137 49 122 65 109 C73 103 77 99 77 91 C77 83 74 79 66 73 C49 59 40 45 40 24Z';
const POOL = 0.88 * 0.92;
export const CYCLE = 8500;
// a calm moment of the colour flow, used for the still previews and the reduced-motion HUD
export const STILL_PHASE = 1800 / CYCLE;

const tintColor = (c, amt) => {
  const target = amt < 0 ? 0 : 255, t = Math.abs(amt);
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - t) + target * t).toString(16).padStart(2, '0')).join('');
};
const capFaces = id => {
  const caps = PALETTES[id].cap, prism = caps.length > 1;
  return FACETS.map(f => {
    const tint = prism ? (f.tint >= .45 ? .45 : f.tint < 0 ? -.14 : .08) : Math.max(-.14, Math.min(.45, f.tint));
    return { colors: prism && f.prismColor ? [f.prismColor] : caps.map(c => tintColor(c, tint)), opacity: prism ? (f.prismOpacity ?? 1) : 1 };
  });
};
const streamPath = bottom => {
  const gap = bottom - 92;
  const neckEnd = 92 + Math.min(9, gap * .4) - 3;
  const landing = bottom - Math.min(4, gap * .2);
  const middle = (neckEnd + landing) / 2;
  return `M76.8 84 L76.8 88 C76.8 ${88 + (neckEnd - 88) * .35} 78.7 ${neckEnd - 1.5} 79.15 ${neckEnd} Q79.45 ${middle} 79.2 ${landing} Q79.2 ${bottom - .4} 77.6 ${bottom + 1} Q80 ${bottom + 2.1} 82.4 ${bottom + 1} Q80.8 ${bottom - .4} 80.8 ${landing} Q80.55 ${middle} 80.85 ${neckEnd} C81.3 ${neckEnd - 1.5} 83.2 ${88 + (neckEnd - 88) * .35} 83.2 88 L83.2 84 Z`;
};
const cloud = (index, chamber, ph) => {
  const angle = ph * Math.PI * 2 + index * Math.PI / 2 + chamber * 1.1;
  return {
    cx: 80 + 33 * Math.sin(angle),
    cy: (chamber ? 146 : 66) + (chamber ? 14 : 23) * Math.cos(angle * (index % 2 ? 1 : 2) + index),
  };
};
const mk = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const upperPath = top => `M38 ${top} Q58 ${top + 1} 80 ${top} T122 ${top}`;
const lowerPath = b => `M38 ${b} Q54 ${b - 1} 70 ${b} L90 ${b} Q106 ${b - 1} 122 ${b}`;

let count = 0;
export function makeHourglass(host, { palette = 'dawn', skins = 1, L = null, reduced = false } = {}) {
  const uid = 'hg' + (++count);
  const svg = mk('svg', { viewBox: '24 8 112 166', 'aria-hidden': 'true', focusable: 'false' });
  const defs = mk('defs', {}, svg);
  mk('path', { d: VESSEL }, mk('clipPath', { id: `${uid}-v` }, defs));
  const liquidClip = mk('path', { d: '' }, mk('clipPath', { id: `${uid}-l` }, defs));
  const refl = mk('linearGradient', { id: `${uid}-r`, x1: 40, x2: 120, y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' }, defs);
  [[0, '#F8E5BD', .28], [.22, '#F8E5BD', 0], [.8, '#FFF8E9', 0], [1, '#FFF8E9', .35]].forEach(([o, c, a]) => mk('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, refl));

  mk('path', { d: VESSEL, fill: '#FFFDF7', 'fill-opacity': .3, stroke: '#BBAA92', 'stroke-opacity': .65, 'stroke-width': 1.2 }, svg);
  const inVessel = mk('g', { 'clip-path': `url(#${uid}-v)` }, svg);
  const liquid = mk('g', { 'clip-path': `url(#${uid}-l)` }, inVessel);
  const capHosts = [15, 158].map(y => mk('g', { transform: `translate(0 ${y})` }));

  // Each skin is one full palette paint; switching crossfades two skins (opacity only).
  const skinList = [];
  for (let s = 0; s < skins; s++) {
    const sid = `${uid}-s${s}`;
    const base = mk('linearGradient', { id: `${sid}-b`, x1: 42, y1: 45, x2: 121, y2: 155, gradientUnits: 'userSpaceOnUse' }, defs);
    const baseStops = [0, .5, 1].map(o => mk('stop', { offset: o }, base));
    const poolStops = [0, 1, 2, 3].map(i => {
      const g = mk('radialGradient', { id: `${sid}-p${i}`, cx: '50%', cy: '50%', r: '50%' }, defs);
      return [[0, 1], [.34, .88], [.68, .37], [1, 0]].map(([o, a]) => mk('stop', { offset: o, 'stop-opacity': (POOL * a).toFixed(4) }, g));
    });
    const capGrads = FACETS.map((_, i) => {
      const g = mk('linearGradient', { id: `${sid}-c${i}`, x1: 31, x2: 129, y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' }, defs);
      return [0, .25, .5, .75, 1].map(o => mk('stop', { offset: o }, g));
    });
    const group = mk('g', { class: 'hg-skin' }, liquid);
    mk('rect', { x: 28, y: 20, width: 110, height: 145, fill: `url(#${sid}-b)` }, group);
    const pools = [];
    for (let ch = 0; ch < 2; ch++) for (let i = 0; i < 4; i++) {
      pools.push({ i, ch, n: mk('ellipse', { cx: 80, cy: 91, rx: 35 + i * 2, ry: ch ? 27 : 39, fill: `url(#${sid}-p${i})` }, group) });
    }
    const caps = capHosts.map(h => {
      const cg = mk('g', { class: 'hg-skin' }, h);
      return FACETS.map((f, i) => mk('path', { d: f.d, fill: `url(#${sid}-c${i})` }, cg));
    });
    const capGroups = capHosts.map(h => h.lastChild);
    skinList.push({ group, capGroups, baseStops, poolStops, capGrads, caps, pools });
  }
  const reflRect = mk('rect', { x: 38, y: 24, width: 84, height: 135, fill: `url(#${uid}-r)` }, liquid);
  const surfTop = mk('path', { fill: 'none', stroke: '#FFF8E9', 'stroke-opacity': .8, 'stroke-width': 1.1 }, inVessel);
  const surfBottom = mk('path', { fill: 'none', stroke: '#FFF8E9', 'stroke-opacity': .8, 'stroke-width': 1.1 }, inVessel);
  mk('path', { d: 'M47 32 C48 44 55 56 65 65 M113 150 C111 136 104 125 97 120', fill: 'none', opacity: .62, stroke: '#FFFDF7', 'stroke-linecap': 'round', 'stroke-width': 1.8 }, inVessel);
  capHosts.forEach(h => { svg.appendChild(h); mk('path', { d: 'M43 2.5 H65', fill: 'none', stroke: '#FFFDF6', opacity: .8, 'stroke-width': .65, 'stroke-linecap': 'round' }, h); });
  host.appendChild(svg);

  const paint = (skin, id) => {
    const p = PALETTES[id];
    skin.baseStops.forEach((s, k) => s.setAttribute('stop-color', p.base[k]));
    skin.poolStops.forEach((stops, i) => stops.forEach(s => s.setAttribute('stop-color', p.colors[i])));
    const faces = capFaces(id);
    skin.capGrads.forEach((stops, i) => stops.forEach((s, k) => {
      const list = faces[i].colors;
      s.setAttribute('stop-color', list[Math.min(list.length - 1, Math.round(k / 4 * (list.length - 1)))]);
    }));
    skin.caps.forEach(row => row.forEach((n, i) => n.setAttribute('opacity', faces[i].opacity)));
  };
  const setSkinOpacity = (skin, o) => {
    skin.group.style.opacity = o;
    skin.capGroups.forEach(g => { g.style.opacity = o; });
  };
  skinList.forEach(s => {
    s.group.style.transition = 'opacity 300ms cubic-bezier(.22,.61,.36,1)';
    s.capGroups.forEach(g => { g.style.transition = s.group.style.transition; });
  });
  let front = 0, current = PALETTES[palette] ? palette : 'dawn', fadeTimer = 0;
  paint(skinList[0], current);
  if (skinList[1]) { paint(skinList[1], current); setSkinOpacity(skinList[1], 0); }

  return {
    get palette() { return current; },
    setPalette(id) {
      if (id === current || !PALETTES[id]) return;
      current = id;
      if (skinList.length < 2 || reduced || !L) { skinList.forEach(s => paint(s, id)); return; }
      const next = skinList[1 - front], prev = skinList[front];
      paint(next, id);
      liquid.insertBefore(next.group, reflRect);
      next.capGroups.forEach(g => g.parentNode.insertBefore(g, g.parentNode.lastChild));
      setSkinOpacity(next, 0);
      void svg.getBoundingClientRect();
      setSkinOpacity(next, 1);
      L.clear(fadeTimer);
      fadeTimer = L.later(() => setSkinOpacity(prev, 0), 320);
      front = 1 - front;
    },
    setPhase(ph) {
      skinList.forEach(skin => skin.pools.forEach(({ i, ch, n }) => {
        const c = cloud(i, ch, ph);
        n.setAttribute('cx', c.cx.toFixed(2));
        n.setAttribute('cy', c.cy.toFixed(2));
      }));
    },
    // progress 0..1 of a running session (app formula, no initialFill)
    setProgress(p) {
      const remaining = Math.sqrt(1 - p);
      const top = 92 - 64 * remaining, bottom = 158 - 62 * (1 - remaining);
      liquidClip.setAttribute('d', `${upperPath(top)} V89 H38Z ${lowerPath(bottom)} V159 H38Z ${streamPath(bottom)}`);
      surfTop.setAttribute('d', upperPath(top));
      surfBottom.setAttribute('d', `M38 ${bottom} Q54 ${bottom - 1} 70 ${bottom} L77.4 ${bottom} M82.6 ${bottom} L90 ${bottom} Q106 ${bottom - 1} 122 ${bottom}`);
    },
    // static preview geometry used by the palette previews
    setPreview() {
      liquidClip.setAttribute('d', `M38 43 Q58 44 80 43 T122 43 V89 H38Z M38 143 Q59 142 80 143 T122 143 V159 H38Z ${streamPath(143)}`);
      surfTop.setAttribute('d', 'M38 43 Q58 44 80 43 T122 43');
      surfBottom.setAttribute('d', 'M38 143 Q59 142 77.4 143 M82.6 143 Q102 143.7 122 143');
    },
    destroy() { svg.remove(); },
  };
}
