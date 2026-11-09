"""SEO and head metadata (owner E): ``<!--HEAD_META-->`` and ``docs/sitemap.xml``.

``<!--HEAD_META-->`` (``page`` phase: it mirrors the page's translated ``<title>`` and meta description, so it
must come after both) emits, in this order:

- ``theme-color``; ``referrer`` on the suggestion board and the news (as before);
- ``canonical`` and ``<!--LOCALE_ALTERNATES-->`` (hreflang) from the route registry;
- Open Graph (``og:site_name``, ``og:type``, ``og:title``, ``og:description``, ``og:url``, ``og:locale``) and
  ``og:image`` (absolute URL of the hashed share image, ``og:image:width/height/alt``) with
  ``twitter:card=summary_large_image``;
- icon links (``icon`` 48/96/192, ``apple-touch-icon``);
- on the home only, one JSON-LD graph (``Organization``, ``WebSite``, ``MobileApplication``; see ``structured_data``).

``<!--HEAD_META:minimal-->`` (the 404 page) emits only ``theme-color`` and the icon links: no canonical, no
alternates, no Open Graph.

The share image is ``art/og/og-home.jpg`` (tools/assets/render-og.mjs, list tools/assets/art/brand.json): the garden
room and the Latin wordmark, no Korean text, so one file serves every locale. ``OG_BY_PAGE`` lets a page set use
another logical image (community may add one). Social platforms cache by URL; the hashed name is the cache bust.

The sitemap lists every generated page except the 404, with ``<lastmod>`` from the ledger ``tools/page-dates.json``
(``{path: {sha256, lastmod}}``): a strict full build bumps a page's date to the build day only when the page's bytes
changed since the ledger. A draft build never writes the ledger and reuses the recorded dates (no date for a page the
ledger has not seen), so draft output never invents freshness.
"""
import datetime
import hashlib
import html
import json
import re

from . import core
from .core import LOCALES, ORIGIN, PAGES, page_locales, route

OG_IMAGE = 'art/og/og-home.jpg'
OG_SIZE = (1200, 630)
OG_ALT = 'My Animal Room'                  # the image shows the app icon, the Latin wordmark and the garden room
OG_BY_PAGE = {}                            # page name -> logical art path overriding OG_IMAGE
REFERRER_PAGES = ('feedback', 'news')
ICONS = (('/assets/icons/icon-48.png', '48x48'), ('/assets/icons/icon-96.png', '96x96'), ('/assets/icons/icon-192.png', '192x192'))
APPLE_TOUCH_ICON = '/assets/icons/apple-touch-icon-180.png'
APP_ICON = ORIGIN + '/assets/icons/app-icon-512.png'
THEME_COLOR = '#FFFFFF'

# Store-verified facts (App Store listing JSON-LD, kr and us storefronts, 2026-11-06): free, iOS 16.4 and iPadOS 16.4
# or later, iPhone and iPad, category Productivity (Apple encodes it as BusinessApplication). The listing names are
# per storefront; locales without a verified storefront name omit alternateName.
APP_STORE_NAME = {'ko': 'My Animal Room: 집중 타이머', 'en': 'My Animal Room: Focus Timer'}
OPERATING_SYSTEM = 'iOS 16.4+, iPadOS 16.4+, Android'
ORGANIZATION_DESCRIPTION = 'My Animal Room develops a mobile app for focus, daily memories and room customization, alongside character animation content.'
SOCIAL = ['https://www.youtube.com/@MyAnimalRoomLife', 'https://www.threads.com/@myanimalroomlife', 'https://www.instagram.com/myanimalroomlife']

RELEASE_CLAIMS = ('개발 중', '출시 전', 'Not yet released', 'in development')   # the app is live on the App Store (extras X1)
TITLE = re.compile(r'<title>(.*?)</title>', re.S)
DESCRIPTION = re.compile(r'<meta name="description" content="([^"]*)"')


def og_locale(locale):
    """``ko-KR`` -> ``ko_KR``; ``zh-Hans-CN`` -> ``zh_CN`` (language and region only)."""
    parts = locale['locale'].split('-')
    return parts[0] + '_' + parts[-1]


def icon_links(ctx):
    links = ''.join(f'<link rel="icon" href="{href}" type="image/png" sizes="{sizes}">' for href, sizes in ICONS)
    return links + f'<link rel="apple-touch-icon" href="{APPLE_TOUCH_ICON}" sizes="180x180">'


