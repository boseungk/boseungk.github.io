"""Shared chrome (owner D): header and footer partials, site nav, language picker and store buttons.

Placeholders (all ``page`` phase, so authored policy pages get them too):

- ``<!--SITE_HEADER-->`` / ``<!--SITE_HEADER:minimal-->``: ``tools/templates/partials/header.ko.html``. The full
  header has the skip link, wordmark, nav, store pair and language picker; ``minimal`` (404) keeps the skip link,
  the wordmark and the App Store button.
- ``<!--SITE_FOOTER-->`` / ``<!--SITE_FOOTER:home-->``: ``partials/footer.ko.html``. ``home`` adds
  ``id="contact"`` and omits the store pair (the home's closing section shows it one screen above).
- ``<!--SITE_NAV-->`` and ``<!--LANGUAGE_PICKER-->``: used inside the header partial.
- ``<!--STORES:<variant>[ app-only][ extra classes]-->`` with variant ``bar|footer|hero|closing``:
  ``bar`` and ``footer`` show the store name with the full sentence ``'{store}에서 받기'`` as ``aria-label``;
  ``hero`` and ``closing`` show that sentence, split around ``{store}`` so the word order follows the locale
  (empty parts are dropped). Google Play has ``data-href`` and "곧 출시" while ``STORES['play_live']`` is False;
  when it is True it gets ``href`` (with ``&hl=``) and the same label as the App Store.

Partials are written in Korean and translated with the page's catalog by the same ``Translate`` as templates
(text, attributes and route localisation of ``href``). ``<!--ONLY:a,b-->…<!--/ONLY-->`` blocks are kept only for
those variants; ``<!--# …-->`` comments are authoring notes and are dropped. Their keys are reported to the
translator with the partial's file and line (``uses``).
"""
from bisect import bisect_left
import html
import re

from . import core
from .core import BuildError, KeyUse, page_locales, route

NAV = [('feedback', '기능 제안'), ('news', '새 소식')]

STORES = {'app': 'https://apps.apple.com/app/id6826182682',
          'play': 'https://play.google.com/store/apps/details?id=com.myanimalroom.app',
          'play_live': True}
STORE_NAMES = (('app', 'App Store'), ('play', 'Google Play'))
STORE_LABEL = '{store}에서 받기'
STORE_SOON = '곧 출시'
STORE_VARIANTS = ('bar', 'footer', 'hero', 'closing')
PLAY_LANG = {'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW'}

PARTIALS = {'header': ('partials/header.ko.html', ('full', 'minimal'), 'full'),
            'footer': ('partials/footer.ko.html', ('default', 'home'), 'default')}
ONLY = re.compile(r'<!--ONLY:([\w,-]+)-->(.*?)<!--/ONLY-->', re.S)
NOTE = re.compile(r'<!--#.*?-->\n?', re.S)
EN_FALLBACK = re.compile(r'<a href="(/en/[^"]*)"(?![^>]*\shreflang=)')


# --------------------------------------------------------------------------------------------
# Language picker and nav

def picker(locale, page, copy):
    esc = html.escape
    choices = []
    for item in page_locales(page):
        current = ' aria-current="page"' if item['lang'] == locale['lang'] else ''
        keywords = ' '.join([item['nativeName'], item['englishName'], item['locale'], item['lang']])
        choices.append(f'<li><a href="{route(item, page)}" lang="{item["lang"]}" hreflang="{item["lang"]}"{current} data-language-search="{esc(keywords)}"><bdi>{esc(item["nativeName"])}</bdi><span class="language-check" aria-hidden="true">✓</span></a></li>')
    short = locale['lang'].split('-')[0].upper()
    return ('<details class="language-picker"><summary aria-label="' + esc(copy['언어 선택'] + ': ' + locale['nativeName']) + '">'
            '<span class="mar-choice-label language-label"><span data-language-current>' + esc(locale['nativeName']) + '</span>'
            '<span class="language-short" aria-hidden="true">' + short + '</span></span>'
            '<svg class="language-chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 6.2C5.4 7.5 6.7 8.8 8 10.1C9.3 8.8 10.6 7.5 12 6.1"/></svg></summary>'
            '<div class="language-panel"><label class="sr-only" for="language-search">' + esc(copy['언어 찾기']) + '</label>'
            '<input id="language-search" type="search" autocomplete="off" spellcheck="false" placeholder="' + esc(copy['언어 찾기']) + '" data-language-search-input>'
            '<ul class="language-options" aria-label="' + esc(copy['언어']) + '">' + ''.join(choices) + '</ul>'
            '<p class="language-empty" data-language-empty hidden>' + esc(copy['일치하는 언어가 없어요.']) + '</p></div></details>')


