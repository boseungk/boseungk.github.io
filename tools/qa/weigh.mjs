// Cold-load transfer weigh: cache disabled, full scroll, bytes by type and phase, local gzip size for text.
// Python serves no gzip, so text transfer is also reported as gzip-9 of the body fetched locally.
//   node tools/qa/weigh.mjs <url> [--w 1440 --h 900 --dpr 2 --mobile --json --budget <KB, gzip total>]
// Text and OTF fonts are measured at gzip size (GitHub Pages gzips both); images are as transferred.
// --budget N exits 1 when the gzip total exceeds N KB.
import { gzipSync } from 'node:zlib';
import { openPage, parseArgs, sleep } from './cdp.mjs';

const { pos, f } = parseArgs(process.argv.slice(2));
const url = pos[0];
if (!url) { console.error('usage: weigh.mjs <url>'); process.exit(2); }
const p = await openPage({ width: +f.w || 1440, height: +f.h || 900, dpr: +f.dpr || 2, mobile: !!f.mobile, reducedMotion: !!f.reduced });
const phaseOf = new Map(); let phase = 'load';
p.c.on((m) => { if (m.method === 'Network.loadingFinished') phaseOf.set(m.params.requestId, phase); });
try {
  await p.goto(url, { settle: 4000 });
  phase = 'scroll';
  await p.scrollThrough({ step: 0.6, delay: 400, max: 40 });
  await sleep(2500);
  const rows = [];
  for (const [id, r] of p.log.requests) if (r.url && r.bytes != null && !r.url.startsWith('data:')) rows.push({ ...r, phase: phaseOf.get(id) || phase });
  const TEXT = /^(Document|Stylesheet|Script|XHR|Fetch|Manifest)$/;
  // Local gzip for text resources
  for (const r of rows) if (TEXT.test(r.type) || r.type === 'Font' || /json|javascript|css|html|svg|font|opentype/.test(r.mime || '')) {
    try { const b = Buffer.from(await (await fetch(r.url, { cache: 'no-store' })).arrayBuffer()); r.raw = b.length; r.gzip = gzipSync(b, { level: 9 }).length; } catch {}
  }
  const by = {};
  for (const r of rows) { const k = `${r.phase} ${r.type}`; const s = (by[k] ||= { n: 0, kb: 0, gzipKb: 0 }); s.n++; s.kb += r.bytes / 1024; s.gzipKb += (r.gzip ?? r.bytes) / 1024; }
  const tot = (ph) => rows.filter((r) => !ph || r.phase === ph).reduce((a, r) => a + r.bytes, 0) / 1024;
  const totGz = (ph) => rows.filter((r) => !ph || r.phase === ph).reduce((a, r) => a + (r.gzip ?? r.bytes), 0) / 1024;
  const base = new URL(url).origin;
  const big = rows.filter((r) => r.bytes > 150000).sort((a, b) => b.bytes - a.bytes).map((r) => ({ kb: Math.round(r.bytes / 1024), phase: r.phase, url: r.url.replace(base, '') }));
  const out = { url, requests: rows.length, totalKB: Math.round(tot()), totalKBGzipText: Math.round(totGz()), loadKB: Math.round(tot('load')), scrollKB: Math.round(tot('scroll')), byPhaseType: Object.fromEntries(Object.entries(by).sort().map(([k, v]) => [k, { n: v.n, kb: Math.round(v.kb), gzipKb: Math.round(v.gzipKb) }])), over150KB: big, http4xx: p.log.http4xx, failed: p.log.failed };
  if (f.json) console.log(JSON.stringify(out, null, 1));
  else {
    console.log(`${url}\n requests ${out.requests}  total ${out.totalKB} KB (text and fonts gzipped: ${out.totalKBGzipText} KB)  load ${out.loadKB} KB  scroll ${out.scrollKB} KB`);
    for (const [k, v] of Object.entries(out.byPhaseType)) console.log('  ' + k.padEnd(22), String(v.n).padStart(4), String(v.kb).padStart(7) + ' KB', v.gzipKb !== v.kb ? `(gz ${v.gzipKb})` : '');
    for (const b of big) console.log(`  big ${b.kb} KB ${b.phase} ${b.url}`);
    if (out.http4xx.length || out.failed.length) console.log('  errors', [...out.http4xx, ...out.failed]);
    if (f.budget) { const ok = out.totalKBGzipText <= +f.budget; console.log(`  budget ${f.budget} KB gzip: ${ok ? 'ok' : 'OVER'} (${out.totalKBGzipText} KB)`); if (!ok) process.exitCode = 1; }
  }
} finally { await p.close(); }
