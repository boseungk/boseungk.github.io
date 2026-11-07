#!/usr/bin/env node
/* Font subsets (PORT-PLAN A4 / 2.10, extras F2). Cuts the faces below with hb-subset and records them in
   architecture/font-asset-sources.json (lock). The build (fonts.py) reads the lock and, per page, emits the
   @font-face rules and preloads of that page's language only.

   Korean pages: four OTF faces of LINE Seed KR (master copied to tools/assets/src/fonts/, unpublished)
     family "LINE Seed"       fonts/line-seed-latin.otf   Latin basics (list below) ∩ cmap
     family "LINE Seed"       fonts/line-seed-ext.otf     every other non-Hangul cmap code point (exact generated unicode-range)
     family "LINE Seed"       fonts/line-seed-ko.otf      KS X 1001's 2,350 syllables + jamo + every syllable used by the ko pages,
                                                          ko catalog, policy templates, JS copy and room text (see syllableSources)
     family "LINE Seed Rare"  fonts/line-seed-rare.otf    the remaining syllables (per-character fallback; loads only for rare syllables)

   Other languages (extras F2): the app's own font for that language (Dayloom src/core/localization/locale-fonts.ts and
   assets/fonts/README.md), subset from the Dayloom checkout (read-only; masters pinned by sha256 in the lock). LINE Seed JP
   serves Latin, Cyrillic and Japanese; Noto Sans serves Dutch and Vietnamese; LINE Seed TH, Noto Sans SC and the Noto script
   families serve their languages. Traditional Chinese uses the app's bundled Noto Sans TC: LINE Seed TW carries a Reserved
   Font Name, so a subset of it may not be published under that name. Han faces hold the ideographs the language's pages,
   catalogs and room text use (scanned like the ko syllables); other faces take fixed script ranges.

   usage: node tools/assets/build-fonts.mjs [--report] [--check] [--verify]
     (none)    scan sources, subset, write hashed files, lock, OFL texts, sources table
     --check   no writes: lock vs files, names == sha256[:10], cmaps == lock, faces disjoint per family, KR master fully covered,
               scans (ko syllables, Han, preloads) in sync, gzip budgets
     --verify  with --check semantics, plus re-subset into a temp dir and compare bytes (hb-subset drift)
     --report  per language: characters its pages use that no face declared for it covers, no writes */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {SCRATCH_RE, ASSETS, ARCH, ROOT, SRC, DOCS, DAYLOOM, sha256, hashedName, toolVersions, readLock, writeLock, withRunLock, retain, parseArgs, rel} from './lib/common.mjs';
import {cmapCodepoints, runs, fromRuns, cssRange, hex} from './lib/otf.mjs';
import {updateSection, table, fmt, today} from './lib/sources-md.mjs';

const LOCK = path.join(ARCH, 'font-asset-sources.json');
const FONT_DIR = path.join(ASSETS, 'fonts');
const MASTER = path.join(SRC, 'fonts/LINESeedKR-Regular.otf');
const KS2350 = path.join(SRC, 'fonts/ks-x-1001-2350.txt');
const APP_FONTS = path.join(DAYLOOM, 'assets/fonts');
const LOCALES = JSON.parse(fs.readFileSync(path.join(ASSETS, 'i18n/locales.json'), 'utf8'));
const LATIN = [[0x0000, 0x00FF], [0x0131, 0x0131], [0x0152, 0x0153], [0x02BB, 0x02BC], [0x02C6, 0x02C6], [0x02DA, 0x02DA], [0x02DC, 0x02DC], [0x2000, 0x206F], [0x2074, 0x2074], [0x20AC, 0x20AC], [0x2122, 0x2122], [0x2190, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215], [0xFEFF, 0xFEFF], [0xFFFD, 0xFFFD]];
const HANGUL_BLOCKS = [[0x1100, 0x11FF], [0x3130, 0x318F], [0xA960, 0xA97F], [0xAC00, 0xD7A3], [0xD7B0, 0xD7FF]];
const SYLLABLES = [0xAC00, 0xD7A3];
const KO_UNICODE_RANGE = 'U+1100-11FF, U+3130-318F, U+A960-A97F, U+AC00-D7A3, U+D7B0-D7FF', RARE_UNICODE_RANGE = 'U+AC00-D7A3';
const FACES = [
  {id: 'latin', family: 'LINE Seed', logical: 'fonts/line-seed-latin.otf'},
  {id: 'ext', family: 'LINE Seed', logical: 'fonts/line-seed-ext.otf'},
  {id: 'ko', family: 'LINE Seed', logical: 'fonts/line-seed-ko.otf'},
  {id: 'rare', family: 'LINE Seed Rare', logical: 'fonts/line-seed-rare.otf'},
];