def structured_data(ctx, description):
    """The home page's JSON-LD graph (plain text in, a JSON string out).

    ``MobileApplication`` carries store-verified facts only (see APP_STORE_NAME): no ratings or reviews, no
    release claims. The price currency follows the storefront language: KRW on ko, USD elsewhere."""
    from .chrome import STORES
    locale, lang = ctx.locale, ctx.locale['lang']
    project, app_store = ORIGIN + '/#project', STORES['app']
    app = {'@type': 'MobileApplication', '@id': ORIGIN + '/#app', 'name': 'My Animal Room'}
    if lang in APP_STORE_NAME:
        app['alternateName'] = APP_STORE_NAME[lang]
    app.update({
        'url': ORIGIN + route(locale), 'description': description,
        'operatingSystem': OPERATING_SYSTEM, 'availableOnDevice': 'iPhone, iPad, Android', 'applicationCategory': 'BusinessApplication',
        'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KRW' if lang == 'ko' else 'USD'},
        'installUrl': app_store, 'sameAs': [app_store] + ([STORES['play']] if STORES.get('play_live') else []),
        'image': APP_ICON, 'publisher': {'@id': project},
    })
    graph = [
        {'@type': 'Organization', '@id': project, 'name': 'My Animal Room', 'url': ORIGIN + '/', 'logo': APP_ICON,
         'email': 'contact@myanimalroom.com', 'sameAs': SOCIAL, 'description': ORGANIZATION_DESCRIPTION},
        {'@type': 'WebSite', '@id': ORIGIN + '/#website', 'url': ORIGIN + '/', 'name': 'My Animal Room',
         'inLanguage': [item['lang'] for item in LOCALES], 'publisher': {'@id': project}},
        app,
    ]
    return json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False).replace('<', '\\u003c')


def head_meta(ctx, arg):
    minimal = arg == 'minimal'
    parts = [f'<meta name="theme-color" content="{THEME_COLOR}">']
    if minimal:
        return ''.join(parts) + icon_links(ctx)
    page, locale = ctx.page.name, ctx.locale
    title, description = TITLE.search(ctx.html), DESCRIPTION.search(ctx.html)
    if not title or not description:
        raise core.BuildError(f'{ctx.template}: HEAD_META needs <title> and <meta name="description"> before it')
    for claim in RELEASE_CLAIMS:
        # strict builds only: draft catalogs may still carry the old translations of keys that were rewritten
        if ctx.build.mode == 'strict' and (claim in title[1] or claim in description[1]):
            raise core.BuildError(f'{ctx.template}: the title or description claims the app is unreleased ({claim!r}); it is live on the App Store')
    url = ORIGIN + route(locale, page)
    logical = OG_BY_PAGE.get(page, OG_IMAGE)
    image = ORIGIN + ctx.build.assets.hashed(logical)
    if page in REFERRER_PAGES:
        parts.append('<meta name="referrer" content="strict-origin-when-cross-origin">')
    parts.append(f'<link rel="canonical" href="{url}">' + core.alternates(ctx, None))
    parts.append(
        '<meta property="og:site_name" content="My Animal Room"><meta property="og:type" content="website">'
        f'<meta property="og:title" content="{html.escape(html.unescape(title[1].strip()))}">'
        f'<meta property="og:description" content="{description[1]}">'
        f'<meta property="og:url" content="{url}"><meta property="og:locale" content="{og_locale(locale)}">'
        f'<meta property="og:image" content="{image}"><meta property="og:image:width" content="{OG_SIZE[0]}">'
        f'<meta property="og:image:height" content="{OG_SIZE[1]}"><meta property="og:image:alt" content="{OG_ALT}">'
        '<meta name="twitter:card" content="summary_large_image">')
    parts.append(icon_links(ctx))
    if page == 'home':
        parts.append('<script type="application/ld+json">' + structured_data(ctx, html.unescape(description[1])) + '</script>')
    return ''.join(parts)


# --------------------------------------------------------------------------------------------
# Sitemap and the lastmod ledger

LEDGER = 'tools/page-dates.json'


def sitemap_pages():
    """``[(path, output file)]`` in sitemap order: translated pages locale by locale, then the authored policies."""
    pairs = [(route(locale, page.name), page.output(locale)) for locale in LOCALES for page in PAGES.values()
             if page.kind == 'translated' and page.name != '404']
    pairs += [(route(locale, page.name), page.output(locale)) for page in PAGES.values() if page.kind == 'authored' for locale in page_locales(page.name)]
    return pairs


def sitemap(build):
    file = build.site.repo_file(LEDGER)
    ledger = json.loads(file.read_text()) if file.exists() else {}
    strict = build.mode == 'strict' and build.only is None
    today = datetime.date.today().isoformat()
    updated, lines = {}, []
    for path, output in sitemap_pages():
        digest = hashlib.sha256(core.as_bytes(build.pages[output])).hexdigest()
        previous = ledger.get(path) or {}
        if previous.get('sha256') == digest:
            entry = previous
        elif strict:
            entry = {'sha256': digest, 'lastmod': today}
        else:
            entry = {'sha256': previous.get('sha256'), 'lastmod': previous.get('lastmod')}
        updated[path] = entry
        lastmod = f'<lastmod>{entry["lastmod"]}</lastmod>' if entry.get('lastmod') else ''
        lines.append(f'  <url><loc>{ORIGIN}{path}</loc>{lastmod}</url>\n')
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(lines) + '</urlset>\n'
    files = {'docs/sitemap.xml': xml}
    if strict:
        files[LEDGER] = json.dumps(updated, indent=1, sort_keys=True) + '\n'
    return files


core.register('HEAD_META', head_meta)
core.register_output(sitemap, after_pages=True)
