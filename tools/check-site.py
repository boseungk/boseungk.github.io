"""Static checks for the generated site in docs/ (the publishing boundary, locale contracts, assets, design guards).

  python3 tools/check-site.py [--allow-draft] [--group NAME ...] [--list-groups] [--quiet]

Every check reports into a named group, so one run lists everything that is wrong instead of stopping at the
first failure. Exit status 1 when any group has a problem.

--allow-draft  skips only the deploy guard: pages carrying ``data-i18n-draft`` and Hangul outside ``[lang="ko"]``
               on non-ko pages (both are expected while translations are missing; they must be gone at release).
"""
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import os
import re
import struct
import sys
from urllib.parse import unquote, urlsplit

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[1]
DOCS = Path(os.environ.get('SITE_DOCS') or REPO / 'docs')   # SITE_DOCS: a copy of docs/ (mutation tests)
ASSETS = DOCS / 'assets'
ORIGIN = 'https://www.myanimalroom.com'
sys.path.insert(0, str(REPO / 'tools'))

LOCALES = json.loads((ASSETS / 'i18n/locales.json').read_text())
GROUPS = {}          # name -> list of messages
NOTES = []           # informational lines (skipped optional checks)
COUNTS = Counter()   # what each group looked at, for the summary


def fail(group, message):
    GROUPS.setdefault(group, []).append(message)


def seen(group, n=1):
    COUNTS[group] += n
    GROUPS.setdefault(group, GROUPS.get(group, []))


def rel(path):
    try:
        return str(Path(path).relative_to(REPO))
    except ValueError:
        return str(path)


# --------------------------------------------------------------------------------------------------------------
# HTML model

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
HANGUL = re.compile('[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]')
TEXT_ATTRS = ('alt', 'aria-label', 'title', 'placeholder')
CURRENT = 'aria-current="page"'
PLACEHOLDER = re.compile(r'<!--\s*[A-Z][A-Z0-9_]*(?::[^>]*?)?\s*-->')


class Page(HTMLParser):
    def __init__(self, file):
        super().__init__(convert_charrefs=True)
        self.file = file
        self.ids, self.dup_ids = set(), []
        self.urls = []              # (tag, attr, url) for src/href/srcset/poster/data-*-src
        self.tags = []              # (tag, attrs) for every start tag
        self.scripts = []           # (attrs, text)
        self.metas = []
        self.links = []
        self.imgs = []
        self.lang = self.dir = self.canonical = self.robots = self.draft = None
        self.locale_links = []
        self.text = []              # (text, is_ko_subtree, in_ko_lang)
        self.attr_text = []         # (attr, value, is_ko_subtree)
        self.stack = []
        self.header_bar = self.footer_foot = self.phones = 0
        self.nav_hrefs = []
        self.in_header_nav = 0
        self.header_nav_current = 0
        self._script = None
        self._buf = []
        self.title = None
        self._title = False

    @property
    def ko(self):
        return any(item[1] for item in self.stack)

    @property
    def foreign(self):
        # inside an element that names another language than the page (language picker entries)
        return any(item[2] for item in self.stack)

    def handle_startendtag(self, tag, attrs):
        self._start(tag, attrs, selfclose=True)

    def handle_starttag(self, tag, attrs):
        self._start(tag, attrs, selfclose=False)

    def _start(self, tag, pairs, selfclose):
        attrs = dict(pairs)
        self.tags.append((tag, attrs))
        if 'id' in attrs:
            if attrs['id'] in self.ids:
                self.dup_ids.append(attrs['id'])
            self.ids.add(attrs['id'])
        classes = (attrs.get('class') or '').split()
        if tag == 'html':
            self.lang, self.dir, self.draft = attrs.get('lang'), attrs.get('dir'), attrs.get('data-i18n-draft')
        if tag == 'meta':
            self.metas.append(attrs)
            if attrs.get('name') == 'robots':
                self.robots = attrs.get('content')
        if tag == 'link':
            self.links.append(attrs)
            if 'canonical' in (attrs.get('rel') or '').split():
                self.canonical = attrs.get('href')
        if tag == 'img':
            self.imgs.append(attrs)
        if 'data-language-search' in attrs:
            self.locale_links.append(attrs)
        if tag == 'header' and 'bar' in classes:
            self.header_bar += 1
        if tag == 'footer' and 'foot' in classes:
            self.footer_foot += 1
        if 'phone' in classes:
            self.phones += 1
        for key in ('src', 'href', 'poster', 'data-src', 'data-color-src', 'data-gray-src', 'data-rooms-manifest', 'data-rooms-text', 'data-rooms-css'):
            if attrs.get(key):
                self.urls.append((tag, key, attrs[key]))
        if attrs.get('srcset'):
            for part in attrs['srcset'].split(','):
                if part.strip():
                    self.urls.append((tag, 'srcset', part.strip().split()[0]))
        if tag == 'meta' and attrs.get('content') is not None and (attrs.get('name') in ('description', 'twitter:title') or str(attrs.get('property', '')).startswith('og:')):
            self.attr_text.append(('content', attrs['content'], self.ko or attrs.get('lang') == 'ko', self.foreign))
        ko = attrs.get('lang') == 'ko' or attrs.get('translate') == 'no'
        other = bool(attrs.get('lang')) and not attrs['lang'].startswith('ko') and tag != 'html'
        for key in TEXT_ATTRS:
            if attrs.get(key):
                self.attr_text.append((key, attrs[key], self.ko or ko, self.foreign or other))
        if tag in ('script', 'style'):
            self._script = (tag, attrs)
            self._buf = []
        if tag == 'title':
            self._title = True
        if selfclose or tag in VOID:
            return
        self.stack.append((tag, ko, other))

    def handle_endtag(self, tag):
        if tag == 'title':
            self._title = False
        if self._script and self._script[0] == tag:
            if tag == 'script':
                self.scripts.append((self._script[1], ''.join(self._buf)))
            self._script = None
            self._buf = []
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if self._script:
            self._buf.append(data)
            return
        if self._title:
            self.title = (self.title or '') + data
        if data.strip():
            self.text.append((data, self.ko, self.foreign))


def local_target(page_file, url):
    """Map a root-absolute or relative local URL to (file Path, fragment) or None for external URLs."""
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc or url.startswith(('mailto:', 'tel:', 'data:', 'javascript:')):
        return None
    if parsed.path.startswith('/'):
        target = DOCS / unquote(parsed.path).lstrip('/')
    elif not parsed.path:
        target = page_file
    else:
        target = page_file.parent / unquote(parsed.path)
    if target.is_dir():
        target /= 'index.html'
    return target, parsed.fragment


