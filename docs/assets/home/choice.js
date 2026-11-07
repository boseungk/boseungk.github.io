// Radio groups of the home (time of day, hourglass colour, focus screen, theme): arrow keys move and choose,
// mirrored under RTL; one Tab stop per group (roving tabindex). The selection wash itself is ui/selection.js
// ([data-choice-group] in the template), which follows aria-checked.
export function radios(L, group, buttons, choose) {
  const checked = () => buttons.find(b => b.getAttribute('aria-checked') === 'true') || buttons[0];
  const sync = () => { const current = checked(); buttons.forEach(b => { b.tabIndex = b === current ? 0 : -1; }); };
  sync();
  const watch = L.mo(sync);
  buttons.forEach(b => watch.observe(b, { attributes: true, attributeFilter: ['aria-checked'] }));
  L.on(group, 'keydown', e => {
    const rtl = getComputedStyle(group).direction === 'rtl';
    const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    const from = buttons.indexOf(document.activeElement);
    let next = null;
    if (step) next = buttons[((from < 0 ? buttons.indexOf(checked()) : from) + step + buttons.length) % buttons.length];
    else if (e.key === 'Home') next = buttons[0];
    else if (e.key === 'End') next = buttons[buttons.length - 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
    choose(next);
  });
  L.add(() => buttons.forEach(b => b.removeAttribute('tabindex')));
}
