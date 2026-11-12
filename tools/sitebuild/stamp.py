"""Stamp local asset URLs in generated HTML and assemble ``<!--HEAD_COMMON-->``.

Stamped (``AssetIndex.resolve``: lock-listed logical names -> hashed files, other files -> ``?v=``):
- ``src``, ``srcset``, ``poster``, ``data-src``, any ``data-*`` value starting with ``/assets/``;
- ``href`` on ``<link rel~=stylesheet|preload|modulepreload|icon|apple-touch-icon>``;
- ``url(/…)`` inside inline ``<style>`` elements and ``style=""`` attributes (quoted or not).
Not stamped: page routes (paths ending in ``/``), external URLs, ``<a href>``, absolute ``og:`` URLs,
``url(#id)`` and ``data:`` URLs.

After stamping, the import map that ``<!--HEAD_COMMON-->`` reserved is filled from the page's
module graph (``importmap.fill``); a page with module scripts but no reserved map fails.

Templates never carry version strings: a hand-written ``?v=`` fails the build.

``<!--ART_VARS:…-->`` (page head) emits CSS custom properties for art that CSS files use, since
CSS files never contain ``url()`` to art (PORT-PLAN §2.3). The argument is a space-separated list of
``name=/assets/art/…`` or bare ``/assets/art/…`` items; a bare item is named after its path below
``/assets/`` (``/assets/art/pieces/wood-mask.webp`` -> ``--art-pieces-wood-mask``)::

    <!--ART_VARS:wood-mask=/assets/art/pieces/wood-mask.webp /assets/art/night-band.webp-->
    -> <style>:root{--art-wood-mask:url(/assets/art/pieces/wood-mask.98ba7985cd.webp);
                    --art-night-band:url(/assets/art/night-band.3875a11461.webp)}</style>

A hand-written ``<style>:root{--art-x:url(/assets/art/x.webp)}</style>`` is stamped the same way.
"""
from html.parser import HTMLParser
import html
import re

from . import core
from .core import BuildError

