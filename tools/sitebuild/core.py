"""Build core: locales, routes, registries, catalogs, render, build, write and check.

Owner modules register what they contribute at import time:
- ``register_page(name, ...)``       a page set (one template, many locales)
- ``register(name, fn, phase)``      a ``<!--NAME-->`` / ``<!--NAME:arg-->`` placeholder
- ``register_output(fn, page)``      generated files (runtime copy, sitemap, ...)
- ``register_keys(fn)``              translation keys used outside templates

Placeholder phases: ``source`` runs on the Korean template before translation (its output is
translated and collected for the translator); ``page`` runs on the translated page.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import hashlib
import json
import re

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / 'docs'
I18N = DOCS / 'assets/i18n'
ORIGIN = 'https://www.myanimalroom.com'
KOREAN = re.compile('[가-힣]')
LOCALES = json.loads((I18N / 'locales.json').read_text())
PLACEHOLDER = re.compile(r'<!--([A-Z][A-Z0-9_]*)(?::([^>]*?))?-->')
MODES = ('strict', 'draft')


class BuildError(ValueError):
    """A build input is invalid. Strict mode reports these and exits non-zero."""


# --------------------------------------------------------------------------------------------
# Registries

@dataclass
class Page:
    name: str
    kind: str = 'translated'          # 'translated' (one Korean template) or 'authored' (one per lang)
    langs: tuple | None = None        # authored pages: the languages that have a template
    template: str | None = None       # translated pages: template file name

    def template_for(self, locale):
        return self.template if self.kind == 'translated' else f'{self.name}.{locale["lang"]}.html'

    def output(self, locale):
        return 'docs/' + route(locale, self.name).lstrip('/') + 'index.html'


PAGES = {}
PLACEHOLDERS = {}
OUTPUTS = []
KEY_SOURCES = []


def register_page(name, kind='translated', langs=None, template=None):
    PAGES[name] = Page(name, kind, tuple(langs) if langs else None, template or (f'{name}.ko.html' if kind == 'translated' else None))
    return PAGES[name]


def register(name, fn, phase='page'):
    """Register ``fn(ctx, arg) -> str`` for ``<!--NAME-->`` or ``<!--NAME:arg-->``."""
    assert phase in ('source', 'page'), phase
    PLACEHOLDERS[name] = (phase, fn)


def register_output(fn, page=None, after_pages=False):
    """Register ``fn(build) -> {repo-relative path: text}``.

    ``page`` names the page set that owns the files (written by ``--only <page>``); ``None`` marks a
    shared output that only full builds write. ``after_pages`` outputs see ``build.pages``.
    """
    OUTPUTS.append((fn, page, after_pages))


def register_keys(fn):
    """Register ``fn(build) -> [KeyUse]`` for keys used outside templates (runtime code, partials)."""
    KEY_SOURCES.append(fn)


@dataclass
class KeyUse:
    key: str
    catalog: str = 'site'
    kind: str = 'body'
    context: dict = field(default_factory=dict)
    app_ui: bool = False
    phrase: bool = False
    runtime_page: str | None = None   # a page whose runtime copy carries this key (draft markers)
    source: str | None = None         # rooms catalog: the Korean text of an id key


# --------------------------------------------------------------------------------------------
# Routes

def page_locales(page):
    entry = PAGES.get(page)
    langs = entry.langs if entry else None
    return [locale for locale in LOCALES if not langs or locale['lang'] in langs]


def route(locale, page='home'):
    entry = PAGES.get(page)
    if entry and entry.langs and locale['lang'] not in entry.langs:
        return f'/en/{page}/'
    return '/' + (locale['path'] + '/' if locale['path'] else '') + (page + '/' if page != 'home' else '')


def locale_by_code(code):
    return next(item for item in LOCALES if item['locale'] == code)


# --------------------------------------------------------------------------------------------
# Inputs (a Site can replace any input with an in-memory value; tools/check-build.py uses this)

class Site:
    def __init__(self, repo=REPO, templates=None, source=None, catalogs=None, files=None):
        self.repo = Path(repo)
        self.docs = self.repo / 'docs'
        self.templates = templates or {}
        self._source = source
        self._catalogs = catalogs or {}
        self.files = files or {}       # docs-relative path -> str | bytes

    def template(self, name):
        if name in self.templates:
            return self.templates[name]
        return (self.repo / 'tools/templates' / name).read_text()

    def template_exists(self, name):
        return name in self.templates or (self.repo / 'tools/templates' / name).exists()

    def source(self):
        if self._source is None:
            self._source = json.loads((self.docs / 'assets/i18n/source.json').read_text())
        return self._source

    def source_bytes(self):
        if 'assets/i18n/source.json' in self.files:
            return as_bytes(self.files['assets/i18n/source.json'])
        if self._source is not None and not (self.docs / 'assets/i18n/source.json').exists():
            return json.dumps(self._source, ensure_ascii=False, indent=2).encode() + b'\n'
        return (self.docs / 'assets/i18n/source.json').read_bytes()

    def catalog(self, code):
        """Return a locale catalog, or None when the file is absent."""
        if code in self._catalogs:
            return self._catalogs[code]
        file = self.docs / 'assets/i18n/catalogs' / (code + '.json')
        return json.loads(file.read_text()) if file.exists() else None

    def exists(self, rel):
        return rel in self.files or (self.docs / rel).is_file()

    def read_bytes(self, rel):
        return as_bytes(self.files[rel]) if rel in self.files else (self.docs / rel).read_bytes()

    def read_text(self, rel):
        return self.files[rel] if isinstance(self.files.get(rel), str) else self.read_bytes(rel).decode()

    def read_json(self, rel, default=None):
        return json.loads(self.read_text(rel)) if self.exists(rel) else default

    def repo_file(self, rel):
        return self.repo / rel


def as_bytes(value):
    return value.encode() if isinstance(value, str) else value


def sha10(data):
    return hashlib.sha256(as_bytes(data)).hexdigest()[:10]


# --------------------------------------------------------------------------------------------
# Catalog validation (strict rules; draft applies the same rules and falls back to Korean)

PLACEHOLDER_NAME = re.compile(r'\{\w+\}')
TAG = re.compile(r'<[^>]+>')
PHRASE_TAGS = {'<br>', '<br/>', '<br />', '<span class="hl">', '<span class="nw">', '</span>'}
HL = '<span class="hl">'


def phrase_markup_ok(value, key):
    tags = TAG.findall(value)
    if any(tag not in PHRASE_TAGS for tag in tags):
        return False
    depth = 0
    for tag in tags:
        if tag.startswith('<span'):
            depth += 1
        elif tag == '</span>':
            depth -= 1
            if depth < 0:
                return False
    return depth == 0 and tags.count(HL) == TAG.findall(key).count(HL)


def invalid_reason(key, value, source_value, phrase=False):
    """Return why ``value`` is not a usable translation of ``key`` (None when it is)."""
    if not isinstance(value, str) or not value.strip():
        return 'empty'
    if sorted(PLACEHOLDER_NAME.findall(value)) != sorted(PLACEHOLDER_NAME.findall(source_value)):
        return 'placeholders'
    if phrase:
        if not phrase_markup_ok(value, key):
            return 'markup'
    elif TAG.findall(value) != TAG.findall(source_value):
        return 'markup'
    return None


def load_catalogs(site, phrase_keys=frozenset()):
    """Strict catalogs: every locale has every source key with valid placeholders and markup."""
    source = site.source()
    catalogs = {}
    for locale in LOCALES:
        code = locale['locale']
        if code == 'ko-KR':
            copy = {key: key for key in source}
        elif code == 'en-US':
            copy = source
        else:
            copy = site.catalog(code)
            if copy is None:
                raise BuildError(f'{code}: missing catalog file')
        if copy.keys() != source.keys():
            raise BuildError(f'{code}: missing {source.keys() - copy.keys()}, extra {copy.keys() - source.keys()}')
        for key, value in copy.items():
            reason = invalid_reason(key, value, source[key], key in phrase_keys)
            if reason == 'empty':
                raise BuildError(f'{code}: empty translation for {key}')
            if reason == 'placeholders':
                raise BuildError(f'{code}: changed placeholders for {key}')
            if reason == 'markup':
                raise BuildError(f'{code}: changed markup for {key}')
        catalogs[locale['lang']] = copy
    return catalogs


class Copy(dict):
    """A page's catalog view that records which keys the page used (for draft markers)."""

    def __init__(self, values):
        super().__init__(values)
        self.used = set()

    def __getitem__(self, key):
        if key not in self:
            raise BuildError(f'Missing source copy: {key!r}')
        self.used.add(key)
        return super().__getitem__(key)

    def get(self, key, default=None):
        if key in self:
            self.used.add(key)
            return super().__getitem__(key)
        return default


