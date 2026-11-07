// Generated group tables inside docs/assets/ASSET-SOURCES.md, one marker pair per generator. Nobody edits these by hand.
import fs from 'node:fs';
import path from 'node:path';
import {ASSETS} from './common.mjs';

const FILE = path.join(ASSETS, 'ASSET-SOURCES.md');
const marks = name => [`<!-- generated:${name} begin (tools/assets: do not edit by hand) -->`, `<!-- generated:${name} end -->`];
export const today = () => new Date().toISOString().slice(0, 10);

export function updateSection(name, markdown) {
  const [begin, end] = marks(name);
  let text = fs.readFileSync(FILE, 'utf8');
  const block = `${begin}\n${markdown.trim()}\n${end}`;
  const a = text.indexOf(begin), b = text.indexOf(end);
  if (a >= 0 && b > a) text = text.slice(0, a) + block + text.slice(b + end.length);
  else text = text.replace(/\s*$/, '\n\n') + block + '\n';
  fs.writeFileSync(FILE, text);
}
export const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i === head.length - 1 && /bytes|size|kb|mb/i.test(head[i]) ? '---:' : '---')).join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
export const fmt = n => n.toLocaleString('en-US');
