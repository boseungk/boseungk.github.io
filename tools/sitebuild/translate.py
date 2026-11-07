"""Translate the Korean templates: text nodes, attributes, phrase keys, translate="no", routes.

- Text nodes and attribute values are keys (the Korean text itself).
- An element with ``data-phrase`` is translated as one key: its inner HTML with whitespace runs
  collapsed. It may contain only ``<br>``, ``<span class="hl">`` and ``<span class="nw">``.
  The attribute is stripped from the output.
- A ``translate="no"`` subtree is copied as written and is exempt from the missing-Korean check.
- ``data-app-ui`` marks app-UI demo text for the translator report (stripped from the output).
- With ``recorder`` set, every key is also recorded with its context (draft report).
"""
from html.parser import HTMLParser
import html
import re

from .core import KOREAN, ORIGIN, BuildError, route

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
NO_WORD_GAP = ('ja', 'zh-Hans', 'zh-Hant')
BUILD_ONLY_ATTRS = ('data-phrase', 'data-app-ui')
BR = re.compile(r'<br\s*/?>')
PAGE_URLS = [('/feedback/', 'feedback'), ('/news/', 'news'), ('/privacy/', 'privacy'), ('/app-privacy/', 'app-privacy'), ('/', 'home')]
HEADINGS = ('h1', 'h2', 'h3', 'h4', 'h5', 'h6')
LABELS = ('label', 'legend', 'summary', 'option', 'optgroup', 'th', 'dt', 'caption')
BLOCKS = ('p', 'li', 'figcaption', 'blockquote', 'dd', 'td', 'div', 'section', 'main', 'article', 'footer', 'header')


class Identity(dict):
    """Collector catalog: every value is its own translation."""

    def __contains__(self, key):
        return True

    def get(self, key, default=None):
        return key


def collapse(value):
    return re.sub(r'\s+', ' ', value).strip()


def describe(tag, attrs):
    if attrs.get('id'):
        return f'{tag}#{attrs["id"]}'
    if attrs.get('class'):
        return f'{tag}.{attrs["class"].split()[0]}'
    return tag


def kind_of(frames, attr):
    if attr == 'aria-label':
        return 'aria'
    if attr == 'alt':
        return 'alt'
    if attr == 'placeholder':
        return 'placeholder'
    if attr == 'content':
        return 'meta'
    if attr is not None:
        return 'label'
    for tag, attrs, _ in reversed(frames):
        if tag == 'title':
            return 'meta'
        if tag in HEADINGS:
            return 'heading'
        classes = (attrs.get('class') or '').split()
        if tag == 'button' or attrs.get('role') == 'button' or tag == 'a' and {'store', 'button', 'btn'} & set(classes):
            return 'button'
        if tag in LABELS or tag == 'nav':
            return 'label'
        if tag in BLOCKS:
            return 'body'
    return 'body'


