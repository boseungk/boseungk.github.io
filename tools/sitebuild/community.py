"""Community pages (owner D): news entries shared with the feedback board, and the board's page data.

Feedback copy comes from ``<!--PAGE_COPY-->`` (copy.py) through ``docs/assets/site/text.mjs``; the old
all-language ``assets/feedback/copy.mjs`` is no longer generated.

The Korean news template is the single source. Each entry is
``<article class="news-entry" id="<kebab-id>" data-ideas="<uuid> <uuid>">`` with one ``<time datetime>`` and
one ``<h2>`` (plain text, so its text is one translation key). From it:

- ``<!--NEWS_LINKS-->`` (feedback, page phase): ``<script type="application/json" id="news-links">``
  ``{"<idea uuid>":[{"href":"/<lang>/news/#<id>","title":"<translated h2>","date":"YYYY-MM-DD"}]}`` so idea
  cards can show "관련 소식".
- ``<!--LATEST_NEWS-->`` (feedback, source phase): the newest entry as a "최근 소식" line; it is translated
  and its link localised with the page.
- ``<!--NEWS_JSONLD-->`` (news, page phase): an ``ItemList`` of ``BlogPosting`` for the entries.
- ``<!--FEEDBACK_CONFIG-->`` (feedback, page phase): ``{"turnstile":"<code>"}`` from locales.json.

Every ``data-ideas`` value must be a UUID (the API's pattern). Seed UUIDs (``5eed0000-…``, local test data)
fail the build unless the news template is an in-memory override (a local fixture build, never ``docs/``).

Authoring a news entry (``tools/templates/news.ko.html``; Korean only, newest first)::

    <article class="news-entry reveal" id="<id>" aria-labelledby="<id>-title" data-ideas="<uuid> <uuid>">
     <a class="news-date text-link" href="#<id>"><span class="mar-choice-label"><time datetime="YYYY-MM-DD" dir="ltr"><span class="news-ym">YYYY.MM</span> <span class="news-day">DD</span></time></span></a>
     <div class="news-content">
      <h2 id="<id>-title">Plain-text title</h2>
      <figure class="news-figure"><img src="/assets/art/news/<id>/<name>-1280.webp"
        srcset="/assets/art/news/<id>/<name>-1280.webp 1280w, /assets/art/news/<id>/<name>-2560.webp 2560w"
        sizes="(min-width: 900px) 640px, 100vw" width="2560" height="…" alt="…" loading="lazy" decoding="async">
        <figcaption>…</figcaption></figure>
      <p>…</p>
      <section class="news-ideas" aria-labelledby="<id>-ideas"><h3 id="<id>-ideas">함께한 제안</h3>
       <ul><li><a class="text-link" href="/feedback/?idea=<uuid>#idea-<uuid>">editorial one-line summary</a></li></ul></section>
     </div>
    </article>

- The id is kebab-case and never renamed: shared links and operator replies (``/news/#<id>``) point at it.
- ``data-ideas`` (optional) lists the production ideas the entry answers; each idea card then links here.
  The related-idea lines are editorial summaries, never the visitor's own text.
- The figure is optional; encode it with ``tools/assets/build-art.mjs`` (list ``community.json``). The first
  entry's image drops ``loading="lazy"``.
- Write only facts: no release dates, numbers or promises that are not already true.
"""
from html.parser import HTMLParser
import html
import re

from . import core
from .core import BuildError, ORIGIN, route

NEWS_TEMPLATE = 'news.ko.html'
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
ENTRY_ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,63}$')
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
SEED = '5eed0000-'