// ---- per-language faces (extras F2) ---------------------------------------------------------------------------------
const LATIN_EXT = [[0x0100, 0x024F], [0x0300, 0x036F], [0x1E00, 0x1EFF]];   // European letters, combining marks, Vietnamese
const GREEK_CYRILLIC = [[0x0370, 0x03FF], [0x0400, 0x052F], [0x1C80, 0x1C8F], [0x1F00, 0x1FFF], [0x2DE0, 0x2DFF], [0xA640, 0xA69F]];
const CJK_MARKS = [[0x3000, 0x303F], [0xFF00, 0xFF65], [0xFFE0, 0xFFEE]];   // CJK punctuation, fullwidth ASCII and signs
const KANA = [[0x3040, 0x30FF], [0x31F0, 0x31FF]];
const HAN = [[0x3400, 0x4DBF], [0x4E00, 0x9FFF], [0xF900, 0xFAFF]];          // Han faces hold only the ideographs in use
const DOTTED = [0x25CC, 0x25CC];                                             // dotted circle for stray combining marks
const SIMPLE = 'kern,liga,ccmp,locl,mark,mkmk,calt';                         // Latin and Han: no vertical, fraction or width alternates
// locale -> group; every other non-ko locale uses LINE Seed JP, as in the app (fontFamilyForLocale's default)
const LOCALE_GROUP = {'zh-Hans-CN': 'sc', 'zh-Hant-TW': 'tc', 'nl-NL': 'noto', 'vi-VN': 'noto', 'th-TH': 'th', 'ar-SA': 'arabic',
  'he-IL': 'hebrew', 'hi-IN': 'devanagari', 'bn-BD': 'bengali', 'ta-IN': 'tamil'};
// features: null keeps hb-subset's default feature list (complex scripts need their shaping features)
const GROUPS = [
  {id: 'jp', family: 'LINE Seed JP', master: 'LINESeedJP-Regular.ttf', license: 'OFL-LINESeedJP.txt', features: SIMPLE, faces: [
    {id: 'jp-latin', logical: 'fonts/line-seed-jp-latin.ttf', ranges: LATIN},
    {id: 'jp-latin-ext', logical: 'fonts/line-seed-jp-latin-ext.ttf', ranges: LATIN_EXT},
    {id: 'jp-cyrillic', logical: 'fonts/line-seed-jp-cyrillic.ttf', ranges: GREEK_CYRILLIC},
    {id: 'jp-ja', logical: 'fonts/line-seed-jp-ja.ttf', ranges: [...CJK_MARKS, ...KANA], han: true, langs: ['ja']}]},
  {id: 'sc', family: 'Noto Sans SC', master: 'NotoSansSC-Regular.ttf', license: 'OFL-NotoSansSC.txt', features: SIMPLE, faces: [
    {id: 'sc', logical: 'fonts/noto-sans-sc.ttf', ranges: [...LATIN, ...CJK_MARKS], han: true}]},
  {id: 'tc', family: 'Noto Sans TC', master: 'NotoSansTC-Regular.ttf', license: 'OFL-NotoSansTC.txt', features: SIMPLE, faces: [
    {id: 'tc', logical: 'fonts/noto-sans-tc.ttf', ranges: [...LATIN, ...CJK_MARKS, [0x3100, 0x312F]], han: true}]},
  {id: 'noto', family: 'Noto Sans', master: 'NotoSans-Regular.ttf', license: 'OFL-NotoSans.txt', features: SIMPLE, faces: [
    {id: 'noto-latin', logical: 'fonts/noto-sans-latin.ttf', ranges: LATIN},
    {id: 'noto-latin-ext', logical: 'fonts/noto-sans-latin-ext.ttf', ranges: LATIN_EXT}]},
  {id: 'th', family: 'LINE Seed TH', master: 'LINESeedTH-Regular.otf', license: 'OFL-LINESeedTH.txt', features: null, faces: [
    {id: 'th', logical: 'fonts/line-seed-th.otf', ranges: [...LATIN, [0x0E00, 0x0E7F], DOTTED]}]},
  {id: 'arabic', family: 'Noto Sans Arabic', master: 'NotoSansArabic-Regular.ttf', license: 'OFL-NotoSansArabic.txt', features: null, faces: [
    {id: 'arabic', logical: 'fonts/noto-sans-arabic.ttf', ranges: [...LATIN, [0x0600, 0x06FF], [0x0750, 0x077F], [0x08A0, 0x08FF], DOTTED]}]},
  {id: 'hebrew', family: 'Noto Sans Hebrew', master: 'NotoSansHebrew-Regular.ttf', license: 'OFL-NotoSansHebrew.txt', features: null, faces: [
    {id: 'hebrew', logical: 'fonts/noto-sans-hebrew.ttf', ranges: [...LATIN, [0x0590, 0x05FF], [0xFB1D, 0xFB4F], DOTTED]}]},
  {id: 'devanagari', family: 'Noto Sans Devanagari', master: 'NotoSansDevanagari-Regular.ttf', license: 'OFL-NotoSansDevanagari.txt', features: null, faces: [
    {id: 'devanagari', logical: 'fonts/noto-sans-devanagari.ttf', ranges: [...LATIN, [0x0900, 0x097F], [0xA8E0, 0xA8FF], [0x1CD0, 0x1CFF], [0x20B9, 0x20B9], DOTTED]}]},
  {id: 'bengali', family: 'Noto Sans Bengali', master: 'NotoSansBengali-Regular.ttf', license: 'OFL-NotoSansBengali.txt', features: null, faces: [
    {id: 'bengali', logical: 'fonts/noto-sans-bengali.ttf', ranges: [...LATIN, [0x0964, 0x0965], [0x0980, 0x09FF], DOTTED]}]},
  {id: 'tamil', family: 'Noto Sans Tamil', master: 'NotoSansTamil-Regular.ttf', license: 'OFL-NotoSansTamil.txt', features: null, faces: [
    {id: 'tamil', logical: 'fonts/noto-sans-tamil.ttf', ranges: [...LATIN, [0x0964, 0x0965], [0x0B80, 0x0BFF], DOTTED]}]},
];
// gzip budgets per face (bytes): the KR ones are PORT-PLAN A acceptance; the others keep each language's page weight near the ko page's
const BUDGET = {latin: 17000, ko: 230000, 'jp-latin': 17000, 'noto-latin': 17000, 'jp-latin-ext': 40000, 'noto-latin-ext': 40000, 'jp-cyrillic': 20000,
  'jp-ja': 230000, sc: 230000, tc: 260000, th: 30000, arabic: 60000, hebrew: 30000, devanagari: 90000, bengali: 70000, tamil: 40000};

