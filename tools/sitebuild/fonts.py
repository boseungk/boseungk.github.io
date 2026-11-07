"""Font emission from the font lock (``architecture/font-asset-sources.json``, PORT-PLAN §2.10, extras F2).

Each page declares only its own language's faces, the font the app uses for that language
(``tools/assets/build-fonts.mjs``). ``head(ctx)`` (part of ``<!--HEAD_COMMON-->``) emits, per page:
- ``<link rel="preload" as="font" crossorigin>`` for each face whose lock ``preload`` lists the page
  language (the languages whose pages use at least one of its characters);
- one inline ``<style>`` with an ``@font-face`` per face whose lock ``langs`` lists the page language, in lock order:
  ko pages get family ``"LINE Seed"`` (``latin``, ``ext``, ``ko`` on non-overlapping ranges) and ``"LINE Seed Rare"``
  (``rare``, the remaining Hangul syllables, never preloaded, loaded only when ``unicode-range`` and per-character
  fallback ask for it); other languages get ``"LINE Seed JP"``, ``"Noto Sans"``, ``"Noto Sans SC"``, ... .
  Weight 400, normal style, ``font-display`` from the lock (``swap``).
The 404 page (one file whose script switches language from the URL) declares every face and preloads the ko ones.
URLs are written logical (``/assets/fonts/line-seed-latin.otf``); the stamp pass maps them to the
hashed files listed in the lock, like every other URL.

CSS uses ``font-family: var(--font)`` with ``--font: var(--font-face), <script fallbacks>, system-ui, sans-serif``
and ``--font-face`` set per language in base.css. No CSS file carries ``@font-face``.

While the font lock is absent, ``head()`` emits nothing.

APIs for other packages: ``faces(site)`` (lock faces, or [] without a lock), ``page_faces(site, lang, page)``,
``preload_faces(site, lang)``, ``face_css(site, faces)`` (the ``@font-face`` text with logical URLs) and
``covered(site, lang)`` (the code points the page language's faces hold).
"""
from .assets import load_locks
from .core import BuildError

FORMATS = {'otf': ('opentype', 'font/otf'), 'woff2': ('woff2', 'font/woff2'), 'woff': ('woff', 'font/woff'), 'ttf': ('truetype', 'font/ttf')}


def faces(site):
    lock = load_locks(site).get('font')
    if not lock:
        return []
    result = (lock.get('extra') or {}).get('faces')
    if not result:
        raise BuildError('architecture/font-asset-sources.json: extra.faces is missing')
    for face in result:
        missing = {'id', 'family', 'logical', 'unicodeRange'} - set(face)
        if missing:
            raise BuildError(f'font lock face {face.get("id")!r}: missing {sorted(missing)}')
        if face['logical'].rsplit('.', 1)[-1] not in FORMATS:
            raise BuildError(f'font lock face {face["id"]!r}: unknown font format {face["logical"]}')
    return result


def _listed(value, lang):
    """A lock ``langs``/``preload`` value: a list of page languages, ``"all"``, one language, or empty."""
    if value in (None, [], ''):
        return False
    return value == 'all' or value == lang or (isinstance(value, list) and lang in value)


def page_faces(site, lang, page=None):
    """The faces a page declares: its language's (every face on the 404, whose script switches language)."""
    every = faces(site)
    if page == '404':
        return every
    return [face for face in every if 'langs' not in face or _listed(face['langs'], lang)]


def preload_faces(site, lang):
    return [face for face in faces(site) if _listed(face.get('preload'), lang)]


def covered(site, lang):
    """Code points held by the faces a ``lang`` page declares (from the lock's ``codepoints`` runs)."""
    lock = load_locks(site).get('font') or {}
    runs = (lock.get('extra') or {}).get('codepoints') or {}
    points = set()
    for face in page_faces(site, lang):
        for lo, hi in runs.get(face['id'], []):
            points.update(range(lo, hi + 1))
    return points


def url(face):
    return '/assets/' + face['logical']


def face_css(site, chosen=None):
    rules = []
    for face in faces(site) if chosen is None else chosen:
        family = face['family'].replace('"', '')
        css_format = FORMATS[face['logical'].rsplit('.', 1)[-1]][0]
        unicode_range = ','.join(part.strip() for part in face['unicodeRange'].split(','))
        rules.append(f'@font-face{{font-family:"{family}";src:url({url(face)}) format("{css_format}");'
                     f'font-weight:400;font-style:normal;font-display:{face.get("display") or "swap"};unicode-range:{unicode_range}}}')
    return ''.join(rules)


def head(ctx):
    if not faces(ctx.site):
        return ''
    preloads = ''.join(f'<link rel="preload" href="{url(face)}" as="font" type="{FORMATS[face["logical"].rsplit(".", 1)[-1]][1]}" crossorigin>'
                       for face in preload_faces(ctx.site, ctx.locale['lang']))
    return preloads + '<style>' + face_css(ctx.site, page_faces(ctx.site, ctx.locale['lang'], ctx.page.name)) + '</style>'

