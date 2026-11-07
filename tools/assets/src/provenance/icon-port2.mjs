// Faithful plain-JS port of dayloom src/shared/drawing/{math,geometry,ink}.ts + object-icons/home-icon-drawing.ts
// Emits SVG path strings instead of SkPath. Usage: node icon-port.mjs [outDir]
import fs from 'node:fs';
const TAU = Math.PI * 2;
const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const f = v => +v.toFixed(1);

function catmull(ctrl, closed, k = 8) {
  const out = [], n = ctrl.length;
  const get = i => (closed ? ctrl[(i + n) % n] : ctrl[Math.min(n - 1, Math.max(0, i))]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const c = m => .5 * (2 * p1[m] + (-p0[m] + p2[m]) * t + (2 * p0[m] - 5 * p1[m] + 4 * p2[m] - p3[m]) * t2 + (-p0[m] + 3 * p1[m] - 3 * p2[m] + p3[m]) * t3);
      out.push([c(0), c(1)]);
    }
  }
  if (!closed) { const last = ctrl[n - 1]; out.push([last[0], last[1]]); }
  return out;
}
function ellPts(cx, cy, rx, ry, rot = 0, n = 2, N = 60) {
  const out = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU, ca = Math.cos(a), sa = Math.sin(a);
    const x = Math.sign(ca) * Math.abs(ca) ** (2 / n) * rx, y = Math.sign(sa) * Math.abs(sa) ** (2 / n) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}
