/* Community motion (PORT-PLAN 2.6, community plan 5): calm, one-shot, Web Animations only.
   Callers set the final state first (text, classes, attributes, focus) and then call these; nothing waits for an
   animation. Every function returns at once, leaving that final state, when the visitor prefers reduced motion
   or the tab is hidden. No ambient loops: a row rises, a vote swells, a new post opens with a fading Oat wash. */

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const PAPER = 'cubic-bezier(.22,.61,.36,1)', INK = 'cubic-bezier(.4,0,.2,1)';
const SWELL = 'cubic-bezier(.3,.6,.4,1)', RETURN = 'cubic-bezier(.4,0,.6,1)';
const NS = 'http://www.w3.org/2000/svg';

export const still = () => reduce.matches || document.hidden;

// Rows of the first render and of each "더 보기" batch: 7px rise, 220ms, 40ms stagger capped at index 7.
export function rise(nodes, {stagger = 40, cap = 7, distance = 7} = {}) {
  if (still()) return;
  nodes.forEach((node, index) => node.animate(
    [{opacity: 0, transform: `translateY(${distance}px)`}, {opacity: 1, transform: 'none'}],
    {duration: 220, delay: Math.min(index, cap) * stagger, easing: PAPER, fill: 'backwards'}));
}

// Rows of a new sort or filter: opacity only, 24ms stagger capped at index 5.
export function fade(nodes, {stagger = 24, cap = 5} = {}) {
  if (still()) return;
  nodes.forEach((node, index) => node.animate([{opacity: 0}, {opacity: 1}],
    {duration: 220, delay: Math.min(index, cap) * stagger, easing: PAPER, fill: 'backwards'}));
}

// Rows of the current view while a slow response is pending (and back).
export function dim(nodes, on) {
  nodes.forEach(node => {
    const target = on ? .5 : 1;
    const from = Number(getComputedStyle(node).opacity);
    node.style.opacity = on ? '.5' : '';
    if (!still() && from !== target) node.animate([{opacity: from}, {opacity: target}], {duration: 120, easing: INK});
  });
}

// Status lines, the copy-link note and errors: opacity in, 110ms linear.
export function appear(node, duration = 110, easing = 'linear') {
  if (still() || !node) return;
  node.animate([{opacity: 0}, {opacity: 1}], {duration, easing});
}

// Vote on: the button swells (1 -> 1.06 -> 1, peak at 40%) on press.
export function swell(node) {
  if (still()) return;
  node.animate([
    {transform: 'scale(1)', easing: SWELL},
    {transform: 'scale(1.06)', offset: .4, easing: RETURN},
    {transform: 'scale(1)'}
  ], {duration: 300});
}

// The vote count changes when the server answers: the old number leaves upward, the new one rises in.
// box is a one-cell grid holding one <span>; the outgoing copy shares the cell until it is removed.
export function swapCount(box, text) {
  const spans = [...box.children];
  spans.slice(0, -1).forEach(span => span.remove());
  const current = spans[spans.length - 1];
  if (!current || current.textContent === text) return;
  if (still() || !current.textContent) { current.textContent = text; return; }
  const next = current.cloneNode(false);
  next.textContent = text;
  box.append(next);
  current.animate([{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'translateY(-4px)'}],
    {duration: 120, easing: INK, fill: 'forwards'}).onfinish = () => current.remove();
  next.animate([{opacity: 0, transform: 'translateY(7px)'}, {opacity: 1, transform: 'none'}],
    {duration: 220, delay: 60, easing: PAPER, fill: 'backwards'});
}

// An irregular Oat wash (the app's choice-wash path) behind a row: it holds, then fades and is removed.
// height (optional): the row's height measured before something below it opens; the wash then keeps that fixed
// height instead of following the row (feedback.css sizes it to 100%), so its curves are not stretched.
export function wash(node, {hold = 400, fade: out = 700, height: fixed} = {}) {
  if (still()) return;
  node.querySelector(':scope > .feedback-wash')?.remove();
  const rect = node.getBoundingClientRect();
  const w = Math.round(rect.width + 24), h = Math.round((fixed ?? rect.height) + 12);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'feedback-wash');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS(NS, 'path');
  const shape = window.MARSelectionSpec?.path;
  path.setAttribute('d', shape ? shape([0, 0, w, h]) : `M${w * .16} ${h * .08}C${w * .35} 0 ${w * .73} 0 ${w * .88} ${h * .12}C${w} ${h * .2} ${w} ${h * .7} ${w * .89} ${h * .87}C${w * .74} ${h} ${w * .33} ${h} ${w * .13} ${h * .89}C0 ${h * .81} 0 ${h * .31} ${w * .08} ${h * .18}Z`);
  svg.append(path);
  if (fixed !== undefined) svg.style.height = h + 'px';
  node.prepend(svg);
  const total = hold + out;
  svg.animate([{opacity: 1}, {opacity: 1, offset: hold / total, easing: INK}, {opacity: 0}],
    {duration: total, fill: 'forwards'}).onfinish = () => svg.remove();
}

// A new idea: the row opens from 0 to its height (neighbours glide down), its content fades in, a wash marks it.
export function arrive(row) {
  if (still()) return;
  const height = row.getBoundingClientRect().height;
  const style = getComputedStyle(row);
  const content = [...row.children];
  row.animate([
    {height: '0px', paddingTop: '0px', paddingBottom: '0px', clipPath: 'inset(0 -12px)'},
    {height: height + 'px', paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, clipPath: 'inset(-6px -12px)'}
  ], {duration: 300, easing: PAPER});
  content.forEach(node => node.animate([{opacity: 0}, {opacity: 1}], {duration: 220, delay: 80, easing: PAPER, fill: 'backwards'}));
  wash(row, {hold: 400, fade: 700});
}

// A new comment: a 7px rise and a small wash.
export function settle(node) {
  if (still()) return;
  node.animate([{opacity: 0, transform: 'translateY(7px)'}, {opacity: 1, transform: 'none'}], {duration: 220, easing: PAPER});
  wash(node, {hold: 300, fade: 700});
}

// Comments panel: grid rows 0fr <-> 1fr. The caller has already set .is-open and inert.
export function disclose(panel, open) {
  if (still()) return;
  const inner = panel.firstElementChild;
  panel.animate([{gridTemplateRows: open ? '0fr' : '1fr', visibility: 'visible'}, {gridTemplateRows: open ? '1fr' : '0fr', visibility: 'visible'}],
    {duration: open ? 300 : 220, easing: open ? PAPER : INK});
  if (open) inner.animate([{opacity: 0, overflow: 'hidden'}, {opacity: 1, overflow: 'hidden'}], {duration: 240, delay: 60, easing: PAPER, fill: 'backwards'});
  else inner.animate([{opacity: 1, overflow: 'hidden'}, {opacity: 0, overflow: 'hidden', offset: 120 / 220}, {opacity: 0, overflow: 'hidden'}], {duration: 220, easing: INK});
}

// A long text opening or closing: its height moves from the previous value to the new one.
export function resize(node, from) {
  if (still()) return;
  const to = node.getBoundingClientRect().height;
  if (Math.abs(to - from) < 1) return;
  node.animate([{height: from + 'px', overflow: 'hidden'}, {height: to + 'px', overflow: 'hidden'}], {duration: 300, easing: PAPER});
}