const inRuns = (c, rs) => rs.some(([a, b]) => c >= a && c <= b);
const groupOf = locale => locale.lang === 'ko' ? null : LOCALE_GROUP[locale.locale] ?? 'jp';
const groupLangs = id => LOCALES.filter(l => groupOf(l) === id).map(l => l.lang);
const LOCALE_FACES = GROUPS.flatMap(g => g.faces.map(f => ({...f, group: g.id, family: g.family, langs: f.langs ?? groupLangs(g.id)})));

// Where Korean syllables are read from (only files that exist are scanned; the count per source goes into the lock).
// Pages are generated output, templates and catalogs are the sources; both are scanned so a stale page cannot hide a syllable.
function* walk(p) { const st = fs.statSync(p); if (st.isFile()) { yield p; return; } for (const e of fs.readdirSync(p, {withFileTypes: true})) { if (e.name === '_shots' || e.name.startsWith('.')) continue; yield* walk(path.join(p, e.name)); } }
function syllableSources() {
  const files = [];
  const add = (p, re) => { if (fs.existsSync(p)) for (const f of walk(p)) if (!re || re.test(f)) files.push(f); };
  // ko routes of the generated site, with their inline page copy (PAGE_COPY, nf-copy)
  for (const r of ['index.html', 'feedback/index.html', 'news/index.html', 'privacy/index.html', 'app-privacy/index.html', '404.html']) add(path.join(DOCS, r));
  // templates and partials (tools/templates/partials), the site catalogs and the room text (i18n/rooms, i18n/runtime)
  add(path.join(ROOT, 'tools/templates'), /\.(html|js|mjs)$/);
  add(path.join(ASSETS, 'i18n'), /\.json$/);
  add(path.join(ROOT, 'tools/rooms/rooms.json'));
  // runtime modules that carry Korean copy or room text
  for (const d of ['home', 'feedback', 'site']) add(path.join(ASSETS, d), /\.(js|mjs|css)$/);
  return [...new Set(files)].sort();
}
function scanSyllables() {
  const used = new Set(), perSource = {};
  for (const f of syllableSources()) {
    const text = fs.readFileSync(f, 'utf8'); let n = 0;
    for (const ch of text) { const c = ch.codePointAt(0); if (c >= SYLLABLES[0] && c <= SYLLABLES[1]) { used.add(c); n++; } }
    if (n) perSource[rel(f)] = n;
  }
  return {used, perSource};
}