LINK_RELS = {'stylesheet', 'preload', 'modulepreload', 'icon', 'apple-touch-icon'}
VERSION = re.compile(r'(?:^|[?&])v=')
CSS_URL = re.compile(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]+))\s*\)''')
STYLE_END = re.compile(r'</style\s*>', re.I)
VAR_NAME = re.compile(r'^[a-z0-9][a-z0-9-]*$')


class Tags(HTMLParser):
    """Collect the exact text and offset of every start tag."""

    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.tags = []
        self.line_starts = [0] + [match.end() for match in re.finditer('\n', source)]

    def handle_starttag(self, tag, attrs):
        line, column = self.getpos()
        self.tags.append((self.line_starts[line - 1] + column, self.get_starttag_text(), tag, attrs))


def stamp_attributes(tag, attrs):
    names = []
    rels = set()
    for key, value in attrs:
        if key == 'rel' and value:
            rels = set(value.lower().split())
    for key, value in attrs:
        if value is None:
            continue
        if key in ('src', 'srcset', 'poster', 'data-src'):
            names.append(key)
        elif key == 'href' and tag == 'link' and rels & LINK_RELS:
            names.append(key)
        elif key.startswith('data-') and value.startswith('/assets/'):
            names.append(key)
        elif key == 'style' and 'url(' in value:
            names.append(key)
    return names


def stamp_url(url, index, where):
    if not url.startswith('/') or url.startswith('//'):
        return url
    path, hash_, fragment = url.partition('#')
    path, question, query = path.partition('?')
    if VERSION.search('?' + query if question else ''):
        raise BuildError(f'{where}: hand-written version string in {url}; templates never carry ?v= (the build stamps it)')
    if path.endswith('/'):
        return url
    stamped = index.resolve(path)
    if question:
        stamped = stamped.replace('?v=', '?' + query + '&v=', 1) if '?v=' in stamped else stamped + '?' + query
    return stamped + (hash_ + fragment)


def css_urls(css):
    """Yield ``(start, end, url)`` for every ``url(…)`` value (the span of the URL text only)."""
    for match in CSS_URL.finditer(css):
        group = 1 if match[1] is not None else 2 if match[2] is not None else 3
        yield match.start(group), match.end(group), match[group]


def stamp_css(css, index, where):
    out, last = [], 0
    for start, end, url in css_urls(css):
        stamped = stamp_url(url.strip(), index, where)
        if stamped != url:
            out.append(css[last:start])
            out.append(stamped)
            last = end
    out.append(css[last:])
    return ''.join(out)


def stamp_value(name, value, index, where):
    if name == 'srcset':
        parts = []
        for candidate in value.split(','):
            bits = candidate.strip().split(None, 1)
            if not bits:
                continue
            parts.append(' '.join([stamp_url(bits[0], index, where), *bits[1:]]))
        return ', '.join(parts)
    if name == 'style':
        return stamp_css(value, index, where)
    return stamp_url(value, index, where)


def stamp_html(text, index, where=''):
    from . import importmap
    parser = Tags(text)
    parser.feed(text)
    out, last = [], 0
    for offset, raw, tag, attrs in parser.tags:
        if tag == 'style' and offset >= last:
            body_start = offset + len(raw)
            end = STYLE_END.search(text, body_start)
            body_end = end.start() if end else len(text)
            css = text[body_start:body_end]
            stamped = stamp_css(css, index, where)
            if stamped != css:
                out.append(text[last:body_start])
                out.append(stamped)
                last = body_end
            continue
        names = stamp_attributes(tag, attrs)
        if not names:
            continue
        new = raw
        for name in names:
            pattern = re.compile(r'(\s' + re.escape(name) + r'\s*=\s*)("([^"]*)"|\'([^\']*)\')')
            match = pattern.search(new)
            if not match:
                continue
            quote = match[2][0]
            raw_value = match[3] if match[3] is not None else match[4]
            if name == 'style':
                # CSS in an attribute: rewrite the URLs in place and keep every other byte.
                stamped = stamp_css(raw_value, index, where)
                if stamped != raw_value:
                    new = new[:match.start(2)] + quote + stamped + quote + new[match.end(2):]
                continue
            value = html.unescape(raw_value)
            stamped = stamp_value(name, value, index, where)
            if stamped != value:
                new = new[:match.start(2)] + quote + html.escape(stamped, quote=True) + quote + new[match.end(2):]
        if new != raw:
            out.append(text[last:offset])
            out.append(new)
            last = offset + len(raw)
    out.append(text[last:])
    return importmap.fill(''.join(out), index, where)


def art_vars(ctx, arg):
    """``<!--ART_VARS:name=/assets/art/x.webp …-->`` -> ``<style>:root{--art-name:url(…)}</style>``.

    URLs stay logical here; ``stamp_html`` maps them to hashed files with every other URL."""
    declarations = []
    for item in (arg or '').split():
        name, _, url = item.rpartition('=')
        if not name:
            path = url.split('?')[0]
            name = re.sub(r'\.[^./]+$', '', path[len('/assets/'):] if path.startswith('/assets/') else path.lstrip('/'))
            name = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
            name = name if name.startswith('art-') else 'art-' + name
        elif not name.startswith('art-'):
            name = 'art-' + name
        if not VAR_NAME.match(name) or not url.startswith('/assets/'):
            raise BuildError(f'{ctx.template}: ART_VARS item {item!r} must be name=/assets/… or /assets/…')
        declarations.append(f'--{name}:url({url})')
    if not declarations:
        raise BuildError(f'{ctx.template}: ART_VARS needs at least one /assets/… URL')
    return '<style>:root{' + ';'.join(declarations) + '}</style>'


def head_common(ctx, arg):
    """Per-page head block right after the viewport meta: font preloads and inline @font-face
    (fonts.py), the reserved import map (importmap.py, filled after stamping) and the SW
    registration (B2, sw.py), then the device flag the phone bar uses to pick its store and the Cloudflare Web Analytics loader (chrome.py)."""
    from . import chrome, fonts, importmap, sw
    return fonts.head(ctx) + importmap.head(ctx) + sw.head(ctx) + chrome.DEVICE_FLAG + chrome.CF_ANALYTICS


core.register('HEAD_COMMON', head_common)
core.register('ART_VARS', art_vars)