# --------------------------------------------------------------------------------------------------------------
# Image sizes

def image_size(path):
    data = path.read_bytes()
    suffix = path.suffix.lower()
    try:
        if suffix == '.png' and data[:8] == b'\x89PNG\r\n\x1a\n':
            return struct.unpack('>II', data[16:24])
        if suffix == '.webp' and data[:4] == b'RIFF' and data[8:12] == b'WEBP':
            kind = data[12:16]
            if kind == b'VP8 ':
                w, h = struct.unpack('<HH', data[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if kind == b'VP8L':
                bits = struct.unpack('<I', data[21:25])[0]
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            if kind == b'VP8X':
                return 1 + int.from_bytes(data[24:27], 'little'), 1 + int.from_bytes(data[27:30], 'little')
        if suffix in ('.jpg', '.jpeg') and data[:2] == b'\xff\xd8':
            i = 2
            while i < len(data):
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                    h, w = struct.unpack('>HH', data[i + 5:i + 9])
                    return w, h
                i += 2 + struct.unpack('>H', data[i + 2:i + 4])[0]
        if suffix == '.svg':
            text = data.decode('utf8', 'replace')
            box = re.search(r'viewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)', text)
            if box:
                return float(box[1]), float(box[2])
    except (struct.error, IndexError):
        return None
    return None


# --------------------------------------------------------------------------------------------------------------
# CSS (live files only): banned styles and token-only colours

def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def css_rules(css):
    """Yield (selector, body) for every style rule, descending into @media/@supports/@layer; skips @font-face,
    @keyframes bodies are yielded with their step selectors."""
    css = strip_comments(css)
    i, n = 0, len(css)
    out = []

    def block(start):
        depth, j = 1, start
        while j < n and depth:
            if css[j] == '{':
                depth += 1
            elif css[j] == '}':
                depth -= 1
            j += 1
        return j

    def walk(text):
        k, m = 0, len(text)
        while k < m:
            brace = text.find('{', k)
            if brace < 0:
                break
            head = text[k:brace].strip()
            depth, j = 1, brace + 1
            while j < m and depth:
                depth += (text[j] == '{') - (text[j] == '}')
                j += 1
            body = text[brace + 1:j - 1]
            if head.startswith('@'):
                if re.match(r'@(media|supports|layer|container|document)', head):
                    walk(body)
                elif head.startswith('@keyframes') or head.startswith('@-webkit-keyframes'):
                    walk(body)
                # @font-face / @page / @import: nothing to check
            else:
                out.append((head, body))
            k = j
    walk(css)
    return out


def declarations(body):
    for part in re.split(r';(?![^()]*\))', body):
        if ':' in part:
            name, value = part.split(':', 1)
            yield name.strip().lower(), value.strip()


def norm_hex(token):
    token = token.lstrip('#').upper()
    if len(token) in (3, 4):
        token = ''.join(c * 2 for c in token)
    return '#' + token[:6]


HEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b')
# Colours that are not site tokens but are allowed by design (PORT-PLAN Appendix B).
EXTRA_COLOURS = {'#F7EFE3', '#27314D', '#F8EFDF', '#8A3D35', '#9D9491', '#000000', '#FFFFFF'}
# Literal colour gradients and material colours that C owns (hourglass sand, opal, acquisition glow strip, theme
# palettes); keyed by file name and a selector substring, so a new literal elsewhere still fails.
HEX_ALLOW = {
    # C's literal colours: the hourglass palette picker (four swatch colours), the opal conic gradient of the theme
    # unlock and the acquisition tile wash. They are art colours, not UI tokens.
    'home.css': ('.fslider', '.opal::before', '.acq-tile'),
}


def live_css_files(pages):
    seen_files, queue = [], []
    for page in pages.values():
        for link in page.links:
            if 'stylesheet' in (link.get('rel') or '').split() and link.get('href'):
                target = local_target(page.file, link['href'])
                if target and target[0].exists():
                    queue.append(target[0])
    while queue:
        file = queue.pop()
        if file in seen_files:
            continue
        seen_files.append(file)
        for imported in re.findall(r'@import\s+(?:url\()?[\'"]?([^\'")\s;]+)', file.read_text()):
            target = local_target(file, imported)
            if target and target[0].exists():
                queue.append(target[0])
    return sorted(seen_files)


def check_css(pages):
    files = live_css_files(pages)
    seen('banned-css', len(files))
    token_hex, defs = set(EXTRA_COLOURS), {}
    parsed = {}
    for file in files:
        rules = css_rules(file.read_text())
        parsed[file] = rules
        for selector, body in rules:
            if re.search(r'(^|,)\s*:root\b', selector):
                for name, value in declarations(body):
                    if name.startswith('--'):
                        for token in HEX.findall(value):
                            token_hex.add(norm_hex(token))
                            defs.setdefault(norm_hex(token), file.name)
    for file, rules in parsed.items():
        for selector, body in rules:
            in_phone = '.phone' in selector
            island = '.phone__island' in selector
            for name, value in declarations(body):
                where = f'{file.name} {selector[:60]!r}'
                if name in ('box-shadow', 'text-shadow') and value not in ('none', 'unset', 'initial') and not in_phone:
                    fail('banned-css', f'{where}: {name}: {value[:50]}')
                if name == 'filter' or name == 'backdrop-filter':
                    if re.search(r'blur\(|drop-shadow\(', value) and not in_phone:
                        fail('banned-css', f'{where}: {name}: {value[:50]}')
                if name == 'backdrop-filter' and value not in ('none', 'unset', 'initial'):
                    fail('banned-css', f'{where}: backdrop-filter: {value[:40]}')
                if name == 'font-weight' and re.fullmatch(r'(bold|bolder|[5-9]\d\d)', value):
                    fail('banned-css', f'{where}: font-weight: {value}')
                if name == 'font' and re.search(r'\b(bold|[5-9]00)\b', value):
                    fail('banned-css', f'{where}: font: {value[:40]}')
                if name == 'border-radius' and not island and re.search(r'(?<![\d.])(9{3,}|[1-9]\d{3,})(px|rem|em)?\b', value):
                    fail('banned-css', f'{where}: border-radius: {value}')
                if name == 'animation' or name == 'animation-name':
                    if re.search(r'confetti|glow|shimmer|pulse-ring', value):
                        fail('banned-css', f'{where}: {name}: {value[:40]}')
            if re.search(r'(^|,)\s*:root\b', selector):
                continue
            allow = HEX_ALLOW.get(file.name, ())
            for name, value in declarations(body):
                for token in HEX.findall(value):
                    seen('token-hex')
                    hexv = norm_hex(token)
                    if hexv in token_hex or (hexv == '#000000' and island):
                        continue
                    if any(part in selector for part in allow):
                        continue
                    fail('token-hex', f'{file.name} {selector[:60]!r}: {token} is not a token colour ({name})')
        # strings the rule walker cannot attribute (custom-property values outside :root are covered above)


def check_inline_style_hex(pages):
    for key, page in pages.items():
        for attrs, tag in ((attrs, tag) for tag, attrs in page.tags):
            if attrs.get('style') and HEX.search(attrs['style']):
                fail('token-hex', f'{rel(page.file)}: <{tag}> inline style carries a hex colour: {attrs["style"][:60]}')


# --------------------------------------------------------------------------------------------------------------
# Main checks

def load_pages():
    pages = {}
    for file in sorted(DOCS.rglob('*.html')):
        parser = Page(file)
        parser.feed(file.read_text())
        parser.close()
        pages[file] = parser
    return pages


def page_key(item, entry):
    prefix = item['path'] + '/' if item['path'] else ''
    return DOCS / prefix / entry


def policy_routes(page):
    routes = [('ko', 'ko/'), ('en', 'en/')]
    if page == 'app-privacy':
        routes += [('ja', 'ja/'), ('zh-Hant', 'zh-hant/')]
    return routes


def check_boundary(pages):
    seen('boundary')
    if not (DOCS / '.nojekyll').exists():
        fail('boundary', 'docs/.nojekyll is missing')
    if not (DOCS / 'CNAME').exists() or (DOCS / 'CNAME').read_text().strip() != 'www.myanimalroom.com':
        fail('boundary', 'docs/CNAME must be www.myanimalroom.com')
    for removed in ['_posts', '_layouts', '_includes', '_sass', '_data', 'assets', '_config.yml', 'Gemfile', '.github/workflows/build-jekyll.yml']:
        if (REPO / removed).exists():
            fail('boundary', f'obsolete blog tree remains: {removed}')
    for glb in DOCS.rglob('*.glb'):
        fail('boundary', f'3D model shipped: {rel(glb)}')
    # No URL into the retired /app/ and /site/ trees, and no sample source (samples/) reference in shipped files.
    # "apps.apple.com/app/id…" and "/assets/site/…" are not those trees: a path must start at the site root.
    root_path = re.compile(r'(?<![\w.\-/:])/(?:app|site)/[\w.\-]')
    for file in sorted(DOCS.rglob('*')):
        if not file.is_file() or file.suffix.lower() not in ('.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt'):
            continue
        text = file.read_text(errors='replace')
        seen('boundary')
        if root_path.search(text):
            fail('boundary', f'{rel(file)}: URL under /app/ or /site/ ({root_path.search(text)[0]})')
        match = re.search(r'(?<![\w])samples/[\w.\-]+', text)
        if match and 'ASSET-SOURCES' not in file.name:
            fail('boundary', f'{rel(file)}: reference to {match[0]}')


def check_stamps_and_maps():
    spec = importlib.util.spec_from_file_location('check_build', REPO / 'tools/check-build.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules['check_build'] = module
    spec.loader.exec_module(module)
    problems, stats = module.stamp_problems(DOCS)
    seen('stamps', stats['checked'])
    for problem in problems:
        fail('stamps', problem)
    # No ?v= written by hand anywhere in sources or module specifiers.
    sources = [*(REPO / 'tools/templates').rglob('*.html'), *ASSETS.rglob('*.css'), *ASSETS.rglob('*.js'), *ASSETS.rglob('*.mjs')]
    for file in sources:
        seen('stamps')
        if re.search(r'\?v=[\w]', file.read_text(errors='replace')):
            fail('stamps', f'{rel(file)}: hand-written ?v= in a source file')


def load_locks():
    locks = {}
    for name in ('room', 'art', 'font'):
        path = REPO / f'architecture/{name}-asset-sources.json'
        if not path.exists():
            fail('locks', f'{rel(path)} is missing')
            continue
        locks[name] = json.loads(path.read_text())
    return locks


def check_locks(locks):
    listed = {}
    for name, lock in locks.items():
        for entry in lock['outputs']:
            seen('locks')
            file = ASSETS / entry['file']
            listed[entry['file']] = entry
            if not file.exists():
                fail('locks', f'{name} lock lists a missing file: assets/{entry["file"]}')
                continue
            data = file.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            if digest != entry['sha256']:
                fail('locks', f'{name} lock: assets/{entry["file"]} sha256 differs from the lock (regenerate)')
            if f'.{digest[:10]}.' not in file.name:
                fail('locks', f'{name} lock: assets/{entry["file"]} does not carry sha256[:10]')
            if len(data) != entry['bytes']:
                fail('locks', f'{name} lock: assets/{entry["file"]} byte size differs from the lock')
    # Files in lock-governed trees that no lock lists (a stray output of an older generator).
    for tree in ('rooms', 'art', 'fonts'):
        for file in sorted((ASSETS / tree).rglob('*')):
            if file.is_file() and file.suffix not in ('.txt', '.md') and str(file.relative_to(ASSETS)) not in listed:
                fail('locks', f'assets/{file.relative_to(ASSETS)} is in a locked tree but in no lock')
    return listed


def check_rooms(locks, listed):
    manifests = sorted((ASSETS / 'rooms').glob('manifest.*.json'))
    seen('rooms')
    if len(manifests) != 1:
        fail('rooms', f'expected one hashed room manifest, found {len(manifests)}')
        return
    manifest = json.loads(manifests[0].read_text())
    rooms = manifest['rooms']
    if manifest.get('version') != 2:
        fail('rooms', f'manifest version {manifest.get("version")}, expected 2')
    if sorted(manifest['order']) != sorted(rooms):
        fail('rooms', 'manifest.order and manifest.rooms list different ids')
    base = manifests[0].parent
    for rid, room in rooms.items():
        seen('rooms')
        files = [room.get('thumb'), room.get('day'), *room.get('tod', {}).values(), *(layer['src'] for layer in room.get('layers', [])), *(item['thumb'] for item in room.get('items', []))]
        for field in ('thumb', 'day'):
            if not room.get(field):
                fail('rooms', f'{rid}: no {field}')
        if sorted(room.get('tod', {})) != ['dusk', 'lit', 'night']:
            fail('rooms', f'{rid}: tod has {sorted(room.get("tod", {}))}, expected dusk, lit, night')
        if not room.get('layers'):
            fail('rooms', f'{rid}: no layers')
        if not room.get('items'):
            fail('rooms', f'{rid}: no items')
        for file in files:
            if not file:
                continue
            path = (base / file).resolve()
            if not path.is_file():
                fail('rooms', f'{rid}: manifest references a missing file {file}')
            elif str(path.relative_to(ASSETS)) not in listed:
                fail('rooms', f'{rid}: {file} is not in the room lock')
    if len(rooms) != 101:
        fail('rooms', f'{len(rooms)} rooms in the manifest, expected 101')


def check_images(pages, listed):
    for file, page in pages.items():
        for attrs in page.imgs:
            seen('images')
            src = attrs.get('src', '')
            where = f'{rel(file)}: <img src="{src[:70]}">'
            if not attrs.get('width') or not attrs.get('height'):
                fail('images', f'{where} has no width and height')
                continue
            target = local_target(file, src)
            if not target or not target[0].is_file():
                continue
            entry = listed.get(str(target[0].relative_to(ASSETS))) if ASSETS in target[0].parents else None
            size = (entry['w'], entry['h']) if entry and entry.get('w') else image_size(target[0])
            if not size:
                continue
            try:
                w, h = float(attrs['width']), float(attrs['height'])
            except ValueError:
                fail('images', f'{where} has non-numeric width/height')
                continue
            if abs(w / h - size[0] / size[1]) / (size[0] / size[1]) > 0.01:
                fail('images', f'{where} {int(w)}x{int(h)} does not match the file {size[0]}x{size[1]} (>1% off)')


def check_links(pages):
    for file, page in pages.items():
        seen('links')
        if page.dup_ids:
            fail('ids', f'{rel(file)}: duplicate ids {sorted(set(page.dup_ids))}')
        for tag, key, url in page.urls:
            target = local_target(file, url)
            if not target:
                continue
            path, fragment = target
            seen('links')
            if not path.exists():
                fail('links', f'{rel(file)}: missing {url}')
            elif fragment and path.suffix == '.html':
                if path not in pages:
                    continue
                if fragment not in pages[path].ids:
                    fail('links', f'{rel(file)}: missing anchor {url}')
    for file in DOCS.rglob('*.css'):
        for url in re.findall(r'url\([\'"]?([^\)\'"\s]+)', file.read_text()):
            if url.startswith(('data:', '#')) or re.match(r'\w+:', url):
                continue
            target = local_target(file, url)
            if target and not target[0].exists():
                fail('links', f'{rel(file)}: missing CSS asset {url}')
    # Module specifiers (static and dynamic) that point at a file.
    spec = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]""")
    for file in [*ASSETS.rglob('*.js'), *ASSETS.rglob('*.mjs')]:
        if 'vendor' in file.parts:
            continue
        for imported in spec.findall(file.read_text(errors='replace')):
            if imported.startswith(('.', '/')):
                seen('links')
                target = local_target(file, imported)
                if target and not target[0].exists():
                    fail('links', f'{rel(file)}: missing module {imported}')


def check_orphans(pages, listed):
    """Reachability from the generated pages: every file under docs/assets (and loose root files) must be reached by
    a page, by a reached stylesheet/script, by a lock, or be allowlisted."""
    allow_dirs = ('assets/i18n/',)           # build inputs and the generated runtime text
    allow_names = {'ASSET-SOURCES.md', 'app-icon-source.json'}
    allow_root = {'CNAME', '.nojekyll', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'apple-touch-icon.png', 'sw.js'}
    files = {p for p in DOCS.rglob('*') if p.is_file()}
    reached = set()
    queue = []
    token = re.compile(r"""(?<![\w])(/assets/[\w.\-@/%]+)""")
    rel_string = re.compile(r"""['"`]((?:\.{1,2}/)[^'"`\s?#]+\.[a-z0-9]{2,5})""")

    def reach(path):
        if path in files and path not in reached:
            reached.add(path)
            queue.append(path)

    for file, page in pages.items():
        reached.add(file)
        for tag, key, url in page.urls:
            target = local_target(file, url)
            if target:
                reach(target[0])
        text = file.read_text().replace(ORIGIN, '')
        for url in token.findall(text):
            reach(DOCS / url.lstrip('/'))
        for attrs, body in page.scripts:
            for url in token.findall(body):
                reach(DOCS / url.lstrip('/'))
    for entry in listed:
        reach(ASSETS / entry)
    worker = DOCS / 'sw.js'   # names its keep list; the list is not followed (it only repeats URLs of pages and locks)
    if worker.is_file():
        for url in token.findall(worker.read_text()):
            if (DOCS / url.lstrip('/')) in files:
                reached.add(DOCS / url.lstrip('/'))
    while queue:
        file = queue.pop()
        if file.suffix not in ('.css', '.js', '.mjs', '.json', '.svg', '.html'):
            continue
        text = file.read_text(errors='replace')
        if file.suffix == '.css':
            urls = re.findall(r'url\([\'"]?([^\)\'"\s]+)', text) + re.findall(r'@import\s+[\'"]([^\'"]+)', text)
            for url in urls:
                target = local_target(file, url)
                if target:
                    reach(target[0])
        for url in token.findall(text):
            reach(DOCS / url.lstrip('/').split('?')[0])
        for url in rel_string.findall(text):
            target = local_target(file, url.split('?')[0])
            if target:
                reach(target[0])
        for imported in re.findall(r"""(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]""", text):
            if imported.startswith(('.', '/')):
                target = local_target(file, imported.split('?')[0])
                if target:
                    reach(target[0])
    for file in sorted(files):
        seen('orphans')
        key = file.relative_to(DOCS).as_posix()
        if file in reached or file.name in allow_names or key in allow_root or key.startswith(allow_dirs):
            continue
        if file.suffix in ('.md', '.txt') and ('OFL' in file.name or 'LICENSE' in file.name):
            continue
        if file.suffix == '.html' and file in pages:
            continue
        fail('orphans', f'{key} is not referenced by any page, stylesheet, script or lock')


def parse_json_script(page, ident):
    for attrs, body in page.scripts:
        if attrs.get('id') == ident:
            return body
    return None


def store_expectations():
    from sitebuild.chrome import STORES
    return STORES


def check_locale_contracts(pages):
    stores = store_expectations()
    for item in LOCALES:
        prefix = item['path'] + '/' if item['path'] else ''
        for name in ('home', 'feedback', 'news'):
            entry = {'home': 'index.html', 'feedback': 'feedback/index.html', 'news': 'news/index.html'}[name]
            file = DOCS / prefix / entry
            seen('locales')
            if file not in pages:
                fail('locales', f'{rel(file)} was not generated')
                continue
            page = pages[file]
            tag = f'{rel(file)}'
            if page.lang != item['lang'] or page.dir != item['direction']:
                fail('locales', f'{tag}: lang/dir {page.lang}/{page.dir}, expected {item["lang"]}/{item["direction"]}')
            if len(page.locale_links) != len(LOCALES) or {l.get('lang') for l in page.locale_links} != {row['lang'] for row in LOCALES}:
                fail('locales', f'{tag}: language picker lists {len(page.locale_links)} of {len(LOCALES)} languages')
            current = [l['lang'] for l in page.locale_links if l.get('aria-current') == 'page']
            if current != [item['lang']]:
                fail('locales', f'{tag}: language picker aria-current is {current}')
            want = ORIGIN + '/' + prefix + entry.removesuffix('index.html')
            if page.canonical != want:
                fail('locales', f'{tag}: canonical {page.canonical}, expected {want}')
            source = file.read_text()
            if 'contact@myanimalroom.com' not in source:
                fail('locales', f'{tag}: contact address missing')
            header = re.search(r'<header.*?</header>', source, re.S)
            nav = re.search(r'<nav[^>]*>(.*?)</nav>', header[0], re.S) if header else None
            hrefs = re.findall(r'href="([^"]+)"', nav[1]) if nav else None
            route = '/' + prefix
            if hrefs != [route + 'feedback/', route + 'news/']:
                fail('locales', f'{tag}: header nav is {hrefs}')
            if nav and nav[1].count('aria-current="page"') != (name != 'home'):
                fail('locales', f'{tag}: header nav aria-current count {nav[1].count("aria-current")}')
            if source.count(CURRENT) != (1 if name == 'home' else 2):
                fail('locales', f'{tag}: {source.count(CURRENT)} aria-current="page" in the page')
            if name == 'feedback':
                for needed in ('id="new-idea"', 'id="idea-form"', 'id="idea-list"', 'id="ideas"', '/assets/feedback/feedback.js'):
                    if needed not in source:
                        fail('locales', f'{tag}: feedback markup lost {needed}')
                koopt = 'href="/ko/feedback/" lang="ko"'
                if koopt not in source or 'href="/en/feedback/" lang="en"' not in source:
                    fail('locales', f'{tag}: language picker lost the ko/en feedback links')
            if name == 'news':
                for needed in ('id="feedback-board"',):
                    if needed not in source:
                        fail('locales', f'{tag}: news markup lost {needed}')
                if '/assets/feedback/feedback.js' in source or '/assets/feedback/client.mjs' in source:
                    fail('locales', f'{tag}: news loads the feedback API script')
    for page_name in ('privacy', 'app-privacy'):
        for lang, prefix in policy_routes(page_name):
            file = DOCS / prefix / page_name / 'index.html'
            seen('locales')
            if file not in pages:
                fail('locales', f'{rel(file)} was not generated')
        for item in LOCALES:
            if item['lang'] not in [lang for lang, _ in policy_routes(page_name)] and (DOCS / (item['path'] + '/' if item['path'] else '') / page_name).exists():
                fail('locales', f'{page_name} exists for {item["lang"]}, which has no authored policy')


def check_structure(pages):
    stores = store_expectations()
    app_store = stores['app']
    for file, page in pages.items():
        key = file.relative_to(DOCS).as_posix()
        source = file.read_text()
        seen('structure')
        is_404 = key == '404.html'
        is_home = key == 'index.html' or re.fullmatch(r'[\w-]+/index\.html', key) and key.split('/')[0] in {l['path'] for l in LOCALES}
        if page.header_bar != 1:
            fail('structure', f'{key}: {page.header_bar} header.bar elements, expected 1')
        if is_404:
            if page.footer_foot:
                fail('structure', f'{key}: the 404 page has a footer')
            if 'noindex' not in (page.robots or ''):
                fail('structure', f'{key}: the 404 page must be noindex')
            if page.canonical:
                fail('structure', f'{key}: the 404 page must not have a canonical link')
        elif page.footer_foot != 1:
            fail('structure', f'{key}: {page.footer_foot} footer.foot elements, expected 1')
        if PLACEHOLDER.search(source):
            fail('structure', f'{key}: placeholder survives: {PLACEHOLDER.search(source)[0][:60]}')
        if page.phones > 2:
            fail('structure', f'{key}: {page.phones} .phone elements (at most 2 on any page)')
        if is_home:
            if page.phones != 1:
                fail('home', f'{key}: {page.phones} .phone elements, expected exactly 1')
        elif page.phones:
            fail('structure', f'{key}: {page.phones} .phone element(s) outside the home')
        modules = [attrs for attrs, _ in page.scripts if attrs.get('type') == 'module' and attrs.get('src')]
        maps = [body for attrs, body in page.scripts if attrs.get('type') == 'importmap']
        if modules and len(maps) != 1:
            fail('structure', f'{key}: {len(maps)} import maps with {len(modules)} module scripts')
        for body in maps:
            try:
                imports = json.loads(body)['imports']
            except (ValueError, KeyError):
                fail('structure', f'{key}: import map does not parse')
                continue
            for path in imports:
                if not (DOCS / path.lstrip('/')).is_file():
                    fail('structure', f'{key}: import map entry {path} does not exist')
        for ident in ('page-copy', 'news-links', 'feedback-config'):
            body = parse_json_script(page, ident)
            if body is not None:
                try:
                    data = json.loads(body)
                except ValueError as error:
                    fail('structure', f'{key}: #{ident} is not valid JSON ({error})')
                    continue
                if ident == 'page-copy' and not (isinstance(data.get('copy'), dict) and isinstance(data.get('meta'), dict)):
                    fail('structure', f'{key}: #page-copy lacks copy/meta')
        for tag, attrs in page.tags:
            if 'data-ideas' in attrs:
                for uuid in filter(None, re.split(r'[\s,]+', attrs['data-ideas'])):
                    if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', uuid):
                        fail('structure', f'{key}: data-ideas holds a malformed id {uuid!r}')
        for legacy in ('data-intro-jump', 'intro-begin', 'id="companions"', 'id="worlds"', 'data-journey-replay', 'class="room-dusk"', '/home.js', '/assets/v3/', '/assets/v4/', '/assets/v5/', '/assets/vendor/', '/assets/device/', 'LINESeedKR-Regular.otf', '/assets/themes/', '/assets/native/'):
            if legacy in source:
                fail('structure', f'{key}: legacy marker {legacy}')
        if re.search(r'\bthree(?:\.min)?\.js|GLTFLoader|\.glb\b', source):
            fail('structure', f'{key}: 3D runtime or model reference')
        if is_home:
            seen('home')
            apple = [a for t, a in page.tags if t == 'a' and a.get('href', '').startswith(app_store)]
            if len(apple) != 3:
                fail('home', f'{key}: {len(apple)} App Store links, expected 3 (bar, hero, closing)')
            play = [a for t, a in page.tags if t == 'a' and 'play.google.com' in (a.get('href', '') + a.get('data-href', ''))]
            if not stores['play_live']:
                if any(a.get('href') for a in play):
                    fail('home', f'{key}: Google Play carries href while play_live is false')
                if len(play) != 3:
                    fail('home', f'{key}: {len(play)} Google Play items, expected 3 with data-href')
                if any(not a.get('data-href') for a in play):
                    fail('home', f'{key}: a Google Play item lacks data-href')
            host = re.search(r'<[^>]*id="rooms-host"[^>]*>.*?</(?:div|section)>', source, re.S)
            still = re.search(r'<ol class="rooms-still"[^>]*>(.*?)</ol>', source, re.S)
            if not host or not still or len(re.findall(r'<li\b', still[1])) != 12:
                fail('home', f'{key}: #rooms-host needs ol.rooms-still with 12 items (found {len(re.findall("<li", still[1])) if still else None})')
            if 'id="contact"' not in source or not re.search(r'<footer[^>]*id="contact"', source):
                fail('home', f'{key}: footer#contact is missing')
            for ident in ('hero', 'focus', 'decor', 'collection', 'records', 'night', 'get', 'rooms-host', 'motion-toggle', 'hero-phone'):
                if ident not in page.ids:
                    fail('home', f'{key}: #{ident} is missing')
            if not page.title:
                fail('home', f'{key}: no <title>')


def check_seo(pages):
    claims = re.compile(r'개발 중|개발중|출시 전|출시전|Not yet released|in development|under development|coming soon', re.I)
    for file, page in pages.items():
        key = file.relative_to(DOCS).as_posix()
        seen('seo')
        is_404 = key == '404.html'
        og = {m.get('property'): m.get('content') for m in page.metas if m.get('property')}
        if not is_404:
            image = og.get('og:image')
            if not image or not image.startswith(ORIGIN + '/assets/'):
                fail('seo', f'{key}: og:image is missing or not absolute ({image})')
            elif not (DOCS / image[len(ORIGIN) + 1:]).is_file():
                fail('seo', f'{key}: og:image file does not exist ({image})')
            if not any(m.get('name') == 'twitter:card' for m in page.metas):
                fail('seo', f'{key}: twitter:card is missing')
            for field in ('og:title', 'og:description', 'og:url'):
                if not og.get(field):
                    fail('seo', f'{key}: {field} is missing')
            if not any(m.get('name') == 'description' and m.get('content') for m in page.metas):
                fail('seo', f'{key}: meta description is missing')
        elif any(p.startswith('og:') for p in og):
            fail('seo', f'{key}: the 404 page must not carry Open Graph tags')
        # Release-status claims in the title, descriptions and structured data (the app is released).
        fields = [page.title or ''] + [m.get('content', '') for m in page.metas if m.get('name') == 'description' or str(m.get('property', '')).startswith('og:')]
        for attrs, body in page.scripts:
            if attrs.get('type') == 'application/ld+json':
                try:
                    ld = json.loads(body)
                except ValueError as error:
                    fail('seo', f'{key}: JSON-LD does not parse ({error})')
                    continue
                fields.append(json.dumps(ld, ensure_ascii=False))
                seen('seo')
                for node in ld.get('@graph', [ld]):
                    for url_key in ('url', 'logo', 'installUrl'):
                        value = node.get(url_key)
                        if isinstance(value, str) and not value.startswith('https://'):
                            fail('seo', f'{key}: JSON-LD {node.get("@type")}.{url_key} is not absolute')
        for value in fields:
            if claims.search(value):
                fail('seo', f'{key}: release-status claim "{claims.search(value)[0]}" in the title/description/structured data')
    # Sitemap and robots.
    sitemap = (DOCS / 'sitemap.xml').read_text()
    locs = re.findall(r'<loc>([^<]+)</loc>', sitemap)
    seen('seo', len(locs))
    if len(locs) != len(set(locs)):
        fail('seo', 'sitemap.xml lists a URL twice')
    expected = []
    for file in pages:
        key = file.relative_to(DOCS).as_posix()
        aliases = {'index.html': '/en/', **{name + '/index.html': '/ko/' + name + '/'
                   for name in ('feedback', 'news', 'privacy', 'app-privacy')}}
        if key in aliases:
            if pages[file].canonical != ORIGIN + aliases[key]:
                fail('seo', f'{key}: compatibility alias must canonicalize to {aliases[key]}')
        elif key != '404.html':
            expected.append(ORIGIN + '/' + key.removesuffix('index.html'))
    if sorted(locs) != sorted(expected):
        fail('seo', f'sitemap.xml lists {len(locs)} URLs, pages are {len(expected)} (differences: {sorted(set(locs) ^ set(expected))[:4]})')
    for lastmod in re.findall(r'<lastmod>([^<]+)</lastmod>', sitemap):
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', lastmod):
            fail('seo', f'sitemap.xml lastmod {lastmod!r} is not YYYY-MM-DD')
    if 'Sitemap: ' + ORIGIN + '/sitemap.xml' not in (DOCS / 'robots.txt').read_text():
        fail('seo', 'robots.txt does not point at the sitemap')
    for needed in ('favicon.ico', 'apple-touch-icon.png'):
        if not (DOCS / needed).is_file():
            fail('seo', f'docs/{needed} is missing')


def check_glyphs(locks, pages):
    """Every character a page shows in its own language (text, alt/aria text, inline page copy, and the room text it
    loads) must be in the faces that page declares (extras F2: the app's font for the language). On ko pages a
    syllable outside latin+ext+ko means the ko face is out of date (the rare face would load); on other pages a
    character outside the language's faces would fall back to a system font mid-word. Fix: run
    tools/assets/build-fonts.mjs (Han faces and preloads follow the copy)."""
    font = locks.get('font')
    if not font:
        return
    runs = font['extra']['codepoints']
    def listed(value, lang):
        return value == 'all' or value == lang or (isinstance(value, list) and lang in value)
    coverage = {}
    def covered(lang):
        if lang not in coverage:
            points = set()
            for face in font['extra']['faces']:
                if face['id'] == 'rare' or ('langs' in face and not listed(face['langs'], lang)):
                    continue
                for lo, hi in runs.get(face['id'], []):
                    points.update(range(lo, hi + 1))
            coverage[lang] = points
        return coverage[lang]
    ignore = {0x0A, 0x0D, 0x09, 0xA0, 0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFE0F, 0x2713}  # 0x2713: the picker's aria-hidden check mark
    def outside(ch, lang):
        c = ord(ch)
        return (c not in covered(lang) and c not in ignore and not ch.isspace() and not (0x1D000 <= c < 0x1FFFF)
                and not (0xE000 <= c <= 0xF8FF))
    missing = set()
    for file, page in pages.items():
        if file.name == '404.html':
            continue    # one page for every language: its strings are the catalogs' (checked on their own pages)
        seen('glyphs')
        chars = Counter()
        # text in another language's element is not the page's (picker autonyms; on other pages, a name tagged lang="ko")
        own = (lambda ko, foreign: not foreign) if page.lang == 'ko' else (lambda ko, foreign: not foreign and not ko)
        for text, ko, foreign in page.text:
            if own(ko, foreign):
                chars.update(text)
        for attr, value, ko, foreign in page.attr_text:
            if own(ko, foreign):
                chars.update(value)
        for attrs, body in page.scripts:
            if attrs.get('id') == 'page-copy':
                try:
                    copy = json.loads(body)['copy']
                except (ValueError, KeyError):
                    continue
                for value in copy.values():
                    chars.update(value)
        for ch in chars:
            if outside(ch, page.lang):
                missing.add((ch, page.lang, file.relative_to(DOCS).as_posix()))
    for rooms in sorted((ASSETS / 'i18n/runtime').glob('rooms.*.json')):
        lang = rooms.name[len('rooms.'):-len('.json')]
        seen('glyphs')
        for value in json.loads(rooms.read_text()).values():
            for ch in value:
                if outside(ch, lang):
                    missing.add((ch, lang, f'assets/i18n/runtime/{rooms.name}'))
    by_char = defaultdict(set)
    for ch, lang, where in missing:
        by_char[(lang, ch)].add(where)
    for lang, ch in sorted(by_char):
        where = sorted(by_char[(lang, ch)])
        need = 'rare face needed' if lang == 'ko' else 'system font fallback'
        fail('glyphs', f'{lang}: U+{ord(ch):04X} {ch!r} is outside the faces this page declares ({need}) in {", ".join(where[:3])}'
                      f'{" and more" if len(where) > 3 else ""}; run tools/assets/build-fonts.mjs')

# --------------------------------------------------------------------------------------------------------------
# Service worker and keep list (PORT-PLAN §2.4)

SW_HASHED = re.compile(r'\.([0-9a-f]{10})\.(?:webp|png|jpg|svg|otf|ttf|woff2|json)$')    # the worker's own two patterns
SW_VERSIONED = re.compile(r'[?&]v=([0-9a-f]{10})$')
SW_REGISTER = "n.register('/sw.js',{scope:'/',updateViaCache:'none'})"
LOCAL_URL = re.compile(r"""(?<![\w:/.])(/[\w.\-@%/]+(?:\?[^"'\s)<>#,]*)?)""")


def sw_eligible(url):
    parts = urlsplit(url)
    return bool(SW_HASHED.search(parts.path) or SW_VERSIONED.search('?' + parts.query if parts.query else ''))


def check_service_worker(pages, locks, listed):
    """``service-worker``: docs/sw.js is the generated worker, names the one keep list and keeps its safety rules;
    every generated page carries the registration snippet once, in <head>.
    ``keep-list``: the list is sorted, unique, named after its hash, lists only cacheable URLs whose bytes match
    their hash, and covers every cacheable URL in the pages, the room manifest and the room/font locks."""
    import html as htmllib
    worker = DOCS / 'sw.js'
    keeps = sorted(ASSETS.glob('cache-keep.*.json'))
    seen('service-worker')
    seen('keep-list')
    if not worker.exists():
        fail('service-worker', 'docs/sw.js is missing (run a full build)')
        return
    source = worker.read_text()
    template = (REPO / 'tools/templates/sw.js').read_text()
    if len(keeps) != 1:
        fail('keep-list', f'expected one assets/cache-keep.<h>.json, found {len(keeps)}')
    keep_url = '/assets/' + keeps[0].name if len(keeps) == 1 else None
    if '__KEEP_URL__' in template:
        if keep_url and source != template.replace('__KEEP_URL__', keep_url):
            fail('service-worker', f'docs/sw.js is not tools/templates/sw.js with {keep_url} (rebuild)')
        for needle, why in (("const CACHE = 'mar-immutable-v1'", 'one cache, mar-immutable-v1'), ('const MAX = 1600', 'the 1,600-entry cap'),
                            ("request.method !== 'GET'", 'GET only'), ("request.mode === 'navigate'", 'navigations pass through'),
                            ("headers.has('range')", 'Range requests pass through'), ('url.origin !== self.location.origin', 'same origin only'),
                            ("response.type === 'basic'", 'basic responses only'), ('response.status === 200', 'status 200 only'),
                            ("crypto.subtle.digest('SHA-256'", 'bytes verified against the URL hash'), ("cache: 'no-store'", 'keep list fetched no-store'),
                            ('skipWaiting()', 'skipWaiting'), ('clients.claim()', 'clients.claim')):
            seen('service-worker')
            if needle not in source:
                fail('service-worker', f'docs/sw.js lost a safety rule ({why}): {needle!r} not found')
        for pattern in (SW_HASHED.pattern, SW_VERSIONED.pattern):
            seen('service-worker')
            if pattern.replace('\\', '') not in source.replace('\\', ''):
                fail('service-worker', f'docs/sw.js does not use the agreed pattern {pattern}')
    elif 'unregister()' not in source:
        fail('service-worker', 'tools/templates/sw.js has no __KEEP_URL__ and is not a self-unregistering kill worker')
    if re.search(r'\b(?:eval|importScripts)\s*\(|new\s+Function\b', source):
        fail('service-worker', 'docs/sw.js uses eval, Function or importScripts')
    for file, page in pages.items():
        seen('service-worker')
        snippets = [body for attrs, body in page.scripts if SW_REGISTER in body]
        if len(snippets) != 1:
            fail('service-worker', f'{rel(file)}: {len(snippets)} service worker registration snippets (expected 1, from <!--HEAD_COMMON-->)')
            continue
        text = file.read_text()
        if text.find(SW_REGISTER) > text.find('</head>'):
            fail('service-worker', f'{rel(file)}: the service worker registration is not in <head>')
        body = snippets[0]
        for needle in ("l.hostname!=='www.myanimalroom.com'", '/[?&]sw=1(&|$)/', '/[?&]sw=off(&|$)/', 'unregister()', "indexOf('mar-')===0", 'requestIdleCallback', 'try{'):
            if needle not in body:
                fail('service-worker', f'{rel(file)}: registration snippet lacks {needle!r}')
    if not keep_url:
        return
    try:
        urls = json.loads(keeps[0].read_text())
    except ValueError as error:
        fail('keep-list', f'{rel(keeps[0])} is not JSON: {error}')
        return
    if not isinstance(urls, list) or not all(isinstance(url, str) for url in urls):
        fail('keep-list', f'{rel(keeps[0])} is not a list of URL strings')
        return
    if f'.{hashlib.sha256(keeps[0].read_bytes()).hexdigest()[:10]}.' not in keeps[0].name:
        fail('keep-list', f'{rel(keeps[0])} is not named after sha256[:10] of its bytes')
    if urls != sorted(set(urls)):
        fail('keep-list', 'the keep list is not sorted and unique')
    keep = set(urls)
    digests = {}

    def digest(path):
        if path not in digests:
            digests[path] = hashlib.sha256(path.read_bytes()).hexdigest()[:10] if path.is_file() else None
        return digests[path]

    for url in urls:
        seen('keep-list')
        parts = urlsplit(url)
        if not url.startswith('/') or url.startswith('//') or parts.path in ('/sw.js',) or parts.path.startswith('/assets/cache-keep.'):
            fail('keep-list', f'{url}: not a cacheable same-origin asset URL')
            continue
        if not sw_eligible(url):
            fail('keep-list', f'{url}: matches neither worker pattern, so the worker never caches it')
            continue
        target = DOCS / unquote(parts.path).lstrip('/')
        actual = digest(target)
        named = SW_HASHED.search(parts.path)
        versioned = SW_VERSIONED.search('?' + parts.query) if parts.query else None
        if actual is None:
            fail('keep-list', f'{url}: file is missing')
        elif named and named[1] != actual and not versioned:
            fail('keep-list', f'{url}: name hash differs from sha256[:10] of the file')
        elif versioned and versioned[1] != actual:
            fail('keep-list', f'{url}: ?v= differs from sha256[:10] of the file')
    # Coverage: every cacheable URL a page references (attributes, import maps, inline url()).
    for file in pages:
        text = file.read_text()
        for url in LOCAL_URL.findall(text):
            url = htmllib.unescape(url)
            if url.startswith('/assets/') or url.startswith(('/favicon', '/apple-touch-icon')):
                if sw_eligible(url):
                    seen('keep-list')
                    if url not in keep:
                        fail('keep-list', f'{rel(file)}: {url} is not in the keep list')
    # Coverage: the room manifest and every file it points to, and every room/font lock file.
    for name in ('room', 'font'):
        for entry in locks.get(name, {}).get('outputs', ()):
            seen('keep-list')
            if f'/assets/{entry["file"]}' not in keep and (ASSETS / entry['file']).exists():
                fail('keep-list', f'{name} lock file /assets/{entry["file"]} is not in the keep list')
    for manifest in sorted((ASSETS / 'rooms').glob('manifest.*.json')):
        rooms = json.loads(manifest.read_text()).get('rooms', {})
        for rid, room in rooms.items():
            files = [room.get('thumb'), room.get('day'), *room.get('tod', {}).values(), *(layer.get('src') for layer in room.get('layers', [])),
                     *(item.get('thumb') for item in room.get('items', []))]
            for item in filter(None, files):
                seen('keep-list')
                url = '/' + (manifest.parent / item).resolve().relative_to(DOCS.resolve()).as_posix()
                if url not in keep:
                    fail('keep-list', f'room {rid}: {url} (from the manifest) is not in the keep list')


def check_deploy_guard(pages):
    for file, page in pages.items():
        key = file.relative_to(DOCS).as_posix()
        seen('deploy-guard')
        if page.draft is not None:
            fail('deploy-guard', f'{key}: data-i18n-draft="{page.draft}" (untranslated copy; Korean fallback in use)')
        if page.lang == 'ko':
            continue
        hits = []
        for text, ko, _ in page.text:
            if not ko and HANGUL.search(text):
                hits.append(text.strip()[:40])
        for attr, value, ko, _ in page.attr_text:
            if not ko and HANGUL.search(value):
                hits.append(f'{attr}="{value[:40]}"')
        for attrs, body in page.scripts:
            if attrs.get('id') == 'page-copy':
                try:
                    copy = json.loads(body)['copy']
                except (ValueError, KeyError):
                    continue
                hits += [f'page-copy {k[:20]}' for k, v in copy.items() if HANGUL.search(v)]
        if hits:
            fail('deploy-guard', f'{key}: Hangul outside [lang="ko"] ({len(hits)}): {hits[0]!r}')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--allow-draft', action='store_true')
    parser.add_argument('--group', action='append', help='only report these groups')
    parser.add_argument('--list-groups', action='store_true')
    parser.add_argument('--quiet', action='store_true', help='print counts only, not every message')
    args = parser.parse_args()
    pages = load_pages()
    locks = load_locks()
    check_boundary(pages)
    check_stamps_and_maps()
    listed = check_locks(locks)
    check_rooms(locks, listed)
    check_links(pages)
    check_images(pages, listed)
    check_orphans(pages, listed)
    check_locale_contracts(pages)
    check_structure(pages)
    check_seo(pages)
    check_css(pages)
    check_inline_style_hex(pages)
    check_glyphs(locks, pages)
    if not args.allow_draft:
        check_deploy_guard(pages)
    else:
        seen('deploy-guard', 0)
        NOTES.append('deploy guard skipped (--allow-draft)')
    check_service_worker(pages, locks, listed)
    shown = [g for g in GROUPS if not args.group or g in args.group]
    if args.list_groups:
        print('\n'.join(GROUPS))
        return 0
    problems = 0
    for group in shown:
        messages = GROUPS[group]
        problems += len(messages)
        status = 'FAIL' if messages else 'ok  '
        print(f'{status} {group:<14} {COUNTS[group]:>6} checked, {len(messages)} problems')
        if not args.quiet:
            for message in messages[:25]:
                print('       ' + message)
            if len(messages) > 25:
                print(f'       ... {len(messages) - 25} more')
    for note in NOTES:
        print('note:', note)
    bad = [g for g in shown if GROUPS[g]]
    if bad:
        print(f'FAIL {len(bad)} of {len(shown)} groups ({problems} problems): {", ".join(bad)}')
        return 1
    print(f'PASS {len(pages)} generated pages, {len(LOCALES)} locales, {len(shown)} check groups'
          + (' (draft allowed)' if args.allow_draft else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
