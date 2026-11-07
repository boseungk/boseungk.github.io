/* Site header state (owner D; classic defer, after ui/selection.js and site/language-picker.js).
   - .is-solid once the page has scrolled more than 8px: the bar's 1px line fades in (site/chrome.css).
   - .is-stacked when the one-row bar (760px and wider) does not fit its items, for example long translated nav
     labels: chrome.css then uses the two-row layout. Below 760px the CSS stacks the bar by itself. */
(function () {
  'use strict';
  const bar = document.getElementById('bar');
  if (!bar) return;
  let solid = null, width = -1;
  function scroll() {
    const on = window.scrollY > 8;
    if (on !== solid) { solid = on; bar.classList.toggle('is-solid', on); }
  }
  const wide = window.matchMedia('(min-width: 760px)');
  // Compare the bar's own items with its content box (not scrollWidth: a group's wash SVG can be wider for a frame).
  function overflows() {
    const box = bar.getBoundingClientRect(), style = getComputedStyle(bar);
    const left = box.left + parseFloat(style.paddingLeft) - .5, right = box.right - parseFloat(style.paddingRight) + .5;
    return [...bar.children].some(item => {
      const rect = item.getBoundingClientRect();
      return rect.width > 0 && (rect.left < left || rect.right > right);
    });
  }
  function fit() {
    bar.classList.remove('is-stacked');
    if (wide.matches && overflows()) bar.classList.add('is-stacked');
  }
  window.addEventListener('scroll', scroll, {passive: true});
  scroll();
  if ('ResizeObserver' in window) {
    new ResizeObserver(entries => {
      const next = Math.round(entries[entries.length - 1].contentRect.width);
      if (next !== width) { width = next; fit(); }
    }).observe(bar);
  } else {
    window.addEventListener('resize', fit);
  }
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
})();
