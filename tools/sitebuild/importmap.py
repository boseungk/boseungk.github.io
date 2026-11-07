"""ES module graph and import maps.

``module_graph(site, entries, read)`` follows static ``import … from '…'`` / ``export … from '…'`` /
``import '…'`` and literal ``import('…')`` from each entry module, recursively, and returns the
local module paths in discovery order. ``copy.py`` uses it for ``<!--PAGE_COPY-->``. A specifier
with ``?v=`` fails the build: specifiers stay bare so a module exists once (the map versions it).

Import maps (PORT-PLAN §2.3): ``head()`` (part of ``<!--HEAD_COMMON-->``) reserves the map's place
before any module script; after the page is rendered and stamped, ``fill()`` replaces the
reservation with ``<script type="importmap">{"imports":{"/assets/x.js":"/assets/x.js?v=<sha10>",…}}``
covering every local module reachable from the page's ``<script type="module" src>`` (entries
included), or removes it when the page has no modules. A page with module scripts and no
``<!--HEAD_COMMON-->`` fails, and so does a module script placed before the map.
"""
from html.parser import HTMLParser
from posixpath import dirname, normpath
import re

from . import core
from .core import BuildError

SPECIFIER = re.compile(r"""(?:\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?|\bexport\s*[\w*{}\s,$]+?\s*from\s*|\bimport\s*\(\s*)(['"])([^'"\n]+)\1""")
VERSIONED = re.compile(r'(?:^|&)v=')
RESERVED = '<script type="importmap" data-sitebuild-importmap></script>'
MODULE_SCRIPT = re.compile(r'<script\b[^>]*\btype\s*=\s*["\']?module\b', re.I)


class ModuleScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.entries = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('type') == 'module' and attrs.get('src'):
            self.entries.append(attrs['src'])


def module_entries(html):
    parser = ModuleScripts()
    parser.feed(html)
    return parser.entries


def resolve(specifier, base):
    """Resolve a specifier against a root-absolute module path; None for bare/external ones."""
    specifier = specifier.split('#')[0].split('?')[0]
    if specifier.startswith(('./', '../')):
        return normpath(dirname(base) + '/' + specifier)
    if specifier.startswith('/') and not specifier.startswith('//'):
        return normpath(specifier)
    return None


def specifiers(source):
    return [match[2] for match in SPECIFIER.finditer(source)]


def module_graph(site, entries, read=None):
    read = read or (lambda path: site.read_text(path.lstrip('/')))
    seen, queue = [], [resolve(entry, '/') for entry in entries]
    while queue:
        path = queue.pop(0)
        if path is None or path in seen:
            continue
        seen.append(path)
        for specifier in specifiers(read(path)):
            if VERSIONED.search(specifier.split('#')[0].partition('?')[2]):
                raise BuildError(f'{path}: version string in module specifier {specifier!r}; specifiers stay bare (the import map versions them)')
            queue.append(resolve(specifier, path))
    return seen


def head(ctx):
    return RESERVED


def import_map(text, index):
    """The ``{"imports": …}`` object for a rendered page, or None when it has no module scripts."""
    entries = module_entries(text)
    if not entries:
        return None
    graph = module_graph(index.site, entries, read=lambda path: index.read_text(path.lstrip('/')))
    return {'imports': {path: index.resolve(path) for path in graph}}


def fill(text, index, where=''):
    reserved = text.find(RESERVED)
    if text.count(RESERVED) > 1:
        raise BuildError(f'{where}: <!--HEAD_COMMON--> appears more than once')
    mapping = import_map(text, index)
    if mapping is None:
        return text.replace(RESERVED, '') if reserved >= 0 else text
    if reserved < 0:
        raise BuildError(f'{where}: page loads ES modules but has no <!--HEAD_COMMON--> (the import map goes there)')
    first = MODULE_SCRIPT.search(text)
    if first and first.start() < reserved:
        raise BuildError(f'{where}: a module script comes before <!--HEAD_COMMON-->; the import map must precede it')
    return text.replace(RESERVED, '<script type="importmap">' + core.javascript(mapping) + '</script>')