class NewsEntries(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.entries = []
        self.entry = None
        self.depth = 0
        self.title = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.entry is None:
            if tag == 'article' and 'news-entry' in (attrs.get('class') or '').split():
                self.entry = {'id': attrs.get('id') or '', 'ideas': (attrs.get('data-ideas') or '').split(), 'date': None, 'title': None}
                self.depth = 0
            return
        if tag == 'article':
            self.depth += 1
        elif tag == 'time' and self.entry['date'] is None:
            self.entry['date'] = attrs.get('datetime') or ''
        elif tag == 'h2' and self.entry['title'] is None:
            self.title = []
        elif self.title is not None:
            raise BuildError(f'{NEWS_TEMPLATE}: news entry #{self.entry["id"]}: the h2 must be plain text (found <{tag}>)')

    def handle_endtag(self, tag):
        if self.entry is None:
            return
        if tag == 'h2' and self.title is not None:
            self.entry['title'] = re.sub(r'\s+', ' ', ''.join(self.title)).strip()
            self.title = None
        elif tag == 'article':
            if self.depth:
                self.depth -= 1
            else:
                self.entries.append(self.entry)
                self.entry = None

    def handle_data(self, data):
        if self.title is not None:
            self.title.append(data)


def news_entries(site):
    """The news entries of the Korean template, newest first (document order breaks ties)."""
    parser = NewsEntries()
    parser.feed(site.template(NEWS_TEMPLATE))
    fixture = NEWS_TEMPLATE in site.templates
    seen = set()
    for entry in parser.entries:
        where = f'{NEWS_TEMPLATE}: news entry #{entry["id"] or "?"}'
        if not ENTRY_ID.match(entry['id']):
            raise BuildError(f'{where}: id must be kebab-case (a-z, 0-9, -), at most 64 characters')
        if entry['id'] in seen:
            raise BuildError(f'{where}: duplicate id')
        seen.add(entry['id'])
        if not entry['date'] or not DATE.match(entry['date']):
            raise BuildError(f'{where}: needs <time datetime="YYYY-MM-DD">')
        if not entry['title']:
            raise BuildError(f'{where}: needs an <h2> title')
        for idea in entry['ideas']:
            if not UUID.match(idea):
                raise BuildError(f'{where}: data-ideas holds {idea!r}, not a UUID')
            if idea.lower().startswith(SEED) and not fixture:
                raise BuildError(f'{where}: data-ideas holds the local seed id {idea}; publish production ids only')
    order = {entry['id']: index for index, entry in enumerate(parser.entries)}
    return sorted(parser.entries, key=lambda entry: (entry['date'], -order[entry['id']]), reverse=True)


def _entries(ctx):
    cache = ctx.build.__dict__.setdefault('_news_entries', {})
    if 'value' not in cache:
        cache['value'] = news_entries(ctx.site)
    return cache['value']


def news_links(ctx, arg):
    links = {}
    for entry in _entries(ctx):
        item = {'href': route(ctx.locale, 'news') + '#' + entry['id'], 'title': ctx.copy[entry['title']], 'date': entry['date']}
        for idea in entry['ideas']:
            links.setdefault(idea.lower(), []).append(item)
    return '<script type="application/json" id="news-links">' + core.javascript(links) + '</script>'


def latest_news(ctx, arg):
    entries = _entries(ctx)
    if not entries:
        return ''
    entry = entries[0]
    return ('<p class="feedback-latest"><span class="feedback-latest__label">최근 소식</span> '
            f'<a class="text-link" href="/news/#{entry["id"]}">{html.escape(entry["title"], quote=False)}</a></p>')


def news_jsonld(ctx, arg):
    page = ORIGIN + route(ctx.locale, 'news')
    items = [{'@type': 'ListItem', 'position': index + 1, 'item': {
        '@type': 'BlogPosting', 'headline': ctx.copy[entry['title']], 'datePublished': entry['date'],
        'url': page + '#' + entry['id'], 'inLanguage': ctx.locale['lang'],
        'author': {'@type': 'Organization', 'name': 'My Animal Room', 'url': ORIGIN + '/'}}}
        for index, entry in enumerate(_entries(ctx))]
    data = {'@context': 'https://schema.org', '@type': 'ItemList', 'url': page, 'itemListElement': items}
    return '<script type="application/ld+json">' + core.javascript(data) + '</script>'


def feedback_config(ctx, arg):
    return '<script type="application/json" id="feedback-config">' + core.javascript({'turnstile': ctx.locale.get('turnstile') or 'en'}) + '</script>'


core.register('NEWS_LINKS', news_links)
core.register('LATEST_NEWS', latest_news, phase='source')
core.register('NEWS_JSONLD', news_jsonld)
core.register('FEEDBACK_CONFIG', feedback_config)
core.register('NEWS_NOTE', lambda ctx, arg: '', phase='source')