// ---- what each language's pages show ---------------------------------------------------------------------------------
const ENTITY = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
const unescape = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITY[e] ?? m);
const jsonStrings = (value, out = []) => { if (typeof value === 'string') out.push(value); else if (value && typeof value === 'object') for (const v of Object.values(value)) jsonStrings(v, out); return out; };
// Visible text of a page in its own language: no CSS or code, no elements in another language (the picker's autonyms,
// a name tagged lang="ko"); inline JSON copy (page copy) is kept, its Korean keys fall outside every non-ko face.
function pageText(html, lang) {
  let text = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<script(?![^>]*type="application\/(?:ld\+)?json")[^>]*>[\s\S]*?<\/script>/g, ' ');
  text = text.replace(/<(?!html\b)(\w+)\b[^>]*\slang="([^"]+)"[^>]*>[\s\S]*?<\/\1>/g, (m, tag, l) => l === lang ? m : ' ');
  const scripts = [];
  text = text.replace(/<script[^>]*>([\s\S]*?)<\/script>/g, (m, body) => { try { scripts.push(...jsonStrings(JSON.parse(body))); } catch { scripts.push(body); } return ' '; });
  const attrs = [...text.matchAll(/\s(?:alt|title|aria-label|placeholder|content)="([^"]*)"/g)].map(m => m[1]);
  return unescape([text.replace(/<[^>]+>/g, ' '), ...attrs, ...scripts].join(' '));
}
function langSources(locale) {
  const files = [];
  const json = locale.locale === 'en-US' ? 'i18n/source.json' : `i18n/catalogs/${locale.locale}.json`;
  for (const f of [json, `i18n/rooms/catalogs/${locale.locale}.json`, `i18n/runtime/rooms.${locale.lang}.json`]) if (fs.existsSync(path.join(ASSETS, f))) files.push(path.join(ASSETS, f));
  const templates = path.join(ROOT, 'tools/templates');
  for (const f of fs.readdirSync(templates)) if (f.endsWith(`.${locale.lang}.html`)) files.push(path.join(templates, f));
  const pages = path.join(DOCS, locale.path);
  if (locale.path && fs.existsSync(pages)) for (const f of walk(pages)) if (f.endsWith('index.html')) files.push(f);
  return files.sort();
}
// Code points (no whitespace, no Hangul: page copy keys are Korean) each non-ko language shows.
function scanLanguages() {
  const used = {};
  for (const locale of LOCALES) {
    if (locale.lang === 'ko') continue;
    const set = used[locale.lang] = new Set();
    for (const f of langSources(locale)) {
      const raw = fs.readFileSync(f, 'utf8');
      const text = f.endsWith('.json') ? jsonStrings(JSON.parse(raw)).join(' ') : pageText(raw, locale.lang);
      for (const ch of text) { const c = ch.codePointAt(0); if (c > 0x20 && !/\s/u.test(ch) && !inRuns(c, HANGUL_BLOCKS)) set.add(c); }
    }
  }
  return used;
}

function plan() {
  if (!fs.existsSync(MASTER)) throw new Error(`Font master missing: ${rel(MASTER)}`);
  const cmap = cmapCodepoints(fs.readFileSync(MASTER));
  const latin = new Set([...cmap].filter(c => inRuns(c, LATIN)));
  const ks = new Set([...fs.readFileSync(KS2350, 'utf8')].map(ch => ch.codePointAt(0)).filter(c => c >= SYLLABLES[0] && c <= SYLLABLES[1]));
  if (ks.size !== 2350) throw new Error(`KS X 1001 list has ${ks.size} syllables, expected 2350`);
  const {used, perSource} = scanSyllables();
  const jamo = new Set([...cmap].filter(c => inRuns(c, HANGUL_BLOCKS) && !(c >= SYLLABLES[0] && c <= SYLLABLES[1])));
  const kosyl = new Set([...ks, ...[...used]].filter(c => cmap.has(c)));
  const ko = new Set([...jamo, ...kosyl]);
  const rare = new Set([...cmap].filter(c => c >= SYLLABLES[0] && c <= SYLLABLES[1] && !kosyl.has(c)));
  const ext = new Set([...cmap].filter(c => !latin.has(c) && !inRuns(c, HANGUL_BLOCKS)));
  const outsideCmap = [...used].filter(c => !cmap.has(c));
  return {cmap, sets: {latin, ext, ko, rare}, perSource, extraSyllables: [...used].filter(c => !ks.has(c) && cmap.has(c)), outsideCmap};
}