def nav(ctx, arg):
    return ''.join('<a href="' + route(ctx.locale, target) + '"' + (' aria-current="page"' if target == ctx.page.name else '') + '>'
                   '<span class="mar-choice-label">' + html.escape(ctx.copy[label]) + '</span></a>' for target, label in NAV)


# --------------------------------------------------------------------------------------------
# Store buttons (one source for the bar, the footer and the home's hero and closing)

def stores(locale, copy, variant='bar', app_only=False, classes=()):
    if variant not in STORE_VARIANTS:
        raise BuildError(f'STORES: unknown variant {variant!r}; use one of {", ".join(STORE_VARIANTS)}')
    esc = html.escape
    full = variant in ('hero', 'closing')
    items = []
    for key, name in STORE_NAMES:
        if key == 'play' and app_only:
            continue
        name_html = f'<span class="store__name">{name}</span>'
        live = key == 'app' or STORES['play_live']
        if not live:
            items.append(f'<a class="store" data-href="{esc(STORES[key])}">{name_html}<span class="store__soon">{esc(copy[STORE_SOON])}</span></a>')
            continue
        url = STORES[key] + ('&hl=' + PLAY_LANG.get(locale['lang'], locale['lang']) if key == 'play' else '')
        label = copy[STORE_LABEL]
        if full:
            before, _, after = label.partition('{store}')
            inner = ''.join([f'<span class="store__go">{esc(before)}</span>' if before.strip() else '', name_html,
                             f'<span class="store__go">{esc(after)}</span>' if after.strip() else ''])
            # one flex item: separate flex items would drop the space in "Get it on " / "Download on the "
            items.append(f'<a class="store" href="{esc(url)}" rel="noopener"><span class="store__label">{inner}</span></a>')
        else:
            items.append(f'<a class="store" href="{esc(url)}" rel="noopener" aria-label="{esc(label.replace("{store}", name))}">{name_html}</a>')
    names = ' '.join(['stores', f'stores--{variant}', *classes])
    return f'<div class="{names}">' + ''.join(items) + '</div>'


def stores_placeholder(ctx, arg):
    words = (arg or 'bar').split()
    return stores(ctx.locale, ctx.copy, words[0], 'app-only' in words[1:], [word for word in words[1:] if word != 'app-only'])


# --------------------------------------------------------------------------------------------
# Partials

def select(source, variant):
    """Drop authoring notes and the ONLY blocks of other variants."""
    return ONLY.sub(lambda match: match[2] if variant in match[1].split(',') else '', NOTE.sub('', source))


def partial(ctx, name, arg):
    from .translate import Translate
    file, variants, default = PARTIALS[name]
    variant = arg or default
    if variant not in variants:
        raise BuildError(f'SITE_{name.upper()}: unknown variant {variant!r}; use one of {", ".join(variants)}')
    translator = Translate(ctx.locale, ctx.copy)
    translator.feed(select(ctx.site.template(file), variant))
    translator.close()
    text = core.expand(''.join(translator.output).strip('\n'), 'page', ctx)
    if name == 'footer' and variant == 'home':
        text = text.replace('<footer class="foot">', '<footer class="foot" id="contact">', 1)
    if ctx.locale['lang'] != 'en':
        text = EN_FALLBACK.sub(r'<a href="\1" hreflang="en"', text)   # an English-only policy from another locale
    return text


