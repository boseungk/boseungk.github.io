"""Verify the static publishing boundary, every locale and copied native modules."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
from urllib.parse import urlsplit

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / 'docs'
LOCALES = json.loads((DOCS / 'assets/i18n/locales.json').read_text())


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.lang = None
        self.direction = None
        self.locale_links = []
        self.canonical = None

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'Duplicate id: {attrs["id"]}'
            self.ids.add(attrs['id'])
        if tag == 'html':
            self.lang = attrs.get('lang')
            self.direction = attrs.get('dir')
        if 'data-language-search' in attrs:
            self.locale_links.append(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')
        for key in ('src', 'href'):
            if attrs.get(key):
                self.links.append(attrs[key])


pages = {}
for file in DOCS.rglob('*.html'):
    parser = Page()
    parser.feed(file.read_text())
    pages[file] = parser
for file, page in pages.items():
    for url in page.links:
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc:
            continue
        target = DOCS / parsed.path.lstrip('/') if parsed.path.startswith('/') else file.parent / parsed.path
        if not parsed.path:
            target = file
        if target.is_dir():
            target /= 'index.html'
        assert target.exists(), f'{file}: missing {url}'
        if parsed.fragment and target.suffix == '.html':
            assert parsed.fragment in pages[target].ids, f'{file}: missing anchor {url}'
for file in DOCS.rglob('*.css'):
    for url in re.findall(r'url\([\'"]?([^\)\'"\s]+)', file.read_text()):
        if url.startswith('/'):
            assert (DOCS / url.lstrip('/')).exists(), f'{file}: missing CSS asset {url}'
for file in (DOCS / 'assets/v5').glob('growth*.js'):
    for imported in re.findall(r"from\s+['\"]([^'\"]+)['\"]", file.read_text()):
        assert (file.parent / imported).exists(), f'{file}: missing module {imported}'
for item in LOCALES:
    prefix = item['path'] + '/' if item['path'] else ''
    for entry in ('index.html', 'feedback/index.html'):
        page = pages[DOCS / prefix / entry]
        assert page.lang == item['lang'] and page.direction == item['direction']
        assert len(page.locale_links) == len(LOCALES), (item, entry)
        assert {link['lang'] for link in page.locale_links} == {row['lang'] for row in LOCALES}
        assert [link['lang'] for link in page.locale_links if link.get('aria-current') == 'page'] == [item['lang']]
        assert page.canonical == 'https://www.myanimalroom.com/' + prefix + entry.removesuffix('index.html')
for locale, expected in [(f'{row["path"] + "/" if row["path"] else ""}index.html', row['lang']) for row in LOCALES]:
    file = DOCS / locale
    assert pages[file].lang == expected
    source = file.read_text()
    assert '<details class="language-picker">' in source
    assert source.count('aria-current="page"') == 1
    assert 'data-intro-jump' not in source and 'intro-begin' not in source
    assert 'id="companions"' not in source and 'id="worlds"' not in source
    assert 'data-journey-replay' not in source
    assert 'contact@myanimalroom.com' in source
    assert 'src="/assets/v5/copy.js?' in source
    assert source.count('class="room-dusk"') == 9, 'Every room needs its native sunset layer'
    if expected == 'en':
        description = re.search(r'<p class="intro-description">(.*?)</p>', source, re.S)[1]
        collapsed = re.sub('<[^>]+>', '', description)
        assert 'side. Keep' in collapsed, 'Mobile hidden br must keep English sentence spacing'
    assert 'MutationObserver' not in (DOCS / 'assets/v5/copy.js').read_text()
for locale, expected in [(f'{row["path"] + "/" if row["path"] else ""}feedback/index.html', row['lang']) for row in LOCALES]:
    file = DOCS / locale
    source = file.read_text()
    assert pages[file].lang == expected
    assert source.count('aria-current="page"') == 1
    assert 'id="idea-form"' in source and 'id="idea-list"' in source
    assert '/assets/feedback/feedback.js' in source
    assert 'src="/home.js' not in source and 'src="/assets/v4/hero.js' not in source
    assert 'contact@myanimalroom.com' in source
    assert 'href="/feedback/" lang="ko"' in source
    assert 'href="/en/feedback/" lang="en"' in source
# Export evidence checks all slots were inside the shared full-room projection.
dusk = json.loads((DOCS / 'assets/v5/customize/dusk-render-evidence.json').read_text())
day = json.loads((DOCS / 'assets/v5/customize/render-evidence.json').read_text())
assert {entry['id'] for entry in dusk['rooms']} == {entry['id'] + '-dusk' for entry in day['rooms']}
assert dusk['projection'] == day['projection'], 'Time layers must use the same camera'
for file in (DOCS / 'assets/v5/customize').glob('*render-evidence.json'):
    evidence = json.loads(file.read_text())
    for entry in evidence['stages'] + evidence['rooms']:
        assert (file.parent / (entry['id'] + '.png')).exists()
        assert all(slot['uncropped'] for slot in entry['slots'].values()), entry['id']
# Native motion is copied unchanged: check against the provenance manifest hashes.
manifest = json.loads((REPO / 'architecture/native-growth-sources.json').read_text())
import hashlib
for entry in manifest:
    file = DOCS / 'assets/v5/growth-motion' / entry['file']
    assert hashlib.sha256(file.read_bytes()).hexdigest() == entry['sha256'], f'Modified native source: {file}'
assert (DOCS / '.nojekyll').exists() and (DOCS / 'CNAME').read_text().strip() == 'www.myanimalroom.com'
for removed in ['_posts', '_layouts', '_includes', '_sass', '_data', 'assets', '_config.yml', 'Gemfile', '.github/workflows/build-jekyll.yml']:
    assert not (REPO / removed).exists(), f'Obsolete blog tree remains: {removed}'
print(f'PASS {len(pages)} static pages/assets/anchors, {len(LOCALES)} locales, uncropped room evidence, native motion hashes and main/docs publishing boundary')