// Per-language faces: fixed ranges ∩ master cmap, plus the Han in use for Han faces; disjoint within a family (first face wins).
function localePlan() {
  const missing = GROUPS.map(g => path.join(APP_FONTS, g.master)).filter(f => !fs.existsSync(f));
  if (missing.length) return {missing: missing.map(rel)};
  const used = scanLanguages(), sets = {}, masters = {}, unused = {};
  for (const g of GROUPS) {
    const file = path.join(APP_FONTS, g.master), bytes = fs.readFileSync(file), cmap = cmapCodepoints(bytes), claimed = new Set();
    masters[g.id] = {file: `dayloom:assets/fonts/${g.master}`, family: g.family, sha256: sha256(bytes), bytes: bytes.length, license: g.license, path: file};
    for (const f of LOCALE_FACES.filter(x => x.group === g.id)) {
      const set = new Set([...cmap].filter(c => inRuns(c, f.ranges) && !claimed.has(c)));
      if (f.han) for (const lang of f.langs) for (const c of used[lang] ?? []) if (inRuns(c, HAN) && cmap.has(c) && !claimed.has(c)) set.add(c);
      for (const c of set) claimed.add(c);
      sets[f.id] = set;
    }
  }
  // preload a face on the languages whose pages use at least one of its characters
  const preload = Object.fromEntries(LOCALE_FACES.map(f => [f.id, f.langs.filter(lang => [...used[lang] ?? []].some(c => sets[f.id].has(c)))]));
  // characters a language shows that its own faces lack (they fall back to the system font)
  for (const locale of LOCALES) {
    if (locale.lang === 'ko') continue;
    const own = LOCALE_FACES.filter(f => f.langs.includes(locale.lang));
    const gap = [...used[locale.lang]].filter(c => !own.some(f => sets[f.id].has(c)));
    if (gap.length) unused[locale.lang] = gap.sort((a, b) => a - b);
  }
  return {used, sets, masters, preload, gaps: unused};
}

function subset(master, set, outFile, features = null) {
  const unicodes = runs(set).map(([a, b]) => a === b ? hex(a) : `${hex(a)}-${hex(b)}`).join(',');
  fs.writeFileSync(outFile + '.unicodes', unicodes);
  const args = [master, `--unicodes-file=${outFile}.unicodes`, `--output-file=${outFile}`];
  if (master.endsWith('.ttf')) args.push('--no-hinting');   // TrueType hinting: large, and unused by current renderers at these sizes
  if (features) args.push(`--layout-features=${features}`, '--drop-tables+=vmtx,vhea,VORG');
  execFileSync('hb-subset', args, {stdio: ['ignore', 'inherit', 'inherit']});
  fs.rmSync(outFile + '.unicodes');
  return fs.readFileSync(outFile);
}
const gz = b => zlib.gzipSync(b, {level: 9}).length;
const ext = logical => logical.slice(logical.lastIndexOf('.'));
const hanRange = 'U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF';

