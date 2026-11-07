"""Service worker (B2, PORT-PLAN §2.4): ``tools/templates/sw.js`` -> ``docs/sw.js``, the keep list
``docs/assets/cache-keep.<h>.json`` and the registration snippet in ``<!--HEAD_COMMON-->``.

- The keep list is ``assets.keep_urls(build)`` (every hashed or ``?v=`` URL the pages reference, import-map
  values and inline ``url()`` included, plus every room-lock and font-lock file, so the room manifest and
  everything it points to): a sorted JSON array, named after ``sha256(bytes)[:10]``.
- ``docs/sw.js`` is the template with ``__KEEP_URL__`` replaced by ``/assets/cache-keep.<h>.json``, so the
  worker's bytes change exactly when the set of cacheable URLs changes (and the browser installs it).
- Both are shared outputs: full builds only (draft and strict alike), never ``--only``. Older keep lists are
  removed by the same build (``core.write_outputs`` deletes outputs whose content is None); an old worker that
  still asks for its own list gets a 404 and prunes nothing.
- Registration runs after ``load`` and an idle callback, only on ``www.myanimalroom.com`` (docs/CNAME) or with
  ``?sw=1``. ``?sw=off`` unregisters every worker and deletes the ``mar-*`` caches (at once and again after
  ``load``); the worker never re-creates a deleted cache, only the next activation does. The site has no CSP and
  no inline-script hashing, so the snippet is a plain inline script (no eval).

Emergency: replace ``tools/templates/sw.js`` with a worker that removes itself and rebuild. Without the
``__KEEP_URL__`` token the template is copied verbatim::

    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', event => event.waitUntil((async () => {
      for (const name of await caches.keys()) if (name.startsWith('mar-')) await caches.delete(name);
      await self.registration.unregister();
    })()));
"""
import json

from . import core
from .assets import keep_urls
from .core import BuildError, sha10

TEMPLATE = 'tools/templates/sw.js'
TOKEN = '__KEEP_URL__'
KEEP_GLOB = 'assets/cache-keep.*.json'
HOST = 'www.myanimalroom.com'

REGISTER = ('<script>(function(){try{var n=navigator.serviceWorker,l=location,q=l.search;if(!n)return;'
            "if(/[?&]sw=off(&|$)/.test(q)){var off=function(){n.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()})}).catch(function(){});"
            "if(window.caches)caches.keys().then(function(k){k.forEach(function(c){if(c.indexOf('mar-')===0)caches.delete(c)})}).catch(function(){})};"
            "off();addEventListener('load',off);return}"
            f"if(l.hostname!=='{HOST}'&&!/[?&]sw=1(&|$)/.test(q))return;"
            "var go=function(){(window.requestIdleCallback||function(f){setTimeout(f,1500)})(function(){"
            "n.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){})},{timeout:5000})};"
            "if(document.readyState==='complete')go();else addEventListener('load',go)}catch(e){}})();</script>")


def head(ctx):
    return REGISTER


def keep_list(build):
    """``(docs-relative path, text)`` of the keep list."""
    urls = keep_urls(build)
    bad = [url for url in urls if not url.startswith('/') or url.startswith(('//', '/assets/cache-keep.')) or url == '/sw.js']
    if bad:
        raise BuildError(f'keep list: unexpected URL {bad[0]}')
    text = json.dumps(urls, indent=0) + '\n'
    return f'assets/cache-keep.{sha10(text)}.json', text


def worker(build, keep_url):
    file = build.site.repo_file(TEMPLATE)
    template = build.site.templates.get('sw.js') if 'sw.js' in build.site.templates else file.read_text()
    count = template.count(TOKEN)
    if count > 1:
        raise BuildError(f'{TEMPLATE}: {TOKEN} appears {count} times (expected once)')
    return template.replace(TOKEN, keep_url)


def outputs(build):
    rel, text = keep_list(build)
    files = {f'docs/{rel}': text, 'docs/sw.js': worker(build, '/' + rel)}
    for old in sorted(build.site.docs.glob(KEEP_GLOB)):
        path = 'docs/' + old.relative_to(build.site.docs).as_posix()
        files.setdefault(path, None)   # an older generation's list: deleted by write_outputs
    return files


core.register_output(outputs, after_pages=True)