function resample(pts, d) {
  const out = [], n = pts.length; let carry = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = carry;
    for (; s < L; s += d) out.push([a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L]);
    carry = s - L;
  }
  return out;
}
function fuzzy(pts, seed, d = 8, bump = 4.5, lump = 3) {
  const q = resample(pts, 2), n = q.length;
  let cx = 0, cy = 0;
  for (const [x, y] of q) { cx += x / n; cy += y / n; }
  const nrm = i => { const a = q[(i - 2 + n) % n], b = q[(i + 2) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; return [ty / l, -tx / l]; };
  let dot = 0;
  for (let i = 0; i < n; i++) { const [nx, ny] = nrm(i); dot += nx * (q[i][0] - cx) + ny * (q[i][1] - cy); }
  const sg = dot >= 0 ? 1 : -1, per = n * 2;
  const m1 = Math.max(1, Math.round(per / 110)), m2 = Math.max(2, Math.round(per / 43)), ph1 = hash(1, seed) * TAU, ph2 = hash(2, seed) * TAU;
  const Pn = q.map((p, i) => {
    const [nx, ny] = nrm(i), u = i / n * TAU, off = lump * (.6 * Math.sin(m1 * u + ph1) + .4 * Math.sin(m2 * u + ph2));
    return [p[0] + nx * sg * off, p[1] + ny * sg * off, nx * sg, ny * sg];
  });
  let d$ = `M${f(Pn[0][0])} ${f(Pn[0][1])}`;
  for (let i = 0, k = 0; i < n; k++) {
    const j = Math.min(n, i + Math.max(2, Math.round(d * (.5 + hash(k, seed + 7)) / 2))), a = Pn[i], b = Pn[j % n];
    const h = bump * (.15 + .85 * hash(k, seed + 13) ** 1.5);
    d$ += `Q${f((a[0] + b[0]) / 2 + (a[2] + b[2]) / 2 * h)} ${f((a[1] + b[1]) / 2 + (a[3] + b[3]) / 2 * h)} ${f(b[0])} ${f(b[1])}`;
    i = j;
  }
  return d$ + 'Z';
}
const rrect = (x0, y0, x1, y1, n = 6) => ellPts((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, n, 90);
function shapeOf(s) {
  const r = s.rr, e = s.ell;
  const pts = r ? rrect(r[0], r[1], r[2], r[3], r[4]) : s.cm ? catmull(s.cm[0], s.cm[1], s.cm[2]) : e ? ellPts(e[0], e[1], e[2], e[3], e[4], e[5], e[6]) : s.pts;
  const a = s.fu || s.fz;
  return fuzzy(pts, a[0], a[1], a[2], a[3]);
}
const polyline = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L');

const palette = { wood: '#BD9771', woodLight: '#D5B28B', paper: '#F8EFDF', paperBack: '#E5D5BB', ink: '#8B735E', rose: '#D99F98', roseDark: '#BD817B', sage: '#97AA86', glass: '#CFDFDA' };

function drawHomeIcon(name) {
  const p = palette, out = [];
  let seed = 210, group = null;
  const push = el => (group ? group.children : out).push(el);
  const shape = (def, color) => push(`<path fill="${color}" d="${shapeOf({ ...def, fz: [seed++, 3, .28, .18] })}"/>`);
  const box = (x0, y0, x1, y1, color, n = 5) => shape({ rr: [x0, y0, x1, y1, n] }, color);
  const poly = (pts, color) => shape({ pts }, color);
  const line = (pts, color = p.ink, width = 1.6) => push(`<path fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" d="${polyline(pts)}"/>`);
  const rotate = (deg, cx, cy, fn) => { group = { t: `rotate(${deg} ${cx} ${cy})`, children: [] }; fn(); const g = group; group = null; out.push(`<g transform="${g.t}">${g.children.join('')}</g>`); };
  if (name === 'settings') {
    const teeth = [];
    for (let i = 0; i < 8; i++) for (const [offset, radius] of [[-.5, 19], [-.29, 19], [-.23, 26], [.23, 26], [.29, 19], [.5, 19]]) {
      const angle = (i + offset) * Math.PI / 4; teeth.push([32 + Math.cos(angle) * radius, 32 + Math.sin(angle) * radius]);
    }
    const ring = shapeOf({ pts: teeth, fz: [180, 2, .24, .16] });
    const hole = shapeOf({ ell: [32, 32, 9.5, 9.5], fz: [181, 2, .16, .1] });
    out.push(`<path fill="${p.wood}" fill-rule="evenodd" d="${ring}${hole}"/>`);
  } else if (name === 'collection') {
    rotate(10, 34, 32, () => { box(23, 9, 53, 49, p.wood); box(27, 13, 49, 45, p.paperBack); });
    box(10, 14, 44, 56, p.woodLight);
    box(15, 19, 39, 51, p.paper);
    shape({ ell: [32, 27, 3.5, 3.5] }, p.rose);
    poly([[18, 44], [24, 34], [30, 40], [36, 32], [36, 47], [18, 47]], p.sage);
  } else if (name === 'focus') {
    box(14, 7, 50, 12, p.wood);
    box(16, 12, 20, 53, p.woodLight); box(44, 12, 48, 53, p.woodLight);
    shape({ cm: [[[22, 13], [42, 13], [40, 23], [34, 31], [40, 40], [42, 51], [22, 51], [24, 40], [30, 31], [24, 23]], true, .5] }, p.glass);
    poly([[24, 18], [40, 18], [37, 25], [32, 30], [27, 25]], p.rose);
    line([[32, 31], [32, 41]], p.rose, 1.4);
    shape({ cm: [[[23, 49], [27, 45], [32, 40], [37, 45], [41, 49]], true, .5] }, p.rose);
    line([[24, 14], [25, 20]], p.paper, 2);
    box(13, 52, 51, 58, p.wood);
  } else if (name === 'tasks') {
    box(13, 9, 51, 56, p.paperBack);
    box(11, 7, 49, 54, p.paper);
    box(11, 7, 49, 15, p.rose);
    line([[20, 6], [20, 12]], p.roseDark, 2.3);
    line([[40, 6], [40, 12]], p.roseDark, 2.3);
    line([[18, 24], [21, 27], [26, 21]], p.sage, 2.5);
    line([[32, 24], [41, 24.5]], '#B8A68E');
    line([[18, 35], [21, 38], [26, 32]], p.sage, 2.5);
    line([[32, 35], [41, 35.5]], '#B8A68E');
    push(`<circle cx="21.5" cy="46" r="2" fill="#D5C7AE"/>`);
    line([[32, 46], [39, 46]], '#B8A68E');
  } else if (name === 'decor') {
    rotate(28, 32, 32, () => {
      shape({ cm: [[[24, 33], [40, 33], [39, 41], [36, 43], [36, 55], [32, 59], [28, 55], [28, 43], [25, 40]], true, .5] }, p.woodLight);
      box(20, 10, 44, 30, p.paper);
      poly([[20, 10], [25, 9], [29, 11], [34, 9], [39, 10], [44, 9], [44, 17], [39, 19], [34, 17], [29, 20], [24, 17], [20, 18]], p.sage);
      line([[26, 20], [26, 25]], '#D5C7AE', 1);
      line([[32, 21], [32, 25]], '#D5C7AE', 1);
      line([[38, 20], [38, 25]], '#D5C7AE', 1);
      box(19, 27, 45, 35, p.rose);
      push(`<circle cx="32" cy="53" r="1.5" fill="${p.wood}"/>`);
    });
  } else if (name === 'memory') {
    rotate(-9, 32, 32, () => box(12, 12, 45, 54, p.paperBack));
    rotate(7, 32, 32, () => box(19, 9, 50, 52, '#EDDFC9'));
    box(15, 8, 46, 53, p.paper);
    line([[22, 20], [29, 19.6], [37, 20.4]], '#B8A68E');
    line([[22, 27], [38, 26.5]], '#B8A68E');
    line([[22, 33], [32, 33.5]], '#B8A68E');
    box(10, 38, 51, 42, p.rose);
    poly([[28, 40], [24, 49], [29, 47], [32, 42]], p.roseDark);
    poly([[32, 41], [39, 47], [39, 42], [35, 39]], p.rose);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${out.join('')}</svg>`;
}

const outDir = process.argv[2];
const result = {};
for (const name of ['focus', 'collection', 'settings', 'tasks', 'memory', 'decor']) {
  result[name] = drawHomeIcon(name);
  if (outDir) fs.writeFileSync(`${outDir}/icon-${name}.svg`, result[name]);
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.length]))));
