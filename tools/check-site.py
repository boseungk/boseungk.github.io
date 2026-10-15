"""Verify the static publishing boundary, both locales and copied native modules."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
from urllib.parse import urlsplit

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / 'docs'


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.lang = None

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'Duplicate id: {attrs["id"]}'
            self.ids.add(attrs['id'])
        if tag == 'html':
            self.lang = attrs.get('lang')
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
for locale, expected in [('index.html', 'ko'), ('en/index.html', 'en')]:
    file = DOCS / locale
    assert pages[file].lang == expected
    source = file.read_text()
    assert '<details class="language-picker">' in source
    assert source.count('aria-current="page"') == 1
    assert 'data-intro-jump' not in source and 'intro-begin' not in source
    assert 'id="companions"' not in source and 'id="worlds"' not in source
    assert 'data-journey-replay' not in source
    assert 'boseung@myanimalroom.com' in source
    assert 'src="/assets/v5/copy.js?' in source
    if expected == 'en':
        description = re.search(r'<p class="intro-description">(.*?)</p>', source, re.S)[1]
        collapsed = re.sub('<[^>]+>', '', description)
        assert 'side. Keep' in collapsed, 'Mobile hidden br must keep English sentence spacing'
    assert 'MutationObserver' not in (DOCS / 'assets/v5/copy.js').read_text()
for locale, expected in [('feedback/index.html', 'ko'), ('en/feedback/index.html', 'en')]:
    file = DOCS / locale
    source = file.read_text()
    assert pages[file].lang == expected
    assert source.count('aria-current="page"') == 1
    assert 'id="idea-form"' in source and 'id="idea-list"' in source
    assert '/assets/feedback/feedback.js' in source
    assert 'src="/home.js' not in source and 'src="/assets/v4/hero.js' not in source
    assert 'boseung@myanimalroom.com' in source
    assert 'href="/feedback/" lang="ko"' in source
    assert 'href="/en/feedback/" lang="en"' in source
# Export evidence checks all slots were inside the shared full-room projection.
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
print(f'PASS {len(pages)} static pages/assets/anchors, both locales, uncropped room evidence, native motion hashes and main/docs publishing boundary')