class Translate(HTMLParser):
    def __init__(self, locale, copy, recorder=None, known=frozenset()):
        super().__init__(convert_charrefs=False)
        self.locale, self.copy = locale, copy
        self.output = []
        self.raw = False
        self.recorder, self.known = recorder, known
        self.frames = []          # [tag, attrs, last heading in this section]
        self.phrase = None        # {'tag', 'depth', 'start'}
        self.skip = None          # translate="no": {'tag', 'depth'}
        self.source = ''
        self.line_starts = [0]

    # -- positions ------------------------------------------------------------------------
    def feed(self, data):
        base = len(self.source)
        self.source += data
        self.line_starts.extend(base + match.end() for match in re.finditer('\n', data))
        super().feed(data)

    def position(self):
        line, column = self.getpos()
        return self.line_starts[line - 1] + column

    # -- keys -----------------------------------------------------------------------------
    def record(self, value, attr=None, tag=None, attrs=None, phrase=False):
        if self.recorder is None or not (KOREAN.search(value) or value in self.known):
            return
        frames = self.frames + ([[tag, attrs or {}, None]] if tag else [])
        section = next((frame for frame in reversed(self.frames) if frame[0] == 'section'), None)
        heading = section[2] if section else None
        text_tag = frames[-1][0] if frames else None
        if attr is None and section is not None and any(frame[0] in HEADINGS[:3] for frame in frames):
            section[2] = collapse(re.sub(r'<[^>]+>', ' ', value))
        self.recorder.append({
            'key': value, 'attr': attr, 'element': text_tag, 'pos': self.position(), 'phrase': phrase,
            'path': ' > '.join(describe(t, a) for t, a, _ in frames if t not in ('html', 'body')),
            'section': heading, 'kind': kind_of(frames, attr),
            'appUi': any('data-app-ui' in a for _, a, _ in frames),
        })

    def text(self, value, attr=None, tag=None, attrs=None):
        self.record(value, attr, tag, attrs)
        if KOREAN.search(value) and value not in self.copy:
            raise BuildError(f'Missing source copy: {value!r}')
        return self.copy.get(value, value)

    def phrase_text(self, key):
        self.record(key, phrase=True)
        if KOREAN.search(key) and key not in self.copy:
            raise BuildError(f'Missing source copy: {key!r}')
        value = self.copy.get(key, key)
        if self.locale['lang'] not in NO_WORD_GAP:
            value = BR.sub(lambda match: match[0] + ' ', value)
        return value

    def url(self, value):
        for source, page in PAGE_URLS:
            if value == source or value.startswith(source + '#') or value.startswith(source + '?'):
                return route(self.locale, page) + value[len(source):]
            if value == ORIGIN + source:
                return ORIGIN + route(self.locale, page)
        return value

    # -- events ---------------------------------------------------------------------------
    def handle_decl(self, data):
        self.output.append(f'<!{data}>')

    def handle_starttag(self, tag, attrs):
        original = dict(attrs)
        if self.skip:
            self.output.append(self.get_starttag_text())
            if tag == self.skip['tag'] and tag not in VOID:
                self.skip['depth'] += 1
            return
        if self.phrase:
            classes = (original.get('class') or '').split()
            if not (tag == 'br' or tag == 'span' and len(attrs) == 1 and classes in (['hl'], ['nw'])):
                raise BuildError(f'data-phrase may contain only <br>, <span class="hl"> and <span class="nw">, found <{tag}> in {self.phrase["tag"]}')
            if tag == self.phrase['tag']:
                self.phrase['depth'] += 1
            return
        if original.get('translate') == 'no' and not self.raw:
            self.output.append(self.get_starttag_text())
            if tag not in VOID:
                self.skip = {'tag': tag, 'depth': 0}
            return
        self.raw = tag in ('script', 'style') or self.raw
        translated = []
        for key, value in attrs:
            if key in BUILD_ONLY_ATTRS:
                continue
            if value is not None:
                value = self.text(value, key, tag, original)
                if key in ('href', 'content'):
                    value = self.url(value)
                if key == 'content' and original.get('property') == 'og:locale':
                    value = {'zh-Hans-CN': 'zh_CN', 'zh-Hant-TW': 'zh_TW'}.get(self.locale['locale'], self.locale['locale'].replace('-', '_'))
            if tag == 'html' and key == 'lang':
                value = self.locale['lang']
            translated.append(key if value is None else f'{key}="{html.escape(value, quote=True)}"')
        if tag == 'html':
            translated.extend([f'dir="{self.locale["direction"]}"', f'data-app-locale="{self.locale["locale"]}"'])
        self.output.append('<' + tag + (' ' + ' '.join(translated) if translated else '') + '>')
        # Space-separated scripts keep a word gap when a line break is hidden on narrow screens.
        if tag == 'br' and self.locale['lang'] not in NO_WORD_GAP:
            self.output.append(' ')
        if tag not in VOID:
            self.frames.append([tag, original, None])
        if 'data-phrase' in original:
            if tag in VOID:
                raise BuildError(f'data-phrase on a void element <{tag}>')
            self.phrase = {'tag': tag, 'depth': 0, 'start': self.position() + len(self.get_starttag_text())}

    def handle_endtag(self, tag):
        if self.skip:
            self.output.append(f'</{tag}>')
            if tag == self.skip['tag']:
                if self.skip['depth']:
                    self.skip['depth'] -= 1
                else:
                    self.skip = None
            return
        if self.phrase:
            if tag != self.phrase['tag']:
                return
            if self.phrase['depth']:
                self.phrase['depth'] -= 1
                return
            inner = self.source[self.phrase['start']:self.position()]
            self.phrase = None
            self.output.append(self.phrase_text(collapse(inner)))
        self.output.append(f'</{tag}>')
        if tag in ('script', 'style'):
            self.raw = False
        for index in range(len(self.frames) - 1, -1, -1):
            if self.frames[index][0] == tag:
                del self.frames[index:]
                break

    def handle_data(self, data):
        if self.skip:
            self.output.append(data)
            return
        if self.phrase:
            return
        key = data.strip()
        self.output.append(data if self.raw or not key else data.replace(key, html.escape(self.text(key), quote=False)))

    def handle_entityref(self, name):
        if not self.phrase:
            self.output.append(f'&{name};')

    def handle_charref(self, name):
        if not self.phrase:
            self.output.append(f'&#{name};')

    def handle_comment(self, data):
        if not self.phrase:
            self.output.append(f'<!--{data}-->')
