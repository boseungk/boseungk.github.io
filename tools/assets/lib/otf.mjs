// Minimal sfnt reader: the Unicode cmap of an OTF/TTF as a Set of code points (formats 4 and 12; glyph 0 excluded).
export function cmapCodepoints(buf) {
  const numTables = buf.readUInt16BE(4); let cmapOff = -1;
  for (let i = 0; i < numTables; i++) { const o = 12 + 16 * i; if (buf.toString('latin1', o, o + 4) === 'cmap') cmapOff = buf.readUInt32BE(o + 8); }
  if (cmapOff < 0) throw new Error('no cmap table');
  const n = buf.readUInt16BE(cmapOff + 2); let best = null;
  for (let i = 0; i < n; i++) {
    const o = cmapOff + 4 + 8 * i, plat = buf.readUInt16BE(o), enc = buf.readUInt16BE(o + 2), sub = cmapOff + buf.readUInt32BE(o + 4), fmt = buf.readUInt16BE(sub);
    const rank = fmt === 12 && ((plat === 3 && enc === 10) || plat === 0) ? 3 : fmt === 4 && ((plat === 3 && enc === 1) || plat === 0) ? 2 : 0;
    if (rank && (!best || rank > best.rank)) best = {rank, sub, fmt};
  }
  if (!best) throw new Error('no Unicode cmap subtable');
  const set = new Set(), {sub, fmt} = best;
  if (fmt === 12) {
    const groups = buf.readUInt32BE(sub + 12);
    for (let g = 0; g < groups; g++) { const o = sub + 16 + 12 * g, a = buf.readUInt32BE(o), b = buf.readUInt32BE(o + 4), gid = buf.readUInt32BE(o + 8); for (let c = a; c <= b; c++) if (gid + (c - a) !== 0) set.add(c); }
  } else {
    const segX2 = buf.readUInt16BE(sub + 6), seg = segX2 / 2, endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
    for (let s = 0; s < seg; s++) {
      const end = buf.readUInt16BE(endO + 2 * s), start = buf.readUInt16BE(startO + 2 * s), delta = buf.readInt16BE(deltaO + 2 * s), ro = buf.readUInt16BE(rangeO + 2 * s);
      for (let c = start; c <= end && c !== 0xFFFF; c++) {
        let gid; if (ro === 0) gid = (c + delta) & 0xFFFF; else { const g = buf.readUInt16BE(rangeO + 2 * s + ro + 2 * (c - start)); gid = g === 0 ? 0 : (g + delta) & 0xFFFF; }
        if (gid !== 0) set.add(c);
      }
    }
  }
  return set;
}
// [[lo,hi],…] runs from a Set of code points (sorted), and the CSS unicode-range string for them.
export function runs(set) {
  const a = [...set].sort((x, y) => x - y), out = [];
  for (const c of a) { const l = out[out.length - 1]; if (l && c === l[1] + 1) l[1] = c; else out.push([c, c]); }
  return out;
}
export const fromRuns = rs => { const s = new Set(); for (const [a, b] of rs) for (let c = a; c <= b; c++) s.add(c); return s; };
export const hex = c => c.toString(16).toUpperCase().padStart(4, '0');
export const cssRange = rs => rs.map(([a, b]) => a === b ? `U+${hex(a)}` : `U+${hex(a)}-${hex(b)}`).join(', ');
