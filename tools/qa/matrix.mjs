// Matrix runner: pages x locales x viewports (x reduced-motion / RTL variants).
// Per cell: horizontal overflow, console errors/warnings, exceptions, 4xx / failed requests,
// phone count, computed banned styles, min font size, optional stylesheet text grep. Exit 1 on any FAIL.
//
//   node tools/qa/matrix.mjs --base http://127.0.0.1:8765 --pages / ,/feedback/,/news/ --locales ko,en,ar \
//        --views desktop,phone [--reduced] [--rtl-stress] [--phones 1] [--min-font 12] [--css-grep] [--screens dir] [--json out.json]
//
// --pages is comma separated; --locales: "ko" (or "root") means no prefix, otherwise /<loc>/ is prepended.
// --base may include a path prefix (e.g. http://127.0.0.1:8770/c) and then pages are relative to it.
// --expect-phones N   fail when top-level phone count differs (omit to only report).
// --warn-only banned,minFont   downgrade those checks to warnings.
// --allow-console <regex>      ignore matching console messages.
import { writeFileSync, mkdirSync } from 'node:fs';
import { withPage, PROBES, VIEWS, parseArgs } from './cdp.mjs';

const { f } = parseArgs(process.argv.slice(2));
const base = (f.base || 'http://127.0.0.1:8765').replace(/\/$/, '');
const pages = String(f.pages || '/').split(',').filter(Boolean);
const locales = String(f.locales || 'root').split(',').filter(Boolean);
const views = String(f.views || 'desktop,phone').split(',').filter(Boolean);
const minFont = f['min-font'] === undefined ? 12 : +f['min-font'];
const expectPhones = f['expect-phones'] !== undefined ? +f['expect-phones'] : null;
const warnOnly = new Set(String(f['warn-only'] || '').split(','));
const allowConsole = f['allow-console'] ? new RegExp(f['allow-console']) : null;
const RTL = new Set(['ar', 'he', 'fa', 'ur']);
const variants = [{ name: 'base', reduced: !!f.reduced }];
if (f['rtl-stress']) variants.push({ name: 'rtl-stress', reduced: !!f.reduced, rtl: true });
if (f['also-reduced'] && !f.reduced) variants.push({ name: 'reduced', reduced: true });

const rows = []; let fails = 0, warns = 0;
for (const loc of locales) for (const pg of pages) for (const vn of views) for (const v of variants) {
  const prefix = loc === 'root' || loc === 'ko' ? '' : '/' + loc;
  const path = (prefix + (pg.startsWith('/') ? pg : '/' + pg)).replace(/\/{2,}/g, '/');
  const url = base + path;
  const id = `${loc}${pg} ${vn}${v.name === 'base' ? '' : ' ' + v.name}`;
  const row = { id, url, fail: [], warn: [] };
  try {
    await withPage({ view: vn, reducedMotion: v.reduced }, async (p) => {
      await p.goto(url, { settle: 1500 });
      if (v.rtl) await p.rtl(true);
      await p.scrollThrough({ step: 0.8, delay: 200, max: 30 });
      await p.scrollTo(0);
      const meta = await p.eval(PROBES.lang);
      const ov = await p.eval(PROBES.overflow);
      const ph = await p.eval(PROBES.phones);
      const bn = await p.eval(PROBES.banned);
      const mf = await p.eval(PROBES.minFont(minFont));
      const cg = f['css-grep'] ? await p.eval(PROBES.cssGrep) : null;
      const cons = allowConsole ? p.log.console.filter((x) => !allowConsole.test(x)) : p.log.console;
      Object.assign(row, { lang: meta.lang, dir: meta.dir, docH: meta.docH, loadMs: p.loadMs, scrollW: ov.scrollW, clientW: ov.clientW, phones: ph.phoneCount, banned: bn.counts, requests: p.log.requests.size });
      const add = (kind, key, msg) => (warnOnly.has(key) ? row.warn : row.fail).push(`${kind}: ${msg}`);
      if (ov.hOverflow) add('overflow', 'overflow', `scrollW ${ov.scrollW} > ${ov.clientW}; ${ov.offenders.join(' | ')}`);
      else if (ov.offenderCount) row.warn.push(`overflow-offscreen(${ov.offenderCount}): ${ov.offenders.slice(0, 3).join(' | ')}`);
      if (cons.length) add('console', 'console', cons.slice(0, 3).join(' | '));
      if (p.log.exceptions.length) add('exception', 'exception', p.log.exceptions.slice(0, 2).join(' | '));
      if (p.log.http4xx.length) add('4xx', 'http', p.log.http4xx.slice(0, 3).join(' | '));
      if (p.log.failed.length) add('failed-request', 'http', p.log.failed.slice(0, 3).join(' | '));
      if (expectPhones !== null && ph.phoneCount !== expectPhones) add('phones', 'phones', `expected ${expectPhones}, got ${ph.phoneCount}`);
      const bad = Object.entries(bn.counts).filter(([, n]) => n > 0);
      if (bad.length) add('banned-style', 'banned', bad.map(([k, n]) => `${k}=${n} (${bn.samples[k].slice(0, 3).join(', ')})`).join('; '));
      if (mf.count) add(`min-font<${minFont}`, 'minFont', `${mf.count}: ${mf.samples.slice(0, 3).join(' | ')}`);
      if (cg && Object.keys(cg).length) row.warn.push('css-grep: ' + JSON.stringify(cg));
      const wantDir = RTL.has(loc) ? 'rtl' : null;
      if (wantDir && meta.dir !== wantDir && !v.rtl) add('dir', 'dir', `expected dir=${wantDir}, got "${meta.dir}"`);
      if (f.screens) { const fn = `${f.screens}/${id.replace(/[^\w-]+/g, '_')}.jpg`; await p.shot(fn, { full: ov.scrollW > 0 && meta.docH < 9000, quality: 60 }); row.screen = fn; }
    });
  } catch (e) { row.fail.push('error: ' + e.message); }
  fails += row.fail.length ? 1 : 0; warns += row.warn.length ? 1 : 0;
  rows.push(row);
  console.log(`${row.fail.length ? 'FAIL' : row.warn.length ? 'warn' : 'ok  '} ${id}  phones=${row.phones ?? '?'} W=${row.scrollW}/${row.clientW} req=${row.requests ?? '?'}${row.fail.length ? '\n     ' + row.fail.join('\n     ') : ''}${f.verbose && row.warn.length ? '\n     (warn) ' + row.warn.join('\n     (warn) ') : ''}`);
}
console.log(`\n${rows.length} cells, ${fails} failing, ${warns} with warnings`);
if (f.json) { mkdirSync(new URL('.', new URL('file://' + require_abs(f.json))).pathname, { recursive: true }); writeFileSync(f.json, JSON.stringify(rows, null, 1)); }
process.exit(fails ? 1 : 0);
function require_abs(p) { return p.startsWith('/') ? p : process.cwd() + '/' + p; }
