"""404 page (owner E): registers the ``404`` page set and ``<!--NOT_FOUND_COPY-->``.

GitHub Pages serves one ``docs/404.html`` for every missing URL, so the page is a single Korean document
(``tools/templates/404.ko.html``, built through ``SITE_HEADER:minimal``) plus an embedded map of its strings in the
other 29 languages. The inline script in the template reads the first path segment of the missing URL
(``/ja/nope/`` -> ``ja``), swaps the strings, the document language and direction, and points the links at that
language's routes. Without JavaScript the page shows Korean plus a fixed English line.

``NOT_FOUND_COPY`` emits ``<script type="application/json" id="nf-copy">{"keys": [...], "locales": {path: {lang, dir, t}}}</script>``;
``t`` holds the translations of ``KEYS`` in order. The first six keys are the template's own text; the last three come
from the shared header (skip link, wordmark label, App Store label), so the swapped page has no Korean left. The
page has no canonical, no Open Graph tags, ``noindex``, and is not in the sitemap.
"""
from . import core
from .chrome import STORE_LABEL
from .core import BuildError, LOCALES

# the template's text, in the order the script expects (tools/templates/404.ko.html)
KEYS = [
    '페이지를 찾을 수 없어요 — My Animal Room',
    '찾는 페이지가 없어요',
    '주소가 바뀌었거나 잘못 입력되었을 수 있어요. 홈에서 다시 시작해 보세요.',
    '홈으로',
    '기능 제안',
    '새 소식',
    '본문으로 건너뛰기',
    'My Animal Room 홈',
    STORE_LABEL,
]


class NotFoundPage(core.Page):
    """One file for every locale: ``docs/404.html``."""

    def output(self, locale):
        return 'docs/404.html'


def not_found_copy(ctx, arg):
    locales = {}
    for locale in LOCALES[1:]:
        copy = ctx.build.catalogs[locale['lang']]
        missing = [key for key in KEYS if key not in copy]
        if missing:
            raise BuildError(f'404: {locale["locale"]} has no translation for {missing[0]!r}')
        locales[locale['path']] = {'lang': locale['lang'], 'dir': locale['direction'], 't': [copy[key] for key in KEYS]}
    return '<script type="application/json" id="nf-copy">' + core.javascript({'locales': locales}) + '</script>'


core.PAGES['404'] = NotFoundPage('404', 'translated', ('ko',), '404.ko.html')
core.register('NOT_FOUND_COPY', not_found_copy)