# --------------------------------------------------------------------------------------------
# Keys for the translator report: partial text with file/line, plus the keys this module looks up.

CODE_KEYS = [
    ('partial:header', '언어 선택', 'summary', 'aria-label', 'aria', 'details.language-picker > summary'),
    ('partial:header', '언어 찾기', 'label', None, 'label', 'details.language-picker > div.language-panel > label.sr-only'),
    ('partial:header', '언어 찾기', 'input', 'placeholder', 'placeholder', 'details.language-picker > div.language-panel > input#language-search'),
    ('partial:header', '언어', 'ul', 'aria-label', 'aria', 'details.language-picker > div.language-panel > ul.language-options'),
    ('partial:header', '일치하는 언어가 없어요.', 'p', None, 'body', 'details.language-picker > div.language-panel > p.language-empty'),
    ('partial:header', '기능 제안', 'a', None, 'label', 'header#bar > nav.bar__nav > a'),
    ('partial:header', '새 소식', 'a', None, 'label', 'header#bar > nav.bar__nav > a'),
    ('partial:stores', STORE_LABEL, 'a', 'aria-label', 'button', 'div.stores > a.store ({store} is "App Store" or "Google Play"; the home hero and closing show this sentence)'),
    ('partial:stores', STORE_SOON, 'span', None, 'label', 'div.stores > a.store > span.store__soon (after "Google Play")'),
]


def partial_uses(build, name):
    from .translate import Translate, Identity
    file = PARTIALS[name][0]
    source = build.site.template(file)
    records = []
    Translate(core.LOCALES[0], Identity(), records, frozenset(build.site.source())).feed(source)
    texts = sorted((record['pos'], re.sub(r'\s+', ' ', record['key']).strip()) for record in records if record['attr'] is None)
    positions = [pos for pos, _ in texts]
    result = []
    for record in records:
        index = bisect_left(positions, record['pos'])
        before = texts[index - 1][1] if index > 0 else ''
        after_index = index + 1 if record['attr'] is None else index
        after = texts[after_index][1] if after_index < len(texts) else ''
        result.append(KeyUse(record['key'], kind=record['kind'], context={
            'page': 'partial:' + name, 'file': 'tools/templates/' + file, 'line': source.count('\n', 0, record['pos']) + 1,
            'element': record['element'], 'attr': record['attr'], 'path': record['path'], 'section': None,
            'before': before[:80], 'after': after[:80]}))
    return result


def uses(build):
    source = core.REPO.joinpath('tools/sitebuild/chrome.py').read_text().splitlines()
    body = next(number for number, text in enumerate(source[1:], 2) if text.endswith('"""'))   # after the docstring
    line = lambda key: next((number for number, text in enumerate(source[body:], body + 1) if repr(key) in text), 0)
    result = [KeyUse(key, kind=kind, context={'page': page, 'file': 'tools/sitebuild/chrome.py', 'line': line(key), 'element': element,
                                              'attr': attr, 'path': path, 'section': None, 'before': '', 'after': ''})
              for page, key, element, attr, kind, path in CODE_KEYS]
    for name in PARTIALS:
        if build.site.template_exists(PARTIALS[name][0]):
            result.extend(partial_uses(build, name))
    return result


core.register('LANGUAGE_PICKER', lambda ctx, arg: picker(ctx.locale, ctx.page.name, ctx.copy))
core.register('SITE_NAV', nav)
core.register('STORES', stores_placeholder)
core.register('SITE_HEADER', lambda ctx, arg: partial(ctx, 'header', arg))
core.register('SITE_FOOTER', lambda ctx, arg: partial(ctx, 'footer', arg))
core.register_keys(uses)
