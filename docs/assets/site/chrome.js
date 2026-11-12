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

/* Traffic source (no cookies, no IP; counts only, see /privacy/).
   - The source comes from ?utm_source=&utm_campaign= (kept for this tab in sessionStorage), else the referring site,
     else "direct". Instagram bio link: /?utm_source=instagram&utm_medium=social&utm_campaign=ig-bio
   - Store links carry it: App Store ct=<campaign|source|site> (pt is the provider token), Google Play referrer=utm_*.
     App Store Connect (Sources > Campaigns) and Play Console (acquisition, UTM) then count installs per source.
   - One beacon per page view and per store click to the feedback API's /v1/hit (production host only). */
(function () {
  'use strict';
  try {
    if (navigator.webdriver || /bot|crawl|spider|slurp|preview/i.test(navigator.userAgent)) return;
    const clean = v => String(v || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    const query = new URLSearchParams(location.search);
    let source = clean(query.get('utm_source')), campaign = clean(query.get('utm_campaign')), medium = clean(query.get('utm_medium'));
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('mar-src') || 'null'); } catch (e) {}
    if (source) {
      try { sessionStorage.setItem('mar-src', JSON.stringify({source, campaign, medium})); } catch (e) {}
    } else if (saved && saved.source) {
      ({source, campaign, medium} = {source: clean(saved.source), campaign: clean(saved.campaign), medium: clean(saved.medium)});
    } else {
      let host = '';
      try { host = new URL(document.referrer).hostname; } catch (e) {}
      if (host && host !== location.hostname) {
        source = clean(host.replace(/^(www|m|l|lm|mobile)\./, ''));
        try { sessionStorage.setItem('mar-src', JSON.stringify({source, campaign: '', medium: 'referral'})); } catch (e) {}
      }
    }
    const appTag = campaign || source || 'site';
    for (const a of document.querySelectorAll('a[href^="https://apps.apple.com/"], a[href^="https://play.google.com/store/apps/details"]')) {
      const url = new URL(a.href);
      if (url.hostname === 'apps.apple.com') {
        url.searchParams.set('pt', '129654209'); url.searchParams.set('ct', appTag); url.searchParams.set('mt', '8');
      } else {
        url.searchParams.set('referrer', new URLSearchParams({utm_source: source || 'website', utm_medium: medium || 'website',
          utm_campaign: campaign || source || 'site'}).toString());
      }
      a.href = url.toString();
    }
    if (location.hostname !== 'www.myanimalroom.com' || !navigator.sendBeacon) return;
    const page = location.pathname.toLowerCase();
    const send = data => {
      try { navigator.sendBeacon('https://feedback-api.myanimalroom.com/v1/hit', JSON.stringify(Object.assign({page, source, campaign}, data))); } catch (e) {}
    };
    if (page !== '/' && page !== '/index.html') send({kind: 'visit'});
    document.addEventListener('click', event => {
      const a = event.target.closest && event.target.closest('a[href]');
      if (!a) return;
      if (a.hostname === 'apps.apple.com') send({kind: 'store', store: 'app'});
      else if (a.hostname === 'play.google.com') send({kind: 'store', store: 'play'});
    }, true);
  } catch (e) {}
})();