async function build() {
  const T = toolVersions(), P = plan(), L = localePlan(), masterBytes = fs.readFileSync(MASTER), masterSha = sha256(masterBytes);
  if (L.missing) throw new Error(`Dayloom font masters missing (set DAYLOOM_SOURCE): ${L.missing.join(', ')}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mar-fonts-'));
  const outputs = [], codepoints = {}, faces = [];
  fs.mkdirSync(FONT_DIR, {recursive: true});
  const write = (logical, bytes) => { const file = hashedName(logical, bytes), target = path.join(ASSETS, file); if (!fs.existsSync(target)) fs.writeFileSync(target, bytes); return file; };
  for (const f of FACES) {
    const bytes = subset(MASTER, P.sets[f.id], path.join(tmp, f.id + '.otf'));
    const file = write(f.logical, bytes);
    const rs = runs(P.sets[f.id]);
    codepoints[f.id] = rs;
    const unicodeRange = f.id === 'ko' ? KO_UNICODE_RANGE : f.id === 'rare' ? RARE_UNICODE_RANGE : cssRange(rs);
    faces.push({id: f.id, family: f.family, logical: f.logical, file, unicodeRange, display: 'swap', langs: ['ko'], preload: f.id === 'latin' || f.id === 'ko' ? ['ko'] : []});
    outputs.push({logical: f.logical, file, sha256: sha256(bytes), bytes: bytes.length, gzip: gz(bytes), w: null, h: null, source: 'src:fonts/LINESeedKR-Regular.otf', sourceSha256: masterSha, op: {subset: {tool: 'hb-subset', codepoints: P.sets[f.id].size}}});
  }
  for (const f of LOCALE_FACES) {
    const g = GROUPS.find(x => x.id === f.group), m = L.masters[g.id], set = L.sets[f.id];
    const bytes = subset(m.path, set, path.join(tmp, f.id + ext(f.logical)), g.features);
    const file = write(f.logical, bytes);
    const rs = runs(set);
    codepoints[f.id] = rs;
    const fixed = runs(new Set([...set].filter(c => !inRuns(c, HAN))));
    const unicodeRange = f.han ? cssRange(fixed) + ', ' + hanRange : cssRange(rs);
    faces.push({id: f.id, family: f.family, logical: f.logical, file, unicodeRange, display: 'swap', langs: f.langs, preload: L.preload[f.id]});
    outputs.push({logical: f.logical, file, sha256: sha256(bytes), bytes: bytes.length, gzip: gz(bytes), w: null, h: null, source: m.file, sourceSha256: m.sha256,
      op: {subset: {tool: 'hb-subset', codepoints: set.size, layoutFeatures: g.features ?? 'default', hinting: !m.path.endsWith('.ttf')}}});
  }
  fs.rmSync(tmp, {recursive: true, force: true});
  fs.copyFileSync(path.join(ASSETS, 'OFL-LINESeedKR.txt'), path.join(FONT_DIR, 'OFL-LINESeedKR.txt'));
  for (const g of GROUPS) fs.copyFileSync(path.join(APP_FONTS, g.license), path.join(FONT_DIR, g.license));
  const masters = Object.fromEntries(Object.entries(L.masters).map(([id, {path: _, ...m}]) => [id, m]));
  const extra = {master: {file: rel(MASTER), sha256: masterSha, bytes: masterBytes.length, license: 'OFL 1.1, no Reserved Font Name; docs/assets/fonts/OFL-LINESeedKR.txt'},
    localeMasters: masters, localeGroups: Object.fromEntries(LOCALES.filter(l => l.lang !== 'ko').map(l => [l.lang, groupOf(l)])),
    faces, codepoints, cmapSize: P.cmap.size, ksX1001: 2350, extraSyllables: P.extraSyllables.length, syllableSources: P.perSource,
    hanInUse: Object.fromEntries(LOCALE_FACES.filter(f => f.han).map(f => [f.id, [...L.sets[f.id]].filter(c => inRuns(c, HAN)).length])),
    note: 'codepoints: [lo,hi] runs per face. ko+rare partition the Hangul syllables of the KR master; ko is also used for every jamo. ' +
      'langs: the page languages that declare a face; preload: the languages whose pages preload it (they use at least one of its characters). ' +
      'Han faces hold only the ideographs in use (scanned); their unicode-range names the whole Han blocks so a missing ideograph falls back per character.'};
  writeLock(LOCK, {version: 1, generator: 'tools/assets/build-fonts.mjs', tools: T, dayloom: {path: null, commit: null, dirty: null, note: 'KR master is a copy of Dayloom assets/fonts/LINESeedKR-Regular.otf (byte-identical); the other masters are read from the Dayloom checkout and pinned by sha256 in extra.localeMasters'}, extra, outputs});
  const removed = retain(FONT_DIR, LOCK, outputs.map(o => o.file));
  for (const o of outputs) console.log(`${o.logical.padEnd(34)} ${String(o.bytes).padStart(8)} B  gzip ${String(o.gzip).padStart(7)} B  ${o.op.subset.codepoints} code points`);
  console.log(`ko: ${P.extraSyllables.length} syllables beyond KS X 1001 were added from page/catalog/JS sources${P.outsideCmap.length ? `; ${P.outsideCmap.length} used syllables are not in the font: ${String.fromCodePoint(...P.outsideCmap)}` : ''}; ${removed.length} stale files removed`);
  for (const [lang, gap] of Object.entries(L.gaps)) if (gap.some(c => c !== 0x2713)) console.log(`note ${lang}: ${gap.length} characters in use are in none of its faces (system fallback): ${gap.slice(0, 20).map(c => String.fromCodePoint(c)).join(' ')}`);
  writeSourcesMd();
}

const allFaces = () => [...FACES, ...LOCALE_FACES];
function fileProblems(lock, P, L) {
  const problems = [];
  const sizes = {};
  const byLogical = new Map(allFaces().map(f => [f.logical, f]));
  for (const o of lock.outputs) {
    const f = path.join(ASSETS, o.file);
    if (!fs.existsSync(f)) { problems.push(`missing ${o.file}`); continue; }
    const b = fs.readFileSync(f);
    if (sha256(b) !== o.sha256) problems.push(`${o.file}: content differs from lock`);
    if (!o.file.includes('.' + sha256(b).slice(0, 10) + '.')) problems.push(`${o.file}: name != sha256[:10]`);
    const id = byLogical.get(o.logical)?.id;
    if (!id) { problems.push(`${o.logical}: not a face of build-fonts.mjs`); continue; }
    sizes[id] = gz(b);
    const lockSet = fromRuns(lock.extra.codepoints[id]), real = cmapCodepoints(b);
    if (lockSet.size !== real.size || [...lockSet].some(c => !real.has(c))) problems.push(`${o.file}: cmap (${real.size}) differs from lock code points (${lockSet.size})`);
  }
  for (const f of allFaces()) if (!lock.extra.faces.some(x => x.id === f.id)) problems.push(`face ${f.id} is missing from the lock (run build-fonts.mjs)`);
  // faces of one family never overlap (per-character fallback between families is the browser's job)
  const seen = new Map();
  for (const face of lock.extra.faces) for (const c of fromRuns(lock.extra.codepoints[face.id] ?? [])) {
    const key = face.family + ':' + c;
    if (seen.has(key)) problems.push(`U+${hex(c)} is in both ${seen.get(key)} and ${face.id} (${face.family})`); else seen.set(key, face.id);
  }
  if (P) {
    const kr = new Set(FACES.flatMap(f => [...fromRuns(lock.extra.codepoints[f.id])]));
    const missing = [...P.cmap].filter(c => !kr.has(c)); if (missing.length) problems.push(`${missing.length} KR master code points are in no face`);
    const masterSha = sha256(fs.readFileSync(MASTER)); if (masterSha !== lock.extra.master.sha256) problems.push('font master changed since the lock');
    const ko = fromRuns(lock.extra.codepoints.ko), stale = [...P.sets.ko].filter(c => !ko.has(c));
    if (stale.length) problems.push(`ko face lacks ${stale.length} syllables now used by sources: ${String.fromCodePoint(...stale.slice(0, 20))}… (run build-fonts.mjs)`);
  }
  if (L && !L.missing) {
    for (const [id, m] of Object.entries(L.masters)) if (m.sha256 !== lock.extra.localeMasters?.[id]?.sha256) problems.push(`Dayloom master ${m.file} changed since the lock (run build-fonts.mjs)`);
    for (const f of LOCALE_FACES) {
      const face = lock.extra.faces.find(x => x.id === f.id); if (!face) continue;
      const have = fromRuns(lock.extra.codepoints[f.id]), want = L.sets[f.id];
      const lacking = [...want].filter(c => !have.has(c));
      if (lacking.length) problems.push(`${f.id} face lacks ${lacking.length} characters now used by ${f.langs.join(',')} pages: ${String.fromCodePoint(...lacking.slice(0, 20))}… (run build-fonts.mjs)`);
      if (JSON.stringify(face.preload) !== JSON.stringify(L.preload[f.id])) problems.push(`${f.id} preload ${JSON.stringify(face.preload)} != languages using it now ${JSON.stringify(L.preload[f.id])} (run build-fonts.mjs)`);
      if (JSON.stringify(face.langs) !== JSON.stringify(f.langs)) problems.push(`${f.id} langs ${JSON.stringify(face.langs)} != ${JSON.stringify(f.langs)} (run build-fonts.mjs)`);
    }
  }
  for (const [id, budget] of Object.entries(BUDGET)) if (sizes[id] > budget) problems.push(`${id} gzip ${sizes[id]} > ${budget}`);
  for (const licence of ['OFL-LINESeedKR.txt', ...GROUPS.map(g => g.license)]) if (!fs.existsSync(path.join(FONT_DIR, licence))) problems.push(`${licence} missing from docs/assets/fonts`);
  if (SCRATCH_RE.test(JSON.stringify(lock))) problems.push('lock contains scratch paths');
  return {problems, sizes};
}

function check(flags) {
  const lock = readLock(LOCK); if (!lock) throw new Error(`${rel(LOCK)} is missing; run build-fonts.mjs`);
  const P = plan(), L = localePlan(), {problems, sizes} = fileProblems(lock, P, L);
  if (L.missing && flags.get('verify')) problems.push(`--verify needs the Dayloom font masters: ${L.missing.join(', ')}`);
  if (flags.get('verify') && !L.missing) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mar-fonts-'));
    for (const f of FACES) { const b = subset(MASTER, P.sets[f.id], path.join(tmp, f.id + '.otf')); const o = lock.outputs.find(x => x.logical === f.logical); if (sha256(b) !== o.sha256) problems.push(`${f.logical}: re-subset differs from the lock (hb-subset drift)`); }
    for (const f of LOCALE_FACES) {
      const g = GROUPS.find(x => x.id === f.group);
      const b = subset(L.masters[g.id].path, L.sets[f.id], path.join(tmp, f.id + ext(f.logical)), g.features);
      const o = lock.outputs.find(x => x.logical === f.logical); if (!o || sha256(b) !== o.sha256) problems.push(`${f.logical}: re-subset differs from the lock (hb-subset drift)`);
    }
    fs.rmSync(tmp, {recursive: true, force: true});
  }
  if (problems.length) { console.error('FAIL fonts\n  ' + problems.join('\n  ')); process.exit(1); }
  const note = L.missing ? `; per-language scans skipped (Dayloom masters not found: ${L.missing.length})` : `; ${LOCALE_FACES.length} per-language faces in sync with ${Object.keys(L.used).length} languages`;
  console.log(`PASS fonts: ${lock.outputs.length} faces, names == sha256[:10], cmaps == lock, faces disjoint per family, KR master covered (${P.cmap.size} code points), ko ${P.extraSyllables.length} extra syllables in sync${note}; gzip ${Object.entries(sizes).map(([id, n]) => `${id} ${n}`).join(', ')}`);
}

function report() {
  const lock = readLock(LOCK); if (!lock) throw new Error('run build-fonts.mjs first');
  const used = scanLanguages();
  for (const locale of LOCALES) {
    if (locale.lang === 'ko') continue;
    const own = lock.extra.faces.filter(f => (f.langs ?? []).includes(locale.lang));
    const covered = new Set(own.flatMap(f => [...fromRuns(lock.extra.codepoints[f.id])]));
    const gap = [...used[locale.lang]].filter(c => !covered.has(c)).sort((a, b) => a - b);
    console.log(`${locale.lang.padEnd(8)} ${own.map(f => f.id).join('+').padEnd(36)} ${String(used[locale.lang].size).padStart(5)} characters in use${gap.length ? `; ${gap.length} in none of its faces: ${gap.slice(0, 30).map(c => `U+${hex(c)} ${String.fromCodePoint(c)}`).join('  ')}` : ', all covered'}`);
  }
}

function writeSourcesMd() {
  const lock = readLock(LOCK); if (!lock) return;
  const size = id => lock.extra.codepoints[id].reduce((a, [x, y]) => a + y - x + 1, 0);
  const rows = lock.outputs.map(o => { const f = lock.extra.faces.find(x => x.logical === o.logical); return [`\`${o.logical}\``, `\`${f.family}\``, (f.langs ?? []).join(', '), fmt(size(f.id)), fmt(o.bytes), fmt(o.gzip)]; });
  const masters = Object.values(lock.extra.localeMasters ?? {}).map(m => `\`${m.file.replace('dayloom:', '')}\` (${m.family}, licence \`fonts/${m.license}\`, sha256 \`${m.sha256.slice(0, 12)}…\`)`).join('; ');
  const md = `## Font subsets (generated ${today()})\n\nSubsets produced by \`tools/assets/build-fonts.mjs\` with hb-subset ${lock.tools.hbSubset} and listed in \`architecture/font-asset-sources.json\`. Each page declares and preloads only the faces of its language, the same font the app uses for that language (Dayloom \`src/core/localization/locale-fonts.ts\`).\n\n` +
    `- Korean: LINE Seed KR (\`LINESeedKR-Regular.otf\`, OFL 1.1, no Reserved Font Name, sha256 \`${lock.extra.master.sha256.slice(0, 12)}…\`; byte-identical to Dayloom \`assets/fonts/LINESeedKR-Regular.otf\`). The licence text ships as \`fonts/OFL-LINESeedKR.txt\`. The master is not published; it lives in \`tools/assets/src/fonts/\`.\n` +
    `- Other languages: read from the Dayloom checkout (not copied, not published): ${masters}. Traditional Chinese uses the app's bundled Noto Sans TC because LINE Seed TW reserves its font name, which a subset may not carry.\n\n` +
    table(['File', 'CSS family', 'Languages', 'Code points', 'Bytes', 'Gzip bytes'], rows) +
    `\n\nThe \`ko\` face holds KS X 1001's 2,350 syllables, the jamo blocks and ${lock.extra.extraSyllables} further syllables found in the Korean pages, catalogs, templates and room text; \`rare\` holds the other syllables and loads only when a post uses one. Han faces hold the ideographs their language's pages use (${Object.entries(lock.extra.hanInUse ?? {}).map(([id, n]) => `${id} ${fmt(n)}`).join(', ')}); a missing one falls back to the system font for that character.\n`;
  updateSection('fonts', md);
}

const flags = parseArgs(process.argv.slice(2));
try {
  if (flags.get('report')) report();
  else if (flags.get('check') || flags.get('verify')) check(flags);
  else await withRunLock(build);
} catch (e) { console.error(e.stack ?? e); process.exit(1); }