# --------------------------------------------------------------------------------------------
# Placeholder expansion

@dataclass
class PageContext:
    build: object
    page: Page
    locale: dict
    copy: Copy
    template: str
    html: str = ''

    @property
    def site(self):
        return self.build.site


def expand(text, phase, ctx, pieces=None):
    """Resolve the placeholders registered for ``phase``. ``pieces`` (a list) receives
    ``(out_start, out_end, src_start, origin)`` spans so callers can map output offsets back to
    template lines; ``origin`` is None for template text or the module file of an expansion."""
    out, last, position = [], 0, 0
    for match in PLACEHOLDER.finditer(text):
        entry = PLACEHOLDERS.get(match[1])
        if not entry or entry[0] != phase:
            continue
        literal = text[last:match.start()]
        if pieces is not None:
            pieces.append((position, position + len(literal), last, None))
        out.append(literal)
        position += len(literal)
        ctx.html = ''.join(out)
        value = entry[1](ctx, match[2])
        if pieces is not None:
            pieces.append((position, position + len(value), match.start(), getattr(entry[1], 'origin', None) or module_file(entry[1])))
        out.append(value)
        position += len(value)
        last = match.end()
    if pieces is not None:
        pieces.append((position, position + len(text) - last, last, None))
    out.append(text[last:])
    return ''.join(out)


