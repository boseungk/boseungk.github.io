// Runtime text for the home (PORT-PLAN §2.6): the build inlines this page's copy as #page-copy
// (tools/sitebuild/copy.py collects every single-quoted string passed to the text function by the home modules).
import { readCopy, createText } from '/assets/site/text.mjs';

const data = readCopy('page-copy');
export const meta = data.meta;
export const text = createText(data.copy, meta.locale || meta.lang);

// '오후 5:05' in Korean, '5:05 PM' in English: the page language decides, never a fixed locale.
const clock = new Intl.DateTimeFormat(meta.locale || document.documentElement.lang, { hour: 'numeric', minute: '2-digit' });
export const timeOf = date => clock.format(date);
