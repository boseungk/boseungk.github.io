"""``<!--PAGE_COPY-->``: the page's runtime copy as inline JSON.

Output: ``<script type="application/json" id="page-copy">{"meta":{lang, locale, direction,
routes:{home,feedback,news,privacy,appPrivacy}},"copy":{…}}</script>``. The keys are every
``t('…')`` / ``text('…')`` first argument (a single-quoted literal) in the page's module graph,
followed from its ``<script type="module" src>``. ``docs/assets/site/text.mjs`` reads it.
"""
import re

from . import core
from .core import KeyUse, route
from .importmap import module_entries, module_graph

KEY_CALL = re.compile(r"\b(?:t|text)\(\s*'([^']*)'")


def graph_keys(site, html, read=None):
    """Return ``{key: (module path, line)}`` for the module graph of ``html``, first use wins."""
    read = read or (lambda path: site.read_text(path.lstrip('/')))
    keys = {}
    for path in module_graph(site, module_entries(html), read):
        source = read(path)
        for match in KEY_CALL.finditer(source):
            keys.setdefault(match[1], (path, source.count('\n', 0, match.start()) + 1))
    return keys


def page_copy(ctx, arg):
    keys = graph_keys(ctx.site, ctx.site.template(ctx.template))
    locale = ctx.locale
    meta = {'lang': locale['lang'], 'locale': locale['locale'], 'direction': locale['direction'],
            'routes': {'home': route(locale), 'feedback': route(locale, 'feedback'), 'news': route(locale, 'news'),
                       'privacy': route(locale, 'privacy'), 'appPrivacy': route(locale, 'app-privacy')}}
    copy = {key: ctx.copy[key] for key in sorted(keys)}
    return '<script type="application/json" id="page-copy">' + core.javascript({'meta': meta, 'copy': copy}) + '</script>'


def uses(build):
    result = []
    for page in core.PAGES.values():
        if page.kind != 'translated' or not build.site.template_exists(page.template):
            continue
        template = build.site.template(page.template)
        if '<!--PAGE_COPY-->' not in template:
            continue
        for key, (path, line) in graph_keys(build.site, template).items():
            result.append(KeyUse(key, kind='runtime', runtime_page=page.name,
                                 context={'page': page.name, 'file': 'docs' + path, 'line': line, 'element': None, 'attr': None}))
    return result


core.register('PAGE_COPY', page_copy)
core.register_keys(uses)