def module_file(fn):
    module = getattr(fn, '__module__', '') or ''
    return 'tools/' + module.replace('.', '/') + '.py' if module.startswith('sitebuild') else module


# --------------------------------------------------------------------------------------------
# Render

def alternates(ctx, arg):
    page = ctx.page.name
    result = ''.join(f'<link rel="alternate" hreflang="{item["lang"]}" href="{ORIGIN}{route(item, page)}">' for item in page_locales(page))
    return result + f'<link rel="alternate" hreflang="x-default" href="{ORIGIN}{route(LOCALES[1], page)}">'


register('LOCALE_ALTERNATES', alternates)


def render(build, page, locale):
    from .translate import Translate
    from . import stamp
    copy = Copy(build.catalogs[locale['lang']])
    name = page.template_for(locale)
    ctx = PageContext(build, page, locale, copy, name)
    text = expand(build.site.template(name), 'source', ctx)
    if page.kind == 'translated':
        translator = Translate(locale, copy)
        translator.feed(text)
        text = ''.join(translator.output)
    # Keep authored policy copy separate from the marketing translation catalog.
    text = expand(text, 'page', ctx)
    if locale['direction'] == 'rtl':
        text = text.replace('<span aria-hidden="true">→</span>', '<span aria-hidden="true">←</span>')
    left = PLACEHOLDER.search(text)
    if left:
        raise BuildError(f'{name}: unresolved placeholder {left[0]}')
    text = stamp.stamp_html(text, build.assets, name)
    return text, copy.used


# --------------------------------------------------------------------------------------------
# Build

class Build:
    def __init__(self, site=None, mode='strict', only=None):
        from . import draft
        from .assets import AssetIndex
        assert mode in MODES, mode
        self.site = site or Site()
        self.mode = mode
        self.only = list(only) if only else None
        for name in self.only or ():
            if name not in PAGES:
                raise BuildError(f'--only: unknown page {name!r}; pages: {", ".join(PAGES)}')
        self.uses = draft.collect(self)
        self.phrase_keys = frozenset(use.key for use in self.uses if use.phrase and use.catalog == 'site')
        if mode == 'strict':
            self.catalogs = load_catalogs(self.site, self.phrase_keys)
            self.fallback = {item['lang']: set() for item in LOCALES}
        else:
            self.catalogs, self.fallback, self.reasons = draft.fallback_catalogs(self)
        self.assets = AssetIndex(self.site)
        self.pages = {}
        self.page_used = {}

    def selected(self, page):
        return self.only is None or page in self.only

    def runtime_keys(self, page):
        return {use.key for use in self.uses if use.runtime_page == page and use.catalog == 'site'}

    def run(self):
        from . import draft
        generated = {}
        for fn, owner, after in OUTPUTS:
            if after or not (owner is None and self.only is None or owner is not None and self.selected(owner)):
                continue
            files = fn(self)
            generated.update(files)
            self.assets.override_many(files)
        # Page-owned runtime files are hashed even when another page set is being built.
        for fn, owner, after in OUTPUTS:
            if not after and owner is not None and not self.selected(owner):
                self.assets.override_many(fn(self))
        for page in PAGES.values():
            if not self.selected(page.name):
                continue
            runtime = self.runtime_keys(page.name)
            for locale in page_locales(page.name):
                text, used = render(self, page, locale)
                if self.mode == 'draft':
                    text = draft.mark(text, locale, (used | runtime) & self.fallback[locale['lang']])
                self.pages[page.output(locale)] = text
                self.page_used[page.output(locale)] = used | runtime
        from . import entrypoints
        entrypoints.add(self)
        for fn, owner, after in OUTPUTS:
            if after and (owner is None and self.only is None or owner is not None and self.selected(owner)):
                generated.update(fn(self))
        return {**self.pages, **generated}


def untranslated_count(site=None):
    """Number of keys the draft report would list (0 when everything is translated)."""
    from . import draft
    try:
        return len(draft.report(Build(site, 'draft'))['keys'])
    except Exception:  # the hint must never hide the original failure
        return None


def untranslated_hint(site=None):
    count = untranslated_count(site)
    return f'{count} keys untranslated; run --draft to list them' if count else ''


def write_outputs(outputs, root=REPO, check=False):
    """Write (only changed files) or compare outputs. Returns the list of stale paths.
    Content None means the file must not exist (sw.py: an older keep list); it is deleted."""
    stale = []
    for rel, content in outputs.items():
        file = Path(root) / rel
        current = file.read_text() if file.exists() else None
        if current == content:
            continue
        stale.append(rel)
        if not check and content is None:
            file.unlink()
        elif not check:
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(content)
    return stale


def javascript(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


# The page sets that exist today, in sitemap order. E's notfound.py registers 404.
register_page('home')
register_page('feedback')
register_page('news')
register_page('privacy', kind='authored', langs=('ko', 'en'))
register_page('app-privacy', kind='authored', langs=('ko', 'en', 'ja', 'zh-Hant'))
