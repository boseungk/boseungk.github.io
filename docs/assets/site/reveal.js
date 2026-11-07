/* One-shot entrance for static pages (owner D; news, and the 404 page if it wants it). Classic defer.
   Elements with .reveal rise 7px and fade in once (site/base.css: .rv .reveal / .reveal.in, 220ms paper,
   optional --rd delay) when they enter the viewport. Nothing is hidden unless this script runs, and it does
   nothing under reduced motion, in a hidden tab or without IntersectionObserver: the page stays as written. */
(function () {
  'use strict';
  const items = document.querySelectorAll('.reveal');
  if (!items.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, {threshold: .15});
  document.documentElement.classList.add('rv');
  items.forEach(item => observer.observe(item));
})();
